import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { excelBorderHeader, excelBorderThin } from './excelReportTheme';

export interface PurchaseOrderHeader {
  businessName?: string;
  providerName?: string;
  contact?: string;
  deliveryAddress?: string;
  notes?: string;
  date?: string; // YYYY-MM-DD
}

export interface PurchaseOrderItem {
  index: number; // 1-based
  name: string;
  description?: string;
  quantity: number;
  /** Idealmente PNG base64 (sin prefijo). Si no hay, dejar undefined. */
  imagePngBase64?: string;
}

function safeText(v?: string) {
  return String(v ?? '').trim();
}

function estimateWrappedLines(text: string, colWidthChars: number, maxLines = 3): number {
  const t = safeText(text);
  if (!t) return 1;
  const raw = Math.ceil(t.length / Math.max(8, colWidthChars));
  return Math.max(1, Math.min(maxLines, raw));
}

export async function exportPurchaseOrderToExcel(payload: {
  header: PurchaseOrderHeader;
  items: PurchaseOrderItem[];
}): Promise<boolean> {
  try {
    const { header, items } = payload;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pedido', {
      properties: { defaultRowHeight: 20 },
      views: [{ showGridLines: false }],
    });

    // A: #, B: Foto, C: Nombre, D: Descripción, E: Cantidad
    worksheet.columns = [
      { width: 6 },
      { width: 14 },
      { width: 34 },
      { width: 46 },
      { width: 12 },
    ];

    let r = 1;

    worksheet.mergeCells(`A${r}:E${r}`);
    const title = worksheet.getCell(`A${r}`);
    title.value = 'PEDIDO A PROVEEDOR';
    title.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(r).height = 30;
    r++;

    const businessName = safeText(header.businessName);
    const providerName = safeText(header.providerName);
    const contact = safeText(header.contact);
    const deliveryAddress = safeText(header.deliveryAddress);
    const notes = safeText(header.notes);
    const dateStr = safeText(header.date) || format(new Date(), 'yyyy-MM-dd');
    const exportedAt = format(new Date(), 'dd MMM yyyy, HH:mm', { locale: es });

    const headerLines: Array<[string, string]> = [
      ['Negocio', businessName || '-'],
      ['Proveedor', providerName || '-'],
      ['Contacto', contact || '-'],
      ['Dirección/Entrega', deliveryAddress || '-'],
      ['Fecha', dateStr],
      ['Exportado', exportedAt],
    ];

    headerLines.forEach(([k, v]) => {
      worksheet.mergeCells(`A${r}:B${r}`);
      worksheet.mergeCells(`C${r}:E${r}`);
      const ck = worksheet.getCell(`A${r}`);
      ck.value = k;
      ck.font = { size: 11, bold: true, color: { argb: 'FF111827' } };
      ck.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      ck.alignment = { horizontal: 'left', vertical: 'middle' };
      ck.border = excelBorderThin;
      const cv = worksheet.getCell(`C${r}`);
      cv.value = v;
      const isPrimary = k === 'Proveedor' || k === 'Negocio';
      cv.font = isPrimary
        ? { size: 12, bold: true, color: { argb: 'FF111827' } }
        : { size: 11, color: { argb: 'FF111827' } };
      cv.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      cv.border = excelBorderThin;
      worksheet.getRow(r).height = isPrimary ? 24 : 22;
      r++;
    });

    if (notes) {
      worksheet.mergeCells(`A${r}:B${r}`);
      worksheet.mergeCells(`C${r}:E${r}`);
      const ck = worksheet.getCell(`A${r}`);
      ck.value = 'Notas';
      ck.font = { size: 10, bold: true, color: { argb: 'FF374151' } };
      ck.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      ck.alignment = { horizontal: 'left', vertical: 'top' };
      ck.border = excelBorderThin;

      const cv = worksheet.getCell(`C${r}`);
      cv.value = notes;
      cv.font = { size: 10, color: { argb: 'FF111827' } };
      cv.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      cv.border = excelBorderThin;
      worksheet.getRow(r).height = 18 * Math.min(4, estimateWrappedLines(notes, 46, 4));
      r++;
    }

    r++; // spacer

    const headerRowNum = r;
    const headers = ['#', 'Foto', 'Nombre', 'Descripción', 'Cantidad'];
    const headerRow = worksheet.getRow(r);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      cell.border = excelBorderHeader;
      cell.alignment = { horizontal: i === 4 || i === 0 ? 'center' : 'left', vertical: 'middle' };
    });
    headerRow.height = 22;
    r++;

    // Rows with images
    for (const item of items) {
      const rowNum = r;
      const row = worksheet.getRow(rowNum);
      row.getCell(1).value = item.index;
      row.getCell(3).value = item.name;
      row.getCell(4).value = safeText(item.description);
      row.getCell(5).value = item.quantity;
      row.getCell(5).numFmt = '0';

      for (let col = 1; col <= 5; col++) {
        const cell = row.getCell(col);
        cell.border = excelBorderThin;
        cell.alignment = {
          horizontal: col === 1 || col === 5 ? 'center' : 'left',
          vertical: 'top',
          wrapText: col === 3 || col === 4,
        };
        if (col === 3) cell.font = { size: 10, bold: true, color: { argb: 'FF111827' } };
        else cell.font = { size: 10, color: { argb: 'FF111827' } };
      }

      const nameLines = estimateWrappedLines(item.name, 34, 3);
      const descLines = estimateWrappedLines(item.description || '', 46, 3);
      const textLines = Math.max(nameLines, descLines);
      // Espacio mínimo para miniatura + wrap 2–3 filas
      row.height = Math.max(56, 18 * textLines + 20);

      if (item.imagePngBase64) {
        const imgId = workbook.addImage({
          base64: item.imagePngBase64,
          extension: 'png',
        });
        // Place inside column B at this row (ExcelJS uses 0-based indices)
        worksheet.addImage(imgId, {
          tl: { col: 1 + 0.1, row: (rowNum - 1) + 0.15 },
          ext: { width: 48, height: 48 },
          editAs: 'oneCell',
        } as any);
      }

      r++;
    }

    // Sin "freeze panes": Excel dibuja una línea gruesa que parece un borde suelto (p. ej. en la fila 10).
    worksheet.views = [{ showGridLines: false }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Pedido_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Error exporting purchase order to Excel:', error);
    return false;
  }
}

