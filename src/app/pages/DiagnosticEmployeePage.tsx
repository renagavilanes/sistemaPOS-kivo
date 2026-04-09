import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export default function DiagnosticEmployeePage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  // ---- NEW: Product test state ----
  const [productBusinessId, setProductBusinessId] = useState('');
  const [productTestLoading, setProductTestLoading] = useState(false);
  const [productTestResults, setProductTestResults] = useState<any>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    const email = 'post_visual@hotmail.com';
    const diagnostic: any = {
      email,
      timestamp: new Date().toISOString(),
      steps: []
    };

    try {
      // 1. Buscar usuario en auth
      diagnostic.steps.push({ name: 'Buscando usuario en Auth...', status: 'running' });
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      diagnostic.currentUser = {
        id: currentUser?.id,
        email: currentUser?.email
      };

      // 2. Buscar en tabla employees
      diagnostic.steps.push({ name: 'Buscando en tabla employees...', status: 'running' });
      
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .ilike('email', email);

      if (employeesError) {
        diagnostic.employeesError = employeesError.message;
        diagnostic.steps.push({ 
          name: 'Error en employees', 
          status: 'error',
          error: employeesError.message 
        });
      } else {
        diagnostic.employees = employees;
        diagnostic.employeesCount = employees?.length || 0;
        diagnostic.steps.push({ 
          name: `Encontrados ${employees?.length || 0} registros en employees`, 
          status: 'success' 
        });
      }

      // 3. Para cada employee, obtener el business
      if (employees && employees.length > 0) {
        diagnostic.steps.push({ name: 'Obteniendo negocios asociados...', status: 'running' });
        
        const businessPromises = employees.map(async (emp: any) => {
          const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', emp.business_id)
            .single();

          return {
            employee: emp,
            business: business,
            businessError: bizError?.message
          };
        });

        diagnostic.businessDetails = await Promise.all(businessPromises);
        diagnostic.steps.push({ 
          name: 'Negocios obtenidos', 
          status: 'success' 
        });
      }

      // 4. Intentar obtener negocios donde el usuario actual es empleado
      if (currentUser) {
        diagnostic.steps.push({ name: 'Consultando negocios del usuario actual...', status: 'running' });
        
        const { data: userEmployees, error: userEmpError } = await supabase
          .from('employees')
          .select('business_id, is_active, user_id')
          .eq('user_id', currentUser.id);

        if (userEmpError) {
          diagnostic.userEmployeesError = userEmpError.message;
        } else {
          diagnostic.userEmployees = userEmployees;
          diagnostic.userEmployeesCount = userEmployees?.length || 0;
          
          // Obtener los negocios
          if (userEmployees && userEmployees.length > 0) {
            const bizIds = userEmployees.map(e => e.business_id);
            const { data: businesses, error: bizError } = await supabase
              .from('businesses')
              .select('*')
              .in('id', bizIds);

            diagnostic.userBusinesses = businesses;
            diagnostic.userBusinessesError = bizError?.message;
          }
        }
        
        diagnostic.steps.push({ 
          name: `Usuario actual tiene ${userEmployees?.length || 0} empleos`, 
          status: 'success' 
        });
      }

      // 5. Verificar estructura de la tabla employees
      diagnostic.steps.push({ name: 'Verificando estructura de employees...', status: 'running' });
      
      const { data: sampleEmployee } = await supabase
        .from('employees')
        .select('*')
        .limit(1)
        .single();

      diagnostic.employeeTableStructure = sampleEmployee ? Object.keys(sampleEmployee) : [];
      diagnostic.steps.push({ 
        name: 'Estructura verificada', 
        status: 'success' 
      });

    } catch (error: any) {
      diagnostic.fatalError = error.message;
      diagnostic.steps.push({ 
        name: 'Error fatal', 
        status: 'error',
        error: error.message 
      });
    } finally {
      setLoading(false);
      setResults(diagnostic);
    }
  };

  // ---- Eliminar registros duplicados inactivos ----
  const deleteDuplicates = async () => {
    if (!results?.employees || results.employees.length <= 1) {
      alert('No hay duplicados para eliminar');
      return;
    }

    const inactiveEmps = results.employees.filter((e: any) => !e.is_active);
    if (inactiveEmps.length === 0) {
      alert('No hay registros inactivos duplicados');
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar ${inactiveEmps.length} registro(s) inactivo(s) duplicado(s)?\n\n` +
      inactiveEmps.map((e: any) => `• ${e.name} (${e.id})`).join('\n')
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      for (const emp of inactiveEmps) {
        const { error } = await supabase
          .from('employees')
          .delete()
          .eq('id', emp.id);
        if (error) {
          alert(`Error eliminando ${emp.name}: ${error.message}`);
          return;
        }
        console.log('🗑️ Registro duplicado eliminado:', emp.id);
      }
      alert(`✅ ${inactiveEmps.length} registro(s) duplicado(s) eliminado(s). Recarga para verificar.`);
      await runDiagnostic();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fixEmployee = async () => {
    if (!results?.employees || results.employees.length === 0) {
      alert('No hay empleados para arreglar');
      return;
    }

    const email = 'post_visual@hotmail.com';
    
    setLoading(true);
    try {
      // Obtener el usuario actual (quien está arreglando esto)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        alert('No estás autenticado');
        return;
      }

      // Buscar si existe un usuario con ese email en auth
      console.log('🔍 Buscando usuario en auth con email:', email);
      
      // Primero intentemos obtener todos los usuarios y buscar el email
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        alert(`Error listando usuarios: ${listError.message}`);
        return;
      }

      const targetUser = listData.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!targetUser) {
        alert('No se encontró el usuario en Auth. El empleado debe crear su cuenta primero.');
        return;
      }

      console.log('✅ Usuario encontrado en Auth:', targetUser.id);

      // Actualizar TODOS los registros de employee con ese email
      for (const emp of results.employees) {
        console.log('🔧 Actualizando empleado:', emp.id, 'en negocio:', emp.business_id);
        
        const { error: updateError } = await supabase
          .from('employees')
          .update({ 
            user_id: targetUser.id,
            is_active: true 
          })
          .eq('id', emp.id);

        if (updateError) {
          console.error('❌ Error actualizando empleado:', updateError);
          alert(`Error actualizando: ${updateError.message}`);
          return;
        }
      }

      alert('✅ Empleado(s) actualizado(s). Recarga la página para ver los cambios.');
      
      // Volver a ejecutar diagnóstico
      await runDiagnostic();
      
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runProductTest = async () => {
    const businessId = productBusinessId.trim();
    if (!businessId) {
      alert('Ingresa un Business ID para continuar');
      return;
    }

    setProductTestLoading(true);
    const report: any = {
      businessId,
      timestamp: new Date().toISOString(),
      methods: {}
    };

    try {
      // 1. Obtener token de sesión actual
      const { data: { session } } = await supabase.auth.getSession();
      // IMPORTANT: Use publicAnonKey for Edge Function calls (not session.access_token which uses ES256)
      // The X-Business-ID header provides authorization context
      const accessToken = supabaseAnonKey;
      report.currentUser = { email: session?.user?.email, id: session?.user?.id };
      report.hasSession = !!session;
      report.tokenPreview = '(publicAnonKey - fixed)';

      const baseUrl = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b`;

      // ── MÉTODO 1: Edge Function leyendo clave "products" (lo que el servidor devuelve) ──
      try {
        const res1 = await fetch(`${baseUrl}/products`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Business-ID': businessId,
          }
        });
        const raw1 = await res1.json();
        report.methods.edgeFunctionProducts = {
          status: res1.status,
          ok: res1.ok,
          rawKeys: Object.keys(raw1),
          productsKey: raw1.products?.length ?? 'undefined (clave "products" no existe)',
          dataKey: raw1.data?.length ?? 'undefined (clave "data" no existe)',
          count: raw1.products?.length || raw1.data?.length || 0,
          sample: (raw1.products || raw1.data || []).slice(0, 2),
          raw: raw1,
        };
      } catch (err: any) {
        report.methods.edgeFunctionProducts = { error: err.message };
      }

      // ── MÉTODO 2: Supabase directo (SELECT from products) ──
      try {
        const { data: directData, error: directErr } = await supabase
          .from('products')
          .select('id, name, price, stock, category')
          .eq('business_id', businessId)
          .order('name')
          .limit(10);

        report.methods.supabaseDirect = {
          ok: !directErr,
          count: directData?.length ?? 0,
          error: directErr?.message,
          sample: (directData || []).slice(0, 2),
        };
      } catch (err: any) {
        report.methods.supabaseDirect = { error: err.message };
      }

      // ── MÉTODO 3: Verificar permisos del empleado actual ──
      if (session?.user?.id) {
        const { data: empData, error: empErr } = await supabase
          .from('employees')
          .select('id, business_id, is_active, role, permissions, user_id')
          .eq('user_id', session.user.id)
          .eq('business_id', businessId)
          .single();

        report.employeePermissions = {
          found: !!empData,
          is_active: empData?.is_active,
          role: empData?.role,
          permissions: empData?.permissions,
          error: empErr?.message,
        };
      }

    } catch (err: any) {
      report.fatalError = err.message;
    } finally {
      setProductTestResults(report);
      setProductTestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">🔍 Diagnóstico de Empleado</CardTitle>
          <p className="text-sm text-gray-600">Email: post_visual@hotmail.com</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={runDiagnostic} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Ejecutando...' : 'Ejecutar Diagnóstico'}
            </Button>
            
            {results?.employees && results.employees.length > 0 && (
              <Button 
                onClick={fixEmployee} 
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                🔧 Arreglar Empleado
              </Button>
            )}

            {results?.employees && results.employees.filter((e: any) => !e.is_active).length > 0 && (
              <Button
                onClick={deleteDuplicates}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                🗑️ Eliminar Duplicados Inactivos ({results.employees.filter((e: any) => !e.is_active).length})
              </Button>
            )}
          </div>

          {results && (
            <div className="space-y-4 mt-6">
              {/* Current User */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-bold mb-2">👤 Usuario Actual</h3>
                <pre className="text-xs bg-white p-3 rounded overflow-auto">
                  {JSON.stringify(results.currentUser, null, 2)}
                </pre>
              </div>

              {/* Steps */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold mb-2">📋 Pasos Ejecutados</h3>
                <div className="space-y-1">
                  {results.steps.map((step: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {step.status === 'success' && <span className="text-green-600">✅</span>}
                      {step.status === 'error' && <span className="text-red-600">❌</span>}
                      {step.status === 'running' && <span className="text-blue-600">⏳</span>}
                      <span>{step.name}</span>
                      {step.error && <span className="text-red-600">({step.error})</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Employee Table Structure */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-bold mb-2">🏗️ Estructura de tabla employees</h3>
                <div className="flex flex-wrap gap-2">
                  {results.employeeTableStructure?.map((col: string) => (
                    <span key={col} className="px-2 py-1 bg-white rounded text-xs font-mono">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {/* Employees encontrados */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-bold mb-2">
                  👥 Empleados encontrados ({results.employeesCount})
                </h3>
                {results.employees && results.employees.length > 0 ? (
                  <div className="space-y-3">
                    {results.employees.map((emp: any) => (
                      <div key={emp.id} className="bg-white p-3 rounded border">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><strong>ID:</strong> {emp.id}</div>
                          <div><strong>Email:</strong> {emp.email}</div>
                          <div><strong>Name:</strong> {emp.name}</div>
                          <div><strong>Business ID:</strong> {emp.business_id}</div>
                          <div className={emp.user_id ? 'text-green-600' : 'text-red-600'}>
                            <strong>User ID:</strong> {emp.user_id || '❌ NULL'}
                          </div>
                          <div className={emp.is_active ? 'text-green-600' : 'text-red-600'}>
                            <strong>is_active:</strong> {emp.is_active ? '✅ true' : '❌ false'}
                          </div>
                          <div><strong>Role:</strong> {emp.role}</div>
                          <div><strong>is_owner:</strong> {emp.is_owner ? 'true' : 'false'}</div>
                        </div>
                        {/* Auto-fill button */}
                        <button
                          onClick={() => setProductBusinessId(emp.business_id)}
                          className="mt-2 text-xs text-blue-600 underline hover:text-blue-800"
                        >
                          → Usar este Business ID en la prueba de productos
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No se encontraron empleados con ese email</p>
                )}
              </div>

              {/* Business Details */}
              {results.businessDetails && results.businessDetails.length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">🏢 Negocios Asociados</h3>
                  <div className="space-y-3">
                    {results.businessDetails.map((detail: any, i: number) => (
                      <div key={i} className="bg-white p-3 rounded border">
                        {detail.business ? (
                          <div className="text-xs space-y-1">
                            <div><strong>Negocio:</strong> {detail.business.name}</div>
                            <div><strong>ID:</strong> {detail.business.id}</div>
                            <div><strong>Owner ID:</strong> {detail.business.owner_id}</div>
                            <div><strong>Email:</strong> {detail.business.email || 'N/A'}</div>
                          </div>
                        ) : (
                          <div className="text-red-600 text-xs">
                            ❌ Error: {detail.businessError || 'Negocio no encontrado'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* User Employees (current user) */}
              <div className="bg-indigo-50 p-4 rounded-lg">
                <h3 className="font-bold mb-2">
                  👔 Empleos del Usuario Actual ({results.userEmployeesCount || 0})
                </h3>
                {results.userEmployees && results.userEmployees.length > 0 ? (
                  <div className="space-y-2">
                    {results.userEmployees.map((emp: any, i: number) => (
                      <div key={i} className="bg-white p-2 rounded text-xs">
                        <div><strong>Business ID:</strong> {emp.business_id}</div>
                        <div><strong>User ID:</strong> {emp.user_id}</div>
                        <div><strong>is_active:</strong> {emp.is_active ? '✅' : '❌'}</div>
                      </div>
                    ))}
                    
                    {results.userBusinesses && (
                      <div className="mt-3">
                        <strong className="text-sm">Negocios:</strong>
                        {results.userBusinesses.map((biz: any) => (
                          <div key={biz.id} className="bg-white p-2 rounded mt-2 text-xs">
                            <div><strong>Nombre:</strong> {biz.name}</div>
                            <div><strong>ID:</strong> {biz.id}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    El usuario actual no tiene empleos asignados
                  </p>
                )}
              </div>

              {/* Errores */}
              {(results.employeesError || results.userEmployeesError || results.fatalError) && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-2 text-red-600">❌ Errores</h3>
                  <div className="space-y-2 text-sm">
                    {results.employeesError && (
                      <div><strong>Employees:</strong> {results.employeesError}</div>
                    )}
                    {results.userEmployeesError && (
                      <div><strong>User Employees:</strong> {results.userEmployeesError}</div>
                    )}
                    {results.fatalError && (
                      <div><strong>Fatal:</strong> {results.fatalError}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Full JSON */}
              <details className="bg-gray-100 p-4 rounded-lg">
                <summary className="font-bold cursor-pointer">📄 Resultado Completo (JSON)</summary>
                <pre className="text-xs bg-white p-3 rounded mt-2 overflow-auto max-h-96">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════ */}
          {/* 🧪 PRUEBA DE PRODUCTOS (nueva sección, no toca el diseño) */}
          {/* ════════════════════════════════════════════════════════ */}
          <div className="mt-8 border-t-2 border-dashed border-orange-300 pt-6">
            <h2 className="text-lg font-bold text-orange-700 mb-1">🧪 Prueba de Carga de Productos</h2>
            <p className="text-xs text-gray-500 mb-4">
              Prueba 3 métodos distintos para detectar dónde falla la carga de productos para el empleado.
              Ingresa el Business ID del negocio "be a hero 5" (o usa el botón de arriba si ya ejecutaste el diagnóstico).
            </p>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={productBusinessId}
                onChange={(e) => setProductBusinessId(e.target.value)}
                placeholder="Business ID (UUID del negocio)"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <Button
                onClick={runProductTest}
                disabled={productTestLoading || !productBusinessId.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {productTestLoading ? '⏳ Probando...' : '🚀 Probar'}
              </Button>
            </div>

            {productTestResults && (
              <div className="space-y-4">
                {/* Auth info */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold text-sm mb-2">🔑 Sesión Actual</h3>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="font-medium">Usuario:</span>{' '}
                      {productTestResults.currentUser?.email || '⚠️ Sin sesión'}
                    </div>
                    <div>
                      <span className="font-medium">ID:</span>{' '}
                      {productTestResults.currentUser?.id || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Token:</span>{' '}
                      <code className="bg-white px-1 rounded">{productTestResults.tokenPreview}</code>
                    </div>
                    <div className={productTestResults.hasSession ? 'text-green-600' : 'text-red-600 font-bold'}>
                      {productTestResults.hasSession ? '✅ Sesión activa' : '❌ SIN SESIÓN — el empleado no está logueado con esta cuenta'}
                    </div>
                  </div>
                </div>

                {/* Employee permissions */}
                {productTestResults.employeePermissions && (
                  <div className={`border rounded-lg p-4 ${productTestResults.employeePermissions.found ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className="font-bold text-sm mb-2">👔 Permisos del Empleado en este Negocio</h3>
                    <div className="text-xs space-y-1">
                      {productTestResults.employeePermissions.found ? (
                        <>
                          <div className={productTestResults.employeePermissions.is_active ? 'text-green-700' : 'text-red-700 font-bold'}>
                            <span className="font-medium">is_active:</span>{' '}
                            {productTestResults.employeePermissions.is_active ? '✅ true (puede acceder)' : '❌ false (bloqueado por RLS)'}
                          </div>
                          <div>
                            <span className="font-medium">Role:</span>{' '}
                            {productTestResults.employeePermissions.role || 'Sin rol'}
                          </div>
                          <div>
                            <span className="font-medium">Permissions:</span>{' '}
                            <code className="bg-white px-1 rounded">
                              {JSON.stringify(productTestResults.employeePermissions.permissions)}
                            </code>
                          </div>
                        </>
                      ) : (
                        <div className="text-red-700 font-bold">
                          ❌ Empleado NO encontrado en este negocio con el usuario actual.
                          {productTestResults.employeePermissions.error && (
                            <span className="block font-normal text-red-600 mt-1">{productTestResults.employeePermissions.error}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Method 1: Edge Function */}
                {productTestResults.methods?.edgeFunctionProducts && (() => {
                  const m = productTestResults.methods.edgeFunctionProducts;
                  const hasProducts = (m.count || 0) > 0;
                  return (
                    <div className={`border rounded-lg p-4 ${m.error ? 'bg-red-50 border-red-200' : hasProducts ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <h3 className="font-bold text-sm mb-2">
                        {m.error ? '❌' : hasProducts ? '✅' : '⚠️'} Método 1: Edge Function (HTTP)
                      </h3>
                      {m.error ? (
                        <p className="text-xs text-red-700">{m.error}</p>
                      ) : (
                        <div className="text-xs space-y-1">
                          <div>
                            <span className="font-medium">HTTP Status:</span>{' '}
                            <code className={`px-1 rounded ${m.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {m.status}
                            </code>
                          </div>
                          <div>
                            <span className="font-medium">Claves en respuesta:</span>{' '}
                            <code className="bg-white px-1 rounded">[{m.rawKeys?.join(', ')}]</code>
                          </div>
                          <div className={typeof m.productsKey === 'number' && m.productsKey > 0 ? 'text-green-700 font-bold' : 'text-red-700'}>
                            <span className="font-medium">Clave "products":</span>{' '}
                            {typeof m.productsKey === 'number' ? `${m.productsKey} productos` : m.productsKey}
                          </div>
                          <div className={typeof m.dataKey === 'number' && m.dataKey > 0 ? 'text-green-700' : 'text-orange-600'}>
                            <span className="font-medium">Clave "data" (lo que espera api.ts):</span>{' '}
                            {typeof m.dataKey === 'number' ? `${m.dataKey} productos` : m.dataKey}
                          </div>
                          {m.count > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer font-medium text-green-700">Ver muestra ({m.count} productos)</summary>
                              <pre className="bg-white p-2 rounded mt-1 overflow-auto max-h-40">
                                {JSON.stringify(m.sample, null, 2)}
                              </pre>
                            </details>
                          )}
                          {m.count === 0 && (
                            <div className="mt-1 p-2 bg-yellow-100 rounded text-yellow-800">
                              ⚠️ 0 productos devueltos. Puede ser RLS bloqueando, business_id incorrecto, o no hay productos.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Method 2: Supabase Direct */}
                {productTestResults.methods?.supabaseDirect && (() => {
                  const m = productTestResults.methods.supabaseDirect;
                  const hasProducts = (m.count || 0) > 0;
                  return (
                    <div className={`border rounded-lg p-4 ${m.error ? 'bg-red-50 border-red-200' : hasProducts ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <h3 className="font-bold text-sm mb-2">
                        {m.error ? '❌' : hasProducts ? '✅' : '⚠️'} Método 2: Supabase Directo (RLS del usuario actual)
                      </h3>
                      {m.error ? (
                        <div className="text-xs text-red-700">
                          <div className="font-bold">{m.error}</div>
                          <div className="mt-1 text-red-600">Probable causa: RLS bloqueando — el usuario no tiene acceso a products de este negocio.</div>
                        </div>
                      ) : (
                        <div className="text-xs space-y-1">
                          <div className={hasProducts ? 'text-green-700 font-bold' : 'text-orange-700'}>
                            Productos encontrados: {m.count}
                          </div>
                          {m.count > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer font-medium text-green-700">Ver muestra</summary>
                              <pre className="bg-white p-2 rounded mt-1 overflow-auto max-h-40">
                                {JSON.stringify(m.sample, null, 2)}
                              </pre>
                            </details>
                          )}
                          {m.count === 0 && (
                            <div className="mt-1 p-2 bg-yellow-100 rounded text-yellow-800">
                              ⚠️ 0 productos. RLS puede estar filtrando porque el user_id del empleado no coincide con la política.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Summary */}
                <div className="bg-gray-800 text-white rounded-lg p-4 text-xs">
                  <h3 className="font-bold text-sm mb-2 text-yellow-300">📊 Diagnóstico Rápido</h3>
                  <div className="space-y-1">
                    {!productTestResults.hasSession && (
                      <div className="text-red-300">❌ No hay sesión activa — el empleado no está autenticado con esta cuenta en este navegador.</div>
                    )}
                    {productTestResults.hasSession && !productTestResults.employeePermissions?.found && (
                      <div className="text-red-300">❌ El usuario autenticado NO está registrado como empleado en este negocio.</div>
                    )}
                    {productTestResults.employeePermissions?.found && !productTestResults.employeePermissions?.is_active && (
                      <div className="text-red-300">❌ El empleado existe pero is_active=false → RLS bloquea el acceso.</div>
                    )}
                    {productTestResults.employeePermissions?.is_active && (productTestResults.methods?.edgeFunctionProducts?.count || 0) === 0 && (productTestResults.methods?.supabaseDirect?.count || 0) === 0 && (
                      <div className="text-yellow-300">⚠️ Empleado activo pero 0 productos. Verifica que el negocio tiene productos creados.</div>
                    )}
                    {(productTestResults.methods?.edgeFunctionProducts?.count || 0) > 0 && (
                      <div className="text-green-300">✅ Edge Function devuelve productos (clave "products"). El servidor funciona correctamente.</div>
                    )}
                    {(productTestResults.methods?.supabaseDirect?.count || 0) > 0 && (
                      <div className="text-green-300">✅ Supabase directo devuelve productos. RLS permite el acceso.</div>
                    )}
                    {productTestResults.methods?.edgeFunctionProducts?.rawKeys?.includes('products') && !productTestResults.methods?.edgeFunctionProducts?.rawKeys?.includes('data') && (
                      <div className="text-orange-300">
                        ⚠️ Bug detectado: El servidor devuelve clave "products" pero api.ts espera "data". Los productos llegarán vacíos en ProductsPage.
                      </div>
                    )}
                  </div>
                </div>

                {/* Full JSON collapsible */}
                <details className="bg-gray-100 p-4 rounded-lg">
                  <summary className="font-bold cursor-pointer text-sm">📄 Resultado Completo JSON</summary>
                  <pre className="text-xs bg-white p-3 rounded mt-2 overflow-auto max-h-96">
                    {JSON.stringify(productTestResults, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
}