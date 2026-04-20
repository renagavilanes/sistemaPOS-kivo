import { supabase } from '../lib/supabase';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';

// Helper to create Supabase client directly
function createClientDirect() {
  return supabase;
}

// Helper to get access token for Edge Function calls.
// IMPORTANT: Supabase Edge Function gateway only validates HS256 JWTs (anon/service keys).
// User session tokens use ES256 (asymmetric) and are rejected by the gateway with "Invalid JWT".
// Since we use X-Business-ID header for authorization context, we always use publicAnonKey here.
async function getAccessToken(): Promise<string> {
  return supabaseAnonKey;
}

function normalizeAuthErrorMessage(raw: string): string {
  const m = String(raw || '').trim();
  const low = m.toLowerCase();
  if (low.includes('jwt expired') || low === 'jwt expired') {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  }
  if (low.includes('invalid jwt')) {
    return 'Tu sesión no es válida. Vuelve a iniciar sesión.';
  }
  return m || 'Ocurrió un error.';
}

async function retryOnceOnJwtExpired<T>(run: () => Promise<{ data: T | null; error: any }>): Promise<{ data: T | null; error: any }> {
  const first = await run();
  const msg = first?.error?.message ?? first?.error?.error_description ?? '';
  const low = String(msg || '').toLowerCase();
  if (!first.error || !low.includes('jwt expired')) return first;

  // Intentar refrescar y repetir una vez.
  await supabase.auth.refreshSession().catch(() => null);
  return await run();
}

// ==================== TYPES ====================

