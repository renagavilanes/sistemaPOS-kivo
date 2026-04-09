/**
 * Cabeceras de tablas del panel POS (productos, movimientos, contactos, empleados).
 * Tono intermedio: oscuro pero no tan pesado como #272B36; texto blanco con buen contraste.
 */
const headerBg = 'bg-slate-600';
const headerBorder = 'border-b border-slate-500/90';

export const dataTableTheadSticky = `${headerBg} ${headerBorder} sticky top-0 z-10 shadow-sm`;

export const dataTableThead = `${headerBg} ${headerBorder} shadow-sm`;

export const dthLeft =
  `${headerBg} text-left px-4 py-3 text-sm font-semibold text-white`;

export const dthRight =
  `${headerBg} text-right px-4 py-3 text-sm font-semibold text-white`;

/** Columna numérica o compacta (ej. ganancia en productos) */
export const dthRightTight =
  `${headerBg} text-right px-2 py-3 text-sm font-semibold text-white`;

export const dthCenter =
  `${headerBg} text-center px-4 py-3 text-sm font-semibold text-white`;

/** Movimientos: cabeceras en mayúsculas y un poco más densas */
export const dthMovement =
  `${headerBg} px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white`;
