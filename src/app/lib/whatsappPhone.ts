/**
 * Convierte un teléfono a dígitos para wa.me (internacional, sin +).
 * Ecuador: 09XXXXXXXX o 9XXXXXXXX → 5939XXXXXXXX (quita el 0 inicial nacional).
 */
export function toWhatsAppWaMeDigits(raw: string): string {
  const d = String(raw || '').replace(/[^\d]/g, '');
  if (!d) return '';

  if (d.startsWith('593') && d.length >= 11) {
    return d;
  }

  if (d.startsWith('0') && d.length >= 9 && d[1] === '9') {
    return `593${d.slice(1)}`;
  }

  if (d.length === 9 && d.startsWith('9')) {
    return `593${d}`;
  }

  if (d.length === 10 && d.startsWith('9')) {
    return `593${d}`;
  }

  return d;
}
