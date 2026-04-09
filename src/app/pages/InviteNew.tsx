import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';

interface InviteData {
  businessId: string;
  businessName: string;
  email: string;
  name: string;
  role: string;
  permissions: any;
  phone: string | null;
}

export default function InviteNew() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function processInvite() {
      if (!token) {
        setError('Token inválido');
        setChecking(false);
        return;
      }

      try {
        // Decodificar token
        const inviteData: InviteData = JSON.parse(atob(token));
        console.log('📧 Invitación decodificada:', inviteData);

        // Guardar el token en localStorage para procesarlo después del login/registro
        localStorage.setItem('pending_invitation', token);

        // Verificar si el usuario ya existe consultando al servidor
        console.log('🔍 Verificando si el usuario existe...');
        
        // Agregar timeout para evitar esperas infinitas
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
        
        try {
          const response = await fetch(
            `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/check-user-exists`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({ email: inviteData.email }),
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            console.error('❌ Error del servidor:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('📄 Respuesta de error:', errorText);
            throw new Error(`Error del servidor: ${response.status}`);
          }

          const data = await response.json();
          console.log('📥 Respuesta del servidor:', data);
          
          const { exists: userExists } = data;
          console.log('👤 Usuario existe:', userExists);

          if (userExists) {
            // Redirigir a login con el email pre-cargado
            console.log('➡️ Redirigiendo a login...');
            window.location.href = `#/login?email=${encodeURIComponent(inviteData.email)}&invite=true`;
          } else {
            // Redirigir a registro con datos pre-cargados
            console.log('➡️ Redirigiendo a registro...');
            window.location.href = `#/register?email=${encodeURIComponent(inviteData.email)}&name=${encodeURIComponent(inviteData.name)}&invite=true`;
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          
          if (fetchError.name === 'AbortError') {
            console.error('⏱️ Timeout al verificar usuario');
            throw new Error('Timeout al conectar con el servidor. Por favor intenta de nuevo.');
          }
          throw fetchError;
        }

      } catch (err: any) {
        console.error('❌ Error procesando invitación:', err);
        setError(err.message || 'Token corrupto o inválido');
        setChecking(false);
      }
    }

    processInvite();
  }, [token, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '#/login'}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
          >
            Ir a inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Procesando invitación...</p>
      </div>
    </div>
  );
}