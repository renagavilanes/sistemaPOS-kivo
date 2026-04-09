import { ShoppingCart, BarChart3, Package, MoreHorizontal, Settings, BookUser, Users, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBusiness } from '../contexts/BusinessContext';
import { Button } from './ui/button';
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { BusinessSwitcher } from './BusinessSwitcher';
import { BrandLogo } from './BrandLogo';

// Navegación para desktop (todas las opciones)
const desktopNavigation = [
  { name: 'Vender', icon: ShoppingCart, href: '/sales' },
  { name: 'Movimientos', icon: BarChart3, href: '/movements' },
  { name: 'Productos', icon: Package, href: '/products' },
  { name: 'Contactos', icon: BookUser, href: '/contacts' },
  { name: 'Empleados', icon: Users, href: '/employees' },
  { name: 'Configuración', icon: Settings, href: '/settings' },
];

// Navegación para móvil (solo 4 tabs principales)
const mobileNavigation = [
  { name: 'Vender', icon: ShoppingCart, href: '/sales' },
  { name: 'Movimientos', icon: BarChart3, href: '/movements' },
  { name: 'Productos', icon: Package, href: '/products' },
  { name: 'Más', icon: MoreHorizontal, href: '/more' },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { currentBusiness: business } = useBusiness();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);

  // Filtrar navegación basada en permisos
  const getFilteredNavigation = (navItems: any[]) => {
    if (!business) return navItems;
    
    // Si es el dueño o tiene permiso "all", ve todo
    if (business.role === 'owner' || business.permissions?.all === true) return navItems;
    
    // Si es empleado sin permisos definidos aún, mostrar solo vender y productos por defecto
    const perms = business.permissions || {};
    const hasNoPermissions = !business.permissions || Object.keys(perms).length === 0;
    
    if (hasNoPermissions) {
      // Sin permisos explícitos: acceso mínimo solo a ventas
      console.log('⚠️ Empleado sin permisos explícitos, acceso mínimo');
      return navItems.filter(item => ['/sales', '/more'].includes(item.href));
    }
    
    return navItems.filter(item => {
      switch (item.href) {
        case '/sales':
          if (perms.sales?.create === false) return false;
          return perms.sales?.view !== false;
        case '/movements':
          return perms.movements?.view === true || perms.movements?.view !== false;
        case '/products':
          return perms.products?.view === true;
        case '/contacts':
          return perms.contacts?.view === true; // Solo visible si tiene permiso de ver
        case '/employees':
          return perms.employees?.view === true;
        case '/settings':
          return perms.settings?.access === true;
        case '/more':
          return true;
        default:
          return true;
      }
    });
  };

  const currentDesktopNav = getFilteredNavigation(desktopNavigation);
  const currentMobileNav = getFilteredNavigation(mobileNavigation);

  // Debug: ver qué datos tiene el business
  useEffect(() => {
    console.log('🔍 Sidebar - Business actualizado:', {
      name: business?.name,
      id: business?.id,
      logo: business?.logo ? `${business.logo.substring(0, 50)}...` : null,
      logo_url: (business as any)?.logo_url ? `${(business as any).logo_url.substring(0, 50)}...` : null,
      loadedAt: (business as any)?._loadedAt,
      fullBusinessKeys: business ? Object.keys(business) : []
    });
  }, [business]);

  const handleSignOut = async () => {
    await signOut();
    // Asegura una salida consistente: volver a Login (no /auth -> register).
    window.location.href = '/login';
  };

  const DesktopNavLinks = () => (
    <nav className="space-y-0.5">
      {currentDesktopNav.map((item) => {
        const isActive = location.pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            to={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile Bottom Navigation */}
      {/* Ocultar en páginas de Contactos, Empleados y Configuración */}
      {!['/contacts', '/employees', '/settings'].includes(location.pathname) && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg">
          <nav className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
            {currentMobileNav.map((item) => {
              // Para el tab "Más", considerarlo activo si estamos en contacts, employees o settings
              const isMoreSection = ['/contacts', '/employees', '/settings', '/more'].includes(location.pathname);
              const isActive = item.href === '/more' 
                ? isMoreSection 
                : location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className="flex flex-col items-center justify-center gap-1 px-2 py-2 min-w-0 flex-1 text-gray-600 transition-colors hover:text-gray-900 active:opacity-90"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      isActive
                        ? 'bg-[#272B36] text-white shadow-sm'
                        : 'bg-transparent'
                    }`}
                  >
                    <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'stroke-[2.5]' : ''}`} />
                  </span>
                  <span
                    className={`text-[10px] leading-none truncate max-w-full ${
                      isActive ? 'font-semibold text-[#272B36]' : 'font-medium'
                    }`}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-[240px] lg:border-r lg:bg-white">
        {/* Logo */}
        <div className="flex items-center justify-start px-3 py-3 border-b">
          <BrandLogo
            className="w-full justify-start"
            iconClassName="h-10 w-[158px] max-w-none object-left"
          />
        </div>

        {/* Business Switcher */}
        <div className="border-b px-2 py-3">
          <BusinessSwitcher />
        </div>

        {/* Navigation */}
        <div className="flex-1 px-2 py-3 overflow-y-auto">
          <DesktopNavLinks />
        </div>

        {/* User Menu con Cerrar Sesión */}
        <div className="border-t px-2 py-3">
          <Button 
            variant="ghost"
            onClick={() => setIsSignOutDialogOpen(true)}
            className="w-full justify-start gap-2 h-auto py-2 px-3 hover:bg-gray-50 bg-transparent text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-gray-700">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs truncate text-[#000000]">
                  {user?.email}
                </div>
              </div>
              <LogOut className="w-4 h-4 flex-shrink-0" />
            </div>
          </Button>
        </div>
      </div>

      {/* Diálogo de confirmación para cerrar sesión */}
      <AlertDialog open={isSignOutDialogOpen} onOpenChange={setIsSignOutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro que quieres cerrar sesión? Tendrás que volver a iniciar sesión para acceder al sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700"
            >
              Cerrar Sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}