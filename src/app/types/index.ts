// Types for the POS system

export type UserRole = 'basic' | 'advanced' | 'admin' | 'super_admin';

export interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  image?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  priceAtSale: number;
}

export interface Payment {
  id: string;
  method: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  amount: number;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  supplier?: string;
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  amount: number;
  notes?: string;
}

export type EmployeeRole = 'Administrador' | 'Gerente' | 'Cajero' | 'Inventario' | 'Solo lectura';

// Permisos específicos por módulo según funcionalidades reales
export interface SalesPermissions {
  view: boolean;      // Ver historial de ventas
  create: boolean;    // Realizar ventas (POS)
}

export interface ExpensesPermissions {
  view: boolean;      // Ver gastos registrados
  create: boolean;    // Registrar nuevos gastos
  edit: boolean;      // Editar gastos existentes
  delete: boolean;    // Eliminar gastos
}

export interface ProductsPermissions {
  view: boolean;      // Ver catálogo de productos
  create: boolean;    // Agregar productos
  edit: boolean;      // Modificar productos
  delete: boolean;    // Eliminar productos
}

export interface MovementsPermissions {
  view: boolean;      // Ver historial de transacciones
  edit: boolean;      // Ajustar/corregir transacciones
  cancel: boolean;    // Anular transacciones
}

export interface ReportsPermissions {
  view: boolean;      // Consultar reportes
  export: boolean;    // Exportar datos
}

export interface EmployeesPermissions {
  view: boolean;      // Ver empleados
  create: boolean;    // Crear empleados
  edit: boolean;      // Editar empleados
  delete: boolean;    // Eliminar empleados
}

export interface SettingsPermissions {
  access: boolean;    // Acceder a configuración
}

export interface ContactsPermissions {
  view: boolean;      // Ver lista de contactos
  create: boolean;    // Agregar nuevos contactos
  edit: boolean;      // Editar contactos existentes
}

export interface EmployeePermissions {
  sales: SalesPermissions;
  expenses: ExpensesPermissions;
  products: ProductsPermissions;
  movements: MovementsPermissions;
  reports: ReportsPermissions;
  employees: EmployeesPermissions;
  settings: SettingsPermissions;
  contacts: ContactsPermissions;
}

export interface Employee {
  id: string;
  userId?: string; // user_id en auth.users (null si no ha aceptado la invitación)
  name: string;
  email: string;
  phone?: string;
  role: EmployeeRole;
  permissions: EmployeePermissions;
  isActive: boolean;
  isOwner?: boolean;
  createdAt: string;
}