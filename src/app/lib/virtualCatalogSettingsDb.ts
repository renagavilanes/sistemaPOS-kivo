import { supabase } from './supabase';
import type { OutOfStockMode, VirtualCatalogConfig } from './virtualCatalogTypes';

export const VIRTUAL_CATALOG_SETTINGS_KEY = 'virtual_catalog';

export function defaultVirtualCatalogConfig(partial?: Partial<VirtualCatalogConfig>): VirtualCatalogConfig {
  return {
    enabled: true,
    slug: '',
    outOfStockMode: 'mark_unavailable',
    delivery: {
      pickup: true,
      homeDelivery: true,
      homeDeliveryFee: 0,
    },
    ...(partial || {}),
  };
}

export function normalizeCatalogSlug(raw: string): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s;
}

export function suggestSlugFromBusinessName(name: string): string {
  return normalizeCatalogSlug(name || 'negocio');
}

export async function getVirtualCatalogSettingsRow(businessId: string): Promise<{
  id?: string;
  value: VirtualCatalogConfig | null;
}> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('id, value')
    .eq('business_id', businessId)
    .eq('key', VIRTUAL_CATALOG_SETTINGS_KEY)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { id: (data as any)?.id, value: ((data as any)?.value ?? null) as VirtualCatalogConfig | null };
}

export async function upsertVirtualCatalogSettings(businessId: string, value: VirtualCatalogConfig): Promise<void> {
  const payload = {
    business_id: businessId,
    key: VIRTUAL_CATALOG_SETTINGS_KEY,
    value,
    category: 'virtual_catalog',
    description: 'Configuración del Catálogo Virtual',
  };

  const { error } = await supabase.from('business_settings').upsert(payload, {
    onConflict: 'business_id,key',
  });

  if (error) throw new Error(error.message);
}

export async function isCatalogSlugTaken(params: {
  slug: string;
  excludeBusinessId?: string;
}): Promise<boolean> {
  const slug = normalizeCatalogSlug(params.slug);
  if (!slug) return false;

  const { data, error } = await supabase
    .from('business_settings')
    .select('business_id, value')
    .eq('key', VIRTUAL_CATALOG_SETTINGS_KEY);

  if (error) throw new Error(error.message);

  for (const row of data || []) {
    if (params.excludeBusinessId && String((row as any).business_id) === params.excludeBusinessId) continue;
    const v = (row as any)?.value as any;
    const other = normalizeCatalogSlug(String(v?.slug || ''));
    if (other && other === slug) return true;
  }

  return false;
}

export function coerceVirtualCatalogConfig(raw: any): VirtualCatalogConfig {
  const d = raw?.delivery || {};
  const out: OutOfStockMode =
    raw?.outOfStockMode === 'hide' || raw?.outOfStockMode === 'show' || raw?.outOfStockMode === 'mark_unavailable'
      ? raw.outOfStockMode
      : 'mark_unavailable';

  return defaultVirtualCatalogConfig({
    enabled: raw?.enabled !== false,
    slug: String(raw?.slug || ''),
    outOfStockMode: out,
    delivery: {
      pickup: d?.pickup !== false,
      homeDelivery: d?.homeDelivery === true,
      homeDeliveryFee: Number(d?.homeDeliveryFee || 0) || 0,
    },
  });
}
