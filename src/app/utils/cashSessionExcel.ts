import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CashBreakdown, CashLine } from '../lib/cashSession';
import { excelBorderHeader, excelBorderThin, excelSetMoney } from './excelReportTheme';

type DownloadInput = {
  employeeName: string;
  openedAt: string;
  closedAt: string | null;
  comment: string;
  breakdown: CashBreakdown;
  countedAmount: number | null;
  difference: number | null;
};

const LAST_COL = 6;

const sectionFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF374151' } };
const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE5E7EB' } };
const kpiLabelFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF3F4F6' } };
const emphasizeFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF0FDF4' } };

function stamp(iso: string | null): string {
  if (!iso) return 'Abierta';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return format(date, 'dd MMM yyyy, HH:mm', { locale: es });
}

function verdict(difference: number | null): { label: string; color: string } {
  if (difference == null) return { label: 'DIFERENCIA', color: 'FF6B7280' };
  if (difference < 0) return { label: 'FALTANTE', color: 'FFDC2626' };
  if (difference > 0) return { label: 'SOBRANTE', color: 'FFD97706' };
  return { label: 'CUADRA', color: 'FF059669' };
}

function paintMerged(
  sheet: ExcelJS.Worksheet,
  row: number,
  from: number,
  to: number,
  value: string,
  font: Partial<ExcelJS.Font>,
  fill: ExcelJS.Fill,
  height: number,
  alignment: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle' },
) {
  sheet.mergeCells(row, from, row, to);
  const cell = sheet.getCell(row, from);
  cell.value = value;
  cell.font = font;
  cell.fill = fill;
  cell.alignment = alignment;
  sheet.getRow(row).height = height;
  return cell;
}

function sectionTitle(sheet: ExcelJS.Worksheet, row: number, title: string): number {
  const cell = paintMerged(
    sheet,
    row,
    1,
    LAST_COL,
    title,
    { size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
    sectionFill,
    24,
  );
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  return row + 1;
}

function tableHeader(sheet: ExcelJS.Worksheet, row: number, labels: Array<{ from: number; to: number; text: string; align?: 'left' | 'right' }>): number {
  for (const label of labels) {
    if (label.to > label.from) sheet.mergeCells(row, label.from, row, label.to);
    const cell = sheet.getCell(row, label.from);
    cell.value = label.text;
    cell.font = { bold: true, size: 10 };
    cell.fill = headerFill;
    cell.border = excelBorderHeader;
    cell.alignment = { horizontal: label.align ?? 'left', vertical: 'middle' };
  }
  for (let col = 1; col <= LAST_COL; col++) {
    const cell = sheet.getCell(row, col);
    cell.font = { bold: true, size: 10 };
    cell.fill = headerFill;
    cell.border = excelBorderHeader;
  }
  sheet.getRow(row).height = 22;
  return row + 1;
}

function textMoneyRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  label: string,
  amount: number | null,
  note: string,
  options: { emphasize?: boolean; zebra?: boolean; amountColor?: string } = {},
): number {
  sheet.mergeCells(row, 1, row, 3);
  sheet.mergeCells(row, 5, row, LAST_COL);
  const labelCell = sheet.getCell(row, 1);
  labelCell.value = label;
  labelCell.font = { size: 10, bold: !!options.emphasize, color: { argb: 'FF1F2937' } };
  labelCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const amountCell = sheet.getCell(row, 4);
  if (amount == null) {
    amountCell.value = '—';
    amountCell.font = { size: 10, color: { argb: 'FF9CA3AF' } };
    amountCell.alignment = { horizontal: 'right', vertical: 'middle' };
  } else {
    excelSetMoney(amountCell, amount);
    amountCell.font = {
      size: 10,
      bold: true,
      color: { argb: options.amountColor ?? 'FF111827' },
    };
    amountCell.alignment = { horizontal: 'right', vertical: 'middle' };
  }

  const noteCell = sheet.getCell(row, 5);
  noteCell.value = note;
  noteCell.font = { size: 9, color: { argb: 'FF6B7280' } };
  noteCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const fill = options.emphasize
    ? emphasizeFill
    : options.zebra
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFAFAFA' } }
      : undefined;
  for (let col = 1; col <= LAST_COL; col++) {
    const cell = sheet.getCell(row, col);
    cell.border = excelBorderThin;
    if (fill) cell.fill = fill;
  }
  sheet.getRow(row).height = 21;
  return row + 1;
}

