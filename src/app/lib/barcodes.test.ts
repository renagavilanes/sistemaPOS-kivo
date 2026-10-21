import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  barcodeUsedBy,
  collectBarcodes,
  indexBarcodes,
  isFastScan,
  isIdleScan,
  lookupBarcode,
  parseBarcodes,
  serializeBarcodes,
} from './barcodes';

describe('códigos de barras del producto', () => {
  it('conserva un código antiguo tal como está', () => {
    assert.deepEqual(parseBarcodes(' 7501 234 '), ['7501234']);
    assert.equal(serializeBarcodes(['7501234']), '7501234');
  });

  it('guarda hasta 3 códigos en el mismo campo', () => {
    const collected = collectBarcodes(['111', '222', '', '111', '333']);
    assert.deepEqual(collected.codes, ['111', '222', '333']);
    assert.equal(collected.error, undefined);
    assert.equal(serializeBarcodes(collected.codes), '111|222|333');
    assert.deepEqual(parseBarcodes('111|222|333|444'), ['111', '222', '333']);
    assert.equal(Boolean(collectBarcodes(['1', '2', '3', '4']).error), true);
  });

  it('rechaza un código imposible', () => {
    assert.equal(collectBarcodes(['12|99']).error?.length ? true : false, true);
    assert.equal(collectBarcodes(['a'.repeat(65)]).error?.length ? true : false, true);
  });

  it('encuentra el producto sin recorrer más de un índice', () => {
    const products = [
      { id: 'a', name: 'Agua', barcodes: ['111'] },
      { id: 'b', name: 'Gaseosa', barcodes: ['222', '333'] },
    ];
    const index = indexBarcodes(products);
    assert.equal(lookupBarcode(index, '333').status, 'found');
    if (lookupBarcode(index, '333').status === 'found') {
      assert.equal(lookupBarcode(index, ' 333 ').status, 'found');
    }
    const hit = lookupBarcode(index, '333');
    assert.equal(hit.status === 'found' ? hit.product.name : '', 'Gaseosa');
    assert.equal(lookupBarcode(index, '999').status, 'missing');
  });

  it('avisa si el código ya pertenece a otro producto', () => {
    const products = [{ id: 'a', name: 'Agua', barcodes: ['111'] }];
    assert.deepEqual(barcodeUsedBy(products, ['111'], 'b'), { code: '111', name: 'Agua' });
    assert.equal(barcodeUsedBy(products, ['111'], 'a'), null);
  });

  it('distingue el lector de un tecleo', () => {
    assert.equal(isFastScan(13, 12 * 20), true);
    assert.equal(isFastScan(3, 10), false);
    assert.equal(isIdleScan(8, 7 * 20), true);
    assert.equal(isIdleScan(8, 7 * 120), false);
    assert.equal(isIdleScan(4, 30), false);
  });
});
