import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabaseAnonKey, supabaseProjectId } from '../../../utils/supabase/publicEnv';
import { superadminEdgeFunctionSlug } from '/utils/supabase/superadminEdgeSlug';
/** Campos mínimos del listado de usuarios del Super Admin */
export type ComunicadoUserRow = {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  blocked?: boolean;
  businesses: number;
};

function superadminApiBase(): string {
  const slug = superadminEdgeFunctionSlug;
  if (import.meta.env.DEV) return `/functions/v1/${slug}`;
  return `https://${supabaseProjectId}.supabase.co/functions/v1/${slug}`;
}

async function fetchComunicadosList(key: string): Promise<Response> {
  const q = `?key=${encodeURIComponent(key)}`;
  return fetch(`${superadminApiBase()}/superadmin/comunicados${q}`, {
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

async function mutateJson(key: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetchSuperadminMutate(key, body);
  const text = await res.text();
  let j: Record<string, unknown> = {};
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text.slice(0, 200) || `Error ${res.status}`);
  }
  if (!res.ok) {
    const parts = [j.error, j.hint].filter((x): x is string => typeof x === 'string' && x.length > 0);
    throw new Error(parts.length ? parts.join(' — ') : `Error ${res.status}`);
  }
  return j;
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export interface ComunicadoSeenByRow {
  user_id: string;
  email: string;
  dismissed_at: string;
}

export interface ComunicadoHistoryRow {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  target_user_ids: string[];
  created_at: string;
  recipient_count: number;
  seen_count: number;
  seen_by?: ComunicadoSeenByRow[];
}

type FilterPreset = {
  search: string;
  activeOnly: boolean;
  inactiveOnly: boolean;
  blockedOnly: boolean;
  notBlocked: boolean;
  minBiz: string;
  maxBiz: string;
};

const defaultFilters: FilterPreset = {
  search: '',
  activeOnly: false,
  inactiveOnly: false,
  blockedOnly: false,
  notBlocked: false,
  minBiz: '',
  maxBiz: '',
};

export function ComunicadosAdminTab({
  users,
  onGlobalReload,
}: {
  users: ComunicadoUserRow[];
  onGlobalReload: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterPreset>({ ...defaultFilters });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [history, setHistory] = useState<ComunicadoHistoryRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histErr, setHistErr] = useState('');
  const [histWarning, setHistWarning] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const u = URL.createObjectURL(imageFile);
    setImagePreview(u);
    setUploadedUrl(null);
    return () => URL.revokeObjectURL(u);
  }, [imageFile]);

  const filteredUsers = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return users.filter(u => {
      if (q && !u.email.toLowerCase().includes(q) && !u.name.toLowerCase().includes(q)) return false;
      if (filters.activeOnly && !u.is_active) return false;
      if (filters.inactiveOnly && u.is_active) return false;
      if (filters.blockedOnly && !u.blocked) return false;
      if (filters.notBlocked && u.blocked) return false;
      const n = u.businesses ?? 0;
      if (filters.minBiz !== '') {
        const m = Number(filters.minBiz);
        if (!Number.isNaN(m) && n < m) return false;
      }
      if (filters.maxBiz !== '') {
        const m = Number(filters.maxBiz);
        if (!Number.isNaN(m) && n > m) return false;
      }
      return true;
    });
  }, [users, filters]);

  const filteredIds = useMemo(() => filteredUsers.map(u => u.id), [filteredUsers]);

  useEffect(() => {
    const set = new Set(filteredIds);
    setSelectedIds(prev => prev.filter(id => set.has(id)));
  }, [filteredIds]);

  const allSel = filteredIds.length > 0 && selectedIds.length === filteredIds.length;
  const someSel = selectedIds.length > 0 && !allSel;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSel;
  }, [someSel]);

  const loadHistory = useCallback(async () => {
    const key = sessionStorage.getItem('superadmin_key') || '';
    if (!key) return;
    setHistLoading(true);
    setHistErr('');
    setHistWarning('');
    try {
      const res = await fetchComunicadosList(key);
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(j.error || res.status));
      setHistory((j.comunicados as ComunicadoHistoryRow[]) || []);
      const w = j._warning;
      setHistWarning(typeof w === 'string' && w.trim() ? w.trim() : '');
    } catch (e: any) {
      setHistErr(e?.message || String(e));
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const toggleOne = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const applyPreset = (kind: 'all' | 'filtered' | 'active' | 'blocked' | 'nobiz' | 'clear') => {
    if (kind === 'clear') {
      setFilters({ ...defaultFilters });
      return;
    }
    if (kind === 'all') {
      setSelectedIds(users.map(u => u.id));
      return;
    }
    if (kind === 'filtered') {
      setSelectedIds([...filteredIds]);
      return;
    }
    if (kind === 'active') {
      setFilters(f => ({ ...defaultFilters, search: f.search, activeOnly: true }));
      setSelectedIds(users.filter(u => u.is_active).map(u => u.id));
      return;
    }
    if (kind === 'blocked') {
      setFilters(f => ({ ...defaultFilters, search: f.search, blockedOnly: true }));
      setSelectedIds(users.filter(u => u.blocked).map(u => u.id));
      return;
    }
    if (kind === 'nobiz') {
      setFilters(f => ({ ...defaultFilters, search: f.search, maxBiz: '0' }));
      setSelectedIds(users.filter(u => (u.businesses ?? 0) === 0).map(u => u.id));
    }
  };

  const runSend = async () => {
    const key = sessionStorage.getItem('superadmin_key') || '';
    if (!key) throw new Error('Sin clave Super Admin');
    if (selectedIds.length === 0) throw new Error('Selecciona destinatarios');
    let imageBase64: string | undefined;
    if (imageFile) {
      const buf = await imageFile.arrayBuffer();
      const b64 = btoa(
        new Uint8Array(buf).reduce((s, byte) => s + String.fromCharCode(byte), ''),
      );
      const mime = imageFile.type || 'image/jpeg';
      imageBase64 = `data:${mime};base64,${b64}`;
    }
    await mutateJson(key, {
      action: 'create_comunicado',
      title: title.trim(),
      comunicadoText: text.trim(),
      image_url: !imageFile && uploadedUrl ? uploadedUrl : null,
      ...(imageBase64 ? { imageBase64 } : {}),
      targetUserIds: selectedIds,
    });
  };

  const handleSend = async () => {
    setSendErr('');
    setSendBusy(true);
    try {
      await runSend();
      setPreviewOpen(false);
      setTitle('');
      setText('');
      setImageFile(null);
      setUploadedUrl(null);
      setSelectedIds([]);
      await loadHistory();
      await onGlobalReload();
    } catch (e: any) {
      setSendErr(e?.message || String(e));
    } finally {
      setSendBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white">Nuevo comunicado</h3>
          <label className="block text-xs text-slate-500">Titular</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            placeholder="Ej.: Mantenimiento programado"
            maxLength={500}
          />
          <label className="block text-xs text-slate-500">Texto</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600"
            placeholder="Mensaje para los usuarios…"
            maxLength={20000}
          />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Imagen (opcional)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={e => setImageFile(e.target.files?.[0] ?? null)}
              className="text-xs text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-white"
            />
            {imageFile && (
              <button type="button" className="text-xs text-red-400 ml-2" onClick={() => setImageFile(null)}>
                Quitar imagen
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setSendErr(''); setPreviewOpen(true); }}
              disabled={!title.trim() || !text.trim() || selectedIds.length === 0}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40"
            >
              Previsualizar y enviar
            </button>
            {sendErr && <p className="text-red-400 text-xs w-full">{sendErr}</p>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Destinatarios</h3>
          <p className="text-xs text-slate-500">
            Filtra la lista, marca usuarios o usa atajos. Cada usuario verá el modal una sola vez.
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200" onClick={() => applyPreset('all')}>
              Todos ({users.length})
            </button>
            <button type="button" className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200" onClick={() => applyPreset('filtered')}>
              Todos los filtrados ({filteredIds.length})
            </button>
            <button type="button" className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200" onClick={() => applyPreset('active')}>
              Activos (30d)
            </button>
            <button type="button" className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200" onClick={() => applyPreset('blocked')}>
              Bloqueados
            </button>
            <button type="button" className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200" onClick={() => applyPreset('nobiz')}>
              Sin negocios
            </button>
            <button type="button" className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-400" onClick={() => applyPreset('clear')}>
              Limpiar filtros
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={filters.activeOnly} onChange={e => setFilters(f => ({ ...f, activeOnly: e.target.checked, inactiveOnly: false }))} />
              Solo activos (30d)
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={filters.inactiveOnly} onChange={e => setFilters(f => ({ ...f, inactiveOnly: e.target.checked, activeOnly: false }))} />
              Solo inactivos
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={filters.blockedOnly} onChange={e => setFilters(f => ({ ...f, blockedOnly: e.target.checked, notBlocked: false }))} />
              Solo bloqueados
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={filters.notBlocked} onChange={e => setFilters(f => ({ ...f, notBlocked: e.target.checked, blockedOnly: false }))} />
              Sin bloqueo
            </label>
            <input
              placeholder="Buscar email o nombre"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="sm:col-span-2 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white"
            />
            <input
              placeholder="Mín. negocios"
              value={filters.minBiz}
              onChange={e => setFilters(f => ({ ...f, minBiz: e.target.value }))}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white"
            />
            <input
              placeholder="Máx. negocios"
              value={filters.maxBiz}
              onChange={e => setFilters(f => ({ ...f, maxBiz: e.target.value }))}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white"
            />
          </div>

          <p className="text-sm text-indigo-300">{selectedIds.length} usuario(s) seleccionado(s)</p>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-800 sticky top-0 text-slate-400">
                <tr>
                  <th className="px-2 py-2 w-8">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSel}
                      onChange={() => setSelectedIds(allSel ? [] : [...filteredIds])}
                      className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                      aria-label="Seleccionar filtrados"
                    />
                  </th>
                  <th className="text-left px-2 py-2">Email</th>
                  <th className="text-left px-2 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/50">
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(u.id)}
                        onChange={() => toggleOne(u.id)}
                        className="rounded border-slate-500 bg-slate-900 text-indigo-600"
                      />
                    </td>
                    <td className="px-2 py-1 text-slate-200 font-mono truncate max-w-[180px]" title={u.email}>{u.email}</td>
                    <td className="px-2 py-1 text-slate-400">
                      {u.blocked ? 'bloq.' : u.is_active ? 'activo' : 'inactivo'} · {u.businesses} neg.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Historial</h3>
          <button type="button" onClick={() => void loadHistory()} className="text-xs text-indigo-400 hover:text-indigo-300">
            Actualizar
          </button>
        </div>
        {histLoading && <p className="text-slate-500 text-sm">Cargando…</p>}
        {histErr && <p className="text-red-400 text-sm">{histErr}</p>}
        {histWarning && (
          <p className="text-amber-200 text-sm rounded-lg border border-amber-800/60 bg-amber-950/40 p-3 mb-2">{histWarning}</p>
        )}
        {!histLoading && !histWarning && history.length === 0 && (
          <p className="text-slate-500 text-sm">Aún no hay comunicados.</p>
        )}
        <ul className="space-y-3">
          {history.map(h => (
            <li key={h.id} className="rounded-lg border border-slate-800 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium text-white">{h.title}</span>
                <span className="text-xs text-slate-500">{fmtWhen(h.created_at)}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Destinatarios: <strong className="text-slate-300">{h.recipient_count}</strong>
                {' · '}
                Ya visto (cerraron el modal): <strong className="text-emerald-400">{h.seen_count}</strong>
              </p>
              {h.seen_count > 0 && (
                <details className="mt-2 rounded-lg border border-slate-700/80 bg-slate-950/50 open:border-slate-600">
                  <summary className="cursor-pointer select-none list-none px-2 py-1.5 text-xs text-indigo-300 hover:text-indigo-200 [&::-webkit-details-marker]:hidden flex items-center gap-1">
                    <span className="text-slate-500">▸</span>
                    Ver quién cerró el aviso ({h.seen_count})
                  </summary>
                  <ul className="px-2 pb-2 pt-0 max-h-40 overflow-y-auto space-y-1 border-t border-slate-800/80">
                    {(h.seen_by ?? []).map((s) => (
                      <li key={s.user_id} className="text-xs text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5 py-0.5 border-b border-slate-800/50 last:border-0">
                        <span className="text-slate-200 font-mono truncate max-w-[200px]" title={s.email || s.user_id}>
                          {s.email || s.user_id.slice(0, 8) + '…'}
                        </span>
                        <span className="text-slate-500">{fmtWhen(s.dismissed_at)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="text-slate-500 text-xs mt-2 line-clamp-2 whitespace-pre-wrap">{h.body}</p>
            </li>
          ))}
        </ul>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Cerrar" onClick={() => !sendBusy && setPreviewOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden text-slate-900">
            <div className="relative px-4 pt-10 pb-4 border-b border-slate-200 bg-white">
              <button
                type="button"
                className="absolute left-3 top-3 text-slate-500 hover:text-slate-900 text-2xl leading-none w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100"
                onClick={() => !sendBusy && setPreviewOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
              <h4 className="text-lg font-semibold text-slate-900 text-center pr-6">{title.trim() || 'Sin titular'}</h4>
            </div>
            <div className="p-4 max-h-[50vh] overflow-y-auto bg-white">
              {(uploadedUrl || imagePreview) && (
                <img
                  src={uploadedUrl || imagePreview || ''}
                  alt=""
                  className="w-full rounded-lg mb-3 max-h-48 object-contain bg-slate-100 border border-slate-100"
                />
              )}
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{text.trim() || '—'}</p>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap gap-2 justify-end bg-slate-50">
              <button
                type="button"
                disabled={sendBusy}
                onClick={() => setPreviewOpen(false)}
                className="px-3 py-1.5 rounded-lg text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                Volver a editar
              </button>
              <button
                type="button"
                disabled={sendBusy}
                onClick={() => void handleSend()}
                className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-500"
              >
                {sendBusy ? 'Enviando…' : 'Confirmar envío'}
              </button>
            </div>
            {sendErr && <p className="text-red-600 text-xs px-4 pb-3 bg-white">{sendErr}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
