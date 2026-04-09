import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../components/ui/input-otp';
import { Alert, AlertDescription } from '../components/ui/alert';
import { toast } from 'sonner';
import { Shield, Loader2, Mail, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

/** Flujo offline de prueba; en producción el registro real va por RegisterPage (email + API). */
const OFFLINE_DEV_MASTER_CODE = import.meta.env.DEV ? '999999' : '';

export default function VerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.PROD) {
      navigate('/register', { replace: true });
    }
  }, [navigate]);
  const emailFromState = location.state?.email || '';
  const businessName = location.state?.businessName || '';
  const emailFromStorage = typeof window !== 'undefined' ? localStorage.getItem('pending_verification_email') : '';
  const email = emailFromState || emailFromStorage || '';
  
  const [step, setStep] = useState<'code' | 'password'>('code');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect if no email provided
  useEffect(() => {
    if (!email) {
      navigate('/register');
    }
  }, [email, navigate]);

  // Step 1: Verify code
  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast.error('Ingresa el código completo');
      return;
    }

    setLoading(true);

    try {
      console.log('✅ Verificando código offline...', { email, code });

      if (!OFFLINE_DEV_MASTER_CODE || code !== OFFLINE_DEV_MASTER_CODE) {
        toast.error('Código inválido', {
          description: import.meta.env.DEV
            ? `En modo desarrollo offline usa el código de prueba de 6 dígitos.`
            : 'Solicita un nuevo código desde registro.',
        });
        setLoading(false);
        return;
      }

      // Code is valid, move to password step
      toast.success('¡Código verificado!');
      setStep('password');
      setLoading(false);
      
    } catch (error: any) {
      console.error('Error verifying code:', error);
      toast.error('Error al verificar', {
        description: error.message,
      });
      setLoading(false);
    }
  };

  // Step 2: Create password and finalize account
  const handleCreateAccount = async () => {
    // Validate password
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      console.log('🏗️ Creando cuenta offline...');

      // Crear cuenta con localStorage
      const result = await localStore.register(email, password, businessName);

      if (!result.success) {
        throw new Error(result.error || 'Error al crear la cuenta');
      }

      console.log('✅ Cuenta creada:', result.user?.email);

      // Clear pending email from storage
      localStorage.removeItem('pending_verification_email');

      // Save account to localStorage for quick login next time
      const savedAccountsData = localStorage.getItem('pos_saved_accounts');
      let accounts = [];
      
      if (savedAccountsData) {
        try {
          accounts = JSON.parse(savedAccountsData);
        } catch (e) {
          console.error('Error parsing saved accounts:', e);
        }
      }

      // Add new account
      accounts.unshift({
        email,
        businessName: result.user?.businessName,
        lastLogin: new Date().toISOString(),
      });

      // Keep only last 5 accounts
      accounts = accounts.slice(0, 5);
      localStorage.setItem('pos_saved_accounts', JSON.stringify(accounts));

      toast.success('¡Cuenta creada exitosamente!', {
        description: 'Iniciando sesión...',
      });

      // Navigate to home after a short delay
      setTimeout(() => {
        navigate('/');
      }, 1000);
      
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast.error('Error al crear la cuenta', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = () => {
    toast.info('Sistema offline (solo desarrollo)', {
      description: import.meta.env.DEV
        ? 'Este flujo es para pruebas locales sin email.'
        : 'Usa la pantalla de registro.',
      duration: 5000,
    });
  };

  // Password strength indicator
  const getPasswordStrength = () => {
    if (password.length === 0) return null;
    if (password.length < 6) return { label: 'Débil', color: 'bg-red-500', width: '33%' };
    if (password.length < 10) return { label: 'Media', color: 'bg-yellow-500', width: '66%' };
    return { label: 'Fuerte', color: 'bg-green-500', width: '100%' };
  };

  const passwordStrength = getPasswordStrength();

  if (import.meta.env.PROD) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <p className="text-gray-600 text-sm">Redirigiendo al registro…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
            {step === 'code' ? (
              <Shield className="w-8 h-8 text-white" />
            ) : (
              <Lock className="w-8 h-8 text-white" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === 'code' ? 'Verifica tu Correo' : 'Crea tu Contraseña'}
          </CardTitle>
          <CardDescription className="space-y-2">
            {step === 'code' ? (
              <>
                <span className="block">Ingresa el código de verificación para</span>
                <span className="flex items-center justify-center gap-2 font-medium text-gray-700">
                  <Mail className="w-4 h-4" />
                  {email}
                </span>
                {import.meta.env.DEV && OFFLINE_DEV_MASTER_CODE ? (
                  <Alert className="mt-3 bg-blue-50 border-blue-200">
                    <AlertDescription className="text-blue-800 text-sm">
                      💡 <strong>Solo desarrollo:</strong> código de prueba{' '}
                      <code className="bg-blue-100 px-2 py-1 rounded font-mono">{OFFLINE_DEV_MASTER_CODE}</code>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </>
            ) : (
              <span className="block">
                Elige una contraseña segura para proteger tu cuenta
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2">
            <div className={`flex items-center gap-2 ${step === 'code' ? 'text-blue-600 font-semibold' : 'text-green-600'}`}>
              {step === 'password' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs">
                  1
                </div>
              )}
              <span className="text-sm">Código</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300" />
            <div className={`flex items-center gap-2 ${step === 'password' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
              <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs">
                2
              </div>
              <span className="text-sm">Contraseña</span>
            </div>
          </div>

          {/* Step 1: Verify Code */}
          {step === 'code' && (
            <>
              <div className="space-y-4">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <p className="text-xs text-center text-gray-500">
                  Ingresa el código de 6 dígitos
                </p>
              </div>

              <Button 
                onClick={handleVerifyCode} 
                className="w-full" 
                disabled={loading || code.length !== 6}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Continuar'
                )}
              </Button>

              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">
                  ¿No recibiste el código?
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResendCode}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Reenviar código
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Create Password */}
          {step === 'password' && (
            <>
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  ✅ Código verificado correctamente
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      className="pl-10 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  
                  {/* Password strength indicator */}
                  {passwordStrength && (
                    <div className="space-y-1">
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${passwordStrength.color} transition-all duration-300`}
                          style={{ width: passwordStrength.width }}
                        />
                      </div>
                      <p className={`text-xs ${
                        passwordStrength.label === 'Fuerte' ? 'text-green-600' :
                        passwordStrength.label === 'Media' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        Seguridad: {passwordStrength.label}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repite tu contraseña"
                      className="pl-10 pr-10"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-red-600">
                      Las contraseñas no coinciden
                    </p>
                  )}
                </div>
              </div>

              <Button 
                onClick={handleCreateAccount} 
                className="w-full" 
                disabled={loading || password.length < 6 || password !== confirmPassword}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  'Crear Cuenta'
                )}
              </Button>

              <button
                type="button"
                onClick={() => setStep('code')}
                className="text-sm text-gray-600 hover:text-gray-800 w-full text-center"
              >
                ← Volver al código
              </button>
            </>
          )}

          {step === 'code' && (
            <div className="text-center text-sm text-gray-600">
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="text-blue-600 hover:underline"
              >
                Volver al registro
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
