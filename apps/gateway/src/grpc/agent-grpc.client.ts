// gRPC client for the Python runtime. See docs/learn/03-concepts/grpc-and-protobuf.md.
//
// Why proto-loader instead of generated code? The proto is small, protoc is not installed on
// the dev machine, and runtime loading keeps the TypeScript build toolchain plain `tsc`.
// The cost is that request/response types are hand-written in ./types.ts.
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { AppConfigService } from '../config/app-config.service';
import {
  AgentInfo,
  AgentServiceClient,
  GetRunResponse,
  GrpcRunEvent,
  ResumeRunRequest,
  StartRunRequest,
} from './types';

interface AgentMeshPackage {
  agentmesh: {
    v1: {
      AgentService: new (address: string, creds: grpc.ChannelCredentials, options?: grpc.ChannelOptions) => AgentServiceClient;
    };
  };
}

export function resolveProtoPath(explicit?: string): string {
  const candidates = [
    explicit,
    // running from apps/gateway (dev) or from dist/ inside apps/gateway
    path.resolve(process.cwd(), '../../proto/agentmesh/v1/agent.proto'),
    // running inside the Docker image where proto/ is copied next to dist/
    path.resolve(process.cwd(), 'proto/agentmesh/v1/agent.proto'),
    path.resolve(__dirname, '../../../../proto/agentmesh/v1/agent.proto'),
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`agent.proto not found. Tried: ${candidates.join(', ')}. Set PROTO_PATH.`);
  }
  return found;
}

@Injectable()
export class AgentGrpcClient implements OnModuleDestroy {
  private readonly logger = new Logger(AgentGrpcClient.name);
  private readonly client: AgentServiceClient;

  constructor(config: AppConfigService) {
    const protoPath = resolveProtoPath(config.protoPath);
    const definition = protoLoader.loadSync(protoPath, {
      keepCase: true, // snake_case fields, same as the JSON on the bus
      longs: Number, // int64 seq -> JS number (safe well below 2^53)
      enums: String, // 'NODE_STARTED' instead of 2
      defaults: true, // fill unset fields with proto3 defaults
      oneofs: true,
    });
    const pkg = grpc.loadPackageDefinition(definition) as unknown as AgentMeshPackage;
    this.client = new pkg.agentmesh.v1.AgentService(config.agentRuntimeGrpcUrl, grpc.credentials.createInsecure(), {
      'grpc.keepalive_time_ms': 30_000,
      // reconnect quickly after the runtime restarts
      'grpc.initial_reconnect_backoff_ms': 500,
      'grpc.max_reconnect_backoff_ms': 5_000,
    });
    this.logger.log(`loaded ${path.basename(protoPath)}, dialing ${config.agentRuntimeGrpcUrl}`);
  }

  listAgents(): Promise<AgentInfo[]> {
    return new Promise((resolve, reject) => {
      this.client.ListAgents({}, (err, res) => (err ? reject(err) : resolve(res.agents ?? [])));
    });
  }

  getRun(runId: string): Promise<GetRunResponse> {
    return new Promise((resolve, reject) => {
      this.client.GetRun({ run_id: runId }, (err, res) => (err ? reject(err) : resolve(res)));
    });
  }

  /** Server-streaming RPC exposed as an async iterable so callers can `for await`. */
  startRun(request: StartRunRequest): AsyncIterable<GrpcRunEvent> {
    return this.client.StartRun(request);
  }

  resumeRun(request: ResumeRunRequest): AsyncIterable<GrpcRunEvent> {
    return this.client.ResumeRun(request);
  }

  /** Used by /health to report whether the runtime is reachable. */
  isReady(timeoutMs = 1_000): Promise<boolean> {
    return new Promise((resolve) => {
      this.client.waitForReady(Date.now() + timeoutMs, (err) => resolve(!err));
    });
  }

  onModuleDestroy(): void {
    this.client.close();
  }
}