function lineRows(sheet: ExcelJS.Worksheet, row: number, lines: CashLine[], emptyLabel: string): number {
  if (lines.length === 0) {
    sheet.mergeCells(row, 1, row, 2);
    sheet.mergeCells(row, 3, row, 4);
    sheet.mergeCells(row, 5, row, LAST_COL);
    const cell = sheet.getCell(row, 3);
    cell.value = emptyLabel;
    cell.font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getCell(row, 1).value = '—';
    sheet.getCell(row, 1).font = { size: 10, color: { argb: 'FF9CA3AF' } };
    sheet.getCell(row, 5).value = '—';
    sheet.getCell(row, 5).font = { size: 10, color: { argb: 'FF9CA3AF' } };
    sheet.getCell(row, 5).alignment = { horizontal: 'right', vertical: 'middle' };
    for (let col = 1; col <= LAST_COL; col++) sheet.getCell(row, col).border = excelBorderThin;
    sheet.getRow(row).height = 21;
    return row + 1;
  }
  lines.forEach((line, index) => {
    sheet.mergeCells(row, 1, row, 2);
    sheet.mergeCells(row, 3, row, 4);
    sheet.mergeCells(row, 5, row, LAST_COL);
    const dateCell = sheet.getCell(row, 1);
    dateCell.value = line.createdAt ? stamp(line.createdAt) : '—';
    dateCell.font = { size: 10, bold: true, color: { argb: 'FF111827' } };
    dateCell.alignment = { horizontal: 'left', vertical: 'middle' };
    const labelCell = sheet.getCell(row, 3);
    labelCell.value = line.label;
    labelCell.font = { size: 10, color: { argb: 'FF1F2937' } };
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
    const amountCell = sheet.getCell(row, 5);
    excelSetMoney(amountCell, line.amount);
    amountCell.font = { size: 10, bold: true, color: { argb: 'FF111827' } };
    amountCell.alignment = { horizontal: 'right', vertical: 'middle' };
    const zebra = index % 2 === 1
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFAFAFA' } }
      : undefined;
    for (let col = 1; col <= LAST_COL; col++) {
      const cell = sheet.getCell(row, col);
      cell.border = excelBorderThin;
      if (zebra) cell.fill = zebra;
    }
    sheet.getRow(row).height = 21;
    row += 1;
  });
  return row;
}

