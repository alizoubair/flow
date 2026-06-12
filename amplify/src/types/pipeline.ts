import { Node, Edge } from 'reactflow';

/**
 * Agent-generated pipeline schema (before conversion to React Flow nodes/edges).
 */
export interface PipelineTaskDef {
  id: string;
  name: string;
  type: string;
  commands: string[];
  parallel?: boolean;
  config?: Record<string, unknown>;
}

export interface PipelineStageDef {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
  tasks: PipelineTaskDef[];
}

export interface PipelineEdgeDef {
  source: string;
  target: string;
}

export interface GeneratedPipeline {
  name: string;
  stages: PipelineStageDef[];
  edges: PipelineEdgeDef[];
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineSummary {
  id: string;
  name: string;
  description?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PipelinesResponse {
  pipelines: PipelineSummary[];
  count: number;
}

/**
 * Pipeline API response from Lambda functions
 */
export interface PipelineResponse {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  created_at: string;
  updated_at: string;
}
