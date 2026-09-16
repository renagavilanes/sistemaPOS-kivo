/** Restaura inventario al eliminar una venta (inverso de db-create). */
export async function restoreProductStockOnSaleDelete(
  supabase: any,
  saleId: string,
  businessId: string,
): Promise<{ error?: string; notFound?: boolean }> {
  const { data: sale, error: fetchErr } = await supabase
    .from("sales")
    .select("items")
    .eq("id", saleId)
    .eq("business_id", businessId)
    .single();

  if (fetchErr) return { error: fetchErr.message };
  if (!sale) return { notFound: true };

  const items = Array.isArray(sale.items) ? sale.items : [];
  const result = await applySaleItemsStockDelta(supabase, businessId, items, []);
  if (result.error) return { error: result.error };
  return {};
}

function qtyByCatalogProduct(items: any[]): Map<string, number> {
  const qtyByProduct = new Map<string, number>();
  for (const item of items || []) {
    if (item?.freeSale === true) continue;
    const productId = item.productId || item.product_id;
    if (!productId) continue;
    const qty = Number(item.quantity) || 0;
    if (!qty) continue;
    qtyByProduct.set(productId, (qtyByProduct.get(productId) ?? 0) + qty);
  }
  return qtyByProduct;
}

/** Ajusta stock por la diferencia entre ítems viejos y nuevos de una venta. */
export async function applySaleItemsStockDelta(
  supabase: any,
  businessId: string,
  oldItems: any[],
  newItems: any[],
): Promise<{ error?: string }> {
  const oldMap = qtyByCatalogProduct(oldItems);
  const newMap = qtyByCatalogProduct(newItems);
  const ids = [...new Set([...oldMap.keys(), ...newMap.keys()])];
  if (ids.length === 0) return {};

  const { data: prods, error: prodsErr } = await supabase
    .from("products")
    .select("id, stock")
    .eq("business_id", businessId)
    .in("id", ids);

  if (prodsErr) return { error: prodsErr.message };

  try {
    await Promise.all(
      (prods ?? []).map(async (prod: { id: string; stock: number }) => {
        const oldQty = oldMap.get(prod.id) ?? 0;
        const newQty = newMap.get(prod.id) ?? 0;
        const delta = oldQty - newQty;
        if (delta === 0) return;
        const current = Number(prod.stock || 0);
        const newStock = delta < 0 ? Math.max(0, current + delta) : current + delta;
        const { error: updErr } = await supabase
          .from("products")
          .update({ stock: newStock })
          .eq("id", prod.id)
          .eq("business_id", businessId);
        if (updErr) throw new Error(updErr.message);
        console.log(`📦 Stock delta: product ${prod.id} ${current} → ${newStock} (Δ ${delta})`);
      }),
    );
  } catch (e: any) {
    return { error: e?.message || "Error updating stock" };
  }

  return {};
}
