import { supabase } from '../lib/supabase';
import type { CashBreakdown } from '../lib/cashSession';

export type CashSessionSnapshot = CashBreakdown & {
  countedAmount: number;
  difference: number;
};

export type CashSession = {
  id: string;
  businessId: string;
  employeeUserId: string;
  employeeName: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  countedAmount: number | null;
  comment: string;
  snapshot: CashSessionSnapshot | null;
};

const SETTINGS_KEY = 'cash_sessions';

function mapSession(raw: any, businessId: string): CashSession {
  return {
    id: String(raw.id),
    businessId,
    employeeUserId: String(raw.employeeUserId),
    employeeName: String(raw.employeeName || 'Empleado'),
    openedAt: String(raw.openedAt),
    closedAt: raw.closedAt ? String(raw.closedAt) : null,
    openingAmount: Number(raw.openingAmount) || 0,
    countedAmount: raw.countedAmount == null ? null : Number(raw.countedAmount),
    comment: String(raw.comment || ''),
    snapshot: raw.snapshot ?? null,
  };
}

async function readSessions(businessId: string): Promise<CashSession[]> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('value')
    .eq('business_id', businessId)
    .eq('key', SETTINGS_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const sessions = (data as any)?.value?.sessions;
  if (!Array.isArray(sessions)) return [];
  return sessions.map((session) => mapSession(session, businessId));
}

async function writeSessions(businessId: string, sessions: CashSession[]): Promise<void> {
  const { error } = await supabase.from('business_settings').upsert(
    {
      business_id: businessId,
      key: SETTINGS_KEY,
      value: { sessions },
      category: 'cash',
      description: 'Cajas por empleado',
    },
    { onConflict: 'business_id,key' },
  );
  if (error) throw new Error(error.message);
}

export async function listCashSessions(businessId: string): Promise<CashSession[]> {
  const sessions = await readSessions(businessId);
  return sessions.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
}

export async function openCashSession(input: {
  businessId: string;
  employeeUserId: string;
  employeeName: string;
  openingAmount: number;
  comment: string;
  openedBy: string | null;
}): Promise<CashSession> {
  const sessions = await readSessions(input.businessId);
  if (sessions.some((session) => !session.closedAt && session.employeeUserId === input.employeeUserId)) {
    throw new Error(`${input.employeeName} ya tiene una caja abierta.`);
  }
  const created: CashSession = {
    id: crypto.randomUUID(),
    businessId: input.businessId,
    employeeUserId: input.employeeUserId,
    employeeName: input.employeeName,
    openedAt: new Date().toISOString(),
    closedAt: null,
    openingAmount: input.openingAmount,
    countedAmount: null,
    comment: input.comment,
    snapshot: null,
  };
  await writeSessions(input.businessId, [created, ...sessions]);
  return created;
}

export async function closeCashSession(input: {
  id: string;
  businessId: string;
  countedAmount: number;
  comment: string;
  snapshot: CashSessionSnapshot;
  closedBy: string | null;
}): Promise<CashSession> {
  const sessions = await readSessions(input.businessId);
  const index = sessions.findIndex((session) => session.id === input.id && !session.closedAt);
  if (index < 0) throw new Error('Esa caja ya está cerrada.');
  const closed: CashSession = {
    ...sessions[index],
    closedAt: new Date().toISOString(),
    countedAmount: input.countedAmount,
    comment: input.comment,
    snapshot: input.snapshot,
  };
  const next = sessions.slice();
  next[index] = closed;
  await writeSessions(input.businessId, next);
  return closed;
}

export async function updateClosedCashSession(input: {
  id: string;
  businessId: string;
  openingAmount: number;
  countedAmount: number;
  comment: string;
  breakdown: CashBreakdown;
}): Promise<CashSession> {
  const sessions = await readSessions(input.businessId);
  const index = sessions.findIndex((session) => session.id === input.id && session.closedAt);
  if (index < 0) throw new Error('Esa caja no está cerrada.');
  const openingAmount = input.openingAmount;
  const countedAmount = input.countedAmount;
  const expected = openingAmount + input.breakdown.cashSalesTotal - input.breakdown.cashExpensesTotal;
  const updated: CashSession = {
    ...sessions[index],
    openingAmount,
    countedAmount,
    comment: input.comment,
    snapshot: {
      ...input.breakdown,
      openingAmount,
      expected,
      countedAmount,
      difference: countedAmount - expected,
    },
  };
  const next = sessions.slice();
  next[index] = updated;
  await writeSessions(input.businessId, next);
  return updated;
}

export async function deleteCashSession(input: { id: string; businessId: string }): Promise<void> {
  const sessions = await readSessions(input.businessId);
  const current = sessions.find((session) => session.id === input.id);
  if (!current) throw new Error('No se encontró esa caja.');
  if (!current.closedAt) throw new Error('Solo se puede eliminar una caja cerrada.');
  await writeSessions(
    input.businessId,
    sessions.filter((session) => session.id !== input.id),
  );
}
