import type ExcelJS from 'exceljs';

/** Coherente con exportaciones de reportes y movimientos */
export const EXCEL_MONEY_FMT = '"$"#,##0.00';

export const excelBorderThin = {
  top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
};

export const excelBorderHeader = {
  top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
};

export const EXCEL_PCT_FMT = '0.0%';

export function excelSetMoney(cell: ExcelJS.Cell, n: number): void {
  cell.value = n;
  cell.numFmt = EXCEL_MONEY_FMT;
}

export function excelSetPct(cell: ExcelJS.Cell, ratio: number): void {
  cell.value = ratio;
  cell.numFmt = EXCEL_PCT_FMT;
}
