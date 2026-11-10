'use client';

// Demo mode only (NEXT_PUBLIC_DEMO_MODE=1). Runs are simulated in the visitor's browser and kept
// in sessionStorage, which the server cannot see, so pages that show runs load their data here
// on the client and then render the exact same views as the gateway-backed pages.
import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Run, RunEvent } from '@/lib/types';
import { HomeView } from './home-view';
import { Notice } from './notice';
import { RunDetailView } from './run-detail-view';
import { RunsTable } from './runs-table';

type Loaded<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; error: unknown };

function useBrowserData<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [result, setResult] = useState<Loaded<T>>({ state: 'loading' });
  useEffect(() => {
    let alive = true;
    setResult({ state: 'loading' });
    load().then(
      (data) => alive && setResult({ state: 'ok', data }),
      (error: unknown) => alive && setResult({ state: 'error', error }),
    );
    return () => {
      alive = false;
    };
    // `key` identifies the request; `load` is a fresh closure every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result;
}

function Loading() {
  return (
    <p className="text-sm text-muted" role="status">
      Loading...
    </p>
  );
}

function ErrorNotice({ title, error }: { title: string; error: unknown }) {
  return (
    <Notice title={title} tone="danger">
      {error instanceof Error ? error.message : String(error)}
    </Notice>
  );
}

export function DemoHome() {
  const res = useBrowserData(() => Promise.all([api.agents(), api.runs(8)]), 'home');
  if (res.state === 'loading') return <Loading />;
  if (res.state === 'error') return <ErrorNotice title="Could not load the demo data" error={res.error} />;
  const [agents, runs] = res.data;
  return <HomeView agents={agents} runs={runs} error={false} />;
}

export function DemoRunsTable() {
  const res = useBrowserData(() => api.runs(), 'runs');
  if (res.state === 'loading') return <Loading />;
  if (res.state === 'error') return <ErrorNotice title="Could not load runs" error={res.error} />;
  return <RunsTable initialRuns={res.data} />;
}

export function DemoRunDetail({ id }: { id: string }) {
  const res = useBrowserData<[Run, RunEvent[]]>(() => Promise.all([api.run(id), api.runEvents(id)]), id);
  if (res.state === 'loading') return <Loading />;
  if (res.state === 'error') {
    if (res.error instanceof ApiError && (res.error.status === 404 || res.error.status === 400)) notFound();
    return <ErrorNotice title="Could not load run" error={res.error} />;
  }
  const [run, events] = res.data;
  return <RunDetailView key={run.id} run={run} events={events} />;
}
