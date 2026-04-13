import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';
import type { PublicCatalogResponse } from './virtualCatalogTypes';

function messageFromCatalogErrorBody(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    const direct = o.error ?? o.message ?? o.msg;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
  }
  if (status === 404) {
    return (
      'El catálogo no respondió (404). Suele pasar si la Edge Function en Supabase no está desplegada con la ruta pública ' +
      '«public/catalog», o si el slug no existe. Despliega `make-server-3508045b` con el código actual y vuelve a guardar el catálogo en el admin.'
    );
  }
  return `Error ${status}`;
}

export async function fetchPublicCatalogBySlug(slug: string): Promise<PublicCatalogResponse> {
  const s = String(slug || '').trim();
  if (!s) {
    throw new Error('Slug inválido');
  }

  const url = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/public/catalog/${encodeURIComponent(
    s,
  )}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });

  const rawText = await res.text();
  let body: unknown = {};
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch {
    body = {};
  }

  if (!res.ok) {
    throw new Error(messageFromCatalogErrorBody(body, res.status));
  }

  return body as PublicCatalogResponse;
}
