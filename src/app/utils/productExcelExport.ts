import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  excelBorderHeader,
  excelBorderThin,
  excelSetMoney,
  excelSetPct,
} from './excelReportTheme';

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  image?: string;
}

/** Columnas A–F (producto … margen); Stock va en G:I fusionado para alinear con el KPI superior */
const DATA_LAST_COL = 6;

export const exportProductsToExcel = async (
  filteredProducts: Product[],
  filterInfo: {
    searchTerm: string;
    category: string;
    sortOption: string | null;
  },
): Promise<boolean> => {
  try {
    const totalReferences = filteredProducts.length;
    const totalInventoryCost = filteredProducts.reduce((sum, p) => sum + p.cost * p.stock, 0);
    const totalInventoryValue = filteredProducts.reduce((sum, p) => sum + p.price * p.stock, 0);
    const totalPotentialProfit = totalInventoryValue - totalInventoryCost;
    const totalStockUnits = filteredProducts.reduce((sum, p) => sum + p.stock, 0);

    const filterLabels: string[] = [];
    if (filterInfo.searchTerm) {
      filterLabels.push(`Búsqueda: "${filterInfo.searchTerm}"`);
    }
    if (filterInfo.category !== 'Todas') {
      filterLabels.push(`Categoría: ${filterInfo.category}`);
    }
    if (filterInfo.sortOption) {
      const sortLabels: Record<string, string> = {
        'stock-low': 'Menos stock',
        'stock-high': 'Más stock',
        'sales-low': 'Menos vendidos',
        'sales-high': 'Más vendidos',
        'name-asc': 'Nombre A-Z',
        'name-desc': 'Nombre Z-A',
        'date-old': 'Más antiguo',
        'date-new': 'Más reciente',
        'price-low': 'Precio más bajo',
        'price-high': 'Precio más alto',
      };
      filterLabels.push(`Orden: ${sortLabels[filterInfo.sortOption] ?? filterInfo.sortOption}`);
    }

    const filterLine =
      filterLabels.length > 0 ? filterLabels.join(' · ') : 'Productos y existencias';

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventario', {
      properties: { defaultRowHeight: 20 },
      views: [{ showGridLines: false }],
    });

    worksheet.columns = [
      { width: 34 },
      { width: 18 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 11 },
      { width: 9 },
      { width: 2 },
      { width: 2 },
    ];
    // Bloque G:I fusionado: ancho suficiente para KPI y Stock (evita ####)
    worksheet.getColumn(7).width = 16;

    let currentRow = 1;

    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = 'INVENTARIO';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 28;
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const periodCell = worksheet.getCell(`A${currentRow}`);
    periodCell.value = filterLine;
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

    const kLabel = {
      font: { size: 9, bold: true, color: { argb: 'FF6B7280' } },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF3F4F6' } },
      alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
    };

    const kpiBorderTop = {
      top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    };
    const kpiBorderVal = {
      left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    };

    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    const b1 = worksheet.getCell(`A${currentRow}`);
    b1.value = 'COSTO TOTAL INVENTARIO';
    b1.font = kLabel.font;
    b1.fill = kLabel.fill;
    b1.alignment = kLabel.alignment;
    b1.border = kpiBorderTop;

    worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
    const b2 = worksheet.getCell(`D${currentRow}`);
    b2.value = 'VALOR TOTAL INVENTARIO';
    b2.font = kLabel.font;
    b2.fill = kLabel.fill;
    b2.alignment = kLabel.alignment;
    b2.border = kpiBorderTop;

    worksheet.mergeCells(`G${currentRow}:I${currentRow}`);
    const b3 = worksheet.getCell(`G${currentRow}`);
    b3.value = 'GANANCIA POTENCIAL';
    b3.font = kLabel.font;
    b3.fill = kLabel.fill;
    b3.alignment = kLabel.alignment;
    b3.border = kpiBorderTop;
    worksheet.getRow(currentRow).height = 20;
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    const v1 = worksheet.getCell(`A${currentRow}`);
    excelSetMoney(v1, totalInventoryCost);
    v1.font = { size: 18, bold: true, color: { argb: 'FF111827' } };
    v1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    v1.alignment = { horizontal: 'left', vertical: 'middle' };
    v1.border = kpiBorderVal;

    worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
    const v2 = worksheet.getCell(`D${currentRow}`);
    excelSetMoney(v2, totalInventoryValue);
    v2.font = { size: 18, bold: true, color: { argb: 'FF111827' } };
    v2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    v2.alignment = { horizontal: 'left', vertical: 'middle' };
    v2.border = kpiBorderVal;

    worksheet.mergeCells(`G${currentRow}:I${currentRow}`);
    const v3 = worksheet.getCell(`G${currentRow}`);
    excelSetMoney(v3, totalPotentialProfit);
    v3.font = { size: 18, bold: true, color: { argb: 'FF111827' } };
    v3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    v3.alignment = { horizontal: 'left', vertical: 'middle' };
    v3.border = kpiBorderVal;
    worksheet.getRow(currentRow).height = 30;
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const summaryCell = worksheet.getCell(`A${currentRow}`);
    summaryCell.value = `Referencias: ${totalReferences}  ·  Unidades en stock: ${totalStockUnits}`;
    summaryCell.font = { size: 10, bold: true, color: { argb: 'FF4B5563' } };
    summaryCell.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 20;
    currentRow++;

    currentRow++;

    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const secTitle = worksheet.getCell(`A${currentRow}`);
    secTitle.value = 'DETALLE DE PRODUCTOS';
    secTitle.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    secTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    secTitle.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 24;
    currentRow++;

    const headers = ['Producto', 'Categoría', 'Precio', 'Costo', 'Ganancia', 'Margen %'];
    const headerRow = worksheet.getRow(currentRow);
    const headerRowNum = currentRow;
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      cell.border = excelBorderHeader;
      cell.alignment = {
        horizontal: i >= 2 && i <= 5 ? 'right' : 'left',
        vertical: 'middle',
      };
    });
    worksheet.mergeCells(`G${headerRowNum}:I${headerRowNum}`);
    const stockHeader = worksheet.getCell(`G${headerRowNum}`);
    stockHeader.value = 'Stock';
    stockHeader.font = { bold: true, size: 10 };
    stockHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    stockHeader.border = excelBorderHeader;
    stockHeader.alignment = { horizontal: 'right', vertical: 'middle' };
    headerRow.height = 22;
    currentRow++;

    filteredProducts.forEach((product, index) => {
      const row = worksheet.getRow(currentRow);
      const zebra = index % 2 === 1 ? 'FFFAFAFA' : 'FFFFFFFF';
      const profit = product.price - product.cost;
      const marginOnCost = product.cost > 0 ? profit / product.cost : 0;

      row.getCell(1).value = product.name;
      row.getCell(2).value = product.category;
      excelSetMoney(row.getCell(3), product.price);
      excelSetMoney(row.getCell(4), product.cost);
      excelSetMoney(row.getCell(5), profit);
      excelSetPct(row.getCell(6), marginOnCost);

      const rowNum = currentRow;
      worksheet.mergeCells(`G${rowNum}:I${rowNum}`);
      const stockCell = worksheet.getCell(`G${rowNum}`);
      stockCell.value = product.stock;
      stockCell.numFmt = '0';

      const stockZero = product.stock === 0;
      const stockLow = product.stock > 0 && product.stock < 5;

      for (let col = 1; col <= DATA_LAST_COL; col++) {
        const cell = row.getCell(col);
        cell.border = excelBorderThin;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
        cell.alignment = {
          horizontal: col >= 3 && col <= 6 ? 'right' : 'left',
          vertical: 'middle',
        };
        if (col === 1) {
          cell.font = { size: 10, color: { argb: 'FF1F2937' } };
        } else if (col === 2) {
          cell.font = { size: 9, color: { argb: 'FF6B7280' } };
        } else if (col >= 3 && col <= 5) {
          cell.font = { size: 10, bold: true, color: { argb: 'FF111827' } };
        } else if (col === 6) {
          cell.font = { size: 10, color: { argb: 'FF374151' } };
        }
      }

      stockCell.border = excelBorderThin;
      stockCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
      stockCell.alignment = { horizontal: 'right', vertical: 'middle' };
      stockCell.font = { size: 10, bold: true, color: { argb: 'FF111827' } };

      /** Semaforización solo en Stock (celda fusionada G:I), no en Margen % */
      if (stockZero) {
        stockCell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFCA5A5' } };
        stockCell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (stockLow) {
        stockCell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFEF3C7' } };
        stockCell.font = { size: 10, bold: true, color: { argb: 'FF92400E' } };
      }

      row.height = 21;
      currentRow++;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Inventario_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return false;
  }
};
