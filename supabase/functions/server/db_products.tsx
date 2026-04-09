// Database helper functions for products
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/** Sin `image` ni `description` — evita respuestas de varios MB (base64 en image / textos largos). */
const PRODUCT_LIST_COLUMNS =
  'id, business_id, name, price, cost, stock, category, barcode, is_active, created_at, updated_at';

// Get all products for a business
// NOTE: The 'products' table does NOT have an 'active' column — do not filter by it.
export async function getProducts(businessId: string, options?: { includeImage?: boolean }) {
  const includeImage = options?.includeImage === true;

  const { data, error } = await supabase
    .from('products')
    .select(includeImage ? '*' : PRODUCT_LIST_COLUMNS)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get a single product
export async function getProductById(productId: string, businessId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('business_id', businessId)
    .single();

  if (error) throw error;
  return data;
}

// Create a new product
export async function createProduct(businessId: string, productData: {
  name: string;
  sku?: string;
  price: number;
  cost?: number;
  stock?: number;
  category?: string;
  image?: string;
  description?: string;
}) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      business_id: businessId,
      name: productData.name,
      sku: productData.sku || null,
      price: productData.price,
      cost: productData.cost || 0,
      stock: productData.stock || 0,
      category: productData.category || 'Otros',
      image: productData.image || null,
      description: productData.description || null,
      // NOTE: No 'active' column in this table
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update a product
export async function updateProduct(productId: string, businessId: string, updates: {
  name?: string;
  sku?: string;
  price?: number;
  cost?: number;
  stock?: number;
  category?: string;
  image?: string;
  description?: string;
}) {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update product stock
export async function updateProductStock(productId: string, businessId: string, quantityChange: number) {
  // Get current stock
  const product = await getProductById(productId, businessId);
  const newStock = Math.max(0, product.stock + quantityChange);

  const { data, error } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', productId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete a product (hard delete since there's no 'active' column)
export async function deactivateProduct(productId: string, businessId: string) {
  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
