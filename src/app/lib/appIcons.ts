const KIVO_FAVICON = '/favicon.png';
const KIVO_FAVICON_ICO = '/favicon.ico';
const KIVO_APPLE = '/apple-touch-icon.png';

function upsertIconLink(
  id: string,
  rel: string,
  href: string,
  attrs: Record<string, string> = {},
) {
  const prev = document.getElementById(id);
  if (prev) prev.remove();
  const el = document.createElement('link');
  el.id = id;
  el.setAttribute('rel', rel);
  el.href = href;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.head.appendChild(el);
}

function removeIconLink(id: string) {
  document.getElementById(id)?.remove();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Recorte centrado a PNG cuadrado (favicon / acceso directo). */
async function rasterizeSquare(src: string, size: number): Promise<string | null> {
  const img = await loadImage(src);
  if (!img || !img.width || !img.height) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function applyKivoAppIcons() {
  upsertIconLink('app-favicon-png', 'icon', KIVO_FAVICON, { type: 'image/png', sizes: '32x32' });
  upsertIconLink('app-favicon-ico', 'icon', KIVO_FAVICON_ICO, { type: 'image/x-icon' });
  upsertIconLink('app-shortcut-icon', 'shortcut icon', KIVO_FAVICON, { type: 'image/png' });
  upsertIconLink('app-apple-touch', 'apple-touch-icon', KIVO_APPLE);
}

export async function applyBusinessAppIcons(
  logoSrc: string | null | undefined,
  isCancelled?: () => boolean,
): Promise<void> {
  const src = (logoSrc || '').trim();
  if (!src) {
    if (!isCancelled?.()) applyKivoAppIcons();
    return;
  }

  const [favicon, apple] = await Promise.all([
    rasterizeSquare(src, 64),
    rasterizeSquare(src, 180),
  ]);
  if (isCancelled?.()) return;

  const href = favicon || apple;
  if (!href) {
    applyKivoAppIcons();
    return;
  }

  removeIconLink('app-favicon-ico');
  upsertIconLink('app-favicon-png', 'icon', href, { type: 'image/png', sizes: '32x32' });
  upsertIconLink('app-shortcut-icon', 'shortcut icon', href, { type: 'image/png' });
  upsertIconLink('app-apple-touch', 'apple-touch-icon', apple || href);
}
