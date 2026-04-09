import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';
import { superadminEdgeFunctionSlug } from '/utils/supabase/superadminEdgeSlug';
import { ComunicadosAdminTab } from '../components/superadmin/ComunicadosAdminTab';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GlobalStats {
  users: { total: number; active: number };
  businesses: number;
  products: number;
  employees: number;
  sales: number;
  expenses: number;
  customers: number;
}

type UserBlockHistoryEntry =
  | { kind: 'blocked'; at: string; message: string }
  | { kind: 'unblocked'; at: string; note: string };

interface UserRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_active: boolean;
  blocked?: boolean;
  block_message?: string;
  block_history?: UserBlockHistoryEntry[];
  businesses: number;
  products: number;
  employees: number;
  sales: number;
  expenses: number;
  movements: number;
  customers: number;
}

interface BizRow {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  products: number;
  employees: number;
  sales: number;
  expenses: number;
  movements: number;
  customers: number;
}

type SortDir = 'asc' | 'desc';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Edge Function dedicada (slug en utils/supabase/superadminEdgeSlug.ts). En dev, proxy Vite.
function superadminApiBase(): string {
  const slug = superadminEdgeFunctionSlug;
  if (import.meta.env.DEV) return `/functions/v1/${slug}`;
  return `https://${supabaseProjectId}.supabase.co/functions/v1/${slug}`;
}

const SESSION_KEY = 'superadmin_auth';

async function fetchSuperadmin(
  kind: 'stats' | 'users' | 'comunicados',
  key: string,
  init: RequestInit,
): Promise<Response> {
  const path = kind === 'stats' ? '/superadmin/stats' : kind === 'users' ? '/superadmin/users' : '/superadmin/comunicados';
  const q = `?key=${encodeURIComponent(key)}`;
  return fetch(`${superadminApiBase()}${path}${q}`, init);
}

async function fetchBusinessDetail(businessId: string, key: string): Promise<Response> {
  const q = `?key=${encodeURIComponent(key)}&businessId=${encodeURIComponent(businessId)}`;
  return fetch(`${superadminApiBase()}/superadmin/business${q}`, {
    headers: { Authorization: `Bearer ${supabaseAnonKey}` },
  });
}

