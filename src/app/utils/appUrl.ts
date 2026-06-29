const DEFAULT_APP_URL = 'https://kivo-produccion.vercel.app';

/** URL base de la app en producción o el origen actual en el navegador. */
export function getAppBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_APP_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return DEFAULT_APP_URL;
}

export function buildInviteUrl(token: string): string {
  return `${getAppBaseUrl()}/invite/${token}`;
}
