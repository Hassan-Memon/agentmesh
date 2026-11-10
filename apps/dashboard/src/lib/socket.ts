'use client';

// One Socket.IO connection to the gateway's "/runs" namespace, shared by every component on
// the page. See docs/learn/03-concepts/websockets-vs-sse-vs-webrtc.md.
import { io, type Socket } from 'socket.io-client';
import { GATEWAY_URL } from './api';

let socket: Socket | null = null;

export function getRunsSocket(): Socket {
  if (!socket) {
    socket = io(`${GATEWAY_URL}/runs`, {
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 5_000,
    });
  }
  return socket;
}
