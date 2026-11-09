import { Module } from '@nestjs/common';
import { BusModule } from '../bus/bus.module';
import { EventLogModule } from '../events/event-log.module';
import { GrpcModule } from '../grpc/grpc.module';
import { WsModule } from '../ws/ws.module';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [GrpcModule, EventLogModule, WsModule, BusModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
