-- Foto del comprobante bancario, solo para ventas con transferencia.
-- No entra en los listados de movimientos: se pide al abrir el detalle.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS transfer_proof TEXT;
