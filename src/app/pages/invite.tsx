import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';

interface InviteData {
  email: string;
  name: string;
  role: string;
  businessId: string;
  businessName: string;
}

export default function Invite() {
  const navigate = useNavigate();
  const params = useParams();
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 'login' | 'register' — modo activo del formulario
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [checkingUser, setCheckingUser] = useState(false);

  console.log('🎯 [INVITE PAGE] Component loaded');
  console.log('🎯 [INVITE PAGE] Params:', params);

  useEffect(() => {
    const token = params.token ||
                  window.location.hash.split('/invite/')[1] ||
                  new URLSearchParams(window.location.search).get('token');

    console.log('🔍 [INVITE PAGE] Token extracted:', token ? token.substring(0, 50) + '...' : 'null');

    if (!token) {
      setError('Token de invitación no válido');
      return;
    }

    try {
      const decoded = JSON.parse(atob(token));
      console.log('✅ [INVITE PAGE] Token decoded:', decoded);
      setInviteData(decoded);

      // Verificar si el usuario ya tiene cuenta usando el servidor (admin API)
      checkUserExists(decoded.email);
    } catch (e) {
      console.error('❌ [INVITE PAGE] Error decodificando token:', e);
      setError('Token de invitación inválido o expirado');
    }
  }, [params.token]);

  // Usa el servidor para verificar con la API de admin — confiable 100%
  const checkUserExists = async (email: string) => {
    setCheckingUser(true);
    try {
      console.log('🔍 [INVITE] Verificando si el usuario ya tiene cuenta...');
      const res = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/check-user-exists`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ email }),
        }
      );
      const data = await res.json();
      console.log('🔍 [INVITE] Respuesta check-user-exists:', data);

      if (data.exists) {
        console.log('✅ [INVITE] Usuario YA TIENE CUENTA → modo login');
        setMode('login');
      } else {
        console.log('✅ [INVITE] Usuario NO tiene cuenta → modo registro');
        setMode('register');
      }
    } catch (e) {
      console.error('⚠️ [INVITE] Error verificando usuario, mostrando ambas opciones:', e);
      // Si falla, dejamos en 'register' y el usuario puede cambiar manualmente
      setMode('register');
    } finally {
      setCheckingUser(false);
    }
  };

  const callAcceptInvite = async (businessId: string, email: string, userId: string, accessToken: string) => {
    console.log('📤 [INVITE] Llamando accept-invite con userId:', userId);
    const res = await fetch(
      `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/accept-invite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ businessId, email, userId }),
      }
    );
    const result = await res.json();
    if (!res.ok) {
      console.error('❌ [INVITE] Error en accept-invite:', result);
      throw new Error(result.error || 'Error al vincular la cuenta');
    }
    console.log('✅ [INVITE] accept-invite exitoso:', result);
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData) return;

    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        // ── MODO LOGIN: el usuario ya tiene cuenta ──
        console.log('🔐 [INVITE] Modo login para:', inviteData.email);

        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: inviteData.email,
          password,
        });

        if (signInError) throw signInError;
        if (!data.user || !data.session) throw new Error('No se pudo iniciar sesión');

        await callAcceptInvite(
          inviteData.businessId,
          inviteData.email,
          data.user.id,
          data.session.access_token,
        );

        navigate('/');

      } else {
        // ── MODO REGISTRO: crear cuenta nueva ──
        console.log('📝 [INVITE] Modo registro para:', inviteData.email);

        if (password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Las contraseñas no coinciden');
          setLoading(false);
          return;
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: inviteData.email,
          password,
          options: { data: { name: inviteData.name } },
        });

        if (signUpError) throw signUpError;

        // Si user es null, el email ya existe en Supabase pero no lo detectamos antes
        if (!signUpData.user?.id) {
          setError('Este correo ya tiene una cuenta. Cambia a "Ya tengo cuenta" e inicia sesión con tu contraseña.');
          setLoading(false);
          return;
        }

        // Hacer login inmediato para obtener access_token
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: inviteData.email,
          password,
        });

        if (loginError) throw loginError;
        if (!loginData.session) throw new Error('No se pudo iniciar sesión tras el registro');

        await callAcceptInvite(
          inviteData.businessId,
          inviteData.email,
          signUpData.user.id,
          loginData.session.access_token,
        );

        navigate('/');
      }
    } catch (err: any) {
      console.error('❌ [INVITE] Error:', err);
      setError(err.message || 'Error al procesar la invitación');
      setLoading(false);
    }
  };

  // ── Estados de carga ──
  if (error && !inviteData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-4xl mb-4">❌</h1>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  if (!inviteData || checkingUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">
          {checkingUser ? 'Verificando tu cuenta...' : 'Cargando...'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🎉 ¡Bienvenido!</h1>
          <p className="text-gray-500 text-sm">Has sido invitado a unirte a un negocio</p>
        </div>

        {/* Info del negocio */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          {inviteData.businessName && (
            <p className="text-sm text-gray-700 mb-1">
              <strong>Negocio:</strong> {inviteData.businessName}
            </p>
          )}
          <p className="text-sm text-gray-700 mb-1">
            <strong>Email:</strong> {inviteData.email}
          </p>
          <p className="text-sm text-gray-700 mb-1">
            <strong>Nombre:</strong> {inviteData.name}
          </p>
          <p className="text-sm text-gray-700">
            <strong>Rol:</strong> {inviteData.role}
          </p>
        </div>

        {/* Toggle de modo */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Ya tengo cuenta
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mode === 'register'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Crear cuenta nueva
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Correo electrónico
            </label>
            <input
              type="email"
              value={inviteData.email}
              disabled
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {mode === 'login' ? 'Tu contraseña' : 'Crea una contraseña'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'login' ? 'Tu contraseña actual' : 'Mínimo 6 caracteres'}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50"
          >
            {loading
              ? 'Procesando...'
              : mode === 'login'
                ? 'Iniciar sesión y unirme'
                : 'Crear mi cuenta y unirme'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            ¿Problemas?{' '}
            <a href="#/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Contacta al administrador
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
