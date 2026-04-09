import { FileText, TrendingUp, DollarSign, ShoppingCart, Percent, CreditCard, X, Download } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { useState } from 'react';
import { formatCurrency } from '../utils/currency';
import {
  excelBorderHeader,
  excelBorderThin,
  excelSetMoney,
  excelSetPct,
} from '../utils/excelReportTheme';

interface PaymentMethod {
  method: string;
  count: number;
  total: number;
}

interface Collaborator {
  name: string;
  salesCount: number;
  salesTotal: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface ReportsData {
  salesCount: number;
  salesTotal: number;
  expensesTotal: number;
  netProfit: number;
  productsCost: number;
  averageTicket: number;
  profitMargin: number;
  paymentMethods: PaymentMethod[];
  collaborators: Collaborator[];
  topProducts: TopProduct[];
}

interface ReportsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReportsData;
  filterLabel: string;
}

export function ReportsSheet({ open, onOpenChange, data, filterLabel }: ReportsSheetProps) {
  const [productSortBy, setProductSortBy] = useState<'quantity' | 'revenue'>('revenue');
  
  const {
    salesCount,
    salesTotal,
    expensesTotal,
    netProfit,
    productsCost,
    averageTicket,
    profitMargin,
    paymentMethods,
    collaborators,
    topProducts
  } = data;

  const balance = salesTotal - expensesTotal;

  // Export to Excel function
  const exportToExcel = async () => {
    try {
      const ExcelJS = await import('exceljs');

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reporte General', {
        properties: { defaultRowHeight: 20 },
        views: [{ showGridLines: false }],
      });

      worksheet.columns = [
        { width: 30 },
        { width: 16 },
        { width: 14 },
        { width: 14 },
        { width: 12 },
      ];

      let currentRow = 1;

      // ==================== CABECERA ====================
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
      const titleCell = worksheet.getCell(`A${currentRow}`);
      titleCell.value = 'REPORTE DE VENTAS Y GESTIÓN';
      titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(currentRow).height = 28;
      currentRow++;

      worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
      const periodCell = worksheet.getCell(`A${currentRow}`);
      periodCell.value = filterLabel;
      periodCell.font = { size: 11, italic: true, color: { argb: 'FF4B5563' } };
      periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(currentRow).height = 22;
      currentRow++;

      // Una sola fila de separación (sin bloques vacíos grandes)
      currentRow++;

      // ==================== KPIs (compacto) ====================
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      let metricCell = worksheet.getCell(`A${currentRow}`);
      metricCell.value = 'VENTAS (transacciones)';
      metricCell.font = { size: 9, bold: true, color: { argb: 'FF6B7280' } };
      metricCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      metricCell.alignment = { horizontal: 'left', vertical: 'middle' };
      metricCell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };

      worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
      metricCell = worksheet.getCell(`D${currentRow}`);
      metricCell.value = 'TICKET PROMEDIO';
      metricCell.font = { size: 9, bold: true, color: { argb: 'FF6B7280' } };
      metricCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      metricCell.alignment = { horizontal: 'left', vertical: 'middle' };
      metricCell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      worksheet.getRow(currentRow).height = 20;
      currentRow++;

      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      const salesCountCell = worksheet.getCell(`A${currentRow}`);
      salesCountCell.value = salesCount;
      salesCountCell.font = { size: 20, bold: true, color: { argb: 'FF111827' } };
      salesCountCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      salesCountCell.alignment = { horizontal: 'left', vertical: 'middle' };
      salesCountCell.numFmt = '0';
      salesCountCell.border = {
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };

      worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
      const ticketCell = worksheet.getCell(`D${currentRow}`);
      excelSetMoney(ticketCell, averageTicket);
      ticketCell.font = { size: 20, bold: true, color: { argb: 'FF111827' } };
      ticketCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      ticketCell.alignment = { horizontal: 'left', vertical: 'middle' };
      ticketCell.border = {
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      worksheet.getRow(currentRow).height = 32;
      currentRow++;

      currentRow++;

      // ==================== RESUMEN FINANCIERO (una tabla, números reales) ====================
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
      const summaryTitle = worksheet.getCell(`A${currentRow}`);
      summaryTitle.value = 'RESUMEN FINANCIERO';
      summaryTitle.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      summaryTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
      summaryTitle.alignment = { horizontal: 'left', vertical: 'middle' };
      worksheet.getRow(currentRow).height = 24;
      currentRow++;

      const tableHeader = worksheet.getRow(currentRow);
      tableHeader.getCell(1).value = 'Concepto';
      tableHeader.getCell(2).value = 'Valor';
      worksheet.mergeCells(`C${currentRow}:E${currentRow}`);
      tableHeader.getCell(3).value = 'Notas';

      tableHeader.height = 22;
      for (let col = 1; col <= 5; col++) {
        const c = tableHeader.getCell(col);
        c.font = { bold: true, size: 10 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
        c.border = excelBorderHeader;
        c.alignment = {
          vertical: 'middle',
          horizontal: col === 1 ? 'left' : col === 2 ? 'right' : 'left',
        };
      }
      currentRow++;

      type SummaryRow = {
        label: string;
        amount?: number;
        note?: string;
        emphasize?: boolean;
        pct?: number;
      };

      const summaryRows: SummaryRow[] = [
        { label: 'Ventas totales', amount: salesTotal },
        { label: 'Costo de productos', amount: productsCost },
        { label: 'Gastos', amount: expensesTotal },
        { label: 'Ganancia neta', amount: netProfit, emphasize: true },
        { label: 'Balance (ventas − gastos)', amount: balance, note: balance >= 0 ? 'Positivo' : 'Negativo' },
        {
          label: 'Margen sobre ventas (neto)',
          pct: salesTotal > 0 ? profitMargin / 100 : 0,
          note: 'Sobre ventas del periodo',
        },
      ];

      summaryRows.forEach((sr, idx) => {
        const row = worksheet.getRow(currentRow);
        worksheet.mergeCells(`C${currentRow}:E${currentRow}`);

        row.getCell(1).value = sr.label;
        row.getCell(1).font = { size: 10, bold: !!sr.emphasize };
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

        if (sr.amount !== undefined) {
          excelSetMoney(row.getCell(2), sr.amount);
          row.getCell(2).font = { size: 10, bold: !!sr.emphasize };
          row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
          row.getCell(3).value = sr.note ?? '';
          row.getCell(3).font = { size: 9, color: { argb: 'FF6B7280' } };
          row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        } else if (sr.pct !== undefined) {
          excelSetPct(row.getCell(2), sr.pct);
          row.getCell(2).font = { size: 10, bold: false };
          row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
          row.getCell(3).value = sr.note ?? '';
          row.getCell(3).font = { size: 9, color: { argb: 'FF6B7280' } };
          row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        }

        const fill = sr.emphasize
          ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF0FDF4' } }
          : idx % 2 === 1
            ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFAFAFA' } }
            : undefined;

        for (let col = 1; col <= 5; col++) {
          const cell = row.getCell(col);
          cell.border = excelBorderThin;
          if (fill) cell.fill = fill;
        }
        row.height = 21;
        currentRow++;
      });

      currentRow++;

      // ==================== MÉTODOS DE PAGO ====================
      if (paymentMethods.length > 0) {
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const pmHeader = worksheet.getCell(`A${currentRow}`);
        pmHeader.value = 'MÉTODOS DE PAGO';
        pmHeader.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        pmHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
        pmHeader.alignment = { horizontal: 'left', vertical: 'middle' };
        worksheet.getRow(currentRow).height = 24;
        currentRow++;

        const pmHeaderRow = worksheet.getRow(currentRow);
        pmHeaderRow.getCell(1).value = 'Método';
        pmHeaderRow.getCell(2).value = 'Transacciones';
        pmHeaderRow.getCell(3).value = 'Total';
        pmHeaderRow.getCell(4).value = '% del Total';

        worksheet.mergeCells(`D${currentRow}:E${currentRow}`);

        pmHeaderRow.height = 22;
        const pmHeaderFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE5E7EB' } };
        for (let col = 1; col <= 5; col++) {
          const c = pmHeaderRow.getCell(col);
          c.font = { bold: true, size: 10 };
          c.fill = pmHeaderFill;
          c.alignment = { horizontal: 'left', vertical: 'middle' };
          c.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        }
        currentRow++;

        paymentMethods.forEach((pm) => {
          const ratio = salesTotal > 0 ? pm.total / salesTotal : 0;
          const row = worksheet.getRow(currentRow);
          row.getCell(1).value = pm.method;
          row.getCell(2).value = pm.count;
          row.getCell(2).numFmt = '0';
          excelSetMoney(row.getCell(3), pm.total);
          worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
          excelSetPct(row.getCell(4), ratio);

          row.getCell(1).font = { size: 10 };
          row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
          row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
          row.getCell(3).font = { size: 10, bold: true };
          row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
          row.getCell(4).font = { size: 10 };
          row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
          row.height = 21;

          for (let col = 1; col <= 5; col++) {
            row.getCell(col).border = excelBorderThin;
          }
          currentRow++;
        });

        currentRow++;
      }

      // ==================== TOP VENDEDORES ====================
      if (collaborators && collaborators.length > 0) {
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const collabHeader = worksheet.getCell(`A${currentRow}`);
        collabHeader.value = 'TOP VENDEDORES';
        collabHeader.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        collabHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
        collabHeader.alignment = { horizontal: 'left', vertical: 'middle' };
        worksheet.getRow(currentRow).height = 24;
        currentRow++;

        const collabHeaderRow = worksheet.getRow(currentRow);
        collabHeaderRow.getCell(1).value = 'Vendedor';
        collabHeaderRow.getCell(2).value = 'Ventas';
        collabHeaderRow.getCell(3).value = 'Total';
        collabHeaderRow.getCell(4).value = '% del Total';

        worksheet.mergeCells(`D${currentRow}:E${currentRow}`);

        collabHeaderRow.height = 22;
        const collabHeaderFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE5E7EB' } };
        for (let col = 1; col <= 5; col++) {
          const c = collabHeaderRow.getCell(col);
          c.font = { bold: true, size: 10 };
          c.fill = collabHeaderFill;
          c.alignment = { horizontal: 'left', vertical: 'middle' };
          c.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        }
        currentRow++;

        collaborators.forEach((collab) => {
          const ratio = salesTotal > 0 ? collab.salesTotal / salesTotal : 0;
          const row = worksheet.getRow(currentRow);
          row.getCell(1).value = collab.name;
          row.getCell(2).value = collab.salesCount;
          row.getCell(2).numFmt = '0';
          excelSetMoney(row.getCell(3), collab.salesTotal);
          worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
          excelSetPct(row.getCell(4), ratio);

          row.getCell(1).font = { size: 10 };
          row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
          row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
          row.getCell(3).font = { size: 10, bold: true };
          row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
          row.getCell(4).font = { size: 10 };
          row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
          row.height = 21;

          for (let col = 1; col <= 5; col++) {
            row.getCell(col).border = excelBorderThin;
          }
          currentRow++;
        });

        currentRow++;
      }

      // ==================== PRODUCTOS MÁS VENDIDOS ====================
      if (topProducts && topProducts.length > 0) {
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const prodHeader = worksheet.getCell(`A${currentRow}`);
        prodHeader.value = 'PRODUCTOS MÁS VENDIDOS';
        prodHeader.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        prodHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
        prodHeader.alignment = { horizontal: 'left', vertical: 'middle' };
        worksheet.getRow(currentRow).height = 24;
        currentRow++;

        const prodHeaderRow = worksheet.getRow(currentRow);
        prodHeaderRow.getCell(1).value = 'Producto';
        prodHeaderRow.getCell(2).value = 'Cantidad';
        prodHeaderRow.getCell(3).value = 'Ingresos';
        prodHeaderRow.getCell(4).value = '% del Total';

        worksheet.mergeCells(`D${currentRow}:E${currentRow}`);

        prodHeaderRow.height = 22;
        const prodHeaderFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE5E7EB' } };
        for (let col = 1; col <= 5; col++) {
          const c = prodHeaderRow.getCell(col);
          c.font = { bold: true, size: 10 };
          c.fill = prodHeaderFill;
          c.alignment = { horizontal: 'left', vertical: 'middle' };
          c.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        }
        currentRow++;

        topProducts.forEach((product) => {
          const ratio = salesTotal > 0 ? product.revenue / salesTotal : 0;
          const row = worksheet.getRow(currentRow);
          row.getCell(1).value = product.name;
          row.getCell(2).value = product.quantity;
          row.getCell(2).numFmt = '0';
          excelSetMoney(row.getCell(3), product.revenue);
          worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
          excelSetPct(row.getCell(4), ratio);

          row.getCell(1).font = { size: 10 };
          row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
          row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
          row.getCell(3).font = { size: 10, bold: true };
          row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
          row.getCell(4).font = { size: 10 };
          row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
          row.height = 21;

          for (let col = 1; col <= 5; col++) {
            row.getCell(col).border = excelBorderThin;
          }
          currentRow++;
        });
      }

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with date
      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
      link.download = `Reporte_${dateStr}.xlsx`;
      
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      alert('Error al exportar el reporte. Por favor intenta nuevamente.');
    }
  };

  // Sort products based on selected tab
  const sortedProducts = [...topProducts].sort((a, b) => {
    if (productSortBy === 'quantity') {
      return b.quantity - a.quantity;
    }
    return b.revenue - a.revenue;
  });

  // Get payment method icon
  const getPaymentIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'efectivo':
        return '💵';
      case 'tarjeta':
        return '💳';
      case 'transferencia':
        return '🏦';
      case 'otros':
        return '📝';
      default:
        return '💰';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 max-w-[100vw]">
        <SheetHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-3 sm:pb-4 border-b">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
              </div>
              <div>
                <SheetTitle className="text-lg sm:text-xl">Reportes</SheetTitle>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{filterLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportToExcel}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors flex-shrink-0"
                aria-label="Exportar a Excel"
                title="Exportar a Excel"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 sm:w-5 sm:h-5 text-gray-500" />
              </button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-3 sm:px-6 py-3 sm:py-6 overflow-x-hidden">
          <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
            
            {/* Primera fila: Ventas y Ticket Promedio */}
            <div className="grid grid-cols-2 gap-3 min-w-0">
              <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-4 h-4 text-gray-600" />
                  <p className="text-xs text-gray-600">Ventas</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">{salesCount}</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                  <p className="text-xs text-gray-600">Ticket promedio</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">${formatCurrency(averageTicket, 0)}</p>
              </div>
            </div>

            <Separator />

            {/* Ganancia Neta - Destacado */}
            <div className="bg-gray-900 rounded-xl p-2.5 sm:p-4 overflow-hidden max-w-full">
              <div className="flex flex-row items-center justify-between gap-2 mb-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <TrendingUp className="w-5 h-5 text-white shrink-0" />
                  <p className="text-sm font-semibold text-white">Ganancia Neta</p>
                </div>
                <p className="text-xl sm:text-3xl font-bold text-white break-words max-w-full overflow-hidden">${formatCurrency(netProfit)}</p>
              </div>
              
              <div className="space-y-1.5 text-[11px] sm:text-sm overflow-hidden min-w-0">
                <div className="flex justify-between items-center text-gray-300 gap-2">
                  <span className="shrink-0">Ventas totales</span>
                  <span className="font-semibold text-white text-right break-words max-w-[60%]">${formatCurrency(salesTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-300 gap-2">
                  <span className="shrink-0">Costo de productos</span>
                  <span className="font-semibold text-white text-right break-words max-w-[60%]">-${formatCurrency(productsCost)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-300 gap-2">
                  <span className="shrink-0">Gastos</span>
                  <span className="font-semibold text-white text-right break-words max-w-[60%]">-${formatCurrency(expensesTotal)}</span>
                </div>
              </div>

              {/* Análisis contextual */}
              <div className="mt-3 pt-3 border-t border-white/10 w-full">
                <p className="text-xs text-gray-400 leading-relaxed w-full" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word', maxWidth: '100%' }}>
                  {(() => {
                    const margin = salesTotal > 0 ? ((salesTotal - productsCost) / salesTotal) * 100 : 0;
                    const expenseRatio = salesTotal > 0 ? (expensesTotal / salesTotal) * 100 : 0;
                    const profitRatio = salesTotal > 0 ? (netProfit / salesTotal) * 100 : 0;
                    const grossProfit = salesTotal - productsCost;
                    
                    // Caso 1: Sin actividad registrada
                    if (salesTotal === 0 && expensesTotal === 0 && productsCost === 0) {
                      return '📊 Sin actividad registrada. Comienza a registrar ventas y gastos para obtener análisis.';
                    }
                    
                    // Caso 2: Sin ventas pero hay gastos
                    if (salesTotal === 0 && expensesTotal > 0) {
                      return `⚠️ Tienes gastos de $${formatCurrency(expensesTotal)} sin ventas registradas. Necesitas generar ingresos para cubrir estos gastos.`;
                    }
                    
                    // Caso 3: Pérdidas porque los gastos son mayores que la utilidad bruta
                    if (netProfit < 0 && expensesTotal > grossProfit && grossProfit > 0) {
                      const excessExpense = expensesTotal - grossProfit;
                      const targetExpense = grossProfit * 0.7; // objetivo: gastos al 70% de utilidad bruta
                      const needToReduce = expensesTotal - targetExpense;
                      return `⚠️ Tu utilidad bruta de $${formatCurrency(grossProfit)} no cubre los gastos de $${formatCurrency(expensesTotal)}. Reduce gastos en $${formatCurrency(needToReduce)} o aumenta ventas en $${formatCurrency(excessExpense)}.`;
                    }
                    
                    // Caso 4: Pérdidas por margen negativo o muy bajo
                    if (netProfit < 0 && margin <= 0) {
                      const minPrice = productsCost * 1.4; // margen objetivo del 40%
                      return `🔴 Vendes a pérdida: costo $${formatCurrency(productsCost)} vs ventas $${formatCurrency(salesTotal)}. Ajusta precios a mínimo $${formatCurrency(minPrice)} para un margen saludable del 40%.`;
                    }
                    
                    // Caso 5: Pérdidas con margen bajo
                    if (netProfit < 0 && margin > 0 && margin < 20) {
                      const neededSales = (productsCost + expensesTotal) / 0.6; // margen objetivo 40%
                      const salesIncrease = neededSales - salesTotal;
                      return `⚠️ Margen insuficiente (${formatCurrency(margin, 1)}%). Aumenta ventas en $${formatCurrency(salesIncrease)} manteniendo costos, o sube precios un ${formatCurrency((salesIncrease/salesTotal)*100, 0)}%.`;
                    }
                    
                    // Caso 6: Punto de equilibrio (ganancia muy baja)
                    if (netProfit >= 0 && profitRatio < 5 && profitRatio > 0) {
                      const targetProfit = salesTotal * 0.15; // objetivo 15%
                      const needToImprove = targetProfit - netProfit;
                      const optionA = expensesTotal * 0.3; // reducir gastos 30%
                      const optionB = needToImprove / margin * 100; // vender más
                      return `📍 Ganancia de solo ${formatCurrency(profitRatio, 1)}%. Para llegar a 15% necesitas: reducir gastos $${formatCurrency(optionA)} o vender $${formatCurrency(optionB)} adicionales.`;
                    }
                    
                    // Caso 7: Ganancia positiva pero margen de producto muy ajustado
                    if (netProfit > 0 && margin > 0 && margin < 25) {
                      const currentAvgPrice = salesTotal / salesCount;
                      const targetPrice = currentAvgPrice * 1.15; // aumentar 15%
                      const potentialExtraProfit = (salesTotal * 0.15);
                      return `💡 Tu margen es ${formatCurrency(margin, 1)}%. Aumentando precios de $${formatCurrency(currentAvgPrice)} a $${formatCurrency(targetPrice)} (15%) ganarías $${formatCurrency(potentialExtraProfit)} más al mes.`;
                    }
                    
                    // Caso 8: Ganancia positiva pero gastos muy altos
                    if (netProfit > 0 && expenseRatio > 25) {
                      const idealExpense = salesTotal * 0.20; // objetivo 20%
                      const savingsNeeded = expensesTotal - idealExpense;
                      const newProfit = netProfit + savingsNeeded;
                      return `💡 Gastos altos: $${formatCurrency(expensesTotal)} (${formatCurrency(expenseRatio, 0)}%). Reduciendo a $${formatCurrency(idealExpense)} (20%), tu ganancia subiría a $${formatCurrency(newProfit)}.`;
                    }
                    
                    // Caso 9: Buen desempeño pero hay oportunidad específica
                    if (profitRatio >= 10 && profitRatio < 20 && margin < 45) {
                      const potentialWithBetterMargin = salesTotal * 0.45 - productsCost;
                      const potentialNetProfit = potentialWithBetterMargin - expensesTotal;
                      const extraProfit = potentialNetProfit - netProfit;
                      return `📈 Buen rendimiento (${formatCurrency(profitRatio, 1)}% ganancia). Con margen del 45% en vez de ${formatCurrency(margin, 1)}%, ganarías $${formatCurrency(extraProfit)} más mensual.`;
                    }
                    
                    // Caso 10: Rendimiento excelente
                    if (profitRatio >= 20) {
                      const monthlyProfit = netProfit;
                      const annualProjection = monthlyProfit * 12;
                      return `✅ ¡Excelente! ${formatCurrency(profitRatio, 1)}% de ganancia neta. A este ritmo proyectas $${formatCurrency(annualProjection)} anuales. Mantén este desempeño.`;
                    }
                    
                    // Caso 11: Buen desempeño
                    if (profitRatio >= 10) {
                      const toExcellent = (salesTotal * 0.20) - netProfit;
                      return `✅ Buen negocio con ${formatCurrency(profitRatio, 1)}% de ganancia. Para llegar a "excelente" (20%), necesitas $${formatCurrency(toExcellent)} más por período.`;
                    }
                    
                    // Caso 12: Ganancia moderada
                    if (profitRatio >= 5) {
                      const toGood = (salesTotal * 0.12) - netProfit;
                      const percentNeeded = (toGood / salesTotal) * 100;
                      return `📊 Ganancia moderada (${formatCurrency(profitRatio, 1)}%). Reduciendo costos/gastos un ${formatCurrency(percentNeeded, 1)}% alcanzarías el objetivo de 12% de ganancia neta.`;
                    }
                    
                    // Default
                    return '📊 Continúa monitoreando tus métricas. Analiza cada período para identificar oportunidades de mejora.';
                  })()}
                </p>
              </div>
            </div>

            <Separator />

            {/* Sección: Otros indicadores */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Otros indicadores</h3>
              
              <div className="space-y-3 min-w-0">
                {/* Balance General */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Balance General</p>
                      <p className="text-xs text-gray-500">Ventas - Gastos</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-600'} text-[20px]`}>
                        ${formatCurrency(Math.abs(balance))}
                      </p>
                      <p className={`text-xs font-medium ${balance >= 0 ? 'text-gray-600' : 'text-red-600'}`}>
                        {balance >= 0 ? 'Positivo' : 'Negativo'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Margen de Utilidad */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Margen de Utilidad</p>
                      <p className="text-xs text-gray-500">Ventas - Costos de productos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-[20px]">${formatCurrency(salesTotal - productsCost)}</p>
                      <p className="text-xs text-gray-600 font-medium">
                        {salesTotal > 0 ? formatCurrency(((salesTotal - productsCost) / salesTotal) * 100, 1) : '0'}% de margen
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Métodos de Pago */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Métodos de Pago</h3>
              {paymentMethods.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 min-w-0">
                  {paymentMethods.map((pm, index) => {
                    const percentage = salesTotal > 0 ? (pm.total / salesTotal) * 100 : 0;
                    return (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{getPaymentIcon(pm.method)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{pm.method}</p>
                            <p className="text-[10px] text-gray-500">{pm.count} {pm.count === 1 ? 'trans.' : 'trans.'}</p>
                          </div>
                        </div>
                        <div className="mb-2">
                          <p className="text-lg font-bold text-gray-900">${formatCurrency(pm.total)}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(percentage, 1)}%</p>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-gray-900 h-1.5 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center">
                  <CreditCard className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No hay datos disponibles</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Colaboradores - Top Vendedores */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Vendedores</h3>
              {collaborators && collaborators.length > 0 ? (
                <div className="space-y-2 min-w-0">
                  {collaborators.slice(0, 5).map((collab, index) => {
                    const percentage = salesTotal > 0 ? (collab.salesTotal / salesTotal) * 100 : 0;
                    const avgTicket = collab.salesCount > 0 ? collab.salesTotal / collab.salesCount : 0;
                    
                    return (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              #{index + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{collab.name}</p>
                              <p className="text-xs text-gray-500">{collab.salesCount} {collab.salesCount === 1 ? 'venta' : 'ventas'} · Ticket prom: ${formatCurrency(avgTicket, 0)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold text-gray-900">${formatCurrency(collab.salesTotal)}</p>
                            <p className="text-xs text-gray-500">{formatCurrency(percentage, 1)}%</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-gray-900 h-1.5 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center">
                  <ShoppingCart className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No hay datos de vendedores disponibles</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Productos Más Vendidos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Productos Más Vendidos</h3>
                
                {/* Tabs */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setProductSortBy('revenue')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      productSortBy === 'revenue'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Ingresos
                  </button>
                  <button
                    onClick={() => setProductSortBy('quantity')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      productSortBy === 'quantity'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Cantidad
                  </button>
                </div>
              </div>
              
              {topProducts && topProducts.length > 0 ? (
                <div className="space-y-2 min-w-0">
                  {sortedProducts.slice(0, 5).map((product, index) => {
                    const percentage = salesTotal > 0 ? (product.revenue / salesTotal) * 100 : 0;
                    const avgPrice = product.quantity > 0 ? product.revenue / product.quantity : 0;
                    
                    return (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 text-gray-900 rounded-lg flex items-center justify-center text-xs font-bold">
                              #{index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate max-w-[170px] sm:max-w-[250px] p-[0px] mx-[2px] my-[0px]">{product.name}</p>
                              <p className="text-xs text-gray-500">{product.quantity} {product.quantity === 1 ? 'unidad' : 'unidades'} · Precio prom: ${formatCurrency(avgPrice, 0)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold text-gray-900">${formatCurrency(product.revenue)}</p>
                            <p className="text-xs text-gray-500">{formatCurrency(percentage, 1)}%</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-gray-900 h-1.5 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center">
                  <ShoppingCart className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No hay datos de productos disponibles</p>
                </div>
              )}
            </div>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}