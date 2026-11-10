import Link from 'next/link';
import { DemoRunsTable } from '@/components/demo-pages';
import { Notice } from '@/components/notice';
import { RunsTable } from '@/components/runs-table';
import { api, DEMO_MODE, tryFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  // Demo mode: runs live in the visitor's sessionStorage, so the table loads in the browser.
  const { data: runs, error } = DEMO_MODE ? { data: null, error: null } : await tryFetch(() => api.runs());

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
      {DEMO_MODE ? (
        <DemoRunsTable />
      ) : error ? (
        <Notice title="Could not load runs" tone="danger">
          {error}
        </Notice>
      ) : (
        <RunsTable initialRuns={runs ?? []} />
      )}
    </div>
  );
}
