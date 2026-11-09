// Orchestrates a run: persist the record, stream events from the runtime, keep the record's
// status in sync, append events to the log, and (when no bus relay is active) push events to
// WebSocket clients. This is the service layer the unit tests target.
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Run, RunStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { BusState } from '../bus/bus-state';
import { EventLogService } from '../events/event-log.service';
import { fromGrpcEvent, RunEventDto } from '../events/run-event';
import { AgentGrpcClient } from '../grpc/agent-grpc.client';
import type { GrpcRunEvent } from '../grpc/types';
import { PrismaService } from '../prisma/prisma.service';
import { RunsGateway } from '../ws/runs.gateway';
import { ApproveRunDto } from './dto/approve-run.dto';
import { StartRunDto } from './dto/start-run.dto';

const toJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);
  /** In-flight stream consumers, so tests (and graceful shutdown) can await them. */
  private readonly inflight = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly grpc: AgentGrpcClient,
    private readonly events: EventLogService,
    private readonly ws: RunsGateway,
    private readonly bus: BusState,
  ) {}

  async start(dto: StartRunDto): Promise<Run> {
    const id = randomUUID();
    const run = await this.prisma.run.create({
      data: {
        id,
        agent: dto.agent,
        input: dto.input,
        status: RunStatus.QUEUED,
        metadata: dto.metadata ? toJson(dto.metadata) : Prisma.JsonNull,
      },
    });
    // Fire and forget: the HTTP response returns immediately; progress flows over WebSocket.
    this.track(this.consume(id, this.grpc.startRun({ run_id: id, agent: dto.agent, input: dto.input, metadata: dto.metadata ?? {} })));
    return run;
  }

  async approve(id: string, dto: ApproveRunDto): Promise<Run> {
    const run = await this.get(id);
    if (run.status !== RunStatus.WAITING_APPROVAL) {
      throw new ConflictException(`run ${id} is ${run.status}, not WAITING_APPROVAL`);
    }
    const updated = await this.prisma.run.update({
      where: { id },
      data: { status: RunStatus.RUNNING, interrupt: Prisma.JsonNull },
    });
    this.track(
      this.consume(
        id,
        this.grpc.resumeRun({
          run_id: id,
          approved: dto.approved,
          feedback: dto.feedback ?? '',
          resume_payload_json: dto.payload ? JSON.stringify(dto.payload) : '',
        }),
      ),
    );
    return updated;
  }

  async get(id: string): Promise<Run> {
    const run = await this.prisma.run.findUnique({ where: { id } });
    if (!run) throw new NotFoundException(`run ${id} not found`);
    return run;
  }

  list(limit = 50): Promise<Run[]> {
    return this.prisma.run.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(limit, 200) });
  }

  listEvents(id: string): Promise<RunEventDto[]> {
    return this.events.list(id);
  }

  /** Resolves when every background stream consumer has finished. Used by tests. */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.inflight]);
  }

  // ------------------------------------------------------------------ internals

  private track(p: Promise<void>): void {
    this.inflight.add(p);
    void p.finally(() => this.inflight.delete(p));
  }

  private async consume(id: string, stream: AsyncIterable<GrpcRunEvent>): Promise<void> {
    try {
      for await (const raw of stream) {
        const event = fromGrpcEvent(raw);
        await this.events.append(event).catch((err: Error) => this.logger.warn(`event log append failed: ${err.message}`));
        await this.applyStatus(id, event);
        if (!this.bus.relayEnabled) this.ws.emitRunEvent(event);
      }
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      this.logger.error(`run ${id} stream failed: ${message}`);
      await this.prisma.run
        .update({ where: { id }, data: { status: RunStatus.FAILED, error: message } })
        .catch(() => undefined);
    }
  }

  /** Map event types to run status transitions and persist the useful payloads. */
  private async applyStatus(id: string, event: RunEventDto): Promise<void> {
    let data: Prisma.RunUpdateInput | null = null;
    switch (event.type) {
      case 'RUN_STARTED':
      case 'RESUMED':
        data = { status: RunStatus.RUNNING };
        break;
      case 'INTERRUPT':
        data = { status: RunStatus.WAITING_APPROVAL, interrupt: toJson(event.payload) };
        break;
      case 'DONE': {
        const output = (event.payload['output'] as Record<string, unknown> | undefined) ?? {};
        const rejected = event.payload['status'] === 'REJECTED' || output['status'] === 'rejected';
        data = {
          status: rejected ? RunStatus.REJECTED : RunStatus.COMPLETED,
          output: toJson(output),
          usage: event.usage ? toJson(event.usage) : undefined,
          interrupt: Prisma.JsonNull,
        };
        break;
      }
      case 'FAILED':
        data = { status: RunStatus.FAILED, error: String(event.payload['error'] ?? 'unknown error') };
        break;
      default:
        return;
    }
    await this.prisma.run.update({ where: { id }, data });
  }
}
