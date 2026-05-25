import { apiService } from './api';
import { Pipeline, PipelineSummary, PipelinesResponse } from '../types/pipeline';

/** Pipeline API service */
export const pipelineService = {

  /** Fetch all pipelines for the current user */
  async list(): Promise<PipelineSummary[]> {
    const response = await apiService.get<PipelinesResponse>('/pipelines');
    return response.pipelines;
  },

  /** Fetch a single pipeline by ID */
  async get(id: string): Promise<Pipeline> {
    return apiService.get<Pipeline>(`/pipelines/${id}`);
  },

  /** Create a new pipeline */
  async create(pipeline: Omit<Pipeline, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<Pipeline> {
    return apiService.post<Pipeline>('/pipelines', pipeline);
  },

  /** Update an existing pipeline */
  async update(id: string, pipeline: Partial<Pipeline>): Promise<Pipeline> {
    return apiService.put<Pipeline>(`/pipelines/${id}`, pipeline);
  },

  /** Delete a pipeline */
  async remove(id: string): Promise<void> {
    return apiService.delete<void>(`/pipelines/${id}`);
  },
};
