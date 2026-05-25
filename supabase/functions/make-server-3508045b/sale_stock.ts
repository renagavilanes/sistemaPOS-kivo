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
  const qtyByProduct = new Map<string, number>();
  for (const item of items) {
    const productId = item.productId || item.product_id;
    if (!productId) continue;
    const qty = Number(item.quantity) || 1;
    qtyByProduct.set(productId, (qtyByProduct.get(productId) ?? 0) + qty);
  }

  const productIds = [...qtyByProduct.keys()];
  if (productIds.length === 0) return {};

  const { data: prods, error: prodsErr } = await supabase
    .from("products")
    .select("id, stock")
    .eq("business_id", businessId)
    .in("id", productIds);

  if (prodsErr) return { error: prodsErr.message };

  await Promise.all(
    (prods ?? []).map(async (prod: { id: string; stock: number }) => {
      const qty = qtyByProduct.get(prod.id) ?? 0;
      if (qty <= 0) return;
      const newStock = prod.stock + qty;
      const { error: updErr } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", prod.id)
        .eq("business_id", businessId);
      if (updErr) throw new Error(updErr.message);
      console.log(`📦 Stock restored: product ${prod.id} → ${newStock} (+${qty})`);
    }),
  );

  return {};
}
