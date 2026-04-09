-- =====================================================
-- SCRIPT PARA VERIFICAR POLÍTICAS RLS
-- =====================================================
-- Ejecuta este script en el SQL Editor de Supabase
-- para verificar que las políticas RLS estén configuradas

-- 1. Ver todas las políticas RLS de la tabla businesses
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'businesses';

-- 2. Ver políticas de products
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'products';

-- 3. Ver políticas de customers
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'customers';

-- 4. Ver políticas de sales
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'sales';

-- 5. Ver políticas de expenses
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'expenses';

-- 6. Ver políticas de employees
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'employees';

-- 7. Ver políticas de categories
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'categories';

-- 8. Verificar si RLS está habilitado en cada tabla
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('businesses', 'products', 'customers', 'sales', 'expenses', 'employees', 'categories');

-- 9. SOLUCIÓN TEMPORAL: Desactivar RLS para pruebas
-- ⚠️ SOLO PARA DESARROLLO - NO USAR EN PRODUCCIÓN
-- Descomenta estas líneas si quieres desactivar RLS temporalmente:

-- ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE products DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE categories DISABLE ROW LEVEL SECURITY;

-- 10. Para reactivar RLS:
-- ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
