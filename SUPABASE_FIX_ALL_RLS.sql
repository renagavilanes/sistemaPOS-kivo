-- =====================================================
-- FIX TODAS LAS POLÍTICAS RLS - ELIMINAR RECURSIÓN
-- =====================================================
-- Este script simplifica TODAS las políticas para evitar recursión infinita
-- Solo verifica si el usuario es OWNER del negocio
-- =====================================================

-- =====================================================
-- EMPLOYEES - Sin recursión
-- =====================================================
DROP POLICY IF EXISTS "Users can view employees from their businesses" ON employees;
DROP POLICY IF EXISTS "Users can insert employees to their businesses" ON employees;
DROP POLICY IF EXISTS "Users can update employees from their businesses" ON employees;
DROP POLICY IF EXISTS "Users can delete employees from their businesses" ON employees;

CREATE POLICY "Users can view employees from their businesses"
  ON employees FOR SELECT
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can insert employees to their businesses"
  ON employees FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update employees from their businesses"
  ON employees FOR UPDATE
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can delete employees from their businesses"
  ON employees FOR DELETE
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- =====================================================
-- PRODUCTS - Solo owner
-- =====================================================
DROP POLICY IF EXISTS "Users can view products from their businesses" ON products;
DROP POLICY IF EXISTS "Users can insert products to their businesses" ON products;
DROP POLICY IF EXISTS "Users can update products from their businesses" ON products;
DROP POLICY IF EXISTS "Users can delete products from their businesses" ON products;

CREATE POLICY "Users can view products from their businesses"
  ON products FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert products to their businesses"
  ON products FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update products from their businesses"
  ON products FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete products from their businesses"
  ON products FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- =====================================================
-- CATEGORIES - Solo owner
-- =====================================================
DROP POLICY IF EXISTS "Users can view categories from their businesses" ON categories;
DROP POLICY IF EXISTS "Users can insert categories to their businesses" ON categories;
DROP POLICY IF EXISTS "Users can update categories from their businesses" ON categories;
DROP POLICY IF EXISTS "Users can delete categories from their businesses" ON categories;

CREATE POLICY "Users can view categories from their businesses"
  ON categories FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert categories to their businesses"
  ON categories FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update categories from their businesses"
  ON categories FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete categories from their businesses"
  ON categories FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- =====================================================
-- CUSTOMERS - Solo owner
-- =====================================================
DROP POLICY IF EXISTS "Users can view customers from their businesses" ON customers;
DROP POLICY IF EXISTS "Users can insert customers to their businesses" ON customers;
DROP POLICY IF EXISTS "Users can update customers from their businesses" ON customers;
DROP POLICY IF EXISTS "Users can delete customers from their businesses" ON customers;

CREATE POLICY "Users can view customers from their businesses"
  ON customers FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert customers to their businesses"
  ON customers FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update customers from their businesses"
  ON customers FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete customers from their businesses"
  ON customers FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- =====================================================
-- SALES - Solo owner
-- =====================================================
DROP POLICY IF EXISTS "Users can view sales from their businesses" ON sales;
DROP POLICY IF EXISTS "Users can insert sales to their businesses" ON sales;
DROP POLICY IF EXISTS "Users can update sales from their businesses" ON sales;
DROP POLICY IF EXISTS "Users can delete sales from their businesses" ON sales;

CREATE POLICY "Users can view sales from their businesses"
  ON sales FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert sales to their businesses"
  ON sales FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update sales from their businesses"
  ON sales FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete sales from their businesses"
  ON sales FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- =====================================================
-- EXPENSES - Solo owner
-- =====================================================
DROP POLICY IF EXISTS "Users can view expenses from their businesses" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses to their businesses" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses from their businesses" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses from their businesses" ON expenses;

CREATE POLICY "Users can view expenses from their businesses"
  ON expenses FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert expenses to their businesses"
  ON expenses FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update expenses from their businesses"
  ON expenses FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete expenses from their businesses"
  ON expenses FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- =====================================================
-- ✅ FIX COMPLETADO - TODAS LAS POLÍTICAS SIMPLIFICADAS
-- =====================================================
-- Ahora SOLO el owner del negocio tiene acceso
-- NO hay recursión infinita porque no consultamos employees
-- Los permisos granulares se verificarán en el frontend
-- =====================================================
