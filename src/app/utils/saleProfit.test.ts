import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { saleItemUnitCost, saleItemsTotalCost, saleProfit } from './saleProfit';

describe('ganancia de venta', () => {
  it('usa el costo real, no el 40% del precio', () => {
    const items = [
      { productId: 'a', name: 'Adaptador', price: 7, quantity: 1, cost: 3 },
      { productId: 'b', name: 'Soporte para Cabeza', price: 10, quantity: 1, cost: 4 },
    ];
    assert.equal(saleItemsTotalCost(items), 7);
    assert.equal(saleProfit(17, items), 10);
    assert.notEqual(saleProfit(17, items), 17 - 17 * 0.6);
  });

  it('si el ítem no trae costo, usa el del catálogo', () => {
    const catalog = new Map([['a', { cost: 2.5 }]]);
    const items = [{ productId: 'a', name: 'X', price: 7, quantity: 2 }];
    assert.equal(saleItemUnitCost(items[0], catalog.get('a')), 2.5);
    assert.equal(saleProfit(14, items, catalog), 9);
  });

  it('venta libre tiene costo 0 y ganancia = total', () => {
    const items = [{ productId: null, name: 'Venta libre', price: 17, quantity: 1, freeSale: true }];
    assert.equal(saleItemsTotalCost(items), 0);
    assert.equal(saleProfit(17, items), 17);
  });
});
