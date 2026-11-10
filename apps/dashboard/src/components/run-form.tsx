'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { Agent } from '@/lib/types';

const examples: Record<string, string> = {
  researcher: 'How does AgentMesh keep a human in the loop, and where is run state stored?',
  writer: 'Write a short explainer on why a gateway should talk to agent services over gRPC rather than REST.',
  reviewer:
    'Draft for review: AgentMesh runs each agent as a service and streams every step to the dashboard. Humans approve risky steps before anything is published.',
};

export function RunForm({ agents }: { agents: Agent[] }) {
  const router = useRouter();
  const [agent, setAgent] = useState(agents[0]?.name ?? 'researcher');
  const [input, setInput] = useState(examples[agents[0]?.name ?? 'researcher'] ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = agents.find((a) => a.name === agent);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const run = await api.startRun({ agent, input, metadata: { source: 'dashboard' } });
      router.push(`/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <div>
        <label className="block text-sm font-medium" htmlFor="agent">
          Agent
        </label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {agents.map((a) => (
            <button
              type="button"
              key={a.name}
              onClick={() => {
                setAgent(a.name);
                setInput(examples[a.name] ?? '');
              }}
              className={`rounded-lg border p-3 text-left text-sm transition ${
                a.name === agent ? 'border-accent bg-surface-2' : 'border-line hover:bg-surface-2'
              }`}
            >
              <div className="font-medium">{a.name}</div>
              <div className="mt-1 text-xs text-muted">{a.requiresApproval ? 'Pauses for approval' : 'Runs to completion'}</div>
            </button>
          ))}
        </div>
        {selected ? <p className="mt-2 text-sm text-muted">{selected.description}</p> : null}
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="input">
          Task
        </label>
        <textarea id="input" className="input mt-2 min-h-36" value={input} onChange={(e) => setInput(e.target.value)} required />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>
          {busy ? 'Starting...' : 'Start run'}
        </button>
      </div>
    </form>
  );
}
