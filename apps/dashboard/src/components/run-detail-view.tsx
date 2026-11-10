import Link from 'next/link';
import { LiveRun } from '@/components/live-run';
import { LiveStatusBadge } from '@/components/live-status-badge';
import { timeAgo } from '@/lib/format';
import type { Run, RunEvent } from '@/lib/types';

// Run detail body: header snapshot plus <LiveRun>, which keeps itself current over the socket.
export function RunDetailView({ run, events }: { run: Run; events: RunEvent[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/runs" className="text-sm text-muted hover:text-fg">
            All runs
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {run.agent}
            <LiveStatusBadge runId={run.id} initial={run.status} />
          </h1>
          <p className="mt-1 font-mono text-xs text-muted">
            {run.id} started {timeAgo(run.createdAt)}
          </p>
        </div>
        <Link href={`/runs/new?agent=${run.agent}`} className="btn">
          Run again
        </Link>
      </div>
      <LiveRun initialRun={run} initialEvents={events} />
    </div>
  );
}
