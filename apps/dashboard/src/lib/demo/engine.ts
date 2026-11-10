// In-browser stand-in for the gateway + agent runtime, used when NEXT_PUBLIC_DEMO_MODE=1.
//
// It reproduces the real contract rather than inventing a new one:
//   * REST shapes and errors follow apps/gateway/src/runs (202 bodies, 404 / 409 / 400 messages)
//   * RunEvents follow services/agent-runtime/agentmesh_runtime/runs/engine.py: one per-run seq
//     counter that keeps counting across StartRun and ResumeRun, the same payloads per type
//   * status transitions follow RunsService.applyStatus in the gateway
//
// Runs live in sessionStorage so a refresh keeps them, including runs that are mid-flight: each
// future event is stored with the wall-clock time it is due and rescheduled on load.
import { ApiError } from '../errors';
import type { Agent, Run, RunEvent, RunEventType, RunStatus, TokenUsage } from '../types';
import { DEMO_AGENTS, researcherNodes, reviewerReview, SEED_INPUTS, summarizeUpdate, writerNodes, type NodeResult } from './data';

const STORAGE_KEY = 'agentmesh-demo-v1';
const AGENT_NAME = /^[a-z][a-z0-9_-]{1,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** An event the simulated runtime will emit at wall-clock time `at` (ms since epoch). */
interface Pending {
  at: number;
  type: RunEventType;
  node: string;
  payload: Record<string, unknown>;
  usage: TokenUsage | null;
}

interface State {
  v: 1;
  runs: Run[];
  events: Record<string, RunEvent[]>;
  pending: Record<string, Pending[]>;
}

type Listener = (event: RunEvent) => void;

const isBrowser = typeof window !== 'undefined';
let state: State | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

// ---------------------------------------------------------------------------- public API
// Same signatures as `api` in ../api.ts.

export const demoApi = {
  agents: async (): Promise<Agent[]> => {
    await latency();
    return clone(DEMO_AGENTS);
  },

  runs: async (limit = 50): Promise<Run[]> => {
    await latency();
    const s = ensure();
    return clone([...s.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, Math.min(limit, 200)));
  },

  run: async (id: string): Promise<Run> => {
    await latency();
    return clone(requireRun(ensure(), id));
  },

  runEvents: async (id: string): Promise<RunEvent[]> => {
    await latency();
    checkUuid(id);
    return clone(ensure().events[id] ?? []);
  },

  startRun: async (body: { agent: string; input: string; metadata?: Record<string, string> }): Promise<Run> => {
    await latency();
    const errors: string[] = [];
    if (typeof body.agent !== 'string' || !AGENT_NAME.test(body.agent)) errors.push('agent must be a registry name such as "researcher"');
    if (typeof body.input !== 'string' || body.input.length < 1 || body.input.length > 20_000) {
      errors.push('input must be longer than or equal to 1 and shorter than or equal to 20000 characters');
    }
    if (errors.length) throw new ApiError(errors.join(', '), 400);

    const s = ensure();
    const now = Date.now();
    const run = newRun(uuid(), body.agent, body.input, body.metadata ?? null, now);
    s.runs.push(run);
    s.events[run.id] = [];
    s.pending[run.id] = startPlan(run, now);
    if (s.pending[run.id]!.length === 0) {
      // Unknown agent: the runtime rejects StartRun before emitting anything, and the gateway
      // marks the run FAILED with the gRPC error message.
      const known = DEMO_AGENTS.map((a) => `'${a.name}'`).sort().join(', ');
      setTimeout(() => {
        update(run.id, { status: 'FAILED', error: `5 NOT_FOUND: unknown agent '${body.agent}'; known: [${known}]` });
        save();
      }, 300);
    }
    save();
    schedule();
    return clone(run);
  },

  approve: async (id: string, body: { approved: boolean; feedback?: string }): Promise<Run> => {
    await latency();
    const s = ensure();
    const run = requireRun(s, id);
    if (run.status !== 'WAITING_APPROVAL') throw new ApiError(`run ${id} is ${run.status}, not WAITING_APPROVAL`, 409);
    if (typeof body.approved !== 'boolean') throw new ApiError('approved must be a boolean value', 400);
    update(id, { status: 'RUNNING', interrupt: null });
    s.pending[id] = resumePlan(run, s.events[id] ?? [], { approved: body.approved, feedback: body.feedback ?? '' }, Date.now());
    save();
    schedule();
    return clone(run);
  },
};

/** Subscribe to every RunEvent the simulation emits. Used by the demo socket. */
export function onDemoEvent(fn: Listener): () => void {
  ensure();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------------------- plans

function startPlan(run: Run, now: number): Pending[] {
  const plan = new Planner(now);
  let nodes: NodeResult[];
  let output: Record<string, unknown> | null = null;
  if (run.agent === 'researcher') ({ nodes, output } = researcherNodes(run.input));
  else if (run.agent === 'writer') ({ nodes, output } = writerNodes(run.input));
  else if (run.agent === 'reviewer') nodes = [];
  else return [];

  plan.add(350, 'RUN_STARTED', '', { input: preview(run.input) });
  if (run.agent === 'reviewer') {
    const { node, review } = reviewerReview(run.input);
    plan.node(node);
    plan.add(140, 'NODE_STARTED', 'human_approval', {});
    // human_approval calls interrupt(): the node starts but never finishes until ResumeRun.
    plan.add(40, 'INTERRUPT', 'human_approval', {
      question: 'The reviewer recommends a verdict. Approve to publish, reject to send back.',
      review,
      submission_preview: run.input.slice(0, 400),
    });
    return plan.events;
  }
  for (const n of nodes) plan.node(n);
  plan.add(90, 'DONE', '', { output, status: 'COMPLETED' });
  return plan.events;
}

function resumePlan(run: Run, history: RunEvent[], decision: { approved: boolean; feedback: string }, now: number): Pending[] {
  const plan = new Planner(now);
  const interrupt = [...history].reverse().find((e) => e.type === 'INTERRUPT');
  const review = (interrupt?.payload.review as Record<string, unknown> | undefined) ?? {};
  const output = {
    status: decision.approved ? 'approved' : 'rejected',
    review,
    feedback: decision.feedback,
    approved_by: 'dashboard',
  };
  plan.add(300, 'RESUMED', '', { ...decision });
  // LangGraph replays human_approval from the checkpoint; this time interrupt() returns the decision.
  plan.node({ node: 'human_approval', update: { approval: { ...decision } }, usage: null, durationMs: 3 });
  plan.node({ node: 'finalize', update: { output }, usage: null, durationMs: 1 });
  plan.add(80, 'DONE', '', { output, status: decision.approved ? 'COMPLETED' : 'REJECTED' });
  return plan.events;
}

/** Builds a timed event list, the way the runtime's @traced decorator emits node events. */
class Planner {
  readonly events: Pending[] = [];
  constructor(private t: number) {}

  add(afterMs: number, type: RunEventType, node: string, payload: Record<string, unknown>, usage: TokenUsage | null = null) {
    this.t += afterMs;
    this.events.push({ at: this.t, type, node, payload, usage });
  }

  node(n: NodeResult) {
    this.add(120, 'NODE_STARTED', n.node, {});
    const ms = n.durationMs + Math.random();
    this.add(Math.round(n.durationMs), 'NODE_FINISHED', n.node, { duration_ms: Number(ms.toFixed(1)), summary: summarizeUpdate(n.update) });
    if (n.usage) this.add(15, 'TOKEN_USAGE', n.node, {}, n.usage);
  }
}

// ---------------------------------------------------------------------------- event application

function emit(s: State, runId: string, p: Pending, at: number): RunEvent | null {
  const run = s.runs.find((r) => r.id === runId);
  if (!run) return null;
  const log = (s.events[runId] ??= []);
  const usage = p.type === 'DONE' ? cumulativeUsage(log) : p.usage;
  const event: RunEvent = {
    runId,
    agent: run.agent,
    type: p.type,
    node: p.node,
    seq: (log[log.length - 1]?.seq ?? 0) + 1,
    timestamp: new Date(at).toISOString(),
    payload: p.payload,
    usage,
    metadata: run.metadata ?? {},
  };
  log.push(event);
  applyStatus(run, event, at);
  return event;
}

/** Mirror of RunsService.applyStatus in the gateway. */
function applyStatus(run: Run, ev: RunEvent, at: number) {
  const touch = () => (run.updatedAt = new Date(at).toISOString());
  switch (ev.type) {
    case 'RUN_STARTED':
    case 'RESUMED':
      run.status = 'RUNNING';
      return touch();
    case 'INTERRUPT':
      run.status = 'WAITING_APPROVAL';
      run.interrupt = ev.payload;
      return touch();
    case 'DONE': {
      const output = (ev.payload.output as Record<string, unknown> | undefined) ?? {};
      run.status = ev.payload.status === 'REJECTED' || output.status === 'rejected' ? 'REJECTED' : 'COMPLETED';
      run.output = output;
      run.usage = ev.usage;
      run.interrupt = null;
      return touch();
    }
    case 'FAILED':
      run.status = 'FAILED';
      run.error = String(ev.payload.error ?? 'unknown error');
      return touch();
  }
}

function cumulativeUsage(events: RunEvent[]): TokenUsage {
  const total: TokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  for (const e of events) {
    if (e.type !== 'TOKEN_USAGE' || !e.usage) continue;
    total.prompt_tokens += e.usage.prompt_tokens;
    total.completion_tokens += e.usage.completion_tokens;
    total.total_tokens += e.usage.total_tokens;
  }
  return total;
}

/** Emit everything that is due, then sleep until the next pending event. */
function pump() {
  timer = null;
  const s = ensure();
  const now = Date.now();
  const due: { runId: string; p: Pending }[] = [];
  for (const [runId, list] of Object.entries(s.pending)) {
    while (list.length && list[0]!.at <= now) due.push({ runId, p: list.shift()! });
    if (!list.length) delete s.pending[runId];
  }
  if (due.length) {
    due.sort((a, b) => a.p.at - b.p.at);
    const emitted = due.map(({ runId, p }) => emit(s, runId, p, p.at)).filter((e): e is RunEvent => e !== null);
    save();
    for (const ev of emitted) for (const fn of listeners) fn(clone(ev));
  }
  schedule();
}

function schedule() {
  if (!isBrowser || timer) return;
  const next = Math.min(...Object.values(ensure().pending).map((l) => l[0]?.at ?? Infinity));
  if (next === Infinity) return;
  timer = setTimeout(pump, Math.max(0, next - Date.now()));
}

// ---------------------------------------------------------------------------- state

function ensure(): State {
  if (state) return state;
  state = (isBrowser && load()) || seed(Date.now());
  if (isBrowser) {
    save();
    schedule();
  }
  return state;
}

function load(): State | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as State;
    return parsed && parsed.v === 1 && Array.isArray(parsed.runs) ? parsed : null;
  } catch {
    return null;
  }
}

