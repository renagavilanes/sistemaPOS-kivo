-- =====================================================
-- SCRIPT DE CORRECCIÓN V2 - MÁS ROBUSTO
-- =====================================================
-- Este script agrega las columnas faltantes de forma segura
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- =====================================================

-- 1. Agregar columnas a SALES (si no existen)
DO $$ 
BEGIN
    -- payment_method
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE sales ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'Efectivo';
        RAISE NOTICE '✅ Columna payment_method agregada a sales';
    ELSE
        RAISE NOTICE '⚠️ Columna payment_method ya existe en sales';
    END IF;

    -- paid_amount
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'paid_amount'
    ) THEN
        ALTER TABLE sales ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE '✅ Columna paid_amount agregada a sales';
    ELSE
        RAISE NOTICE '⚠️ Columna paid_amount ya existe en sales';
    END IF;

    -- items (JSONB)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'items'
    ) THEN
        ALTER TABLE sales ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE '✅ Columna items agregada a sales';
    ELSE
        RAISE NOTICE '⚠️ Columna items ya existe en sales';
    END IF;
END $$;

-- 2. Agregar columna a CUSTOMERS (si no existe)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'current_balance'
    ) THEN
        ALTER TABLE customers ADD COLUMN current_balance DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE '✅ Columna current_balance agregada a customers';
    ELSE
        RAISE NOTICE '⚠️ Columna current_balance ya existe en customers';
    END IF;
END $$;

-- 3. Agregar columna a EXPENSES (si no existe)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'expense_number'
    ) THEN
        ALTER TABLE expenses ADD COLUMN expense_number TEXT UNIQUE;
        RAISE NOTICE '✅ Columna expense_number agregada a expenses';
    ELSE
        RAISE NOTICE '⚠️ Columna expense_number ya existe en expenses';
    END IF;
END $$;

-- 4. Crear función para generar números de gasto (si no existe)
CREATE OR REPLACE FUNCTION generate_expense_number(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expense_count INTEGER;
  expense_number TEXT;
  today_date TEXT;
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  SELECT COUNT(*) INTO expense_count
  FROM expenses
  WHERE business_id = p_business_id
    AND DATE(created_at) = CURRENT_DATE;
  
  expense_number := 'EXP-' || today_date || '-' || LPAD((expense_count + 1)::TEXT, 4, '0');
  
  RETURN expense_number;
END;
$$;

-- 5. Eliminar constraint restrictivo de role en EMPLOYEES
DO $$ 
BEGIN
    -- Verificar si existe el constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'employees_role_check' AND table_name = 'employees'
    ) THEN
        ALTER TABLE employees DROP CONSTRAINT employees_role_check;
        RAISE NOTICE '✅ Constraint employees_role_check eliminado';
    ELSE
        RAISE NOTICE '⚠️ Constraint employees_role_check no existe';
    END IF;
END $$;

-- 6. REEMPLAZAR políticas RLS de EMPLOYEES (eliminar recursión)
DROP POLICY IF EXISTS "employees_select" ON employees;
DROP POLICY IF EXISTS "employees_insert" ON employees;
DROP POLICY IF EXISTS "employees_update" ON employees;
DROP POLICY IF EXISTS "employees_delete" ON employees;

-- Política SELECT: Ver empleados de sus negocios
CREATE POLICY "employees_select" ON employees
FOR SELECT
USING (
  business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  )
);

-- Política INSERT: Propietarios pueden agregar empleados
CREATE POLICY "employees_insert" ON employees
FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  )
);

-- Política UPDATE: Propietarios pueden editar empleados
CREATE POLICY "employees_update" ON employees
FOR UPDATE
USING (
  business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  )
);

-- Política DELETE: Propietarios pueden eliminar empleados
CREATE POLICY "employees_delete" ON employees
FOR DELETE
USING (
  business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  )
);

-- =====================================================
-- ✅ SCRIPT V2 COMPLETADO
-- =====================================================
-- Deberías ver mensajes como:
-- ✅ Columna payment_method agregada a sales
-- ✅ Columna paid_amount agregada a sales
-- ✅ Columna items agregada a sales
-- ✅ Columna current_balance agregada a customers
-- ✅ Columna expense_number agregada a expenses
-- ✅ Constraint employees_role_check eliminado
-- =====================================================
