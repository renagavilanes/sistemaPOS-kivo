import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { LogIn, Mail, Loader2, Store, ArrowLeft, CheckCircle2, Lock, Eye, EyeOff, X, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBusiness } from '../contexts/BusinessContext'; // Re-added: need to reload businesses after login
import { supabase } from '../lib/supabase';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { BrandLogo } from '../components/BrandLogo';

type Step = 'login' | 'forgot-email' | 'forgot-code' | 'forgot-password';
type ViewMode = 'accounts-list' | 'email-password' | 'password-only';

interface SavedAccount {
  email: string;
  lastLogin: string;
  initials: string;
}

/** Misma convención que accept-invite: …/functions/v1/make-server-3508045b/<ruta>. El worker Hono enlaza /make-server-3508045b/<ruta>. */
function makeServerEdgeUrl(pathAfterFunction: string): string {
  const p = pathAfterFunction.replace(/^\//, '');
  return `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/${p}`;
}

async function readMakeServerJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (res.status === 404) {
      throw new Error(
        'Servicio de recuperación no encontrado (404). Despliega la función Edge «make-server-3508045b» con la versión actual del servidor.',
      );
    }
    throw new Error(`Respuesta no válida del servidor (${res.status})`);
  }
}

// Utilidades para localStorage
const STORAGE_KEY = 'figma_pos_user_accounts_cache';

const getSavedAccounts = (): SavedAccount[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    console.log('🔍 Leyendo localStorage:', saved ? 'encontrado' : 'null');
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('❌ Error leyendo localStorage:', error);
    return [];
  }
};

const saveAccount = (email: string) => {
  try {
    const accounts = getSavedAccounts();
    const initials = email.split('@')[0].slice(0, 2).toUpperCase();
    
    // Eliminar cuenta existente si ya está guardada
    const filtered = accounts.filter(acc => acc.email !== email);
    
    // Agregar al inicio
    const updated = [
      { email, lastLogin: new Date().toISOString(), initials },
      ...filtered
    ].slice(0, 5); // Máximo 5 cuentas
    
    console.log('💾 Guardando en localStorage:', updated.length, 'cuentas');
    const jsonString = JSON.stringify(updated);
    localStorage.setItem(STORAGE_KEY, jsonString);
    
    // Verificar que se guardó correctamente
    const verification = localStorage.getItem(STORAGE_KEY);
    console.log('✅ Verificación guardado:', verification === jsonString ? 'OK' : 'FALLÓ');
  } catch (error) {
    console.error('❌ Error guardando cuenta:', error);
  }
};

