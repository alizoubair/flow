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

export interface CiRunMessage {
  type: 'stage_start' | 'step_output' | 'stage_complete' | 'pipeline_complete' | 'pipeline_failed' | 'error';
  run_id: string;
  stage?: string;
  step?: string;
  output?: string;
  exit_code?: number;
  message?: string;
}
