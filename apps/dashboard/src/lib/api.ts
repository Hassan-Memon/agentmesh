// Fetch helpers usable from both server components (Node) and client components (browser).
// The gateway URL is public because the browser talks to the gateway directly for WebSockets.
// With NEXT_PUBLIC_DEMO_MODE=1 the same `api` object is served by an in-browser simulation
// instead (./demo/engine.ts), so pages and components do not change.
import { demoApi } from './demo/engine';
import { DEMO_MODE } from './demo/flag';
import { ApiError } from './errors';
import type { Agent, Run, RunEvent } from './types';

export { ApiError } from './errors';
export { DEMO_MODE } from './demo/flag';

export const GATEWAY_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:4000').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    // Server components must not cache run data; it changes every second.
    cache: 'no-store',
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      detail = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? detail);
    } catch {
      // keep statusText
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

const gatewayApi = {
  agents: () => request<Agent[]>('/agents'),
  runs: (limit = 50) => request<Run[]>(`/runs?limit=${limit}`),
  run: (id: string) => request<Run>(`/runs/${id}`),
  runEvents: (id: string) => request<RunEvent[]>(`/runs/${id}/events`),
  startRun: (body: { agent: string; input: string; metadata?: Record<string, string> }) =>
    request<Run>('/runs', { method: 'POST', body: JSON.stringify(body) }),
  approve: (id: string, body: { approved: boolean; feedback?: string }) =>
    request<Run>(`/runs/${id}/approve`, { method: 'POST', body: JSON.stringify(body) }),
};

export const api: typeof gatewayApi = DEMO_MODE ? demoApi : gatewayApi;

/** Server-side helper: swallow connection errors so a page can render a friendly notice. */
export async function tryFetch<T>(fn: () => Promise<T>): Promise<{ data: T; error: null } | { data: null; error: string }> {
  try {
    return { data: await fn(), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: message };
  }
}
