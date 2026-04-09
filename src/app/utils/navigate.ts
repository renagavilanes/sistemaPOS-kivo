/**
 * Sistema de navegación manual usando window.location.hash
 * Reemplaza react-router para funcionar sin dependencias de routing
 */

export const useNavigate = () => {
  return (path: string) => {
    window.location.hash = path;
  };
};

export const useLocation = () => {
  const hash = window.location.hash.slice(1); // Remove the '#'
  const [pathname, search] = hash.split('?');
  
  return {
    pathname: pathname || '/',
    search: search ? `?${search}` : '',
    hash: window.location.hash,
    state: null,
    key: 'default'
  };
};

export const useParams = <T extends Record<string, string> = Record<string, string>>(): T => {
  const hash = window.location.hash.slice(1);
  const pathname = hash.split('?')[0];
  const parts = pathname.split('/').filter(Boolean);
  
  // Simple param extraction (assuming format like /invite/:token)
  // This is a basic implementation - extend as needed
  const params: Record<string, string> = {};
  
  return params as T;
};

export const navigate = (path: string) => {
  window.location.hash = path;
};