// Unit tests for the service layer with every I/O dependency mocked: gRPC client, Prisma,
// event log, WebSocket gateway. Nest's testing module builds the same DI graph as production.
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RunStatus } from '@prisma/client';
import { BusState } from '../bus/bus-state';
import { EventLogService } from '../events/event-log.service';
import { AgentGrpcClient } from '../grpc/agent-grpc.client';
import type { GrpcRunEvent } from '../grpc/types';
import { PrismaService } from '../prisma/prisma.service';
import { RunsGateway } from '../ws/runs.gateway';
import { RunsService } from './runs.service';

async function* stream(events: GrpcRunEvent[]): AsyncIterable<GrpcRunEvent> {
  for (const e of events) yield e;
}

function ev(partial: Partial<GrpcRunEvent> & Pick<GrpcRunEvent, 'type' | 'seq'>): GrpcRunEvent {
  return {
    run_id: 'r1',
    agent: 'reviewer',
    node: '',
    timestamp: '2026-01-01T00:00:00Z',
    payload_json: '{}',
    usage: null,
    metadata: {},
    ...partial,
  };
}

describe('RunsService', () => {
  let service: RunsService;
  let prisma: { run: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock } };
  let grpc: { startRun: jest.Mock; resumeRun: jest.Mock };
  let events: { append: jest.Mock; list: jest.Mock };
  let ws: { emitRunEvent: jest.Mock };
  let bus: BusState;

  beforeEach(async () => {
    prisma = {
      run: {
        create: jest.fn(async ({ data }) => ({ ...data, createdAt: new Date(), updatedAt: new Date() })),
        update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
        findUnique: jest.fn(),
        findMany: jest.fn(async () => []),
      },
    };
    grpc = { startRun: jest.fn(), resumeRun: jest.fn() };
    events = { append: jest.fn(async () => undefined), list: jest.fn(async () => []) };
    ws = { emitRunEvent: jest.fn() };
    bus = new BusState();

    const moduleRef = await Test.createTestingModule({
      providers: [
        RunsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentGrpcClient, useValue: grpc },
        { provide: EventLogService, useValue: events },
        { provide: RunsGateway, useValue: ws },
        { provide: BusState, useValue: bus },
      ],
    }).compile();

    service = moduleRef.get(RunsService);
  });

  it('creates a QUEUED run and streams it to COMPLETED', async () => {
    grpc.startRun.mockReturnValue(
      stream([
        ev({ type: 'RUN_STARTED', seq: 1 }),
        ev({ type: 'NODE_STARTED', seq: 2, node: 'outline' }),
        ev({
          type: 'DONE',
          seq: 3,
          payload_json: JSON.stringify({ status: 'COMPLETED', output: { draft: 'hello' } }),
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      ]),
    );

    const run = await service.start({ agent: 'writer', input: 'Write about gRPC' });
    expect(run.status).toBe(RunStatus.QUEUED);
    expect(grpc.startRun).toHaveBeenCalledWith(
      expect.objectContaining({ run_id: run.id, agent: 'writer', input: 'Write about gRPC' }),
    );

    await service.drain();

    expect(events.append).toHaveBeenCalledTimes(3);
    const statuses = prisma.run.update.mock.calls.map((c) => c[0].data.status);
    expect(statuses).toEqual([RunStatus.RUNNING, RunStatus.COMPLETED]);
    const done = prisma.run.update.mock.calls.at(-1)?.[0].data;
    expect(done.output).toEqual({ draft: 'hello' });
    expect(done.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
    // bus relay off => the service itself pushes to WebSocket clients
    expect(ws.emitRunEvent).toHaveBeenCalledTimes(3);
    expect(ws.emitRunEvent.mock.calls[2][0]).toMatchObject({ type: 'DONE', seq: 3, payload: { output: { draft: 'hello' } } });
  });

  it('marks the run WAITING_APPROVAL on INTERRUPT and stores the prompt', async () => {
    grpc.startRun.mockReturnValue(
      stream([
        ev({ type: 'RUN_STARTED', seq: 1 }),
        ev({ type: 'INTERRUPT', seq: 2, node: 'human_approval', payload_json: '{"question":"Approve?"}' }),
      ]),
    );
    await service.start({ agent: 'reviewer', input: 'Review me' });
    await service.drain();

    const last = prisma.run.update.mock.calls.at(-1)?.[0].data;
    expect(last.status).toBe(RunStatus.WAITING_APPROVAL);
    expect(last.interrupt).toEqual({ question: 'Approve?' });
  });

  it('does not emit to WebSocket when the bus relay is active', async () => {
    bus.relayEnabled = true;
    grpc.startRun.mockReturnValue(stream([ev({ type: 'RUN_STARTED', seq: 1 })]));
    await service.start({ agent: 'writer', input: 'x' });
    await service.drain();
    expect(ws.emitRunEvent).not.toHaveBeenCalled();
    expect(events.append).toHaveBeenCalledTimes(1);
  });

  it('approve resumes a WAITING_APPROVAL run and ends REJECTED when the human rejects', async () => {
    prisma.run.findUnique.mockResolvedValue({ id: 'r1', status: RunStatus.WAITING_APPROVAL });
    grpc.resumeRun.mockReturnValue(
      stream([
        ev({ type: 'RESUMED', seq: 5 }),
        ev({ type: 'DONE', seq: 6, payload_json: JSON.stringify({ status: 'REJECTED', output: { status: 'rejected' } }) }),
      ]),
    );

    const run = await service.approve('r1', { approved: false, feedback: 'needs work' });
    expect(run.status).toBe(RunStatus.RUNNING);
    expect(grpc.resumeRun).toHaveBeenCalledWith({
      run_id: 'r1',
      approved: false,
      feedback: 'needs work',
      resume_payload_json: '',
    });
    await service.drain();
    expect(prisma.run.update.mock.calls.at(-1)?.[0].data.status).toBe(RunStatus.REJECTED);
  });

  it('approve refuses runs that are not waiting', async () => {
    prisma.run.findUnique.mockResolvedValue({ id: 'r1', status: RunStatus.RUNNING });
    await expect(service.approve('r1', { approved: true })).rejects.toBeInstanceOf(ConflictException);
    expect(grpc.resumeRun).not.toHaveBeenCalled();
  });

  it('get throws NotFound for unknown ids', async () => {
    prisma.run.findUnique.mockResolvedValue(null);
    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a failing stream marks the run FAILED with the error message', async () => {
    const failing: AsyncIterable<GrpcRunEvent> = {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(new Error('14 UNAVAILABLE: runtime down')),
      }),
    };
    grpc.startRun.mockReturnValue(failing);
    await service.start({ agent: 'writer', input: 'x' });
    await service.drain();
    const last = prisma.run.update.mock.calls.at(-1)?.[0].data;
    expect(last.status).toBe(RunStatus.FAILED);
    expect(last.error).toContain('UNAVAILABLE');
  });
});
