import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function QuickTestPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runQuickTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      // 1. Check session
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        setResult({
          success: false,
          message: 'No hay sesión activa',
          action: 'Por favor inicia sesión primero',
        });
        setLoading(false);
        return;
      }

      const userId = sessionData.session.user.id;
      const userEmail = sessionData.session.user.email;

      // 2. Try to read from database
      const testKey = `quick-test:${userId}:${Date.now()}`;
      
      const { data: readData, error: readError } = await supabase
        .from('kv_store_3508045b')
        .select('*')
        .eq('key', testKey)
        .maybeSingle();

      if (readError && readError.code !== 'PGRST116') {
        setResult({
          success: false,
          message: 'Error al leer de la base de datos',
          error: readError,
          details: {
            code: readError.code,
            message: readError.message,
            hint: readError.hint,
          },
          solution: 'Probablemente RLS está bloqueando el acceso. Necesitas configurar las políticas de seguridad.',
        });
        setLoading(false);
        return;
      }

      // 3. Try to write to database
      const testValue = {
        timestamp: new Date().toISOString(),
        user_id: userId,
        test: 'Quick test',
      };

      const { error: writeError } = await supabase
        .from('kv_store_3508045b')
        .upsert({ key: testKey, value: testValue }, { onConflict: 'key' });

      if (writeError) {
        setResult({
          success: false,
          message: 'Error al escribir en la base de datos',
          error: writeError,
          details: {
            code: writeError.code,
            message: writeError.message,
            hint: writeError.hint,
          },
          solution: 'RLS está bloqueando la escritura. Necesitas configurar las políticas de seguridad.',
        });
        setLoading(false);
        return;
      }

      // 4. Success!
      setResult({
        success: true,
        message: '¡Todo funciona perfectamente!',
        user: userEmail,
        testKey,
        details: {
          read: 'OK',
          write: 'OK',
          timestamp: testValue.timestamp,
        },
      });

    } catch (error: any) {
      setResult({
        success: false,
        message: 'Error inesperado',
        error: error.message,
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">⚡</div>
            <h1 className="text-3xl font-bold mb-2">Test Rápido</h1>
            <p className="text-gray-600 text-sm">
              Prueba simple de lectura/escritura en Supabase
            </p>
          </div>

          {/* Button */}
          <button
            onClick={runQuickTest}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold rounded-2xl hover:from-indigo-700 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl mb-6"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Probando...
              </span>
            ) : (
              '▶️ Ejecutar Test Rápido'
            )}
          </button>

          {/* Result */}
          {result && (
            <div
              className={`p-6 rounded-2xl border-2 ${
                result.success
                  ? 'bg-green-50 border-green-300'
                  : 'bg-red-50 border-red-300'
              }`}
            >
              <div className="flex items-start gap-3 mb-4">
                {result.success ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h3
                    className={`font-bold text-lg mb-2 ${
                      result.success ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    {result.message}
                  </h3>
                  
                  {result.user && (
                    <p className="text-sm text-gray-700 mb-2">
                      Usuario: <span className="font-mono">{result.user}</span>
                    </p>
                  )}

                  {result.action && (
                    <p className="text-sm text-gray-700 mb-2">
                      {result.action}
                    </p>
                  )}

                  {result.solution && (
                    <div className="mt-3 p-3 bg-yellow-100 rounded-lg border border-yellow-300">
                      <p className="text-sm text-yellow-900 font-medium">
                        💡 Solución:
                      </p>
                      <p className="text-sm text-yellow-800 mt-1">
                        {result.solution}
                      </p>
                      <a
                        href="/rls-setup"
                        className="inline-block mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 text-sm"
                      >
                        🔧 Ver instrucciones para configurar RLS →
                      </a>
                    </div>
                  )}

                  {result.details && (
                    <details className="mt-4">
                      <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900 font-medium">
                        📋 Detalles técnicos
                      </summary>
                      <pre className="mt-2 p-3 bg-white rounded-lg text-xs overflow-auto max-h-48 border">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Links */}
          <div className="mt-6 text-center space-y-2">
            <a
              href="/create-tables"
              className="block text-sm text-blue-600 hover:text-blue-900 underline font-bold"
            >
              📊 Crear tablas necesarias
            </a>
            <a
              href="/login"
              className="block text-sm text-indigo-600 hover:text-indigo-900 underline"
            >
              ← Ir a Login
            </a>
            <a
              href="/"
              className="block text-sm text-gray-600 hover:text-gray-900 underline"
            >
              ← Volver al inicio
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}