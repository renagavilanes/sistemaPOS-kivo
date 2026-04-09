import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate } from './date';
import {
  excelBorderHeader,
  excelBorderThin,
  excelSetMoney,
} from './excelReportTheme';

interface Movement {
  id: string;
  date: string;
  time?: string;
  type: 'sale' | 'expense';
  productConcept?: string;
  expenseCategory?: string;
  expenseName?: string;
  supplier?: string;
  quantity?: number;
  total: number;
  cost?: number;
  profit?: number;
  employee?: string;
  client?: string;
  paymentMethod: string;
  numPayments?: number;
  status: string;
  products?: unknown[];
}

const LAST_COL = 9;

const statusLabels: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  credit: 'Crédito',
  debt: 'Deuda',
};

function labelMovementStatus(raw: string): string {
  const s = String(raw ?? '');
  const k = s.toLowerCase();
  return statusLabels[k] ?? statusLabels[s] ?? s;
}

export const exportMovementsToExcel = async (
  filteredMovements: Movement[],
  filterLabel: string,
): Promise<boolean> => {
  try {
    const sales = filteredMovements.filter((m) => m.type === 'sale');
    const expenses = filteredMovements.filter((m) => m.type === 'expense');

    const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);
    const balance = totalSales - totalExpenses;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Movimientos', {
      properties: { defaultRowHeight: 20 },
      views: [{ showGridLines: false }],
    });

    worksheet.columns = [
      { width: 12 },
      { width: 10 },
      { width: 8 },
      { width: 38 },
      { width: 8 },
      { width: 13 },
      { width: 13 },
      { width: 16 },
      { width: 12 },
    ];

    let currentRow = 1;

    // —— Cabecera (misma línea que reportes) ——
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = 'MOVIMIENTOS';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 28;
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const periodCell = worksheet.getCell(`A${currentRow}`);
    periodCell.value = filterLabel;
    periodCell.font = { size: 11, italic: true, color: { argb: 'FF4B5563' } };
    periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 22;
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const infoCell = worksheet.getCell(`A${currentRow}`);
    infoCell.value = `Exportado: ${format(new Date(), 'dd MMM yyyy, HH:mm', { locale: es })}`;
    infoCell.font = { size: 9, color: { argb: 'FF6B7280' } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 18;
    currentRow++;

    currentRow++;

    // —— KPIs compactos (neutro, como reportes) ——
    const kLabel = {
      font: { size: 9, bold: true, color: { argb: 'FF6B7280' } },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF3F4F6' } },
      alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
    };

    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    const b1 = worksheet.getCell(`A${currentRow}`);
    b1.value = 'BALANCE (VENTAS − GASTOS)';
    b1.font = kLabel.font;
    b1.fill = kLabel.fill;
    b1.alignment = kLabel.alignment;
    b1.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };

    worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
    const b2 = worksheet.getCell(`D${currentRow}`);
    b2.value = 'VENTAS TOTALES';
    b2.font = kLabel.font;
    b2.fill = kLabel.fill;
    b2.alignment = kLabel.alignment;
    b2.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };

    worksheet.mergeCells(`G${currentRow}:I${currentRow}`);
    const b3 = worksheet.getCell(`G${currentRow}`);
    b3.value = 'GASTOS TOTALES';
    b3.font = kLabel.font;
    b3.fill = kLabel.fill;
    b3.alignment = kLabel.alignment;
    b3.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
    worksheet.getRow(currentRow).height = 20;
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    const v1 = worksheet.getCell(`A${currentRow}`);
    excelSetMoney(v1, balance);
    v1.font = { size: 18, bold: true, color: { argb: 'FF111827' } };
    v1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    v1.alignment = { horizontal: 'left', vertical: 'middle' };
    v1.border = {
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };

    worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
    const v2 = worksheet.getCell(`D${currentRow}`);
    excelSetMoney(v2, totalSales);
    v2.font = { size: 18, bold: true, color: { argb: 'FF111827' } };
    v2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    v2.alignment = { horizontal: 'left', vertical: 'middle' };
    v2.border = {
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };

    worksheet.mergeCells(`G${currentRow}:I${currentRow}`);
    const v3 = worksheet.getCell(`G${currentRow}`);
    excelSetMoney(v3, totalExpenses);
    v3.font = { size: 18, bold: true, color: { argb: 'FF111827' } };
    v3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    v3.alignment = { horizontal: 'left', vertical: 'middle' };
    v3.border = {
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
    worksheet.getRow(currentRow).height = 30;
    currentRow++;

    currentRow++;

    // —— Sección tabla ——
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const secTitle = worksheet.getCell(`A${currentRow}`);
    secTitle.value = 'DETALLE DE MOVIMIENTOS';
    secTitle.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    secTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    secTitle.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 24;
    currentRow++;

    const headers = [
      'Fecha',
      'Tipo',
      'Pagos',
      'Concepto',
      'Cant.',
      'Importe (precio venta / gasto)',
      'Ganancia',
      'Empleado',
      'Estado',
    ];
    const headerRow = worksheet.getRow(currentRow);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      cell.border = excelBorderHeader;
      cell.alignment = {
        horizontal: i === 2 || (i >= 4 && i <= 6) ? 'right' : 'left',
        vertical: 'middle',
      };
    });
    headerRow.height = 22;
    currentRow++;

    const sortedSales = [...sales].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return (b.time || '').localeCompare(a.time || '');
    });

    const sortedExpenses = [...expenses].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return (b.time || '').localeCompare(a.time || '');
    });

    const paintStatus = (cell: ExcelJS.Cell, status: string) => {
      if (status === 'Pagado') {
        cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      } else if (status === 'Deuda') {
        cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
      } else if (status === 'Pendiente') {
        cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
      } else if (status === 'Crédito') {
        cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
      }
    };

    sortedSales.forEach((movement, index) => {
      const row = worksheet.getRow(currentRow);
      const zebra = index % 2 === 1 ? 'FFFAFAFA' : 'FFFFFFFF';
      const st = labelMovementStatus(movement.status);

      row.getCell(1).value = formatDate(movement.date);
      row.getCell(2).value = 'Venta';
      row.getCell(2).font = { size: 10, bold: true, color: { argb: 'FF059669' } };
      row.getCell(3).value = movement.numPayments ?? 1;
      row.getCell(3).numFmt = '0';
      row.getCell(4).value = movement.productConcept || '';
      row.getCell(5).value = movement.quantity ?? 0;
      row.getCell(5).numFmt = '0';
      excelSetMoney(row.getCell(6), Number(movement.total) || 0);
      excelSetMoney(row.getCell(7), movement.profit ?? 0);
      row.getCell(8).value = movement.employee || '—';
      row.getCell(9).value = st;

      for (let col = 1; col <= LAST_COL; col++) {
        const cell = row.getCell(col);
        cell.border = excelBorderThin;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
        cell.alignment = {
          horizontal: col >= 5 && col <= 7 ? 'right' : col === 2 ? 'left' : 'left',
          vertical: 'middle',
        };
        if (col === 6 || col === 7) {
          cell.font = { size: 10, bold: true, color: { argb: 'FF111827' } };
        } else if (col !== 2 && col !== 9) {
          cell.font = { size: 10, color: { argb: 'FF1F2937' } };
        }
      }
      paintStatus(row.getCell(9), st);

      row.height = 21;
      currentRow++;
    });

    sortedExpenses.forEach((movement, index) => {
      const row = worksheet.getRow(currentRow);
      const zebra = (sortedSales.length + index) % 2 === 1 ? 'FFFAFAFA' : 'FFFFFFFF';
      const st = labelMovementStatus(movement.status);

      row.getCell(1).value = formatDate(movement.date);
      row.getCell(2).value = 'Gasto';
      row.getCell(2).font = { size: 10, bold: true, color: { argb: 'FFDC2626' } };
      row.getCell(3).value = '—';
      row.getCell(4).value = movement.expenseName || movement.productConcept || '';
      row.getCell(5).value = movement.quantity ?? 1;
      row.getCell(5).numFmt = '0';
      excelSetMoney(row.getCell(6), movement.total);
      row.getCell(7).value = '—';
      row.getCell(8).value = movement.employee || '—';
      row.getCell(9).value = st;

      for (let col = 1; col <= LAST_COL; col++) {
        const cell = row.getCell(col);
        cell.border = excelBorderThin;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
        cell.alignment = {
          horizontal: col >= 5 && col <= 7 ? 'right' : 'left',
          vertical: 'middle',
        };
        if (col === 6) {
          cell.font = { size: 10, bold: true, color: { argb: 'FF111827' } };
        } else if (col !== 2 && col !== 9 && col !== 7) {
          cell.font = { size: 10, color: { argb: 'FF1F2937' } };
        }
        if (col === 7) {
          cell.font = { size: 10, color: { argb: 'FF9CA3AF' } };
        }
      }
      paintStatus(row.getCell(9), st);

      row.height = 21;
      currentRow++;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Movimientos_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return false;
  }
};
