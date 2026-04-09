import { ShoppingCart, BarChart3, Package, MoreHorizontal, ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { BusinessSwitcher } from './BusinessSwitcher';

const mobileNavigation = [
  { name: 'Vender', icon: ShoppingCart, href: '/sales' },
  { name: 'Movimientos', icon: BarChart3, href: '/movements' },
  { name: 'Productos', icon: Package, href: '/products' },
  { name: 'Más', icon: MoreHorizontal, href: '/more' },
];

export function SidebarSimple() {
  const location = useLocation();

  return (
    <>
      {/* Business Switcher en la parte superior */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b shadow-sm px-4 py-3">
        <BusinessSwitcher />
      </div>

      {/* Navegación inferior */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg">
        <nav className="flex items-center justify-around px-2 py-2">
          {mobileNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className="flex flex-col items-center justify-center gap-1 px-2 py-2 flex-1 text-gray-600 transition-colors hover:text-gray-900"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                    isActive ? 'bg-[#272B36] text-white shadow-sm' : 'bg-transparent'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                </span>
                <span
                  className={`text-[10px] ${isActive ? 'font-semibold text-[#272B36]' : 'font-medium'}`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}