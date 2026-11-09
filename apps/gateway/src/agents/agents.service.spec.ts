import { Test } from '@nestjs/testing';
import { AgentGrpcClient } from '../grpc/agent-grpc.client';
import { AgentsService } from './agents.service';

describe('AgentsService', () => {
  it('maps gRPC AgentInfo to camelCase DTOs', async () => {
    const grpc = {
      listAgents: jest.fn().mockResolvedValue([
        {
          name: 'reviewer',
          description: 'Reviews text',
          version: '0.1.0',
          capabilities: ['review', 'hitl'],
          requires_approval: true,
        },
      ]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [AgentsService, { provide: AgentGrpcClient, useValue: grpc }],
    }).compile();

    const result = await moduleRef.get(AgentsService).list();
    expect(result).toEqual([
      {
        name: 'reviewer',
        description: 'Reviews text',
        version: '0.1.0',
        capabilities: ['review', 'hitl'],
        requiresApproval: true,
      },
    ]);
  });
});
