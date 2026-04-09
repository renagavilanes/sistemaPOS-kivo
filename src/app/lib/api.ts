import { CartItem, Product, Client, Expense } from '../types';
import * as apiService from '../services/api';
import { supabase } from './supabase';
import { CURRENT_BUSINESS_ID_KEY } from './businessSelectionStorage';

// Helper to get current business ID from localStorage
function getCurrentBusinessId(): string | null {
  return localStorage.getItem(CURRENT_BUSINESS_ID_KEY);
}

// Helper to get current user
async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

// ==================== SALES ====================

/**
 * Concepto por defecto en Movimientos: un ítem o "primero +(N) más".
 * En el POS los nuevos ítems se insertan al inicio del carrito (`[último, …, primero]`),
 * así que el primero elegido por el usuario es el último elemento del array.
 */
export function defaultSaleConceptFromCart(cartItems: CartItem[]): string {
  if (!cartItems.length) return '';
  const firstPicked = cartItems[cartItems.length - 1];
  if (cartItems.length === 1) return firstPicked.product.name;
  const extra = cartItems.length - 1;
  return `${firstPicked.product.name} +(${extra}) más`;
}

export interface CreateSaleData {
  cartItems: CartItem[];
  total: number;
  paymentType: 'pagada' | 'credito';
  payments: Array<{
    method: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Otros';
    amount: number;
  }>;
  client?: Client | null;
  saleDate?: string;
  receiptNote?: string;
  discount?: {
    percent: number;
    amount: number;
  };
}

export async function createSale(data: CreateSaleData) {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('No se ha seleccionado ningún negocio');
  }

  console.log('💰 Creando venta:', data);

  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  // Calculate totals
  const subtotal = data.cartItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
  const discountAmount = data.discount?.amount || 0;
  const total = subtotal - discountAmount;

  // Map cart items to sale items
  const items = data.cartItems.map(item => ({
    productId: item.product.id,
    name: item.product.name,
    price: item.priceAtSale,
    quantity: item.quantity,
    subtotal: item.priceAtSale * item.quantity,
    discount: 0,
  }));

  // Estado de pago en BD
  // Importante: PaymentSheet reutiliza el mismo arreglo `payments` que en "pagada" y pone
  // amount = total aunque sea crédito → antes paidAmount >= total marcaba la venta como "paid".
  // Crédito = nada cobrado en caja en este momento → pending + paid_amount 0.
  let paidAmount = data.payments.reduce((sum, p) => sum + p.amount, 0);
  let paymentStatus: 'paid' | 'pending' | 'partial' = 'paid';
  let paymentsForDb = data.payments;

  if (data.paymentType === 'credito') {
    paymentStatus = 'pending';
    paidAmount = 0;
    paymentsForDb = [];
  } else {
    paymentStatus =
      paidAmount >= total ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';
  }

  // ✅ FIX DEFINITIVO DE FECHAS
  // Construye un datetime ISO con offset de zona horaria local.
  //
  // Ejemplo Colombia (UTC-5) a las 7:50 PM del 16 de marzo:
  //   entrada: "2026-03-16"
  //   salida:  "2026-03-16T19:50:30.000-05:00"
  //
  // PostgreSQL lo almacena como "2026-03-17T00:50:30Z" (UTC).
  // Al leerlo de vuelta con new Date(), JS lo convierte a hora local:
  // → March 16, 19:50 local ✓ (fecha y hora correctas en la app)
  const saleDateTime = buildLocalDateTimeISO(data.saleDate);

  console.log('📅 Fecha de venta:', { seleccionada: data.saleDate, guardada: saleDateTime });

  const receiptTrimmed = (data.receiptNote && String(data.receiptNote).trim()) || '';
  const notesForSale = receiptTrimmed || defaultSaleConceptFromCart(data.cartItems);

  const sale = await apiService.createSale(businessId, {
    customerId: data.client?.id,
    total,
    subtotal,
    discount: discountAmount,
    paymentMethod:
      data.paymentType === 'credito'
        ? 'Crédito'
        : data.payments[0]?.method || 'Efectivo',
    paymentStatus,
    paidAmount,
    changeAmount:
      data.paymentType === 'credito' ? 0 : paidAmount > total ? paidAmount - total : 0,
    items,
    payments: paymentsForDb,
    notes: notesForSale || undefined,
    createdBy: user.id,
    createdAt: saleDateTime,
  });

  return {
    success: true,
    sale,
  };
}

/** Venta sin productos del catálogo: un ítem JSON con productId null (sin movimiento de stock). */
export interface CreateFreeSaleData {
  subtotal: number;
  paymentType: 'pagada' | 'credito';
  payments: Array<{
    method: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Otros';
    amount: number;
  }>;
  client?: Client | null;
  saleDate?: string;
  receiptNote?: string;
  discount?: {
    percent: number;
    amount: number;
  };
}

