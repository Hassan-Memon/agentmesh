// The root module. In Nest, a module is a unit of the dependency-injection graph: it declares
// which providers (services) exist, which controllers handle HTTP routes, and which other
// modules it imports. See docs/learn/03-concepts/nestjs-modules-providers-di.md.
import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module';
import { BusModule } from './bus/bus.module';
import { AppConfigModule } from './config/app-config.module';
import { EventLogModule } from './events/event-log.module';
import { GrpcModule } from './grpc/grpc.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RunsModule } from './runs/runs.module';
import { WsModule } from './ws/ws.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    GrpcModule,
    EventLogModule,
    WsModule,
    BusModule,
    AgentsModule,
    RunsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
