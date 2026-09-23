-- Visibilidad por producto en el catálogo virtual (independiente del stock).
-- Default true: productos existentes siguen apareciendo hasta que el usuario los apague.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_in_virtual_catalog BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.show_in_virtual_catalog IS
  'Si es false, el producto no se muestra en el catálogo público compartido. No afecta POS ni inventario.';
