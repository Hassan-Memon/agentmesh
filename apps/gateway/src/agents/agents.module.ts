import { Module } from '@nestjs/common';
import { GrpcModule } from '../grpc/grpc.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [GrpcModule],
  controllers: [AgentsController],
  providers: [AgentsService],
})
export class AgentsModule {}
