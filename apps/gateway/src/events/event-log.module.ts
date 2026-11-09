import { Module } from '@nestjs/common';
import { EventLogService } from './event-log.service';

@Module({
  providers: [EventLogService],
  exports: [EventLogService],
})
export class EventLogModule {}
