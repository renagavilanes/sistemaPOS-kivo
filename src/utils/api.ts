// API utility helpers with business context
import { supabaseAnonKey, supabaseProjectId } from './supabase/publicEnv';

const BASE_URL = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b`;

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  accessToken?: string;
  businessId?: string;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    accessToken = supabaseAnonKey,
    businessId,
  } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };

  // Add business ID header if provided
  if (businessId) {
    headers['X-Business-ID'] = businessId;
  }

  const requestOptions: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify(body);
  }

  const url = `${BASE_URL}${endpoint}`;
  
  const response = await fetch(url, requestOptions);

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: `HTTP Error ${response.status}`,
    }));
    throw new Error(error.error || error.message || 'API request failed');
  }

  return response.json();
}

// Convenience methods
export const api = {
  get: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = any>(endpoint: string, body: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  delete: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
