/** Quita tildes y pasa a minúsculas para buscar: tripode = trípode. */
export function normalizeSearchText(text: string | null | undefined): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function searchTextMatches(haystack: string | null | undefined, needle: string): boolean {
  const q = normalizeSearchText(needle).trim();
  if (!q) return true;
  return normalizeSearchText(haystack).includes(q);
}
