import { jsPDF } from 'jspdf';
import { formatDate } from './date';

/** Recibo estrecho tipo ticket térmico (~80 mm ≈ 300 px a 96 dpi) */
const TICKET_WIDTH_MM = 80;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 6;
const INNER_MM = TICKET_WIDTH_MM - MARGIN_MM * 2;

/** Aire entre bloques (ticket compacto) */
const SP_AFTER_HR = 3;
const SP_LINE = 1.25;
const SP_CLIENT_LINE = 3.2;
const LOGO_COL_MM = 12;
const LOGO_GAP_MM = 1.5;

/** Marca Kivo (mismo asset que la app en `/public`) */
const KIVO_LOGO_PATH = '/branding/kivo-logo-reference.png';

/** Acentos visuales */
const COLOR_BRAND_DARK: [number, number, number] = [39, 43, 54]; // #272B36
const COLOR_ACCENT: [number, number, number] = [59, 130, 246]; // azul
const COLOR_ACCENT_SOFT: [number, number, number] = [239, 246, 255];

interface Movement {
  id: string;
  type: 'sale' | 'expense';
  date: string;
  time?: string;
  total: number;
  subtotal?: number;
  tax?: number;
  client?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientCedula?: string;
  paymentMethods?: Array<{ method: string; amount: number }>;
  status?: string;
  employee?: string;
  products?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  profit?: number;
  expenseCategory?: string;
  supplier?: string;
  supplierCedula?: string;
  notes?: string;
}

interface BusinessSettings {
  businessName: string;
  phone: string;
  address: string;
  email: string;
  logo?: string;
  /** Alias usado en Supabase / contexto de negocio */
  logo_url?: string | null;
  receiptMessage?: string;
  taxName?: string;
  taxRate?: string;
}

function normalizeBusinessSettings(s: BusinessSettings): BusinessSettings {
  const logo = (s.logo || s.logo_url || '').trim();
  return { ...s, logo: logo || undefined };
}

export interface ReceiptPdfAssets {
  /** Logo del negocio ya rasterizado (PNG) y tamaño en mm */
  businessLogo?: { dataUrl: string; wMm: number; hMm: number };
  /** Logo Kivo para el pie (PNG data URL) */
  kivoFooterLogo?: { dataUrl: string; wMm: number; hMm: number };
}

const formatCurrency = (value: number | string | undefined | null): string => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const safeNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const receiptIdLabel = (movement: Movement): string => {
  const idStr = String(movement.id ?? 'recibo');
  return idStr.replace(/[^a-zA-Z0-9-]/g, '').slice(-8).toUpperCase() || 'RECIBO';
};

const formatPaymentLabel = (method: string): string => {
  const m = String(method || '').toLowerCase();
  if (m === 'cash' || m === 'efectivo') return 'Efectivo';
  if (m === 'card' || m === 'tarjeta') return 'Tarjeta';
  if (m === 'transfer' || m === 'transferencia') return 'Transferencia';
  if (m === 'other' || m === 'otros') return 'Otros';
  return method || 'Pago';
};

/** Ajusta ancho/alto en mm manteniendo proporción */
function fitToBoxMm(nw: number, nh: number, maxWMm: number, maxHMm: number): { wMm: number; hMm: number } {
  if (nw <= 0 || nh <= 0) return { wMm: maxWMm, hMm: maxHMm };
  const ar = nw / nh;
  let wMm = maxWMm;
  let hMm = wMm / ar;
  if (hMm > maxHMm) {
    hMm = maxHMm;
    wMm = hMm * ar;
  }
  return { wMm, hMm };
}

/**
 * Carga una imagen (URL o data URL), la dibuja en canvas con object-contain
 * y devuelve PNG + dimensiones en px para calcular mm.
 */
