import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface InvitationData {
  businessId: string;
  email: string;
  name: string;
  role: string;
  permissions: any;
  phone?: string | null;
  timestamp: number;
}

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    console.log('🔍 [INVITE PAGE] Token received:', token);
    
    if (!token) {
      console.error('❌ [INVITE PAGE] No token provided');
      setError('Token de invitación no válido');
      setLoading(false);
      return;
    }

    try {
      // Decode invitation token
      console.log('🔓 [INVITE PAGE] Decoding token...');
      const decoded = JSON.parse(atob(token));
      console.log('✅ [INVITE PAGE] Token decoded:', decoded);
      
      // Validate token (check if expired - 7 days)
      const now = Date.now();
      const tokenAge = now - decoded.timestamp;
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      
      console.log('⏰ [INVITE PAGE] Token age (ms):', tokenAge);
      console.log('⏰ [INVITE PAGE] Max age (ms):', sevenDaysInMs);
      
      if (tokenAge > sevenDaysInMs) {
        console.error('❌ [INVITE PAGE] Token expired');
        setError('Este link de invitación ha expirado. Por favor solicita una nueva invitación.');
        setLoading(false);
        return;
      }
      
      console.log('✅ [INVITE PAGE] Token is valid');
      setInvitationData(decoded);
      setLoading(false);
    } catch (err) {
      console.error('❌ [INVITE PAGE] Error decoding token:', err);
      setError('Token de invitación no válido');
      setLoading(false);
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invitationData) return;
    
    // Validate password
    if (!password || password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    
    setSubmitting(true);
    
    try {
      console.log('📝 [INVITE] Creating user account...');
      
      // 1. Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitationData.email,
        password: password,
        options: {
          data: {
            name: invitationData.name,
            phone: invitationData.phone,
          },
          emailRedirectTo: `${window.location.origin}/#/login`
        }
      });
      
      if (authError) {
        if (authError.message.includes('already registered')) {
          // User already exists, try to sign in and link
          console.log('⚠️ [INVITE] User already exists, attempting to link...');
          
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: invitationData.email,
            password: password,
          });
          
          if (signInError) {
            throw new Error('Este correo ya está registrado con otra contraseña. Por favor inicia sesión con tu contraseña actual.');
          }
          
          // Update employee record with user_id
          if (signInData.user) {
            console.log('🔗 [INVITE] Linking employee to existing user...');
            
            const { error: updateError } = await supabase
              .from('employees')
              .update({ user_id: signInData.user.id })
              .eq('business_id', invitationData.businessId)
              .eq('email', invitationData.email);
            
            if (updateError) {
              console.error('❌ [INVITE] Error updating employee:', updateError);
              throw new Error('Error al vincular tu cuenta');
            }
          }
        } else {
          throw authError;
        }
      } else if (authData.user) {
        // New user created successfully
        console.log('✅ [INVITE] User created:', authData.user.id);
        
        // 2. Update employee record with user_id
        console.log('🔗 [INVITE] Linking employee to user account...');
        
        const { error: updateError } = await supabase
          .from('employees')
          .update({ user_id: authData.user.id })
          .eq('business_id', invitationData.businessId)
          .eq('email', invitationData.email);
        
        if (updateError) {
          console.error('❌ [INVITE] Error updating employee:', updateError);
          throw new Error('Error al vincular tu cuenta');
        }
        
        console.log('✅ [INVITE] Employee linked to user account');
      }
      
      setSuccess(true);
      
      toast.success('¡Cuenta creada exitosamente!', {
        description: 'Ahora puedes iniciar sesión con tu correo y contraseña',
      });
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      
    } catch (err: any) {
      console.error('❌ [INVITE] Error:', err);
      toast.error(err.message || 'Error al crear tu cuenta');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Verificando invitación...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitación no válida</h1>
            <p className="text-gray-600">{error}</p>
          </div>
          <Button
            onClick={() => navigate('/login')}
            className="w-full bg-gray-900 hover:bg-gray-800"
          >
            Ir a Inicio de Sesión
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Cuenta creada!</h1>
            <p className="text-gray-600 mb-6">Tu cuenta ha sido creada exitosamente. Redirigiendo al inicio de sesión...</p>
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Bienvenido al equipo!</h1>
          <p className="text-gray-600">
            Hola <strong>{invitationData?.name}</strong>, completa tu registro para acceder al sistema
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={invitationData?.email || ''}
              disabled
              className="bg-gray-50"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña*</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-12"
            />
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña*</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="h-12"
            />
          </div>

          {/* Role Info */}
          <div className="bg-indigo-50 rounded-lg p-4">
            <p className="text-sm text-indigo-900">
              <strong>Rol asignado:</strong> {invitationData?.role}
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Creando cuenta...
              </>
            ) : (
              'Crear mi cuenta'
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Inicia sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}