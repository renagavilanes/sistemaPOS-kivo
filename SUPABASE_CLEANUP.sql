-- =====================================================
-- SUPABASE CLEANUP SCRIPT
-- =====================================================
-- ⚠️ ESTE SCRIPT ELIMINARÁ TODAS LAS TABLAS EXISTENTES
-- ⚠️ EJECUTAR SOLO SI ESTÁS SEGURO
-- =====================================================
-- Ejecuta este script ANTES de ejecutar SUPABASE_SETUP.sql
-- =====================================================

-- Deshabilitar temporalmente las políticas RLS para poder eliminar las tablas
ALTER TABLE IF EXISTS sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employees DISABLE ROW LEVEL SECURITY;

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Users can view sales from their businesses" ON sales;
DROP POLICY IF EXISTS "Users can insert sales to their businesses" ON sales;
DROP POLICY IF EXISTS "Users can update sales from their businesses" ON sales;
DROP POLICY IF EXISTS "Users can delete sales from their businesses" ON sales;

DROP POLICY IF EXISTS "Users can view expenses from their businesses" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses to their businesses" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses from their businesses" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses from their businesses" ON expenses;

DROP POLICY IF EXISTS "Users can view customers from their businesses" ON customers;
DROP POLICY IF EXISTS "Users can insert customers to their businesses" ON customers;
DROP POLICY IF EXISTS "Users can update customers from their businesses" ON customers;
DROP POLICY IF EXISTS "Users can delete customers from their businesses" ON customers;

DROP POLICY IF EXISTS "Users can view products from their businesses" ON products;
DROP POLICY IF EXISTS "Users can insert products to their businesses" ON products;
DROP POLICY IF EXISTS "Users can update products from their businesses" ON products;
DROP POLICY IF EXISTS "Users can delete products from their businesses" ON products;

DROP POLICY IF EXISTS "Users can view categories from their businesses" ON categories;
DROP POLICY IF EXISTS "Users can insert categories to their businesses" ON categories;
DROP POLICY IF EXISTS "Users can update categories from their businesses" ON categories;
DROP POLICY IF EXISTS "Users can delete categories from their businesses" ON categories;

DROP POLICY IF EXISTS "Users can view employees from their businesses" ON employees;
DROP POLICY IF EXISTS "Users can insert employees to their businesses" ON employees;
DROP POLICY IF EXISTS "Users can update employees from their businesses" ON employees;
DROP POLICY IF EXISTS "Users can delete employees from their businesses" ON employees;

-- Eliminar triggers
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;

-- Eliminar funciones (con CASCADE para eliminar dependencias)
DROP FUNCTION IF EXISTS generate_sale_number(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Eliminar todas las tablas en orden inverso a las dependencias
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- =====================================================
-- ✅ CLEANUP COMPLETADO
-- =====================================================
-- Ahora puedes ejecutar SUPABASE_SETUP.sql para crear
-- las tablas con el esquema correcto.
-- =====================================================