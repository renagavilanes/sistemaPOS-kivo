import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCashBreakdown, cashDifference, type CashMovementInput } from './cashSession.ts';

const session = {
  employeeUserId: 'juan',
  openedAt: '2026-09-30T15:12:00.000Z',
  closedAt: null,
  openingAmount: 50,
};

function sale(partial: Partial<CashMovementInput> & Pick<CashMovementInput, 'id'>): CashMovementInput {
  return {
    kind: 'sale',
    label: partial.label ?? partial.id,
    createdAt: '2026-09-30T16:00:00.000Z',
    createdBy: 'juan',
    total: 0,
    paymentStatus: 'paid',
    ...partial,
  };
}

describe('caja por empleado', () => {
  it('suma solo el efectivo de esa persona y resta sus gastos', () => {
    const movements: CashMovementInput[] = [
      sale({
        id: 's1',
        label: 'Audífonos',
        total: 55,
        payments: [
          { method: 'Efectivo', amount: 40 },
          { method: 'Tarjeta', amount: 15 },
        ],
      }),
      sale({
        id: 's2',
        label: 'Cargador',
        total: 18,
        paymentMethod: 'transferencia',
      }),
      {
        id: 'g1',
        kind: 'expense',
        label: 'Transporte',
        createdAt: '2026-09-30T17:00:00.000Z',
        createdBy: 'juan',
        total: 8,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
      },
      sale({
        id: 'pedro',
        label: 'Case',
        createdBy: 'pedro',
        total: 25,
        paymentMethod: 'efectivo',
      }),
      sale({
        id: 'antes',
        label: 'Vieja',
        createdAt: '2026-09-29T12:00:00.000Z',
        total: 100,
        paymentMethod: 'efectivo',
      }),
    ];

    const result = buildCashBreakdown(session, movements);
    assert.equal(result.cashSalesTotal, 40);
    assert.equal(result.cashExpensesTotal, 8);
    assert.equal(result.cardTotal, 15);
    assert.equal(result.transferTotal, 18);
    assert.equal(result.expected, 82);
    assert.deepEqual(result.cashSales.map((line) => line.label), ['Audífonos']);
    assert.equal(cashDifference(result.expected, 80), -2);
    assert.equal(cashDifference(result.expected, null), null);
  });

  it('un gasto en deuda no sale de la caja', () => {
    const result = buildCashBreakdown(session, [
      {
        id: 'g2',
        kind: 'expense',
        label: 'Proveedor',
        createdAt: '2026-09-30T18:00:00.000Z',
        createdBy: 'juan',
        total: 30,
        paymentMethod: 'efectivo',
        paymentStatus: 'pending',
      },
    ]);
    assert.equal(result.cashExpensesTotal, 0);
    assert.equal(result.expected, 50);
  });
});
