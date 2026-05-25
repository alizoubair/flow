import { PipelineResponse } from '../types/pipeline';

/**
 * API Configuration
 * Update API_BASE_URL with your API Gateway endpoint after deployment
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com';

/**
 * API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Generic API request handler
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const token = localStorage.getItem('flow-id-token') || localStorage.getItem('flow-access-token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.error || 'Request failed',
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error. Please check your connection.', 0);
  }
}

/**
 * API Service
 *
 * Provides HTTP methods for interacting with the backend API.
 * All methods automatically include authentication tokens from localStorage
 * and handle error responses consistently.
 */
export const apiService = {
  /**
   * Perform a GET request to fetch data from the API
   * @param endpoint - API endpoint path (e.g., '/pipelines' or '/pipelines/123')
   * @returns Promise resolving to the typed response data
   */
  get: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'GET' }),

  /**
   * Perform a POST request to create new resources
   * @param endpoint - API endpoint path
   * @param body - Request payload to be JSON-stringified and sent
   * @returns Promise resolving to the typed response data
   */
  post: <T>(endpoint: string, body: any) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /**
   * Perform a PUT request to update existing resources
   * @param endpoint - API endpoint path (typically includes resource ID)
   * @param body - Request payload with updated data
   * @returns Promise resolving to the typed response data
   */
  put: <T>(endpoint: string, body: any) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  /**
   * Perform a DELETE request to remove resources
   * @param endpoint - API endpoint path (typically includes resource ID)
   * @returns Promise resolving to the typed response data (often void)
   */
  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};

/**
 * Pipeline-specific API calls
 */
export const pipelineApi = {
  /**
   * Create a new empty pipeline — calls create_pipeline Lambda
   */
  create(name: string = 'Untitled Pipeline'): Promise<PipelineResponse> {
    return apiService.post<PipelineResponse>('/pipelines', { name });
  },

  /**
   * Get an existing pipeline by ID — calls get_pipeline Lambda
   */
  get(id: string): Promise<PipelineResponse> {
    return apiService.get<PipelineResponse>(`/pipelines/${id}`);
  },

  /**
   * Update pipeline nodes, edges and name — calls update_pipeline Lambda
   */
  update(id: string, payload: { name: string; nodes: any[]; edges: any[] }): Promise<PipelineResponse> {
    return apiService.put<PipelineResponse>(`/pipelines/${id}`, payload);
  },

  /**
   * Delete a pipeline — calls delete_pipeline Lambda
   */
  delete(id: string): Promise<void> {
    return apiService.delete<void>(`/pipelines/${id}`);
  },
};
