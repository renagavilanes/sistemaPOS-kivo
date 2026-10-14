/** La venta incluye al menos un pago por transferencia. */
export function labeledPaymentsIncludeTransfer(
  paymentType: string,
  payments: Array<{ method?: string | null }> | null | undefined,
): boolean {
  if (paymentType !== 'pagada') return false;
  return (payments || []).some((payment) => {
    const method = String(payment.method || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    return method === 'transferencia' || method === 'transfer';
  });
}

/** Movimiento ya mapeado (efectivo/tarjeta/transfer o múltiple). */
export function movementIncludesTransfer(movement: {
  type?: string;
  paymentMethod?: string | null;
  payments?: Array<{ method?: string | null }> | null;
} | null | undefined): boolean {
  if (!movement || movement.type !== 'sale') return false;
  const method = String(movement.paymentMethod || '').trim().toLowerCase();
  if (method === 'transfer' || method === 'transferencia') return true;
  if (method === 'multiple' || method === 'múltiple') {
    return (movement.payments || []).some((payment) => {
      const itemMethod = String(payment.method || '').trim().toLowerCase();
      return itemMethod === 'transfer' || itemMethod === 'transferencia';
    });
  }
  return false;
}
