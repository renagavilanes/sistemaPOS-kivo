import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/card';
import { toast } from 'sonner';
import { Loader2, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';
import { BrandLogo } from '../components/BrandLogo';

interface InviteData {
  businessId: string;
  businessName: string;
  email: string;
  name: string;
  role: string;
  permissions: unknown;
  phone: string | null;
  timestamp?: number;
}

export default function InviteNew() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    async function processInvite() {
      if (!token) {
        setError('Token inválido');
        setPhase('error');
        return;
      }

      try {
        const decoded: InviteData = JSON.parse(atob(token));
        if (decoded.timestamp) {
          const age = Date.now() - decoded.timestamp;
          if (age > 7 * 24 * 60 * 60 * 1000) {
            setError('Este enlace ha expirado. Solicita una nueva invitación.');
            setPhase('error');
            return;
          }
        }

        localStorage.setItem('pending_invitation', token);

        const response = await fetch(
          `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/check-user-exists`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ email: decoded.email }),
          },
        );

        if (!response.ok) throw new Error('No se pudo verificar la invitación');

        const { exists: userExists } = await response.json();

        if (userExists) {
          navigate(
            `/login?email=${encodeURIComponent(decoded.email)}&invite=true&businessName=${encodeURIComponent(decoded.businessName || '')}`,
            { replace: true },
          );
          return;
        }

        setInviteData(decoded);
        setPhase('form');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Token inválido';
        setError(msg);
        setPhase('error');
      }
    }

    processInvite();
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData) return;

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/complete-invite-signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            businessId: inviteData.businessId,
            email: inviteData.email,
            password,
            name: inviteData.name,
            phone: inviteData.phone,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la cuenta');

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: inviteData.email,
        password,
      });
      if (loginError) throw new Error('Cuenta creada pero no se pudo iniciar sesión. Intenta iniciar sesión manualmente.');

      localStorage.removeItem('pending_invitation');
      setPhase('success');
      toast.success(`¡Bienvenido a ${inviteData.businessName}!`);
      setTimeout(() => navigate('/sales', { replace: true }), 1500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear tu cuenta');
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center space-y-4">
            <p className="text-red-600 font-medium">{error}</p>
            <Button onClick={() => navigate('/login')} className="w-full">Ir a inicio de sesión</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="font-semibold text-lg">¡Cuenta creada!</p>
            <p className="text-gray-600 mt-2">Entrando al sistema…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-slate-100 p-4 pt-[calc(4.25rem+env(safe-area-inset-top,0px))] flex items-center justify-center">
      <header className="fixed left-0 right-0 top-0 z-30 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <div className="mx-auto flex max-w-md justify-center px-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/70 px-3.5 py-2.5 text-sm font-medium text-slate-600 shadow-sm backdrop-blur-md"
          >
            <ArrowLeft className="h-4 w-4" />
            Iniciar sesión
          </Link>
        </div>
      </header>

      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <BrandLogo iconClassName="h-14" showText />
          <CardDescription className="text-base">
            Crea tu contraseña para unirte a <strong>{inviteData?.businessName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 mb-4 text-sm text-indigo-900">
            Hola <strong>{inviteData?.name}</strong>, fuiste invitado como empleado.
            Ya confirmaste tu correo al abrir este enlace; solo define tu contraseña.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input value={inviteData?.email || ''} readOnly className="bg-gray-50 h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  className="h-11 pr-10"
                  autoComplete="new-password"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                  className="h-11 pr-10"
                  autoComplete="new-password"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {inviteData?.role && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                Rol asignado: <strong>{inviteData.role}</strong>
              </p>
            )}

            <Button type="submit" disabled={submitting} className="w-full h-12 bg-blue-600 hover:bg-blue-700">
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creando cuenta…
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 mr-2" />
                  Crear mi cuenta
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
