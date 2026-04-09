-- =====================================================
-- SISTEMA POS - ESQUEMA DE BASE DE DATOS COMPLETO
-- Multi-tenant (múltiples negocios por usuario)
-- Preparado para Super Admin
-- ✨ PREPARADO PARA INTEGRACIONES ✨
-- =====================================================

-- =====================================================
-- 1. TABLA DE USUARIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Para datos adicionales flexibles
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================================================
-- 2. TABLA DE NEGOCIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT, -- RUT, RFC, NIT, etc para facturación
  country TEXT DEFAULT 'CO', -- Para integraciones locales
  currency TEXT DEFAULT 'COP', -- Moneda del negocio
  timezone TEXT DEFAULT 'America/Bogota',
  logo_url TEXT, -- Para facturación electrónica
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb, -- Datos adicionales flexibles
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_active ON businesses(active);
CREATE INDEX IF NOT EXISTS idx_businesses_country ON businesses(country);

-- =====================================================
-- 3. RELACIÓN USUARIOS <-> NEGOCIOS (Multi-tenant)
-- Un usuario puede tener acceso a múltiples negocios
-- Un negocio puede tener múltiples usuarios (dueño + empleados)
-- =====================================================
CREATE TABLE IF NOT EXISTS business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'employee', 'viewer')),
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_business_users_business ON business_users(business_id);
CREATE INDEX IF NOT EXISTS idx_business_users_user ON business_users(user_id);

