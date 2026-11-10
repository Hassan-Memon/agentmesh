import Link from 'next/link';
import { Notice } from '@/components/notice';
import { StatusBadge } from '@/components/status-badge';
import { api, GATEWAY_URL, tryFetch } from '@/lib/api';
import { shortId, timeAgo } from '@/lib/format';

// Server component: fetched on every request (no caching of live data).
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [agents, runs] = await Promise.all([tryFetch(() => api.agents()), tryFetch(() => api.runs(8))]);
  const counts = (runs.data ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Agent operations</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          LangGraph agents running as services behind a gRPC gateway. Every step is streamed over the event bus; risky steps
          wait for a human.
        </p>
      </section>

      {agents.error || runs.error ? (
        <Notice title="Gateway not reachable" tone="danger">
          Tried <code className="font-mono">{GATEWAY_URL}</code>. Start it with{' '}
          <code className="font-mono">docker compose -f infra/docker-compose.yml up</code> or set{' '}
          <code className="font-mono">NEXT_PUBLIC_GATEWAY_URL</code>.
        </Notice>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Agents" value={agents.data?.length ?? 0} href="/agents" />
        <Stat label="Needs approval" value={counts['WAITING_APPROVAL'] ?? 0} href="/runs" tone="warn" />
        <Stat label="Running" value={counts['RUNNING'] ?? 0} href="/runs" tone="info" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Agents</h2>
            <Link href="/agents" className="text-sm text-accent hover:underline">
              All agents
            </Link>
          </div>
          <ul className="divide-y divide-line text-sm">
            {(agents.data ?? []).map((a) => (
              <li key={a.name} className="flex items-start justify-between gap-4 py-2">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-muted">{a.description}</div>
                </div>
                {a.requiresApproval ? <span className="shrink-0 text-xs text-warn">HITL</span> : null}
              </li>
            ))}
            {agents.data && agents.data.length === 0 ? <li className="py-2 text-muted">No agents registered.</li> : null}
          </ul>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent runs</h2>
            <Link href="/runs" className="text-sm text-accent hover:underline">
              All runs
            </Link>
          </div>
          <ul className="divide-y divide-line text-sm">
            {(runs.data ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/runs/${r.id}`} className="font-mono text-xs text-accent hover:underline">
                  {shortId(r.id)}
                </Link>
                <span className="flex-1 truncate text-muted">
                  {r.agent}: {r.input}
                </span>
                <StatusBadge status={r.status} />
                <span className="shrink-0 text-xs text-muted">{timeAgo(r.createdAt)}</span>
              </li>
            ))}
            {runs.data && runs.data.length === 0 ? (
              <li className="py-2 text-muted">
                No runs yet.{' '}
                <Link href="/runs/new" className="text-accent underline">
                  Start one
                </Link>
                .
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, href, tone }: { label: string; value: number; href: string; tone?: 'warn' | 'info' }) {
  const color = tone === 'warn' ? 'text-warn' : tone === 'info' ? 'text-info' : 'text-fg';
  return (
    <Link href={href} className="card block p-5 transition hover:bg-surface-2">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${color}`}>{value}</div>
    </Link>
  );
}