function rasterizeImageForTicket(
  src: string,
  maxCanvasW: number,
  maxCanvasH: number,
): Promise<{ dataUrl: string; cw: number; ch: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let iw = img.naturalWidth || img.width;
        let ih = img.naturalHeight || img.height;
        if (!iw || !ih) {
          resolve(null);
          return;
        }
        const scale = Math.min(maxCanvasW / iw, maxCanvasH / ih, 1);
        const cw = Math.max(1, Math.round(iw * scale));
        const ch = Math.max(1, Math.round(ih * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve({ dataUrl: canvas.toDataURL('image/png'), cw, ch });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Carga logo del negocio (URL remota vía fetch+blob mejora CORS en canvas) */
async function prepareBusinessLogoAsset(logoSrc: string): Promise<ReceiptPdfAssets['businessLogo']> {
  let raster: Awaited<ReturnType<typeof rasterizeImageForTicket>> = null;
  if (/^https?:\/\//i.test(logoSrc)) {
    try {
      const res = await fetch(logoSrc, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        try {
          raster = await rasterizeImageForTicket(objUrl, 400, 160);
        } finally {
          URL.revokeObjectURL(objUrl);
        }
      }
    } catch {
      /* fallback abajo */
    }
  }
  if (!raster) {
    raster = await rasterizeImageForTicket(logoSrc, 400, 160);
  }
  if (raster) {
    const { wMm, hMm } = fitToBoxMm(raster.cw, raster.ch, 10, 10);
    return { dataUrl: raster.dataUrl, wMm, hMm };
  }
  return undefined;
}

/** Logo Kivo para el pie (más compacto) */
async function prepareKivoFooterAsset(): Promise<ReceiptPdfAssets['kivoFooterLogo']> {
  const path = `${KIVO_LOGO_PATH}?v=1`;
  const raster = await rasterizeImageForTicket(path, 320, 96);
  if (raster) {
    const { wMm, hMm } = fitToBoxMm(raster.cw, raster.ch, 26, 9);
    return { dataUrl: raster.dataUrl, wMm, hMm };
  }
  return undefined;
}

/** Aire antes de la franja (compartir en WhatsApp: no pegado al borde) */
const HEADER_TOP_PADDING_MM = 3;
const HEADER_STRIPE_H_MM = 1.4;
/** Separación entre la franja azul y la baseline de «RECIBO» */
const HEADER_TITLE_GAP_BELOW_STRIPE_MM = 5.8;

/** Franja superior (tras un padding blanco) */
function drawHeaderAccentStripe(doc: jsPDF) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, TICKET_WIDTH_MM, HEADER_TOP_PADDING_MM, 'F');
  doc.setFillColor(...COLOR_ACCENT);
  doc.rect(0, HEADER_TOP_PADDING_MM, TICKET_WIDTH_MM, HEADER_STRIPE_H_MM, 'F');
}

/**
 * Título del documento (visible al compartir PDF en WhatsApp u otros canales).
 * Devuelve la Y siguiente al bloque del título.
 */
function drawReceiptDocumentTitle(doc: jsPDF): number {
  const stripeBottomY = HEADER_TOP_PADDING_MM + HEADER_STRIPE_H_MM;
  const baselineY = stripeBottomY + HEADER_TITLE_GAP_BELOW_STRIPE_MM;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_BRAND_DARK);
  doc.text('RECIBO', TICKET_WIDTH_MM / 2, baselineY, { align: 'center' });
  return baselineY + 4.5;
}

/**
 * Cabecera: logo a la izquierda + nombre/tel/dirección a la derecha (si hay logo).
 * Sin logo: texto centrado con más aire.
 */
