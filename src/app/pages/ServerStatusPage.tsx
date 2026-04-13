import { useEffect, useState } from 'react';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';
import { supabase } from '../lib/supabase';
import { CheckCircle2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';

export default function ServerStatusPage() {
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const [authTestResult, setAuthTestResult] = useState<any>(null);
  const [testingAuth, setTestingAuth] = useState(false);

  const API_BASE_URL = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b`;

  const checkServer = async () => {
    setLoading(true);
    setError(null);
    setDetailedError(null);
    
    try {
      console.log('🔍 Checking server status...');
      console.log('🔍 Project ID:', supabaseProjectId);
      console.log('🔍 URL:', API_BASE_URL);
      
      // Add timestamp to prevent caching
      const timestamp = Date.now();
      const url = `${API_BASE_URL}/health?_t=${timestamp}`;
      
      console.log('🔍 Full URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response body:', errorText);
        setDetailedError(`Status: ${response.status}\nBody: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText || 'Unknown error'}`);
      }
      
      const data = await response.json();
      console.log('✅ Server response:', data);
      setServerInfo(data);
    } catch (err: any) {
      console.error('❌ Error checking server:', err);
      console.error('❌ Error stack:', err.stack);
      console.error('❌ Error type:', err.constructor.name);
      
      let errorMsg = err.message;
      
      // Diagnose common issues
      if (err.message === 'Failed to fetch') {
        errorMsg = '❌ Failed to fetch - Posibles causas:\n' +
                   '1. El servidor de Supabase no está ejecutándose\n' +
                   '2. El Edge Function "make-server-3508045b" no existe\n' +
                   '3. Problema de CORS\n' +
                   '4. El navegador bloqueó la conexión\n\n' +
                   `Project ID: ${supabaseProjectId}\n` +
                   `URL: ${API_BASE_URL}/health`;
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkServer();
  }, []);

  const isServerUpdated = serverInfo?.version?.includes('5.0.0') || serverInfo?.version?.includes('health-first');

  const testAuth = async () => {
    setTestingAuth(true);
    setAuthTestResult(null);
    
    try {
      console.log('🧪 Testing auth with testpos2024@gmail.com...');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'testpos2024@gmail.com',
        password: 'test123456',
      });
      
      if (error) {
        console.error('❌ Auth test error:', error);
        setAuthTestResult({ success: false, message: error.message });
      } else {
        console.log('✅ Auth test success:', data);
        setAuthTestResult({ 
          success: true, 
          message: `✅ Autenticación exitosa! Usuario: ${data.user?.email}`,
          sessionToken: data.session?.access_token?.substring(0, 50) + '...'
        });
      }
    } catch (err: any) {
      console.error('❌ Auth test exception:', err);
      setAuthTestResult({ success: false, message: err.message });
    } finally {
      setTestingAuth(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔍 Estado del Servidor
          </h1>
          <p className="text-gray-600">
            Verifica que el servidor esté actualizado con la última versión
          </p>
        </div>

        {/* Server Status Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="ml-3 text-lg text-gray-600">Verificando servidor...</span>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 border-2 border-red-300 rounded-xl">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-red-900 mb-2">❌ Error al conectar con el servidor</h3>
                  <p className="text-red-800 text-sm mb-4">{error}</p>
                  {detailedError && (
                    <div className="mt-2 bg-gray-50 p-4 rounded-lg overflow-auto border border-gray-200">
                      <pre className="text-xs text-gray-900">
                        {detailedError}
                      </pre>
                    </div>
                  )}
                  <button
                    onClick={checkServer}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className={`p-6 rounded-xl border-2 ${
                isServerUpdated 
                  ? 'bg-green-50 border-green-300' 
                  : 'bg-yellow-50 border-yellow-300'
              }`}>
                <div className="flex items-start gap-3">
                  {isServerUpdated ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h3 className={`font-bold text-lg mb-2 ${
                      isServerUpdated ? 'text-green-900' : 'text-yellow-900'
                    }`}>
                      {isServerUpdated 
                        ? '✅ Servidor actualizado correctamente' 
                        : '⚠️ Servidor en versión antigua'
                      }
                    </h3>
                    <p className={`text-sm ${
                      isServerUpdated ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {isServerUpdated 
                        ? 'El servidor está usando la versión más reciente con el fix de JWT.' 
                        : 'El servidor necesita actualizarse. Espera 30 segundos y haz click en "Refrescar Estado".'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Server Details */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 mb-3">📊 Detalles del Servidor:</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Versión</p>
                    <p className="font-mono text-sm font-bold text-gray-900">
                      {serverInfo?.version || 'N/A'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Deploy ID</p>
                    <p className="font-mono text-xs text-gray-900 break-all">
                      {serverInfo?.deploy_id || 'N/A'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Estado</p>
                    <p className="font-mono text-sm font-bold text-green-600">
                      {serverInfo?.status || 'N/A'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Timestamp</p>
                    <p className="font-mono text-xs text-gray-900">
                      {serverInfo?.timestamp ? new Date(serverInfo.timestamp).toLocaleString('es-ES') : 'N/A'}
                    </p>
                  </div>
                </div>

                {serverInfo?.deployment && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">Deployment</p>
                    <p className="font-mono text-sm font-bold text-blue-900">
                      {serverInfo.deployment}
                    </p>
                  </div>
                )}

                {serverInfo?.critical_fix && (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 mb-1">Critical Fix</p>
                    <p className="text-sm text-purple-900">
                      {serverInfo.critical_fix}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={checkServer}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Refrescar Estado
                </button>
                
                <button
                  onClick={() => window.location.href = '/login'}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
                >
                  Ir al Login
                </button>
              </div>

              {/* Instructions */}
              {!isServerUpdated && (
                <div className="mt-6 p-5 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                  <h4 className="font-bold text-yellow-900 mb-3">📝 Instrucciones:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-800">
                    <li>El servidor de Supabase tarda <strong>20-30 segundos</strong> en redesplegar automáticamente</li>
                    <li>Espera medio minuto</li>
                    <li>Haz click en <strong>"Refrescar Estado"</strong></li>
                    <li>Si ves "Servidor actualizado correctamente", ve al Login</li>
                    <li>Si sigue en versión antigua, espera otros 30 segundos y vuelve a refrescar</li>
                  </ol>
                </div>
              )}

              {/* NUEVA SECCIÓN: Instrucciones para empezar */}
              <div className="mt-6 p-5 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <h4 className="font-bold text-blue-900 mb-3">🚀 Cómo empezar (sin Edge Function):</h4>
                <div className="space-y-3 text-sm text-blue-900">
                  <p>
                    <strong>✅ Buenas noticias:</strong> El sistema POS funciona <strong>100% sin el servidor Edge Function</strong>.
                    Todas las operaciones se realizan directamente desde el frontend hacia Supabase.
                  </p>
                  
                  <div className="bg-white p-4 rounded-lg border border-blue-200">
                    <p className="font-bold mb-2">📋 Pasos para empezar:</p>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>
                        <strong>Ir a Registro:</strong>{' '}
                        <button
                          onClick={() => window.location.href = '/register'}
                          className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium ml-1"
                        >
                          Crear Cuenta
                        </button>
                      </li>
                      <li>Completa el formulario con el nombre de tu negocio, email y contraseña</li>
                      <li>El sistema creará automáticamente:
                        <ul className="ml-6 mt-1 space-y-1 list-disc">
                          <li>Tu usuario en Supabase Auth</li>
                          <li>Tu negocio en la base de datos</li>
                          <li>Las políticas de seguridad RLS</li>
                        </ul>
                      </li>
                      <li>¡Listo! Ya puedes usar el sistema POS completo</li>
                    </ol>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-blue-200">
                    <p className="font-bold mb-2">🔧 ¿Ya tienes cuenta?</p>
                    <p>
                      Si ya creaste una cuenta anteriormente, ve directamente a:{' '}
                      <button
                        onClick={() => window.location.href = '/login'}
                        className="inline-flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium ml-1"
                      >
                        Iniciar Sesión
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Diagnostic Info - Always show */}
        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Información de Diagnóstico
          </h3>
          
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Project ID</p>
              <p className="font-mono text-sm text-gray-900">{supabaseProjectId || '❌ NO DISPONIBLE'}</p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Server URL</p>
              <p className="font-mono text-xs text-gray-900 break-all">{API_BASE_URL}</p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Health Endpoint</p>
              <p className="font-mono text-xs text-gray-900 break-all">{API_BASE_URL}/health</p>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="font-bold text-orange-900 mb-2 text-sm">🔧 Si ves "Failed to fetch":</h4>
            <ol className="list-decimal list-inside space-y-1 text-xs text-orange-800">
              <li>El Edge Function podría no estar desplegado en Supabase</li>
              <li>Verifica que el archivo <code className="bg-orange-100 px-1 rounded">/supabase/functions/make-server-3508045b/index.tsx</code> existe</li>
              <li>El servidor de Supabase puede estar reiniciando</li>
              <li>Espera 60 segundos y haz click en "Reintentar"</li>
            </ol>
          </div>

          {/* Manual check button */}
          <div className="mt-4 p-3 bg-gray-100 rounded-lg">
            <p className="text-xs text-gray-600 mb-2">
              ⚠️ <strong>Nota:</strong> El endpoint requiere el header de Authorization. 
              El botón de "Abrir en nueva pestaña" no funciona porque el navegador no puede enviar headers personalizados.
              Usa "Refrescar Estado" arriba en su lugar.
            </p>
            <button
              onClick={() => {
                const url = API_BASE_URL + '/health';
                navigator.clipboard.writeText(url);
                alert(`URL copiada al portapapeles:\n\n${url}\n\nPara probarlo en Postman o cURL, agrega el header:\nAuthorization: Bearer ${supabaseAnonKey.substring(0, 20)}...`);
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              📋 Copiar URL al portapapeles
            </button>
          </div>

          {/* Auth Test */}
          <div className="mt-4 p-3 bg-gray-100 rounded-lg">
            <h4 className="font-bold text-gray-900 mb-2">🔒 Prueba de Autenticación:</h4>
            <p className="text-xs text-gray-600 mb-2">
              Verifica que la autenticación esté funcionando correctamente.
            </p>
            <button
              onClick={testAuth}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              {testingAuth ? (
                <div className="flex items-center">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="ml-2">Probando...</span>
                </div>
              ) : (
                'Probar Autenticación'
              )}
            </button>
            {authTestResult && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Resultado:</p>
                <p className={`font-mono text-sm ${
                  authTestResult.success ? 'text-green-600' : 'text-red-600'
                }`}>
                  {authTestResult.message}
                </p>
                {authTestResult.sessionToken && (
                  <p className="text-xs text-gray-500 mt-1">Token de sesión (parcial):</p>
                )}
                {authTestResult.sessionToken && (
                  <p className="font-mono text-sm text-gray-900 break-all">
                    {authTestResult.sessionToken}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}