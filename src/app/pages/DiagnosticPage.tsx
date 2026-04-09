import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, AlertCircle, Database, Server, Key, Mail } from 'lucide-react';

type StepStatus = 'pending' | 'loading' | 'success' | 'error';

interface StepResult {
  status: StepStatus;
  message: string;
  details?: any;
}

export default function DiagnosticPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<StepResult[]>([
    { status: 'pending', message: '¿Tienes sesión activa?' },
    { status: 'pending', message: '¿El token es válido?' },
    { status: 'pending', message: '¿El servidor responde?' },
    { status: 'pending', message: '¿El servidor acepta tu token?' },
    { status: 'pending', message: '¿Puedes cargar negocios?' },
  ]);

  const updateStep = (index: number, status: StepStatus, message: string, details?: any) => {
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[index] = { status, message, details };
      return newSteps;
    });
  };

  const runDiagnostic = async () => {
    setCurrentStep(0);
    
    // Reset all steps
    setSteps([
      { status: 'pending', message: '¿Tienes sesión activa?' },
      { status: 'pending', message: '¿El token es válido?' },
      { status: 'pending', message: '¿El servidor responde?' },
      { status: 'pending', message: '¿El servidor acepta tu token?' },
      { status: 'pending', message: '¿Puedes cargar negocios?' },
    ]);

    // STEP 1: Check session
    updateStep(0, 'loading', 'Verificando sesión...');
    await sleep(500);
    
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      updateStep(0, 'error', 'NO tienes sesión activa', { 
        error: sessionError?.message || 'No hay sesión',
        action: 'Inicia sesión primero' 
      });
      return;
    }

    const token = sessionData.session.access_token;
    const user = sessionData.session.user;
    
    updateStep(0, 'success', `SÍ - Usuario: ${user.email}`, {
      userId: user.id,
      expiresAt: new Date(sessionData.session.expires_at! * 1000).toLocaleString(),
    });
    setCurrentStep(1);
    await sleep(800);

    // STEP 2: Check token validity
    updateStep(1, 'loading', 'Verificando token...');
    await sleep(500);
    
    try {
      const expiresAt = sessionData.session.expires_at! * 1000;
      const now = Date.now();
      
      if (now > expiresAt) {
        updateStep(1, 'error', 'Token EXPIRADO', {
          expiredAt: new Date(expiresAt).toLocaleString(),
          now: new Date(now).toLocaleString(),
          action: 'Cierra sesión e inicia sesión de nuevo',
        });
        return;
      }
      
      updateStep(1, 'success', 'SÍ - Token válido y no expirado', {
        expiresAt: new Date(expiresAt).toLocaleString(),
        timeLeft: `${Math.floor((expiresAt - now) / 1000 / 60)} minutos`,
      });
      setCurrentStep(2);
      await sleep(800);
    } catch (error: any) {
      updateStep(1, 'error', 'Error verificando token', { error: error.message });
      return;
    }

    // STEP 3: Check server connectivity
    updateStep(2, 'loading', 'Conectando con servidor...');
    await sleep(500);
    
    try {
      const envResponse = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/env-check`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
        }
      );

      if (!envResponse.ok) {
        throw new Error(`HTTP ${envResponse.status}`);
      }

      const envData = await envResponse.json();
      
      // Log server details for debugging
      console.log('📊 Server details:', envData);
      console.log('🔍 Server started at:', envData.server_started_at);
      console.log('🔍 Has ANON_KEY:', envData.has_anon_key);
      
      updateStep(2, 'success', 'SÍ - Servidor responde correctamente', envData);
      
      // Check if server is using the new version
      const expectedVersion = '2.0.2-force-deploy';
      if (envData.server_version !== expectedVersion && !envData.server_version?.startsWith('2.0.2')) {
        updateStep(2, 'error', '⚠️ SERVIDOR NO ACTUALIZADO', {
          ...envData,
          current_version: envData.server_version || 'unknown',
          expected_version: expectedVersion,
          solution: '🔄 El servidor Edge Function necesita actualizarse',
          instructions: [
            '1. Espera 30-60 segundos (el servidor se actualiza automáticamente)',
            '2. Recarga esta página completamente (Ctrl + Shift + R)',
            '3. Ejecuta el diagnóstico de nuevo',
            '4. Si después de 2 minutos sigue sin actualizarse, puede ser un problema de Supabase'
          ],
          WORKAROUND: 'Verifica si v2.0.0 ya tiene el fix probando manualmente el endpoint /test-auth'
        });
        return;
      }
      
      setCurrentStep(3);
      await sleep(800);
    } catch (error: any) {
      updateStep(2, 'error', 'NO - Servidor no responde', { error: error.message });
      return;
    }

    // STEP 4: Test authentication with server
    updateStep(3, 'loading', 'Probando autenticación...');
    await sleep(500);
    
    try {
      const testAuthResponse = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/test-auth`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const testAuthData = await testAuthResponse.json();

      if (!testAuthResponse.ok) {
        updateStep(3, 'error', `NO - Servidor rechazó el token (${testAuthResponse.status})`, {
          ...testAuthData,
          http_status: testAuthResponse.status,
          token_length: token.length,
          token_preview: `${token.substring(0, 30)}...${token.substring(token.length - 10)}`,
          action: 'Este es el error principal. El servidor no puede validar tu token JWT.',
          solution: 'El servidor debe estar usando ANON_KEY para validar tokens de usuario.',
        });
        return;
      }

      updateStep(3, 'success', 'SÍ - Servidor aceptó tu token', testAuthData);
      setCurrentStep(4);
      await sleep(800);
    } catch (error: any) {
      updateStep(3, 'error', 'Error conectando con servidor', { error: error.message });
      return;
    }

    // STEP 5: Test businesses endpoint
    updateStep(4, 'loading', 'Cargando negocios...');
    await sleep(500);
    
    try {
      const businessesResponse = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/businesses`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const businessesData = await businessesResponse.json();

      if (!businessesResponse.ok) {
        updateStep(4, 'error', `NO - Error ${businessesResponse.status}`, {
          ...businessesData,
          action: 'Hay un problema cargando los negocios.',
        });
        return;
      }

      const count = businessesData.businesses?.length || 0;
      updateStep(4, 'success', `SÍ - Cargados ${count} negocio(s)`, {
        count,
        businesses: businessesData.businesses?.map((b: any) => b.name),
      });
    } catch (error: any) {
      updateStep(4, 'error', 'Error cargando negocios', { error: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">🔧 Diagnóstico</h1>
            <p className="text-gray-600">
              Validación paso a paso del sistema
            </p>
          </div>

          {/* Warning banner if server is not updated */}
          <div className="mb-6 p-4 bg-yellow-50 rounded-xl border-2 border-yellow-300">
            <div className="text-sm space-y-2">
              <p className="font-bold text-yellow-900 text-base">⚠️ IMPORTANTE:</p>
              <p className="text-yellow-800">
                Se acaba de actualizar el servidor para corregir el error "Invalid JWT".
              </p>
              <p className="text-yellow-800">
                El servidor tarda <span className="font-bold">20-30 segundos</span> en actualizarse automáticamente.
              </p>
              <p className="text-yellow-800">
                Si ves "servidor versión antigua" en el Paso 3, <span className="font-bold">espera 30 segundos y recarga la página</span>.
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border-2 transition-all ${
                  step.status === 'success'
                    ? 'bg-green-50 border-green-300'
                    : step.status === 'error'
                    ? 'bg-red-50 border-red-300'
                    : step.status === 'loading'
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {step.status === 'success' && (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    )}
                    {step.status === 'error' && (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                    {step.status === 'loading' && (
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    )}
                    {step.status === 'pending' && (
                      <AlertCircle className="w-6 h-6 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-1">
                      Paso {index + 1}
                    </div>
                    <div className="text-base">{step.message}</div>

                    {step.details && (
                      <details className="mt-3">
                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900 font-medium">
                          📋 Ver detalles técnicos
                        </summary>
                        <pre className="mt-2 p-3 bg-white rounded-lg text-xs overflow-auto max-h-48 border">
                          {JSON.stringify(step.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={runDiagnostic}
            disabled={steps.some((s) => s.status === 'loading')}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {steps.some((s) => s.status === 'loading') ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Ejecutando...
              </span>
            ) : (
              '▶️ Ejecutar Diagnóstico'
            )}
          </button>

          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="text-sm space-y-2">
              <p className="font-semibold text-blue-900">💡 Cómo usar:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Asegúrate de haber iniciado sesión</li>
                <li>Haz clic en "Ejecutar Diagnóstico"</li>
                <li>Espera a que se completen todos los pasos</li>
                <li>Si algo falla, revisa los detalles técnicos</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}