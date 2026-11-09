import { Module } from '@nestjs/common';
import { WsModule } from '../ws/ws.module';
import { BusState } from './bus-state';
import { RabbitMqConsumerService } from './rabbitmq-consumer.service';

@Module({
  imports: [WsModule],
  providers: [BusState, RabbitMqConsumerService],
  exports: [BusState],
})
export class BusModule {}
