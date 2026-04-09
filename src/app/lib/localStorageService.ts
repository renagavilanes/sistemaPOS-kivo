// Local Storage Service - Sistema completamente offline
// Simula toda la funcionalidad sin backend

import { persistCurrentBusinessId } from './businessSelectionStorage';

interface User {
  id: string;
  email: string;
  businessName: string;
  ownerName?: string;
  phone?: string;
  password?: string; // Contraseña almacenada (en un sistema real, esto sería hashed)
  created_at: string;
}

interface Session {
  access_token: string;
  user: User;
}

interface Business {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  country: string;
  currency: string;
  timezone: string;
  logo_url: string | null;
  active: boolean;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: string;
  business_id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  stock_min: number;
  category: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  credit_limit: number;
  credit_balance: number;
  type: 'customer' | 'supplier' | 'both'; // Tipo: Cliente, Proveedor, o Ambos
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Employee {
  id: string;
  business_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  permissions: any;
  is_active: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

interface Sale {
  id: string;
  business_id: string;
  employee_id: string | null;
  employee_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  items: any[];
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  total: number;
  payment_type: string;
  payments: any[];
  notes: string | null;
  sale_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Expense {
  id: string;
  business_id: string;
  employee_id: string | null;
  employee_name: string | null;
  date: string;
  category: string;
  supplier: string | null;
  payment_method: string;
  amount: number;
  notes: string | null;
  status: string; // 'paid' or 'pending'
  created_at: string;
  updated_at: string;
}

// Utility functions
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getFromStorage<T>(key: string): T | null {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

function saveToStorage<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ==================== AUTH ====================

/** Solo en desarrollo: bypass de login local (nunca en build de producción). */
const DEV_MASTER_CODE = import.meta.env.DEV ? '999999' : '';

export function getCurrentSession(): Session | null {
  return getFromStorage<Session>('pos_session');
}

export function setCurrentSession(session: Session): void {
  saveToStorage('pos_session', session);
}

export function clearCurrentSession(): void {
  localStorage.removeItem('pos_session');
}

export function getSavedAccounts(): User[] {
  return getFromStorage<User[]>('pos_saved_accounts') || [];
}

export function saveAccount(user: User): void {
  const accounts = getSavedAccounts();
  const existingIndex = accounts.findIndex(a => a.email === user.email);
  if (existingIndex >= 0) {
    // Update existing account
    accounts[existingIndex] = user;
  } else {
    // Add new account
    accounts.push(user);
  }
  saveToStorage('pos_saved_accounts', accounts);
}

export function removeAccount(email: string): void {
  const accounts = getSavedAccounts();
  const filtered = accounts.filter(a => a.email !== email);
  saveToStorage('pos_saved_accounts', filtered);
}

export function registerUser(businessName: string, email: string, password: string, phone?: string, ownerName?: string): User {
  const accounts = getSavedAccounts();
  const existingUser = accounts.find(a => a.email === email);
  
  if (existingUser) {
    throw new Error('Ya existe una cuenta con este email');
  }

  const user: User = {
    id: generateId(),
    email,
    businessName,
    ownerName,
    phone,
    password, // En un sistema real, esto sería un hash
    created_at: new Date().toISOString(),
  };

  const session: Session = {
    access_token: generateId(),
    user,
  };

  setCurrentSession(session);
  saveAccount(user);

  return user;
}

export function loginUser(email: string, password: string): Session | null {
  if (import.meta.env.DEV) {
    console.log('🔐 Intentando login (local):', email);
  }
  
  // Check master code bypass (solo DEV)
  if (DEV_MASTER_CODE && password === DEV_MASTER_CODE) {
    console.log('✅ Código maestro detectado - acceso concedido');
    const accounts = getSavedAccounts();
    const user = accounts.find(a => a.email === email);
    
    if (!user) {
      console.log('❌ Usuario no encontrado con email:', email);
      return null;
    }

    const session: Session = {
      access_token: generateId(),
      user,
    };

    setCurrentSession(session);
    return session;
  }

  // Normal authentication
  const accounts = getSavedAccounts();
  const user = accounts.find(a => a.email === email);
  
  if (!user) {
    console.log('❌ Usuario no encontrado');
    return null;
  }

  // Validate password
  if (user.password !== password) {
    console.log('❌ Contraseña incorrecta');
    return null;
  }

  console.log('✅ Login exitoso');

  const session: Session = {
    access_token: generateId(),
    user,
  };

  setCurrentSession(session);
  return session;
}

// Complete registration: creates user AND business
export function register(email: string, password: string, businessName: string, ownerName?: string, phone?: string): {
  success: boolean;
  user?: User;
  business?: Business;
  session?: Session;
  error?: string;
} {
  try {
    console.log('📝 Registrando usuario:', { email, businessName });

    // Check if user already exists
    const accounts = getSavedAccounts();
    const existingUser = accounts.find(a => a.email === email);
    if (existingUser) {
      return {
        success: false,
        error: 'Ya existe una cuenta con este email',
      };
    }

    // Create user
    const user: User = {
      id: generateId(),
      email,
      businessName,
      ownerName,
      phone,
      password, // En un sistema real, esto sería un hash
      created_at: new Date().toISOString(),
    };

    // Create session
    const session: Session = {
      access_token: generateId(),
      user,
    };

    // Save session
    setCurrentSession(session);
    saveAccount(user);

    console.log('✅ Usuario creado:', user.id);

    // Create business
    const business = createBusiness(user.id, {
      name: businessName,
      email: email,
      phone: phone,
      userEmail: email,
      userName: ownerName || businessName,
    });

    console.log('✅ Negocio creado:', business.id);

    // Set as current business
    persistCurrentBusinessId(user.id, business.id);

    return {
      success: true,
      user,
      business,
      session,
    };
  } catch (error: any) {
    console.error('❌ Error en register:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar usuario',
    };
  }
}

// ==================== BUSINESSES ====================

export function getBusinesses(userId: string): Business[] {
  const allBusinesses = getFromStorage<Business[]>('pos_businesses') || [];
  const userBusinesses = allBusinesses.filter(b => b.owner_id === userId && b.active);
  
  // 🔧 Sincronizar con datos guardados individualmente para cada negocio
  const businesses = userBusinesses.map(business => {
    const individualData = getFromStorage<any>(`business_${business.id}`);
    if (individualData) {
      // Merge data from individual storage (includes logo and other settings)
      return {
        ...business,
        ...individualData,
        id: business.id, // Preserve original ID
        owner_id: business.owner_id, // Preserve owner
        active: business.active, // Preserve active status
        created_at: business.created_at, // Preserve creation date
      };
    }
    return business;
  });

  // ✅ ORDENAR POR FECHA DE CREACIÓN (más antiguo primero)
  return businesses.sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function getBusiness(businessId: string, userId: string): Business | null {
  const businesses = getBusinesses(userId);
  return businesses.find(b => b.id === businessId) || null;
}

export function createBusiness(userId: string, data: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  country?: string;
  currency?: string;
  userEmail?: string;
  userName?: string;
}): Business {
  const allBusinesses = getFromStorage<Business[]>('pos_businesses') || [];
  
  const business: Business = {
    id: generateId(),
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || null,
    tax_id: data.tax_id || null,
    country: data.country || 'CO',
    currency: data.currency || 'COP',
    timezone: 'America/Bogota',
    logo_url: null,
    active: true,
    owner_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  allBusinesses.push(business);
  saveToStorage('pos_businesses', allBusinesses);
  
  // 🔧 También guardar en el almacenamiento individual
  saveToStorage(`business_${business.id}`, business);

  // 🔧 Crear empleado Admin automáticamente
  if (data.userEmail) {
    console.log('👤 Creando empleado Admin para el propietario...');
    createEmployee(business.id, {
      name: data.userName || data.name,
      email: data.userEmail,
      phone: data.phone,
      role: 'admin',
      permissions: ADMIN_PERMISSIONS,
      isOwner: true
    });
  }

  return business;
}

export function updateBusiness(businessId: string, userId: string, updates: Partial<Business>): Business {
  const allBusinesses = getFromStorage<Business[]>('pos_businesses') || [];
  const index = allBusinesses.findIndex(b => b.id === businessId && b.owner_id === userId);
  
  if (index === -1) throw new Error('Business not found');

  allBusinesses[index] = {
    ...allBusinesses[index],
    ...updates,
    id: businessId,
    owner_id: userId,
    updated_at: new Date().toISOString(),
  };

  saveToStorage('pos_businesses', allBusinesses);
  
  // 🔧 También actualizar en el almacenamiento individual
  const individualData = getFromStorage<any>(`business_${businessId}`) || {};
  const updatedIndividual = {
    ...individualData,
    ...allBusinesses[index]
  };
  saveToStorage(`business_${businessId}`, updatedIndividual);
  
  return allBusinesses[index];
}

export function deleteBusiness(businessId: string, userId: string): Business {
  return updateBusiness(businessId, userId, { active: false });
}

// ==================== EMPLOYEES ====================

// Permisos completos para rol Admin
const ADMIN_PERMISSIONS = {
  sales: { create: true, view: true, edit: true, cancel: true },
  expenses: { create: true, view: true, edit: true, cancel: true },
  products: { create: true, view: true, edit: true, delete: true },
  movements: { view: true, edit: true, cancel: true },
  reports: { view: true, export: true },
  employees: { view: true, create: true, edit: true, delete: true },
  settings: { access: true }
};

export function getEmployees(businessId: string): Employee[] {
  const allEmployees = getFromStorage<Employee[]>('pos_employees') || [];
  return allEmployees.filter(e => e.business_id === businessId && e.is_active);
}

export function getEmployeeByEmail(businessId: string, email: string): Employee | null {
  const employees = getEmployees(businessId);
  return employees.find(e => e.email.toLowerCase() === email.toLowerCase()) || null;
}

export function createEmployee(businessId: string, data: {
  name: string;
  email: string;
  phone?: string;
  role: string;
  permissions: any;
  isOwner?: boolean;
}): Employee {
  const allEmployees = getFromStorage<Employee[]>('pos_employees') || [];
  
  const employee: Employee = {
    id: generateId(),
    business_id: businessId,
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    role: data.role,
    permissions: data.permissions,
    is_active: true,
    is_owner: data.isOwner || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  allEmployees.push(employee);
  saveToStorage('pos_employees', allEmployees);

  console.log('👤 Empleado creado:', employee.name, '(', employee.email, ')');
  return employee;
}

export function updateEmployee(employeeId: string, businessId: string, updates: Partial<Employee>): Employee {
  const allEmployees = getFromStorage<Employee[]>('pos_employees') || [];
  const index = allEmployees.findIndex(e => e.id === employeeId && e.business_id === businessId);
  
  if (index === -1) throw new Error('Employee not found');

  allEmployees[index] = {
    ...allEmployees[index],
    ...updates,
    id: employeeId,
    business_id: businessId,
    updated_at: new Date().toISOString(),
  };

  saveToStorage('pos_employees', allEmployees);
  return allEmployees[index];
}

export function deleteEmployee(employeeId: string, businessId: string): void {
  const allEmployees = getFromStorage<Employee[]>('pos_employees') || [];
  const employee = allEmployees.find(e => e.id === employeeId && e.business_id === businessId);
  
  if (!employee) throw new Error('Employee not found');
  if (employee.is_owner) throw new Error('Cannot delete owner employee');
  
  const index = allEmployees.findIndex(e => e.id === employeeId);
  if (index !== -1) {
    allEmployees[index].is_active = false;
    allEmployees[index].updated_at = new Date().toISOString();
    saveToStorage('pos_employees', allEmployees);
  }
}

// ==================== PRODUCTS ====================

export function getProducts(businessId: string): Product[] {
  const allProducts = getFromStorage<Product[]>('pos_products') || [];
  return allProducts.filter(p => p.business_id === businessId && p.active);
}

export function getProduct(productId: string, businessId: string): Product | null {
  const products = getProducts(businessId);
  return products.find(p => p.id === productId) || null;
}

export function createProduct(businessId: string, data: {
  name: string;
  price: number;
  cost: number;
  stock?: number;
  stock_min?: number;
  category?: string;
  sku?: string;
  barcode?: string;
  image_url?: string;
}): Product {
  const allProducts = getFromStorage<Product[]>('pos_products') || [];

  const product: Product = {
    id: generateId(),
    business_id: businessId,
    name: data.name,
    price: data.price,
    cost: data.cost || 0,
    stock: data.stock || 0,
    stock_min: data.stock_min || 0,
    category: data.category || 'Otros',
    sku: data.sku || null,
    barcode: data.barcode || null,
    image_url: data.image_url || null,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  allProducts.push(product);
  saveToStorage('pos_products', allProducts);

  return product;
}

export function updateProduct(productId: string, businessId: string, updates: Partial<Product>): Product {
  const allProducts = getFromStorage<Product[]>('pos_products') || [];
  const index = allProducts.findIndex(p => p.id === productId && p.business_id === businessId);
  
  if (index === -1) throw new Error('Product not found');

  allProducts[index] = {
    ...allProducts[index],
    ...updates,
    id: productId,
    business_id: businessId,
    updated_at: new Date().toISOString(),
  };

  saveToStorage('pos_products', allProducts);
  return allProducts[index];
}

export function deleteProduct(productId: string, businessId: string): void {
  const allProducts = getFromStorage<Product[]>('pos_products') || [];
  const filtered = allProducts.filter(p => !(p.id === productId && p.business_id === businessId));
  saveToStorage('pos_products', filtered);
}

// ==================== CUSTOMERS ====================

export function getCustomers(businessId: string): Customer[] {
  const allCustomers = getFromStorage<Customer[]>('pos_customers') || [];
  return allCustomers.filter(c => c.business_id === businessId && c.active);
}

export function getCustomer(customerId: string, businessId: string): Customer | null {
  const customers = getCustomers(businessId);
  return customers.find(c => c.id === customerId) || null;
}

export function createCustomer(businessId: string, data: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  credit_limit?: number;
  type?: 'customer' | 'supplier' | 'both';
}): Customer {
  const allCustomers = getFromStorage<Customer[]>('pos_customers') || [];

  const customer: Customer = {
    id: generateId(),
    business_id: businessId,
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || null,
    tax_id: data.tax_id || null,
    credit_limit: data.credit_limit || 0,
    credit_balance: 0,
    type: data.type || 'customer',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  allCustomers.push(customer);
  saveToStorage('pos_customers', allCustomers);

  return customer;
}

export function updateCustomer(customerId: string, businessId: string, updates: Partial<Customer>): Customer {
  const allCustomers = getFromStorage<Customer[]>('pos_customers') || [];
  const index = allCustomers.findIndex(c => c.id === customerId && c.business_id === businessId);
  
  if (index === -1) throw new Error('Customer not found');

  allCustomers[index] = {
    ...allCustomers[index],
    ...updates,
    id: customerId,
    business_id: businessId,
    updated_at: new Date().toISOString(),
  };

  saveToStorage('pos_customers', allCustomers);
  return allCustomers[index];
}

export function deleteCustomer(customerId: string, businessId: string): void {
  const allCustomers = getFromStorage<Customer[]>('pos_customers') || [];
  const index = allCustomers.findIndex(c => c.id === customerId && c.business_id === businessId);
  
  if (index === -1) throw new Error('Customer not found');
  
  // Soft delete
  allCustomers[index].active = false;
  allCustomers[index].updated_at = new Date().toISOString();
  
  saveToStorage('pos_customers', allCustomers);
}

// Get only customers (type = 'customer' or 'both')
export function getCustomersOnly(businessId: string): Customer[] {
  const allCustomers = getFromStorage<Customer[]>('pos_customers') || [];
  return allCustomers.filter(c => 
    c.business_id === businessId && 
    c.active && 
    (c.type === 'customer' || c.type === 'both')
  );
}

// Get only suppliers (type = 'supplier' or 'both')
export function getSuppliersOnly(businessId: string): Customer[] {
  const allCustomers = getFromStorage<Customer[]>('pos_customers') || [];
  return allCustomers.filter(c => 
    c.business_id === businessId && 
    c.active && 
    (c.type === 'supplier' || c.type === 'both')
  );
}

// ==================== SALES ====================

export function getSales(businessId: string): Sale[] {
  const allSales = getFromStorage<Sale[]>('pos_sales') || [];
  return allSales.filter(s => s.business_id === businessId);
}

export function createSale(businessId: string, data: {
  cartItems: any[];
  total: number;
  paymentType: string;
  payments: any[];
  client?: any;
  employee?: { id: string; name: string; email: string };
  saleDate?: string;
  receiptNote?: string;
  discount?: { percent: number; amount: number };
}): Sale {
  const allSales = getFromStorage<Sale[]>('pos_sales') || [];

  // Transform cartItems to flatten the structure and include all necessary data
  const items = data.cartItems.map(cartItem => ({
    id: cartItem.product.id,
    name: cartItem.product.name,
    quantity: cartItem.quantity,
    price: cartItem.priceAtSale,
    cost: cartItem.product.cost,
    image_url: cartItem.product.image,
    category: cartItem.product.category
  }));

  console.log('📦 Items transformados para guardar:', items);

  // Transform payment methods from Spanish to English codes
  const paymentMethodMap: Record<string, string> = {
    'Efectivo': 'cash',
    'Tarjeta': 'card',
    'Transferencia': 'transfer',
    'Otros': 'other'
  };

  // Transform payment type from Spanish to English
  const paymentTypeMap: Record<string, string> = {
    'pagada': 'cash', // default for single payment
    'credito': 'credit'
  };

  // Determine the main payment_type based on number of payments and type
  let mainPaymentType = 'cash';
  if (data.paymentType === 'credito') {
    mainPaymentType = 'credit';
  } else if (data.payments && data.payments.length > 1) {
    mainPaymentType = 'multiple';
  } else if (data.payments && data.payments.length === 1) {
    mainPaymentType = paymentMethodMap[data.payments[0].method] || 'cash';
  }

  // Transform payments array to use English codes
  const transformedPayments = data.payments?.map(payment => ({
    ...payment,
    method: paymentMethodMap[payment.method] || payment.method
  })) || [];

  console.log('💳 Método de pago transformado:', {
    original: data.paymentType,
    payments: data.payments,
    mainPaymentType,
    transformedPayments
  });

  // Combine saleDate with current time in local timezone
  let finalSaleDate: string;
  if (data.saleDate) {
    // If saleDate is provided (YYYY-MM-DD), combine it with current local time
    const dateOnly = data.saleDate.split('T')[0]; // Ensure we only have YYYY-MM-DD
    const now = new Date();
    // Create date in local timezone
    const localDate = new Date(dateOnly + 'T' + 
      now.getHours().toString().padStart(2, '0') + ':' +
      now.getMinutes().toString().padStart(2, '0') + ':' +
      now.getSeconds().toString().padStart(2, '0'));
    finalSaleDate = localDate.toISOString();
  } else {
    // Use current date and time
    finalSaleDate = new Date().toISOString();
  }

  console.log('📅 Fecha de venta final:', {
    original: data.saleDate,
    final: finalSaleDate
  });

  const sale: Sale = {
    id: generateId(),
    business_id: businessId,
    employee_id: data.employee?.id || null,
    employee_name: data.employee?.name || null,
    customer_id: data.client?.id || null,
    customer_name: data.client?.name || null,
    items: items,
    subtotal: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    discount_percent: data.discount?.percent || 0,
    discount_amount: data.discount?.amount || 0,
    total: data.total,
    payment_type: mainPaymentType,
    payments: transformedPayments,
    notes: data.receiptNote || null,
    sale_date: finalSaleDate,
    status: data.paymentType === 'credito' ? 'pending' : 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Update product stock
  const allProducts = getFromStorage<Product[]>('pos_products') || [];
  data.cartItems.forEach(cartItem => {
    const productIndex = allProducts.findIndex(p => p.id === cartItem.product.id && p.business_id === businessId);
    if (productIndex !== -1) {
      allProducts[productIndex].stock -= cartItem.quantity;
      allProducts[productIndex].updated_at = new Date().toISOString();
    }
  });
  saveToStorage('pos_products', allProducts);

  // Update customer credit if applicable
  if (data.paymentType === 'credito' && data.client?.id) {
    const allCustomers = getFromStorage<Customer[]>('pos_customers') || [];
    const customerIndex = allCustomers.findIndex(c => c.id === data.client.id && c.business_id === businessId);
    if (customerIndex !== -1) {
      allCustomers[customerIndex].credit_balance += data.total;
      allCustomers[customerIndex].updated_at = new Date().toISOString();
      saveToStorage('pos_customers', allCustomers);
    }
  }

  allSales.push(sale);
  saveToStorage('pos_sales', allSales);

  return sale;
}

// ==================== EXPENSES ====================

export function getExpenses(businessId: string): Expense[] {
  const allExpenses = getFromStorage<Expense[]>('pos_expenses') || [];
  return allExpenses.filter(e => e.business_id === businessId);
}

export function createExpense(businessId: string, data: {
  date: string;
  category: string;
  supplier?: string;
  paymentMethod: string;
  amount: number;
  notes?: string;
  status?: string; // 'paid' or 'pending'
  employee?: { id: string; name: string; email: string };
}): Expense {
  const allExpenses = getFromStorage<Expense[]>('pos_expenses') || [];

  // Transform payment methods from Spanish to English codes
  const paymentMethodMap: Record<string, string> = {
    'Efectivo': 'cash',
    'Tarjeta': 'card',
    'Transferencia': 'transfer',
    'Otros': 'other',
    '-': '-',
  };

  const transformedPaymentMethod = paymentMethodMap[data.paymentMethod] || data.paymentMethod.toLowerCase();

  console.log('💳 Método de pago transformado (gasto):', {
    original: data.paymentMethod,
    transformed: transformedPaymentMethod
  });

  // Combine date with current time in local timezone
  let finalExpenseDate: string;
  if (data.date) {
    // If date is provided (YYYY-MM-DD), combine it with current local time
    const dateOnly = data.date.split('T')[0]; // Ensure we only have YYYY-MM-DD
    const now = new Date();
    // Create date in local timezone
    const localDate = new Date(dateOnly + 'T' + 
      now.getHours().toString().padStart(2, '0') + ':' +
      now.getMinutes().toString().padStart(2, '0') + ':' +
      now.getSeconds().toString().padStart(2, '0'));
    finalExpenseDate = localDate.toISOString();
  } else {
    // Use current date and time
    finalExpenseDate = new Date().toISOString();
  }

  console.log('📅 Fecha de gasto final:', {
    original: data.date,
    final: finalExpenseDate
  });

  console.log('🟣 localStorageService - Recibiendo data.notes:', {
    dataNotes: data.notes,
    dataCategory: data.category,
    fullData: data
  });

  const expense: Expense = {
    id: generateId(),
    business_id: businessId,
    employee_id: data.employee?.id || null,
    employee_name: data.employee?.name || null,
    date: finalExpenseDate,
    category: data.category,
    supplier: data.supplier || null,
    payment_method: transformedPaymentMethod,
    amount: data.amount,
    notes: data.notes || null,
    status: data.status || 'paid', // Default to 'paid' if not specified
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log('📝 Guardando gasto en localStorage:', {
    category: expense.category,
    notes: expense.notes,
    amount: expense.amount,
    fullExpense: expense
  });

  allExpenses.push(expense);
  saveToStorage('pos_expenses', allExpenses);

  return expense;
}

// ==================== MOVEMENTS ====================

export function getMovements(businessId: string) {
  const sales = getSales(businessId);
  const expenses = getExpenses(businessId);

  const movements = [
    ...sales.map(s => ({ ...s, type: 'sale' })),
    ...expenses.map(e => ({ ...e, type: 'expense' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return { movements, sales, expenses };
}

export function updateSale(saleId: string, businessId: string, updates: Partial<Sale>): Sale | null {
  const allSales = getFromStorage<Sale[]>('pos_sales') || [];
  const saleIndex = allSales.findIndex(s => s.id === saleId && s.business_id === businessId);
  
  if (saleIndex === -1) {
    console.error('❌ Venta no encontrada:', saleId);
    return null;
  }
  
  const updatedSale = {
    ...allSales[saleIndex],
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  allSales[saleIndex] = updatedSale;
  saveToStorage('pos_sales', allSales);
  console.log('✅ Venta actualizada:', saleId);
  
  return updatedSale;
}

export function deleteSale(saleId: string, businessId: string): void {
  const allSales = getFromStorage<Sale[]>('pos_sales') || [];
  const filteredSales = allSales.filter(s => !(s.id === saleId && s.business_id === businessId));
  saveToStorage('pos_sales', filteredSales);
  console.log('🗑️ Venta eliminada:', saleId);
}

export function updateExpense(expenseId: string, businessId: string, updates: Partial<Expense>): Expense | null {
  const allExpenses = getFromStorage<Expense[]>('pos_expenses') || [];
  const expenseIndex = allExpenses.findIndex(e => e.id === expenseId && e.business_id === businessId);
  
  if (expenseIndex === -1) {
    console.error('❌ Gasto no encontrado:', expenseId);
    return null;
  }
  
  const updatedExpense = {
    ...allExpenses[expenseIndex],
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  allExpenses[expenseIndex] = updatedExpense;
  saveToStorage('pos_expenses', allExpenses);
  console.log('✅ Gasto actualizado:', expenseId);
  
  return updatedExpense;
}

export function deleteExpense(expenseId: string, businessId: string): void {
  const allExpenses = getFromStorage<Expense[]>('pos_expenses') || [];
  const filteredExpenses = allExpenses.filter(e => !(e.id === expenseId && e.business_id === businessId));
  saveToStorage('pos_expenses', filteredExpenses);
  console.log('🗑️ Gasto eliminado:', expenseId);
}

export function deleteAllMovements(businessId: string): void {
  const allSales = getFromStorage<Sale[]>('pos_sales') || [];
  const allExpenses = getFromStorage<Expense[]>('pos_expenses') || [];
  
  const filteredSales = allSales.filter(s => s.business_id !== businessId);
  const filteredExpenses = allExpenses.filter(e => e.business_id !== businessId);
  
  saveToStorage('pos_sales', filteredSales);
  saveToStorage('pos_expenses', filteredExpenses);
  
  console.log('🗑️ Todos los movimientos eliminados para negocio:', businessId);
}