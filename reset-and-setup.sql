-- =====================================================
-- RESET COMPLETO Y SETUP - SISTEMA POS
-- ⚠️ ADVERTENCIA: Esto eliminará todas las tablas y datos existentes
-- =====================================================

-- =====================================================
-- PASO 1: Eliminar todas las tablas existentes
-- =====================================================

DROP TABLE IF EXISTS sale_payments CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Eliminar función si existe
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- =====================================================
-- PASO 2: Crear todas las tablas desde cero
-- =====================================================

-- 1. TABLA DE USUARIOS
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- 2. TABLA DE NEGOCIOS
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  country TEXT DEFAULT 'CO',
  currency TEXT DEFAULT 'COP',
  timezone TEXT DEFAULT 'America/Bogota',
  logo_url TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_active ON businesses(active);

-- 3. TABLA DE PRODUCTOS
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  price DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost DECIMAL(15,2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  category TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_business ON products(business_id);
CREATE INDEX idx_products_active ON products(business_id, active);
CREATE INDEX idx_products_category ON products(business_id, category);

-- 4. TABLA DE CLIENTES
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  current_debt DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_business ON customers(business_id);
CREATE INDEX idx_customers_active ON customers(business_id, active);

-- 5. TABLA DE EMPLEADOS
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier', 'inventory', 'readonly')),
  permissions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_owner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, email)
);

CREATE INDEX idx_employees_business ON employees(business_id);
CREATE INDEX idx_employees_active ON employees(business_id, is_active);
CREATE INDEX idx_employees_email ON employees(business_id, email);

-- 6. TABLA DE VENTAS
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sale_number TEXT NOT NULL,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('contado', 'credito')),
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  tax DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, sale_number)
);

CREATE INDEX idx_sales_business ON sales(business_id);
CREATE INDEX idx_sales_date ON sales(business_id, sale_date DESC);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_status ON sales(business_id, status);

-- 7. TABLA DE ITEMS DE VENTA
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  unit_cost DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  subtotal DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- 8. TABLA DE PAGOS DE VENTA
CREATE TABLE sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Efectivo', 'Tarjeta', 'Transferencia', 'Otros')),
  amount DECIMAL(15,2) NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id);

-- 9. TABLA DE GASTOS
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  expense_number TEXT NOT NULL,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Efectivo', 'Tarjeta', 'Transferencia', 'Otros')),
  reference TEXT,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, expense_number)
);

CREATE INDEX idx_expenses_business ON expenses(business_id);
CREATE INDEX idx_expenses_date ON expenses(business_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(business_id, category);

-- =====================================================
-- PASO 3: Funciones y Triggers
-- =====================================================

CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PASO 4: Row Level Security (RLS)
-- =====================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- BUSINESSES
CREATE POLICY "Users can view their own businesses" ON businesses
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can create businesses" ON businesses
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their businesses" ON businesses
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their businesses" ON businesses
    FOR DELETE USING (owner_id = auth.uid());

-- PRODUCTS
CREATE POLICY "Users can view products of their businesses" ON products
    FOR SELECT USING (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

CREATE POLICY "Users can manage products of their businesses" ON products
    FOR ALL USING (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

-- CUSTOMERS
CREATE POLICY "Users can view customers of their businesses" ON customers
    FOR SELECT USING (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

CREATE POLICY "Users can manage customers of their businesses" ON customers
    FOR ALL USING (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

-- EMPLOYEES
CREATE POLICY "Users can view employees of their businesses" ON employees
    FOR SELECT USING (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

CREATE POLICY "Users can manage employees of their businesses" ON employees
    FOR ALL USING (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

-- SALES
CREATE POLICY "Users can view sales of their businesses" ON sales
    FOR SELECT USING (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

CREATE POLICY "Users can manage sales of their businesses" ON sales
    FOR ALL USING (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

-- SALE_ITEMS
CREATE POLICY "Users can view sale items of their businesses" ON sale_items
    FOR SELECT USING (
      sale_id IN (
        SELECT id FROM sales WHERE business_id IN (
          SELECT id FROM businesses WHERE owner_id = auth.uid()
        )
      )
    );

CREATE POLICY "Users can manage sale items of their businesses" ON sale_items
    FOR ALL USING (
      sale_id IN (
        SELECT id FROM sales WHERE business_id IN (
          SELECT id FROM businesses WHERE owner_id = auth.uid()
        )
      )
    );

-- SALE_PAYMENTS
CREATE POLICY "Users can view sale payments of their businesses" ON sale_payments
    FOR SELECT USING (
      sale_id IN (
        SELECT id FROM sales WHERE business_id IN (
          SELECT id FROM businesses WHERE owner_id = auth.uid()
        )
      )
    );

CREATE POLICY "Users can manage sale payments of their businesses" ON sale_payments
    FOR ALL USING (
      sale_id IN (
        SELECT id FROM sales WHERE business_id IN (
          SELECT id FROM businesses WHERE owner_id = auth.uid()
        )
      )
    );

-- EXPENSES
CREATE POLICY "Users can view expenses of their businesses" ON expenses
    FOR SELECT USING (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

CREATE POLICY "Users can manage expenses of their businesses" ON expenses
    FOR ALL USING (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

-- =====================================================
-- ✅ COMPLETADO
-- =====================================================
SELECT '✅ Base de datos configurada exitosamente! Sistema POS listo para usar.' as status;