export interface Product {
  id: string;
  businessId: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  image?: string;
  barcode?: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  businessId: string;
  name: string;
  color?: string;
  createdAt?: string;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  /** Cédula / documento (opcional, único por negocio si existe) */
  cedula?: string;
  /** Rol en contactos: ventas (customer), gastos (supplier) o ambos */
  type?: 'customer' | 'supplier' | 'both';
  creditLimit?: number;
  currentBalance?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sale {
  id: string;
  businessId: string;
  customerId?: string;
  saleNumber: string;
  total: number;
  subtotal: number;
  tax?: number;
  discount?: number;
  paymentMethod: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
  paidAmount: number;
  changeAmount?: number;
  items: SaleItem[];
  payments?: Payment[];
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface SaleItem {
  /** null = venta libre / sin producto de catálogo (sin movimiento de stock). */
  productId?: string | null;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  discount?: number;
  freeSale?: boolean;
}

export interface Payment {
  method: string;
  amount: number;
  reference?: string;
}

export interface Expense {
  id: string;
  businessId: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  /** Alineado con ventas: paid = pagada, pending = en deuda */
  paymentStatus?: 'paid' | 'pending' | 'partial' | string;
  receiptImage?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

// ==================== PRODUCTS ====================

const PRODUCT_LIST_SELECT =
  'id, business_id, name, price, cost, stock, category, barcode, is_active, created_at, updated_at';

function mapProductFromApi(p: any): Product {
  return {
    id: p.id,
    businessId: p.business_id ?? p.businessId,
    name: p.name,
    price: p.price,
    cost: p.cost || 0,
    stock: p.stock || 0,
    category: p.category || 'Sin categoría',
    image: p.image ?? '',
    barcode: p.barcode,
    description: p.description,
    isActive: p.is_active ?? p.isActive ?? true,
    createdAt: p.created_at ?? p.createdAt,
    updatedAt: p.updated_at ?? p.updatedAt,
  };
}

/**
 * Listado de productos. Por defecto el servidor omite `image` y `description` (mucho menos datos en red).
 * Usa `includeImage: true` solo si necesitas todas las imágenes en un solo payload (p. ej. export legacy).
 */
export async function getProducts(
  businessId: string,
  options?: { includeImage?: boolean },
): Promise<Product[]> {
  const includeImage = options?.includeImage === true;
  console.log('🔵 [API DIRECT] Getting products for business:', businessId, includeImage ? '+images' : 'lite');

  try {
    const accessToken = await getAccessToken();
    const qs = includeImage ? '?includeImage=1' : '';
    const response = await fetch(
      `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/products${qs}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Business-ID': businessId,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const { products: data } = await response.json();
    console.log('✅ [API DIRECT] Products retrieved:', data?.length || 0);

    return (data || []).map((p: any) => mapProductFromApi(p));
  } catch (error: any) {
    console.error('❌ [API DIRECT] Error getting products:', error);

    console.log('⚠️ Falling back to Supabase client...');
    const { data, error: dbError } = await retryOnceOnJwtExpired(() =>
      supabase
        .from('products')
        .select(includeImage ? '*' : PRODUCT_LIST_SELECT)
        .eq('business_id', businessId)
        .order('name'),
    );

    if (dbError) {
      throw new Error(normalizeAuthErrorMessage(dbError.message));
    }

    return (data || []).map((p: any) => mapProductFromApi(p));
  }
}

/** Un producto con imagen y descripción (p. ej. al abrir edición). */
export async function getProductById(businessId: string, productId: string): Promise<Product> {
  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/products/${encodeURIComponent(productId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Business-ID': businessId,
      },
    },
  );

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((body as any).error || `Error: ${response.status}`);
  }

  const { product: p } = body as { product?: any };
  if (!p) {
    throw new Error('Respuesta inválida del servidor');
  }
  return mapProductFromApi(p);
}

export async function createProduct(businessId: string, product: Omit<Product, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  console.log('🔵 [API DIRECT] Creating product:', product.name);
  
  // Match EXACTLY with SQL schema (lines 10-24 of SUPABASE_SETUP.sql)
  const insertData: any = {
    business_id: businessId,
    name: product.name,
    price: product.price,
    cost: product.cost || 0,
    stock: product.stock || 0,
    category: product.category || 'Sin categoría',
  };
  
  // Optional fields from SQL schema
  if (product.image) insertData.image = product.image;
  if (product.barcode) insertData.barcode = product.barcode;
  if (product.description) insertData.description = product.description;
  if (product.isActive !== undefined) insertData.is_active = product.isActive;
  
  const { data, error } = await supabase
    .from('products')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('❌ [API DIRECT] Error creating product:', error);
    throw new Error(normalizeAuthErrorMessage(error.message));
  }

  console.log('✅ [API DIRECT] Product created:', data.id);
  
  return {
    id: data.id,
    businessId: data.business_id,
    name: data.name,
    price: data.price,
    cost: data.cost,
    stock: data.stock,
    category: data.category,
    image: data.image,
    barcode: data.barcode,
    description: data.description,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateProduct(productId: string, businessId: string, updates: Partial<Product>): Promise<Product> {
  console.log('🔵 [API DIRECT] Updating product:', productId);
  
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.price !== undefined) updateData.price = updates.price;
  if (updates.cost !== undefined) updateData.cost = updates.cost;
  if (updates.stock !== undefined) updateData.stock = updates.stock;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.image !== undefined) updateData.image = updates.image;
  if (updates.barcode !== undefined) updateData.barcode = updates.barcode;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', productId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) {
    console.error('❌ [API DIRECT] Error updating product:', error);
    throw new Error(normalizeAuthErrorMessage(error.message));
  }

  console.log('✅ [API DIRECT] Product updated');
  
  return {
    id: data.id,
    businessId: data.business_id,
    name: data.name,
    price: data.price,
    cost: data.cost,
    stock: data.stock,
    category: data.category,
    image: data.image,
    barcode: data.barcode,
    description: data.description,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteProduct(productId: string, businessId: string): Promise<void> {
  console.log('🔵 [API DIRECT] Deleting product:', productId);
  
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('business_id', businessId);

  if (error) {
    console.error('❌ [API DIRECT] Error deleting product:', error);
    throw new Error(normalizeAuthErrorMessage(error.message));
  }

  console.log('✅ [API DIRECT] Product deleted');
}

// ==================== CATEGORIES ====================

export async function getCategories(businessId: string): Promise<Category[]> {
  // Try Edge Function first (bypasses RLS — works for employees)
  try {
    console.log('🔵 [API] Getting categories via Edge Function for business:', businessId);
    const token = await getAccessToken();
    const res = await fetch(
      `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/admin/categories`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Business-ID': businessId,
        },
      }
    );
    if (res.ok) {
      const json = await res.json();
      const cats: Category[] = (json.categories || []).map((c: any) => ({
        id: c.id,
        businessId: c.business_id,
        name: c.name,
        color: c.color,
        createdAt: c.created_at,
      }));
      console.log('✅ [API] Categories via Edge Function:', cats.length);
      return cats;
    }
    console.warn('⚠️ [API] Edge Function /admin/categories failed, falling back to direct query');
  } catch (e) {
    console.warn('⚠️ [API] Edge Function /admin/categories error, falling back:', e);
  }

  // Fallback: direct Supabase query (works for owners, RLS blocks employees → returns [])
  console.log('🔵 [API DIRECT] Getting categories for business:', businessId);
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', businessId)
    .order('name');

  if (error) {
    console.error('❌ [API DIRECT] Error getting categories:', error);
    return []; // Never throw — caller merges with product-derived categories
  }

  console.log('✅ [API DIRECT] Categories retrieved:', data?.length || 0);
  return (data || []).map((c: any) => ({
    id: c.id,
    businessId: c.business_id,
    name: c.name,
    color: c.color,
    createdAt: c.created_at,
  }));
}

export async function createCategory(businessId: string, category: Omit<Category, 'id' | 'businessId' | 'createdAt'>): Promise<Category> {
  console.log('🔵 [API DIRECT] Creating category:', category.name);

  const { data, error } = await supabase
    .from('categories')
    .insert({
      business_id: businessId,
      name: category.name,
      color: category.color || '#3B82F6',
    })
    .select()
    .single();

  if (error) {
    console.error('❌ [API DIRECT] Error creating category:', error);
    throw new Error(normalizeAuthErrorMessage(error.message));
  }

  console.log('✅ [API DIRECT] Category created:', data.id);
  
  return {
    id: data.id,
    businessId: data.business_id,
    name: data.name,
    color: data.color,
    createdAt: data.created_at,
  };
}

export async function updateCategory(categoryId: string, businessId: string, updates: Partial<Category>): Promise<Category> {
  console.log('🔵 [API DIRECT] Updating category:', categoryId);
  
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.color !== undefined) updateData.color = updates.color;

  const { data, error } = await supabase
    .from('categories')
    .update(updateData)
    .eq('id', categoryId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) {
    console.error('❌ [API DIRECT] Error updating category:', error);
    throw new Error(normalizeAuthErrorMessage(error.message));
  }

  console.log('✅ [API DIRECT] Category updated');
  
  return {
    id: data.id,
    businessId: data.business_id,
    name: data.name,
    color: data.color,
    createdAt: data.created_at,
  };
}

export async function deleteCategory(categoryId: string, businessId: string): Promise<void> {
  console.log('🔵 [API DIRECT] Deleting category:', categoryId);
  
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('business_id', businessId);

  if (error) {
    console.error('❌ [API DIRECT] Error deleting category:', error);
    throw new Error(normalizeAuthErrorMessage(error.message));
  }

  console.log('✅ [API DIRECT] Category deleted');
}

// ==================== CUSTOMERS ====================

function normalizeCustomerType(raw: unknown): 'customer' | 'supplier' | 'both' {
  const t = String(raw ?? '').trim();
  if (t === 'supplier' || t === 'customer' || t === 'both') return t;
  return 'customer';
}

/** Unifica `type` (API) y `contact_type` (BD / respuestas mixtas). */
function mapCustomerFromApi(c: any): Customer {
  const type = normalizeCustomerType(c?.type ?? c?.contact_type);
  return {
    id: c.id,
    businessId: c.businessId ?? c.business_id,
    name: c.name,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    address: c.address ?? undefined,
    taxId: c.taxId ?? c.tax_id,
    cedula: c.cedula ?? undefined,
    type,
    creditLimit: c.creditLimit ?? c.credit_limit,
    currentBalance: c.currentBalance ?? c.current_balance,
    createdAt: c.createdAt ?? c.created_at,
    updatedAt: c.updatedAt ?? c.updated_at,
  };
}

export async function getCustomers(businessId: string): Promise<Customer[]> {
  console.log('🔵 [API] Getting customers for business:', businessId);

  const accessToken = await getAccessToken();
  const response = await fetch(`https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/customers`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Business-ID': businessId,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('❌ [API] Error getting customers:', text);
    throw new Error(`Error ${response.status}: ${text}`);
  }

  const json = await response.json();
  console.log('✅ [API] Customers retrieved:', json.customers?.length || 0);
  const list = json.customers || [];
  return list.map(mapCustomerFromApi);
}

export async function createCustomer(businessId: string, customer: Omit<Customer, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
  console.log('🔵 [API] Creating customer:', customer.name);

  const accessToken = await getAccessToken();
  const response = await fetch(`https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/customers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Business-ID': businessId,
    },
    body: JSON.stringify({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      tax_id: customer.taxId,
      cedula: customer.cedula,
      /** Preferir snake_case: evita que proxies o runtimes traten `type` de forma especial */
      contact_type: customer.type ?? 'customer',
      type: customer.type ?? 'customer',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('❌ [API] Error creating customer:', text);
    throw new Error(`Error ${response.status}: ${text}`);
  }

  const json = await response.json();
  console.log('✅ [API] Customer created:', json.customer?.id);
  return mapCustomerFromApi(json.customer);
}

export async function updateCustomer(customerId: string, businessId: string, updates: Partial<Customer>): Promise<Customer> {
  console.log('🔵 [API] Updating customer:', customerId);

  const accessToken = await getAccessToken();
  const response = await fetch(`https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/customers/${customerId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Business-ID': businessId,
    },
    body: JSON.stringify({
      name: updates.name,
      email: updates.email,
      phone: updates.phone,
      address: updates.address,
      tax_id: updates.taxId,
      cedula: updates.cedula,
      ...(updates.type !== undefined && {
        contact_type: updates.type,
        type: updates.type,
      }),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('❌ [API] Error updating customer:', text);
    throw new Error(`Error ${response.status}: ${text}`);
  }

  const json = await response.json();
  console.log('✅ [API] Customer updated');
  return mapCustomerFromApi(json.customer);
}

export async function deleteCustomer(customerId: string, businessId: string): Promise<void> {
  console.log('🔵 [API] Deleting customer:', customerId);

  const accessToken = await getAccessToken();
  const response = await fetch(`https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/customers/${customerId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Business-ID': businessId,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('❌ [API] Error deleting customer:', text);
    throw new Error(`Error ${response.status}: ${text}`);
  }

  console.log('✅ [API] Customer deleted');
}

// ==================== SALES ====================

function mapSaleRow(s: any): Sale {
  return {
    id: s.id,
    businessId: s.business_id,
    customerId: s.customer_id,
    saleNumber: s.sale_number ?? '',
    total: s.total,
    subtotal: s.subtotal,
    tax: s.tax,
    discount: s.discount,
    paymentMethod: s.payment_method ?? '',
    paymentStatus: s.payment_status,
    paidAmount: s.paid_amount ?? 0,
    changeAmount: s.change_amount,
    items: s.items ?? [],
    payments: s.payments ?? [],
    notes: s.notes,
    createdBy: s.created_by,
    createdAt: s.created_at,
  };
}

export async function getSales(
  businessId: string,
  options?: { from?: string; to?: string; limit?: number; fields?: 'full' | 'balance' },
): Promise<Sale[]> {
  console.log('🔵 [API] Getting sales for business:', businessId, options?.fields === 'balance' ? '(balance rows)' : '');

  const accessToken = await getAccessToken();
  const params = new URLSearchParams();
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.fields === 'balance') params.set('fields', 'balance');
  const qs = params.toString() ? '?' + params.toString() : '';

  // Try the Edge Function server (bypasses RLS for all roles)
  try {
    const url = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/admin/sales${qs}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Business-ID': businessId },
    });
    if (response.ok) {
      const { sales: data } = await response.json();
      console.log('✅ [API] Sales via Edge Function:', data?.length || 0);
      return (data || []).map(mapSaleRow);
    }
    console.warn(`⚠️ [API] Edge Function /admin/sales returned ${response.status}, falling back to direct query`);
  } catch (e) {
    console.warn('⚠️ [API] Edge Function /admin/sales failed, falling back to direct query:', e);
  }

  // Fallback: direct Supabase query (works if RLS SELECT allows authenticated users)
  const saleSelect =
    options?.fields === 'balance'
      ? 'id,customer_id,total,payment_status,paid_amount'
      : '*';
  let query = supabase.from('sales').select(saleSelect).eq('business_id', businessId).order('created_at', { ascending: false });
  if (options?.from) query = query.gte('created_at', options.from);
  if (options?.to) query = query.lte('created_at', options.to);
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    console.error('❌ [API] Direct getSales error:', error);
    throw new Error(normalizeAuthErrorMessage(error.message));
  }
  console.log('✅ [API] Sales via direct query:', data?.length || 0);
  return (data || []).map(mapSaleRow);
}

export async function getSaleById(saleId: string, businessId: string): Promise<Sale> {
  console.log('🔵 [API DIRECT] Getting sale:', saleId);
  
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('id', saleId)
    .eq('business_id', businessId)
    .single();

  if (error) {
    console.error('❌ [API DIRECT] Error getting sale:', error);
    throw new Error(normalizeAuthErrorMessage(error.message));
  }

  return {
    id: data.id,
    businessId: data.business_id,
    customerId: data.customer_id,
    saleNumber: data.sale_number,
    total: data.total,
    subtotal: data.subtotal,
    tax: data.tax,
    discount: data.discount,
    paymentMethod: data.payment_method,
    paymentStatus: data.payment_status,
    paidAmount: data.paid_amount,
    changeAmount: data.change_amount,
    items: data.items,
    payments: data.payments,
    notes: data.notes,
    createdBy: data.created_by,
    createdAt: data.created_at,
  };
}

export async function createSale(businessId: string, sale: Omit<Sale, 'id' | 'businessId' | 'saleNumber'> & { createdAt?: string }): Promise<Sale> {
  console.log('🔵 [API] Creating sale via Edge Function (bypasses RLS for employees)');

  // Route through Edge Function server which uses SERVICE_ROLE_KEY to bypass RLS.
  // Direct Supabase calls use publicAnonKey and are blocked by RLS for employees.
  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/sales/db-create`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Business-ID': businessId,
      },
      body: JSON.stringify({
        customerId: sale.customerId,
        total: sale.total,
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        paymentMethod: sale.paymentMethod,
        paymentStatus: sale.paymentStatus,
        paidAmount: sale.paidAmount,
        changeAmount: sale.changeAmount,
        items: sale.items,
        payments: sale.payments,
        notes: sale.notes,
        createdBy: sale.createdBy,
        createdAt: sale.createdAt,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ [API] Error creating sale via server:', errorBody);
    throw new Error(errorBody.error || `Error ${response.status} al crear la venta`);
  }

  const { sale: data } = await response.json();
  console.log('✅ [API] Sale created via server:', data.id, data.sale_number);

  return {
    id: data.id,
    businessId: data.business_id,
    customerId: data.customer_id,
    saleNumber: data.sale_number,
    total: data.total,
    subtotal: data.subtotal,
    tax: data.tax,
    discount: data.discount,
    paymentMethod: data.payment_method,
    paymentStatus: data.payment_status,
    paidAmount: data.paid_amount,
    changeAmount: data.change_amount,
    items: data.items,
    payments: data.payments,
    notes: data.notes,
    createdBy: data.created_by,
    createdAt: data.created_at,
  };
}

export async function deleteSale(saleId: string, businessId: string): Promise<void> {
  console.log('🔵 [API] Deleting sale via Edge Function:', saleId);

  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/admin/sales/${saleId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Business-ID': businessId,
      },
    }
  );

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ [API] Error deleting sale:', errBody);
    throw new Error(errBody.error || `Error ${response.status} al eliminar venta`);
  }

  console.log('✅ [API] Sale deleted via server:', saleId);
}

export type UpdateSalePayload = Partial<Sale> & {
  customerId?: string | null;
  items?: any[];
  payments?: any[];
  createdAt?: string;
  /** UUID de auth.users del vendedor (columna sales.created_by) */
  createdBy?: string | null;
};

export async function updateSale(saleId: string, businessId: string, updates: UpdateSalePayload): Promise<Sale> {
  console.log('🔵 [API] Updating sale via Edge Function:', saleId);

  const accessToken = await getAccessToken();
  const body: Record<string, unknown> = {
    notes: updates.notes,
    paymentStatus: updates.paymentStatus,
    paidAmount: updates.paidAmount,
    changeAmount: updates.changeAmount,
    customerId: updates.customerId,
    total: updates.total,
    subtotal: updates.subtotal,
    discount: updates.discount,
    tax: updates.tax,
    paymentMethod: updates.paymentMethod,
    items: updates.items,
    payments: updates.payments,
    createdAt: updates.createdAt,
    createdBy: updates.createdBy,
  };
  Object.keys(body).forEach((k) => {
    if (body[k] === undefined) delete body[k];
  });

  // Usar /sales/db-update (definido en index.ts) para que un solo despliegue del bundle principal
  // persista todos los campos. /admin/sales queda como respaldo por si el despliegue antiguo solo tenía esa ruta.
  const patchUrl = (path: string) =>
    `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b${path}`;

  let response = await fetch(patchUrl(`/sales/db-update/${saleId}`), {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Business-ID': businessId,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok && (response.status === 404 || response.status === 405)) {
    console.warn('⚠️ [API] db-update no disponible, reintentando /admin/sales');
    response = await fetch(patchUrl(`/admin/sales/${saleId}`), {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Business-ID': businessId,
      },
      body: JSON.stringify(body),
    });
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ [API] Error updating sale:', errBody);
    throw new Error(errBody.error || `Error ${response.status} al actualizar venta`);
  }

  const { sale: data } = await response.json();
  console.log('✅ [API] Sale updated via server:', data.id);

  return {
    id: data.id,
    businessId: data.business_id,
    customerId: data.customer_id,
    saleNumber: data.sale_number,
    total: data.total,
    subtotal: data.subtotal,
    tax: data.tax,
    discount: data.discount,
    paymentMethod: data.payment_method,
    paymentStatus: data.payment_status,
    paidAmount: data.paid_amount,
    changeAmount: data.change_amount,
    items: data.items,
    payments: data.payments,
    notes: data.notes,
    createdBy: data.created_by,
    createdAt: data.created_at,
  };
}

// ==================== EXPENSES ====================

function mapExpenseRow(e: any): Expense {
  const ps = String(e.payment_status ?? 'paid').toLowerCase();
  return {
    id: e.id,
    businessId: e.business_id,
    category: e.category,
    description: e.description,
    amount: e.amount,
    paymentMethod: e.payment_method,
    paymentStatus: ps === 'pending' || ps === 'partial' ? ps : 'paid',
    receiptImage: e.receipt_image,
    notes: e.notes,
    createdBy: e.created_by,
    createdAt: e.created_at,
  };
}

export async function getExpenses(businessId: string, options?: { from?: string; to?: string; limit?: number }): Promise<Expense[]> {
  console.log('🔵 [API] Getting expenses for business:', businessId);

  const accessToken = await getAccessToken();
  const params = new URLSearchParams();
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString() ? '?' + params.toString() : '';

  // Try the Edge Function server (bypasses RLS for all roles)
  try {
    const url = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/admin/expenses${qs}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Business-ID': businessId },
    });
    if (response.ok) {
      const { expenses: data } = await response.json();
      console.log('✅ [API] Expenses via Edge Function:', data?.length || 0);
      return (data || []).map(mapExpenseRow);
    }
    console.warn(`⚠️ [API] Edge Function /admin/expenses returned ${response.status}, falling back to direct query`);
  } catch (e) {
    console.warn('⚠️ [API] Edge Function /admin/expenses failed, falling back to direct query:', e);
  }

  // Fallback: direct Supabase query
  let query = supabase.from('expenses').select('*').eq('business_id', businessId).order('created_at', { ascending: false });
  if (options?.from) query = query.gte('created_at', options.from);
  if (options?.to) query = query.lte('created_at', options.to);
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    console.error('❌ [API] Direct getExpenses error:', error);
    throw new Error(normalizeAuthErrorMessage(error.message));
  }
  console.log('✅ [API] Expenses via direct query:', data?.length || 0);
  return (data || []).map(mapExpenseRow);
}

export async function createExpense(businessId: string, expense: Omit<Expense, 'id' | 'businessId'> & { createdAt?: string }): Promise<Expense> {
  console.log('🔵 [API] Creating expense via Edge Function (bypasses RLS for employees)');

  const { data: { user } } = await supabase.auth.getUser();

  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/admin/expenses`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Business-ID': businessId,
      },
      body: JSON.stringify({
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        paymentMethod: expense.paymentMethod,
        paymentStatus: expense.paymentStatus ?? 'paid',
        receiptImage: expense.receiptImage,
        notes: expense.notes,
        createdBy: user?.id || null,
        createdAt: expense.createdAt,
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ [API] Error creating expense via server:', errBody);
    throw new Error(errBody.error || `Error ${response.status} al crear gasto`);
  }

  const { expense: data } = await response.json();
  console.log('✅ [API] Expense created via server:', data.id);

  return mapExpenseRow(data);
}

export async function deleteExpense(expenseId: string, businessId: string): Promise<void> {
  console.log('🔵 [API DIRECT] Deleting expense:', expenseId);
  
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('business_id', businessId);

  if (error) {
    console.error('❌ [API DIRECT] Error deleting expense:', error);
    throw new Error(normalizeAuthErrorMessage(error.message));
  }

  console.log('✅ [API DIRECT] Expense deleted');
}

export async function updateExpense(expenseId: string, businessId: string, updates: Partial<Expense>): Promise<Expense> {
  console.log('🔵 [API DIRECT] Updating expense:', expenseId);
  
  const updateData: any = {};
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod;
  if (updates.paymentStatus !== undefined) updateData.payment_status = updates.paymentStatus;
  if (updates.createdAt !== undefined) updateData.created_at = updates.createdAt;
  // No updated_at column in expenses table

  const { data, error } = await supabase
    .from('expenses')
    .update(updateData)
    .eq('id', expenseId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) {
    console.error('❌ [API DIRECT] Error updating expense:', error);
    throw new Error(normalizeAuthErrorMessage(error.message));
  }

  console.log('✅ [API DIRECT] Expense updated');

  return mapExpenseRow(data);
}

// ==================== EMPLOYEES ====================

export interface Employee {
  id: string;
  businessId?: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  permissions: any;
  is_active?: boolean;
  is_owner?: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function getEmployees(businessId: string): Promise<Employee[]> {
  console.log('🔵 [API] Getting employees via Edge Function for business:', businessId);
  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/admin/employees`,
    { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Business-ID': businessId } }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ [API] Error getting employees via Edge Function:', err);
    throw new Error(err.error || `Error ${response.status} al obtener empleados`);
  }
  const { employees: data } = await response.json();
  console.log('✅ [API DIRECT] Employees retrieved:', data?.length || 0);
  return (data || []).map((e: any) => ({
    id: e.id,
    businessId: e.business_id,
    userId: e.user_id,
    name: e.name,
    email: e.email,
    phone: e.phone,
    role: e.role,
    permissions: e.permissions,
    is_active: e.is_active,
    is_owner: e.is_owner,
    created_at: e.created_at,
    updated_at: e.updated_at,
  }));
}

export async function createEmployee(businessId: string, employee: {
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  permissions: any;
  is_owner?: boolean;
}): Promise<Employee> {
  console.log('🔵 [API] Creating employee via Edge Function');
  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/admin/employees`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Business-ID': businessId,
      },
      body: JSON.stringify({
        name:        employee.name,
        email:       employee.email,
        phone:       employee.phone || null,
        role:        employee.role,
        permissions: employee.permissions,
        is_active:   true,
        is_owner:    employee.is_owner || false,
      }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ [API] Error creating employee via Edge Function:', err);
    throw new Error(err.error || `Error ${response.status} al crear empleado`);
  }
  const { employee: data } = await response.json();
  console.log('✅ [API] Employee created via Edge Function:', data.id);
  return {
    id: data.id,
    businessId: data.business_id,
    userId: data.user_id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    permissions: data.permissions,
    is_active: data.is_active,
    is_owner: data.is_owner,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updateEmployee(employeeId: string, businessId: string, updates: Partial<Employee>): Promise<Employee> {
  console.log('🔵 [API] Updating employee via Edge Function:', employeeId);
  const accessToken = await getAccessToken();
  const body: Record<string, any> = {};
  if (updates.name        !== undefined) body.name        = updates.name;
  if (updates.email       !== undefined) body.email       = updates.email;
  if (updates.phone       !== undefined) body.phone       = updates.phone;
  if (updates.role        !== undefined) body.role        = updates.role;
  if (updates.permissions !== undefined) body.permissions = updates.permissions;
  if (updates.is_active   !== undefined) body.is_active   = updates.is_active;

  const response = await fetch(
    `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/admin/employees/${employeeId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Business-ID': businessId,
      },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ [API] Error updating employee via Edge Function:', err);
    throw new Error(err.error || `Error ${response.status} al actualizar empleado`);
  }
  const { employee: data } = await response.json();
  console.log('✅ [API] Employee updated via Edge Function:', data.id);
  return {
    id: data.id,
    businessId: data.business_id,
    userId: data.user_id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    permissions: data.permissions,
    is_active: data.is_active,
    is_owner: data.is_owner,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function deleteEmployee(employeeId: string, businessId: string): Promise<void> {
  console.log('🔵 [API] Soft-deleting employee via Edge Function:', employeeId);
  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/admin/employees/${employeeId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Business-ID': businessId,
      },
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ [API] Error deleting employee via Edge Function:', err);
    throw new Error(err.error || `Error ${response.status} al eliminar empleado`);
  }
  console.log('✅ [API] Employee soft-deleted via Edge Function:', employeeId);
}

export async function getEmployeeByEmail(businessId: string, email: string): Promise<Employee | null> {
  console.log('🔵 [API] Getting employee by email via Edge Function:', email);
  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/admin/employees/by-email?email=${encodeURIComponent(email)}`,
    { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Business-ID': businessId } }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ [API] Error getting employee by email:', err);
    // Return null instead of throwing — caller handles not found
    return null;
  }
  const { employee: data } = await response.json();
  if (!data) { console.log('ℹ️ [API] Employee not found'); return null; }
  console.log('✅ [API] Employee found via Edge Function');
  return {
    id: data.id,
    businessId: data.business_id,
    userId: data.user_id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    permissions: data.permissions,
    is_active: data.is_active,
    is_owner: data.is_owner,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Invite employee - Send real email with Brevo via server
export async function inviteEmployee(businessId: string, employee: {
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  permissions: any;
}): Promise<{ success: boolean; invitationLink: string }> {
  console.log('🚀 [INVITE] Creating employee invitation...');
  console.log('📧 [INVITE] Email:', employee.email);
  console.log('👤 [INVITE] Name:', employee.name);
  
  // 1. Check if employee already exists
  const existing = await getEmployeeByEmail(businessId, employee.email);
  if (existing) {
    throw new Error('Este empleado ya existe en el negocio');
  }
  
  // 1.5. Get business name
  const { data: businessData } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .single();
  
  const businessName = businessData?.name || 'Negocio';
  
  // 2. Create employee record WITHOUT user_id (pending confirmation)
  console.log('📝 [INVITE] Creating employee record...');
  await createEmployee(businessId, employee);
  
  // 3. Generate invitation token (INCLUYE businessName)
  const invitationToken = btoa(JSON.stringify({
    businessId,
    businessName,
    email: employee.email,
    name: employee.name,
    role: employee.role,
    permissions: employee.permissions,
    phone: employee.phone,
    timestamp: Date.now()
  }));
  
  // 4. Create invitation link
  // IMPORTANTE: Usar la URL de Figma Make con preview-route en lugar del iframe directo
  // Intentar obtener el figmaFileKey de la URL actual
  let figmaFileKey = '5Fd3OHhMY2lssTlq3IRIEy'; // Default fallback
  
  try {
    // Intentar extraer de la URL del padre (window.top)
    const parentUrl = window.top?.location.href || window.location.href;
    const makeMatch = parentUrl.match(/figma\.com\/make\/([^\/]+)/);
    if (makeMatch && makeMatch[1]) {
      figmaFileKey = makeMatch[1];
      console.log('📍 [INVITE] Figma file key detectado:', figmaFileKey);
    }
  } catch (err) {
    console.log('⚠️ [INVITE] No se pudo detectar file key, usando default');
  }
  
  const invitationLink = `https://www.figma.com/make/${figmaFileKey}/POS#/invite/${invitationToken}`;
  
  console.log('🔗 [INVITE] Link generado:', invitationLink);
  console.log('📧 [INVITE] Sending email via server...');
  
  // 5. Send email via server
  try {
    const emailResponse = await fetch(
      `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/send-invitation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: employee.email,
          name: employee.name,
          invitationLink: invitationLink,
        }),
      }
    );
    
    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('❌ [INVITE] Error sending email:', errorData);
      throw new Error('No se pudo enviar el correo de invitación');
    }
    
    console.log('✅ [INVITE] Email sent successfully via server!');
  } catch (emailError: any) {
    console.error('❌ [INVITE] Email error:', emailError);
    throw new Error(`Error al enviar correo: ${emailError.message}`);
  }
  
  console.log('✅ [INVITE] Employee invitation created and email sent!');
  
  return {
    success: true,
    invitationLink,
  };
}

// Fix employee user_id (migration)
export async function fixEmployeeUserId(): Promise<{ success: boolean; message: string }> {
  console.log('🔧 [API] Fixing employee user_id...');
  
  const response = await fetch(
    `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/fix-employee-user-id`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAccessToken()}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok && !data.alreadyFixed) {
    throw new Error(data.error || 'Error al arreglar el empleado');
  }

  console.log('✅ [API] Employee user_id fixed');
  return data;
}

// ==================== MOVEMENTS ====================

export interface Movement {
  id: string;
  type: 'sale' | 'expense';
  date: string;
  amount: number;
  description: string;
  category?: string;
  paymentMethod?: string;
  customer?: string;
  createdBy?: string;
  createdAt: string;
}

export async function getMovements(businessId: string, options?: { from?: string; to?: string; limit?: number }): Promise<Movement[]> {
  console.log('🔵 [API DIRECT] Getting movements for business:', businessId);
  
  // Get sales and expenses
  const [sales, expenses] = await Promise.all([
    getSales(businessId, options),
    getExpenses(businessId, options),
  ]);

  // Combine and map to Movement type
  const movements: Movement[] = [
    ...sales.map(sale => ({
      id: sale.id,
      type: 'sale' as const,
      date: sale.createdAt || '',
      amount: sale.total,
      description: `Venta ${sale.saleNumber}`,
      category: 'Venta',
      paymentMethod: sale.paymentMethod,
      customer: sale.customerId,
      createdBy: sale.createdBy,
      createdAt: sale.createdAt || '',
    })),
    ...expenses.map(expense => ({
      id: expense.id,
      type: 'expense' as const,
      date: expense.createdAt || '',
      amount: expense.amount,
      description: expense.description || expense.category,
      category: expense.category,
      paymentMethod: expense.paymentMethod,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt || '',
    })),
  ];

  // Sort by date (most recent first)
  movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  console.log('✅ [API DIRECT] Movements retrieved:', movements.length);
  
  return movements;
}