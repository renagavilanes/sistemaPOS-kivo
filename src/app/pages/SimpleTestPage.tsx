import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function SimpleTestPage() {
  const [email, setEmail] = useState('testpos2024@gmail.com');
  const [password, setPassword] = useState('testpos2024');
  const [businessName, setBusinessName] = useState('Mi Negocio Test');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  // PASO 1: Crear Usuario
  const handleSignUp = async () => {
    setLoading(true);
    setResult('🔄 Creando usuario...');
    
    try {
      console.log('🚀 Intentando crear usuario:', { email, password });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      console.log('📦 Respuesta de signUp:', { data, error });

      if (error) {
        console.error('❌ Error de signUp:', error);
        setResult(`❌ ERROR: ${error.message}\n\nCódigo: ${error.status || 'N/A'}`);
      } else if (data.user) {
        const msg = `✅ USUARIO CREADO:\nID: ${data.user.id}\nEmail: ${data.user.email}`;
        console.log(msg);
        setResult(msg);
      } else {
        setResult(`⚠️ Respuesta inesperada`);
      }
    } catch (err) {
      console.error('❌ Excepción:', err);
      setResult(`❌ ERROR: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  // PASO 2: Iniciar Sesión
  const handleSignIn = async () => {
    setLoading(true);
    setResult('🔄 Iniciando sesión...');
    
    try {
      console.log('🚀 Intentando iniciar sesión:', { email });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('📦 Respuesta de signIn:', { data, error });

      if (error) {
        console.error('❌ Error de signIn:', error);
        setResult(`❌ ERROR: ${error.message}`);
      } else if (data.user && data.session) {
        const msg = `✅ SESIÓN INICIADA:\nID: ${data.user.id}\nEmail: ${data.user.email}\nToken: ${data.session.access_token.substring(0, 20)}...`;
        console.log(msg);
        setResult(msg);
      } else {
        setResult(`⚠️ Respuesta inesperada`);
      }
    } catch (err) {
      console.error('❌ Excepción:', err);
      setResult(`❌ ERROR: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  // PASO 3: Crear Negocio
  const handleCreateBusiness = async () => {
    setLoading(true);
    setResult('🔄 Creando negocio...');
    
    try {
      console.log('🚀 Obteniendo usuario actual...');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setResult('❌ ERROR: No hay usuario autenticado. Debes iniciar sesión primero.');
        setLoading(false);
        return;
      }

      console.log('👤 Usuario:', user.id, user.email);
      console.log('🏢 Creando negocio:', businessName);

      const { data, error } = await supabase
        .from('businesses')
        .insert([{
          name: businessName,
          owner_id: user.id,
          country: 'Colombia',
          currency: 'COP',
        }])
        .select()
        .single();

      console.log('📦 Respuesta de insert:', { data, error });

      if (error) {
        console.error('❌ Error al crear negocio:', error);
        setResult(`❌ ERROR: ${error.message}\n\nCódigo: ${error.code || 'N/A'}\n\nDetalles: ${error.details || 'N/A'}`);
      } else if (data) {
        const msg = `✅ NEGOCIO CREADO:\nID: ${data.id}\nNombre: ${data.name}\nOwner ID: ${data.owner_id}`;
        console.log(msg);
        setResult(msg);
      } else {
        setResult(`⚠️ Respuesta inesperada`);
      }
    } catch (err) {
      console.error('❌ Excepción:', err);
      setResult(`❌ ERROR: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  // PASO 4: Leer Negocios
  const handleReadBusinesses = async () => {
    setLoading(true);
    setResult('🔄 Leyendo negocios...');
    
    try {
      console.log('🚀 Obteniendo usuario actual...');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setResult('❌ ERROR: No hay usuario autenticado.');
        setLoading(false);
        return;
      }

      console.log('👤 Usuario:', user.id);
      console.log('📖 Leyendo negocios...');

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id);

      console.log('📦 Respuesta de select:', { data, error });

      if (error) {
        console.error('❌ Error al leer negocios:', error);
        setResult(`❌ ERROR: ${error.message}\n\nCódigo: ${error.code || 'N/A'}`);
      } else if (data) {
        const msg = `✅ NEGOCIOS ENCONTRADOS: ${data.length}\n\n${JSON.stringify(data, null, 2)}`;
        console.log(msg);
        setResult(msg);
      } else {
        setResult(`⚠️ Respuesta inesperada`);
      }
    } catch (err) {
      console.error('❌ Excepción:', err);
      setResult(`❌ ERROR: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  // Cerrar Sesión
  const handleSignOut = async () => {
    setLoading(true);
    setResult('🔄 Cerrando sesión...');
    
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setResult(`❌ ERROR: ${error.message}`);
      } else {
        setResult(`✅ SESIÓN CERRADA`);
      }
    } catch (err) {
      setResult(`❌ ERROR: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🧪 Test Simple - Paso a Paso</h1>

        {/* Inputs */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Datos de Prueba</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Password:</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Nombre del Negocio:</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
        </div>

        {/* Botones de Prueba */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Pruebas</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-semibold"
            >
              1️⃣ Crear Usuario
            </button>

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-semibold"
            >
              2️⃣ Iniciar Sesión
            </button>

            <button
              onClick={handleCreateBusiness}
              disabled={loading}
              className="px-4 py-3 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 font-semibold"
            >
              3️⃣ Crear Negocio
            </button>

            <button
              onClick={handleReadBusinesses}
              disabled={loading}
              className="px-4 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 font-semibold"
            >
              4️⃣ Leer Negocios
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="px-4 py-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 font-semibold col-span-2"
            >
              🚪 Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Resultado */}
        <div className="bg-gray-900 text-green-400 rounded-lg shadow p-6 font-mono text-sm">
          <h2 className="text-xl font-semibold mb-4 text-white">Resultado:</h2>
          <pre className="whitespace-pre-wrap">{result || 'Esperando acción...'}</pre>
        </div>
      </div>
    </div>
  );
}