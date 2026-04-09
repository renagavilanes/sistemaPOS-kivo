import { projectId as fallbackProjectId, publicAnonKey as fallbackAnonKey } from '/utils/supabase/info';

function readEnv(key: string): string | null {
  const v = (import.meta as any)?.env?.[key];
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

/**
 * Config pública de Supabase:
 * - En Vercel: define `VITE_SUPABASE_PROJECT_ID` y `VITE_SUPABASE_ANON_KEY`.
 * - Si no existen, usa el fallback autogenerado (para no romper nada hoy).
 */
export const supabaseProjectId = readEnv('VITE_SUPABASE_PROJECT_ID') ?? fallbackProjectId;
export const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY') ?? fallbackAnonKey;

export const supabaseUrl = `https://${supabaseProjectId}.supabase.co`;

