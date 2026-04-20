-- Agregar cédula/ID a contactos (customers) como campo opcional.
-- Requisito: si existe, debe ser única por negocio.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS cedula TEXT;

COMMENT ON COLUMN customers.cedula IS 'Cédula / documento de identidad (opcional). Única por negocio si existe.';

-- Unicidad por negocio, solo cuando hay valor.
CREATE UNIQUE INDEX IF NOT EXISTS customers_business_cedula_unique
  ON customers (business_id, cedula)
  WHERE cedula IS NOT NULL AND btrim(cedula) <> '';

-- Índice para búsquedas rápidas por cédula (con filtro por negocio).
CREATE INDEX IF NOT EXISTS idx_customers_business_cedula
  ON customers (business_id, cedula)
  WHERE cedula IS NOT NULL AND btrim(cedula) <> '';

