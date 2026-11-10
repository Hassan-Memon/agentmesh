import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LiveRun } from '@/components/live-run';
import { Notice } from '@/components/notice';
import { StatusBadge } from '@/components/status-badge';
import { api, ApiError } from '@/lib/api';
import { timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

// Server component renders the snapshot; <LiveRun> (client) takes over with the WebSocket.
export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let run, events;
  try {
    [run, events] = await Promise.all([api.run(id), api.runEvents(id).catch(() => [])]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    return (
      <Notice title="Could not load run" tone="danger">
        {err instanceof Error ? err.message : String(err)}
      </Notice>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/runs" className="text-sm text-muted hover:text-fg">
            All runs
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {run.agent}
            <StatusBadge status={run.status} />
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
