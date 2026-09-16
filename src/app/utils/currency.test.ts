import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseLocaleNumber } from './currency';

describe('parseLocaleNumber', () => {
  it('acepta coma decimal como 3,94', () => {
    assert.equal(parseLocaleNumber('3,94'), 3.94);
  });

  it('acepta punto decimal', () => {
    assert.equal(parseLocaleNumber('3.94'), 3.94);
  });

  it('acepta miles con punto y decimales con coma', () => {
    assert.equal(parseLocaleNumber('1.234,50'), 1234.5);
  });

  it('vacío no es un número', () => {
    assert.equal(Number.isFinite(parseLocaleNumber('')), false);
    assert.equal(Number.isFinite(parseLocaleNumber('3,94')), true);
  });
});