function drawBusinessHeader(doc: jsPDF, y: number, businessSettings: BusinessSettings, assets: ReceiptPdfAssets): number {
  const bizName = (businessSettings.businessName || 'Mi negocio').trim();
  const logoMaxW = 10;
  const logoMaxH = 10;

  let logoDrawn = false;
  let logoBoxH = 0;
  const logoX = MARGIN_MM;
  let textLeft = MARGIN_MM;
  let textW = INNER_MM;

  if (assets.businessLogo) {
    const { dataUrl, wMm, hMm } = assets.businessLogo;
    const scale = Math.min(logoMaxW / wMm, logoMaxH / hMm, 1);
    const dw = wMm * scale;
    const dh = hMm * scale;
    logoBoxH = dh + 1.5;
    doc.setFillColor(...COLOR_ACCENT_SOFT);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(logoX - 0.8, y - 0.4, dw + 1.6, dh + 1.6, 1, 1, 'FD');
    let ok = false;
    const formats: Array<'PNG' | 'JPEG' | 'WEBP'> = ['PNG', 'JPEG', 'WEBP'];
    for (const fmt of formats) {
      try {
        doc.addImage(dataUrl, fmt, logoX, y, dw, dh);
        ok = true;
        break;
      } catch {
        /* siguiente */
      }
    }
    if (ok) {
      logoDrawn = true;
      textLeft = MARGIN_MM + LOGO_COL_MM + LOGO_GAP_MM;
      textW = Math.max(20, TICKET_WIDTH_MM - MARGIN_MM - textLeft);
    }
  }

  if (!logoDrawn && businessSettings.logo) {
    const dw = 10;
    const dh = 7;
    logoBoxH = dh + 1.5;
    doc.setFillColor(...COLOR_ACCENT_SOFT);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(logoX - 0.8, y - 0.4, dw + 1.6, dh + 1.6, 1, 1, 'FD');
    const formats: Array<'PNG' | 'JPEG' | 'WEBP'> = ['PNG', 'JPEG', 'WEBP'];
    for (const fmt of formats) {
      try {
        doc.addImage(businessSettings.logo, fmt, logoX, y, dw, dh);
        logoDrawn = true;
        textLeft = MARGIN_MM + LOGO_COL_MM + LOGO_GAP_MM;
        textW = Math.max(20, TICKET_WIDTH_MM - MARGIN_MM - textLeft);
        break;
      } catch {
        /* siguiente */
      }
    }
  }

  let textY = y;

  if (logoDrawn) {
    const nameFs = 8.5;
    const nameLH = 3.45;
    const addrLH = 3.1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(nameFs);
    const nameLines = doc.splitTextToSize(bizName, textW);
    let blockH = nameLines.length * nameLH;
    if (businessSettings.phone) blockH += 3.45;
    if (businessSettings.address) {
      doc.setFontSize(7.5);
      const addrLines = doc.splitTextToSize(businessSettings.address, textW);
      blockH += addrLines.length * addrLH;
    }
    /** jsPDF usa baseline: el bloque “visual” queda ~1/3 por encima del primer baseline; bajamos para centrar ópticamente con el logo */
    const opticalNudge = 1.15;
    const offsetY = Math.max(0, (logoBoxH - blockH) / 2) + opticalNudge;
    textY = y + offsetY;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(nameFs);
    doc.setTextColor(...COLOR_BRAND_DARK);
    doc.text(nameLines, textLeft, textY, { align: 'left' });
    textY += nameLines.length * nameLH;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    if (businessSettings.phone) {
      doc.text(`Tel. ${businessSettings.phone}`, textLeft, textY, { align: 'left' });
      textY += 3.45;
    }
    if (businessSettings.address) {
      const addrLines = doc.splitTextToSize(businessSettings.address, textW);
      doc.text(addrLines, textLeft, textY, { align: 'left' });
      textY += addrLines.length * addrLH;
    }
    const logoBottom = y + logoBoxH;
    return Math.max(logoBottom, textY) + 2.2;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_BRAND_DARK);
  const nameLines = doc.splitTextToSize(bizName, INNER_MM);
  doc.text(nameLines, TICKET_WIDTH_MM / 2, textY, { align: 'center' });
  textY += nameLines.length * 4.8 + 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  if (businessSettings.phone) {
    doc.text(`Tel. ${businessSettings.phone}`, TICKET_WIDTH_MM / 2, textY, { align: 'center' });
    textY += SP_CLIENT_LINE;
  }
  if (businessSettings.address) {
    const addrLines = doc.splitTextToSize(businessSettings.address, INNER_MM);
    doc.text(addrLines, TICKET_WIDTH_MM / 2, textY, { align: 'center' });
    textY += addrLines.length * 3.6 + 2;
  }
  return textY + 2.5;
}

function hr(doc: jsPDF, y: number): number {
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_MM, y, TICKET_WIDTH_MM - MARGIN_MM, y);
  return y + SP_AFTER_HR;
}

function hrAccent(doc: jsPDF, y: number): number {
  doc.setDrawColor(147, 197, 253);
  doc.setLineWidth(0.45);
  doc.line(MARGIN_MM, y, TICKET_WIDTH_MM - MARGIN_MM, y);
  return y + SP_AFTER_HR;
}

