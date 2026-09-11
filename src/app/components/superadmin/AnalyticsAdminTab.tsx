import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { supabaseAnonKey, supabaseProjectId } from '../../../utils/supabase/publicEnv';
import { superadminEdgeFunctionSlug } from '/utils/supabase/superadminEdgeSlug';
import { formatCurrency } from '../../utils/currency';

type Kpi = { value: number; previous: number; changePct: number | null };

type AnalyticsPayload = {
  fromYmd: string;
  toYmd: string;
  grain: 'day' | 'week';
  kpis: {
    salesTotal: Kpi;
    salesCount: Kpi;
    avgTicket: Kpi;
    expensesTotal: Kpi;
    expensesCount: Kpi;
    net: Kpi;
    newUsers: Kpi;
    newBusinesses: Kpi;
    newCustomers: Kpi;
    newEmployees: Kpi;
    activeUsers: number;
    activeBusinesses: number;
  };
  series: { date: string; salesCount: number; salesTotal: number; expensesTotal: number; newUsers: number }[];
  topBusinesses: { id: string; name: string; count: number; total: number }[];
  paymentMethods: { method: string; count: number; total: number }[];
  modules?: { id: string; name: string; events: number; businesses: number }[];
  scope?: { type: 'all' } | { type: 'business'; id: string; name: string } | { type: 'businesses'; ids: string[]; names: string[] };
};

type BusinessOption = { id: string; name: string };

function superadminApiBase(): string {
  const slug = superadminEdgeFunctionSlug;
  if (import.meta.env.DEV) return `/functions/v1/${slug}`;
  return `https://${supabaseProjectId}.supabase.co/functions/v1/${slug}`;
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return ymdLocal(dt);
}

const PRESETS = [
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: '90 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'lastMonth', label: 'Mes anterior' },
  { id: 'year', label: 'Este año' },
  { id: 'custom', label: 'Personalizado' },
] as const;

type PresetId = (typeof PRESETS)[number]['id'];

function rangeForPreset(id: Exclude<PresetId, 'custom'>): { from: string; to: string } {
  const to = ymdLocal(new Date());
  if (id === '7d') return { from: addDaysYmd(to, -6), to };
  if (id === '30d') return { from: addDaysYmd(to, -29), to };
  if (id === '90d') return { from: addDaysYmd(to, -89), to };
  if (id === 'month') return { from: `${to.slice(0, 8)}01`, to };
  if (id === 'lastMonth') {
    const d = new Date();
    const firstThis = new Date(d.getFullYear(), d.getMonth(), 1);
    const firstPrev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const lastPrev = new Date(firstThis.getTime() - 86400000);
    return { from: ymdLocal(firstPrev), to: ymdLocal(lastPrev) };
  }
  return { from: `${to.slice(0, 4)}-01-01`, to };
}

