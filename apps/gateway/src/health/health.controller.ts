import { Controller, Get } from '@nestjs/common';
import { BusState } from '../bus/bus-state';
import { EventLogService } from '../events/event-log.service';
import { AgentGrpcClient } from '../grpc/agent-grpc.client';

@Controller('health')
export class HealthController {
  constructor(
    private readonly grpc: AgentGrpcClient,
    private readonly bus: BusState,
    private readonly events: EventLogService,
  ) {}

  /** GET /health : liveness plus a cheap view of the dependencies. */
  @Get()
  async health(): Promise<Record<string, unknown>> {
    return {
      status: 'ok',
      runtimeReachable: await this.grpc.isReady(),
      busRelay: this.bus.relayEnabled,
      eventLog: this.events.backend,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
