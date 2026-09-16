/**
 * Format currency in Spanish format
 * - No decimals: 1.200 (omits ,00)
 * - With decimals: 1.200,50 (uses comma for decimals, dot for thousands)
 * 
 * @param value - The numeric value to format
 * @param decimals - Optional number of decimal places (default: auto-detect)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, decimals?: number): string {
  // Handle undefined, null, or NaN values
  const numValue = Number(value) || 0;
  
  // If decimals parameter is provided, use specific decimal places
  if (decimals !== undefined) {
    const formatted = numValue.toFixed(decimals);
    const [integer, decimal] = formatted.split('.');
    const integerWithDots = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    if (decimals === 0 || decimal === '00') {
      return integerWithDots;
    }
    return `${integerWithDots},${decimal}`;
  }
  
  // Auto-detect: format to 2 decimals first
  const formatted = numValue.toFixed(2);
  const [integer, decimal] = formatted.split('.');
  const integerWithDots = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // If the value has no decimals (ends in .00), omit them
  if (decimal === '00') {
    return integerWithDots;
  }
  
  // Otherwise, show decimals with comma
  return `${integerWithDots},${decimal}`;
}

/**
 * Acepta 3,94 y 3.94 (y 1.234,50). El teclado y type=number del navegador
 * suelen rechazar la coma y el campo queda vacío.
 */
export function parseLocaleNumber(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  const t = String(raw ?? '').trim().replace(/\s/g, '').replace(/\$/g, '');
  if (!t || t === '-' || t === ',' || t === '.') return NaN;

  let normalized: string;
  if (t.includes(',') && t.includes('.')) {
    const lastComma = t.lastIndexOf(',');
    const lastDot = t.lastIndexOf('.');
    if (lastComma > lastDot) {
      normalized = t.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = t.replace(/,/g, '');
    }
  } else if (t.includes(',')) {
    normalized = t.replace(/,/g, '.');
  } else {
    normalized = t;
  }

  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}