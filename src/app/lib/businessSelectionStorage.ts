/** ID del negocio activo en esta pestaña/sesión (también usado por api.ts). */
export const CURRENT_BUSINESS_ID_KEY = 'currentBusinessId';

/** Último negocio elegido por cuenta; sobrevive al cierre de sesión. */
export function lastBusinessIdKeyForUser(userId: string): string {
  return `kivo_lastBusinessForUser_${userId}`;
}

/**
 * Prioridad: clave de sesión (si existe), luego preferencia por usuario.
 */
export function getSavedBusinessIdForUser(userId: string | undefined): string | null {
  const sessionId = localStorage.getItem(CURRENT_BUSINESS_ID_KEY);
  if (sessionId) return sessionId;
  if (userId) return localStorage.getItem(lastBusinessIdKeyForUser(userId));
  return null;
}

export function persistCurrentBusinessId(userId: string | undefined, businessId: string): void {
  localStorage.setItem(CURRENT_BUSINESS_ID_KEY, businessId);
  if (userId) {
    localStorage.setItem(lastBusinessIdKeyForUser(userId), businessId);
  }
}

/** Quitar puntero activo (sin borrar la preferencia por usuario). */
export function clearSessionBusinessId(): void {
  localStorage.removeItem(CURRENT_BUSINESS_ID_KEY);
}

/** Antes de cerrar sesión: guardar el negocio activo como preferencia de esta cuenta. */
export function snapshotSessionBusinessAsUserPreference(userId: string): void {
  const bid = localStorage.getItem(CURRENT_BUSINESS_ID_KEY);
  if (bid) {
    localStorage.setItem(lastBusinessIdKeyForUser(userId), bid);
  }
}
