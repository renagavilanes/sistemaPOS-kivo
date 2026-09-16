export type MatchableProduct = {
  id: string;
  name: string;
  barcode?: string;
};

export type MatchKind = 'barcode' | 'name' | 'weak' | 'none';

export function normalizeName(text: string) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeBarcode(barcode?: string | null) {
  return String(barcode || '').replace(/\s+/g, '').trim();
}

function bigrams(text: string) {
  const s = text.replace(/\s+/g, '');
  if (s.length < 2) return s ? [s] : [];
  const grams: string[] = [];
  for (let i = 0; i < s.length - 1; i += 1) grams.push(s.slice(i, i + 2));
  return grams;
}

function diceCoefficient(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aa = bigrams(a);
  const bb = bigrams(b);
  if (!aa.length || !bb.length) return 0;
  const counts = new Map<string, number>();
  for (const g of aa) counts.set(g, (counts.get(g) || 0) + 1);
  let hits = 0;
  for (const g of bb) {
    const n = counts.get(g) || 0;
    if (n > 0) {
      counts.set(g, n - 1);
      hits += 1;
    }
  }
  return (2 * hits) / (aa.length + bb.length);
}

function nameSimilarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  let score = diceCoefficient(a, b);
  if (a.includes(b) || b.includes(a)) score = Math.max(score, 0.82);
  return score;
}

export function suggestDestProduct(from: MatchableProduct, destCatalog: MatchableProduct[]): { product: MatchableProduct | null; kind: MatchKind } {
  const bar = normalizeBarcode(from.barcode);
  if (bar) {
    const hit = destCatalog.find((p) => normalizeBarcode(p.barcode) === bar);
    if (hit) return { product: hit, kind: 'barcode' };
  }

  const fromName = normalizeName(from.name);
  if (!fromName || destCatalog.length === 0) return { product: null, kind: 'none' };

  let best: Product | null = null;
  let bestScore = 0;
  let second = 0;
  for (const p of destCatalog) {
    const s = nameSimilarity(fromName, normalizeName(p.name));
    if (s > bestScore) {
      second = bestScore;
      bestScore = s;
      best = p;
    } else if (s > second) {
      second = s;
    }
  }

  if (!best) return { product: null, kind: 'none' };
  if (bestScore >= 0.86 && bestScore - second >= 0.05) return { product: best, kind: 'name' };
  if (bestScore >= 0.62) return { product: best, kind: 'weak' };
  return { product: null, kind: 'none' };
}
