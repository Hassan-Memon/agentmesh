// Hand-written TypeScript mirrors of proto/agentmesh/v1/agent.proto.
//
// We load the .proto at runtime with @grpc/proto-loader (no codegen step), so these
// interfaces are what gives us compile-time safety. Field names are snake_case because the
// loader is configured with `keepCase: true` to match the JSON the Python side publishes
// on the bus. Enums are loaded as strings (`enums: String`).

import type { ClientReadableStream, ServiceError } from '@grpc/grpc-js';

export type RunEventType =
  | 'RUN_EVENT_TYPE_UNSPECIFIED'
  | 'RUN_STARTED'
  | 'NODE_STARTED'
  | 'NODE_FINISHED'
  | 'TOKEN_USAGE'
  | 'INTERRUPT'
  | 'RESUMED'
  | 'DONE'
  | 'FAILED'
  | 'LOG';

export type GrpcRunStatus =
  | 'RUN_STATUS_UNSPECIFIED'
  | 'RUN_STATUS_QUEUED'
  | 'RUN_STATUS_RUNNING'
  | 'RUN_STATUS_WAITING_APPROVAL'
  | 'RUN_STATUS_COMPLETED'
  | 'RUN_STATUS_FAILED'
  | 'RUN_STATUS_REJECTED';

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AgentInfo {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  requires_approval: boolean;
}

export interface ListAgentsResponse {
  agents: AgentInfo[];
}

export interface StartRunRequest {
  run_id: string;
  agent: string;
  input: string;
  metadata?: Record<string, string>;
}

export interface ResumeRunRequest {
  run_id: string;
  approved: boolean;
  feedback?: string;
  resume_payload_json?: string;
}

export interface GetRunRequest {
  run_id: string;
}

export interface GetRunResponse {
  run_id: string;
  agent: string;
  status: GrpcRunStatus;
  output_json: string;
  interrupt_json: string;
  usage?: TokenUsage;
  error: string;
}

export interface GrpcRunEvent {
  run_id: string;
  agent: string;
  type: RunEventType;
  node: string;
  seq: number;
  timestamp: string;
  payload_json: string;
  usage?: TokenUsage | null;
  metadata?: Record<string, string>;
}

type UnaryCallback<T> = (err: ServiceError | null, response: T) => void;

/** The shape proto-loader gives us for `agentmesh.v1.AgentService`. */
export interface AgentServiceClient {
  ListAgents(request: Record<string, never>, callback: UnaryCallback<ListAgentsResponse>): void;
  StartRun(request: StartRunRequest): ClientReadableStream<GrpcRunEvent>;
  ResumeRun(request: ResumeRunRequest): ClientReadableStream<GrpcRunEvent>;
  GetRun(request: GetRunRequest, callback: UnaryCallback<GetRunResponse>): void;
  waitForReady(deadline: Date | number, callback: (error?: Error) => void): void;
  close(): void;
}
