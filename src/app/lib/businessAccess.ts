export type BusinessAccess = {
  role?: string | null;
  permissions?: any;
} | null | undefined;

export function isBusinessOwner(business: BusinessAccess): boolean {
  return business?.role === 'owner' || business?.permissions?.all === true;
}

function hasPermissionBag(business: BusinessAccess): boolean {
  const perms = business?.permissions;
  return !!perms && typeof perms === 'object' && Object.keys(perms).length > 0;
}

/** Rutas a las que puede entrar un usuario según el negocio actual. */
export function canAccessPath(href: string, business: BusinessAccess): boolean {
  const path = String(href || '').split('?')[0];
  if (path === '/more') return true;
  if (!business) return path === '/sales';
  if (isBusinessOwner(business)) return true;

  if (!hasPermissionBag(business)) {
    return path === '/sales';
  }

  const perms = business.permissions || {};
  switch (path) {
    case '/sales':
      if (perms.sales?.create === true) return true;
      if (perms.sales?.create === false) return false;
      return perms.sales?.view === true;
    case '/movements':
      return perms.movements?.view === true;
    case '/products':
    case '/purchase-order':
    case '/inventory-transfer':
      return perms.products?.view === true;
    case '/contacts':
      return perms.contacts?.view === true;
    case '/employees':
      return perms.employees?.view === true;
    case '/settings':
      return perms.settings?.access === true;
    case '/catalog/settings':
      return perms.catalog?.view === true;
    default:
      return true;
  }
}

const HOME_CANDIDATES = [
  '/sales',
  '/products',
  '/movements',
  '/contacts',
  '/catalog/settings',
  '/employees',
  '/settings',
  '/more',
];

/** Primera pantalla con permiso (inventario no debe aterrizar en Vender). */
export function getHomePath(business: BusinessAccess): string {
  for (const path of HOME_CANDIDATES) {
    if (canAccessPath(path, business)) return path;
  }
  return '/more';
}
