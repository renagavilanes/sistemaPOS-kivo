import { formatCurrency } from './currency';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

export type ReportInsightStatus = 'good' | 'warn' | 'bad';

export type ReportInsight = {
  status: ReportInsightStatus;
  text: string;
};

export type ReportInsightInput = {
  salesTotal: number;
  productsCost: number;
  expensesTotal: number;
  netProfit: number;
  salesCount: number;
  period: ReportPeriod;
};

function money(n: number): string {
  return `$${formatCurrency(Math.abs(n), 0)}`;
}

function periodPace(net: number, period: ReportPeriod): { week?: number; month?: number; year?: number } {
  if (period === 'daily') return { week: net * 7, month: net * 30 };
  if (period === 'weekly') return { month: net * (30 / 7), year: net * 52 };
  if (period === 'monthly') return { year: net * 12 };
  if (period === 'yearly' || period === 'all') return { year: net };
  return { year: net };
}

export function reportInsightMark(status: ReportInsightStatus): string {
  if (status === 'good') return '✅';
  if (status === 'bad') return '❌';
  return '⚠️';
}

export function formatReportInsight(insight: ReportInsight): string {
  return `${reportInsightMark(insight.status)} ${insight.text}`;
}

function paceLine(net: number, period: ReportPeriod, goingWell: boolean): string {
  const p = periodPace(net, period);
  if (period === 'daily' && p.week != null && p.month != null) {
    return goingWell
      ? `Si cada día rinde igual: unos ${money(p.week)} esta semana y unos ${money(p.month)} este mes.`
      : `Si sigue igual: unos ${money(p.week)} en rojo esta semana y unos ${money(p.month)} este mes.`;
  }
  if (period === 'weekly' && p.month != null && p.year != null) {
    return goingWell
      ? `Si cada semana rinde igual: unos ${money(p.month)} este mes y unos ${money(p.year)} este año.`
      : `Si sigue igual: unos ${money(p.month)} en rojo este mes y unos ${money(p.year)} este año.`;
  }
  if (period === 'monthly' && p.year != null) {
    return goingWell
      ? `Si cada mes rinde igual: unos ${money(p.year)} este año.`
      : `Si sigue igual: unos ${money(p.year)} en rojo este año.`;
  }
  if (p.year != null) {
    return goingWell ? `Este año llevas ${money(p.year)}.` : `Este año vas ${money(p.year)} en rojo.`;
  }
  return '';
}

/** 2–3 líneas: visto/equis + ritmo (semana/mes/año). No repite el desglose del recuadro. */
export function reportNetProfitInsight(input: ReportInsightInput): ReportInsight {
  const sales = Number(input.salesTotal) || 0;
  const cogs = Number(input.productsCost) || 0;
  const expenses = Number(input.expensesTotal) || 0;
  const net = Number(input.netProfit) || 0;
  const kept = sales - cogs;
  const cogsRatio = sales > 0 ? cogs / sales : 0;
  const expenseRatio = sales > 0 ? expenses / sales : 0;

  if (sales === 0 && expenses === 0 && cogs === 0) {
    return { status: 'warn', text: 'Sin movimiento en este período. El ritmo aparece cuando hay ventas o gastos.' };
  }

  if (sales === 0 && expenses > 0) {
    return {
      status: 'bad',
      text: `Gastos sin ventas. ${paceLine(-expenses, input.period, false)}`,
    };
  }

  if (kept < 0) {
    return {
      status: 'bad',
      text: `Estás vendiendo por debajo del costo. ${paceLine(net, input.period, false)}`,
    };
  }

  if (net < 0) {
    return {
      status: 'bad',
      text: `Vas a pérdida. ${paceLine(net, input.period, false)}`,
    };
  }

  if (expenseRatio >= 0.3) {
    return {
      status: 'warn',
      text: `Ganas, pero los gastos se comen mucho. ${paceLine(net, input.period, true)}`,
    };
  }

  if (expenses === 0 && cogsRatio > 0.4) {
    return {
      status: 'warn',
      text: `El costo de mercadería está alto y no hay gastos. ${paceLine(net, input.period, true)}`,
    };
  }

  const sinGastos = expenses === 0 ? ' (aún sin gastos)' : '';
  return {
    status: 'good',
    text: `Sigue así${sinGastos}. ${paceLine(net, input.period, true)}`,
  };
}
