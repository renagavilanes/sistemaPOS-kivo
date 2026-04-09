// Database helper functions for customers
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Get all customers for a business
export async function getCustomers(businessId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get a single customer
export async function getCustomerById(customerId: string, businessId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .single();

  if (error) throw error;
  return data;
}

const CONTACT_TYPES = new Set(['customer', 'supplier', 'both']);

function normalizeContactType(v: unknown): 'customer' | 'supplier' | 'both' {
  const s = String(v ?? '').trim();
  if (CONTACT_TYPES.has(s)) return s as 'customer' | 'supplier' | 'both';
  return 'customer';
}

// Create a new customer
export async function createCustomer(businessId: string, customerData: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  contact_type?: string;
}) {
  const contact_type = normalizeContactType(customerData.contact_type);
  const { data, error } = await supabase
    .from('customers')
    .insert({
      business_id: businessId,
      name: customerData.name,
      email: customerData.email || null,
      phone: customerData.phone || null,
      address: customerData.address || null,
      tax_id: customerData.tax_id || null,
      contact_type,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update a customer
export async function updateCustomer(customerId: string, businessId: string, updates: {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  contact_type?: string;
}) {
  const patch: Record<string, unknown> = { ...updates };
  if (updates.contact_type !== undefined) {
    patch.contact_type = normalizeContactType(updates.contact_type);
  }
  const { data, error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', customerId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete (deactivate) a customer
export async function deactivateCustomer(customerId: string, businessId: string) {
  const { data, error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}