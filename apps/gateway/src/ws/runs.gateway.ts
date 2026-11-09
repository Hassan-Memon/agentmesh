// Socket.IO gateway on the "/runs" namespace. Clients `join` a run id and receive every
// RunEvent for it as "run.event". A lighter "run.activity" broadcast feeds the runs list.
// See docs/learn/03-concepts/websockets-vs-sse-vs-webrtc.md for why WebSockets here.
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RunEventDto } from '../events/run-event';

export const RUN_EVENT = 'run.event';
export const RUN_ACTIVITY = 'run.activity';

@WebSocketGateway({
  namespace: 'runs',
  // Origin is enforced at the HTTP layer by main.ts; Socket.IO needs its own CORS setting.
  cors: { origin: (process.env['CORS_ORIGIN'] ?? 'http://localhost:3000').split(','), credentials: true },
})
export class RunsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RunsGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    this.logger.debug(`ws connected ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`ws disconnected ${client.id}`);
  }

  @SubscribeMessage('join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() runId: string): Promise<{ ok: boolean }> {
    if (typeof runId !== 'string' || !runId) return { ok: false };
    await client.join(room(runId));
    return { ok: true };
  }

  @SubscribeMessage('leave')
  async leave(@ConnectedSocket() client: Socket, @MessageBody() runId: string): Promise<{ ok: boolean }> {
    if (typeof runId === 'string' && runId) await client.leave(room(runId));
    return { ok: true };
  }

  emitRunEvent(event: RunEventDto): void {
    if (!this.server) return; // not initialised (unit tests)
    this.server.to(room(event.runId)).emit(RUN_EVENT, event);
    this.server.emit(RUN_ACTIVITY, {
      runId: event.runId,
      agent: event.agent,
      type: event.type,
      seq: event.seq,
      timestamp: event.timestamp,
    });
  }
}

function room(runId: string): string {
  return `run:${runId}`;
}
