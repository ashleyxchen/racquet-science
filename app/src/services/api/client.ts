/**
 * API Client
 *
 * Base HTTP client for communicating with the backend API.
 * Handles request/response formatting, error handling, and configuration.
 */

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
}

export interface ApiError {
  status: number;
  message: string;
  detail?: string;
}

export class ApiClientError extends Error {
  status: number;
  detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = detail;
  }
}

// Default configuration - can be overridden via environment or settings
// IMPORTANT: Change this to your Mac's IP address when testing on iOS device
// Find your IP with: ipconfig getifaddr en0
const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: 'http://192.168.2.136:8000', // Home
  // baseUrl: 'http://192.168.0.109:8000', // Shirley's
  timeout: 30000,
};

let currentConfig: ApiConfig = { ...DEFAULT_CONFIG };

/**
 * Configure the API client
 */
export function configureApi(config: Partial<ApiConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Get current API configuration
 */
export function getApiConfig(): ApiConfig {
  return { ...currentConfig };
}

/**
 * Build full URL from endpoint path
 */
function buildUrl(endpoint: string): string {
  const base = currentConfig.baseUrl.replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

/**
 * Handle API response and extract JSON or throw error
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail: string | undefined;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail || errorBody.message || JSON.stringify(errorBody);
    } catch {
      detail = await response.text();
    }
    throw new ApiClientError(
      response.status,
      `API Error: ${response.statusText}`,
      detail
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

/**
 * Make a GET request
 */
export async function get<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
  let url = buildUrl(endpoint);

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  return handleResponse<T>(response);
}

/**
 * Make a POST request with JSON body
 */
export async function post<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(buildUrl(endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return handleResponse<T>(response);
}

/**
 * Make a PATCH request with JSON body
 */
export async function patch<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(buildUrl(endpoint), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

/**
 * Make a DELETE request
 */
export async function del<T>(endpoint: string): Promise<T> {
  const response = await fetch(buildUrl(endpoint), {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });

  return handleResponse<T>(response);
}

/**
 * Upload a file using multipart/form-data
 */
export async function uploadFile<T>(
  endpoint: string,
  file: Blob,
  fieldName: string = 'file',
  additionalFields?: Record<string, string>
): Promise<T> {
  const formData = new FormData();
  formData.append(fieldName, file);

  if (additionalFields) {
    Object.entries(additionalFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  const response = await fetch(buildUrl(endpoint), {
    method: 'POST',
    // Don't set Content-Type header - browser will set it with boundary
    headers: {
      'Accept': 'application/json',
    },
    body: formData,
  });

  return handleResponse<T>(response);
}

/**
 * Check if the API is reachable
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(buildUrl('/health'), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}
