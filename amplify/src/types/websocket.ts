export interface WebSocketMessage {
  action: string;
  [key: string]: any;
}

export interface AgentExecutionMessage {
  type: 'agent_start' | 'agent_progress' | 'agent_complete' | 'agent_error';
  agent?: string;
  status?: string;
  detail?: string;
  duration?: number;
  dsl?: string;
  error?: string;
}
