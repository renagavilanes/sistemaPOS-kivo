import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useBusiness } from '../contexts/BusinessContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface BusinessProtectedRouteProps {
  children: React.ReactNode;
}

export function BusinessProtectedRoute({ children }: BusinessProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { businesses, loadBusinesses, loading: businessLoading } = useBusiness();
  // Use a ref so the effect only fires once per mount, not on every render
  const didLoad = useRef(false);

  useEffect(() => {
    if (!authLoading && user && !didLoad.current && businesses.length === 0) {
      didLoad.current = true;
      loadBusinesses();
    }
  }, [authLoading, user]); // intentionally omit loadBusinesses — stable via useCallback

  // Auth still loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // No user → login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Loading businesses (first load only)
  if (businessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Cargando negocios...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
