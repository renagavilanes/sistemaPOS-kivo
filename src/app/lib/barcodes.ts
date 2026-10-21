/** Hasta 3 códigos por producto, guardados en la columna `barcode` que ya viaja en el listado. */

export const MAX_BARCODES_PER_PRODUCT = 3;
const MAX_BARCODE_LENGTH = 64;

export function normalizeBarcode(value?: string | null) {
  return String(value ?? '').replace(/\s+/g, '').trim();
}

export function parseBarcodes(raw?: string | null): string[] {
  const text = String(raw ?? '').trim();
  if (!text) return [];
  const codes: string[] = [];
  for (const part of text.split('|')) {
    const code = normalizeBarcode(part);
    if (!code || codes.includes(code)) continue;
    codes.push(code);
    if (codes.length === MAX_BARCODES_PER_PRODUCT) break;
  }
  return codes;
}

export function barcodesFromProduct(product: { barcode?: string | null; barcodes?: string[] | null }) {
  if (Array.isArray(product.barcodes) && product.barcodes.length > 0) {
    return parseBarcodes(product.barcodes.join('|'));
  }
  return parseBarcodes(product.barcode);
}

export function collectBarcodes(inputs: string[]): { codes: string[]; error?: string } {
  const codes: string[] = [];
  for (const input of inputs) {
    const code = normalizeBarcode(input);
    if (!code) continue;
    if (code.includes('|')) {
      return { codes: [], error: 'El código no puede incluir el carácter |' };
    }
    if (code.length > MAX_BARCODE_LENGTH) {
      return { codes: [], error: 'El código es demasiado largo' };
    }
    if (!codes.includes(code)) codes.push(code);
  }
  if (codes.length > MAX_BARCODES_PER_PRODUCT) {
    return { codes: [], error: 'Un producto puede tener hasta 3 códigos' };
  }
  return { codes };
}

/** Un solo código se guarda tal cual. Varios, separados por |, en el mismo campo. */
export function serializeBarcodes(codes: string[]): string | null {
  if (codes.length === 0) return null;
  return codes.join('|');
}

export function isFastScan(length: number, elapsedMs: number, maxGapMs = 80) {
  if (length < 4) return false;
  if (length === 1) return true;
  return elapsedMs / (length - 1) <= maxGapMs;
}

/** Ráfaga de lector sin Enter. Un tecleo humano no sostiene estos intervalos. */
export function isIdleScan(length: number, elapsedMs: number) {
  if (length < 5) return false;
  const avg = elapsedMs / (length - 1);
  return avg <= 35;
}

export type BarcodeLookup<T> =
  | { status: 'empty' }
  | { status: 'missing' }
  | { status: 'ambiguous' }
  | { status: 'found'; product: T };

export function indexBarcodes<T extends { barcodes?: string[] | null }>(products: T[]) {
  const index = new Map<string, T[]>();
  for (const product of products) {
    for (const code of product.barcodes || []) {
      const list = index.get(code);
      if (list) list.push(product);
      else index.set(code, [product]);
    }
  }
  return index;
}

export function lookupBarcode<T>(index: Map<string, T[]>, raw: string): BarcodeLookup<T> {
  const code = normalizeBarcode(raw);
  if (!code) return { status: 'empty' };
  const hits = index.get(code);
  if (!hits || hits.length === 0) return { status: 'missing' };
  if (hits.length > 1) return { status: 'ambiguous' };
  return { status: 'found', product: hits[0] };
}

export function barcodeUsedBy<T extends { id: string; name: string; barcodes?: string[] | null }>(
  products: T[],
  codes: string[],
  exceptId?: string,
) {
  for (const code of codes) {
    const owner = products.find((product) => product.id !== exceptId && (product.barcodes || []).includes(code));
    if (owner) return { code, name: owner.name };
  }
  return null;
}
