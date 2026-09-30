export type CashPayMethod = 'cash' | 'card' | 'transfer' | 'other' | 'none';

export type CashPayLine = {
  method: string;
  amount: number;
};

export type CashMovementInput = {
  id: string;
  kind: 'sale' | 'expense';
  label: string;
  createdAt: string;
  createdBy: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  total: number;
  payments?: CashPayLine[] | null;
};

export type CashLine = {
  id: string;
  label: string;
  amount: number;
  createdAt?: string;
};

export type CashBreakdown = {
  cashSales: CashLine[];
  cashExpenses: CashLine[];
  card: CashLine[];
  transfer: CashLine[];
  openingAmount: number;
  cashSalesTotal: number;
  cashExpensesTotal: number;
  cardTotal: number;
  transferTotal: number;
  expected: number;
};

export type CashSessionWindow = {
  employeeUserId: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
};

export function normalizeCashMethod(raw: string | null | undefined): CashPayMethod {
  const m = String(raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
  if (m === 'efectivo' || m === 'cash') return 'cash';
  if (m === 'tarjeta' || m === 'card') return 'card';
  if (m === 'transferencia' || m === 'transfer') return 'transfer';
  if (m === '' || m === '-' || m === 'none' || m === 'credito' || m === 'credit' || m === 'otros' || m === 'other') {
    return m === 'otros' || m === 'other' ? 'other' : 'none';
  }
  return 'other';
}

function sumLines(lines: CashLine[]): number {
  return lines.reduce((acc, line) => acc + line.amount, 0);
}

function paymentParts(movement: CashMovementInput): Array<{ method: CashPayMethod; amount: number }> {
  const status = String(movement.paymentStatus ?? '').toLowerCase();
  const listed = (movement.payments ?? [])
    .map((pay) => ({
      method: normalizeCashMethod(pay.method),
      amount: Number(pay.amount) || 0,
    }))
    .filter((pay) => pay.amount > 0 && pay.method !== 'none' && pay.method !== 'other');

  if (listed.length > 0) return listed;
  if (status === 'pending') return [];

  const method = normalizeCashMethod(movement.paymentMethod);
  const amount = Number(movement.total) || 0;
  if (amount <= 0 || method === 'none' || method === 'other') return [];
  return [{ method, amount }];
}

export function movementBelongsToCashSession(
  movement: Pick<CashMovementInput, 'createdAt' | 'createdBy'>,
  session: Pick<CashSessionWindow, 'employeeUserId' | 'openedAt' | 'closedAt'>,
): boolean {
  if (!movement.createdBy || movement.createdBy !== session.employeeUserId) return false;
  const at = new Date(movement.createdAt).getTime();
  const opened = new Date(session.openedAt).getTime();
  if (Number.isNaN(at) || Number.isNaN(opened) || at < opened) return false;
  if (session.closedAt) {
    const closed = new Date(session.closedAt).getTime();
    if (!Number.isNaN(closed) && at > closed) return false;
  }
  return true;
}

export function buildCashBreakdown(
  session: CashSessionWindow,
  movements: CashMovementInput[],
): CashBreakdown {
  const cashSales: CashLine[] = [];
  const cashExpenses: CashLine[] = [];
  const card: CashLine[] = [];
  const transfer: CashLine[] = [];

  for (const movement of movements) {
    if (!movementBelongsToCashSession(movement, session)) continue;
    for (const part of paymentParts(movement)) {
      const line = {
        id: movement.id,
        label: movement.label,
        amount: part.amount,
        createdAt: movement.createdAt,
      };
      if (part.method === 'cash' && movement.kind === 'sale') cashSales.push(line);
      else if (part.method === 'cash' && movement.kind === 'expense') cashExpenses.push(line);
      else if (part.method === 'card') card.push(line);
      else if (part.method === 'transfer') transfer.push(line);
    }
  }

  const byTime = (a: CashLine, b: CashLine) =>
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  cashSales.sort(byTime);
  cashExpenses.sort(byTime);
  card.sort(byTime);
  transfer.sort(byTime);

  const openingAmount = Number(session.openingAmount) || 0;
  const cashSalesTotal = sumLines(cashSales);
  const cashExpensesTotal = sumLines(cashExpenses);
  return {
    cashSales,
    cashExpenses,
    card,
    transfer,
    openingAmount,
    cashSalesTotal,
    cashExpensesTotal,
    cardTotal: sumLines(card),
    transferTotal: sumLines(transfer),
    expected: openingAmount + cashSalesTotal - cashExpensesTotal,
  };
}

export function cashDifference(expected: number, counted: number | null): number | null {
  if (counted == null || Number.isNaN(counted)) return null;
  return counted - expected;
}