export async function createFreeSale(data: CreateFreeSaleData) {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('No se ha seleccionado ningún negocio');
  }

  const subtotal = Number(data.subtotal);
  if (!subtotal || subtotal <= 0) {
    throw new Error('El monto de la venta libre debe ser mayor a 0');
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const discountAmount = data.discount?.amount || 0;
  const total = subtotal - discountAmount;

  const items = [
    {
      productId: null as string | null,
      name: 'Venta libre',
      price: subtotal,
      quantity: 1,
      subtotal,
      discount: 0,
      freeSale: true,
    },
  ];

  let paidAmount = data.payments.reduce((sum, p) => sum + p.amount, 0);
  let paymentStatus: 'paid' | 'pending' | 'partial' = 'paid';
  let paymentsForDb = data.payments;

  if (data.paymentType === 'credito') {
    paymentStatus = 'pending';
    paidAmount = 0;
    paymentsForDb = [];
  } else {
    paymentStatus =
      paidAmount >= total ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';
  }

  const saleDateTime = buildLocalDateTimeISO(data.saleDate);

  const receiptTrimmed = (data.receiptNote && String(data.receiptNote).trim()) || '';
  const notesForSale = receiptTrimmed || 'Venta libre';

  const sale = await apiService.createSale(businessId, {
    customerId: data.client?.id,
    total,
    subtotal,
    discount: discountAmount,
    paymentMethod:
      data.paymentType === 'credito'
        ? 'Crédito'
        : data.payments[0]?.method || 'Efectivo',
    paymentStatus,
    paidAmount,
    changeAmount:
      data.paymentType === 'credito' ? 0 : paidAmount > total ? paidAmount - total : 0,
    items,
    payments: paymentsForDb,
    notes: notesForSale || undefined,
    createdBy: user.id,
    createdAt: saleDateTime,
  });

  return {
    success: true,
    sale,
  };
}

// ==================== EXPENSES ====================

export interface CreateExpenseData {
  date: string;
  category: string;
  supplier?: string;
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Otros' | '-';
  amount: number;
  notes?: string;
  status?: string;
}

export async function createExpense(data: CreateExpenseData) {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('No se ha seleccionado ningún negocio');
  }

  console.log('💸 Creando gasto:', data);

  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  // ✅ FIX DEFINITIVO DE FECHAS
  const expenseDateTime = buildLocalDateTimeISO(data.date);

  console.log('📅 Fecha de gasto:', { seleccionada: data.date, guardada: expenseDateTime });

  const paymentStatus =
    data.status === 'pending' ? 'pending' : 'paid';

  const expense = await apiService.createExpense(businessId, {
    category: data.category,
    description: data.supplier || data.category,
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    paymentStatus,
    notes: data.notes,
    createdBy: user.id,
    createdAt: expenseDateTime,
  });

  return {
    success: true,
    expense,
  };
}

// ==================== MOVEMENTS ====================

export async function getMovements() {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('No se ha seleccionado ningún negocio');
  }

  // Get sales and expenses from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [sales, expenses] = await Promise.all([
    apiService.getSales(businessId, { from: thirtyDaysAgo.toISOString() }),
    apiService.getExpenses(businessId, { from: thirtyDaysAgo.toISOString() }),
  ]);

  return {
    success: true,
    sales,
    expenses,
  };
}

// ==================== PRODUCTS ====================

export async function getProducts() {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('No se ha seleccionado ningún negocio');
  }

  const products = await apiService.getProducts(businessId);

  // Map to expected format
  const mappedProducts = products.map(p => ({
    ...p,
    image: p.image || '',
  }));

  return {
    success: true,
    products: mappedProducts,
  };
}

export interface CreateProductData {
  name: string;
  price: number;
  cost: number;
  stock?: number;
  category?: string;
  image?: string;
}

export async function createProduct(data: CreateProductData) {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('No se ha seleccionado ningún negocio');
  }

  console.log('📦 Creando producto:', data);

  const product = await apiService.createProduct(businessId, {
    name: data.name,
    price: data.price,
    cost: data.cost,
    stock: data.stock || 0,
    category: data.category || 'Otros',
    image: data.image,
  });

  return {
    success: true,
    product,
  };
}

export async function updateProduct(productId: string, data: Partial<Product>) {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('No se ha seleccionado ningún negocio');
  }

  console.log('📝 Actualizando producto:', productId, data);

  const product = await apiService.updateProduct(productId, businessId, data);

  return {
    success: true,
    product,
  };
}

export async function deleteProduct(productId: string) {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('No se ha seleccionado ningún negocio');
  }

  await apiService.deleteProduct(productId, businessId);

  return {
    success: true,
    message: 'Product deleted',
  };
}

// ==================== CLIENTS ====================

export async function getClients() {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('No se ha seleccionado ningún negocio');
  }

  const customers = await apiService.getCustomers(businessId);

  // Map to Client format
  const clients = customers.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone || '',
    email: c.email || '',
    address: c.address,
    taxId: c.taxId,
    creditLimit: c.creditLimit || 0,
    currentBalance: c.currentBalance || 0,
  }));

  return {
    success: true,
    clients,
  };
}

