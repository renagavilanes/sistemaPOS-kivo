/** Costo unitario de una línea de venta: el guardado en el ítem, o el del catálogo. Nunca un % inventado. */
export function saleItemUnitCost(
  item: {
    freeSale?: boolean;
    productId?: string | null;
    product_id?: string | null;
    name?: string;
    cost?: number | string | null;
    unit_cost?: number | string | null;
    unitCost?: number | string | null;
  },
  catalogProduct?: { cost?: number | string | null } | null,
): number {
  if (item?.freeSale === true) return 0;
  const pid = item?.productId ?? item?.product_id;
  if ((pid == null || pid === '') && String(item?.name || '').trim() === 'Venta libre') return 0;

  const stored = item?.cost ?? item?.unit_cost ?? item?.unitCost;
  if (stored != null && stored !== '') {
    const n = Number(stored);
    if (Number.isFinite(n)) return n;
  }

  if (catalogProduct?.cost != null && catalogProduct.cost !== '') {
    const n = Number(catalogProduct.cost);
    if (Number.isFinite(n)) return n;
  }

  return 0;
}

export function saleItemsTotalCost(
  items: Array<any> | null | undefined,
  productById?: Map<string, { cost?: number | string | null }>,
): number {
  return (items || []).reduce((sum, item) => {
    const qty = Number(item?.quantity) || 0;
    const pid = item?.productId ?? item?.product_id;
    const catalog = pid && productById ? productById.get(String(pid)) : undefined;
    return sum + saleItemUnitCost(item, catalog) * qty;
  }, 0);
}

export function saleProfit(total: number, items: Array<any> | null | undefined, productById?: Map<string, { cost?: number | string | null }>): number {
  return (Number(total) || 0) - saleItemsTotalCost(items, productById);
}
