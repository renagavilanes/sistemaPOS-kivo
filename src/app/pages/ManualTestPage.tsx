import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseProjectId } from '../../utils/supabase/publicEnv';

export default function ManualTestPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runManualTest = async () => {
    setLoading(true);
    setResults(null);

    try {
      // Get session
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setResults({ error: 'No token found' });
        setLoading(false);
        return;
      }

      // Call test-auth endpoint
      const response = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/test-auth`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      setResults({
        status: response.status,
        statusText: response.statusText,
        data,
        token_preview: `${token.substring(0, 40)}...${token.substring(token.length - 20)}`,
        token_length: token.length,
      });
    } catch (error: any) {
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-4">🧪 Prueba Manual de Autenticación</h1>
          
          {/* Banner con link al nuevo test */}
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border-2 border-blue-300">
            <p className="font-bold text-blue-900 mb-2">💡 Solución alternativa:</p>
            <p className="text-blue-800 text-sm mb-3">
              Si el servidor sigue fallando, prueba el <strong>acceso directo</strong> que no depende del servidor:
            </p>
            <div className="flex gap-2">
              <a
                href="/direct-test"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 text-sm"
              >
                🎯 Test de Acceso Directo
              </a>
              <a
                href="/quick-test"
                className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 text-sm"
              >
                ⚡ Test Rápido
              </a>
            </div>
          </div>
          
          <button
            onClick={runManualTest}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-400 mb-6"
          >
            {loading ? 'Probando...' : '▶️ Probar /test-auth'}
          </button>

          {results && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <h2 className="font-bold mb-2">📊 Resultado:</h2>
                <pre className="text-xs overflow-auto p-4 bg-white rounded border">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </div>

              {results.status === 401 && (
                <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl">
                  <h3 className="font-bold text-red-900 mb-2">❌ Error 401: Invalid JWT</h3>
                  <p className="text-red-800 text-sm mb-2">
                    El servidor rechazó tu token. Esto puede significar:
                  </p>
                  <ol className="list-decimal list-inside text-sm text-red-800 space-y-1">
                    <li>El servidor está usando el SERVICE_ROLE_KEY incorrecto para validar</li>
                    <li>El token está corrupto</li>
                    <li>El ANON_KEY no está configurado correctamente</li>
                  </ol>
                </div>
              )}

              {results.status === 200 && (
                <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl">
                  <h3 className="font-bold text-green-900 mb-2">✅ ¡Éxito!</h3>
                  <p className="text-green-800 text-sm">
                    El servidor validó tu token correctamente.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}