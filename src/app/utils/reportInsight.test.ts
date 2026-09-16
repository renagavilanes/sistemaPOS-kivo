import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatReportInsight, reportNetProfitInsight } from './reportInsight';

describe('comentario de ganancia neta', () => {
  it('en el día proyecta semana y mes, no repite el desglose', () => {
    const insight = reportNetProfitInsight({
      salesTotal: 126,
      productsCost: 32,
      expensesTotal: 0,
      netProfit: 94,
      salesCount: 5,
      period: 'daily',
    });
    const text = formatReportInsight(insight);
    assert.equal(insight.status, 'good');
    assert.match(text, /^✅ Sigue así/);
    assert.match(text, /esta semana/);
    assert.match(text, /este mes/);
    assert.doesNotMatch(text, /costo 25|Te quedan \$94,28 de \$126/i);
  });

  it('en la semana proyecta mes y año', () => {
    const insight = reportNetProfitInsight({
      salesTotal: 147,
      productsCost: 35,
      expensesTotal: 0,
      netProfit: 112,
      salesCount: 6,
      period: 'weekly',
    });
    assert.match(formatReportInsight(insight), /este mes/);
    assert.match(formatReportInsight(insight), /este año/);
  });

  it('equis y ritmo en rojo si hay pérdida', () => {
    const insight = reportNetProfitInsight({
      salesTotal: 100,
      productsCost: 40,
      expensesTotal: 80,
      netProfit: -20,
      salesCount: 10,
      period: 'monthly',
    });
    assert.equal(insight.status, 'bad');
    assert.match(formatReportInsight(insight), /^❌ /);
    assert.match(insight.text, /este año/);
  });
});
