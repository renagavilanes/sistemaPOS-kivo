-- Tipo de contacto: cliente (ventas), proveedor (gastos) o ambos.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'customer';

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_contact_type_check;

ALTER TABLE customers
  ADD CONSTRAINT customers_contact_type_check
  CHECK (contact_type IN ('customer', 'supplier', 'both'));

COMMENT ON COLUMN customers.contact_type IS 'customer = cliente de ventas, supplier = proveedor (gastos), both = ambos';
