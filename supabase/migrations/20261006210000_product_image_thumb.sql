-- Columna calculada: al pedir image_thumb, Postgres devuelve solo la miniatura.
-- La foto grande sigue en products.image y se lee al abrir el producto en inventario.

CREATE OR REPLACE FUNCTION public.image_thumb(p public.products)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p.image IS NULL OR btrim(p.image) = '' THEN NULL
    WHEN left(btrim(p.image), 1) <> '{' THEN p.image
    ELSE substring(p.image from '"thumb":"([^"]*)"')
  END;
$$;

COMMENT ON FUNCTION public.image_thumb(public.products) IS
  'Miniatura ya guardada dentro de products.image. No recomprime ni recorta.';

GRANT EXECUTE ON FUNCTION public.image_thumb(public.products) TO service_role, authenticated, anon;

NOTIFY pgrst, 'reload schema';
