import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';
import type { PublicCatalogResponse } from './virtualCatalogTypes';

function expandKnownCatalogError(message: string): string {
  const m = message.trim();
  if (m === 'Catálogo no encontrado') {
    return [
      'Catálogo no encontrado.',
      '',
      'Qué revisar:',
      '• En el POS: Catálogo virtual → pulsa Guardar cambios al menos una vez (así se publica el enlace).',
      '• Si cambiaste de dispositivo o borraste datos, vuelve a guardar.',
      '• En Supabase, tabla business_settings, key «virtual_catalog»: debe existir la fila de tu negocio.',
    ].join('\n');
  }
  if (m === 'Catálogo desactivado') {
    return 'Catálogo desactivado. En Catálogo virtual activa el interruptor del catálogo público y guarda.';
  }
  if (m === 'Negocio no disponible') {
    return 'Negocio no disponible. Revisa que el negocio esté activo en tu base de datos (campo active en businesses).';
  }
  return m;
}

function messageFromCatalogErrorBody(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    const direct = o.error ?? o.message ?? o.msg;
    if (typeof direct === 'string' && direct.trim()) {
      return expandKnownCatalogError(direct.trim());
    }
  }
  if (status === 404) {
    return (
      'El catálogo no respondió (404). Suele pasar si la Edge Function no está desplegada con la ruta «public/catalog», ' +
      'o si el slug aún no está guardado en business_settings. Despliega la función y guarda de nuevo en Catálogo virtual.'
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
