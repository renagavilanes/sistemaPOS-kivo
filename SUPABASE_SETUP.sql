-- =====================================================
-- SUPABASE SETUP SCRIPT - SISTEMA POS
-- =====================================================
-- Ejecuta este script completo en Supabase Dashboard > SQL Editor
-- =====================================================

-- =====================================================
-- PARTE 1: CREAR TODAS LAS TABLAS (sin políticas RLS)
-- =====================================================

-- 0. TABLA: businesses
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  tax_id TEXT,
  currency TEXT DEFAULT 'COP',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);

-- 1. TABLA: employees
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_owner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_business_id ON employees(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(business_id, email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_unique_active 
  ON employees(business_id, user_id) 
  WHERE user_id IS NOT NULL AND is_active = true;

-- 2. TABLA: products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  image TEXT,
  barcode TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(business_id, category);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- 3. TABLA: categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_business_id ON categories(business_id);

-- 4. TABLA: customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  contact_type TEXT NOT NULL DEFAULT 'customer' CHECK (contact_type IN ('customer', 'supplier', 'both')),
  credit_limit DECIMAL(10,2) DEFAULT 0,
  current_balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(business_id, email) WHERE email IS NOT NULL;

-- 5. TABLA: sales
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  sale_number TEXT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'pending', 'partial')),
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  change_amount DECIMAL(10,2) DEFAULT 0,
  items JSONB NOT NULL,
  payments JSONB,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_sale_number ON sales(business_id, sale_number);

-- 6. TABLA: expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'paid',
  receipt_image TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(business_id, category);

-- =====================================================
-- PARTE 2: HABILITAR RLS Y CREAR POLÍTICAS
-- =====================================================

-- RLS para businesses
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own businesses" ON businesses;
CREATE POLICY "Users can view their own businesses"
  ON businesses FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own businesses" ON businesses;
CREATE POLICY "Users can insert their own businesses"
  ON businesses FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own businesses" ON businesses;
CREATE POLICY "Users can update their own businesses"
  ON businesses FOR UPDATE
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own businesses" ON businesses;
CREATE POLICY "Users can delete their own businesses"
  ON businesses FOR DELETE
  USING (owner_id = auth.uid());

-- RLS para employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view employees from their businesses" ON employees;
CREATE POLICY "Users can view employees from their businesses"
  ON employees FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'employees'->>'view')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can insert employees to their businesses" ON employees;
CREATE POLICY "Users can insert employees to their businesses"
  ON employees FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'employees'->>'create')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can update employees from their businesses" ON employees;
CREATE POLICY "Users can update employees from their businesses"
  ON employees FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'employees'->>'edit')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can delete employees from their businesses" ON employees;
CREATE POLICY "Users can delete employees from their businesses"
  ON employees FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'employees'->>'delete')::boolean = true
    )
  );

-- RLS para products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view products from their businesses" ON products;
CREATE POLICY "Users can view products from their businesses"
  ON products FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can insert products to their businesses" ON products;
CREATE POLICY "Users can insert products to their businesses"
  ON products FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'products'->>'create')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can update products from their businesses" ON products;
CREATE POLICY "Users can update products from their businesses"
  ON products FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'products'->>'edit')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can delete products from their businesses" ON products;
CREATE POLICY "Users can delete products from their businesses"
  ON products FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'products'->>'delete')::boolean = true
    )
  );

-- RLS para categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view categories from their businesses" ON categories;
CREATE POLICY "Users can view categories from their businesses"
  ON categories FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can insert categories to their businesses" ON categories;
CREATE POLICY "Users can insert categories to their businesses"
  ON categories FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update categories from their businesses" ON categories;
CREATE POLICY "Users can update categories from their businesses"
  ON categories FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete categories from their businesses" ON categories;
CREATE POLICY "Users can delete categories from their businesses"
  ON categories FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- RLS para customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view customers from their businesses" ON customers;
CREATE POLICY "Users can view customers from their businesses"
  ON customers FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can insert customers to their businesses" ON customers;
CREATE POLICY "Users can insert customers to their businesses"
  ON customers FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'sales'->>'create')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can update customers from their businesses" ON customers;
CREATE POLICY "Users can update customers from their businesses"
  ON customers FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can delete customers from their businesses" ON customers;
CREATE POLICY "Users can delete customers from their businesses"
  ON customers FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- RLS para sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view sales from their businesses" ON sales;
CREATE POLICY "Users can view sales from their businesses"
  ON sales FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'sales'->>'view')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can insert sales to their businesses" ON sales;
CREATE POLICY "Users can insert sales to their businesses"
  ON sales FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'sales'->>'create')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can update sales from their businesses" ON sales;
CREATE POLICY "Users can update sales from their businesses"
  ON sales FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete sales from their businesses" ON sales;
CREATE POLICY "Users can delete sales from their businesses"
  ON sales FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- RLS para expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view expenses from their businesses" ON expenses;
CREATE POLICY "Users can view expenses from their businesses"
  ON expenses FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'expenses'->>'view')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can insert expenses to their businesses" ON expenses;
CREATE POLICY "Users can insert expenses to their businesses"
  ON expenses FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'expenses'->>'create')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can update expenses from their businesses" ON expenses;
CREATE POLICY "Users can update expenses from their businesses"
  ON expenses FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'expenses'->>'edit')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can delete expenses from their businesses" ON expenses;
CREATE POLICY "Users can delete expenses from their businesses"
  ON expenses FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND (permissions->'expenses'->>'delete')::boolean = true
    )
  );

-- =====================================================
-- PARTE 3: FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para generar número de venta automático
CREATE OR REPLACE FUNCTION generate_sale_number(p_business_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER;
  v_sale_number TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM sales
  WHERE business_id = p_business_id
  AND DATE(created_at) = CURRENT_DATE;
  
  v_sale_number := TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
  
  RETURN v_sale_number;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ✅ SCRIPT COMPLETADO
-- =====================================================
-- Todas las tablas, políticas RLS, índices y funciones han sido creadas.
-- El sistema está listo para funcionar con Supabase.
-- =====================================================
