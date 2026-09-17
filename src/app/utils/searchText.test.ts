import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { searchTextMatches } from './searchText';

describe('búsqueda sin tildes', () => {
  it('encuentra trípode al buscar tripode', () => {
    assert.equal(searchTextMatches('Adaptador para trípode', 'tripode'), true);
    assert.equal(searchTextMatches('Adaptador para trípode', 'TRIPOD'), true);
  });

  it('no exige tilde en la consulta', () => {
    assert.equal(searchTextMatches('Café americano', 'cafe'), true);
  });
});
