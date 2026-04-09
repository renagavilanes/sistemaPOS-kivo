-- =====================================================
-- DESACTIVAR RLS TEMPORALMENTE (SOLO PARA DESARROLLO)
-- =====================================================
-- ⚠️ IMPORTANTE: Esto es SOLO para pruebas de desarrollo
-- NO uses esto en producción con datos reales

-- Desactivar RLS en todas las tablas
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;

-- Verificar que RLS esté desactivado
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('businesses', 'products', 'customers', 'sales', 'expenses', 'employees', 'categories')
ORDER BY tablename;

-- Deberías ver "false" en la columna rowsecurity para todas las tablas