const removeAccount = (email: string) => {
  try {
    const accounts = getSavedAccounts();
    const filtered = accounts.filter(acc => acc.email !== email);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error eliminando cuenta:', error);
  }
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loadBusinesses } = useBusiness(); // Re-added: need to reload businesses after login
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('login');
  const [viewMode, setViewMode] = useState<ViewMode>('accounts-list');
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    code: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Cargar cuentas guardadas al montar
  useEffect(() => {
    const accounts = getSavedAccounts();
    console.log('📦 Cuentas guardadas encontradas:', accounts.length);
    console.log('📦 Detalle de cuentas:', accounts);
    setSavedAccounts(accounts);
    
    // Si hay cuentas guardadas, mostrar lista
    if (accounts.length > 0) {
      console.log('✅ Mostrando lista de cuentas');
      setViewMode('accounts-list');
    } else {
      console.log('ℹ️ No hay cuentas, mostrando formulario completo');
      setViewMode('email-password');
    }
  }, []);

  // Cargar email de invitación si viene en la URL
  useEffect(() => {
    const emailParam = searchParams.get('email');
    const isInvite = searchParams.get('invite') === 'true';
    
    if (isInvite && emailParam) {
      console.log('📧 [LOGIN] Invitación detectada:', emailParam);
      setFormData(prev => ({ ...prev, email: emailParam }));
      setViewMode('email-password');
    }
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      console.log('✅ Usuario ya tiene sesión activa, redirigiendo...');
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Seleccionar una cuenta guardada
  const handleSelectAccount = (account: SavedAccount) => {
    console.log('✅ Cuenta seleccionada:', account.email);
    setSelectedAccount(account);
    setFormData({ ...formData, email: account.email, password: '' });
    setViewMode('password-only');
  };

  // Usar otra cuenta
  const handleUseAnotherAccount = () => {
    console.log('🔄 Usando otra cuenta');
    setSelectedAccount(null);
    setFormData({ email: '', password: '', code: '', newPassword: '', confirmPassword: '' });
    setViewMode('email-password');
  };

  // Eliminar cuenta guardada
  const handleRemoveAccount = (email: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    console.log('🗑️ Eliminando cuenta:', email);
    removeAccount(email);
    setSavedAccounts(getSavedAccounts());
    
    // Si era la cuenta seleccionada, limpiar
    if (selectedAccount?.email === email) {
      handleUseAnotherAccount();
    }
    
    // Si no quedan cuentas, cambiar vista
    const remaining = getSavedAccounts();
    if (remaining.length === 0) {
      setViewMode('email-password');
    }
    
    toast.success('Cuenta eliminada');
  };

  // Volver a la lista de cuentas
  const handleBackToAccountsList = () => {
    console.log('🔙 Volver a lista de cuentas');
    setSelectedAccount(null);
    setFormData({ ...formData, password: '' });
    setViewMode('accounts-list');
  };

  // Login con email y contraseña
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Iniciando sesión con:', formData.email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        console.error('❌ Error de autenticación:', error);
        
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Credenciales incorrectas', {
            description: 'Verifica tu correo y contraseña',
          });
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Correo no verificado', {
            description: 'Por favor verifica tu correo electrónico',
          });
        } else {
          toast.error('Error al iniciar sesión', {
            description: error.message,
          });
        }
        return;
      }

      console.log('✅ Sesión iniciada:', data.user.email);
      
      // Guardar cuenta en localStorage
      console.log('💾 Guardando cuenta en localStorage');
      saveAccount(formData.email);
      
      // Procesar invitación pendiente si existe
      const pendingInvite = localStorage.getItem('pending_invitation');
      if (pendingInvite) {
        console.log('📧 Procesando invitación pendiente...');
        try {
          const inviteData = JSON.parse(atob(pendingInvite));
          
          console.log('📋 Datos de invitación:', {
            businessId: inviteData.businessId,
            email: inviteData.email,
            userId: data.user.id,
          });
          
          // Llamar al endpoint del servidor para vincular empleado
          const response = await fetch(
            `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/accept-invite`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                businessId: inviteData.businessId,
                email: inviteData.email,
                userId: data.user.id,
              }),
            }
          );

          const result = await response.json();

          if (!response.ok || result.error) {
            console.error('❌ Error vinculando empleado:', result.error);
            toast.error('Error al vincular con el negocio');
          } else {
            console.log('✅ Empleado vinculado exitosamente:', result.employee);
            localStorage.removeItem('pending_invitation');
            
            // Recargar la lista de negocios para que aparezca el nuevo negocio
            console.log('🔄 Recargando lista de negocios...');
            await loadBusinesses();
            console.log('✅ Lista de negocios actualizada');
            
            toast.success(`¡Bienvenido a ${inviteData.businessName}!`, {
              description: 'Has sido agregado al equipo',
              duration: 2000,
            });
          }
        } catch (err) {
          console.error('❌ Error procesando invitación:', err);
        }
      } else {
        toast.success('¡Bienvenido de nuevo!', {
          description: 'Redirigiendo...',
          duration: 1500,
        });
      }

      // Forzar recarga de negocios
      console.log('🔄 Forzando recarga de negocios después del login...');
      await loadBusinesses();
      console.log('✅ Negocios recargados');

      // El AuthContext manejará la redirección
    } catch (error: any) {
      console.error('❌ Error:', error);
      toast.error('Error al iniciar sesión', {
        description: error.message || 'Por favor intenta de nuevo',
      });
    } finally {
      setLoading(false);
    }
  };

  // Solicitar código de recuperación
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      toast.error('Por favor ingresa tu correo electrónico');
      return;
    }

    setLoading(true);

    try {
      console.log('📧 Solicitando código de recuperación para:', formData.email);

      const response = await fetch(makeServerEdgeUrl('forgot-password-send-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: formData.email.trim(),
        }),
      });

      const data = await readMakeServerJson(response);

      if (!response.ok) {
        throw new Error(String(data.error || 'Error al enviar código'));
      }

      console.log('✅ Código enviado exitosamente');

      toast.success('¡Código enviado!', {
        description: 'Revisa tu correo electrónico',
      });

      setStep('forgot-code');
    } catch (error: any) {
      console.error('❌ Error:', error);
      toast.error('Error al enviar el código', {
        description: error.message || 'Por favor intenta de nuevo',
      });
    } finally {
      setLoading(false);
    }
  };

  // Verificar código de recuperación
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error('Por favor ingresa el código de verificación');
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Verificando código...');

      const response = await fetch(makeServerEdgeUrl('forgot-password-verify-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          code: formData.code.trim(),
        }),
      });

      const data = await readMakeServerJson(response);

      if (!response.ok) {
        throw new Error(String(data.error || 'Código incorrecto'));
      }

      console.log('✅ Código verificado');

      toast.success('¡Código verificado!', {
        description: 'Ahora crea tu nueva contraseña',
      });

      setStep('forgot-password');
    } catch (error: any) {
      console.error('❌ Error:', error);
      
      let errorMessage = 'Código incorrecto';
      if (error.message?.includes('expired')) {
        errorMessage = 'El código ha expirado. Solicita uno nuevo.';
      }
      
      toast.error(errorMessage, {
        description: error.message || 'Por favor intenta de nuevo',
      });
    } finally {
      setLoading(false);
    }
  };

  // Restablecer contraseña
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Restableciendo contraseña...');

      const response = await fetch(makeServerEdgeUrl('forgot-password-reset'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          code: formData.code.trim(),
          newPassword: formData.newPassword,
        }),
      });

      const data = await readMakeServerJson(response);

      if (!response.ok) {
        throw new Error(String(data.error || 'Error al restablecer contraseña'));
      }

      console.log('✅ Contraseña restablecida');

      toast.success('¡Contraseña actualizada!', {
        description: 'Ya puedes iniciar sesión',
        duration: 2000,
      });

      // Volver al login con el email pre-llenado
      setFormData({ ...formData, password: '', code: '', newPassword: '', confirmPassword: '' });
      setStep('login');
      setViewMode('password-only');
      setSelectedAccount({ 
        email: formData.email, 
        lastLogin: new Date().toISOString(), 
        initials: formData.email.split('@')[0].slice(0, 2).toUpperCase() 
      });
    } catch (error: any) {
      console.error('❌ Error:', error);
      toast.error('Error al restablecer contraseña', {
        description: error.message || 'Por favor intenta de nuevo',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setStep('login');
    setFormData({ email: '', password: '', code: '', newPassword: '', confirmPassword: '' });
    setSelectedAccount(null);
    
    const accounts = getSavedAccounts();
    if (accounts.length > 0) {
      setViewMode('accounts-list');
    } else {
      setViewMode('email-password');
    }
  };

  // Renderizar según el paso
  if (step !== 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="relative text-center space-y-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="absolute left-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white/70 text-gray-700 shadow-sm backdrop-blur hover:bg-white sm:hidden"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              Recuperar Contraseña
            </CardTitle>
            <CardDescription className="text-base">
              {step === 'forgot-email' && 'Ingresa tu correo electrónico'}
              {step === 'forgot-code' && 'Ingresa el código de verificación'}
              {step === 'forgot-password' && 'Crea tu nueva contraseña'}
            </CardDescription>
          </CardHeader>

          <CardContent key={step}>
            {/* Paso 1: Solicitar código */}
            {step === 'forgot-email' && (
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 font-medium">
                    Correo Electrónico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="h-11"
                    autoComplete="email"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-2" />
                      Enviar Código
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToLogin}
                  disabled={loading}
                  className="w-full h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al inicio de sesión
                </Button>
              </form>
            )}

            {/* Paso 2: Verificar código */}
            {step === 'forgot-code' && (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    📧 Hemos enviado un código de 6 dígitos a <strong>{formData.email}</strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code" className="text-gray-700 font-medium">
                    Código de Verificación
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="123456"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    required
                    className="h-11 text-center text-2xl tracking-widest font-bold"
                    maxLength={6}
                    autoComplete="off"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Verificar Código
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('forgot-email')}
                  disabled={loading}
                  className="w-full h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
              </form>
            )}

            {/* Paso 3: Nueva contraseña */}
            {step === 'forgot-password' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-gray-700 font-medium">
                    Nueva Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      required
                      className="h-11 pr-10"
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                    Confirmar Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repite tu contraseña"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      className="h-11 pr-10"
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Restablecer Contraseña
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('forgot-code')}
                  disabled={loading}
                  className="w-full h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vista principal de login
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="relative text-center space-y-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="absolute left-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white/70 text-gray-700 shadow-sm backdrop-blur hover:bg-white sm:hidden"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-2">
            <BrandLogo iconClassName="h-16" showText />
          </div>
          <CardDescription className="text-base">
            {viewMode === 'accounts-list' && 'Selecciona tu cuenta'}
            {viewMode === 'email-password' && 'Inicia sesión con tu cuenta'}
            {viewMode === 'password-only' && 'Ingresa tu contraseña'}
          </CardDescription>
        </CardHeader>

        <CardContent key={viewMode}>
          {/* VISTA 1: Lista de cuentas guardadas */}
          {viewMode === 'accounts-list' && (
            <div className="space-y-3">
              {savedAccounts.map((account) => (
                <div key={account.email} className="group relative">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectAccount(account)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectAccount(account);
                      }
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer select-none"
                  >
                    {/* Avatar con iniciales */}
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {account.initials}
                    </div>

                    {/* Email */}
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900">{account.email}</p>
                      <p className="text-sm text-gray-500">Última sesión</p>
                    </div>
                  </div>

                  {/* Botón eliminar (separado, no anidado) */}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveAccount(account.email, e)}
                    className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1.5 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-opacity"
                    title="Eliminar cuenta guardada"
                    aria-label="Eliminar cuenta guardada"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Usar otra cuenta */}
              <button
                type="button"
                onClick={handleUseAnotherAccount}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-all"
              >
                <UserPlus className="w-5 h-5" />
                <span className="font-medium">Usar otra cuenta</span>
              </button>

              {/* Botón registrarse */}
              <div className="text-center pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/auth')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ¿No tienes cuenta? <span className="font-semibold ml-1">Regístrate</span>
                </Button>
              </div>
            </div>
          )}

          {/* VISTA 2: Solo contraseña (cuenta seleccionada) */}
          {viewMode === 'password-only' && selectedAccount && (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Cuenta seleccionada */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold">
                  {selectedAccount.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{selectedAccount.email}</p>
                </div>
                {savedAccounts.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToAccountsList}
                    className="text-blue-600 hover:text-blue-700 flex-shrink-0"
                  >
                    Cambiar
                  </Button>
                )}
              </div>

              {/* Contraseña */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ingresa tu contraseña"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="h-11 pr-10"
                    autoComplete="current-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Iniciar Sesión
                  </>
                )}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setStep('forgot-email')}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  ¿Olvidaste tu contraseña?
                </Button>
              </div>
            </form>
          )}

          {/* VISTA 3: Email y contraseña (nueva cuenta o "usar otra cuenta") */}
          {viewMode === 'email-password' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  Correo Electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="h-11"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ingresa tu contraseña"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="h-11 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Iniciar Sesión
                  </>
                )}
              </Button>

              {savedAccounts.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToAccountsList}
                  className="w-full h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Ver cuentas guardadas
                </Button>
              )}

              <div className="flex flex-col gap-2 items-center pt-2">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setStep('forgot-email')}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  ¿Olvidaste tu contraseña?
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/auth')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ¿No tienes cuenta? <span className="font-semibold ml-1">Regístrate</span>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}