'use client';

// Runs list with a lightweight live refresh: the gateway broadcasts "run.activity" for every
// event on every run, so we re-fetch the list (debounced) whenever something happens.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { shortId, timeAgo, truncate } from '@/lib/format';
import { getRunsSocket } from '@/lib/socket';
import type { Run } from '@/lib/types';
import { StatusBadge } from './status-badge';

export function RunsTable({ initialRuns }: { initialRuns: Run[] }) {
  const [runs, setRuns] = useState(initialRuns);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = getRunsSocket();
    const onActivity = () => {
      if (timer.current) return;
      timer.current = setTimeout(async () => {
        timer.current = null;
        try {
          setRuns(await api.runs());
        } catch {
          // ignore transient errors
        }
      }, 400);
    };
    socket.on('run.activity', onActivity);
    return () => {
      socket.off('run.activity', onActivity);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (runs.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-muted">
        No runs yet.{' '}
        <Link href="/runs/new" className="text-accent underline">
          Start one
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Run</th>
            <th className="px-4 py-2 font-medium">Agent</th>
            <th className="px-4 py-2 font-medium">Input</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium text-right">Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-line hover:bg-surface-2/60">
              <td className="px-4 py-2 font-mono text-xs">
                <Link href={`/runs/${r.id}`} className="text-accent hover:underline">
                  {shortId(r.id)}
                </Link>
              </td>
              <td className="px-4 py-2">{r.agent}</td>
              <td className="max-w-md truncate px-4 py-2 text-muted">{truncate(r.input)}</td>
              <td className="px-4 py-2">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-4 py-2 text-right text-muted">{timeAgo(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
