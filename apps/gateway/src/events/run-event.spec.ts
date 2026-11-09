import { fromBusMessage, fromGrpcEvent } from './run-event';

describe('run-event mapping', () => {
  it('parses gRPC events (JSON payload string, snake_case)', () => {
    const dto = fromGrpcEvent({
      run_id: 'r1',
      agent: 'writer',
      type: 'NODE_FINISHED',
      node: 'draft',
      seq: 4,
      timestamp: '2026-01-01T00:00:00Z',
      payload_json: '{"duration_ms": 12.5}',
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      metadata: { tenant: 't' },
    });
    expect(dto).toEqual({
      runId: 'r1',
      agent: 'writer',
      type: 'NODE_FINISHED',
      node: 'draft',
      seq: 4,
      timestamp: '2026-01-01T00:00:00Z',
      payload: { duration_ms: 12.5 },
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      metadata: { tenant: 't' },
    });
  });

  it('tolerates malformed payload JSON', () => {
    const dto = fromGrpcEvent({
      run_id: 'r1', agent: 'a', type: 'LOG', node: '', seq: 1, timestamp: 't', payload_json: 'not json',
    });
    expect(dto.payload).toEqual({ raw: 'not json' });
    expect(dto.usage).toBeNull();
  });

  it('accepts well-formed bus messages and rejects junk', () => {
    const ok = fromBusMessage({
      run_id: 'r1', agent: 'reviewer', type: 'INTERRUPT', node: 'human_approval', seq: 3,
      timestamp: 't', payload: { question: 'ok?' }, usage: null, metadata: {},
    });
    expect(ok?.payload).toEqual({ question: 'ok?' });
    expect(fromBusMessage({ hello: 'world' })).toBeNull();
    expect(fromBusMessage('string')).toBeNull();
    expect(fromBusMessage(null)).toBeNull();
  });
});