function dateBlock(sheet: ExcelJS.Worksheet, row: number, from: number, to: number, label: string, value: string) {
  sheet.mergeCells(row, from, row, to);
  const labelCell = sheet.getCell(row, from);
  labelCell.value = label;
  labelCell.font = { size: 9, bold: true, color: { argb: 'FF6B7280' } };
  labelCell.fill = kpiLabelFill;
  labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
  for (let col = from; col <= to; col++) {
    sheet.getCell(row, col).fill = kpiLabelFill;
    sheet.getCell(row, col).border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  }
  const valueRow = row + 1;
  sheet.mergeCells(valueRow, from, valueRow, to);
  const valueCell = sheet.getCell(valueRow, from);
  valueCell.value = value;
  valueCell.font = { size: 12, bold: true, color: { argb: 'FF111827' } };
  valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
  for (let col = from; col <= to; col++) {
    sheet.getCell(valueRow, col).border = {
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  }
}

function kpiBlock(
  sheet: ExcelJS.Worksheet,
  row: number,
  from: number,
  to: number,
  label: string,
  amount: number | null,
  color: string,
) {
  sheet.mergeCells(row, from, row, to);
  const labelCell = sheet.getCell(row, from);
  labelCell.value = label;
  labelCell.font = { size: 9, bold: true, color: { argb: 'FF6B7280' } };
  labelCell.fill = kpiLabelFill;
  labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
  labelCell.border = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  };
  for (let col = from; col <= to; col++) {
    sheet.getCell(row, col).fill = kpiLabelFill;
    sheet.getCell(row, col).border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  }

  const valueRow = row + 1;
  sheet.mergeCells(valueRow, from, valueRow, to);
  const valueCell = sheet.getCell(valueRow, from);
  if (amount == null) {
    valueCell.value = '—';
    valueCell.font = { size: 18, bold: true, color: { argb: color } };
  } else {
    excelSetMoney(valueCell, amount);
    valueCell.font = { size: 18, bold: true, color: { argb: color } };
  }
  valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
  valueCell.border = {
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  };
  for (let col = from; col <= to; col++) {
    sheet.getCell(valueRow, col).border = {
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  }
}

export function buildCashSessionWorkbook(input: DownloadInput): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Caja', {
    properties: { defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  sheet.columns = [
    { width: 16 },
    { width: 14 },
    { width: 18 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
  ];

  let row = 1;
  paintMerged(
    sheet,
    row,
    1,
    LAST_COL,
    'CIERRE DE CAJA',
    { size: 16, bold: true, color: { argb: 'FFFFFFFF' } },
    { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } },
    28,
    { horizontal: 'center', vertical: 'middle' },
  );
  row += 1;

  paintMerged(
    sheet,
    row,
    1,
    LAST_COL,
    input.employeeName,
    { size: 12, bold: true, color: { argb: 'FF111827' } },
    { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } },
    22,
    { horizontal: 'center', vertical: 'middle' },
  );
  row += 2;

  dateBlock(sheet, row, 1, 3, 'DESDE', stamp(input.openedAt));
  dateBlock(sheet, row, 4, 6, 'HASTA', input.closedAt ? stamp(input.closedAt) : 'Abierta');
  sheet.getRow(row).height = 20;
  sheet.getRow(row + 1).height = 22;
  row += 3;

  const result = verdict(input.difference);
  kpiBlock(sheet, row, 1, 2, 'DEBERÍA CUADRAR', input.breakdown.expected, 'FF111827');
  kpiBlock(sheet, row, 3, 4, 'HAY EN CAJA', input.countedAmount, 'FF111827');
  kpiBlock(
    sheet,
    row,
    5,
    6,
    result.label,
    input.difference == null ? null : Math.abs(input.difference),
    result.color,
  );
  sheet.getRow(row).height = 20;
  sheet.getRow(row + 1).height = 30;
  row += 3;

  row = sectionTitle(sheet, row, 'RESUMEN DE CAJA');
  row = tableHeader(sheet, row, [
    { from: 1, to: 3, text: 'Concepto' },
    { from: 4, to: 4, text: 'Valor', align: 'right' },
    { from: 5, to: 6, text: 'Notas' },
  ]);
  row = textMoneyRow(sheet, row, 'Se dejó', input.breakdown.openingAmount, 'Efectivo al abrir');
  row = textMoneyRow(sheet, row, 'Ventas en efectivo', input.breakdown.cashSalesTotal, 'Entran a la caja', { zebra: true });
  row = textMoneyRow(sheet, row, 'Gastos en efectivo', -input.breakdown.cashExpensesTotal, 'Salen de la caja');
  row = textMoneyRow(sheet, row, 'Debería cuadrar', input.breakdown.expected, 'Se dejó + ventas − gastos', { emphasize: true });
  row += 1;

  row = sectionTitle(sheet, row, 'VENTAS EN EFECTIVO');
  row = tableHeader(sheet, row, [
    { from: 1, to: 2, text: 'Fecha' },
    { from: 3, to: 4, text: 'Concepto' },
    { from: 5, to: 6, text: 'Importe', align: 'right' },
  ]);
  row = lineRows(sheet, row, input.breakdown.cashSales, 'Ninguna venta en efectivo');
  row += 1;

  row = sectionTitle(sheet, row, 'GASTOS EN EFECTIVO');
  row = tableHeader(sheet, row, [
    { from: 1, to: 2, text: 'Fecha' },
    { from: 3, to: 4, text: 'Concepto' },
    { from: 5, to: 6, text: 'Importe', align: 'right' },
  ]);
  row = lineRows(sheet, row, input.breakdown.cashExpenses, 'Ningún gasto en efectivo');
  row += 1;

  row = sectionTitle(sheet, row, 'FUERA DE LA CAJA');
  row = tableHeader(sheet, row, [
    { from: 1, to: 2, text: 'Fecha' },
    { from: 3, to: 3, text: 'Medio' },
    { from: 4, to: 4, text: 'Concepto' },
    { from: 5, to: 6, text: 'Importe', align: 'right' },
  ]);
  const outside: Array<{ method: string; lines: CashLine[] }> = [
    { method: 'Tarjeta', lines: input.breakdown.card },
    { method: 'Transferencia', lines: input.breakdown.transfer },
  ];
  let outsideIndex = 0;
  for (const group of outside) {
    if (group.lines.length === 0) {
      sheet.mergeCells(row, 1, row, 2);
      sheet.mergeCells(row, 5, row, 6);
      sheet.getCell(row, 1).value = '—';
      sheet.getCell(row, 1).font = { size: 10, color: { argb: 'FF9CA3AF' } };
      sheet.getCell(row, 3).value = group.method;
      sheet.getCell(row, 3).font = { size: 10, color: { argb: 'FF1F2937' } };
      sheet.getCell(row, 4).value = 'Ninguno';
      sheet.getCell(row, 4).font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
      excelSetMoney(sheet.getCell(row, 5), 0);
      sheet.getCell(row, 5).font = { size: 10, color: { argb: 'FF9CA3AF' } };
      sheet.getCell(row, 5).alignment = { horizontal: 'right', vertical: 'middle' };
      for (let col = 1; col <= LAST_COL; col++) {
        sheet.getCell(row, col).border = excelBorderThin;
        sheet.getCell(row, col).alignment = {
          horizontal: col >= 5 ? 'right' : 'left',
          vertical: 'middle',
        };
      }
      sheet.getRow(row).height = 21;
      row += 1;
      outsideIndex += 1;
      continue;
    }
    for (const line of group.lines) {
      sheet.mergeCells(row, 1, row, 2);
      sheet.mergeCells(row, 5, row, 6);
      const dateCell = sheet.getCell(row, 1);
      dateCell.value = line.createdAt ? stamp(line.createdAt) : '—';
      dateCell.font = { size: 10, bold: true, color: { argb: 'FF111827' } };
      sheet.getCell(row, 3).value = group.method;
      sheet.getCell(row, 3).font = { size: 10, color: { argb: 'FF1F2937' } };
      sheet.getCell(row, 4).value = line.label;
      sheet.getCell(row, 4).font = { size: 10, color: { argb: 'FF1F2937' } };
      excelSetMoney(sheet.getCell(row, 5), line.amount);
      sheet.getCell(row, 5).font = { size: 10, bold: true, color: { argb: 'FF111827' } };
      const zebra = outsideIndex % 2 === 1
        ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFAFAFA' } }
        : undefined;
      for (let col = 1; col <= LAST_COL; col++) {
        const cell = sheet.getCell(row, col);
        cell.border = excelBorderThin;
        cell.alignment = { horizontal: col >= 5 ? 'right' : 'left', vertical: 'middle' };
        if (zebra) cell.fill = zebra;
      }
      sheet.getRow(row).height = 21;
      row += 1;
      outsideIndex += 1;
    }
  }
  row += 1;

  const comment = input.comment.trim();
  if (comment) {
    row = sectionTitle(sheet, row, 'COMENTARIO');
    sheet.mergeCells(row, 1, row, LAST_COL);
    const cell = sheet.getCell(row, 1);
    cell.value = comment;
    cell.font = { size: 10, color: { argb: 'FF1F2937' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cell.border = excelBorderThin;
    for (let col = 1; col <= LAST_COL; col++) sheet.getCell(row, col).border = excelBorderThin;
    sheet.getRow(row).height = Math.min(60, 18 + Math.ceil(comment.length / 70) * 16);
  }

  return workbook;
}

export async function downloadCashSessionExcel(input: DownloadInput): Promise<void> {
  const workbook = buildCashSessionWorkbook(input);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = input.employeeName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'caja';
  link.href = url;
  link.download = `Caja_${safeName}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
}
