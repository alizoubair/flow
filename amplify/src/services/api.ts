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

  // Get ID token from localStorage (Cognito issues ID tokens for API auth)
  const token = localStorage.getItem('flow-id-token') || localStorage.getItem('flow-access-token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add authorization header if token exists
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

    // Network error or other fetch errors
    throw new ApiError(
      'Network error. Please check your connection.',
      0
    );
  }
}

/**
 * API Service
 */
export const api = {
  /**
   * GET request
   */
  get: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'GET' }),

  /**
   * POST request
   */
  post: <T>(endpoint: string, body: any) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /**
   * PUT request
   */
  put: <T>(endpoint: string, body: any) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};
