-- =====================================================
-- MIGRACIÓN: Agregar columna image a la tabla products
-- =====================================================

-- Agregar columna image a la tabla products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image TEXT;

-- Comentario de la columna
COMMENT ON COLUMN products.image IS 'URL de la imagen del producto';
