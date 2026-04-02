export type AgentRunPhase =
  | 'preparing'
  | 'reasoning'
  | 'tool_running'
  | 'waiting_permission'
  | 'composing'
  | 'completed'
  | 'error';

export type AgentRunTrace = {
  rawTask: string;
  startedAt?: number;
  endedAt?: number;
  backend?: string;
  modelId?: string;
  sessionMode?: string;
  phase: AgentRunPhase;
  liveThoughtText: string;
  activeToolCount: number;
  errorMessage?: string;
};
