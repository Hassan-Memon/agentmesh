'use client';

// One Socket.IO connection to the gateway's "/runs" namespace, shared by every component on
// the page. See docs/learn/03-concepts/websockets-vs-sse-vs-webrtc.md.
// In demo mode (NEXT_PUBLIC_DEMO_MODE=1) an in-browser stand-in with the same events is used.
import { io } from 'socket.io-client';
import { GATEWAY_URL } from './api';
import { DEMO_MODE } from './demo/flag';
import { DemoRunsSocket } from './demo/socket';

/** The part of the Socket.IO client API the dashboard uses. */
export interface RunsSocket {
  readonly connected: boolean;
  on(event: string, fn: (...args: never[]) => void): unknown;
  off(event: string, fn?: (...args: never[]) => void): unknown;
  emit(event: string, ...args: unknown[]): unknown;
}

let socket: RunsSocket | null = null;

export function getRunsSocket(): RunsSocket {
  if (!socket) {
    socket = DEMO_MODE
      ? new DemoRunsSocket()
      : (io(`${GATEWAY_URL}/runs`, {
          transports: ['websocket', 'polling'],
          reconnectionDelayMax: 5_000,
        }) as unknown as RunsSocket);
  }
  return socket;
}
