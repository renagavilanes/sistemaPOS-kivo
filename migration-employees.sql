-- =====================================================
-- MIGRACIÓN: Actualizar tabla EMPLOYEES
-- =====================================================

-- 1. Eliminar políticas RLS existentes para employees
DROP POLICY IF EXISTS "Users can view employees of their businesses" ON employees;
DROP POLICY IF EXISTS "Users can manage employees of their businesses" ON employees;

-- 2. Eliminar índices existentes
DROP INDEX IF EXISTS idx_employees_business;
DROP INDEX IF EXISTS idx_employees_active;
DROP INDEX IF EXISTS idx_employees_email;

-- 3. Alterar la tabla para renombrar y agregar columnas
-- Renombrar 'active' a 'is_active' si existe
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'active'
  ) THEN
    ALTER TABLE employees RENAME COLUMN active TO is_active;
  END IF;
END $$;

-- Agregar columna 'is_owner' si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'is_owner'
  ) THEN
    ALTER TABLE employees ADD COLUMN is_owner BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Cambiar el tipo de 'permissions' de array a JSONB si es necesario
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' 
    AND column_name = 'permissions' 
    AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE employees ALTER COLUMN permissions TYPE JSONB USING '{}';
  END IF;
END $$;

-- Asegurar que permissions sea JSONB con valor por defecto
ALTER TABLE employees ALTER COLUMN permissions SET DEFAULT '{}'::jsonb;

-- Actualizar el CHECK constraint para roles
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check 
  CHECK (role IN ('admin', 'manager', 'cashier', 'inventory', 'readonly'));

-- 4. Recrear índices con los nombres correctos
CREATE INDEX IF NOT EXISTS idx_employees_business ON employees(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(business_id, email);

-- 5. Recrear políticas RLS
CREATE POLICY "Users can view employees of their businesses" ON employees
    FOR SELECT USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

CREATE POLICY "Users can manage employees of their businesses" ON employees
    FOR ALL USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- 6. Mensaje de éxito
SELECT '✅ Migración de tabla employees completada exitosamente!' as status;
