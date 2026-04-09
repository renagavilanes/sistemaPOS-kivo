import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // Logs movidos a useEffect para evitar setState durante render
  useEffect(() => {
    console.log('🔒 [PROTECTED] loading:', loading, 'user:', user?.email);
  }, [loading, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('🚫 [PROTECTED] No hay usuario, redirigiendo a login');
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}