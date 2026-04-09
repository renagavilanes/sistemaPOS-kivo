import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { APP_PATHNAME_EVENT } from '../routes';
import { supabase } from '../lib/supabase';
import {
  clearSessionBusinessId,
  CURRENT_BUSINESS_ID_KEY,
  snapshotSessionBusinessAsUserPreference,
} from '../lib/businessSelectionStorage';
import { Session as SupabaseSession } from '@supabase/supabase-js';
// Removed fixEmployeeUserId import — migration already completed, was causing 401 on every load

/** WhatsApp soporte (Ecuador +593), sin + para wa.me */
const SUPPORT_WHATSAPP_PHONE = '593958808548';

function supportWhatsAppHref(userEmail: string): string {
  const text = encodeURIComponent(`Hola, necesito soporte. Mi cuenta: ${userEmail}`);
  return `https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=${text}`;
}

interface User {
  id: string;
  email: string;
  businessName?: string;
  ownerName?: string;
  phone?: string;
}

interface Business {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string;
  phone?: string;
  address?: string;
  email?: string;
  logo?: string;
  country?: string;
  currency?: string;
  tax_id?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: SupabaseSession | null;
  business: Business | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshBusiness: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_BLOCK_MSG =
  'Tu acceso al sistema ha sido restringido. Si crees que es un error, contacta al administrador.';

function normalizeAppPath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p;
}

/** El panel Super Admin usa la misma sesión Supabase que otras pestañas; no mostrar el modal de bloqueo ahí. */
function isSuperAdminRoute(pathname: string): boolean {
  return normalizeAppPath(pathname) === "/superadmin";
}