function Delta({ pct, compact }: { pct: number | null; compact?: boolean }) {
  if (pct == null || !Number.isFinite(pct)) return <span className="text-slate-500">—</span>;
  const up = pct > 0.5;
  const down = pct < -0.5;
  const cls = up ? 'text-emerald-400' : down ? 'text-rose-400' : 'text-slate-400';
  const sign = pct > 0 ? '+' : '';
  return (
    <span className={`${cls} tabular-nums ${compact ? 'text-xs' : 'text-sm font-medium'}`}>
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  fontSize: 12,
};

export function AnalyticsAdminTab({ businesses = [] }: { businesses?: BusinessOption[] }) {
  const [preset, setPreset] = useState<PresetId>('30d');
  const [from, setFrom] = useState(() => rangeForPreset('30d').from);
  const [to, setTo] = useState(() => rangeForPreset('30d').to);
  const [selectedBizIds, setSelectedBizIds] = useState<string[]>([]);
  const [bizOpen, setBizOpen] = useState(false);
  const bizMenuRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const businessOptions = useMemo(
    () => [...businesses].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [businesses],
  );
  const scoped = selectedBizIds.length > 0;
  const bizIdsKey = selectedBizIds.slice().sort().join(',');

  useEffect(() => {
    if (!bizOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!bizMenuRef.current?.contains(e.target as Node)) setBizOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [bizOpen]);

  const applyPreset = (id: PresetId) => {
    setPreset(id);
    if (id === 'custom') return;
    const r = rangeForPreset(id);
    setFrom(r.from);
    setTo(r.to);
  };

  const load = useCallback(async () => {
    const key = sessionStorage.getItem('superadmin_key') || '';
    if (!key) {
      setError('Falta la clave de Super Admin.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const ids = bizIdsKey ? `&businessIds=${encodeURIComponent(bizIdsKey)}` : '';
      const q = `?key=${encodeURIComponent(key)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${ids}`;
      const res = await fetch(`${superadminApiBase()}/superadmin/analytics${q}`, {
        headers: { Authorization: `Bearer ${supabaseAnonKey}` },
      });
      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 180) || `Error ${res.status}`);
      }
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setData(json as AnalyticsPayload);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los reportes');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, bizIdsKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartRows = useMemo(() => {
    return (data?.series || []).map((s) => ({
      ...s,
      label: data?.grain === 'week' ? `sem ${s.date.slice(5)}` : s.date.slice(5),
    }));
  }, [data]);

  const k = data?.kpis;
  const scopeTitle =
    selectedBizIds.length === 1
      ? (businessOptions.find((b) => b.id === selectedBizIds[0])?.name
        || (data?.scope && 'names' in data.scope ? data.scope.names[0] : '')
        || (data?.scope?.type === 'business' ? data.scope.name : ''))
      : selectedBizIds.length > 1
        ? `${selectedBizIds.length} negocios`
        : '';
  const bizButtonLabel =
    selectedBizIds.length === 0
      ? 'Todos los negocios'
      : selectedBizIds.length === 1
        ? (businessOptions.find((b) => b.id === selectedBizIds[0])?.name || '1 negocio')
        : `${selectedBizIds.length} negocios`;

  const toggleBiz = (id: string) => {
    setSelectedBizIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const maxModuleEvents = Math.max(1, ...(data?.modules || []).map((m) => m.events));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 whitespace-nowrap">
        <div className="flex gap-1 shrink-0">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                preset === p.id
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <div className="relative" ref={bizMenuRef}>
            <button
              type="button"
              onClick={() => setBizOpen((o) => !o)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-white max-w-[13rem] truncate"
            >
              {bizButtonLabel}
            </button>
            {bizOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 w-64 rounded-xl border border-slate-700 bg-slate-900 shadow-xl py-1 max-h-72 overflow-y-auto">
                <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBizIds.length === 0}
                    onChange={() => setSelectedBizIds([])}
                  />
                  Todos los negocios
                </label>
                <div className="border-t border-slate-800 my-1" />
                {businessOptions.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedBizIds.includes(b.id)}
                      onChange={() => toggleBiz(b.id)}
                    />
                    <span className="truncate">{b.name || 'Sin nombre'}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setPreset('custom');
              setFrom(e.target.value);
            }}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white w-[9.2rem]"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setPreset('custom');
              setTo(e.target.value);
            }}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white w-[9.2rem]"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? 'Cargando…' : 'Aplicar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {loading && !data && (
        <div className="space-y-4">
          <div className="h-36 rounded-2xl bg-slate-800/80 animate-pulse" />
          <div className="h-64 rounded-2xl bg-slate-800/80 animate-pulse" />
        </div>
      )}

      {k && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 rounded-2xl bg-emerald-950/40 border border-emerald-900/50 px-5 py-5 sm:px-6 sm:py-6">
            <div className="text-sm text-emerald-200/80">
              Ventas del periodo
              {scopeTitle ? ` · ${scopeTitle}` : ''}
            </div>
            <div className="mt-1 text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums text-white">
              ${formatCurrency(k.salesTotal.value)}
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <Delta pct={k.salesTotal.changePct} />
              <span className="text-slate-400">vs el periodo anterior del mismo largo</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <div className="text-slate-400">Nº de ventas</div>
                <div className="text-lg font-medium tabular-nums text-white">
                  {Math.round(k.salesCount.value)} <Delta pct={k.salesCount.changePct} compact />
                </div>
              </div>
              <div>
                <div className="text-slate-400">Ticket promedio</div>
                <div className="text-lg font-medium tabular-nums text-white">
                  ${formatCurrency(k.avgTicket.value)} <Delta pct={k.avgTicket.changePct} compact />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="flex-1 rounded-2xl px-5 py-4 bg-slate-900/80">
              <div className="text-sm text-slate-400">Neto</div>
              <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-white">${formatCurrency(k.net.value)}</div>
              <div className="mt-1 text-xs text-slate-500">
                Ventas − gastos · <Delta pct={k.net.changePct} compact />
              </div>
            </div>
            <div className="rounded-2xl px-5 py-4 bg-slate-900/50 flex items-end justify-between gap-3">
              <div>
                <div className="text-sm text-slate-400">Gastos</div>
                <div className="text-xl font-semibold tabular-nums text-amber-200">${formatCurrency(k.expensesTotal.value)}</div>
              </div>
              <div className="text-right text-xs text-slate-500">
                {Math.round(k.expensesCount.value)} movimientos
                <div>
                  <Delta pct={k.expensesTotal.changePct} compact />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {chartRows.length > 0 && (
        <div className="rounded-2xl bg-slate-900/40 px-4 sm:px-5 py-4">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-medium text-white">Evolución de dinero</div>
              <div className="text-[11px] text-slate-500">Verde ventas · ámbar gastos</div>
            </div>
            <div className="text-[11px] text-slate-500 hidden sm:block">
              {data?.fromYmd} → {data?.toYmd}
              {data?.grain === 'week' ? ' · por semana' : ' · diario'}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} width={52} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => [`$${formatCurrency(Number(v) || 0)}`, name]}
                />
                <Area type="monotone" dataKey="salesTotal" name="Ventas" stroke="#34d399" fill="#34d39933" strokeWidth={2} />
                <Area type="monotone" dataKey="expensesTotal" name="Gastos" stroke="#fbbf24" fill="#fbbf2433" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {chartRows.length > 0 && (
          <div className={`${data?.topBusinesses?.length ? 'lg:col-span-7' : 'lg:col-span-12'} rounded-2xl bg-slate-900/40 px-4 sm:px-5 py-4`}>
            <div className="text-sm font-medium text-white">Volumen</div>
            <div className="text-[11px] text-slate-500 mb-2">
              {scoped ? 'Índigo = ventas · cian = empleados nuevos' : 'Índigo = ventas · cian = usuarios nuevos'}
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} width={28} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="salesCount" name="Ventas" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="newUsers" name={scoped ? 'Empleados nuevos' : 'Usuarios nuevos'} fill="#22d3ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {!!data?.topBusinesses?.length && (
          <div className="lg:col-span-5 px-1 sm:px-2">
            <div className="text-sm font-medium text-white mb-3">Quién vende más</div>
            <ol className="space-y-3">
              {data.topBusinesses.map((b, i) => {
                const max = data.topBusinesses[0]?.total || 1;
                const w = Math.max(8, Math.round((b.total / max) * 100));
                return (
                  <li key={b.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-slate-200 truncate">
                        <span className="text-slate-500 tabular-nums mr-2">{i + 1}</span>
                        {b.name}
                      </span>
                      <span className="tabular-nums text-emerald-400 shrink-0">${formatCurrency(b.total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${w}%` }} />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{b.count} ventas</div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {k && (
        <div className="flex flex-wrap gap-x-8 gap-y-4 px-1 py-2 text-sm border-t border-slate-800/80 pt-5">
          {!scoped && (
            <div>
              <div className="text-slate-500 text-xs">Usuarios nuevos</div>
              <div className="font-medium tabular-nums">
                {Math.round(k.newUsers.value)} <Delta pct={k.newUsers.changePct} compact />
              </div>
            </div>
          )}
          {!scoped && (
            <div>
              <div className="text-slate-500 text-xs">Negocios nuevos</div>
              <div className="font-medium tabular-nums">
                {Math.round(k.newBusinesses.value)} <Delta pct={k.newBusinesses.changePct} compact />
              </div>
            </div>
          )}
          <div>
            <div className="text-slate-500 text-xs">Contactos nuevos</div>
            <div className="font-medium tabular-nums">
              {Math.round(k.newCustomers.value)} <Delta pct={k.newCustomers.changePct} compact />
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">Empleados nuevos</div>
            <div className="font-medium tabular-nums">
              {Math.round(k.newEmployees.value)} <Delta pct={k.newEmployees.changePct} compact />
            </div>
          </div>
          {!scoped && (
            <div>
              <div className="text-slate-500 text-xs">Negocios con ventas</div>
              <div className="font-medium tabular-nums">{k.activeBusinesses}</div>
            </div>
          )}
          {!scoped && (
            <div>
              <div className="text-slate-500 text-xs">Usuarios que entraron</div>
              <div className="font-medium tabular-nums">{k.activeUsers}</div>
            </div>
          )}
        </div>
      )}

      {!!data?.paymentMethods?.length && (
        <div className="px-1">
          <div className="text-sm font-medium text-white mb-3">Cómo pagan</div>
          <div className="space-y-2.5 max-w-xl">
            {data.paymentMethods.map((p) => {
              const max = data.paymentMethods[0]?.total || 1;
              const w = Math.max(6, Math.round((p.total / max) * 100));
              return (
                <div key={p.method} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
                  <span className="text-slate-300 capitalize truncate">{p.method}</span>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-400/80" style={{ width: `${w}%` }} />
                  </div>
                  <span className="tabular-nums text-slate-200">${formatCurrency(p.total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!!data?.modules?.length && (
        <div className="px-1 pt-2">
          <div className="text-sm font-medium text-white">Módulos más usados</div>
          <div className="text-[11px] text-slate-500 mb-3">
            Altas del periodo: ventas, gastos, productos, contactos, empleados. Catálogo cuenta configuraciones guardadas y negocios con catálogo activo.
          </div>
          <div className="space-y-2.5 max-w-xl">
            {data.modules.map((m) => {
              const w = Math.max(6, Math.round((m.events / maxModuleEvents) * 100));
              return (
                <div key={m.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
                  <span className="text-slate-300 truncate">{m.name}</span>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-400/80" style={{ width: `${w}%` }} />
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                    {m.events} · {m.businesses} neg.
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