-- =====================================================
-- 4. TABLA DE PRODUCTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(business_id, active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(business_id, category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(business_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- =====================================================
-- 5. TABLA DE CLIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(business_id, active);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(business_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(business_id, phone);

-- =====================================================
-- 6. TABLA DE EMPLEADOS
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_employees_business ON employees(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(business_id, email);

-- =====================================================
-- 7. TABLA DE VENTAS
-- =====================================================
CREATE TABLE IF NOT EXISTS sales (
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(business_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_employee ON sales(employee_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(business_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_type ON sales(business_id, type);

-- =====================================================
-- 8. TABLA DE ITEMS DE VENTA
-- =====================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL, -- Guardamos el nombre por si se elimina el producto
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  unit_cost DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  subtotal DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- =====================================================
-- 9. TABLA DE PAGOS DE VENTA (Múltiples métodos)
-- =====================================================
CREATE TABLE IF NOT EXISTS sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Efectivo', 'Tarjeta', 'Transferencia', 'Otros')),
  amount DECIMAL(15,2) NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_method ON sale_payments(payment_method);

-- =====================================================
-- 10. TABLA DE GASTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS expenses (
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_expenses_business ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(business_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(business_id, category);
CREATE INDEX IF NOT EXISTS idx_expenses_employee ON expenses(employee_id);

-- =====================================================
-- 11. HISTORIAL DE STOCK (Auditoría)
-- =====================================================
CREATE TABLE IF NOT EXISTS stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'return')),
  quantity DECIMAL(10,2) NOT NULL, -- Negativo para salidas, positivo para entradas
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reference_id UUID, -- ID de la venta, compra, etc.
  reference_type TEXT, -- 'sale', 'expense', etc.
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_business ON stock_history(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_date ON stock_history(created_at DESC);

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
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
-- FUNCIÓN: Actualizar stock cuando se crea una venta
-- =====================================================
CREATE OR REPLACE FUNCTION handle_sale_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_product products%ROWTYPE;
  v_sale sales%ROWTYPE;
BEGIN
  -- Obtener información de la venta
  SELECT * INTO v_sale FROM sales WHERE id = NEW.sale_id;
  
  -- Solo procesar si la venta está completada
  IF v_sale.status = 'completed' THEN
    -- Obtener el producto
    SELECT * INTO v_product FROM products WHERE id = NEW.product_id;
    
    IF v_product.id IS NOT NULL THEN
      -- Actualizar stock
      UPDATE products 
      SET stock = stock - NEW.quantity,
          updated_at = NOW()
      WHERE id = NEW.product_id;
      
      -- Registrar en historial
      INSERT INTO stock_history (
        product_id,
        business_id,
        movement_type,
        quantity,
        stock_before,
        stock_after,
        reference_id,
        reference_type,
        created_by
      ) VALUES (
        NEW.product_id,
        v_sale.business_id,
        'sale',
        -NEW.quantity,
        v_product.stock,
        v_product.stock - NEW.quantity,
        NEW.sale_id,
        'sale',
        v_sale.created_by
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sale_stock AFTER INSERT ON sale_items
    FOR EACH ROW EXECUTE FUNCTION handle_sale_stock();

-- =====================================================
-- FUNCIÓN: Actualizar deuda del cliente
-- =====================================================
CREATE OR REPLACE FUNCTION update_customer_debt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'credito' AND NEW.customer_id IS NOT NULL THEN
    UPDATE customers
    SET current_debt = current_debt + NEW.total,
        updated_at = NOW()
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customer_debt AFTER INSERT ON sales
    FOR EACH ROW EXECUTE FUNCTION update_customer_debt();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- Políticas para BUSINESSES
CREATE POLICY "Users can view their own businesses" ON businesses
    FOR SELECT USING (
      owner_id = auth.uid() OR
      id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create businesses" ON businesses
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their businesses" ON businesses
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their businesses" ON businesses
    FOR DELETE USING (owner_id = auth.uid());

-- Políticas para PRODUCTS (y otras tablas similares)
CREATE POLICY "Users can view products of their businesses" ON products
    FOR SELECT USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

CREATE POLICY "Users can manage products of their businesses" ON products
    FOR ALL USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- Políticas similares para CUSTOMERS
CREATE POLICY "Users can view customers of their businesses" ON customers
    FOR SELECT USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

CREATE POLICY "Users can manage customers of their businesses" ON customers
    FOR ALL USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- Políticas para EMPLOYEES
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

-- Políticas para SALES
CREATE POLICY "Users can view sales of their businesses" ON sales
    FOR SELECT USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

CREATE POLICY "Users can manage sales of their businesses" ON sales
    FOR ALL USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- Políticas para SALE_ITEMS
CREATE POLICY "Users can view sale items of their businesses" ON sale_items
    FOR SELECT USING (
      sale_id IN (
        SELECT id FROM sales WHERE business_id IN (
          SELECT id FROM businesses WHERE owner_id = auth.uid()
          UNION
          SELECT business_id FROM business_users WHERE user_id = auth.uid()
        )
      )
    );

CREATE POLICY "Users can manage sale items of their businesses" ON sale_items
    FOR ALL USING (
      sale_id IN (
        SELECT id FROM sales WHERE business_id IN (
          SELECT id FROM businesses WHERE owner_id = auth.uid()
          UNION
          SELECT business_id FROM business_users WHERE user_id = auth.uid()
        )
      )
    );

-- Políticas para SALE_PAYMENTS
CREATE POLICY "Users can view sale payments of their businesses" ON sale_payments
    FOR SELECT USING (
      sale_id IN (
        SELECT id FROM sales WHERE business_id IN (
          SELECT id FROM businesses WHERE owner_id = auth.uid()
          UNION
          SELECT business_id FROM business_users WHERE user_id = auth.uid()
        )
      )
    );

CREATE POLICY "Users can manage sale payments of their businesses" ON sale_payments
    FOR ALL USING (
      sale_id IN (
        SELECT id FROM sales WHERE business_id IN (
          SELECT id FROM businesses WHERE owner_id = auth.uid()
          UNION
          SELECT business_id FROM business_users WHERE user_id = auth.uid()
        )
      )
    );

-- Políticas para EXPENSES
CREATE POLICY "Users can view expenses of their businesses" ON expenses
    FOR SELECT USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

CREATE POLICY "Users can manage expenses of their businesses" ON expenses
    FOR ALL USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- Políticas para STOCK_HISTORY
CREATE POLICY "Users can view stock history of their businesses" ON stock_history
    FOR SELECT USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- =====================================================
-- VISTAS ÚTILES PARA SUPER ADMIN Y REPORTES
-- =====================================================

-- Vista: Resumen de negocios con estadísticas
CREATE OR REPLACE VIEW business_stats AS
SELECT 
  b.id,
  b.name,
  b.email,
  b.owner_id,
  u.email as owner_email,
  b.active,
  b.created_at,
  COUNT(DISTINCT p.id) as total_products,
  COUNT(DISTINCT c.id) as total_customers,
  COUNT(DISTINCT e.id) as total_employees,
  COUNT(DISTINCT s.id) as total_sales,
  COALESCE(SUM(s.total), 0) as total_revenue,
  COUNT(DISTINCT ex.id) as total_expenses,
  COALESCE(SUM(ex.amount), 0) as total_expenses_amount
FROM businesses b
LEFT JOIN users u ON b.owner_id = u.id
LEFT JOIN products p ON b.id = p.business_id
LEFT JOIN customers c ON b.id = c.business_id
LEFT JOIN employees e ON b.id = e.business_id
LEFT JOIN sales s ON b.id = s.business_id AND s.status = 'completed'
LEFT JOIN expenses ex ON b.id = ex.business_id
GROUP BY b.id, b.name, b.email, b.owner_id, u.email, b.active, b.created_at;

-- Vista: Productos con bajo stock
CREATE OR REPLACE VIEW products_low_stock AS
SELECT 
  p.id,
  p.business_id,
  b.name as business_name,
  p.name as product_name,
  p.stock,
  p.min_stock,
  p.price
FROM products p
INNER JOIN businesses b ON p.business_id = b.id
WHERE p.active = true AND p.stock <= p.min_stock;

-- Vista: Top productos más vendidos
CREATE OR REPLACE VIEW top_selling_products AS
SELECT 
  p.id,
  p.business_id,
  b.name as business_name,
  p.name as product_name,
  SUM(si.quantity) as total_sold,
  SUM(si.subtotal) as total_revenue,
  COUNT(DISTINCT si.sale_id) as times_sold
FROM sale_items si
INNER JOIN products p ON si.product_id = p.id
INNER JOIN sales s ON si.sale_id = s.id
INNER JOIN businesses b ON p.business_id = b.id
WHERE s.status = 'completed'
GROUP BY p.id, p.business_id, b.name, p.name
ORDER BY total_sold DESC;

-- Vista: Ventas por día
CREATE OR REPLACE VIEW daily_sales AS
SELECT 
  s.business_id,
  b.name as business_name,
  DATE(s.sale_date) as sale_date,
  COUNT(s.id) as total_sales,
  SUM(s.total) as total_revenue,
  SUM(s.discount) as total_discounts
FROM sales s
INNER JOIN businesses b ON s.business_id = b.id
WHERE s.status = 'completed'
GROUP BY s.business_id, b.name, DATE(s.sale_date)
ORDER BY sale_date DESC;

-- =====================================================
-- DATOS INICIALES / SEED
-- =====================================================

-- Comentario: Puedes agregar datos de prueba aquí si lo necesitas

-- =====================================================
-- 🔌 TABLAS PARA INTEGRACIONES
-- =====================================================

-- =====================================================
-- 12. CONFIGURACIONES DEL NEGOCIO
-- Almacena configuraciones flexibles por negocio
-- =====================================================
CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key TEXT NOT NULL, -- ej: 'invoice_prefix', 'tax_rate', 'stripe_enabled'
  value JSONB NOT NULL, -- Valor flexible que puede ser string, number, object, etc.
  category TEXT, -- ej: 'billing', 'integrations', 'general'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, key)
);

CREATE INDEX IF NOT EXISTS idx_business_settings_business ON business_settings(business_id);
CREATE INDEX IF NOT EXISTS idx_business_settings_category ON business_settings(business_id, category);

-- =====================================================
-- 13. INTEGRACIONES ACTIVAS
-- Registra qué integraciones están conectadas
-- =====================================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'stripe', 'dian', 'quickbooks', 'woocommerce', etc.
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'pending')),
  config JSONB DEFAULT '{}'::jsonb, -- Configuración de la integración (sin API keys sensibles)
  credentials_encrypted TEXT, -- API keys encriptadas (o usar Supabase Vault)
  last_sync TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Info adicional (limits, webhooks, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_business ON integrations(business_id);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(business_id, status);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);

-- Trigger para updated_at
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 14. LOGS DE INTEGRACIONES
-- Auditoría de todas las llamadas a APIs externas
-- =====================================================
CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  action TEXT NOT NULL, -- 'sync_invoice', 'create_payment', 'fetch_products'
  direction TEXT CHECK (direction IN ('outgoing', 'incoming')), -- outgoing = enviamos, incoming = recibimos
  request_data JSONB, -- Datos enviados (sin info sensible)
  response_data JSONB, -- Respuesta recibida
  status_code INTEGER,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  duration_ms INTEGER, -- Tiempo que tomó la llamada
  reference_id UUID, -- ID de la venta, producto, etc relacionado
  reference_type TEXT, -- 'sale', 'product', 'customer', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_business ON integration_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_date ON integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_provider ON integration_logs(business_id, provider);
CREATE INDEX IF NOT EXISTS idx_integration_logs_success ON integration_logs(business_id, success);
CREATE INDEX IF NOT EXISTS idx_integration_logs_reference ON integration_logs(reference_type, reference_id);

-- =====================================================
-- 15. IDs EXTERNOS (Para mapear con otros sistemas)
-- Permite relacionar nuestras entidades con IDs de otros sistemas
-- =====================================================
CREATE TABLE IF NOT EXISTS external_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'product', 'customer', 'sale', 'invoice'
  entity_id UUID NOT NULL, -- ID interno en nuestra BD
  provider TEXT NOT NULL, -- 'woocommerce', 'shopify', 'quickbooks'
  external_id TEXT NOT NULL, -- ID en el sistema externo
  external_data JSONB, -- Datos adicionales del sistema externo
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, provider, entity_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_external_ids_business ON external_ids(business_id);
CREATE INDEX IF NOT EXISTS idx_external_ids_entity ON external_ids(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_external_ids_provider ON external_ids(business_id, provider);
CREATE INDEX IF NOT EXISTS idx_external_ids_external ON external_ids(provider, external_id);

-- =====================================================
-- 16. WEBHOOKS
-- Configuración de webhooks para notificaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- ['sale.created', 'product.updated', 'customer.created']
  secret TEXT, -- Para firmar los webhooks
  active BOOLEAN DEFAULT true,
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  headers JSONB DEFAULT '{}'::jsonb, -- Headers personalizados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_business ON webhooks(business_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(business_id, active);

-- Trigger para updated_at
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 17. LOGS DE WEBHOOKS
-- Auditoría de webhooks enviados
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE SET NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  attempts INTEGER DEFAULT 1,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_business ON webhook_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_date ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_success ON webhook_logs(business_id, success);

-- =====================================================
-- 18. FACTURACIÓN ELECTRÓNICA
-- Datos específicos para facturación electrónica (DIAN, SAT, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL, -- Número oficial de factura
  invoice_type TEXT DEFAULT 'invoice' CHECK (invoice_type IN ('invoice', 'credit_note', 'debit_note')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'authorized', 'rejected', 'cancelled')),
  
  -- Datos del cliente (copiados al momento de facturar)
  customer_name TEXT NOT NULL,
  customer_tax_id TEXT,
  customer_email TEXT,
  customer_address TEXT,
  
  -- Montos
  subtotal DECIMAL(15,2) NOT NULL,
  tax DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  
  -- Facturación electrónica
  tax_authority TEXT, -- 'DIAN', 'SAT', 'SUNAT', etc.
  xml_url TEXT, -- URL del XML generado
  pdf_url TEXT, -- URL del PDF
  qr_code TEXT, -- Código QR para validación
  cude TEXT, -- Código único de documento (Colombia)
  cufe TEXT, -- Código único de factura electrónica (Colombia)
  
  -- Respuesta de la autoridad fiscal
  authorization_code TEXT,
  authorization_date TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Metadatos
  external_id TEXT, -- ID en el sistema de facturación
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sale ON invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(business_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(business_id, invoice_number);

-- Trigger para updated_at
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 19. ITEMS DE FACTURA
-- =====================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  discount DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  subtotal DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- =====================================================
-- 20. SUSCRIPCIONES / PLANES (Para cobros recurrentes)
-- Preparado para cuando quieras monetizar tu plataforma
-- =====================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL, -- 'free', 'basic', 'premium', 'enterprise'
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'paused')),
  
  -- Precios
  price DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'COP',
  billing_period TEXT DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly', 'quarterly')),
  
  -- Límites del plan
  limits JSONB DEFAULT '{}'::jsonb, -- {max_products: 100, max_sales: 1000, etc}
  features JSONB DEFAULT '{}'::jsonb, -- {invoicing: true, multi_user: false, etc}
  
  -- Fechas
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Pasarela de pago
  payment_provider TEXT, -- 'stripe', 'paypal', 'mercadopago'
  external_subscription_id TEXT, -- ID en Stripe/PayPal
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_business ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_name);

-- Trigger para updated_at
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 21. PAGOS DE SUSCRIPCIÓN
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'COP',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  
  payment_provider TEXT,
  external_payment_id TEXT, -- ID de pago en Stripe/PayPal
  payment_method TEXT, -- 'card', 'bank_transfer', etc.
  
  failure_reason TEXT,
  receipt_url TEXT,
  
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_business ON subscription_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_date ON subscription_payments(created_at DESC);

-- =====================================================
-- RLS PARA NUEVAS TABLAS DE INTEGRACIONES
-- =====================================================

-- Business Settings
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage settings of their businesses" ON business_settings
    FOR ALL USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- Integrations
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage integrations of their businesses" ON integrations
    FOR ALL USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- Integration Logs
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view integration logs of their businesses" ON integration_logs
    FOR SELECT USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- External IDs
ALTER TABLE external_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage external IDs of their businesses" ON external_ids
    FOR ALL USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- Webhooks
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage webhooks of their businesses" ON webhooks
    FOR ALL USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- Webhook Logs
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view webhook logs of their businesses" ON webhook_logs
    FOR SELECT USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage invoices of their businesses" ON invoices
    FOR ALL USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- Invoice Items
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage invoice items of their businesses" ON invoice_items
    FOR ALL USING (
      invoice_id IN (
        SELECT id FROM invoices WHERE business_id IN (
          SELECT id FROM businesses WHERE owner_id = auth.uid()
          UNION
          SELECT business_id FROM business_users WHERE user_id = auth.uid()
        )
      )
    );

-- Subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their business subscriptions" ON subscriptions
    FOR SELECT USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- Subscription Payments
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their business subscription payments" ON subscription_payments
    FOR SELECT USING (
      business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
        UNION
        SELECT business_id FROM business_users WHERE user_id = auth.uid()
      )
    );

-- =====================================================
-- FIN DEL ESQUEMA
-- =====================================================

-- Para verificar que todo se creó correctamente:
SELECT 'Schema created successfully! 🚀 Ready for integrations!' as status;