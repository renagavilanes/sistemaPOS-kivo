-- =====================================================
-- FIX INFINITE RECURSION IN EMPLOYEES POLICIES
-- =====================================================

-- Eliminar políticas problemáticas de employees
DROP POLICY IF EXISTS "Users can view employees from their businesses" ON employees;
DROP POLICY IF EXISTS "Users can insert employees to their businesses" ON employees;
DROP POLICY IF EXISTS "Users can update employees from their businesses" ON employees;
DROP POLICY IF EXISTS "Users can delete employees from their businesses" ON employees;

-- Crear políticas SIMPLIFICADAS sin recursión
CREATE POLICY "Users can view employees from their businesses"
  ON employees FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can insert employees to their businesses"
  ON employees FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update employees from their businesses"
  ON employees FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete employees from their businesses"
  ON employees FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- ✅ FIX COMPLETADO
-- =====================================================
