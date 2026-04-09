-- Estado de pago de gastos (alineado con sales.payment_status: paid / pending / partial)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid';

COMMENT ON COLUMN expenses.payment_status IS 'paid = Pagada, pending = En deuda (u otros estados compatibles con ventas)';
