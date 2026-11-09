import { Module } from '@nestjs/common';
import { RunsGateway } from './runs.gateway';

@Module({
  providers: [RunsGateway],
  exports: [RunsGateway],
})
export class WsModule {}
