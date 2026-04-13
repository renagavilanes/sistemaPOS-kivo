// Database helper functions for business_settings (key/value JSON)
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

export type OutOfStockMode = "show" | "hide" | "mark_unavailable";

export type VirtualCatalogConfig = {
  enabled?: boolean;
  slug?: string;
  outOfStockMode?: OutOfStockMode;
  delivery?: {
    pickup?: boolean;
    homeDelivery?: boolean;
    homeDeliveryFee?: number;
  };
};

/** Misma lógica que el admin (normalizeCatalogSlug) para que la URL coincida con lo guardado. */
export function normalizeVirtualCatalogSlug(raw: string): string {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s;
}

export async function findBusinessIdByVirtualCatalogSlug(slugRaw: string): Promise<string | null> {
  const slug = normalizeVirtualCatalogSlug(slugRaw);
  if (!slug) return null;

  const { data, error } = await supabase
    .from("business_settings")
    .select("business_id, value")
    .eq("key", "virtual_catalog");

  if (error) throw error;

  for (const row of data || []) {
    const v = (row as any)?.value as VirtualCatalogConfig | null | undefined;
    const s = normalizeVirtualCatalogSlug(String(v?.slug || ""));
    if (s && s === slug) return String((row as any).business_id);
  }

  return null;
}

export async function getVirtualCatalogRowByBusinessId(businessId: string): Promise<{
  id?: string;
  value: VirtualCatalogConfig | null;
} | null> {
  const { data, error } = await supabase
    .from("business_settings")
    .select("id, value")
    .eq("business_id", businessId)
    .eq("key", "virtual_catalog")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { id: (data as any).id, value: ((data as any).value ?? null) as VirtualCatalogConfig | null };
}
