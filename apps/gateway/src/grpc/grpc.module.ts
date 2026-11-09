import { Module } from '@nestjs/common';
import { AgentGrpcClient } from './agent-grpc.client';

@Module({
  providers: [AgentGrpcClient],
  exports: [AgentGrpcClient],
})
export class GrpcModule {}
