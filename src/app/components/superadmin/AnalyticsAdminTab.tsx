import { useCallback, useEffect, useMemo, useState } from 'react';
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
};

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

function Delta({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct)) return <span className="text-slate-500">—</span>;
  const up = pct > 0.5;
  const down = pct < -0.5;
  const cls = up ? 'text-emerald-400' : down ? 'text-rose-400' : 'text-slate-400';
  const sign = pct > 0 ? '+' : '';
  return <span className={cls}>{sign}{pct.toFixed(1)}%</span>;
}

function KpiCard({
  label,
  value,
  pct,
  hint,
}: {
  label: string;
  value: string;
  pct?: number | null;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 sm:p-4 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl sm:text-2xl font-semibold tabular-nums text-white truncate">{value}</div>
      <div className="mt-1 text-xs flex items-center gap-2">
        {pct !== undefined ? (
          <>
            <Delta pct={pct} />
            <span className="text-slate-500">vs periodo anterior</span>
          </>
        ) : hint ? (
          <span className="text-slate-500">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  fontSize: 12,
};

export function AnalyticsAdminTab() {
  const [preset, setPreset] = useState<PresetId>('30d');
  const [from, setFrom] = useState(() => rangeForPreset('30d').from);
  const [to, setTo] = useState(() => rangeForPreset('30d').to);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const q = `?key=${encodeURIComponent(key)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
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
  }, [from, to]);

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

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                preset === p.id
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <label className="text-xs text-slate-400">
            Desde
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset('custom');
                setFrom(e.target.value);
              }}
              className="ml-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Hasta
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset('custom');
                setTo(e.target.value);
              }}
              className="ml-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? 'Cargando…' : 'Aplicar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-800 animate-pulse" />
          ))}
        </div>
      )}

      {k && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Ventas ($)" value={`$${formatCurrency(k.salesTotal.value)}`} pct={k.salesTotal.changePct} />
            <KpiCard label="Nº de ventas" value={String(Math.round(k.salesCount.value))} pct={k.salesCount.changePct} />
            <KpiCard label="Ticket promedio" value={`$${formatCurrency(k.avgTicket.value)}`} pct={k.avgTicket.changePct} />
            <KpiCard label="Neto (ventas − gastos)" value={`$${formatCurrency(k.net.value)}`} pct={k.net.changePct} />
            <KpiCard label="Gastos ($)" value={`$${formatCurrency(k.expensesTotal.value)}`} pct={k.expensesTotal.changePct} />
            <KpiCard label="Usuarios nuevos" value={String(Math.round(k.newUsers.value))} pct={k.newUsers.changePct} />
            <KpiCard label="Negocios nuevos" value={String(Math.round(k.newBusinesses.value))} pct={k.newBusinesses.changePct} />
            <KpiCard
              label="Actividad"
              value={`${k.activeBusinesses} negocios`}
              hint={`${k.activeUsers} usuarios con sesión en el periodo`}
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Nº de gastos" value={String(Math.round(k.expensesCount.value))} pct={k.expensesCount.changePct} />
            <KpiCard label="Contactos nuevos" value={String(Math.round(k.newCustomers.value))} pct={k.newCustomers.changePct} />
            <KpiCard label="Empleados nuevos" value={String(Math.round(k.newEmployees.value))} pct={k.newEmployees.changePct} />
            <KpiCard
              label="Comparación"
              value={`${data.fromYmd} → ${data.toYmd}`}
              hint={data.grain === 'week' ? 'Serie agrupada por semana' : 'Serie diaria'}
            />
          </div>
        </>
      )}

      {chartRows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm font-medium text-white">Ventas y gastos ($)</div>
            <div className="text-[11px] text-slate-500 mb-2">Suma del periodo seleccionado</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} width={48} />
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
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm font-medium text-white">Cantidad de ventas y usuarios nuevos</div>
            <div className="text-[11px] text-slate-500 mb-2">Barras = ventas · Área = altas de usuario</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} width={32} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="salesCount" name="Ventas" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="newUsers" name="Usuarios nuevos" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {!!data?.topBusinesses?.length && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 text-sm font-medium">Top negocios por ventas</div>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Negocio</th>
                  <th className="text-right font-medium px-3 py-2">Ventas</th>
                  <th className="text-right font-medium px-4 py-2">Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.topBusinesses.map((b) => (
                  <tr key={b.id} className="border-t border-slate-800/80">
                    <td className="px-4 py-2 text-slate-200 truncate max-w-[220px]">{b.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-indigo-300">{b.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-400">${formatCurrency(b.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!!data?.paymentMethods?.length && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 text-sm font-medium">Métodos de pago</div>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Método</th>
                  <th className="text-right font-medium px-3 py-2">Usos</th>
                  <th className="text-right font-medium px-4 py-2">Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.paymentMethods.map((p) => (
                  <tr key={p.method} className="border-t border-slate-800/80">
                    <td className="px-4 py-2 text-slate-200 capitalize">{p.method}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">{p.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-400">${formatCurrency(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
