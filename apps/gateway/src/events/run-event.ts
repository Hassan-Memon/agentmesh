// The one event shape the gateway works with internally and sends to the dashboard.
// It is produced from two sources that carry the same data in slightly different clothes:
//   * the gRPC stream (payload is a JSON string, field names snake_case)
//   * the RabbitMQ bus (payload already an object, plus a `status` hint)

import type { GrpcRunEvent, RunEventType, TokenUsage } from '../grpc/types';

export interface RunEventDto {
  runId: string;
  agent: string;
  type: RunEventType;
  node: string;
  seq: number;
  timestamp: string;
  payload: Record<string, unknown>;
  usage: TokenUsage | null;
  metadata: Record<string, string>;
}

export function fromGrpcEvent(ev: GrpcRunEvent): RunEventDto {
  return {
    runId: ev.run_id,
    agent: ev.agent,
    type: ev.type,
    node: ev.node ?? '',
    seq: Number(ev.seq),
    timestamp: ev.timestamp,
    payload: safeParse(ev.payload_json),
    usage: ev.usage && ev.usage.total_tokens !== undefined ? normaliseUsage(ev.usage) : null,
    metadata: ev.metadata ?? {},
  };
}

/** Bus messages are untrusted JSON from another process: validate the few fields we rely on. */
export function fromBusMessage(raw: unknown): RunEventDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r['run_id'] !== 'string' || typeof r['type'] !== 'string' || typeof r['seq'] !== 'number') {
    return null;
  }
  const payload = r['payload'];
  const usage = r['usage'];
  return {
    runId: r['run_id'],
    agent: typeof r['agent'] === 'string' ? r['agent'] : '',
    type: r['type'] as RunEventType,
    node: typeof r['node'] === 'string' ? r['node'] : '',
    seq: r['seq'],
    timestamp: typeof r['timestamp'] === 'string' ? r['timestamp'] : new Date().toISOString(),
    payload: payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {},
    usage: usage && typeof usage === 'object' ? normaliseUsage(usage as Partial<TokenUsage>) : null,
    metadata: (r['metadata'] as Record<string, string> | undefined) ?? {},
  };
}

function normaliseUsage(u: Partial<TokenUsage>): TokenUsage {
  return {
    prompt_tokens: Number(u.prompt_tokens ?? 0),
    completion_tokens: Number(u.completion_tokens ?? 0),
    total_tokens: Number(u.total_tokens ?? 0),
  };
}

function safeParse(json: string | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const value: unknown = JSON.parse(json);
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return { raw: json };
  }
}
