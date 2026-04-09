import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Terminal, Database } from 'lucide-react';

export default function CreateTablesPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const createTablesSQL = `-- Crear tabla de negocios (businesses)
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  country TEXT DEFAULT 'Colombia',
  currency TEXT DEFAULT 'COP',
  logo TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas por owner
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);

-- Habilitar RLS en businesses
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para businesses
CREATE POLICY "Users can read their own businesses"
ON businesses
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own businesses"
ON businesses
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own businesses"
ON businesses
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete their own businesses"
ON businesses
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
              <Database className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">📊 Crear Tablas</h1>
            <p className="text-gray-600">
              SQL para crear la tabla de negocios con RLS
            </p>
          </div>

          {/* Explanation */}
          <div className="p-5 bg-blue-50 rounded-xl border-2 border-blue-200 mb-6">
            <h3 className="font-bold text-blue-900 mb-2">📚 ¿Qué hace este SQL?</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0">✅</span>
                <span>Crea la tabla <code className="bg-blue-100 px-1 rounded">businesses</code> para almacenar los negocios</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0">✅</span>
                <span>Configura RLS para que cada usuario solo vea sus propios negocios</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0">✅</span>
                <span>Crea índices para búsquedas rápidas</span>
              </li>
            </ul>
          </div>

          {/* SQL Code */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">⚡ Código SQL completo</h3>
            </div>
            <div className="relative">
              <pre className="p-4 bg-gray-900 text-green-400 rounded-xl text-xs overflow-x-auto font-mono max-h-96">
                {createTablesSQL}
              </pre>
              <button
                onClick={() => copyToClipboard(createTablesSQL, 'all')}
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
                <strong>Copia y pega</strong> el código SQL de arriba (botón de copiar)
              </li>
              <li>Haz clic en <strong>"Run"</strong> (▶️)</li>
              <li>
                Verifica que diga <strong>"Success"</strong> ✅
              </li>
            </ol>
          </div>

          {/* Warning */}
          <div className="p-5 bg-orange-50 rounded-xl border-2 border-orange-300 mb-6">
            <h3 className="font-bold text-orange-900 mb-2">⚠️ Importante:</h3>
            <p className="text-sm text-orange-800">
              Si ya ejecutaste este SQL antes y ves un error como <strong>"relation already exists"</strong>, 
              es normal. Significa que la tabla ya está creada. Puedes ignorar ese error.
            </p>
          </div>
        </div>

        {/* Success Info */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-green-900 mb-2">
                ✅ Después de ejecutar el SQL:
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Tu aplicación podrá:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>Crear nuevos negocios</li>
                <li>Listar los negocios del usuario</li>
                <li>Cambiar entre negocios</li>
                <li>Editar información de negocios</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="text-center space-y-2">
          <a
            href="/quick-test"
            className="block text-sm text-blue-600 hover:text-blue-900 underline font-bold"
          >
            ⚡ Volver a Test Rápido
          </a>
          <a
            href="/rls-setup"
            className="block text-sm text-purple-600 hover:text-purple-900 underline font-bold"
          >
            🔐 Ver configuración RLS de kv_store
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
