import { Node, Edge } from 'reactflow';

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
