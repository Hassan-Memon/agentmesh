// A stand-in for the Socket.IO client on the gateway's "/runs" namespace. It speaks the same
// protocol the components use: `join` / `leave` a run room, receive "run.event" for joined
// runs and "run.activity" for every event on every run.
import type { RunEvent } from '../types';
import { onDemoEvent } from './engine';

type Handler = (...args: never[]) => void;

export class DemoRunsSocket {
  /** There is no network, so the "connection" is up as soon as the socket exists. */
  readonly connected = true;
  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly rooms = new Set<string>();

  constructor() {
    onDemoEvent((ev: RunEvent) => {
      if (this.rooms.has(ev.runId)) this.fire('run.event', ev);
      this.fire('run.activity', { runId: ev.runId, agent: ev.agent, type: ev.type, seq: ev.seq, timestamp: ev.timestamp });
    });
  }

  on(event: string, fn: Handler): this {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return this;
  }

  off(event: string, fn?: Handler): this {
    if (fn) this.handlers.get(event)?.delete(fn);
    else this.handlers.delete(event);
    return this;
  }

  emit(event: string, runId?: unknown): this {
    if (typeof runId === 'string' && runId) {
      if (event === 'join') this.rooms.add(runId);
      if (event === 'leave') this.rooms.delete(runId);
    }
    return this;
  }

  private fire(event: string, arg: unknown) {
    for (const fn of this.handlers.get(event) ?? []) (fn as (a: unknown) => void)(arg);
  }
}
