import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Banknote, ChevronDown, ChevronUp, CreditCard, Download, Edit, Loader2, Trash2, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { Separator } from './ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Badge } from './ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { dataTableTheadSticky, dthMovement } from '../lib/dataTableHeaderClasses';
import { formatCurrency } from '../utils/currency';
import {
  buildCashBreakdown,
  cashDifference,
  type CashBreakdown,
  type CashMovementInput,
} from '../lib/cashSession';
import * as apiService from '../services/api';
import {
  closeCashSession,
  deleteCashSession,
  listCashSessions,
  openCashSession,
  updateClosedCashSession,
  type CashSession,
} from '../services/cashSessions';
import { downloadCashSessionExcel } from '../utils/cashSessionExcel';

type Person = { userId: string; name: string };

type Props = {
  businessId: string;
  employees: any[];
  currentUserId: string | null;
  currentUserName: string;
  viewScope: 'own' | 'all';
  canOpen?: boolean;
  canClose?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  openSignal?: number;
  onCanOpenChange?: (canOpen: boolean) => void;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  employeeUserId?: string | null;
  statusFilter?: 'all' | 'open' | 'match' | 'short' | 'over';
};

function money(value: number): string {
  return `$${formatCurrency(value)}`;
}

function MethodCard({
  title,
  total,
  count,
  lines,
}: {
  title: string;
  total: number;
  count: number;
  lines: { id: string; label: string; amount: number; createdAt?: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 min-w-0 overflow-hidden">
      <button type="button" className="w-full text-left" onClick={() => setOpen((value) => !value)}>
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-4 h-4 text-gray-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{title}</p>
            <p className="text-[10px] text-gray-500">{count} {count === 1 ? 'movimiento' : 'movimientos'}</p>
          </div>
        </div>
        <p className="text-lg font-bold text-gray-900">{money(total)}</p>
      </button>
      {open && (
        <div className="space-y-2 pt-3">
          {lines.length === 0 ? (
            <p className="text-xs text-gray-500">Ninguno en esta caja.</p>
          ) : (
            lines.map((line, index) => (
              <div key={`${line.id}-${index}`} className="flex justify-between gap-2 text-xs text-gray-600">
                <span className="min-w-0">
                  <span className="block truncate">{line.label}</span>
                  {line.createdAt ? <span className="block text-[10px] text-gray-500">{when(line.createdAt)}</span> : null}
                </span>
                <span className="shrink-0">{money(line.amount)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return format(date, 'd MMM, HH:mm', { locale: es });
}

function saleLabel(sale: any): string {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const primary = items.length ? items[items.length - 1] : null;
  if (items.length === 1) return primary?.name || 'Venta';
  if (items.length > 1) return `${primary?.name || 'Venta'} +(${items.length - 1}) más`;
  return sale.notes || 'Venta';
}

function toMovements(sales: any[], expenses: any[]): CashMovementInput[] {
  const fromSales: CashMovementInput[] = sales.map((sale) => ({
    id: sale.id,
    kind: 'sale',
    label: saleLabel(sale),
    createdAt: sale.createdAt || sale.created_at,
    createdBy: sale.createdBy ?? sale.created_by ?? null,
    paymentStatus: sale.paymentStatus ?? sale.payment_status,
    paymentMethod: sale.paymentMethod ?? sale.payment_method,
    total: Number(sale.total) || 0,
    payments: sale.payments || [],
  }));
  const fromExpenses: CashMovementInput[] = expenses.map((expense) => ({
    id: expense.id,
    kind: 'expense',
    label: expense.notes || expense.description || expense.category || 'Gasto',
    createdAt: expense.createdAt || expense.created_at,
    createdBy: expense.createdBy ?? expense.created_by ?? null,
    paymentStatus: expense.paymentStatus ?? expense.payment_status,
    paymentMethod: expense.paymentMethod ?? expense.payment_method,
    total: Number(expense.amount) || 0,
    payments: [],
  }));
  return [...fromSales, ...fromExpenses];
}

function PanelCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 space-y-3">
      {children}
    </div>
  );
}

function LineFold({
  title,
  total,
  lines,
  startOpen = false,
}: {
  title: string;
  total: number;
  lines: { id: string; label: string; amount: number; createdAt?: string }[];
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left">
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold text-gray-900">{money(total)}</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 space-y-2">
        {lines.length === 0 ? (
          <p className="text-sm text-gray-500">Ninguno en esta caja.</p>
        ) : (
          lines.map((line, index) => (
            <div key={`${line.id}-${index}`} className="flex items-center justify-between gap-3 text-sm text-gray-600">
              <span className="min-w-0">
                <span className="block truncate">{line.label}</span>
                {line.createdAt ? <span className="block text-xs text-gray-500">{when(line.createdAt)}</span> : null}
              </span>
              <span className="shrink-0 font-medium text-gray-900">{money(line.amount)}</span>
            </div>
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CashSessionsPanel({
  businessId,
  employees,
  currentUserId,
  currentUserName,
  viewScope,
  canOpen = false,
  canClose = false,
  canEdit = false,
  canDelete = false,
  openSignal = 0,
  onCanOpenChange,
  rangeStart = null,
  rangeEnd = null,
  employeeUserId = null,
  statusFilter = 'all',
}: Props) {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [movements, setMovements] = useState<CashMovementInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<'session' | 'open' | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  const [countedAmount, setCountedAmount] = useState('');
  const [comment, setComment] = useState('');
  const [editingClosed, setEditingClosed] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const people = useMemo<Person[]>(() => {
    const list = employees
      .filter((employee) => employee.userId && employee.is_active !== false && employee.isActive !== false)
      .map((employee) => ({ userId: String(employee.userId), name: employee.name || 'Empleado' }));
    if (currentUserId && !list.some((person) => person.userId === currentUserId)) {
      list.unshift({ userId: currentUserId, name: currentUserName || 'Tú' });
    }
    if (viewScope === 'own' && currentUserId) {
      return list.filter((person) => person.userId === currentUserId);
    }
    return list;
  }, [employees, currentUserId, currentUserName, viewScope]);

  const availablePeople = useMemo(() => {
    const openUserIds = new Set(
      sessions.filter((session) => !session.closedAt).map((session) => session.employeeUserId),
    );
    return people.filter((person) => !openUserIds.has(person.userId));
  }, [people, sessions]);
  const everyoneHasOpenCaja = people.length > 0 && availablePeople.length === 0;

  const visibleSessions = useMemo(() => {
    const start = rangeStart ? new Date(rangeStart).getTime() : null;
    const end = rangeEnd ? new Date(rangeEnd).getTime() : null;
    const rows = sessions.filter((session) => {
      if (viewScope === 'own' && currentUserId && session.employeeUserId !== currentUserId) return false;
      if (employeeUserId && session.employeeUserId !== employeeUserId) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'open') {
          if (session.closedAt) return false;
        } else {
          if (!session.closedAt) return false;
          const gap = cashDifference(breakdownFor(session).expected, session.countedAmount);
          if (statusFilter === 'short' && !(gap != null && gap < 0)) return false;
          if (statusFilter === 'over' && !(gap != null && gap > 0)) return false;
          if (statusFilter === 'match' && gap != null && gap !== 0) return false;
        }
      }
      if (start == null || end == null || Number.isNaN(start) || Number.isNaN(end)) return true;
      const opened = new Date(session.openedAt).getTime();
      const closed = session.closedAt ? new Date(session.closedAt).getTime() : Date.now();
      if (Number.isNaN(opened)) return false;
      return opened <= end && closed >= start;
    });
    return [...rows].sort((a, b) => {
      if (!a.closedAt && b.closedAt) return -1;
      if (a.closedAt && !b.closedAt) return 1;
      return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
    });
  }, [sessions, viewScope, currentUserId, rangeStart, rangeEnd, employeeUserId, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listCashSessions(businessId);
      setSessions(rows);
      const openRows = rows.filter((session) => !session.closedAt);
      if (openRows.length === 0) {
        setMovements([]);
        return;
      }
      const from = openRows.reduce((min, session) => session.openedAt < min ? session.openedAt : min, openRows[0].openedAt);
      const [sales, expenses] = await Promise.all([
        apiService.getSales(businessId, { from, fields: 'list' }),
        apiService.getExpenses(businessId, { from, fields: 'list' }),
      ]);
      setMovements(toMovements(sales, expenses));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las cajas');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  function breakdownFor(session: CashSession): CashBreakdown {
    if (session.closedAt && session.snapshot) {
      return session.snapshot;
    }
    return buildCashBreakdown(
      {
        employeeUserId: session.employeeUserId,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        openingAmount: session.openingAmount,
      },
      movements,
    );
  }

  function openSheet(session: CashSession) {
    setSelectedId(session.id);
    setSheetMode('session');
    setEditingClosed(false);
    setOpeningAmount(String(session.openingAmount ?? ''));
    setCountedAmount(session.countedAmount == null ? '' : String(session.countedAmount));
    setComment(session.comment || '');
  }

  function cancelClosedEdit() {
    if (!selected) return;
    setEditingClosed(false);
    setOpeningAmount(String(selected.openingAmount ?? ''));
    setCountedAmount(selected.countedAmount == null ? '' : String(selected.countedAmount));
    setComment(selected.comment || '');
  }

  function startOpen() {
    if (!canOpen || everyoneHasOpenCaja) return;
    setSheetMode('open');
    setEditingClosed(false);
    setSelectedId(null);
    setEmployeeId(availablePeople.length === 1 ? availablePeople[0].userId : '');
    setOpeningAmount('');
    setComment('');
  }

  const startOpenRef = useRef(startOpen);
  startOpenRef.current = startOpen;
  const openSignalSeen = useRef(openSignal);

  useEffect(() => {
    onCanOpenChange?.(!loading && canOpen && !everyoneHasOpenCaja);
  }, [loading, canOpen, everyoneHasOpenCaja, onCanOpenChange]);

  useEffect(() => {
    if (openSignal === openSignalSeen.current) return;
    openSignalSeen.current = openSignal;
    startOpenRef.current();
  }, [openSignal]);

  const selected = sessions.find((session) => session.id === selectedId) || null;
  const selectedBreakdown = selected ? breakdownFor(selected) : null;
  const countedNumber = countedAmount.trim() === '' ? null : Math.max(0, Number(countedAmount.replace(',', '.')) || 0);
  const openingNumber = openingAmount.trim() === '' ? null : Math.max(0, Number(openingAmount.replace(',', '.')) || 0);
  const closedDraft = Boolean(selected?.closedAt && editingClosed);
  const shownBreakdown = selectedBreakdown && closedDraft
    ? {
        ...selectedBreakdown,
        openingAmount: openingNumber ?? selectedBreakdown.openingAmount,
        expected:
          (openingNumber ?? selectedBreakdown.openingAmount) +
          selectedBreakdown.cashSalesTotal -
          selectedBreakdown.cashExpensesTotal,
      }
    : selectedBreakdown;
  const shownCounted = selected?.closedAt && !editingClosed ? selected.countedAmount : countedNumber;
  const liveDifference = shownBreakdown ? cashDifference(shownBreakdown.expected, shownCounted) : null;

  async function handleOpen() {
    if (!canOpen) return;
    const person = people.find((item) => item.userId === employeeId);
    if (!person) {
      toast.error('Elige a quién se le abre la caja.');
      return;
    }
    if (openingAmount.trim() === '') {
      toast.error('Ingresa el efectivo que se deja.');
      return;
    }
    if (sessions.some((session) => !session.closedAt && session.employeeUserId === person.userId)) {
      toast.error(`${person.name} ya tiene una caja abierta.`);
      return;
    }
    setSaving(true);
    try {
      await openCashSession({
        businessId,
        employeeUserId: person.userId,
        employeeName: person.name,
        openingAmount: Math.max(0, Number(openingAmount.replace(',', '.')) || 0),
        comment: comment.trim(),
        openedBy: currentUserId,
      });
      toast.success('Caja abierta');
      setSheetMode(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir la caja');
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (!canClose || !selected || !selectedBreakdown) return;
    if (countedAmount.trim() === '') {
      toast.error('Ingresa el dinero que hay en la caja.');
      return;
    }
    const counted = Math.max(0, Number(countedAmount.replace(',', '.')) || 0);
    const difference = counted - selectedBreakdown.expected;
    setSaving(true);
    try {
      await closeCashSession({
        id: selected.id,
        businessId,
        countedAmount: counted,
        comment: comment.trim(),
        closedBy: currentUserId,
        snapshot: {
          ...selectedBreakdown,
          countedAmount: counted,
          difference,
        },
      });
      toast.success('Caja cerrada');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cerrar la caja');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveClosed() {
    if (!canEdit || !selected || !shownBreakdown || !selected.closedAt) return;
    if (openingAmount.trim() === '') {
      toast.error('Ingresa el efectivo que se dejó.');
      return;
    }
    if (countedAmount.trim() === '') {
      toast.error('Ingresa el dinero que hay en la caja.');
      return;
    }
    const opening = Math.max(0, Number(openingAmount.replace(',', '.')) || 0);
    const counted = Math.max(0, Number(countedAmount.replace(',', '.')) || 0);
    setSaving(true);
    try {
      await updateClosedCashSession({
        id: selected.id,
        businessId,
        openingAmount: opening,
        countedAmount: counted,
        comment: comment.trim(),
        breakdown: shownBreakdown,
      });
      toast.success('Caja actualizada');
      setEditingClosed(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la caja');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClosed() {
    if (!canDelete || !selected?.closedAt) return;
    setSaving(true);
    try {
      await deleteCashSession({ id: selected.id, businessId });
      toast.success('Caja eliminada');
      setDeleteOpen(false);
      setSheetMode(null);
      setEditingClosed(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la caja');
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(session: CashSession, breakdown: CashBreakdown, counted: number | null) {
    try {
      await downloadCashSessionExcel({
        employeeName: session.employeeName,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        comment: session.closedAt ? session.comment : comment,
        breakdown,
        countedAmount: counted,
        difference: cashDifference(breakdown.expected, counted),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo descargar');
    }
  }

  function statusLabel(session: CashSession): string {
    if (!session.closedAt) return 'Abierta';
    const breakdown = breakdownFor(session);
    const gap = cashDifference(breakdown.expected, session.countedAmount);
    if (gap == null || gap === 0) return 'Cerrada · cuadra';
    if (gap > 0) return `Cerrada · sobrante ${money(gap)}`;
    return `Cerrada · faltante ${money(Math.abs(gap))}`;
  }

  function statusBadgeClass(session: CashSession): string {
    const base = 'border-0 text-xs text-white shadow-none';
    if (!session.closedAt) return `${base} bg-slate-600 hover:bg-slate-600`;
    const gap = cashDifference(breakdownFor(session).expected, session.countedAmount);
    if (gap != null && gap < 0) return `${base} bg-rose-600 hover:bg-rose-600`;
    if (gap != null && gap > 0) return `${base} bg-amber-500 hover:bg-amber-500`;
    return `${base} bg-emerald-600 hover:bg-emerald-600`;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : visibleSessions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <Wallet
              className="h-20 w-20 text-gray-300"
              strokeWidth={1.4}
              aria-hidden="true"
            />
            <p className="mt-4 text-sm font-medium text-gray-500">
              {sessions.length === 0 ? 'Sin cajas aún' : 'Ninguna caja en este periodo'}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {sessions.length === 0
                ? 'Abre una caja para dejar el efectivo de una persona.'
                : 'Prueba otra fecha, otro empleado o otro estado.'}
            </p>
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0">
            <thead className={dataTableTheadSticky}>
              <tr>
                <th className={`${dthMovement} px-4`}>Empleado</th>
                <th className={`${dthMovement} px-4`}>Esperado</th>
                <th className={`${dthMovement} px-4 hidden sm:table-cell`}>Desde</th>
                <th className={`${dthMovement} pl-4 pr-5 text-right`}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibleSessions.map((session) => {
                const breakdown = breakdownFor(session);
                return (
                  <tr
                    key={session.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openSheet(session)}
                  >
                    <td className="px-4 py-3 border-t border-gray-200 font-medium text-gray-900">{session.employeeName}</td>
                    <td className="px-4 py-3 border-t border-gray-200 text-gray-900">{money(breakdown.expected)}</td>
                    <td className="px-4 py-3 border-t border-gray-200 text-gray-600 hidden sm:table-cell">{when(session.openedAt)}</td>
                    <td className="pl-4 pr-5 py-3 border-t border-gray-200 text-right">
                      <Badge className={statusBadgeClass(session)}>
                        {statusLabel(session)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Sheet open={sheetMode != null} onOpenChange={(open) => { if (!open) { setSheetMode(null); setEditingClosed(false); } }}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 max-w-[100vw] gap-0 [&>button]:hidden">
          <SheetHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-3 sm:pb-4 border-b">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-lg sm:text-xl truncate">
                    {sheetMode === 'open' ? 'Abrir caja' : selected?.employeeName || 'Caja'}
                  </SheetTitle>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    {sheetMode === 'open'
                      ? 'Elige a la persona y el efectivo que le dejas.'
                      : selected
                        ? selected.closedAt
                          ? `Del ${when(selected.openedAt)} al ${when(selected.closedAt)}`
                          : `Abierta desde ${when(selected.openedAt)}`
                        : 'Detalle de la caja'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {sheetMode === 'session' && selected && shownBreakdown && (
                  <button
                    type="button"
                    onClick={() => handleDownload(
                      selected,
                      shownBreakdown,
                      shownCounted,
                    )}
                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors"
                    aria-label="Descargar"
                  >
                    <Download className="w-4 h-4 text-white" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSheetMode(null)}
                  className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <SheetDescription className="sr-only">Detalle de la caja</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-3 sm:py-6">
            {sheetMode === 'open' && (
              <PanelCard>
                <div className="space-y-2">
                  <Label>Empleado</Label>
                  <Select value={employeeId || undefined} onValueChange={setEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elegir" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePeople.map((person) => (
                        <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Efectivo que se deja</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0"
                    value={openingAmount}
                    onChange={(event) => setOpeningAmount(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Comentario, opcional</Label>
                  <Textarea
                    placeholder="Nota de la apertura"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </PanelCard>
            )}

            {sheetMode === 'session' && selected && shownBreakdown && (
              <div key={selected.id} className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 gap-3 min-w-0">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Banknote className="w-4 h-4 text-gray-600" />
                      <p className="text-xs text-gray-600">Se dejó</p>
                    </div>
                    {closedDraft ? (
                      <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-gray-900">$</span>
                        <Input
                          inputMode="decimal"
                          placeholder="0"
                          value={openingAmount}
                          onChange={(event) => setOpeningAmount(event.target.value)}
                          className="h-auto bg-transparent border-0 rounded-none px-0 py-0 text-3xl font-bold text-gray-900 shadow-none placeholder:text-gray-300 focus-visible:ring-0 md:text-3xl"
                          aria-label="Efectivo que se dejó"
                        />
                      </div>
                    ) : (
                      <p className="text-3xl font-bold text-gray-900">{money(shownBreakdown.openingAmount)}</p>
                    )}
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="w-4 h-4 text-gray-600" />
                      <p className="text-xs text-gray-600">Hay en caja</p>
                    </div>
                    {selected.closedAt && !editingClosed ? (
                      <p className="text-3xl font-bold text-gray-900">{money(selected.countedAmount || 0)}</p>
                    ) : (
                      <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-gray-900">$</span>
                        <Input
                          inputMode="decimal"
                          placeholder="0"
                          value={countedAmount}
                          onChange={(event) => setCountedAmount(event.target.value)}
                          className="h-auto bg-transparent border-0 rounded-none px-0 py-0 text-3xl font-bold text-gray-900 shadow-none placeholder:text-gray-300 focus-visible:ring-0 md:text-3xl"
                          aria-label="Dinero contado en la caja"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="bg-gray-900 rounded-xl p-4 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-sm font-semibold text-white">Debería cuadrar</p>
                    <p className="text-xl sm:text-3xl font-bold text-white">{money(shownBreakdown.expected)}</p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-2 text-gray-300">
                      <span>Se dejó</span>
                      <span className="font-semibold text-white">{money(shownBreakdown.openingAmount)}</span>
                    </div>
                    <div className="flex justify-between gap-2 text-gray-300">
                      <span>Ventas en efectivo</span>
                      <span className="font-semibold text-white">{money(shownBreakdown.cashSalesTotal)}</span>
                    </div>
                    <div className="flex justify-between gap-2 text-gray-300">
                      <span>Gastos en efectivo</span>
                      <span className="font-semibold text-white">−{money(shownBreakdown.cashExpensesTotal)}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className={`text-sm font-semibold ${liveDifference == null ? 'text-gray-400' : liveDifference < 0 ? 'text-rose-300' : liveDifference > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {liveDifference == null
                        ? 'Ingresa el dinero que hay en la caja.'
                        : liveDifference < 0
                          ? `Faltante ${money(Math.abs(liveDifference))}`
                          : liveDifference > 0
                            ? `Sobrante ${money(liveDifference)}`
                            : 'Cuadra'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Efectivo de esta caja</h3>
                  <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                    <LineFold
                      title="Ventas en efectivo"
                      total={shownBreakdown.cashSalesTotal}
                      lines={shownBreakdown.cashSales}
                      startOpen
                    />
                    <LineFold
                      title="Gastos en efectivo"
                      total={shownBreakdown.cashExpensesTotal}
                      lines={shownBreakdown.cashExpenses}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Fuera de la caja</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <MethodCard
                      title="Tarjeta"
                      total={shownBreakdown.cardTotal}
                      count={shownBreakdown.card.length}
                      lines={shownBreakdown.card}
                    />
                    <MethodCard
                      title="Transferencia"
                      total={shownBreakdown.transferTotal}
                      count={shownBreakdown.transfer.length}
                      lines={shownBreakdown.transfer}
                    />
                  </div>
                </div>

                {selected.closedAt && !editingClosed ? (
                  selected.comment ? (
                    <PanelCard>
                      <p className="text-xs text-gray-600 mb-1">Comentario</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{selected.comment}</p>
                    </PanelCard>
                  ) : null
                ) : (
                  <PanelCard>
                    <div className="space-y-2">
                      <Label>Comentario, opcional</Label>
                      <Textarea
                        placeholder="Nota del cierre"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  </PanelCard>
                )}
              </div>
            )}
          </div>

          {sheetMode != null && (sheetMode === 'open' ? canOpen : selected && !selected.closedAt ? canClose : editingClosed ? canEdit : canEdit || canDelete) && (
            <div className="p-4 sm:p-6 border-t bg-white flex-shrink-0">
              {sheetMode === 'open' ? (
                <Button
                  size="lg"
                  className="w-full h-14 sm:h-[60px] text-base sm:text-lg font-semibold bg-gray-900 hover:bg-gray-800 text-white"
                  onClick={handleOpen}
                  disabled={saving || availablePeople.length === 0}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Abrir caja'}
                </Button>
              ) : selected && !selected.closedAt ? (
                <Button
                  size="lg"
                  className="w-full h-14 sm:h-[60px] text-base sm:text-lg font-semibold bg-gray-900 hover:bg-gray-800 text-white"
                  onClick={handleClose}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cerrar caja'}
                </Button>
              ) : editingClosed ? (
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-14 sm:h-[60px] px-5 text-base font-semibold"
                    onClick={cancelClosedEdit}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    className="flex-1 h-14 sm:h-[60px] text-base sm:text-lg font-semibold bg-gray-900 hover:bg-gray-800 text-white"
                    onClick={handleSaveClosed}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar cambios'}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="flex-1 h-14 sm:h-[60px] text-base font-semibold"
                      onClick={() => setEditingClosed(true)}
                      disabled={saving}
                    >
                      <Edit className="w-5 h-5" />
                      Editar
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="lg"
                      className="flex-1 h-14 sm:h-[60px] text-base font-semibold"
                      onClick={() => setDeleteOpen(true)}
                      disabled={saving}
                    >
                      <Trash2 className="w-5 h-5" />
                      Eliminar
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!saving) setDeleteOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta caja?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el cierre de {selected?.employeeName || 'este empleado'}. Las ventas y los gastos siguen en Movimientos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteClosed();
              }}
            >
              {saving ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
