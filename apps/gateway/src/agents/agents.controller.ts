import { Controller, Get } from '@nestjs/common';
import { AgentDto, AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  /** GET /agents : the runtime's registry, via gRPC ListAgents. */
  @Get()
  list(): Promise<AgentDto[]> {
    return this.agents.list();
  }
}