export interface CreateClientData {
  name: string;
  phone?: string;
  email?: string;
}

export async function createClient(data: CreateClientData) {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('No se ha seleccionado ningún negocio');
  }

  console.log('👤 Creando cliente:', data);

  const customer = await apiService.createCustomer(businessId, {
    name: data.name,
    phone: data.phone,
    email: data.email,
    type: 'customer',
    creditLimit: 0,
    currentBalance: 0,
  });

  return {
    success: true,
    client: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
    },
  };
}

// ==================== DEMO DATA ====================

export async function initializeDemoProducts() {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('No se ha seleccionado ningún negocio');
  }

  // Verificar si ya existen productos
  const { products: existingProducts } = await getProducts();
  if (existingProducts.length > 0) {
    console.log('✅ Ya existen productos, no se inicializan productos de prueba');
    return { success: true, message: 'Products already exist' };
  }

  console.log('🎨 Inicializando productos de prueba...');

  const demoProducts = [
    {
      name: 'Café Americano',
      price: 3500,
      cost: 1200,
      stock: 100,
      category: 'Bebidas',
      image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop',
    },
    {
      name: 'Café Latte',
      price: 4500,
      cost: 1500,
      stock: 80,
      category: 'Bebidas',
      image: 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=400&h=400&fit=crop',
    },
    {
      name: 'Croissant',
      price: 4000,
      cost: 1800,
      stock: 50,
      category: 'Panadería',
      image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop',
    },
    {
      name: 'Muffin de Chocolate',
      price: 3800,
      cost: 1600,
      stock: 45,
      category: 'Panadería',
      image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&h=400&fit=crop',
    },
    {
      name: 'Sandwich Club',
      price: 8500,
      cost: 3500,
      stock: 30,
      category: 'Comida',
      image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=400&fit=crop',
    },
    {
      name: 'Ensalada César',
      price: 9500,
      cost: 4000,
      stock: 25,
      category: 'Comida',
      image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=400&fit=crop',
    },
    {
      name: 'Jugo Natural',
      price: 4500,
      cost: 2000,
      stock: 60,
      category: 'Bebidas',
      image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=400&fit=crop',
    },
    {
      name: 'Agua Mineral',
      price: 2000,
      cost: 800,
      stock: 120,
      category: 'Bebidas',
      image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
    },
  ];

  const createdProducts = [];
  for (const productData of demoProducts) {
    const { product } = await createProduct({
      name: productData.name,
      price: productData.price,
      cost: productData.cost,
      stock: productData.stock,
      category: productData.category,
      image: productData.image,
    });
    createdProducts.push(product);
  }

  console.log(`✅ ${createdProducts.length} productos de prueba creados`);

  return {
    success: true,
    products: createdProducts,
    message: `${createdProducts.length} productos de prueba creados`,
  };
}

// Helper function to build a local datetime ISO string with offset
function buildLocalDateTimeISO(dateString?: string): string {
  const now = new Date();

  if (!dateString) {
    return now.toISOString();
  }

  // Hora local actual
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  // Offset de zona horaria: getTimezoneOffset() devuelve minutos positivos para UTC-
  // Ej: UTC-5 → 300; UTC+2 → -120
  const tzOffset = now.getTimezoneOffset();
  const sign = tzOffset <= 0 ? '+' : '-';
  const absOffset = Math.abs(tzOffset);
  const offsetH = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetM = String(absOffset % 60).padStart(2, '0');
  const tzString = `${sign}${offsetH}:${offsetM}`;

  // Resultado: "2026-03-16T19:50:30.000-05:00"
  return `${dateString}T${hh}:${mm}:${ss}.${ms}${tzString}`;
}

/** Fecha `YYYY-MM-DD` + hora `HH:mm` (edición en Movimientos) → ISO con offset local. */
export function buildLocalDateTimeFromDateAndTime(dateStr: string, timeHHmm: string): string {
  const raw = (timeHHmm || '12:00').trim();
  const [h0, m0] = raw.split(':');
  const hh = String(Math.min(23, Math.max(0, parseInt(h0 || '12', 10) || 0))).padStart(2, '0');
  const mm = String(Math.min(59, Math.max(0, parseInt(m0 || '0', 10) || 0))).padStart(2, '0');
  const ss = '00';
  const ms = '000';
  const now = new Date();
  const tzOffset = now.getTimezoneOffset();
  const sign = tzOffset <= 0 ? '+' : '-';
  const absOffset = Math.abs(tzOffset);
  const offsetH = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetM = String(absOffset % 60).padStart(2, '0');
  const tzString = `${sign}${offsetH}:${offsetM}`;
  return `${dateStr}T${hh}:${mm}:${ss}.${ms}${tzString}`;
}