async function fetchSuperadminMutate(key: string, body: Record<string, unknown>): Promise<Response> {
  const q = `?key=${encodeURIComponent(key)}`;
  return fetch(`${superadminApiBase()}/superadmin/mutate${q}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function superadminPerformMutate(key: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetchSuperadminMutate(key, body);
  const text = await res.text();
  let j: any = {};
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 200) || `Error ${res.status}`);
  }
  if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
}

/** Contraseña legible para entregar al usuario (sin símbollos ambiguos 0/O, 1/l). */
function randomPasswordForUser(length = 14): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => chars[n % chars.length]).join('');
}

type SuperadminBusinessTab =
  | 'resumen'
  | 'ventas'
  | 'gastos'
  | 'movimientos'
  | 'productos'
  | 'empleados'
  | 'contactos';

type UserInspectEntry =
  | 'overview'
  | { segment: Exclude<SuperadminBusinessTab, 'resumen'> };

const USER_DRILL_LABEL: Record<Exclude<SuperadminBusinessTab, 'resumen'>, string> = {
  movimientos: 'Movimientos',
  ventas: 'Ventas',
  gastos: 'Gastos',
  productos: 'Productos',
  empleados: 'Empleados',
  contactos: 'Contactos',
};

function segmentToBizCountKey(segment: Exclude<SuperadminBusinessTab, 'resumen'>): keyof BizRow {
  const m: Record<Exclude<SuperadminBusinessTab, 'resumen'>, keyof BizRow> = {
    movimientos: 'movements',
    ventas: 'sales',
    gastos: 'expenses',
    productos: 'products',
    empleados: 'employees',
    contactos: 'customers',
  };
  return m[segment];
}

function defaultBusinessIdForSegment(bizes: BizRow[], segment: Exclude<SuperadminBusinessTab, 'resumen'>): string | null {
  if (!bizes.length) return null;
  const k = segmentToBizCountKey(segment);
  const hit = bizes.find(b => Number(b[k]) > 0);
  return (hit ?? bizes[0]).id;
}

/** Misma lógica que Movimientos: notas o nombres de ítems (nombre de la venta / concepto). */
function saleConceptLabel(s: any): string {
  const n = (s?.notes ?? '').toString().trim();
  if (n) return n;
  const items = Array.isArray(s?.items) ? s.items : [];
  if (items.length === 0) return 'Venta general';
  const itemName = (it: any) =>
    (it?.name ?? it?.product_name ?? it?.productName ?? '').toString().trim() || 'Producto';
  if (items.length === 1) return itemName(items[items.length - 1]);
  return `${itemName(items[items.length - 1])} +(${items.length - 1}) más`;
}

function expenseConceptLabel(e: any): string {
  const d = String(e?.description ?? '').trim();
  if (d) return d;
  const n = String(e?.notes ?? '').trim();
  if (n) return n;
  const c = String(e?.category ?? '').trim();
  return c || 'Gasto';
}

function expenseRef(e: any): string {
  const id = String(e?.id ?? '');
  if (!id) return '—';
  return `G-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function buildMergedMovements(data: any) {
  if (!data) return [];
  const sales = (data.sales || []).map((s: any) => ({
    kind: 'venta' as const,
    sourceId: s.id as string,
    at: s.created_at || s.sale_date,
    label: saleConceptLabel(s),
    amount: s.total,
    saleSource: s,
  }));
  const expenses = (data.expenses || []).map((x: any) => ({
    kind: 'gasto' as const,
    sourceId: x.id as string,
    at: x.created_at,
    label: x.description || x.category || x.concept || 'Gasto',
    amount: x.amount ?? x.total,
    expenseSource: x,
  }));
  return [...sales, ...expenses].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** Supabase devuelve 404 JSON si la función no existe; no es fallo de clave ni del proxy local. */
function explainSuperadminHttpError(status: number, body: string): string | null {
  if (status !== 404) return null;
  if (body.includes('NOT_FOUND') || body.includes('Requested function was not found')) {
    return (
      `Supabase no encuentra la Edge Function. El nombre en la URL debe coincidir con «${superadminEdgeFunctionSlug}» (edítalo en utils/supabase/superadminEdgeSlug.ts si cambias el nombre en el dashboard). ` +
      'Revisa secreto SUPERADMIN_KEY y desactiva JWT verification en esa función.'
    );
  }
  return null;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function num(n: number) {
  return n.toLocaleString('es');
}

// ─── Sort arrow component ─────────────────────────────────────────────────────

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-slate-600 ml-1">↕</span>;
  return <span className="text-indigo-400 ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 border ${color} flex flex-col gap-1 min-w-[130px]`}>
      <span className="text-xs uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-3xl font-bold text-white">{num(Number(value))}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

function formatMoney(n: unknown): string {
  const x = typeof n === 'number' ? n : parseFloat(String(n));
  if (Number.isNaN(x)) return '—';
  return x.toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Normaliza texto para comparar métodos de pago (sin acentos). */
function normPayStr(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Igual que Movimientos: sin medio concreto → "—" (crédito / pendiente sin pagos, etc.). */
function superadminSalePaymentLabel(s: any): string {
  const ps = normPayStr(s?.payment_status ?? s?.paymentStatus);
  const pays = Array.isArray(s?.payments) ? s.payments : [];
  if (pays.length > 1) return 'Varios';
  if (pays.length === 1) {
    const m = normPayStr(pays[0]?.method ?? pays[0]?.type);
    if (m === 'efectivo' || m === 'cash') return 'Efectivo';
    if (m === 'tarjeta' || m === 'card') return 'Tarjeta';
    if (m === 'transferencia' || m === 'transfer') return 'Transferencia';
    if (m === 'otros' || m === 'other') return 'Otro';
    const raw = String(pays[0]?.method ?? '').trim();
    return raw || '—';
  }
  if (ps === 'pending' && pays.length === 0) return '—';
  const raw = normPayStr(s?.payment_method ?? s?.paymentMethod);
  if (raw === 'credito' || raw === 'credit') return '—';
  if (raw === 'efectivo' || raw === 'cash') return 'Efectivo';
  if (raw === 'tarjeta' || raw === 'card') return 'Tarjeta';
  if (raw === 'transferencia' || raw === 'transfer') return 'Transferencia';
  if (raw === 'otros' || raw === 'other') return 'Otro';
  if (raw === 'multiple') return 'Varios';
  const displayRaw = String(s?.payment_method ?? s?.paymentMethod ?? '').trim();
  if (!displayRaw) return '—';
  return displayRaw;
}

function superadminExpensePaymentLabel(row: any): string {
  const st = normPayStr(row?.payment_status ?? row?.paymentStatus ?? 'paid');
  if (st === 'pending') return '—';
  const m = normPayStr(row?.payment_method);
  if (m === '-' || m === '') return '—';
  if (m === 'credito' || m === 'credit') return '—';
  if (m === 'efectivo' || m === 'cash') return 'Efectivo';
  if (m === 'tarjeta' || m === 'card') return 'Tarjeta';
  if (m === 'transferencia' || m === 'transfer') return 'Transferencia';
  if (m === 'otros' || m === 'other') return 'Otro';
  const displayRaw = String(row?.payment_method ?? '').trim();
  return displayRaw || '—';
}

function paymentStatusLabelEs(ps: unknown): string {
  const s = normPayStr(ps);
  if (s === 'paid') return 'Pagada';
  if (s === 'pending') return 'Pendiente';
  if (s === 'partial') return 'Parcial';
  if (!String(ps ?? '').trim()) return '—';
  return String(ps);
}

function ModalChrome({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-5xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-white text-xl leading-none px-2 py-1 rounded-lg hover:bg-slate-800"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 p-4">{children}</div>
        {footer && <div className="border-t border-slate-800 px-4 py-3 shrink-0 bg-slate-900/95">{footer}</div>}
      </div>
    </div>
  );
}

function ConfirmDangerModal({
  open,
  title,
  description,
  confirmWord,
  onClose,
  onConfirm,
  busy,
  errorMsg,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmWord: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  busy: boolean;
  errorMsg: string;
}) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  if (!open) return null;
  const ok = typed.trim().toUpperCase() === confirmWord.trim().toUpperCase();
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/80" aria-label="Cerrar" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-red-900/60 bg-slate-900 p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-red-300">{title}</h3>
        <div className="text-sm text-slate-300 mt-2 space-y-2">{description}</div>
        <label className="block text-xs text-slate-500 mt-4 mb-1">
          Escribe <span className="text-red-400 font-mono">{confirmWord}</span> para confirmar
        </label>
        <input
          value={typed}
          onChange={e => setTyped(e.target.value)}
          disabled={busy}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
          autoComplete="off"
        />
        {errorMsg && <p className="text-red-400 text-sm mt-2">{errorMsg}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !ok}
            onClick={() => onConfirm()}
            className="px-3 py-1.5 rounded-lg text-sm bg-red-700 text-white disabled:opacity-40"
          >
            {busy ? '…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserAccessManageModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [message, setMessage] = useState(user.block_message || '');
  const [unblockNote, setUnblockNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setMessage(user.block_message || '');
    setUnblockNote('');
    setErr('');
  }, [user]);

  const runMutate = async (body: Record<string, unknown>) => {
    const key = sessionStorage.getItem('superadmin_key') || '';
    await superadminPerformMutate(key, {
      action: 'set_user_block',
      userId: user.id,
      ...body,
    });
  };

  const handleBlockOrUpdateMessage = async () => {
    setBusy(true);
    setErr('');
    try {
      await runMutate({ blocked: true, message: message.trim() });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleUnblock = async () => {
    setBusy(true);
    setErr('');
    try {
      await runMutate({ blocked: false, unblock_note: unblockNote.trim() });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const history = [...(user.block_history ?? [])].reverse();

  return (
    <ModalChrome
      title={user.blocked ? 'Acceso bloqueado' : 'Bloquear acceso al sistema'}
      subtitle={user.email}
      onClose={() => !busy && onClose()}
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-200"
          >
            Cancelar
          </button>
          {user.blocked && (
            <button
              type="button"
              disabled={busy || !unblockNote.trim()}
              onClick={handleUnblock}
              className="px-3 py-1.5 rounded-lg text-sm bg-green-800 text-white hover:bg-green-700 disabled:opacity-40"
            >
              Desbloquear
            </button>
          )}
          <button
            type="button"
            disabled={busy || !message.trim()}
            onClick={handleBlockOrUpdateMessage}
            className="px-3 py-1.5 rounded-lg text-sm bg-amber-700 text-white disabled:opacity-40"
          >
            {user.blocked ? 'Guardar mensaje' : 'Bloquear usuario'}
          </button>
        </div>
      )}
    >
      <p className="text-sm text-slate-400 mb-3">
        El usuario puede iniciar sesión; al entrar verá un modal a pantalla completa con tu mensaje, opción de WhatsApp a soporte y cerrar sesión.
      </p>
      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
      <label className="block text-xs text-slate-500 mb-1">Mensaje que verá el usuario</label>
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        disabled={busy}
        rows={5}
        placeholder="Ej.: Cuenta suspendida por revisión. Contacta soporte si necesitas ayuda."
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 mb-4"
      />
      {user.blocked && (
        <>
          <label className="block text-xs text-slate-500 mb-1">Nota al desbloquear (obligatoria, queda en historial)</label>
          <textarea
            value={unblockNote}
            onChange={e => setUnblockNote(e.target.value)}
            disabled={busy}
            rows={3}
            placeholder="Ej.: Cliente regularizó pago — 25/03/2025"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 mb-4"
          />
        </>
      )}
      {history.length > 0 && (
        <div className="mt-2 border-t border-slate-800 pt-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Historial</h4>
          <ul className="space-y-3 max-h-48 overflow-y-auto text-sm">
            {history.map((h, i) => (
              <li
                key={`${h.at}-${i}`}
                className={`rounded-lg border px-3 py-2 ${h.kind === 'blocked' ? 'border-red-900/50 bg-red-950/30' : 'border-green-900/50 bg-green-950/20'}`}
              >
                <div className="text-xs text-slate-500 mb-1">{fmtTime(h.at)}</div>
                {h.kind === 'blocked' ? (
                  <p className="text-red-200/90 whitespace-pre-wrap text-xs"><strong className="text-red-300">Bloqueo:</strong> {h.message}</p>
                ) : (
                  <p className="text-green-200/90 whitespace-pre-wrap text-xs"><strong className="text-green-300">Desbloqueo:</strong> {h.note}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ModalChrome>
  );
}

function UserPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setPassword('');
    setPassword2('');
    setConfirmEmail('');
    setErr('');
    setDone(false);
  }, [user]);

  const emailRequired = Boolean(user.email?.trim());

  const handleSubmit = async () => {
    setErr('');
    if (password.length < 6) {
      setErr('Mínimo 6 caracteres.');
      return;
    }
    if (password !== password2) {
      setErr('Las dos contraseñas no coinciden.');
      return;
    }
    if (emailRequired && confirmEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      setErr('Escribe exactamente el email del usuario en el campo de confirmación.');
      return;
    }
    setBusy(true);
    try {
      const key = sessionStorage.getItem('superadmin_key') || '';
      await superadminPerformMutate(key, {
        action: 'set_user_password',
        userId: user.id,
        newPassword: password,
        confirmEmail: emailRequired ? confirmEmail.trim() : '',
      });
      setDone(true);
      onSaved();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalChrome
      title="Nueva contraseña (Auth)"
      subtitle={user.email || user.id}
      onClose={() => !busy && onClose()}
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-200"
          >
            {done ? 'Cerrar' : 'Cancelar'}
          </button>
          {!done && (
            <button
              type="button"
              disabled={
                busy ||
                password.length < 6 ||
                password !== password2 ||
                (emailRequired && confirmEmail.trim().toLowerCase() !== user.email.trim().toLowerCase())
              }
              onClick={() => void handleSubmit()}
              className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              {busy ? 'Guardando…' : 'Establecer contraseña'}
            </button>
          )}
        </div>
      )}
    >
      {done ? (
        <p className="text-sm text-emerald-300">
          Contraseña actualizada en Supabase Auth. El usuario puede iniciar sesión con ella. Entrégala por un canal seguro (WhatsApp, llamada, etc.); no queda guardada en el panel.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-400 mb-3">
            Equivale a un reset manual: invalida la contraseña anterior. Si el usuario usa “olvidé mi contraseña” en el futuro, puede seguir usando el flujo por email del login.
          </p>
          {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const p = randomPasswordForUser(14);
                setPassword(p);
                setPassword2(p);
              }}
              className="text-xs px-2 py-1 rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600"
            >
              Generar contraseña aleatoria
            </button>
            {password.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void navigator.clipboard.writeText(password)}
                className="text-xs px-2 py-1 rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600"
              >
                Copiar contraseña
              </button>
            )}
          </div>
          <label className="block text-xs text-slate-500 mb-1">Nueva contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={busy}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white mb-3"
          />
          <label className="block text-xs text-slate-500 mb-1">Repetir contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={e => setPassword2(e.target.value)}
            disabled={busy}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white mb-3"
          />
          {emailRequired && (
            <>
              <label className="block text-xs text-slate-500 mb-1">
                Confirmación: escribe el email del usuario
              </label>
              <input
                type="email"
                autoComplete="off"
                value={confirmEmail}
                onChange={e => setConfirmEmail(e.target.value)}
                disabled={busy}
                placeholder={user.email}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600"
              />
            </>
          )}
          {!emailRequired && (
            <p className="text-xs text-amber-400/90 mt-2">Esta cuenta no tiene email en el listado; la acción solo exige contraseña válida.</p>
          )}
        </>
      )}
    </ModalChrome>
  );
}

function UserInspectModal({
  user,
  userBusinesses,
  entry,
  onClose,
  onOpenBusiness,
  onShowOverview,
}: {
  user: UserRow;
  userBusinesses: BizRow[];
  entry: UserInspectEntry;
  onClose: () => void;
  onOpenBusiness: (businessId: string, tab: SuperadminBusinessTab) => void;
  onShowOverview: () => void;
}) {
  if (entry !== 'overview') {
    return (
      <ModalChrome
        title={`${USER_DRILL_LABEL[entry.segment]} — ${user.email}`}
        subtitle="Elige un negocio (pestañas). Los datos se cargan al seleccionar."
        onClose={onClose}
      >
        <button
          type="button"
          onClick={onShowOverview}
          className="text-xs text-indigo-400 hover:text-indigo-300 mb-3 font-medium"
        >
          ← Volver al resumen de negocios
        </button>
        <UserDrillByBusinessTabs
          userBusinesses={userBusinesses}
          segment={entry.segment}
          onOpenBusinessFull={onOpenBusiness}
        />
      </ModalChrome>
    );
  }

  return (
    <ModalChrome
      title={user.email}
      subtitle={[user.name, `Registro: ${fmtDate(user.created_at)}`, `Último acceso: ${fmtTime(user.last_sign_in_at)}`].filter(Boolean).join(' · ')}
      onClose={onClose}
    >
      <p className="text-sm text-slate-400 mb-4">
        Totales del usuario: {num(user.businesses)} negocios · {num(user.movements)} movimientos · {num(user.sales)} ventas · {num(user.expenses)} gastos.
        Haz clic en las cifras de la tabla principal para ver listados por negocio.
      </p>
      {user.blocked && (
        <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          <strong className="text-red-300">Acceso bloqueado en la app.</strong>
          {user.block_message ? (
            <p className="mt-1 text-red-200/90 whitespace-pre-wrap text-xs">{user.block_message}</p>
          ) : null}
        </div>
      )}
      {(user.block_history?.length ?? 0) > 0 && (
        <div className="mb-4 rounded-lg border border-slate-800 bg-slate-800/30 p-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Historial de bloqueos</h4>
          <ul className="space-y-2 max-h-40 overflow-y-auto text-xs">
            {[...(user.block_history ?? [])].reverse().map((h, i) => (
              <li key={`${h.at}-${i}`} className="border-l-2 border-slate-600 pl-2">
                <span className="text-slate-500">{fmtTime(h.at)}</span>
                {' — '}
                {h.kind === 'blocked' ? (
                  <span className="text-red-300">Bloqueo: {h.message}</span>
                ) : (
                  <span className="text-green-300">Desbloqueo: {h.note}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {userBusinesses.length === 0 ? (
        <p className="text-slate-500 text-sm">Este usuario no tiene negocios registrados como dueño.</p>
      ) : (
        <div className="rounded-lg border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/80 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Negocio</th>
                <th className="px-3 py-2 text-right">Prod.</th>
                <th className="px-3 py-2 text-right">Emp.</th>
                <th className="px-3 py-2 text-right">Ventas</th>
                <th className="px-3 py-2 text-right">Gastos</th>
                <th className="px-3 py-2 text-right">Movs.</th>
                <th className="px-3 py-2 text-right">Contactos</th>
                <th className="px-3 py-2 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {userBusinesses.map(b => (
                <tr key={b.id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2 text-white font-medium">{b.name}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{num(b.products)}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{num(b.employees)}</td>
                  <td className="px-3 py-2 text-right text-green-400">{num(b.sales)}</td>
                  <td className="px-3 py-2 text-right text-amber-400">{num(b.expenses)}</td>
                  <td className="px-3 py-2 text-right text-indigo-300">{num(b.movements)}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{num(b.customers)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onOpenBusiness(b.id, 'resumen')}
                      className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline"
                    >
                      Ver todo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalChrome>
  );
}

function UserDrillByBusinessTabs({
  userBusinesses,
  segment,
  onOpenBusinessFull,
}: {
  userBusinesses: BizRow[];
  segment: Exclude<SuperadminBusinessTab, 'resumen'>;
  onOpenBusinessFull: (businessId: string, tab: SuperadminBusinessTab) => void;
}) {
  const [bizId, setBizId] = useState<string | null>(() => defaultBusinessIdForSegment(userBusinesses, segment));

  useEffect(() => {
    setBizId(defaultBusinessIdForSegment(userBusinesses, segment));
  }, [userBusinesses, segment]);

  if (!userBusinesses.length) {
    return <p className="text-slate-500 text-sm">Sin negocios para este usuario.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-800 -mx-1 px-1">
        {userBusinesses.map(b => {
          const k = segmentToBizCountKey(segment);
          const n = Number(b[k]);
          const active = bizId === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBizId(b.id)}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium max-w-[160px] truncate transition-colors ${
                active ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title={b.name}
            >
              {b.name}
              <span className="opacity-70 ml-1">({num(n)})</span>
            </button>
          );
        })}
      </div>
      {bizId && (
        <UserDrillBusinessLoader
          businessId={bizId}
          segment={segment}
          onOpenFull={() => onOpenBusinessFull(bizId, segment)}
        />
      )}
    </div>
  );
}

function UserDrillBusinessLoader({
  businessId,
  segment,
  onOpenFull,
}: {
  businessId: string;
  segment: Exclude<SuperadminBusinessTab, 'resumen'>;
  onOpenFull: () => void;
}) {
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<{ loading: boolean; data: any; error: string }>({
    loading: true,
    data: null,
    error: '',
  });

  const mutate = useCallback(async (body: Record<string, unknown>) => {
    const key = sessionStorage.getItem('superadmin_key') || '';
    await superadminPerformMutate(key, body);
    setReloadNonce(n => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = sessionStorage.getItem('superadmin_key') || '';
      setState({ loading: true, data: null, error: '' });
      try {
        const res = await fetchBusinessDetail(businessId, key);
        const text = await res.text();
        let j: any = {};
        try {
          j = JSON.parse(text);
        } catch {
          throw new Error(text.slice(0, 120) || 'Respuesta inválida');
        }
        if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
        if (!cancelled) setState({ loading: false, data: j, error: '' });
      } catch (e: any) {
        if (!cancelled) setState({ loading: false, data: null, error: e?.message || String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, reloadNonce]);

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={onOpenFull}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
        >
          Abrir panel completo del negocio →
        </button>
      </div>
      {state.loading && <p className="text-slate-400 text-sm py-6">Cargando…</p>}
      {state.error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-3 py-2">{state.error}</div>
      )}
      {!state.loading && state.data && (
        <BusinessDetailPanel
          activeTab={segment}
          data={state.data}
          businessId={businessId}
          mutate={mutate}
        />
      )}
    </div>
  );
}

const BIZ_TABS: { id: SuperadminBusinessTab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'productos', label: 'Productos' },
  { id: 'empleados', label: 'Empleados' },
  { id: 'contactos', label: 'Contactos' },
];

type SuperadminMutateFn = (body: Record<string, unknown>) => Promise<void>;

function SalesSuperTable({
  sales,
  businessName,
  businessId,
  mutate,
}: {
  sales: any[];
  businessName: string;
  businessId: string;
  mutate: SuperadminMutateFn;
}) {
  const [editSale, setEditSale] = useState<any | null>(null);
  const [delSale, setDelSale] = useState<any | null>(null);
  const [bulkDelOpen, setBulkDelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState('');
  const [payStatus, setPayStatus] = useState('paid');
  const [paidAmt, setPaidAmt] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');

  const saleIds = useMemo(() => sales.map(s => String(s.id)).filter(Boolean), [sales]);

  useEffect(() => {
    const set = new Set(saleIds);
    setSelectedIds(prev => prev.filter(id => set.has(id)));
  }, [saleIds]);

  useEffect(() => {
    if (editSale) {
      setNotes(String(editSale.notes ?? ''));
      setPayStatus(String(editSale.payment_status ?? 'paid'));
      setPaidAmt(editSale.paid_amount != null && editSale.paid_amount !== '' ? String(editSale.paid_amount) : '');
    }
  }, [editSale]);

  const allSelected = saleIds.length > 0 && selectedIds.length === saleIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  if (!sales.length) {
    return <p className="text-slate-500 text-sm py-6 text-center">Sin ventas</p>;
  }
  const bn = businessName || '—';

  return (
    <>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
          <span className="text-sm text-slate-400">{selectedIds.length} venta(s) seleccionada(s)</span>
          <button
            type="button"
            onClick={() => { setLocalErr(''); setBulkDelOpen(true); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-950"
          >
            Eliminar seleccionadas
          </button>
        </div>
      )}
      <div className="rounded-lg border border-slate-800 overflow-x-auto max-h-[55vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-2 py-2 w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelectedIds(allSelected ? [] : [...saleIds])}
                  className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                  aria-label="Seleccionar todas las ventas"
                />
              </th>
              <th className="px-3 py-2 text-left">Nº venta</th>
              <th className="px-3 py-2 text-left">Concepto</th>
              <th className="px-3 py-2 text-left">Negocio</th>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Método de pago</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Estado pago</th>
              <th className="px-3 py-2 text-right w-32">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sales.map((s, i) => {
              const concept = saleConceptLabel(s);
              const sid = String(s.id ?? '');
              return (
                <tr key={s.id || `s-${i}`} className="hover:bg-slate-800/30">
                  <td className="px-2 py-2 align-middle">
                    {sid ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(sid)}
                        onChange={() => toggleId(sid)}
                        className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                        aria-label={`Seleccionar venta ${s.sale_number ?? sid}`}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-100 font-medium whitespace-nowrap">{s.sale_number ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-200 max-w-[240px] truncate" title={concept}>{concept}</td>
                  <td className="px-3 py-2 text-slate-300 max-w-[180px] truncate" title={bn}>{bn}</td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{s.created_at ? fmtTime(s.created_at) : '—'}</td>
                  <td className="px-3 py-2 text-slate-200">{superadminSalePaymentLabel(s)}</td>
                  <td className="px-3 py-2 text-right text-green-400 tabular-nums">{formatMoney(s.total)}</td>
                  <td className="px-3 py-2 text-slate-400">{paymentStatusLabelEs(s.payment_status)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap space-x-2">
                    <button type="button" className="text-indigo-400 hover:text-indigo-300 text-xs" onClick={() => setEditSale(s)}>Editar</button>
                    <button type="button" className="text-red-400 hover:text-red-300 text-xs" onClick={() => setDelSale(s)}>Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editSale && (
        <ModalChrome
          title="Editar venta"
          subtitle={saleConceptLabel(editSale)}
          onClose={() => !busy && setEditSale(null)}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setEditSale(null)} className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-200">Cancelar</button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setLocalErr('');
                  try {
                    const patch: Record<string, unknown> = { notes, payment_status: payStatus };
                    if (paidAmt.trim() !== '') patch.paid_amount = Number(paidAmt);
                    await mutate({ action: 'patch_sale', businessId, id: editSale.id, patch });
                    setEditSale(null);
                  } catch (e: any) {
                    setLocalErr(e?.message || String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 text-white"
              >
                Guardar
              </button>
            </div>
          )}
        >
          {localErr && <p className="text-red-400 text-sm mb-3">{localErr}</p>}
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="text-slate-400 text-xs">Notas</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white min-h-[80px]" />
            </label>
            <label className="block">
              <span className="text-slate-400 text-xs">Estado de pago</span>
              <select value={payStatus} onChange={e => setPayStatus(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white">
                <option value="paid">paid</option>
                <option value="pending">pending</option>
                <option value="partial">partial</option>
              </select>
            </label>
            <label className="block">
              <span className="text-slate-400 text-xs">Monto pagado (opcional)</span>
              <input value={paidAmt} onChange={e => setPaidAmt(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" />
            </label>
          </div>
        </ModalChrome>
      )}

      <ConfirmDangerModal
        open={!!delSale}
        title="Eliminar venta"
        description={<p>Se borrará la venta <strong>{delSale ? saleConceptLabel(delSale) : ''}</strong> y sus ítems asociados en base de datos.</p>}
        confirmWord="ELIMINAR"
        onClose={() => !busy && setDelSale(null)}
        busy={busy}
        errorMsg={localErr}
        onConfirm={async () => {
          if (!delSale?.id) return;
          setBusy(true);
          setLocalErr('');
          try {
            await mutate({ action: 'delete_sale', businessId, id: delSale.id });
            setDelSale(null);
          } catch (e: any) {
            setLocalErr(e?.message || String(e));
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDangerModal
        open={bulkDelOpen}
        title={`Eliminar ${selectedIds.length} venta(s)`}
        description={(
          <p>
            Se borrarán <strong className="text-white">{selectedIds.length}</strong> venta(s) y sus ítems asociados. Irreversible.
          </p>
        )}
        confirmWord="ELIMINAR VENTAS"
        onClose={() => !busy && setBulkDelOpen(false)}
        busy={busy}
        errorMsg={localErr}
        onConfirm={async () => {
          setBusy(true);
          setLocalErr('');
          try {
            for (const id of selectedIds) {
              await mutate({ action: 'delete_sale', businessId, id });
            }
            setSelectedIds([]);
            setBulkDelOpen(false);
          } catch (e: any) {
            setLocalErr(e?.message || String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

function ExpensesSuperTable({
  expenses,
  businessName,
  businessId,
  mutate,
}: {
  expenses: any[];
  businessName: string;
  businessId: string;
  mutate: SuperadminMutateFn;
}) {
  const [bulkDelOpen, setBulkDelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');

  const expenseIds = useMemo(() => expenses.map(e => String(e.id)).filter(Boolean), [expenses]);

  useEffect(() => {
    const set = new Set(expenseIds);
    setSelectedIds(prev => prev.filter(id => set.has(id)));
  }, [expenseIds]);

  const allSelected = expenseIds.length > 0 && selectedIds.length === expenseIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  if (!expenses.length) {
    return <p className="text-slate-500 text-sm py-6 text-center">Sin gastos</p>;
  }
  const bn = businessName || '—';

  return (
    <>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
          <span className="text-sm text-slate-400">{selectedIds.length} gasto(s) seleccionado(s)</span>
          <button
            type="button"
            onClick={() => { setLocalErr(''); setBulkDelOpen(true); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-950"
          >
            Eliminar seleccionados
          </button>
        </div>
      )}
      <div className="rounded-lg border border-slate-800 overflow-x-auto max-h-[55vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-2 py-2 w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelectedIds(allSelected ? [] : [...expenseIds])}
                  className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                  aria-label="Seleccionar todos los gastos"
                />
              </th>
              <th className="px-3 py-2 text-left">Ref.</th>
              <th className="px-3 py-2 text-left">Concepto</th>
              <th className="px-3 py-2 text-left">Negocio</th>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Método de pago</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Estado pago</th>
              <th className="px-3 py-2 text-right w-32">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {expenses.map((e, i) => {
              const concept = expenseConceptLabel(e);
              const eid = String(e.id ?? '');
              return (
                <tr key={e.id || `e-${i}`} className="hover:bg-slate-800/30">
                  <td className="px-2 py-2 align-middle">
                    {eid ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(eid)}
                        onChange={() => toggleId(eid)}
                        className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                        aria-label={`Seleccionar gasto ${expenseRef(e)}`}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-100 font-medium whitespace-nowrap font-mono text-xs">{expenseRef(e)}</td>
                  <td className="px-3 py-2 text-slate-200 max-w-[240px] truncate" title={concept}>{concept}</td>
                  <td className="px-3 py-2 text-slate-300 max-w-[180px] truncate" title={bn}>{bn}</td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{e.created_at ? fmtTime(e.created_at) : '—'}</td>
                  <td className="px-3 py-2 text-slate-200">{superadminExpensePaymentLabel(e)}</td>
                  <td className="px-3 py-2 text-right text-amber-400 tabular-nums">{formatMoney(e.amount)}</td>
                  <td className="px-3 py-2 text-slate-400">{paymentStatusLabelEs(e.payment_status)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <ExpenseRowActions row={e as Record<string, unknown>} businessId={businessId} mutate={mutate} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDangerModal
        open={bulkDelOpen}
        title={`Eliminar ${selectedIds.length} gasto(s)`}
        description={(
          <p>
            Se borrarán <strong className="text-white">{selectedIds.length}</strong> gasto(s). Irreversible.
          </p>
        )}
        confirmWord="ELIMINAR GASTOS"
        onClose={() => !busy && setBulkDelOpen(false)}
        busy={busy}
        errorMsg={localErr}
        onConfirm={async () => {
          setBusy(true);
          setLocalErr('');
          try {
            for (const id of selectedIds) {
              await mutate({ action: 'delete_expense', businessId, id });
            }
            setSelectedIds([]);
            setBulkDelOpen(false);
          } catch (err: any) {
            setLocalErr(err?.message || String(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

function ProductsSuperTable({
  products,
  businessId,
  mutate,
}: {
  products: any[];
  businessId: string;
  mutate: SuperadminMutateFn;
}) {
  const [editP, setEditP] = useState<any | null>(null);
  const [delP, setDelP] = useState<any | null>(null);
  const [bulkDelOpen, setBulkDelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');

  const productIds = useMemo(() => products.map(p => String(p.id)).filter(Boolean), [products]);

  useEffect(() => {
    const set = new Set(productIds);
    setSelectedIds(prev => prev.filter(id => set.has(id)));
  }, [productIds]);

  useEffect(() => {
    if (editP) {
      setName(String(editP.name ?? ''));
      setPrice(editP.price != null ? String(editP.price) : '');
      setCost(editP.cost != null ? String(editP.cost) : '');
      setStock(editP.stock != null ? String(editP.stock) : '');
      setSku(String(editP.sku ?? ''));
      setCategory(String(editP.category ?? ''));
    }
  }, [editP]);

  const allSelected = productIds.length > 0 && selectedIds.length === productIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  if (!products.length) {
    return <p className="text-slate-500 text-sm py-6 text-center">Sin productos</p>;
  }

  return (
    <>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
          <span className="text-sm text-slate-400">{selectedIds.length} producto(s) seleccionado(s)</span>
          <button
            type="button"
            onClick={() => { setLocalErr(''); setBulkDelOpen(true); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-950"
          >
            Eliminar seleccionados
          </button>
        </div>
      )}
      <div className="rounded-lg border border-slate-800 overflow-x-auto max-h-[55vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-2 py-2 w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelectedIds(allSelected ? [] : [...productIds])}
                  className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                  aria-label="Seleccionar todos los productos"
                />
              </th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-right">Precio</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2 text-left">Categoría</th>
              <th className="px-3 py-2 text-left">Creado</th>
              <th className="px-3 py-2 text-left">Última modificación</th>
              <th className="px-3 py-2 text-right w-28">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {products.map((p, i) => {
              const pid = String(p.id ?? '');
              return (
              <tr key={p.id || `p-${i}`} className="hover:bg-slate-800/30">
                <td className="px-2 py-2 align-middle">
                  {pid ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(pid)}
                      onChange={() => toggleId(pid)}
                      className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                      aria-label={`Seleccionar ${p.name ?? 'producto'}`}
                    />
                  ) : null}
                </td>
                <td className="px-3 py-2 text-slate-100 font-medium max-w-[200px] truncate" title={p.name}>{p.name ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-200">{formatMoney(p.price)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-200/90">{p.cost != null ? formatMoney(p.cost) : '—'}</td>
                <td className="px-3 py-2 text-slate-400 font-mono text-xs">{p.sku ?? '—'}</td>
                <td className="px-3 py-2 text-right text-slate-300">{p.stock != null ? num(Number(p.stock)) : '—'}</td>
                <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate" title={p.category}>{p.category ?? '—'}</td>
                <td className="px-3 py-2 text-slate-400 whitespace-nowrap text-xs">{p.created_at ? fmtTime(p.created_at) : '—'}</td>
                <td className="px-3 py-2 text-slate-400 whitespace-nowrap text-xs">{p.updated_at ? fmtTime(p.updated_at) : '—'}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap space-x-2">
                  <button type="button" className="text-indigo-400 hover:text-indigo-300 text-xs" onClick={() => setEditP(p)}>Editar</button>
                  <button type="button" className="text-red-400 hover:text-red-300 text-xs" onClick={() => setDelP(p)}>Eliminar</button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      {editP && (
        <ModalChrome
          title="Editar producto"
          subtitle={String(editP.name ?? '')}
          onClose={() => !busy && setEditP(null)}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setEditP(null)} className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-200">Cancelar</button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setLocalErr('');
                  try {
                    await mutate({
                      action: 'patch_product',
                      businessId,
                      id: editP.id,
                      patch: {
                        name,
                        price: Number(price),
                        cost: cost === '' ? undefined : Number(cost),
                        stock: stock === '' ? undefined : Number(stock),
                        sku: sku || null,
                        category: category || null,
                      },
                    });
                    setEditP(null);
                  } catch (e: any) {
                    setLocalErr(e?.message || String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 text-white"
              >
                Guardar
              </button>
            </div>
          )}
        >
          {localErr && <p className="text-red-400 text-sm mb-3">{localErr}</p>}
          <div className="space-y-2 text-sm">
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Nombre" />
            <div className="grid grid-cols-2 gap-2">
              <input value={price} onChange={e => setPrice(e.target.value)} className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Precio" />
              <input value={cost} onChange={e => setCost(e.target.value)} className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Costo" />
            </div>
            <input value={stock} onChange={e => setStock(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Stock" />
            <input value={sku} onChange={e => setSku(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="SKU" />
            <input value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Categoría" />
          </div>
        </ModalChrome>
      )}

      <ConfirmDangerModal
        open={!!delP}
        title="Eliminar producto"
        description={<p>Producto: <strong>{delP?.name ?? ''}</strong></p>}
        confirmWord="ELIMINAR"
        onClose={() => !busy && setDelP(null)}
        busy={busy}
        errorMsg={localErr}
        onConfirm={async () => {
          if (!delP?.id) return;
          setBusy(true);
          setLocalErr('');
          try {
            await mutate({ action: 'delete_product', businessId, id: delP.id });
            setDelP(null);
          } catch (e: any) {
            setLocalErr(e?.message || String(e));
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDangerModal
        open={bulkDelOpen}
        title={`Eliminar ${selectedIds.length} producto(s)`}
        description={<p>Se borrarán de forma permanente. Irreversible.</p>}
        confirmWord="ELIMINAR PRODUCTOS"
        onClose={() => !busy && setBulkDelOpen(false)}
        busy={busy}
        errorMsg={localErr}
        onConfirm={async () => {
          setBusy(true);
          setLocalErr('');
          try {
            for (const id of selectedIds) {
              await mutate({ action: 'delete_product', businessId, id });
            }
            setSelectedIds([]);
            setBulkDelOpen(false);
          } catch (e: any) {
            setLocalErr(e?.message || String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

function MovementRowActions({
  m,
  businessId,
  mutate,
}: {
  m: { kind: 'venta' | 'gasto'; sourceId: string; label: string };
  businessId: string;
  mutate: SuperadminMutateFn;
}) {
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <>
      <button type="button" className="text-xs text-red-400 hover:text-red-300" onClick={() => setDelOpen(true)}>Eliminar</button>
      <ConfirmDangerModal
        open={delOpen}
        title={m.kind === 'venta' ? 'Eliminar venta' : 'Eliminar gasto'}
        description={<p>Registro: <strong>{m.label}</strong></p>}
        confirmWord="ELIMINAR"
        onClose={() => !busy && setDelOpen(false)}
        busy={busy}
        errorMsg={err}
        onConfirm={async () => {
          setBusy(true);
          setErr('');
          try {
            await mutate({
              action: m.kind === 'venta' ? 'delete_sale' : 'delete_expense',
              businessId,
              id: m.sourceId,
            });
            setDelOpen(false);
          } catch (e: any) {
            setErr(e?.message || String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

type MergedMovementRow = ReturnType<typeof buildMergedMovements>[number];

function movementRowKey(m: MergedMovementRow): string {
  return `${m.kind}:${m.sourceId}`;
}

function MovementsSuperTable({
  movements,
  businessId,
  mutate,
}: {
  movements: MergedMovementRow[];
  businessId: string;
  mutate: SuperadminMutateFn;
}) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkDelOpen, setBulkDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);

  const rowKeys = useMemo(() => movements.map(movementRowKey), [movements]);

  useEffect(() => {
    const set = new Set(rowKeys);
    setSelectedKeys(prev => prev.filter(k => set.has(k)));
  }, [rowKeys]);

  const allSelected = rowKeys.length > 0 && selectedKeys.length === rowKeys.length;
  const someSelected = selectedKeys.length > 0 && !allSelected;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleKey = (k: string) => {
    setSelectedKeys(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]));
  };

  if (!movements.length) {
    return <p className="text-slate-500 text-sm py-6 text-center">Sin movimientos</p>;
  }

  return (
    <>
      {selectedKeys.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
          <span className="text-sm text-slate-400">{selectedKeys.length} movimiento(s) seleccionado(s)</span>
          <button
            type="button"
            onClick={() => { setLocalErr(''); setBulkDelOpen(true); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-950"
          >
            Eliminar seleccionados
          </button>
        </div>
      )}
      <div className="rounded-lg border border-slate-800 overflow-x-auto max-h-[55vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-2 py-2 w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelectedKeys(allSelected ? [] : [...rowKeys])}
                  className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                  aria-label="Seleccionar todos los movimientos"
                />
              </th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Concepto</th>
              <th className="px-3 py-2 text-left">Método de pago</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2 text-right w-24">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {movements.map(m => {
              const k = movementRowKey(m);
              return (
                <tr key={k} className="hover:bg-slate-800/30">
                  <td className="px-2 py-2 align-middle">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(k)}
                      onChange={() => toggleKey(k)}
                      className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                      aria-label={`Seleccionar ${m.label}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className={m.kind === 'venta' ? 'text-green-400' : 'text-amber-400'}>
                      {m.kind === 'venta' ? 'Venta' : 'Gasto'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtTime(m.at)}</td>
                  <td className="px-3 py-2 text-slate-200 max-w-[220px] truncate" title={m.label}>{m.label}</td>
                  <td className="px-3 py-2 text-slate-300 text-xs">
                    {m.kind === 'venta'
                      ? superadminSalePaymentLabel((m as any).saleSource)
                      : superadminExpensePaymentLabel((m as any).expenseSource)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white">{formatMoney(m.amount)}</td>
                  <td className="px-3 py-2 text-right">
                    <MovementRowActions m={m} businessId={businessId} mutate={mutate} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDangerModal
        open={bulkDelOpen}
        title={`Eliminar ${selectedKeys.length} movimiento(s)`}
        description={<p>Ventas y gastos seleccionados se borrarán de la base de datos. Irreversible.</p>}
        confirmWord="ELIMINAR MOVIMIENTOS"
        onClose={() => !busy && setBulkDelOpen(false)}
        busy={busy}
        errorMsg={localErr}
        onConfirm={async () => {
          setBusy(true);
          setLocalErr('');
          try {
            for (const keyStr of selectedKeys) {
              const colon = keyStr.indexOf(':');
              const kind = keyStr.slice(0, colon);
              const id = keyStr.slice(colon + 1);
              await mutate({
                action: kind === 'venta' ? 'delete_sale' : 'delete_expense',
                businessId,
                id,
              });
            }
            setSelectedKeys([]);
            setBulkDelOpen(false);
          } catch (e: any) {
            setLocalErr(e?.message || String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

function ExpenseRowActions({
  row,
  businessId,
  mutate,
}: {
  row: Record<string, unknown>;
  businessId: string;
  mutate: SuperadminMutateFn;
}) {
  const id = String(row.id ?? '');
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [amount, setAmount] = useState(String(row.amount ?? ''));
  const [description, setDescription] = useState(String(row.description ?? ''));
  const [category, setCategory] = useState(String(row.category ?? ''));

  useEffect(() => {
    if (editOpen) {
      setAmount(String(row.amount ?? ''));
      setDescription(String(row.description ?? ''));
      setCategory(String(row.category ?? ''));
    }
  }, [editOpen, row]);

  return (
    <>
      <span className="space-x-2 whitespace-nowrap">
        <button type="button" className="text-indigo-400 hover:text-indigo-300 text-xs" onClick={() => setEditOpen(true)}>Editar</button>
        <button type="button" className="text-red-400 hover:text-red-300 text-xs" onClick={() => setDelOpen(true)}>Eliminar</button>
      </span>
      {editOpen && (
        <ModalChrome
          title="Editar gasto"
          subtitle={description || 'Gasto'}
          onClose={() => !busy && setEditOpen(false)}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setEditOpen(false)} className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-200">Cancelar</button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setErr('');
                  try {
                    await mutate({
                      action: 'patch_expense',
                      businessId,
                      id,
                      patch: { amount: Number(amount), description, category },
                    });
                    setEditOpen(false);
                  } catch (e: any) {
                    setErr(e?.message || String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 text-white"
              >
                Guardar
              </button>
            </div>
          )}
        >
          {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
          <div className="space-y-2 text-sm">
            <input value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Categoría" />
            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Descripción" />
            <input value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Monto" />
          </div>
        </ModalChrome>
      )}
      <ConfirmDangerModal
        open={delOpen}
        title="Eliminar gasto"
        description={<p>{String(row.description ?? row.category ?? 'Gasto')}</p>}
        confirmWord="ELIMINAR"
        onClose={() => !busy && setDelOpen(false)}
        busy={busy}
        errorMsg={err}
        onConfirm={async () => {
          setBusy(true);
          setErr('');
          try {
            await mutate({ action: 'delete_expense', businessId, id });
            setDelOpen(false);
          } catch (e: any) {
            setErr(e?.message || String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

function EmployeeRowActions({
  row,
  businessId,
  mutate,
}: {
  row: Record<string, unknown>;
  businessId: string;
  mutate: SuperadminMutateFn;
}) {
  const id = String(row.id ?? '');
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [name, setName] = useState(String(row.name ?? ''));
  const [email, setEmail] = useState(String(row.email ?? ''));
  const [role, setRole] = useState(String(row.role ?? 'cashier'));

  useEffect(() => {
    if (editOpen) {
      setName(String(row.name ?? ''));
      setEmail(String(row.email ?? ''));
      setRole(String(row.role ?? 'cashier'));
    }
  }, [editOpen, row]);

  return (
    <>
      <span className="space-x-2 whitespace-nowrap">
        <button type="button" className="text-indigo-400 hover:text-indigo-300 text-xs" onClick={() => setEditOpen(true)}>Editar</button>
        <button type="button" className="text-red-400 hover:text-red-300 text-xs" onClick={() => setDelOpen(true)}>Eliminar</button>
      </span>
      {editOpen && (
        <ModalChrome
          title="Editar empleado"
          subtitle={name}
          onClose={() => !busy && setEditOpen(false)}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setEditOpen(false)} className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-200">Cancelar</button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setErr('');
                  try {
                    await mutate({ action: 'patch_employee', businessId, id, patch: { name, email, role } });
                    setEditOpen(false);
                  } catch (e: any) {
                    setErr(e?.message || String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 text-white"
              >
                Guardar
              </button>
            </div>
          )}
        >
          {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
          <div className="space-y-2 text-sm">
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Nombre" />
            <input value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Email" />
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white">
              <option value="admin">admin</option>
              <option value="manager">manager</option>
              <option value="cashier">cashier</option>
              <option value="inventory">inventory</option>
              <option value="readonly">readonly</option>
            </select>
          </div>
        </ModalChrome>
      )}
      <ConfirmDangerModal
        open={delOpen}
        title="Eliminar empleado"
        description={<p>{String(row.name ?? row.email)}</p>}
        confirmWord="ELIMINAR"
        onClose={() => !busy && setDelOpen(false)}
        busy={busy}
        errorMsg={err}
        onConfirm={async () => {
          setBusy(true);
          setErr('');
          try {
            await mutate({ action: 'delete_employee', businessId, id });
            setDelOpen(false);
          } catch (e: any) {
            setErr(e?.message || String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

function CustomerRowActions({
  row,
  businessId,
  mutate,
}: {
  row: Record<string, unknown>;
  businessId: string;
  mutate: SuperadminMutateFn;
}) {
  const id = String(row.id ?? '');
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [name, setName] = useState(String(row.name ?? ''));
  const [email, setEmail] = useState(String(row.email ?? ''));
  const [phone, setPhone] = useState(String(row.phone ?? ''));
  const [address, setAddress] = useState(String(row.address ?? ''));

  useEffect(() => {
    if (editOpen) {
      setName(String(row.name ?? ''));
      setEmail(String(row.email ?? ''));
      setPhone(String(row.phone ?? ''));
      setAddress(String(row.address ?? ''));
    }
  }, [editOpen, row]);

  return (
    <>
      <span className="space-x-2 whitespace-nowrap">
        <button type="button" className="text-indigo-400 hover:text-indigo-300 text-xs" onClick={() => setEditOpen(true)}>Editar</button>
        <button type="button" className="text-red-400 hover:text-red-300 text-xs" onClick={() => setDelOpen(true)}>Eliminar</button>
      </span>
      {editOpen && (
        <ModalChrome
          title="Editar contacto"
          subtitle={name}
          onClose={() => !busy && setEditOpen(false)}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setEditOpen(false)} className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-200">Cancelar</button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setErr('');
                  try {
                    await mutate({
                      action: 'patch_customer',
                      businessId,
                      id,
                      patch: { name, email: email || null, phone: phone || null, address: address || null },
                    });
                    setEditOpen(false);
                  } catch (e: any) {
                    setErr(e?.message || String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 text-white"
              >
                Guardar
              </button>
            </div>
          )}
        >
          {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
          <div className="space-y-2 text-sm">
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Nombre" />
            <input value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Email" />
            <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="+593 99 123 4567" />
            <input value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Ej: Av. Amazonas N34-123, Quito" />
          </div>
        </ModalChrome>
      )}
      <ConfirmDangerModal
        open={delOpen}
        title="Eliminar contacto"
        description={<p>{String(row.name ?? '')}</p>}
        confirmWord="ELIMINAR"
        onClose={() => !busy && setDelOpen(false)}
        busy={busy}
        errorMsg={err}
        onConfirm={async () => {
          setBusy(true);
          setErr('');
          try {
            await mutate({ action: 'delete_customer', businessId, id });
            setDelOpen(false);
          } catch (e: any) {
            setErr(e?.message || String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

function BusinessDetailPanel({
  activeTab,
  data,
  businessId,
  mutate,
  onBusinessDeleted,
}: {
  activeTab: SuperadminBusinessTab;
  data: any;
  businessId: string;
  mutate: SuperadminMutateFn;
  onBusinessDeleted?: () => void;
}) {
  const mergedMovements = useMemo(() => buildMergedMovements(data), [data]);
  const b = data?.business;

  const [bizEditOpen, setBizEditOpen] = useState(false);
  const [bizDelOpen, setBizDelOpen] = useState(false);
  const [bizName, setBizName] = useState(String(b?.name ?? ''));
  const [bizBusy, setBizBusy] = useState(false);
  const [bizErr, setBizErr] = useState('');

  useEffect(() => {
    setBizName(String(b?.name ?? ''));
  }, [b?.name]);

  return (
    <>
      {activeTab === 'resumen' && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="text-slate-500 text-xs">Productos</div>
              <div className="text-xl font-semibold text-white">{num((data.products || []).length)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="text-slate-500 text-xs">Empleados</div>
              <div className="text-xl font-semibold text-white">{num((data.employees || []).length)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="text-slate-500 text-xs">Ventas (cargadas)</div>
              <div className="text-xl font-semibold text-green-400">{num((data.sales || []).length)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="text-slate-500 text-xs">Gastos (cargados)</div>
              <div className="text-xl font-semibold text-amber-400">{num((data.expenses || []).length)}</div>
            </div>
          </div>
          {b?.id && <p className="text-xs text-slate-500 font-mono break-all">ID: {b.id}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => setBizEditOpen(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-indigo-300 hover:bg-slate-700"
            >
              Editar nombre del negocio
            </button>
            <button
              type="button"
              onClick={() => setBizDelOpen(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-900 text-red-400 hover:bg-red-950"
            >
              Eliminar negocio completo
            </button>
          </div>

          {bizEditOpen && (
            <ModalChrome
              title="Editar negocio"
              subtitle={String(b?.name ?? '')}
              onClose={() => !bizBusy && setBizEditOpen(false)}
              footer={(
                <div className="flex justify-end gap-2">
                  <button type="button" disabled={bizBusy} onClick={() => setBizEditOpen(false)} className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-200">Cancelar</button>
                  <button
                    type="button"
                    disabled={bizBusy}
                    onClick={async () => {
                      setBizBusy(true);
                      setBizErr('');
                      try {
                        await mutate({ action: 'patch_business', businessId, patch: { name: bizName } });
                        setBizEditOpen(false);
                      } catch (e: any) {
                        setBizErr(e?.message || String(e));
                      } finally {
                        setBizBusy(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 text-white"
                  >
                    Guardar
                  </button>
                </div>
              )}
            >
              {bizErr && <p className="text-red-400 text-sm mb-2">{bizErr}</p>}
              <input value={bizName} onChange={e => setBizName(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" placeholder="Nombre del negocio" />
            </ModalChrome>
          )}

          <ConfirmDangerModal
            open={bizDelOpen}
            title="Eliminar negocio completo"
            description={(
              <div className="space-y-2">
                <p>Se eliminará el negocio <strong>{b?.name}</strong> y todos los datos enlazados (ventas, productos, empleados, etc.) por cascada en base de datos.</p>
                <p className="text-amber-400/90 text-xs">Esta acción no se puede deshacer.</p>
              </div>
            )}
            confirmWord="ELIMINAR NEGOCIO"
            onClose={() => !bizBusy && setBizDelOpen(false)}
            busy={bizBusy}
            errorMsg={bizErr}
            onConfirm={async () => {
              setBizBusy(true);
              setBizErr('');
              try {
                await mutate({ action: 'delete_business', businessId });
                setBizDelOpen(false);
                onBusinessDeleted?.();
              } catch (e: any) {
                setBizErr(e?.message || String(e));
              } finally {
                setBizBusy(false);
              }
            }}
          />
        </div>
      )}

      {activeTab === 'movimientos' && (
        <MovementsSuperTable movements={mergedMovements} businessId={businessId} mutate={mutate} />
      )}

      {activeTab === 'ventas' && (
        <SalesSuperTable sales={data.sales || []} businessName={b?.name || ''} businessId={businessId} mutate={mutate} />
      )}
      {activeTab === 'gastos' && (
        <ExpensesSuperTable
          expenses={data.expenses || []}
          businessName={b?.name || ''}
          businessId={businessId}
          mutate={mutate}
        />
      )}
      {activeTab === 'productos' && (
        <ProductsSuperTable products={data.products || []} businessId={businessId} mutate={mutate} />
      )}
      {activeTab === 'empleados' && (
        <JsonishTable
          rows={data.employees || []}
          empty="Sin empleados"
          pick={['name', 'email', 'role', 'is_active']}
          bulkDelete={{
            mutate,
            businessId,
            action: 'delete_employee',
            confirmWord: 'ELIMINAR EMPLEADOS',
            itemNoun: 'empleado(s)',
          }}
          rowActions={row => <EmployeeRowActions row={row} businessId={businessId} mutate={mutate} />}
        />
      )}
      {activeTab === 'contactos' && (
        <JsonishTable
          rows={data.customers || []}
          empty="Sin contactos"
          pick={['name', 'email', 'phone', 'address']}
          bulkDelete={{
            mutate,
            businessId,
            action: 'delete_customer',
            confirmWord: 'ELIMINAR CONTACTOS',
            itemNoun: 'contacto(s)',
          }}
          rowActions={row => <CustomerRowActions row={row} businessId={businessId} mutate={mutate} />}
        />
      )}
    </>
  );
}

function BusinessInspectModal({
  businessId,
  summary,
  ownerEmail,
  initialTab,
  onClose,
  onBack,
  onBusinessDeleted,
}: {
  businessId: string;
  summary: BizRow | null;
  ownerEmail: string;
  initialTab: SuperadminBusinessTab;
  onClose: () => void;
  onBack?: () => void;
  onBusinessDeleted?: () => void;
}) {
  const [tab, setTab] = useState<SuperadminBusinessTab>(initialTab);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<{ loading: boolean; data: any; error: string }>({ loading: true, data: null, error: '' });

  const mutate = useCallback(async (body: Record<string, unknown>) => {
    const key = sessionStorage.getItem('superadmin_key') || '';
    await superadminPerformMutate(key, body);
    setReloadNonce(n => n + 1);
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, businessId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = sessionStorage.getItem('superadmin_key') || '';
      setState({ loading: true, data: null, error: '' });
      try {
        const res = await fetchBusinessDetail(businessId, key);
        const text = await res.text();
        let j: any = {};
        try {
          j = JSON.parse(text);
        } catch {
          throw new Error(text.slice(0, 120) || 'Respuesta inválida');
        }
        if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
        if (!cancelled) setState({ loading: false, data: j, error: '' });
      } catch (e: any) {
        if (!cancelled) setState({ loading: false, data: null, error: e?.message || String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, reloadNonce]);

  const b = state.data?.business;
  const title = (b?.name as string) || summary?.name || 'Negocio';
  const sub = ownerEmail ? `Dueño: ${ownerEmail}` : undefined;

  const footer = onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
    >
      ← Volver al usuario
    </button>
  ) : undefined;

  return (
    <ModalChrome title={title} subtitle={sub} onClose={onClose} footer={footer}>
      {state.loading && <p className="text-slate-400 text-sm">Cargando detalle…</p>}
      {state.error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-3 py-2">{state.error}</div>
      )}
      {!state.loading && state.data && (
        <>
          <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-800 pb-2">
            {BIZ_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tab === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <BusinessDetailPanel
            activeTab={tab}
            data={state.data}
            businessId={businessId}
            mutate={mutate}
            onBusinessDeleted={onBusinessDeleted}
          />
        </>
      )}
    </ModalChrome>
  );
}

/** Tabla genérica a partir de objetos (primeras columnas útiles). */
function JsonishTable({
  rows,
  empty,
  pick,
  greenAmount,
  rowActions,
  bulkDelete,
}: {
  rows: Record<string, unknown>[];
  empty: string;
  pick?: string[];
  greenAmount?: boolean;
  rowActions?: (row: Record<string, unknown>) => ReactNode;
  bulkDelete?: {
    mutate: SuperadminMutateFn;
    businessId: string;
    action: 'delete_expense' | 'delete_employee' | 'delete_customer';
    confirmWord: string;
    itemNoun: string;
  };
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDelOpen, setBulkDelOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkErr, setBulkErr] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);

  const rowIds = useMemo(
    () => rows.map(r => String(r.id ?? '')).filter(Boolean),
    [rows],
  );

  useEffect(() => {
    const set = new Set(rowIds);
    setSelectedIds(prev => prev.filter(id => set.has(id)));
  }, [rowIds]);

  const allSelected = rowIds.length > 0 && selectedIds.length === rowIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  if (!rows.length) {
    return <p className="text-slate-500 text-sm py-6 text-center">{empty}</p>;
  }
  const keys = pick?.length
    ? pick
    : Array.from(
        new Set(
          rows.flatMap(r => Object.keys(r).filter(k => !['items', 'payments', 'metadata'].includes(k))),
        ),
      ).slice(0, 8);

  const showBulk = Boolean(bulkDelete);

  return (
    <>
      {showBulk && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
          <span className="text-sm text-slate-400">
            {selectedIds.length} {bulkDelete!.itemNoun} seleccionado(s)
          </span>
          <button
            type="button"
            onClick={() => { setBulkErr(''); setBulkDelOpen(true); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-950"
          >
            Eliminar seleccionados
          </button>
        </div>
      )}
      <div className="rounded-lg border border-slate-800 overflow-x-auto max-h-[55vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-xs text-slate-400 uppercase">
            <tr>
              {showBulk && (
                <th className="px-2 py-2 w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelectedIds(allSelected ? [] : [...rowIds])}
                    className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                    aria-label="Seleccionar todas las filas"
                  />
                </th>
              )}
              {keys.map(k => (
                <th key={k} className="px-3 py-2 text-left font-semibold">{k.replace(/_/g, ' ')}</th>
              ))}
              {rowActions && <th className="px-3 py-2 text-right font-semibold w-32">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row, i) => {
              const rid = String(row.id ?? '');
              return (
                <tr key={rid || String(i)} className="hover:bg-slate-800/30">
                  {showBulk && (
                    <td className="px-2 py-2 align-middle">
                      {rid ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(rid)}
                          onChange={() => toggleId(rid)}
                          className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                          aria-label="Seleccionar fila"
                        />
                      ) : null}
                    </td>
                  )}
                  {keys.map(k => {
                    const v = row[k];
                    let cell: ReactNode;
                    if (v === null || v === undefined) cell = <span className="text-slate-600">—</span>;
                    else if (typeof v === 'object') cell = <span className="text-slate-500 text-xs">{(JSON.stringify(v) as string).slice(0, 48)}…</span>;
                    else if (typeof v === 'number' && (k.includes('total') || k.includes('amount') || k.includes('price') || k.includes('paid'))) {
                      cell = <span className={greenAmount ? 'text-green-400 tabular-nums' : 'tabular-nums'}>{formatMoney(v)}</span>;
                    } else cell = String(v);
                    return (
                      <td key={k} className="px-3 py-2 text-slate-200 max-w-[200px] truncate" title={typeof v === 'object' ? JSON.stringify(v) : String(v)}>
                        {cell}
                      </td>
                    );
                  })}
                  {rowActions && <td className="px-3 py-2 text-right align-middle">{rowActions(row)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showBulk && bulkDelete && (
        <ConfirmDangerModal
          open={bulkDelOpen}
          title={`Eliminar ${selectedIds.length} ${bulkDelete.itemNoun}`}
          description={<p>Se borrarán de forma permanente. Irreversible.</p>}
          confirmWord={bulkDelete.confirmWord}
          onClose={() => !bulkBusy && setBulkDelOpen(false)}
          busy={bulkBusy}
          errorMsg={bulkErr}
          onConfirm={async () => {
            setBulkBusy(true);
            setBulkErr('');
            try {
              for (const id of selectedIds) {
                await bulkDelete.mutate({
                  action: bulkDelete.action,
                  businessId: bulkDelete.businessId,
                  id,
                });
              }
              setSelectedIds([]);
              setBulkDelOpen(false);
            } catch (e: any) {
              setBulkErr(e?.message || String(e));
            } finally {
              setBulkBusy(false);
            }
          }}
        />
      )}
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const [authed, setAuthed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(SESSION_KEY) === '1';
  });
  const [keyInput, setKeyInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [businesses, setBusinesses] = useState<BizRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'users' | 'businesses' | 'comunicados'>('comunicados');
  const [search, setSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // User table sort
  const [userSort, setUserSort] = useState<{ col: keyof UserRow; dir: SortDir }>({ col: 'businesses', dir: 'desc' });
  // Business table sort
  const [bizSort, setBizSort] = useState<{ col: keyof BizRow; dir: SortDir }>({ col: 'movements', dir: 'desc' });

  const [inspectUser, setInspectUser] = useState<UserRow | null>(null);
  const [inspectUserEntry, setInspectUserEntry] = useState<UserInspectEntry>('overview');
  const [inspectBusiness, setInspectBusiness] = useState<{
    id: string;
    initialTab: SuperadminBusinessTab;
    backUser: UserRow | null;
  } | null>(null);

  const [accessManageUser, setAccessManageUser] = useState<UserRow | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);
  const [bizToDelete, setBizToDelete] = useState<BizRow | null>(null);
  const [userDelBusy, setUserDelBusy] = useState(false);
  const [userDelErr, setUserDelErr] = useState('');
  const [bizDelBusy, setBizDelBusy] = useState(false);
  const [bizDelErr, setBizDelErr] = useState('');
  const [userBulkDelBusy, setUserBulkDelBusy] = useState(false);
  const [userBulkDelErr, setUserBulkDelErr] = useState('');
  const [bizBulkDelBusy, setBizBulkDelBusy] = useState(false);
  const [bizBulkDelErr, setBizBulkDelErr] = useState('');

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedBizIds, setSelectedBizIds] = useState<string[]>([]);
  const [userBulkDeleteOpen, setUserBulkDeleteOpen] = useState(false);
  const [bizBulkDeleteOpen, setBizBulkDeleteOpen] = useState(false);
  const userTableSelectAllRef = useRef<HTMLInputElement>(null);
  const bizTableSelectAllRef = useRef<HTMLInputElement>(null);

  const businessesForInspectUser = useMemo(() => {
    if (!inspectUser) return [];
    return businesses.filter(b => b.owner_id === inspectUser.id);
  }, [inspectUser, businesses]);

  const openUserOverview = useCallback((u: UserRow) => {
    setInspectUser(u);
    setInspectUserEntry('overview');
  }, []);

  const openUserDrill = useCallback((u: UserRow, segment: Exclude<SuperadminBusinessTab, 'resumen'>) => {
    setInspectUser(u);
    setInspectUserEntry({ segment });
  }, []);

  const openBusiness = useCallback((id: string, tab: SuperadminBusinessTab, fromUser: UserRow | null) => {
    setInspectBusiness({ id, initialTab: tab, backUser: fromUser });
  }, []);

  // ── Auth ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      setAuthed(false);

      // El gateway de Supabase exige JWT en Authorization (anon key). La clave superadmin va en ?key=
      const statsProbe = await fetchSuperadmin('stats', keyInput, {
        method: 'GET',
        headers: { Authorization: `Bearer ${supabaseAnonKey}` },
      });

      if (statsProbe.ok) {
        sessionStorage.setItem(SESSION_KEY, '1');
        sessionStorage.setItem('superadmin_key', keyInput);
        setAuthed(true);
      } else {
        const text = await statsProbe.text();
        const hint = explainSuperadminHttpError(statsProbe.status, text);
        setLoginError(
          hint ??
            `No se pudo autorizar Super Admin (${statsProbe.status}). ${text ? `Detalle: ${text.slice(0, 160)}` : ''}`.trim(),
        );
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Error al autenticar Super Admin');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Load data ──
  const loadData = useCallback(async () => {
    const key = sessionStorage.getItem('superadmin_key') || '';
    if (!key) {
      setLoginError('Falta la clave de Super Admin. Inicia sesión nuevamente.');
      setError('');
      setAuthed(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetchSuperadmin('stats', key, {
          headers: { Authorization: `Bearer ${supabaseAnonKey}` },
        }),
        fetchSuperadmin('users', key, {
          headers: { Authorization: `Bearer ${supabaseAnonKey}` },
        }),
      ]);

      const statsText = await statsRes.text();
      const usersText = await usersRes.text();

      console.log('[SUPERADMIN] stats status:', statsRes.status, statsText.slice(0, 300));
      console.log('[SUPERADMIN] users status:', usersRes.status, usersText.slice(0, 300));

      let statsData: any = {};
      let usersData: any = {};
      try { statsData = JSON.parse(statsText); } catch { throw new Error(`Stats: respuesta no-JSON (${statsRes.status}): ${statsText.slice(0, 100)}`); }
      try { usersData = JSON.parse(usersText); } catch { throw new Error(`Users: respuesta no-JSON (${usersRes.status}): ${usersText.slice(0, 100)}`); }

      const notFoundHint = explainSuperadminHttpError(statsRes.status, statsText) ?? explainSuperadminHttpError(usersRes.status, usersText);
      if (notFoundHint) throw new Error(notFoundHint);

      if (!statsRes.ok) throw new Error(`Stats error ${statsRes.status}: ${statsData.error || statsText}`);
      if (!usersRes.ok) throw new Error(`Users error ${usersRes.status}: ${usersData.error || usersText}`);

      setStats(statsData);
      setUsers(usersData.users || []);
      setBusinesses(usersData.businesses || []);
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error('[SUPERADMIN] loadData error:', err);
      if (String(err?.message || '').includes('401')) {
        // Si falló la auth, volver a pantalla de login
        setLoginError('Clave incorrecta o no autorizada.');
        setAuthed(false);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) loadData();
  }, [authed, loadData]);

  // ── Sort helpers ──
  function toggleUserSort(col: keyof UserRow) {
    setUserSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'desc' }
    );
  }
  function toggleBizSort(col: keyof BizRow) {
    setBizSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'desc' }
    );
  }

  // ── Filtered + sorted data ──
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = users.filter(u =>
      !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    );
    return [...filtered].sort((a, b) => {
      const av = a[userSort.col] ?? '';
      const bv = b[userSort.col] ?? '';
      if (av < bv) return userSort.dir === 'asc' ? -1 : 1;
      if (av > bv) return userSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, search, userSort]);

  const filteredUserIds = useMemo(() => filteredUsers.map(u => u.id), [filteredUsers]);

  useEffect(() => {
    setSelectedUserIds([]);
    setSelectedBizIds([]);
  }, [tab]);

  useEffect(() => {
    const set = new Set(filteredUserIds);
    setSelectedUserIds(prev => prev.filter(id => set.has(id)));
  }, [filteredUserIds]);

  const allUsersSelected = filteredUserIds.length > 0 && selectedUserIds.length === filteredUserIds.length;
  const someUsersSelected = selectedUserIds.length > 0 && !allUsersSelected;
  useEffect(() => {
    if (userTableSelectAllRef.current) userTableSelectAllRef.current.indeterminate = someUsersSelected;
  }, [someUsersSelected]);

  const toggleUserSelect = (id: string) => {
    setSelectedUserIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  // Map owner_id → email for businesses table
  const ownerMap = useMemo(() => {
    const m: Record<string, string> = {};
    users.forEach(u => { m[u.id] = u.email; });
    return m;
  }, [users]);

  const filteredBizs = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = businesses.filter(b => {
      const ownerEmail = ownerMap[b.owner_id] || '';
      return !q || b.name.toLowerCase().includes(q) || ownerEmail.toLowerCase().includes(q);
    });
    return [...filtered].sort((a, b) => {
      const av = a[bizSort.col] ?? '';
      const bv = b[bizSort.col] ?? '';
      if (av < bv) return bizSort.dir === 'asc' ? -1 : 1;
      if (av > bv) return bizSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [businesses, search, bizSort, ownerMap]);

  const filteredBizIdsList = useMemo(() => filteredBizs.map(b => b.id), [filteredBizs]);

  useEffect(() => {
    const set = new Set(filteredBizIdsList);
    setSelectedBizIds(prev => prev.filter(id => set.has(id)));
  }, [filteredBizIdsList]);

  const allBizSelected = filteredBizIdsList.length > 0 && selectedBizIds.length === filteredBizIdsList.length;
  const someBizSelected = selectedBizIds.length > 0 && !allBizSelected;
  useEffect(() => {
    if (bizTableSelectAllRef.current) bizTableSelectAllRef.current.indeterminate = someBizSelected;
  }, [someBizSelected]);

  const toggleBizSelect = (id: string) => {
    setSelectedBizIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  // ── Login screen ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
              <span className="text-2xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Super Admin</h1>
            <p className="text-slate-400 text-sm mt-1">Acceso restringido</p>
          </div>
          <form onSubmit={handleLogin} className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-2xl">
            <label className="block text-sm text-slate-400 mb-2">Clave de acceso</label>
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-4"
              autoFocus
            />
            {loginError && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
                {loginError}
              </div>
            )}
            <button
              type="submit"
              disabled={loginLoading || !keyInput}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              {loginLoading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-sm">🛡</div>
            <span className="font-bold text-lg">Super Admin</span>
            {lastRefresh && (
              <span className="text-xs text-slate-500 hidden sm:block">
                Actualizado: {lastRefresh.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
            <button
              onClick={() => { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem('superadmin_key'); setAuthed(false); }}
              className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1.5"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-xl px-4 py-3">
            ❌ {error}
          </div>
        )}

        {/* Global Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Usuarios" value={stats.users.total} sub={`${stats.users.active} activos (30d)`} color="border-indigo-800 bg-indigo-950/60" />
            <StatCard label="Negocios" value={stats.businesses} color="border-violet-800 bg-violet-950/60" />
            <StatCard label="Productos" value={stats.products} color="border-blue-800 bg-blue-950/60" />
            <StatCard label="Empleados" value={stats.employees} color="border-cyan-800 bg-cyan-950/60" />
            <StatCard label="Ventas" value={stats.sales} color="border-green-800 bg-green-950/60" />
            <StatCard label="Gastos" value={stats.expenses} color="border-amber-800 bg-amber-950/60" />
            <StatCard label="Contactos" value={stats.customers} color="border-pink-800 bg-pink-950/60" />
          </div>
        )}

        {/* Skeleton loader */}
        {loading && !stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-800 animate-pulse" />
            ))}
          </div>
        )}

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-wrap bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
            {(['comunicados', 'users', 'businesses'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setSearch(''); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {t === 'comunicados' ? '📢 Comunicados' : t === 'users' ? `👤 Usuarios (${users.length})` : `🏪 Negocios (${businesses.length})`}
              </button>
            ))}
          </div>
          {tab !== 'comunicados' && (
            <>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tab === 'users' ? 'Buscar por email o nombre...' : 'Buscar por negocio o dueño...'}
                className="flex-1 bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
              />
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {tab === 'users' ? `${filteredUsers.length} resultados` : `${filteredBizs.length} resultados`}
              </span>
            </>
          )}
        </div>

        {tab === 'comunicados' && (
          <ComunicadosAdminTab users={users} onGlobalReload={() => void loadData()} />
        )}

        {/* Users Table */}
        {tab === 'users' && (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-800 bg-slate-800/40">
                <span className="text-sm text-slate-300">{selectedUserIds.length} usuario(s) seleccionado(s)</span>
                <button
                  type="button"
                  onClick={() => { setUserBulkDelErr(''); setUserBulkDeleteOpen(true); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-950"
                >
                  Eliminar seleccionados
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 border-b border-slate-800">
                  <tr>
                    {[
                      { key: '_select', label: '' },
                      { key: '_actions', label: '' },
                      { key: '_danger', label: '' },
                      { key: '_access', label: 'Acceso' },
                      { key: 'email', label: 'Email' },
                      { key: 'name', label: 'Nombre' },
                      { key: 'is_active', label: 'Estado' },
                      { key: 'created_at', label: 'Registro' },
                      { key: 'last_sign_in_at', label: 'Último acceso' },
                      { key: 'businesses', label: 'Negocios' },
                      { key: 'products', label: 'Productos' },
                      { key: 'employees', label: 'Empleados' },
                      { key: 'movements', label: 'Movimientos' },
                      { key: 'sales', label: 'Ventas' },
                      { key: 'expenses', label: 'Gastos' },
                      { key: 'customers', label: 'Contactos' },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={col.key === '_select' || col.key === '_actions' || col.key === '_danger' || col.key === '_access' ? undefined : () => toggleUserSort(col.key as keyof UserRow)}
                        className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider select-none whitespace-nowrap ${col.key === '_select' || col.key === '_actions' || col.key === '_danger' || col.key === '_access' ? '' : 'cursor-pointer hover:text-white'}`}
                      >
                        {col.key === '_select' ? (
                          <input
                            ref={userTableSelectAllRef}
                            type="checkbox"
                            checked={allUsersSelected}
                            onChange={() => setSelectedUserIds(allUsersSelected ? [] : [...filteredUserIds])}
                            className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                            aria-label="Seleccionar todos los usuarios visibles"
                          />
                        ) : (
                          col.label
                        )}
                        {col.key !== '_select' && col.key !== '_actions' && col.key !== '_danger' && col.key !== '_access' && <SortArrow active={userSort.col === col.key} dir={userSort.dir} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={16} className="text-center text-slate-500 py-10">{loading ? 'Cargando...' : 'Sin resultados'}</td></tr>
                  )}
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="bg-slate-900/40 hover:bg-slate-800/50 transition-colors">
                      <td className="px-2 py-2 align-middle">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={() => toggleUserSelect(u.id)}
                          className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                          aria-label={`Seleccionar ${u.email}`}
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openUserOverview(u)}
                          className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                        >
                          Ver
                        </button>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => { setUserDelErr(''); setUserToDelete(u); }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Eliminar
                        </button>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <button
                            type="button"
                            onClick={() => setAccessManageUser(u)}
                            className={`text-xs font-medium underline-offset-2 hover:underline ${u.blocked ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}
                            title={u.blocked ? (u.block_message || 'Bloqueado') : 'Bloquear o gestionar acceso'}
                          >
                            {u.blocked ? 'Bloqueado · gestionar' : 'Bloquear…'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPasswordUser(u)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline"
                            title="Establecer nueva contraseña en Supabase Auth"
                          >
                            Contraseña…
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openUserOverview(u)}
                          className="text-slate-200 font-mono text-xs max-w-[200px] truncate block text-left hover:text-indigo-300"
                          title={u.email}
                        >
                          {u.email}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{u.name || <span className="text-slate-600">—</span>}</td>
                      <td className="px-4 py-3">
                        {u.blocked ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-red-950/70 text-red-300 border border-red-900 max-w-[200px]"
                            title={u.block_message || 'Sin mensaje'}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            <span className="truncate">Bloqueado</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-green-900/60 text-green-400 border border-green-800' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-green-400' : 'bg-slate-600'}`} />
                            {u.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtTime(u.last_sign_in_at)}</td>
                      <NumCell value={u.businesses} highlight={u.businesses > 0} onOpen={u.businesses > 0 ? () => openUserOverview(u) : undefined} />
                      <NumCell value={u.products} onOpen={u.products > 0 ? () => openUserDrill(u, 'productos') : undefined} />
                      <NumCell value={u.employees} onOpen={u.employees > 0 ? () => openUserDrill(u, 'empleados') : undefined} />
                      <NumCell value={u.movements} highlight={u.movements > 0} onOpen={u.movements > 0 ? () => openUserDrill(u, 'movimientos') : undefined} />
                      <NumCell value={u.sales} color="text-green-400" onOpen={u.sales > 0 ? () => openUserDrill(u, 'ventas') : undefined} />
                      <NumCell value={u.expenses} color="text-amber-400" onOpen={u.expenses > 0 ? () => openUserDrill(u, 'gastos') : undefined} />
                      <NumCell value={u.customers} onOpen={u.customers > 0 ? () => openUserDrill(u, 'contactos') : undefined} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Businesses Table */}
        {tab === 'businesses' && (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            {selectedBizIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-800 bg-slate-800/40">
                <span className="text-sm text-slate-300">{selectedBizIds.length} negocio(s) seleccionado(s)</span>
                <button
                  type="button"
                  onClick={() => { setBizBulkDelErr(''); setBizBulkDeleteOpen(true); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-950"
                >
                  Eliminar seleccionados
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 border-b border-slate-800">
                  <tr>
                    {[
                      { key: '_select', label: '' },
                      { key: '_actions', label: '' },
                      { key: '_danger', label: '' },
                      { key: 'name', label: 'Negocio' },
                      { key: 'owner_id', label: 'Dueño' },
                      { key: 'created_at', label: 'Creado' },
                      { key: 'products', label: 'Productos' },
                      { key: 'employees', label: 'Empleados' },
                      { key: 'movements', label: 'Movimientos' },
                      { key: 'sales', label: 'Ventas' },
                      { key: 'expenses', label: 'Gastos' },
                      { key: 'customers', label: 'Contactos' },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={col.key === '_select' || col.key === '_actions' || col.key === '_danger' ? undefined : () => toggleBizSort(col.key as keyof BizRow)}
                        className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider select-none whitespace-nowrap ${col.key === '_select' || col.key === '_actions' || col.key === '_danger' ? '' : 'cursor-pointer hover:text-white'}`}
                      >
                        {col.key === '_select' ? (
                          <input
                            ref={bizTableSelectAllRef}
                            type="checkbox"
                            checked={allBizSelected}
                            onChange={() => setSelectedBizIds(allBizSelected ? [] : [...filteredBizIdsList])}
                            className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                            aria-label="Seleccionar todos los negocios visibles"
                          />
                        ) : (
                          col.label
                        )}
                        {col.key !== '_select' && col.key !== '_actions' && col.key !== '_danger' && <SortArrow active={bizSort.col === col.key} dir={bizSort.dir} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredBizs.length === 0 && (
                    <tr><td colSpan={12} className="text-center text-slate-500 py-10">{loading ? 'Cargando...' : 'Sin resultados'}</td></tr>
                  )}
                  {filteredBizs.map(b => (
                    <tr key={b.id} className="bg-slate-900/40 hover:bg-slate-800/50 transition-colors">
                      <td className="px-2 py-2 align-middle">
                        <input
                          type="checkbox"
                          checked={selectedBizIds.includes(b.id)}
                          onChange={() => toggleBizSelect(b.id)}
                          className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                          aria-label={`Seleccionar ${b.name}`}
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openBusiness(b.id, 'resumen', null)}
                          className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                        >
                          Ver
                        </button>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => { setBizDelErr(''); setBizToDelete(b); }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Eliminar
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openBusiness(b.id, 'resumen', null)}
                          className="text-left font-medium text-white hover:text-indigo-300"
                        >
                          {b.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs max-w-[200px] truncate" title={ownerMap[b.owner_id]}>
                        {ownerMap[b.owner_id] || <span className="text-slate-600">sin dueño</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(b.created_at)}</td>
                      <NumCell value={b.products} onOpen={b.products > 0 ? () => openBusiness(b.id, 'productos', null) : undefined} />
                      <NumCell value={b.employees} onOpen={b.employees > 0 ? () => openBusiness(b.id, 'empleados', null) : undefined} />
                      <NumCell value={b.movements} highlight={b.movements > 0} onOpen={b.movements > 0 ? () => openBusiness(b.id, 'movimientos', null) : undefined} />
                      <NumCell value={b.sales} color="text-green-400" onOpen={b.sales > 0 ? () => openBusiness(b.id, 'ventas', null) : undefined} />
                      <NumCell value={b.expenses} color="text-amber-400" onOpen={b.expenses > 0 ? () => openBusiness(b.id, 'gastos', null) : undefined} />
                      <NumCell value={b.customers} onOpen={b.customers > 0 ? () => openBusiness(b.id, 'contactos', null) : undefined} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {accessManageUser && (
          <UserAccessManageModal
            user={accessManageUser}
            onClose={() => setAccessManageUser(null)}
            onSaved={() => void loadData()}
          />
        )}

        {passwordUser && (
          <UserPasswordModal
            user={passwordUser}
            onClose={() => setPasswordUser(null)}
            onSaved={() => void loadData()}
          />
        )}

        {inspectUser && !inspectBusiness && (
          <UserInspectModal
            user={inspectUser}
            userBusinesses={businessesForInspectUser}
            entry={inspectUserEntry}
            onClose={() => {
              setInspectUser(null);
              setInspectUserEntry('overview');
            }}
            onShowOverview={() => setInspectUserEntry('overview')}
            onOpenBusiness={(bizId, tab) => openBusiness(bizId, tab, inspectUser)}
          />
        )}
        {inspectBusiness && (
          <BusinessInspectModal
            businessId={inspectBusiness.id}
            initialTab={inspectBusiness.initialTab}
            summary={businesses.find(x => x.id === inspectBusiness.id) ?? null}
            ownerEmail={(() => {
              const s = businesses.find(x => x.id === inspectBusiness.id);
              return s ? ownerMap[s.owner_id] || '' : '';
            })()}
            onClose={() => setInspectBusiness(null)}
            onBack={inspectBusiness.backUser ? () => setInspectBusiness(null) : undefined}
            onBusinessDeleted={() => {
              setInspectBusiness(null);
              loadData();
            }}
          />
        )}

        <ConfirmDangerModal
          open={!!userToDelete}
          title="Eliminar usuario (Auth)"
          description={(
            <p>
              Cuenta <strong className="text-white">{userToDelete?.email}</strong>.
              Se elimina el usuario en Supabase Auth; tablas públicas con <code className="text-xs">ON DELETE CASCADE</code> pueden borrarse en cadena.
            </p>
          )}
          confirmWord="ELIMINAR USUARIO"
          onClose={() => !userDelBusy && setUserToDelete(null)}
          busy={userDelBusy}
          errorMsg={userDelErr}
          onConfirm={async () => {
            if (!userToDelete) return;
            setUserDelBusy(true);
            setUserDelErr('');
            try {
              const key = sessionStorage.getItem('superadmin_key') || '';
              await superadminPerformMutate(key, { action: 'delete_user', userId: userToDelete.id });
              setUserToDelete(null);
              if (inspectUser?.id === userToDelete.id) {
                setInspectUser(null);
                setInspectUserEntry('overview');
              }
              await loadData();
            } catch (e: any) {
              setUserDelErr(e?.message || String(e));
            } finally {
              setUserDelBusy(false);
            }
          }}
        />

        <ConfirmDangerModal
          open={!!bizToDelete}
          title="Eliminar negocio"
          description={(
            <div className="space-y-2">
              <p>Negocio <strong className="text-white">{bizToDelete?.name}</strong> y datos enlazados (cascada en BD).</p>
              <p className="text-amber-400/90 text-xs">Irreversible.</p>
            </div>
          )}
          confirmWord="ELIMINAR NEGOCIO"
          onClose={() => !bizDelBusy && setBizToDelete(null)}
          busy={bizDelBusy}
          errorMsg={bizDelErr}
          onConfirm={async () => {
            if (!bizToDelete) return;
            setBizDelBusy(true);
            setBizDelErr('');
            try {
              const key = sessionStorage.getItem('superadmin_key') || '';
              await superadminPerformMutate(key, { action: 'delete_business', businessId: bizToDelete.id });
              setBizToDelete(null);
              if (inspectBusiness?.id === bizToDelete.id) setInspectBusiness(null);
              await loadData();
            } catch (e: any) {
              setBizDelErr(e?.message || String(e));
            } finally {
              setBizDelBusy(false);
            }
          }}
        />

        <ConfirmDangerModal
          open={userBulkDeleteOpen}
          title={`Eliminar ${selectedUserIds.length} usuario(s)`}
          description={(
            <div className="space-y-2">
              <p>Cuentas en Supabase Auth; tablas públicas con <code className="text-xs">ON DELETE CASCADE</code> pueden borrarse en cadena.</p>
              <ul className="text-xs max-h-36 overflow-y-auto space-y-1 font-mono text-slate-400 list-disc pl-4">
                {selectedUserIds.slice(0, 15).map(id => {
                  const u = users.find(x => x.id === id);
                  return <li key={id}>{u?.email ?? id}</li>;
                })}
              </ul>
              {selectedUserIds.length > 15 && (
                <p className="text-xs text-slate-500">… y {selectedUserIds.length - 15} más</p>
              )}
            </div>
          )}
          confirmWord="ELIMINAR USUARIOS"
          onClose={() => !userBulkDelBusy && setUserBulkDeleteOpen(false)}
          busy={userBulkDelBusy}
          errorMsg={userBulkDelErr}
          onConfirm={async () => {
            if (selectedUserIds.length === 0) return;
            setUserBulkDelBusy(true);
            setUserBulkDelErr('');
            try {
              const key = sessionStorage.getItem('superadmin_key') || '';
              const ids = [...selectedUserIds];
              for (const id of ids) {
                await superadminPerformMutate(key, { action: 'delete_user', userId: id });
              }
              if (inspectUser && ids.includes(inspectUser.id)) {
                setInspectUser(null);
                setInspectUserEntry('overview');
              }
              setSelectedUserIds([]);
              setUserBulkDeleteOpen(false);
              await loadData();
            } catch (e: any) {
              setUserBulkDelErr(e?.message || String(e));
            } finally {
              setUserBulkDelBusy(false);
            }
          }}
        />

        <ConfirmDangerModal
          open={bizBulkDeleteOpen}
          title={`Eliminar ${selectedBizIds.length} negocio(s)`}
          description={(
            <div className="space-y-2">
              <p>Negocios y datos enlazados (cascada en BD). Irreversible.</p>
              <ul className="text-xs max-h-36 overflow-y-auto space-y-1 font-mono text-slate-400 list-disc pl-4">
                {selectedBizIds.slice(0, 15).map(id => {
                  const b = businesses.find(x => x.id === id);
                  return <li key={id}>{b?.name ?? id}</li>;
                })}
              </ul>
              {selectedBizIds.length > 15 && (
                <p className="text-xs text-slate-500">… y {selectedBizIds.length - 15} más</p>
              )}
            </div>
          )}
          confirmWord="ELIMINAR NEGOCIOS"
          onClose={() => !bizBulkDelBusy && setBizBulkDeleteOpen(false)}
          busy={bizBulkDelBusy}
          errorMsg={bizBulkDelErr}
          onConfirm={async () => {
            if (selectedBizIds.length === 0) return;
            setBizBulkDelBusy(true);
            setBizBulkDelErr('');
            try {
              const key = sessionStorage.getItem('superadmin_key') || '';
              const ids = [...selectedBizIds];
              for (const id of ids) {
                await superadminPerformMutate(key, { action: 'delete_business', businessId: id });
              }
              if (inspectBusiness && ids.includes(inspectBusiness.id)) setInspectBusiness(null);
              setSelectedBizIds([]);
              setBizBulkDeleteOpen(false);
              await loadData();
            } catch (e: any) {
              setBizBulkDelErr(e?.message || String(e));
            } finally {
              setBizBulkDelBusy(false);
            }
          }}
        />
      </div>
    </div>
  );
}

// ─── Num cell ─────────────────────────────────────────────────────────────────
function Num({ value, highlight, color }: { value: number; highlight?: boolean; color?: string }) {
  const base = color || (highlight ? 'text-indigo-300 font-semibold' : value === 0 ? 'text-slate-600' : 'text-slate-300');
  return (
    <td className={`px-4 py-3 text-right tabular-nums ${base}`}>
      {num(value)}
    </td>
  );
}

function NumCell({
  value,
  highlight,
  color,
  onOpen,
}: {
  value: number;
  highlight?: boolean;
  color?: string;
  onOpen?: () => void;
}) {
  const base = color || (highlight ? 'text-indigo-300 font-semibold' : value === 0 ? 'text-slate-600' : 'text-slate-300');
  if (value > 0 && onOpen) {
    return (
      <td className={`px-4 py-3 text-right tabular-nums ${base}`}>
        <button type="button" onClick={onOpen} className="hover:underline underline-offset-2 decoration-indigo-400/80 w-full text-right">
          {num(value)}
        </button>
      </td>
    );
  }
  return (
    <td className={`px-4 py-3 text-right tabular-nums ${base}`}>
      {num(value)}
    </td>
  );
}