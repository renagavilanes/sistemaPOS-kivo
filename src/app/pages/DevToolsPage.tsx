import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { toast } from 'sonner';
import { Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';

export default function DevToolsPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleDeleteUser = async () => {
    if (!email) {
      toast.error('Ingresa un email');
      return;
    }

    const confirmDelete = window.confirm(
      `⚠️ ¿Estás seguro de eliminar el usuario con email: ${email}?\n\nEsto eliminará:\n- Cuenta de usuario\n- Datos del negocio\n- Verificaciones pendientes\n- Usuario de Supabase Auth\n\nEsta acción NO se puede deshacer.`
    );

    if (!confirmDelete) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/dev/delete-user/${encodeURIComponent(email)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar usuario');
      }

      setResult(data);
      toast.success('Usuario eliminado correctamente', {
        description: 'Ahora puedes registrarlo nuevamente',
      });
      setEmail('');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Error al eliminar', {
        description: error.message,
      });
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Alert className="bg-red-50 border-red-500 border-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-900 font-bold">
            ⚠️ Herramientas de Desarrollo
          </AlertTitle>
          <AlertDescription className="text-red-800">
            Esta página es solo para desarrollo. Permite eliminar usuarios para hacer pruebas.
          </AlertDescription>
        </Alert>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-600" />
              Eliminar Usuario
            </CardTitle>
            <CardDescription>
              Elimina un usuario por email para poder registrarlo nuevamente durante las pruebas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email del Usuario</label>
              <Input
                type="email"
                placeholder="ejemplo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-lg"
              />
            </div>

            <Button
              onClick={handleDeleteUser}
              disabled={loading || !email}
              variant="destructive"
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-5 w-5" />
                  Eliminar Usuario
                </>
              )}
            </Button>

            {result && (
              <Alert className={result.error ? 'bg-red-50 border-red-500' : result.critical ? 'bg-orange-50 border-orange-500' : 'bg-green-50 border-green-500'}>
                {result.error ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <AlertTitle className="text-red-900 font-bold">Error</AlertTitle>
                    <AlertDescription className="text-red-800">
                      {result.error}
                    </AlertDescription>
                  </>
                ) : result.critical ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <AlertTitle className="text-orange-900 font-bold">
                      ⚠️ Acción Manual Requerida
                    </AlertTitle>
                    <AlertDescription className="text-orange-800 space-y-2">
                      <p className="font-bold">{result.critical}</p>
                      <div className="mt-3 p-3 bg-white rounded border border-orange-200">
                        <p className="text-sm font-medium mb-2">Elimina manualmente desde Supabase:</p>
                        <ol className="text-sm space-y-2 list-decimal list-inside">
                          <li>Abre: <a href="https://supabase.com/dashboard/project/hhnfcmvvttulcjxmfnit/auth/users" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Authentication → Users</a></li>
                          <li>Busca el email: <code className="bg-orange-100 px-1 rounded">{email}</code></li>
                          <li>Click en los 3 puntos (⋮) → <strong>Delete user</strong></li>
                          <li>Confirma la eliminación</li>
                        </ol>
                      </div>
                      {result.deleted && (
                        <div className="mt-2 p-3 bg-white rounded border border-orange-200">
                          <p className="text-sm font-medium">Datos eliminados del KV:</p>
                          <ul className="text-sm space-y-1 mt-1">
                            <li>• Negocio: {result.deleted.businessData ? '✅' : '⚠️ No existía'}</li>
                            <li>• Mapeo Email: {result.deleted.emailMapping ? '✅' : '⚠️ No existía'}</li>
                            <li>• Verificación: {result.deleted.verification ? '✅' : '⚠️ No existía'}</li>
                          </ul>
                        </div>
                      )}
                      {result.errors && result.errors.length > 0 && (
                        <div className="mt-2 p-3 bg-white rounded border border-red-200">
                          <p className="text-sm font-medium text-red-600">Errores encontrados:</p>
                          <ul className="text-xs space-y-1 mt-1 text-red-700">
                            {result.errors.map((err: string, i: number) => (
                              <li key={i}>• {err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AlertDescription>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <AlertTitle className="text-green-900 font-bold">
                      ✅ Usuario Eliminado Completamente
                    </AlertTitle>
                    <AlertDescription className="text-green-800 space-y-2">
                      <p>{result.message}</p>
                      <div className="mt-2 p-3 bg-white rounded border border-green-200">
                        <p className="text-sm font-medium">Detalles:</p>
                        <ul className="text-sm space-y-1 mt-1">
                          <li>• Supabase Auth: {result.deleted.authUser ? '✅ Eliminado' : '⚠️ No existía'}</li>
                          <li>• Negocio: {result.deleted.businessData ? '✅ Eliminado' : '⚠️ No existía'}</li>
                          <li>• Mapeo Email: {result.deleted.emailMapping ? '✅ Eliminado' : '⚠️ No existía'}</li>
                          <li>• Verificación: {result.deleted.verification ? '✅ Eliminada' : '⚠️ No existía'}</li>
                        </ul>
                      </div>
                      <p className="text-sm font-bold mt-3 text-green-700">
                        🎉 Ahora puedes registrar este email nuevamente
                      </p>
                    </AlertDescription>
                  </>
                )}
              </Alert>
            )}

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600">
                <strong>Sugerencia rápida:</strong> Si quieres borrar{' '}
                <code className="bg-gray-100 px-2 py-1 rounded">renagavilanes@hotmail.com</code>
                {' '}copia ese email y pégalo arriba.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <a href="/" className="text-blue-600 hover:underline">
            ← Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}