type PendingComunicado = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountSuspended, setAccountSuspended] = useState<{ message: string; email: string } | null>(null);
  const [pendingComunicado, setPendingComunicado] = useState<PendingComunicado | null>(null);
  const [appPathname, setAppPathname] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "",
  );

  const loadCurrentBusiness = async (userId: string, accessToken?: string) => {
    try {
      const currentBusinessId = localStorage.getItem(CURRENT_BUSINESS_ID_KEY);
      if (!currentBusinessId) return;

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', currentBusinessId)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.warn('⚠️ Error leyendo negocio:', error.code, error.message);
        }
        return;
      }

      if (data) {
        setBusiness(data as Business);
        console.log('✅ Negocio cargado:', data.name);
      }
    } catch (error: any) {
      console.error('❌ Error cargando negocio (no crítico):', error.message || error);
    }
  };

  const refreshBusiness = async () => {
    if (user && session) {
      await loadCurrentBusiness(user.id, session.access_token);
    }
  };

  useEffect(() => {
    const onPath = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (typeof ce.detail === "string") setAppPathname(ce.detail);
    };
    window.addEventListener(APP_PATHNAME_EVENT, onPath as EventListener);
    return () => window.removeEventListener(APP_PATHNAME_EVENT, onPath as EventListener);
  }, []);

  const syncAccountSuspension = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    const uid = s?.user?.id;
    const email = s?.user?.email ?? '';
    if (!uid) {
      setAccountSuspended(null);
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('metadata')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      console.warn('AuthContext: no se pudo leer users.metadata (no crítico):', error.message);
      setAccountSuspended(null);
      return;
    }

    const md = (data?.metadata ?? {}) as Record<string, unknown>;
    const blocked = md.superadmin_blocked === true;
    const raw = md.superadmin_block_message;
    const msg =
      typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : DEFAULT_BLOCK_MSG;
    if (blocked) setAccountSuspended({ message: msg, email });
    else setAccountSuspended(null);
  }, []);

  const syncPendingComunicado = useCallback(async () => {
    if (isSuperAdminRoute(appPathname)) {
      setPendingComunicado(null);
      return;
    }
    const { data: { session: s } } = await supabase.auth.getSession();
    const uid = s?.user?.id;
    if (!uid) {
      setPendingComunicado(null);
      return;
    }

    const { data: rows, error } = await supabase
      .from("admin_comunicados")
      .select("id, title, body, image_url, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      const msg = error.message || "";
      if (!msg.includes("does not exist") && !msg.includes("schema cache") && error.code !== "42P01") {
        console.warn("AuthContext: admin_comunicados:", msg);
      }
      setPendingComunicado(null);
      return;
    }

    const { data: dismissed } = await supabase
      .from("admin_comunicado_dismissals")
      .select("comunicado_id")
      .eq("user_id", uid);

    const disSet = new Set((dismissed ?? []).map((x: { comunicado_id: string }) => x.comunicado_id));
    const list = (rows ?? []) as PendingComunicado[];
    const next = list.find(r => !disSet.has(r.id));
    setPendingComunicado(next ?? null);
  }, [appPathname]);

  const dismissComunicado = useCallback(async () => {
    const c = pendingComunicado;
    const { data: { session: s } } = await supabase.auth.getSession();
    const uid = s?.user?.id;
    if (!c || !uid) return;
    const { error } = await supabase.from("admin_comunicado_dismissals").insert({
      comunicado_id: c.id,
      user_id: uid,
    });
    if (error) {
      console.warn("No se pudo registrar cierre de comunicado:", error.message);
    }
    setPendingComunicado(null);
    void syncPendingComunicado();
  }, [pendingComunicado, syncPendingComunicado]);

  useEffect(() => {
    console.log('🔐 AuthContext: Inicializando...');

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      setSession(currentSession);

      if (currentSession?.user) {
        const userData: User = {
          id: currentSession.user.id,
          email: currentSession.user.email || '',
          businessName: currentSession.user.user_metadata?.business_name,
          phone: currentSession.user.user_metadata?.phone,
        };
        setUser(userData);
        loadCurrentBusiness(currentSession.user.id, currentSession.access_token);
        await syncAccountSuspension();
        await syncPendingComunicado();
      } else {
        setUser(null);
        setBusiness(null);
        setAccountSuspended(null);
        setPendingComunicado(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);

      if (currentSession?.user) {
        const userData: User = {
          id: currentSession.user.id,
          email: currentSession.user.email || '',
          businessName: currentSession.user.user_metadata?.business_name,
          phone: currentSession.user.user_metadata?.phone,
        };
        setUser(userData);
        loadCurrentBusiness(currentSession.user.id, currentSession.access_token);
        void syncAccountSuspension();
        void syncPendingComunicado();
      } else {
        setUser(null);
        setBusiness(null);
        setAccountSuspended(null);
        setPendingComunicado(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [syncAccountSuspension, syncPendingComunicado]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void syncAccountSuspension();
    }, 12000);
    const onFocus = () => {
      void syncAccountSuspension();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncAccountSuspension]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void syncPendingComunicado();
    }, 15000);
    const onFocus = () => {
      void syncPendingComunicado();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [syncPendingComunicado]);

  useEffect(() => {
    void syncPendingComunicado();
  }, [appPathname, syncPendingComunicado]);

  useEffect(() => {
    const handleBusinessChanged = () => {
      console.log('🔄 Evento businessChanged recibido');
      if (user && session) {
        loadCurrentBusiness(user.id);
      }
    };

    window.addEventListener('businessChanged', handleBusinessChanged);

    return () => {
      window.removeEventListener('businessChanged', handleBusinessChanged);
    };
  }, [user, session]);

  const signOut = async () => {
    console.log('👋 Cerrando sesión...');
    setAccountSuspended(null);
    setPendingComunicado(null);
    if (user?.id) {
      snapshotSessionBusinessAsUserPreference(user.id);
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setBusiness(null);
    clearSessionBusinessId();
  };

  const openSupportWhatsApp = () => {
    const email = accountSuspended?.email || user?.email || '';
    const href = supportWhatsAppHref(email);
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const comunicadoLayer =
    !loading && !accountSuspended && pendingComunicado && !isSuperAdminRoute(appPathname) ? (
      <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
        <div
          className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden text-slate-900"
          role="dialog"
          aria-modal="true"
          aria-labelledby="comunicado-title"
        >
          <button
            type="button"
            className="absolute left-3 top-3 z-10 text-slate-500 hover:text-slate-900 text-2xl leading-none w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            onClick={() => void dismissComunicado()}
            aria-label="Cerrar y omitir"
          >
            ×
          </button>
          <div className="px-4 pt-12 pb-3 border-b border-slate-200 bg-white">
            <h2 id="comunicado-title" className="text-lg font-semibold text-slate-900 pr-8 text-center">
              {pendingComunicado.title}
            </h2>
          </div>
          <div className="p-4 max-h-[min(60vh,420px)] overflow-y-auto bg-white">
            {pendingComunicado.image_url ? (
              <img
                src={pendingComunicado.image_url}
                alt=""
                className="w-full rounded-xl mb-4 max-h-52 object-contain bg-slate-100 border border-slate-100 mx-auto"
              />
            ) : null}
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{pendingComunicado.body}</p>
          </div>
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-center">
            <button
              type="button"
              onClick={() => void dismissComunicado()}
              className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2"
            >
              Omitir
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const suspendedLayer =
    accountSuspended && !isSuperAdminRoute(appPathname) ? (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
        <div
          className="max-w-lg w-full rounded-2xl border border-red-900/50 bg-slate-900 p-8 shadow-2xl text-center"
          role="alertdialog"
          aria-labelledby="suspend-title"
          aria-describedby="suspend-desc"
        >
          <h2 id="suspend-title" className="text-xl font-semibold text-red-300 mb-3">
            Acceso restringido
          </h2>
          <p id="suspend-desc" className="text-slate-200 text-left whitespace-pre-wrap text-sm leading-relaxed mb-6">
            {accountSuspended.message}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={openSupportWhatsApp}
              className="w-full sm:flex-1 px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors"
            >
              Contactar soporte
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full sm:flex-1 px-5 py-3 rounded-xl bg-slate-100 text-slate-900 font-semibold hover:bg-white transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <AuthContext.Provider value={{ user, session, business, loading, signOut, refreshBusiness }}>
      {typeof document !== 'undefined' && comunicadoLayer ? createPortal(comunicadoLayer, document.body) : null}
      {typeof document !== 'undefined' && suspendedLayer ? createPortal(suspendedLayer, document.body) : null}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
