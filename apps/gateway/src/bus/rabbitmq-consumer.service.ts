// Consumes RunEvents from the RabbitMQ topic exchange that the Python runtime publishes to,
// and relays them to WebSocket clients. See docs/adr/0002-rabbitmq-default-kafka-optional.md.
//
// Topology (must match packages/bus/agentmesh_bus/rabbitmq.py):
//   exchange agentmesh.events (topic, durable)
//   queue    exclusive, auto-delete, bound to "run.#"  -> every gateway replica sees every event
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { AppConfigService } from '../config/app-config.service';
import { fromBusMessage } from '../events/run-event';
import { RunsGateway } from '../ws/runs.gateway';
import { BusState } from './bus-state';

export const EXCHANGE = 'agentmesh.events';
const RECONNECT_MS = 5_000;

@Injectable()
export class RabbitMqConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConsumerService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private stopping = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly ws: RunsGateway,
    private readonly state: BusState,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.rabbitmqUrl) {
      this.logger.log('RABBITMQ_URL not set; WebSocket events come straight from the gRPC stream');
      return;
    }
    // Do not block startup on the broker; connect in the background with retries.
    void this.connect();
  }

  private async connect(): Promise<void> {
    if (this.stopping || !this.config.rabbitmqUrl) return;
    try {
      this.connection = await amqp.connect(this.config.rabbitmqUrl);
      this.connection.on('close', () => this.onLost('connection closed'));
      this.connection.on('error', (err: Error) => this.logger.warn(`amqp error: ${err.message}`));

      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      const { queue } = await this.channel.assertQueue('', { exclusive: true, autoDelete: true });
      await this.channel.bindQueue(queue, EXCHANGE, 'run.#');
      await this.channel.prefetch(100); // back-pressure: at most 100 unacked messages in flight

      await this.channel.consume(queue, (msg) => {
        if (!msg) return;
        this.handle(msg.content);
        this.channel?.ack(msg);
      });

      this.state.relayEnabled = true;
      this.logger.log(`consuming ${EXCHANGE} run.# via queue ${queue}`);
    } catch (err) {
      this.logger.warn(`RabbitMQ connect failed (${(err as Error).message}); retrying in ${RECONNECT_MS}ms`);
      this.scheduleReconnect();
    }
  }

  private handle(content: Buffer): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content.toString('utf8'));
    } catch {
      this.logger.warn('dropping non-JSON bus message');
      return;
    }
    const event = fromBusMessage(parsed);
    if (!event) {
      this.logger.warn('dropping malformed RunEvent from bus');
      return;
    }
    this.ws.emitRunEvent(event);
  }

  private onLost(reason: string): void {
    if (this.stopping) return;
    this.state.relayEnabled = false;
    this.channel = null;
    this.connection = null;
    this.logger.warn(`RabbitMQ ${reason}; reconnecting`);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.stopping) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RECONNECT_MS);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // already closed
    }
  }
}
