import { Link } from 'react-router';

export default function TestIndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            🧪 Sistema POS - Pruebas
          </h1>
          <p className="text-gray-400 text-lg">
            Panel de pruebas y diagnósticos del sistema
          </p>
        </div>

        <div className="grid gap-4">
          {/* Prueba Principal */}
          <Link
            to="/complete-test"
            className="group bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 p-6 rounded-lg shadow-xl transition-all transform hover:scale-[1.02] border-2 border-green-400"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">✅ Pruebas Completas del Sistema</h2>
                <p className="text-green-100">
                  Validación completa de todas las tablas y operaciones CRUD
                </p>
              </div>
              <svg className="w-8 h-8 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Otras pruebas */}
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              to="/quick-test"
              className="bg-gray-800 hover:bg-gray-700 p-5 rounded-lg shadow-lg transition-all border border-gray-700 hover:border-blue-500"
            >
              <h3 className="text-lg font-semibold mb-2 text-blue-400">⚡ Quick Test</h3>
              <p className="text-gray-400 text-sm">Pruebas rápidas de autenticación y base de datos</p>
            </Link>

            <Link
              to="/simple-test"
              className="bg-gray-800 hover:bg-gray-700 p-5 rounded-lg shadow-lg transition-all border border-gray-700 hover:border-purple-500"
            >
              <h3 className="text-lg font-semibold mb-2 text-purple-400">🔧 Simple Test</h3>
              <p className="text-gray-400 text-sm">Pruebas básicas de registro y login</p>
            </Link>

            <Link
              to="/diagnostic"
              className="bg-gray-800 hover:bg-gray-700 p-5 rounded-lg shadow-lg transition-all border border-gray-700 hover:border-yellow-500"
            >
              <h3 className="text-lg font-semibold mb-2 text-yellow-400">🔍 Diagnóstico</h3>
              <p className="text-gray-400 text-sm">Herramientas de diagnóstico del sistema</p>
            </Link>

            <Link
              to="/direct-test"
              className="bg-gray-800 hover:bg-gray-700 p-5 rounded-lg shadow-lg transition-all border border-gray-700 hover:border-pink-500"
            >
              <h3 className="text-lg font-semibold mb-2 text-pink-400">🎯 Direct Test</h3>
              <p className="text-gray-400 text-sm">Acceso directo a Supabase</p>
            </Link>

            <Link
              to="/rls-setup"
              className="bg-gray-800 hover:bg-gray-700 p-5 rounded-lg shadow-lg transition-all border border-gray-700 hover:border-red-500"
            >
              <h3 className="text-lg font-semibold mb-2 text-red-400">🔐 RLS Setup</h3>
              <p className="text-gray-400 text-sm">Configuración de políticas RLS</p>
            </Link>

            <Link
              to="/create-tables"
              className="bg-gray-800 hover:bg-gray-700 p-5 rounded-lg shadow-lg transition-all border border-gray-700 hover:border-indigo-500"
            >
              <h3 className="text-lg font-semibold mb-2 text-indigo-400">🗄️ Create Tables</h3>
              <p className="text-gray-400 text-sm">Creación de tablas en la base de datos</p>
            </Link>
          </div>

          {/* Acceso al sistema */}
          <div className="mt-8 pt-8 border-t border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-300">🚀 Sistema Principal</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Link
                to="/login"
                className="bg-blue-600 hover:bg-blue-700 p-5 rounded-lg shadow-lg transition-all"
              >
                <h3 className="text-lg font-semibold mb-2">🔑 Iniciar Sesión</h3>
                <p className="text-blue-100 text-sm">Acceder al sistema POS</p>
              </Link>

              <Link
                to="/register"
                className="bg-purple-600 hover:bg-purple-700 p-5 rounded-lg shadow-lg transition-all"
              >
                <h3 className="text-lg font-semibold mb-2">📝 Registrarse</h3>
                <p className="text-purple-100 text-sm">Crear una nueva cuenta</p>
              </Link>
            </div>
          </div>
        </div>

        {/* Info adicional */}
        <div className="mt-12 p-6 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold mb-3 text-gray-300">ℹ️ Información</h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li>• <strong className="text-white">Usuario de prueba:</strong> testpos2024@gmail.com</li>
            <li>• <strong className="text-white">Contraseña:</strong> testpos2024</li>
            <li>• <strong className="text-white">Estado:</strong> Sistema conectado a Supabase</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
