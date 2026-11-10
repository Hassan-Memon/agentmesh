// Shapes returned by the gateway REST API and pushed over the /runs WebSocket namespace.

export type RunStatus = 'QUEUED' | 'RUNNING' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'REJECTED';

export type RunEventType =
  | 'RUN_STARTED'
  | 'NODE_STARTED'
  | 'NODE_FINISHED'
  | 'TOKEN_USAGE'
  | 'INTERRUPT'
  | 'RESUMED'
  | 'DONE'
  | 'FAILED'
  | 'LOG';

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface Agent {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  requiresApproval: boolean;
}

export interface Run {
  id: string;
  agent: string;
  input: string;
  status: RunStatus;
  metadata: Record<string, string> | null;
  output: Record<string, unknown> | null;
  interrupt: Record<string, unknown> | null;
  usage: TokenUsage | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunEvent {
  runId: string;
  agent: string;
  type: RunEventType;
  node: string;
  seq: number;
  timestamp: string;
  payload: Record<string, unknown>;
  usage: TokenUsage | null;
  /** Echo of the run's metadata (the gateway always sends it; older events may omit it). */
  metadata?: Record<string, string>;
}
