// Database helper functions for sales
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Create a new sale with items and payments
export async function createSale(businessId: string, saleData: {
  customer_id?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  payment_status: 'paid' | 'partial' | 'pending';
  notes?: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    unit_cost: number;
    discount_amount: number;
    tax_amount: number;
    total: number;
  }>;
  payments: Array<{
    method: string;
    amount: number;
    reference?: string;
  }>;
}) {
  // Start a transaction by creating the sale first
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      business_id: businessId,
      customer_id: saleData.customer_id || null,
      subtotal: saleData.subtotal,
      discount_amount: saleData.discount_amount,
      tax_amount: saleData.tax_amount,
      total: saleData.total,
      payment_status: saleData.payment_status,
      notes: saleData.notes || null,
    })
    .select()
    .single();

  if (saleError) throw saleError;

  // Insert sale items
  const itemsToInsert = saleData.items.map(item => ({
    sale_id: sale.id,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    unit_cost: item.unit_cost,
    discount_amount: item.discount_amount,
    tax_amount: item.tax_amount,
    total: item.total,
  }));

  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(itemsToInsert);

  if (itemsError) throw itemsError;

  // Insert payments if any
  if (saleData.payments && saleData.payments.length > 0) {
    const paymentsToInsert = saleData.payments.map(payment => ({
      sale_id: sale.id,
      method: payment.method,
      amount: payment.amount,
      reference: payment.reference || null,
    }));

    const { error: paymentsError } = await supabase
      .from('sale_payments')
      .insert(paymentsToInsert);

    if (paymentsError) throw paymentsError;
  }

  // Update product stock for each item
  for (const item of saleData.items) {
    const { error: stockError } = await supabase.rpc('update_product_stock', {
      p_product_id: item.product_id,
      p_quantity: -item.quantity,
    });

    // If the RPC doesn't exist, update manually
    if (stockError && stockError.message.includes('does not exist')) {
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.product_id)
        .single();

      if (product) {
        await supabase
          .from('products')
          .update({ stock: Math.max(0, product.stock - item.quantity) })
          .eq('id', item.product_id);
      }
    }
  }

  // Return complete sale with items and payments
  return getSaleById(sale.id, businessId);
}

// Get all sales for a business
export async function getSales(businessId: string, filters?: {
  startDate?: string;
  endDate?: string;
  payment_status?: string;
}) {
  let query = supabase
    .from('sales')
    .select(`
      *,
      customer:customers(id, name, phone, email),
      items:sale_items(*),
      payments:sale_payments(*)
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }
  if (filters?.payment_status) {
    query = query.eq('payment_status', filters.payment_status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

// Get a single sale by ID
export async function getSaleById(saleId: string, businessId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      customer:customers(id, name, phone, email),
      items:sale_items(*),
      payments:sale_payments(*)
    `)
    .eq('id', saleId)
    .eq('business_id', businessId)
    .single();

  if (error) throw error;
  return data;
}

// Update sale payment status
export async function updateSalePaymentStatus(saleId: string, businessId: string, payment_status: 'paid' | 'partial' | 'pending') {
  const { data, error } = await supabase
    .from('sales')
    .update({ payment_status })
    .eq('id', saleId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Add payment to existing sale
export async function addSalePayment(saleId: string, businessId: string, payment: {
  method: string;
  amount: number;
  reference?: string;
}) {
  // Verify sale belongs to business
  const sale = await getSaleById(saleId, businessId);
  
  // Insert payment
  const { data, error } = await supabase
    .from('sale_payments')
    .insert({
      sale_id: saleId,
      method: payment.method,
      amount: payment.amount,
      reference: payment.reference || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Recalculate payment status
  const { data: payments } = await supabase
    .from('sale_payments')
    .select('amount')
    .eq('sale_id', saleId);

  const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  
  let newStatus: 'paid' | 'partial' | 'pending' = 'pending';
  if (totalPaid >= sale.total) {
    newStatus = 'paid';
  } else if (totalPaid > 0) {
    newStatus = 'partial';
  }

  await updateSalePaymentStatus(saleId, businessId, newStatus);

  return data;
}
