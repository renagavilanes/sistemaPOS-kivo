import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/card';
import { toast } from 'sonner';
import { Store, Mail, Phone, Loader2, Lock, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';
import { useBusiness } from '../contexts/BusinessContext';
import { BrandLogo } from '../components/BrandLogo';

type Step = 'business-info' | 'verify-code';

/** Misma barra superior que LoginPage: vuelve a la landing (/) */
function RegisterScreenTopBar() {
  return (
    <header
      className="pointer-events-none fixed left-0 right-0 top-0 z-30 pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
      role="navigation"
      aria-label="Navegación"
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-center px-4">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/70 px-3.5 py-2.5 text-sm font-medium text-slate-600 shadow-[var(--shadow-card)] backdrop-blur-md transition-all hover:border-blue-200/90 hover:bg-white/95 hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/35"
        >
          <ArrowLeft
            className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-[var(--brand)]"
            aria-hidden
          />
          Volver al inicio
        </Link>
      </div>
    </header>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refreshBusinesses } = useBusiness();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('business-info');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    businessName: '',
    email: '',
    phone: '',
  });

  const [verifyData, setVerifyData] = useState({
    code: '',
    password: '',
    confirmPassword: '',
  });

  // Cargar datos de invitación si vienen en la URL
  useEffect(() => {
    const emailParam = searchParams.get('email');
    const nameParam = searchParams.get('name');
    const isInvite = searchParams.get('invite') === 'true';
    
    if (isInvite && emailParam) {
      console.log('📧 [REGISTER] Invitación detectada:', emailParam);
      setFormData(prev => ({
        ...prev,
        email: emailParam,
        businessName: nameParam || prev.businessName,
      }));
    }
  }, [searchParams]);

  // PASO 1: Enviar código de verificación
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.businessName.trim()) {
      toast.error('El nombre del negocio es requerido');
      return;
    }

    if (!formData.email.trim()) {
      toast.error('El correo electrónico es requerido');
      return;
    }

    setLoading(true);

    try {
      console.log('📧 Enviando código de verificación a:', formData.email);

      const response = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/register-business`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            businessName: formData.businessName,
            email: formData.email,
            phone: formData.phone || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'ALREADY_VERIFIED') {
          toast.error('Este correo ya está registrado', {
            description: 'Por favor inicia sesión',
          });
          setTimeout(() => navigate('/login'), 2000);
          return;
        }
        throw new Error(data.error || 'Error al enviar código');
      }

      console.log('✅ Código enviado exitosamente');

      toast.success('¡Código enviado!', {
        description: 'Revisa tu correo electrónico',
      });

      // Avanzar al paso de verificación
      setStep('verify-code');

    } catch (error: any) {
      console.error('❌ Error al enviar código:', error);
      toast.error('Error al enviar el código', {
        description: error.message || 'Por favor intenta de nuevo',
      });
    } finally {
      setLoading(false);
    }
  };

  // PASO 2: Verificar código y crear cuenta
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verifyData.code.trim()) {
      toast.error('El código de verificación es requerido');
      return;
    }

    if (verifyData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (verifyData.password !== verifyData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Verificando código y creando cuenta...');

      // 1. Verificar código y crear usuario
      const response = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/verify-code-with-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            email: formData.email,
            code: verifyData.code,
            password: verifyData.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al verificar código');
      }

      console.log('✅ Cuenta creada exitosamente:', data);

      // 2. Iniciar sesión automáticamente
      console.log('🔐 Iniciando sesión...');
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: verifyData.password,
      });

      if (loginError) {
        console.error('❌ Error al iniciar sesión:', loginError);
        toast.success('Cuenta creada exitosamente', {
          description: 'Por favor inicia sesión',
        });
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      console.log('✅ Sesión iniciada:', loginData.user.email);

      // 3. Recargar negocios
      console.log('🔄 Recargando negocios...');
      await refreshBusinesses();
      console.log('✅ Negocios recargados');

      // 4. Procesar invitación pendiente si existe
      const pendingInvite = localStorage.getItem('pending_invitation');
      if (pendingInvite) {
        console.log('📧 Procesando invitación pendiente...');
        try {
          const inviteData = JSON.parse(atob(pendingInvite));
          
          console.log('📋 Datos de invitación:', {
            businessId: inviteData.businessId,
            email: inviteData.email,
            userId: loginData.user.id,
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
                userId: loginData.user.id,
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
            
            // Recargar negocios nuevamente después de vincular
            console.log('🔄 Recargando negocios después de vincular empleado...');
            await refreshBusinesses();
            console.log('✅ Lista de negocios actualizada con el nuevo negocio');
            
            toast.success(`¡Bienvenido a ${inviteData.businessName}!`, {
              description: 'Has sido agregado al equipo',
              duration: 2000,
            });
          }
        } catch (err) {
          console.error('❌ Error procesando invitación:', err);
        }
      } else {
        toast.success('¡Bienvenido!', {
          description: 'Tu cuenta ha sido creada exitosamente',
          duration: 2000,
        });
      }

      // 5. Redirigir al POS
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);

    } catch (error: any) {
      console.error('❌ Error:', error);
      
      let errorMessage = 'Error al verificar el código';
      
      if (error.message?.includes('Invalid') || error.message?.includes('incorrect') || error.message?.includes('inválido')) {
        errorMessage = 'Código incorrecto o expirado';
      } else if (error.message?.includes('expired')) {
        errorMessage = 'El código ha expirado. Solicita uno nuevo.';
      }
      
      toast.error(errorMessage, {
        description: error.message || 'Por favor intenta de nuevo',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToBusinessInfo = () => {
    setStep('business-info');
    setVerifyData({
      code: '',
      password: '',
      confirmPassword: '',
    });
  };

  return (
    <>
      <RegisterScreenTopBar />
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-slate-100 p-4 pt-[calc(4.25rem+env(safe-area-inset-top,0px))]">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="relative text-center space-y-3">
            <div className="mx-auto mb-2">
              <BrandLogo iconClassName="h-16" showText />
            </div>
            <CardDescription className="text-base">
              {step === 'business-info' 
                ? 'Crea tu cuenta y gestiona tu negocio'
                : 'Verifica tu correo y crea tu contraseña'
              }
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* PASO 1: Información del Negocio */}
            {step === 'business-info' && (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName" className="text-gray-700 font-medium flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    Nombre del Negocio *
                  </Label>
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="Mi Tienda"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Correo Electrónico *
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
                  <Label htmlFor="phone" className="text-gray-700 font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Teléfono (opcional)
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+593 99 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-11"
                    autoComplete="tel"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Enviando código...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-2" />
                      Enviar Código de Verificación
                    </>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate('/login')}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    ¿Ya tienes cuenta? <span className="font-semibold ml-1">Iniciar Sesión</span>
                  </Button>
                </div>
              </form>
            )}

            {/* PASO 2: Verificación y Contraseña */}
            {step === 'verify-code' && (
              <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    📧 Hemos enviado un código de 6 dígitos a <strong>{formData.email}</strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code" className="text-gray-700 font-medium flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Código de Verificación *
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="123456"
                    value={verifyData.code}
                    onChange={(e) => setVerifyData({ ...verifyData, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    required
                    className="h-11 text-center text-2xl tracking-widest font-bold"
                    maxLength={6}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Contraseña *
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={verifyData.password}
                      onChange={(e) => setVerifyData({ ...verifyData, password: e.target.value })}
                      required
                      className="h-11 pr-10"
                      minLength={6}
                      autoComplete="new-password"
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

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-700 font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Confirmar Contraseña *
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repite tu contraseña"
                      value={verifyData.confirmPassword}
                      onChange={(e) => setVerifyData({ ...verifyData, confirmPassword: e.target.value })}
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
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    <>
                      <Store className="w-5 h-5 mr-2" />
                      Crear Cuenta
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToBusinessInfo}
                  disabled={loading}
                  className="w-full h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>

                <div className="text-center pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSendCode}
                    disabled={loading}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    ¿No recibiste el código? <span className="font-semibold ml-1">Reenviar</span>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}