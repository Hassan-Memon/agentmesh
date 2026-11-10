import { Notice } from '@/components/notice';
import { RunForm } from '@/components/run-form';
import { api, tryFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function NewRunPage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const { agent } = await searchParams;
  const { data: agents, error } = await tryFetch(() => api.agents());
  // Put the preselected agent first so the form defaults to it.
  const ordered = agents ? [...agents].sort((a, b) => (a.name === agent ? -1 : b.name === agent ? 1 : 0)) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New run</h1>
        <p className="mt-1 text-sm text-muted">Pick an agent, describe the task, watch it run.</p>
      </div>
      {error ? <Notice title="Could not load agents" tone="danger">{error}</Notice> : <RunForm agents={ordered} />}
    </div>
  );
}
