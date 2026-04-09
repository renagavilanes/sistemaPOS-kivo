import { useState } from 'react';
import { Copy, CheckCircle, AlertCircle } from 'lucide-react';

export default function FixRLSPage() {
  const [copied, setCopied] = useState(false);

  const fixScript = `-- =====================================================
-- SCRIPT DE CORRECCIÓN V3 - RESTAURACIÓN DE VISIBILIDAD
-- =====================================================
-- Este script restaura completamente la visibilidad para dueños y empleados.
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- =====================================================

-- 1. Función segura para verificar acceso (Evita recursión infinita)
CREATE OR REPLACE FUNCTION has_business_access(check_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Es dueño del negocio OR es empleado activo en ese negocio
  SELECT EXISTS (
    SELECT 1 FROM businesses WHERE id = check_business_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM employees WHERE business_id = check_business_id AND user_id = auth.uid() AND is_active = true
  );
$$;

-- 2. LIMPIAR TODAS LAS POLÍTICAS ACTUALES QUE CAUSAN CONFLICTOS
DO $$ 
DECLARE
  table_name text;
  policy_record record;
BEGIN
  FOR table_name IN SELECT unnest(ARRAY['products', 'sales', 'expenses', 'customers', 'categories', 'employees'])
  LOOP
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE tablename = table_name AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.policyname, table_name);
    END LOOP;
    
    -- Asegurar que RLS esté habilitado
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

-- 3. APLICAR POLÍTICAS PARA PRODUCTS
CREATE POLICY "products_access" ON products FOR ALL USING (has_business_access(business_id));

-- 4. APLICAR POLÍTICAS PARA SALES
CREATE POLICY "sales_access" ON sales FOR ALL USING (has_business_access(business_id));

-- 5. APLICAR POLÍTICAS PARA EXPENSES
CREATE POLICY "expenses_access" ON expenses FOR ALL USING (has_business_access(business_id));

-- 6. APLICAR POLÍTICAS PARA CUSTOMERS
CREATE POLICY "customers_access" ON customers FOR ALL USING (has_business_access(business_id));

-- 7. APLICAR POLÍTICAS PARA CATEGORIES
CREATE POLICY "categories_access" ON categories FOR ALL USING (has_business_access(business_id));

-- 8. APLICAR POLÍTICAS ESPECIALES PARA EMPLOYEES
-- (El dueño puede ver todos los de su negocio. El empleado puede verse a sí mismo para el login).
CREATE POLICY "employees_select" ON employees FOR SELECT USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) 
  OR user_id = auth.uid()
);
CREATE POLICY "employees_insert" ON employees FOR INSERT WITH CHECK (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "employees_update" ON employees FOR UPDATE USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "employees_delete" ON employees FOR DELETE USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

-- =====================================================
-- ✅ SCRIPT V3 COMPLETADO - DATOS RESTAURADOS
-- =====================================================`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fixScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-2xl p-8 mb-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-12 h-12 text-red-600 flex-shrink-0" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                🔧 Script de Corrección de Visibilidad (V3)
              </h1>
              <p className="text-gray-600 text-lg mb-4">
                Se detectaron problemas con la visibilidad de datos para dueños y empleados.
              </p>
              
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <h3 className="font-semibold text-red-800 mb-2">Problemas detectados:</h3>
                <ul className="space-y-2 text-red-700 text-sm">
                  <li>❌ <strong>Datos invisibles</strong> - Ni el dueño ni los empleados pueden ver los productos, ventas o gastos.</li>
                  <li>❌ <strong>Políticas conflictivas</strong> - Las políticas RLS anteriores bloqueaban el acceso general.</li>
                </ul>
              </div>

              <div className="bg-green-50 border-l-4 border-green-500 p-4">
                <h3 className="font-semibold text-green-800 mb-2">✨ Este script corrige TODOS los problemas:</h3>
                <ul className="space-y-2 text-green-700 text-sm">
                  <li>✅ Crea función segura <code className="bg-green-200 px-1 rounded font-mono">has_business_access()</code></li>
                  <li>✅ Limpia TODAS las políticas problemáticas que causan bloqueos.</li>
                  <li>✅ Restaura visibilidad de <strong>productos, ventas, gastos y clientes</strong>.</li>
                  <li>✅ Permite a empleados invitados ver la información según su negocio.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow-2xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">📋 Instrucciones</h2>
          <ol className="space-y-3 text-gray-700">
            <li className="flex items-start gap-3">
              <span className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 font-bold">1</span>
              <span>Haz click en el botón <strong>"Copiar Script"</strong> abajo</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 font-bold">2</span>
              <span>Ve a <strong>Supabase Dashboard → SQL Editor</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 font-bold">3</span>
              <span>Pega el script y haz click en <strong>"Run"</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 font-bold">4</span>
              <span>Regresa a <strong>/complete-test</strong> y ejecuta las pruebas nuevamente</span>
            </li>
          </ol>
        </div>

        {/* Script Box */}
        <div className="bg-gray-900 rounded-lg shadow-2xl overflow-hidden">
          <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg">SQL Script de Corrección</h3>
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  ¡Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copiar Script
                </>
              )}
            </button>
          </div>
          
          <div className="p-6 overflow-x-auto">
            <pre className="text-green-400 font-mono text-sm leading-relaxed">
              <code>{fixScript}</code>
            </pre>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <a
            href="/complete-test"
            className="bg-purple-600 hover:bg-purple-700 text-white p-6 rounded-lg shadow-lg transition-all text-center font-semibold"
          >
            🧪 Volver a Pruebas Completas
          </a>
          <a
            href="/test-index"
            className="bg-gray-700 hover:bg-gray-600 text-white p-6 rounded-lg shadow-lg transition-all text-center font-semibold"
          >
            📋 Índice de Pruebas
          </a>
        </div>

        {/* Technical Explanation */}
        <div className="mt-6 bg-white rounded-lg shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🧠 Explicación Técnica</h2>
          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">¿Por qué desaparecieron los datos?</h3>
              <p className="text-sm">
                Al intentar configurar permisos para los empleados, las políticas de Row Level Security (RLS) se volvieron restrictivas o generaron conflictos de recursión. Supabase, por seguridad, bloquea la visualización de los datos si las reglas no son claras o generan bucles infinitos.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">¿Cómo lo corregimos?</h3>
              <p className="text-sm">
                Creamos una función única <code className="bg-gray-100 px-1 rounded">has_business_access()</code> que verifica dos cosas sin crear bucles:
                <br/>1. ¿Eres el dueño del negocio?
                <br/>2. ¿Eres un empleado activo del negocio?
                <br/>Luego, aplicamos esta misma regla limpia a todas las tablas (productos, ventas, gastos, etc.), restaurando el acceso tanto para el propietario como para los empleados invitados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}