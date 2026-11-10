import { notFound } from 'next/navigation';
import { DemoRunDetail } from '@/components/demo-pages';
import { Notice } from '@/components/notice';
import { RunDetailView } from '@/components/run-detail-view';
import { api, ApiError, DEMO_MODE } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Server component renders the snapshot; <LiveRun> (client) takes over with the WebSocket.
export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (DEMO_MODE) return <DemoRunDetail id={id} />;
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

  return <RunDetailView run={run} events={events} />;
}
