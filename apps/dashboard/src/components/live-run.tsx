'use client';

// The live part of the run detail page. Receives the server-rendered snapshot (run + persisted
// events) and then keeps itself current over Socket.IO: join the run's room, merge incoming
// events by seq (idempotent, so at-least-once delivery is fine), and refetch the run record
// when a status-changing event arrives.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getRunsSocket } from '@/lib/socket';
import type { Run, RunEvent } from '@/lib/types';
import { ApprovalCard } from './approval-card';
import { Timeline } from './timeline';

const STATUS_EVENTS = new Set(['RUN_STARTED', 'INTERRUPT', 'RESUMED', 'DONE', 'FAILED']);

export function LiveRun({ initialRun, initialEvents }: { initialRun: Run; initialEvents: RunEvent[] }) {
  const [run, setRun] = useState<Run>(initialRun);
  const [events, setEvents] = useState<RunEvent[]>(initialEvents);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setRun(await api.run(initialRun.id));
    } catch {
      // transient; the next event will trigger another refresh
    }
  }, [initialRun.id]);

  useEffect(() => {
    const socket = getRunsSocket();
    const onConnect = () => {
      setConnected(true);
      socket.emit('join', initialRun.id);
      void refresh();
    };
    const onDisconnect = () => setConnected(false);
    const onEvent = (ev: RunEvent) => {
      if (ev.runId !== initialRun.id) return;
      setEvents((prev) => (prev.some((e) => e.seq === ev.seq) ? prev : [...prev, ev].sort((a, b) => a.seq - b.seq)));
      if (STATUS_EVENTS.has(ev.type)) void refresh();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('run.event', onEvent);
    if (socket.connected) onConnect();

    return () => {
      socket.emit('leave', initialRun.id);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('run.event', onEvent);
    };
  }, [initialRun.id, refresh]);

  const totalTokens = useMemo(() => run.usage?.total_tokens ?? events.filter((e) => e.type === 'TOKEN_USAGE').reduce((n, e) => n + (e.usage?.total_tokens ?? 0), 0), [run.usage, events]);
  const isTerminal = run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'REJECTED';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        {run.status === 'WAITING_APPROVAL' && run.interrupt ? (
          <ApprovalCard runId={run.id} interrupt={run.interrupt} onDecided={refresh} />
        ) : null}

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Timeline</h2>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? 'bg-ok' : 'bg-danger'}`} aria-hidden />
              {connected ? 'live' : 'reconnecting'}
            </span>
          </div>
          <Timeline events={events} live={!isTerminal} />
        </section>

        {run.output ? (
          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold">Output</h2>
            <Output output={run.output} />
          </section>
        ) : null}

        {run.error ? (
          <section className="card border-danger/60 p-5">
            <h2 className="mb-2 text-base font-semibold text-danger">Error</h2>
            <pre className="whitespace-pre-wrap font-mono text-sm">{run.error}</pre>
          </section>
        ) : null}
      </div>

      <aside className="space-y-4">
        <section className="card p-5 text-sm">
          <h2 className="mb-3 text-base font-semibold">Input</h2>
          <p className="whitespace-pre-wrap text-muted">{run.input}</p>
        </section>
        <section className="card p-5 text-sm">
          <h2 className="mb-3 text-base font-semibold">Stats</h2>
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-muted">Events</dt>
            <dd className="text-right font-mono">{events.length}</dd>
            <dt className="text-muted">Tokens</dt>
            <dd className="text-right font-mono">{totalTokens}</dd>
            <dt className="text-muted">Nodes run</dt>
            <dd className="text-right font-mono">{events.filter((e) => e.type === 'NODE_FINISHED').length}</dd>
            <dt className="text-muted">Updated</dt>
            <dd className="text-right font-mono text-xs">{new Date(run.updatedAt).toLocaleTimeString()}</dd>
          </dl>
        </section>
      </aside>
    </div>
  );
}

function Output({ output }: { output: Record<string, unknown> }) {
  // Show the long text fields as prose and everything else as JSON.
  const prose = ['answer', 'draft', 'outline'].filter((k) => typeof output[k] === 'string');
  const rest = Object.fromEntries(Object.entries(output).filter(([k]) => !prose.includes(k) && k !== 'budget'));
  return (
    <div className="space-y-4 text-sm">
      {prose.map((k) => (
        <div key={k}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{k}</p>
          <p className="whitespace-pre-wrap">{String(output[k])}</p>
        </div>
      ))}
      {Object.keys(rest).length > 0 ? (
        <pre className="max-h-72 overflow-auto rounded-md bg-surface-2 p-3 font-mono text-xs">{JSON.stringify(rest, null, 2)}</pre>
      ) : null}
    </div>
  );
}
