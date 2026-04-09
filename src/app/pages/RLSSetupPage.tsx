import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Terminal } from 'lucide-react';

export default function RLSSetupPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const sqlCommands = [
    {
      id: 'enable-rls',
      title: '1. Habilitar RLS (ya está habilitado)',
      description: 'Este comando ya está ejecutado, solo lo muestro para referencia.',
      sql: `-- RLS ya está habilitado en kv_store_3508045b
-- No necesitas ejecutar este comando
ALTER TABLE kv_store_3508045b ENABLE ROW LEVEL SECURITY;`,
      optional: true,
    },
    {
      id: 'policy-select',
      title: '2. Permitir LECTURA para usuarios autenticados',
      description: 'Los usuarios autenticados pueden leer sus propios datos.',
      sql: `-- Permitir que usuarios autenticados lean cualquier dato
CREATE POLICY "Allow authenticated users to read"
ON kv_store_3508045b
FOR SELECT
TO authenticated
USING (true);`,
    },
    {
      id: 'policy-insert',
      title: '3. Permitir INSERCIÓN para usuarios autenticados',
      description: 'Los usuarios autenticados pueden insertar nuevos registros.',
      sql: `-- Permitir que usuarios autenticados inserten datos
CREATE POLICY "Allow authenticated users to insert"
ON kv_store_3508045b
FOR INSERT
TO authenticated
WITH CHECK (true);`,
    },
    {
      id: 'policy-update',
      title: '4. Permitir ACTUALIZACIÓN para usuarios autenticados',
      description: 'Los usuarios autenticados pueden actualizar registros.',
      sql: `-- Permitir que usuarios autenticados actualicen datos
CREATE POLICY "Allow authenticated users to update"
ON kv_store_3508045b
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);`,
    },
    {
      id: 'policy-delete',
      title: '5. Permitir ELIMINACIÓN para usuarios autenticados',
      description: 'Los usuarios autenticados pueden eliminar registros.',
      sql: `-- Permitir que usuarios autenticados eliminen datos
CREATE POLICY "Allow authenticated users to delete"
ON kv_store_3508045b
FOR DELETE
TO authenticated
USING (true);`,
    },
  ];

  const allInOneSQL = sqlCommands
    .filter(cmd => !cmd.optional)
    .map(cmd => cmd.sql)
    .join('\n\n');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-4">
              <Terminal className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">🔐 Configurar RLS</h1>
            <p className="text-gray-600">
              Row Level Security para la tabla kv_store_3508045b
            </p>
          </div>

          {/* Explanation */}
          <div className="p-5 bg-blue-50 rounded-xl border-2 border-blue-200 mb-6">
            <h3 className="font-bold text-blue-900 mb-2">📚 ¿Qué es RLS?</h3>
            <p className="text-sm text-blue-800 mb-2">
              <strong>Row Level Security (RLS)</strong> es un sistema de seguridad de Supabase que controla
              qué usuarios pueden leer o escribir datos en cada tabla.
            </p>
            <p className="text-sm text-blue-800">
              Actualmente, RLS está <strong>bloqueando el acceso</strong> porque no hay políticas configuradas.
              Necesitas ejecutar los comandos SQL de abajo en el panel de Supabase.
            </p>
          </div>

          {/* Quick Copy All */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">⚡ Copiar todo (recomendado)</h3>
            </div>
            <div className="relative">
              <pre className="p-4 bg-gray-900 text-green-400 rounded-xl text-xs overflow-x-auto font-mono">
                {allInOneSQL}
              </pre>
              <button
                onClick={() => copyToClipboard(allInOneSQL, 'all')}
                className="absolute top-3 right-3 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                {copied === 'all' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-5 bg-yellow-50 rounded-xl border-2 border-yellow-300 mb-6">
            <h3 className="font-bold text-yellow-900 mb-3">📋 Instrucciones:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-900">
              <li>
                Abre el <strong>panel de Supabase</strong>:{' '}
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-700 underline hover:text-yellow-600 inline-flex items-center gap-1"
                >
                  dashboard
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Ve a tu proyecto → <strong>SQL Editor</strong> (en el menú lateral)</li>
              <li>Haz clic en <strong>"New Query"</strong></li>
              <li>
                <strong>Copia y pega</strong> el código SQL de arriba (botón ⚡ Copiar todo)
              </li>
              <li>Haz clic en <strong>"Run"</strong> (▶️)</li>
              <li>
                Vuelve aquí y ve a{' '}
                <a href="/quick-test" className="text-yellow-700 underline font-bold">
                  /quick-test
                </a>{' '}
                para verificar
              </li>
            </ol>
          </div>
        </div>

        {/* Individual Commands */}
        <div className="space-y-4 mb-6">
          <h2 className="text-xl font-bold px-2">📝 Comandos individuales (opcional)</h2>
          <p className="text-sm text-gray-600 px-2 mb-4">
            Si prefieres ejecutarlos uno por uno, aquí están separados:
          </p>

          {sqlCommands.map((cmd) => (
            <div
              key={cmd.id}
              className={`bg-white rounded-2xl shadow-lg p-6 ${
                cmd.optional ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg mb-1">{cmd.title}</h3>
                  <p className="text-sm text-gray-600">{cmd.description}</p>
                </div>
              </div>

              <div className="relative">
                <pre className="p-4 bg-gray-900 text-green-400 rounded-xl text-xs overflow-x-auto font-mono">
                  {cmd.sql}
                </pre>
                <button
                  onClick={() => copyToClipboard(cmd.sql, cmd.id)}
                  className="absolute top-3 right-3 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Copiar"
                >
                  {copied === cmd.id ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>

              {cmd.optional && (
                <p className="text-xs text-gray-500 mt-2 italic">
                  ℹ️ Este paso es opcional, ya fue ejecutado anteriormente.
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Success Info */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-green-900 mb-2">
                ✅ Después de ejecutar los comandos:
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Una vez que hayas ejecutado el SQL en Supabase, tu aplicación podrá:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>Leer datos de la tabla kv_store_3508045b</li>
                <li>Escribir nuevos datos</li>
                <li>Actualizar datos existentes</li>
                <li>Eliminar datos</li>
              </ul>
              <p className="text-sm text-gray-700 mt-3">
                Todos los usuarios autenticados tendrán acceso completo a la tabla.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-6 text-center space-y-2">
          <a
            href="/quick-test"
            className="block text-sm text-purple-600 hover:text-purple-900 underline font-bold"
          >
            ⚡ Volver a Test Rápido
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
  );
}
