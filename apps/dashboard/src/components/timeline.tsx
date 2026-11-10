import type { RunEvent, RunEventType } from '@/lib/types';
import { clock } from '@/lib/format';

const tone: Record<RunEventType, string> = {
  RUN_STARTED: 'bg-info',
  NODE_STARTED: 'bg-muted',
  NODE_FINISHED: 'bg-ok',
  TOKEN_USAGE: 'bg-accent',
  INTERRUPT: 'bg-warn',
  RESUMED: 'bg-info',
  DONE: 'bg-ok',
  FAILED: 'bg-danger',
  LOG: 'bg-muted',
};

function describe(ev: RunEvent): string {
  const p = ev.payload;
  switch (ev.type) {
    case 'RUN_STARTED':
      return 'Run started';
    case 'NODE_STARTED':
      return `Node ${ev.node} started`;
    case 'NODE_FINISHED':
      return `Node ${ev.node} finished${typeof p.duration_ms === 'number' ? ` in ${p.duration_ms} ms` : ''}`;
    case 'TOKEN_USAGE':
      return `Tokens: ${ev.usage?.prompt_tokens ?? 0} in, ${ev.usage?.completion_tokens ?? 0} out`;
    case 'INTERRUPT':
      return 'Paused for human approval';
    case 'RESUMED':
      return `Resumed (${p.approved ? 'approved' : 'rejected'})`;
    case 'DONE':
      return `Done: ${String(p.status ?? 'COMPLETED').toLowerCase()}`;
    case 'FAILED':
      return `Failed: ${String(p.error ?? 'unknown error')}`;
    default:
      return typeof p.error === 'string' ? `Log: ${p.error}` : 'Log';
  }
}

export function Timeline({ events, live }: { events: RunEvent[]; live?: boolean }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted">{live ? 'Waiting for the first event...' : 'No events recorded.'}</p>;
  }
  return (
    <ol className="relative ml-2 border-l border-line">
      {events.map((ev) => (
        <li key={ev.seq} className="relative mb-4 pl-5">
          <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${tone[ev.type] ?? 'bg-muted'}`} aria-hidden />
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-medium">{describe(ev)}</span>
            <span className="font-mono text-xs text-muted">
              #{ev.seq} {clock(ev.timestamp)}
            </span>
          </div>
          {ev.type === 'NODE_FINISHED' && ev.payload.summary && typeof ev.payload.summary === 'object' ? (
            <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-surface-2 p-2 font-mono text-xs text-muted">
              {JSON.stringify(ev.payload.summary, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
