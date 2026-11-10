import Link from 'next/link';
import { Notice } from '@/components/notice';
import { api, tryFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const { data: agents, error } = await tryFetch(() => api.agents());

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="mt-1 text-sm text-muted">Discovered from the runtime registry over gRPC ListAgents.</p>
        </div>
        <Link href="/runs/new" className="btn btn-primary">
          New run
        </Link>
      </div>

      {error ? <Notice title="Could not load agents" tone="danger">{error}</Notice> : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(agents ?? []).map((a) => (
          <article key={a.name} className="card flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{a.name}</h2>
              <span className="font-mono text-xs text-muted">v{a.version}</span>
            </div>
            <p className="mt-2 flex-1 text-sm text-muted">{a.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {a.capabilities.map((c) => (
                <span key={c} className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs">
                  {c}
                </span>
              ))}
              {a.requiresApproval ? (
                <span className="rounded-full border border-warn/50 px-2 py-0.5 text-xs text-warn">human approval</span>
              ) : null}
            </div>
            <Link href={`/runs/new?agent=${a.name}`} className="btn mt-5 self-start">
              Run {a.name}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
