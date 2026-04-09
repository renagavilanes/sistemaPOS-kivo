import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseProjectId, supabaseUrl } from '../../utils/supabase/publicEnv';

// Singleton pattern para evitar múltiples instancias
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    console.log('🔵 Creando nueva instancia de Supabase Client');
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'sb-' + supabaseProjectId + '-auth-token',
      },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();

// API base URL para llamadas al servidor
export const API_BASE_URL = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b`;

// Helper para obtener el token de autenticación
export async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  console.log('🔑 Getting auth token, session exists:', !!session);
  
  if (session) {
    // Verificar si el token está por expirar (en los próximos 60 segundos)
    const expiresAt = session.expires_at! * 1000; // Convertir a milisegundos
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    
    console.log('🔑 Token expires at:', new Date(expiresAt).toISOString());
    console.log('🔑 Time until expiry (seconds):', Math.floor(timeUntilExpiry / 1000));
    
    // Si el token expira en menos de 60 segundos, refrescarlo
    if (timeUntilExpiry < 60000) {
      console.log('🔄 Token about to expire, refreshing...');
      const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Error refreshing session:', error);
        return session.access_token;
      }
      
      if (newSession) {
        console.log('✅ Token refreshed successfully');
        return newSession.access_token;
      }
    }
    
    console.log('🔑 Token preview:', session.access_token.substring(0, 20) + '...');
    return session.access_token;
  } else {
    console.warn('⚠️ No session found when getting auth token');
  }
  
  return null;
}

// Helper para hacer llamadas autenticadas al servidor
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  
  console.log('🌐 API Call:', endpoint);
  console.log('🔑 Token disponible:', !!token);
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  console.log('📡 Response status:', response.status);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('❌ API Error:', error);
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}