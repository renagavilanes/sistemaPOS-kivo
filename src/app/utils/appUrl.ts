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

/** Base64 URL-safe (sin + / =) para ir en /invite/:token sin romper la ruta. */
export function encodeInviteToken(payload: object): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeInviteToken(token: string): any {
  const raw = decodeURIComponent(String(token || '').trim());
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return JSON.parse(atob(padded));
  }
}

export function buildInviteUrl(token: string): string {
  return `${getAppBaseUrl()}/invite/${encodeURIComponent(token)}`;
}