function ensurePage(doc: jsPDF, y: number, minSpaceMm: number): number {
  if (y + minSpaceMm <= PAGE_HEIGHT_MM - MARGIN_MM) return y;
  doc.addPage([TICKET_WIDTH_MM, PAGE_HEIGHT_MM]);
  return MARGIN_MM;
}

function lineLeftRight(
  doc: jsPDF,
  y: number,
  left: string,
  right: string,
  fontSize = 8,
  boldLeft = false,
  boldRight = false,
): number {
  doc.setFontSize(fontSize);
  doc.setTextColor(31, 41, 55);
  const xR = TICKET_WIDTH_MM - MARGIN_MM;
  doc.setFont('helvetica', boldRight ? 'bold' : 'normal');
  doc.text(right, xR, y, { align: 'right' });
  const wR = doc.getTextWidth(right);
  const maxLeftW = INNER_MM - wR - 2;
  doc.setFont('helvetica', boldLeft ? 'bold' : 'normal');
  const lines = doc.splitTextToSize(left, maxLeftW);
  doc.text(lines, MARGIN_MM, y);
  const lh = fontSize * 0.45;
  return y + Math.max(lines.length, 1) * lh + SP_LINE;
}

function productQtyLine(doc: jsPDF, y: number, qty: number, unitPrice: number, lineTotal: number): number {
  const left = `  ${qty} x $${formatCurrency(unitPrice)}`;
  const right = `$${formatCurrency(lineTotal)}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  const xL = MARGIN_MM + 1;
  doc.text(left, xL, y);
  const wL = doc.getTextWidth(left);
  const xR = TICKET_WIDTH_MM - MARGIN_MM;
  doc.text(right, xR, y, { align: 'right' });
  const wR = doc.getTextWidth(right);
  const gapStart = xL + wL + 1;
  const gapEnd = xR - wR - 1;
  if (gapEnd > gapStart + 2) {
    doc.setFontSize(6);
    doc.setTextColor(210, 210, 210);
    let x = gapStart;
    while (x < gapEnd - 0.6) {
      doc.text('.', x, y);
      x += 1.05;
    }
  }
  return y + 5;
}

function drawKivoFooter(
  doc: jsPDF,
  y: number,
  kivo: ReceiptPdfAssets['kivoFooterLogo'],
): number {
  y += 0.5;
  doc.setFillColor(248, 250, 252);
  doc.rect(0, y, TICKET_WIDTH_MM, 19, 'F');
  doc.setDrawColor(...COLOR_ACCENT);
  doc.setLineWidth(0.45);
  doc.line(MARGIN_MM, y, TICKET_WIDTH_MM - MARGIN_MM, y);
  y += 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(100, 116, 139);
  doc.text('Documento generado automáticamente por', TICKET_WIDTH_MM / 2, y, { align: 'center' });
  y += 3.2;

  if (kivo?.dataUrl) {
    const { dataUrl, wMm, hMm } = kivo;
    const x = (TICKET_WIDTH_MM - wMm) / 2;
    try {
      doc.addImage(dataUrl, 'PNG', x, y, wMm, hMm);
    } catch {
      try {
        doc.addImage(dataUrl, 'JPEG', x, y, wMm, hMm);
      } catch {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...COLOR_BRAND_DARK);
        doc.text('Kivo', TICKET_WIDTH_MM / 2, y + 3, { align: 'center' });
      }
    }
    y += hMm + 2;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_BRAND_DARK);
    doc.text('Kivo', TICKET_WIDTH_MM / 2, y + 2, { align: 'center' });
    y += 7;
  }

  return y + 1.2;
}

export const generateReceiptPDF = (
  movement: Movement,
  businessSettingsIn: BusinessSettings,
  assets: ReceiptPdfAssets = {},
): jsPDF => {
  const businessSettings = normalizeBusinessSettings(businessSettingsIn);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [TICKET_WIDTH_MM, PAGE_HEIGHT_MM],
  });

  drawHeaderAccentStripe(doc);

  let y = drawReceiptDocumentTitle(doc);
  y = drawBusinessHeader(doc, y, businessSettings, assets);

  y = hr(doc, y + 0.35);

  const recId = receiptIdLabel(movement);
  const dateObj = new Date(movement.date);
  const formattedDate = formatDate(movement.date) || '—';
  const timeStr =
    movement.time ||
    (Number.isFinite(dateObj.getTime())
      ? dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : '—');

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  y = lineLeftRight(doc, y, 'Recibo', `#${recId}`, 8, true);
  y = lineLeftRight(doc, y, 'Fecha', formattedDate);
  y = lineLeftRight(doc, y, 'Hora', timeStr);

  if (movement.type === 'sale') {
    const st = movement.status === 'paid' ? 'Pagado' : 'Pendiente';
    y = lineLeftRight(doc, y, 'Estado', st, 8, true);
  }

  y += 0.6;
  y = hr(doc, y);

  if (movement.type === 'sale') {
    const hasName = movement.client && movement.client !== '-';
    const phone = (movement.clientPhone || '').trim();
    const email = (movement.clientEmail || '').trim();
    const cedula = (movement.clientCedula || '').trim();
    if (hasName || phone || email || cedula) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_BRAND_DARK);
      doc.text('Cliente', MARGIN_MM, y);
      y += 3.8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(55, 65, 81);
      if (hasName) {
        const nl = doc.splitTextToSize(String(movement.client), INNER_MM);
        doc.text(nl, MARGIN_MM, y);
        y += nl.length * 3.4;
      }
      if (cedula) {
        doc.text(`Cédula: ${cedula}`, MARGIN_MM, y);
        y += SP_CLIENT_LINE;
      }
      if (phone) {
        doc.text(`Tel. ${phone}`, MARGIN_MM, y);
        y += SP_CLIENT_LINE;
      }
      if (email) {
        doc.text(email, MARGIN_MM, y);
        y += SP_CLIENT_LINE;
      }
      y += 0.8;
      y = hr(doc, y);
    }
  }

  if (movement.employee && String(movement.employee).trim()) {
    y = lineLeftRight(doc, y, 'Vendedor', String(movement.employee).trim(), 8, false);
    y += 0.8;
    y = hr(doc, y);
  }

  if (movement.type === 'expense') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_BRAND_DARK);
    doc.text('Comprobante de gasto', MARGIN_MM, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    if (movement.expenseCategory) {
      y = lineLeftRight(doc, y, 'Categoría', movement.expenseCategory);
    }
    if (movement.supplier) {
      y = lineLeftRight(doc, y, 'Proveedor', movement.supplier);
    }
    if (movement.supplierCedula) {
      y = lineLeftRight(doc, y, 'Cédula', movement.supplierCedula);
    }
    if (movement.notes) {
      const nl = doc.splitTextToSize(movement.notes, INNER_MM);
      doc.text(nl, MARGIN_MM, y);
      y += nl.length * 3.2 + 2;
    }
    y = hr(doc, y);
  }

  if (movement.type === 'sale' && movement.products && movement.products.length > 0) {
    y += 0.35;
    y = ensurePage(doc, y, 28);
    const detalleBarH = 6.5;
    doc.setFillColor(...COLOR_ACCENT_SOFT);
    doc.roundedRect(MARGIN_MM - 0.5, y - 1.4, INNER_MM + 1, detalleBarH, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_BRAND_DARK);
    doc.text('Detalle', MARGIN_MM + 1.5, y + 1.85);
    y += detalleBarH + 2;

    for (const product of movement.products) {
      y = ensurePage(doc, y, 22);
      const qty = safeNumber(product.quantity, 0);
      const price = safeNumber(product.price, 0);
      const lineTotal = qty * price;
      const pname = (product.name || 'Producto').trim();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(31, 41, 55);
      const titleLines = doc.splitTextToSize(pname, INNER_MM);
      doc.text(titleLines, MARGIN_MM, y);
      y += titleLines.length * 3.9;

      y = productQtyLine(doc, y, qty, price, lineTotal);
      y += 2.6;
    }
    y = hr(doc, y);
  }

  const totalSafe = safeNumber(movement.total, 0);
  let calculatedSubtotal = totalSafe;
  let calculatedTax = 0;

  if (movement.type === 'sale') {
    const taxRate = Number(businessSettings.taxRate) || 15;
    if (movement.tax !== undefined && movement.tax !== null) {
      calculatedTax = safeNumber(movement.tax, 0);
      calculatedSubtotal = safeNumber(movement.subtotal, totalSafe - calculatedTax);
    } else if (movement.subtotal !== undefined && movement.subtotal !== null) {
      calculatedSubtotal = safeNumber(movement.subtotal, 0);
      calculatedTax = totalSafe - calculatedSubtotal;
    } else {
      calculatedSubtotal = totalSafe / (1 + taxRate / 100);
      calculatedTax = totalSafe - calculatedSubtotal;
    }
  }

  y += 0.35;
  y = ensurePage(doc, y, 32);

  if (movement.type === 'sale') {
    y = lineLeftRight(doc, y, 'Subtotal', `$${formatCurrency(calculatedSubtotal)}`);
    const taxName = businessSettings.taxName || 'IVA';
    const taxRateDisplay = businessSettings.taxRate || '15';
    y = lineLeftRight(doc, y, `${taxName} (${taxRateDisplay}%)`, `$${formatCurrency(calculatedTax)}`);
  }

  const totalFs = 9;
  const totalAmountStr = `$${formatCurrency(totalSafe)}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(totalFs);
  doc.setTextColor(...COLOR_BRAND_DARK);
  const dimTotal = doc.getTextDimensions('TOTAL', { fontSize: totalFs });
  const dimAmt = doc.getTextDimensions(totalAmountStr, { fontSize: totalFs });
  const textH = Math.max(dimTotal.h, dimAmt.h);
  const totalBoxH = Math.max(4.2, textH + 1.2);
  const totalBoxY = y;
  doc.setFillColor(...COLOR_ACCENT_SOFT);
  doc.roundedRect(MARGIN_MM - 0.5, totalBoxY, INNER_MM + 1, totalBoxH, 1, 1, 'F');
  /** Baseline por defecto: centrar tinta respecto al centro del rectángulo (~0,38×altura de línea) */
  const totalBaselineY = totalBoxY + totalBoxH / 2 + textH * 0.38;
  doc.text('TOTAL', MARGIN_MM + 1, totalBaselineY);
  doc.text(totalAmountStr, TICKET_WIDTH_MM - MARGIN_MM - 1, totalBaselineY, { align: 'right' });
  y = totalBoxY + totalBoxH + 1.2;

  y = hrAccent(doc, y + 0.4);

  let methods = movement.paymentMethods;
  if ((!methods || methods.length === 0) && movement.type === 'expense') {
    const pm = (movement as Movement & { paymentMethod?: string }).paymentMethod;
    if (pm) {
      methods = [
        {
          method: formatPaymentLabel(pm),
          amount: totalSafe,
        },
      ];
    }
  }

  if (methods && methods.length > 0) {
    y = ensurePage(doc, y, 10 + methods.length * 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_BRAND_DARK);
    doc.text('Pago', MARGIN_MM, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    for (const pm of methods) {
      const label = formatPaymentLabel(pm.method);
      y = lineLeftRight(doc, y, label, `$${formatCurrency(pm.amount)}`);
    }
    y += 0.9;
    y = hr(doc, y);
  }

  y = ensurePage(doc, y, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const thanks = (businessSettings.receiptMessage || 'Gracias por su compra').trim();
  const thanksLines = doc.splitTextToSize(thanks, INNER_MM);
  doc.text(thanksLines, TICKET_WIDTH_MM / 2, y, { align: 'center' });
  y += thanksLines.length * 3.8 + 3;

  y = drawKivoFooter(doc, y, assets.kivoFooterLogo);

  return doc;
};

export async function printReceipt(
  movement: Movement,
  businessSettingsIn: BusinessSettings,
): Promise<string> {
  const businessSettings = normalizeBusinessSettings(businessSettingsIn);
  const assets: ReceiptPdfAssets = {};

  const [kivo, biz] = await Promise.all([
    prepareKivoFooterAsset(),
    businessSettings.logo ? prepareBusinessLogoAsset(businessSettings.logo) : Promise.resolve(undefined),
  ]);

  if (kivo) assets.kivoFooterLogo = kivo;
  if (biz) assets.businessLogo = biz;

  const doc = generateReceiptPDF(movement, businessSettings, assets);
  const pdfBlob = doc.output('blob');
  return URL.createObjectURL(pdfBlob);
}

export const shareReceipt = async (movement: Movement, businessSettings: BusinessSettings): Promise<string> => {
  return printReceipt(movement, businessSettings);
};