function save() {
  if (!isBrowser || !state) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage blocked or full: the demo keeps working in memory for this page view
  }
}

/** A small history so the first visit is not empty: three finished runs and one waiting on you. */
function seed(now: number): State {
  const s: State = { v: 1, runs: [], events: {}, pending: {} };
  const MIN = 60_000;
  const replay = (id: string, agent: string, input: string, startedAgo: number, decision?: { approved: boolean; feedback: string; after: number }) => {
    const t0 = now - startedAgo;
    const run = newRun(id, agent, input, { source: 'seed' }, t0);
    s.runs.push(run);
    s.events[id] = [];
    for (const p of startPlan(run, t0)) emit(s, id, p, p.at);
    if (decision) {
      run.status = 'RUNNING';
      run.interrupt = null;
      for (const p of resumePlan(run, s.events[id] ?? [], decision, t0 + decision.after)) emit(s, id, p, p.at);
    }
  };
  replay('3f6b1c52-8e2a-4d71-9b0c-5a7e2f4d8c13', 'researcher', SEED_INPUTS.researcher, 128 * MIN);
  replay('a2d94e07-6c1b-4f38-8e55-0b9c3d7a1f62', 'writer', SEED_INPUTS.writer, 74 * MIN);
  replay('c81e5f3a-0d47-4b9e-a6c2-7f1d8e3b9a40', 'reviewer', SEED_INPUTS.reviewerApproved, 41 * MIN, {
    approved: true,
    feedback: 'Numbers checked against the load test. Ship it.',
    after: 3 * MIN,
  });
  replay('5be7a9d1-2f83-4c06-b1e4-9d0a6c5f7e28', 'reviewer', SEED_INPUTS.reviewerWaiting, 6 * MIN);
  return s;
}

function newRun(id: string, agent: string, input: string, metadata: Record<string, string> | null, at: number): Run {
  const iso = new Date(at).toISOString();
  return { id, agent, input, status: 'QUEUED', metadata, output: null, interrupt: null, usage: null, error: null, createdAt: iso, updatedAt: iso };
}

function update(id: string, patch: Partial<Run> & { status?: RunStatus }) {
  const run = ensure().runs.find((r) => r.id === id);
  if (run) Object.assign(run, patch, { updatedAt: new Date().toISOString() });
}

function requireRun(s: State, id: string): Run {
  checkUuid(id);
  const run = s.runs.find((r) => r.id === id);
  if (!run) throw new ApiError(`run ${id} not found`, 404);
  return run;
}

function checkUuid(id: string) {
  if (!UUID.test(id)) throw new ApiError('Validation failed (uuid is expected)', 400);
}

// ---------------------------------------------------------------------------- utils

function preview(text: string): string {
  return text.length <= 200 ? text : text.slice(0, 197) + '...';
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** A short, jittery delay so the UI behaves like it is talking to a server. */
function latency(): Promise<void> {
  return isBrowser ? new Promise((r) => setTimeout(r, 60 + Math.random() * 120)) : Promise.resolve();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
