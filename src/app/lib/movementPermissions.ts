import type { MovementScope } from '../types';

export type MovementAccess = {
  view: boolean;
  viewScope: MovementScope;
  edit: boolean;
  editScope: MovementScope;
  delete: boolean;
  deleteScope: MovementScope;
  export: boolean;
  reports: boolean;
};

type BusinessAccess = {
  role?: string | null;
  permissions?: any;
} | null | undefined;

type MovementSeller = {
  createdBy?: string | null;
  created_by?: string | null;
} | null | undefined;

export function movementSellerId(movement: MovementSeller): string | null {
  const id = movement?.createdBy ?? movement?.created_by ?? null;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** El movimiento es suyo si el vendedor guardado es su usuario. Cambiar el vendedor lo transfiere. */
export function movementBelongsToUser(
  movement: MovementSeller,
  userId: string | null | undefined,
  businessId?: string | null,
): boolean {
  const sellerId = movementSellerId(movement);
  if (!userId || !sellerId) return false;
  if (businessId && sellerId === businessId) return false;
  return sellerId === userId;
}

function scopeOrAll(value: unknown): MovementScope {
  return value === 'own' ? 'own' : 'all';
}

export function resolveMovementAccess(business: BusinessAccess): MovementAccess {
  const isOwner = business?.role === 'owner' || business?.permissions?.all === true;
  if (isOwner) {
    return {
      view: true,
      viewScope: 'all',
      edit: true,
      editScope: 'all',
      delete: true,
      deleteScope: 'all',
      export: true,
      reports: true,
    };
  }

  const movements = business?.permissions?.movements || {};
  const view = movements.view === true;
  const viewScope: MovementScope = view && movements.viewScope === 'own' ? 'own' : 'all';
  const edit = view && movements.edit === true;
  const editScope: MovementScope = !edit || viewScope === 'own' ? 'own' : scopeOrAll(movements.editScope);
  const canDelete = view && (movements.delete === true || movements.cancel === true);
  const deleteScope: MovementScope = !canDelete || viewScope === 'own' ? 'own' : scopeOrAll(movements.deleteScope);

  return {
    view,
    viewScope: view ? viewScope : 'all',
    edit,
    editScope,
    delete: canDelete,
    deleteScope,
    export: view && movements.export === true,
    reports: view && movements.reports === true,
  };
}

export function canTouchMovement(
  allowed: boolean,
  scope: MovementScope,
  movement: MovementSeller,
  userId: string | null | undefined,
  businessId?: string | null,
): boolean {
  if (!allowed) return false;
  if (scope === 'all') return true;
  return movementBelongsToUser(movement, userId, businessId);
}
