import Link from 'next/link';
import { Notice } from '@/components/notice';
import { RunsTable } from '@/components/runs-table';
import { api, tryFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const { data: runs, error } = await tryFetch(() => api.runs());

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
          <p className="mt-1 text-sm text-muted">Newest first. Updates live as events arrive.</p>
        </div>
        <Link href="/runs/new" className="btn btn-primary">
          New run
        </Link>
      </div>
      {error ? <Notice title="Could not load runs" tone="danger">{error}</Notice> : <RunsTable initialRuns={runs ?? []} />}
    </div>
  );
}
