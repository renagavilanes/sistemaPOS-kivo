export function usableProductImageSrc(src: string | undefined | null): string {
  if (!src || typeof src !== 'string') return '';
  if (src.includes('unsplash.com')) return '';
  return src;
}

export function parseProductImage(raw: string | undefined | null): { thumb: string; full: string } {
  const s = usableProductImageSrc(raw);
  if (!s) return { thumb: '', full: '' };
  if (s.startsWith('{')) {
    try {
      const j = JSON.parse(s) as { thumb?: unknown; full?: unknown };
      const thumb = usableProductImageSrc(typeof j.thumb === 'string' ? j.thumb : '');
      const full = usableProductImageSrc(typeof j.full === 'string' ? j.full : '');
      return { thumb: thumb || full, full: full || thumb };
    } catch {
      return { thumb: s, full: s };
    }
  }
  return { thumb: s, full: s };
}

export function packProductImage(full: string, thumb?: string): string {
  const f = usableProductImageSrc(full);
  const t = usableProductImageSrc(thumb);
  if (!f) return '';
  if (!t || t === f) return f;
  return JSON.stringify({ v: 1, thumb: t, full: f });
}

export function displayProductImageSrc(raw: string | undefined | null): string {
  const parsed = parseProductImage(raw);
  return parsed.thumb || parsed.full;
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar la imagen seleccionada.'));
    };
    img.src = objectUrl;
  });

const loadImageFromSrc = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = src;
  });

async function rasterize(img: HTMLImageElement, maxDimension: number, quality: number): Promise<string> {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDimension / Math.max(width, height, 1));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('No se pudo generar la imagen optimizada.'))),
      'image/webp',
      quality,
    );
  });
  const file = new File([blob], 'product.webp', { type: 'image/webp' });
  return fileToDataUrl(file);
}

/** Foto de producto: calidad para catálogo + miniatura liviana para listados. */
export async function optimizeImageForProduct(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo seleccionado no es una imagen.');
  }
  const img = await loadImageFromFile(file);
  const full = await rasterize(img, 1280, 0.82);
  const thumb = await rasterize(img, 240, 0.62);
  return packProductImage(full, thumb);
}

export async function compactImageForThumbCache(src: string): Promise<string> {
  const display = displayProductImageSrc(src);
  if (!display) return '';
  if (!display.startsWith('data:') || display.length < 48_000) return display;
  try {
    const img = await loadImageFromSrc(display);
    return await rasterize(img, 240, 0.62);
  } catch {
    return display;
  }
}

export async function packedImageForSave(raw: string): Promise<string> {
  const parsed = parseProductImage(raw);
  if (!parsed.full) return '';
  if (parsed.thumb && parsed.thumb !== parsed.full && parsed.thumb.length < parsed.full.length) {
    return packProductImage(parsed.full, parsed.thumb);
  }
  try {
    const thumb = await compactImageForThumbCache(parsed.full);
    return packProductImage(parsed.full, thumb);
  } catch {
    return parsed.full;
  }
}
