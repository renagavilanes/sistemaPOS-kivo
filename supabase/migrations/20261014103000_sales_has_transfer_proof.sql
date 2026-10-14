-- Marca barata para el listado. Evita bajar la foto solo para saber si mostrar "Ver imagen".
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS has_transfer_proof boolean
  GENERATED ALWAYS AS (
    transfer_proof IS NOT NULL AND length(transfer_proof) > 0
  ) STORED;

NOTIFY pgrst, 'reload schema';
