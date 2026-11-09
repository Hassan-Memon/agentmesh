import { Injectable } from '@nestjs/common';
import { AgentGrpcClient } from '../grpc/agent-grpc.client';

export interface AgentDto {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  requiresApproval: boolean;
}

@Injectable()
export class AgentsService {
  constructor(private readonly grpc: AgentGrpcClient) {}

  async list(): Promise<AgentDto[]> {
    const agents = await this.grpc.listAgents();
    return agents.map((a) => ({
      name: a.name,
      description: a.description,
      version: a.version,
      capabilities: a.capabilities ?? [],
      requiresApproval: Boolean(a.requires_approval),
    }));
  }
}
