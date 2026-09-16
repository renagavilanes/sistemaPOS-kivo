import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { suggestDestProduct } from './productMatch';
import {
  addProductToLines,
  applyDestChoiceToLine,
  bumpTransferQuantity,
  linesToTransferItems,
  makeTransferLine,
  rematchLine,
  runInventoryTransfer,
  type TransferLine,
  type TransferProduct,
} from './inventoryTransferLogic';

function product(partial: Partial<TransferProduct> & Pick<TransferProduct, 'id' | 'name'>): TransferProduct {
  return {
    businessId: partial.businessId || 'biz',
    price: partial.price ?? 10,
    cost: partial.cost ?? 4,
    stock: partial.stock ?? 0,
    category: partial.category || 'Otros',
    image: partial.image || '',
    barcode: partial.barcode,
    ...partial,
  };
}

type Row = TransferProduct & { deleted?: boolean };

function memoryStore(seed: Row[]) {
  const rows = new Map(seed.map((p) => [`${p.businessId}:${p.id}`, { ...p }]));
  let seq = 1;
  return {
    snapshot() {
      return [...rows.values()].filter((p) => !p.deleted).map((p) => ({ ...p }));
    },
    stock(businessId: string, id: string) {
      return rows.get(`${businessId}:${id}`)?.stock ?? null;
    },
    adapters: {
      async getProduct(businessId: string, productId: string) {
        const row = rows.get(`${businessId}:${productId}`);
        if (!row || row.deleted) throw new Error('Producto no encontrado');
        return { ...row };
      },
      async updateStock(productId: string, businessId: string, stock: number) {
        const key = `${businessId}:${productId}`;
        const row = rows.get(key);
        if (!row || row.deleted) throw new Error('Producto no encontrado');
        row.stock = stock;
      },
      async createProduct(businessId: string, data: Omit<TransferProduct, 'id' | 'businessId'>) {
        const created: Row = {
          ...product({ id: `new-${seq++}`, name: data.name }),
          ...data,
          businessId,
        };
        rows.set(`${businessId}:${created.id}`, created);
        return { ...created };
      },
      async deleteProduct(productId: string, businessId: string) {
        const row = rows.get(`${businessId}:${productId}`);
        if (row) row.deleted = true;
      },
    },
  };
}

describe('emparejado de productos', () => {
  it('prioriza el mismo código de barras sobre un nombre parecido', () => {
    const from = product({ id: 'a', name: 'Coca 600', barcode: '123', stock: 5, businessId: 'origen' });
    const dest = [
      product({ id: 'wrong', name: 'Coca 600', barcode: '999', businessId: 'dest' }),
      product({ id: 'right', name: 'Gaseosa', barcode: '123', businessId: 'dest' }),
    ];
    const match = suggestDestProduct(from, dest);
    assert.equal(match.kind, 'barcode');
    assert.equal(match.product?.id, 'right');
  });

  it('iguala nombres sin importar mayúsculas ni tildes', () => {
    const from = product({ id: 'a', name: 'Adaptador Vertical', stock: 2 });
    const dest = [product({ id: 'b', name: 'adaptador vertical' })];
    const match = suggestDestProduct(from, dest);
    assert.equal(match.kind, 'name');
    assert.equal(match.product?.id, 'b');
  });

  it('marca create cuando no hay uno parecido', () => {
    const from = product({ id: 'a', name: 'Carcasa 5-6-7 black', stock: 2 });
    const dest = [product({ id: 'b', name: 'Memoria micro SD' })];
    const line = makeTransferLine(from, dest);
    assert.equal(line.destMode, 'create');
    assert.equal(line.destProduct, null);
    assert.equal(line.matchKind, 'none');
  });

  it('no pisa un destino que el usuario cambió a mano', () => {
    const from = product({ id: 'a', name: '3 Way', stock: 1 });
    const suggested = product({ id: 's', name: '3 way' });
    const chosen = product({ id: 'c', name: 'Otro producto' });
    let line = makeTransferLine(from, [suggested]);
    line = applyDestChoiceToLine(line, chosen);
    line = rematchLine(line, [suggested]);
    assert.equal(line.userPicked, true);
    assert.equal(line.destProduct?.id, 'c');
    assert.equal(line.destMode, 'match');
  });

  it('crear a mano deja toProductId en null', () => {
    const from = product({ id: 'a', name: '3 Way', stock: 1 });
    const suggested = product({ id: 's', name: '3 way' });
    let line = makeTransferLine(from, [suggested]);
    line = applyDestChoiceToLine(line, null);
    const items = linesToTransferItems([line]);
    assert.equal(items[0].toProductId, null);
  });
});

describe('cantidades del carrito', () => {
  it('no deja enviar más stock del que hay', () => {
    const from = product({ id: 'a', name: '3 Way', stock: 1 });
    let { lines } = addProductToLines([], from, []);
    const bumped = bumpTransferQuantity(lines, 'a', 1);
    assert.equal(bumped.lines[0].quantity, 1);
    assert.match(bumped.error || '', /Solo hay 1/);
  });

  it('al bajar de 1 quita la línea', () => {
    const from = product({ id: 'a', name: '3 Way', stock: 2 });
    const { lines } = addProductToLines([], from, []);
    const next = bumpTransferQuantity(lines, 'a', -1);
    assert.equal(next.lines.length, 0);
  });

  it('sumar el mismo producto junta cantidades', () => {
    const from = product({ id: 'a', name: 'Aceite', stock: 8 });
    let { lines } = addProductToLines([], from, []);
    ({ lines } = addProductToLines(lines, from, []));
    assert.equal(lines.length, 1);
    assert.equal(lines[0].quantity, 2);
  });
});

describe('traslado de stock', () => {
  it('resta en origen y suma en el producto destino correcto', async () => {
    const store = memoryStore([
      product({ id: 'coca-q', name: 'Coca Cola 600 ml', stock: 10, businessId: 'quito' }),
      product({ id: 'coca-h', name: 'Coca Cola 600 ml', stock: 1, businessId: 'hero' }),
      product({ id: 'otro-h', name: 'Otro', stock: 40, businessId: 'hero' }),
    ]);

    await runInventoryTransfer(
      {
        fromBusinessId: 'quito',
        toBusinessId: 'hero',
        items: [{ fromProductId: 'coca-q', quantity: 5, toProductId: 'coca-h' }],
      },
      store.adapters,
    );

    assert.equal(store.stock('quito', 'coca-q'), 5);
    assert.equal(store.stock('hero', 'coca-h'), 6);
    assert.equal(store.stock('hero', 'otro-h'), 40);
  });

  it('crea el producto en destino cuando no existe y copia ficha', async () => {
    const store = memoryStore([
      product({
        id: 'aceite-q',
        name: 'Aceite 1 L',
        stock: 8,
        price: 20,
        cost: 9,
        barcode: 'ACEITE',
        businessId: 'quito',
      }),
    ]);

    const result = await runInventoryTransfer(
      {
        fromBusinessId: 'quito',
        toBusinessId: 'hero',
        items: [{ fromProductId: 'aceite-q', quantity: 2, toProductId: null }],
      },
      store.adapters,
    );

    assert.equal(store.stock('quito', 'aceite-q'), 6);
    assert.equal(result.createdIds.length, 1);
    const created = store.snapshot().find((p) => p.businessId === 'hero');
    assert.ok(created);
    assert.equal(created?.name, 'Aceite 1 L');
    assert.equal(created?.stock, 2);
    assert.equal(created?.barcode, 'ACEITE');
    assert.equal(created?.price, 20);
  });

  it('si la segunda línea falla, revierte la primera', async () => {
    const store = memoryStore([
      product({ id: 'a-q', name: 'A', stock: 5, businessId: 'quito' }),
      product({ id: 'b-q', name: 'B', stock: 1, businessId: 'quito' }),
      product({ id: 'a-h', name: 'A', stock: 0, businessId: 'hero' }),
    ]);

    await assert.rejects(
      () =>
        runInventoryTransfer(
          {
            fromBusinessId: 'quito',
            toBusinessId: 'hero',
            items: [
              { fromProductId: 'a-q', quantity: 2, toProductId: 'a-h' },
              { fromProductId: 'b-q', quantity: 3, toProductId: null },
            ],
          },
          store.adapters,
        ),
      /suficiente stock/,
    );

    assert.equal(store.stock('quito', 'a-q'), 5);
    assert.equal(store.stock('hero', 'a-h'), 0);
    assert.equal(store.snapshot().filter((p) => p.businessId === 'hero').length, 1);
  });

  it('rechaza el mismo negocio y cantidades inválidas', async () => {
    const store = memoryStore([product({ id: 'a', name: 'A', stock: 5, businessId: 'quito' })]);
    await assert.rejects(
      () =>
        runInventoryTransfer(
          { fromBusinessId: 'quito', toBusinessId: 'quito', items: [{ fromProductId: 'a', quantity: 1, toProductId: null }] },
          store.adapters,
        ),
      /distinto/,
    );
    await assert.rejects(
      () =>
        runInventoryTransfer(
          { fromBusinessId: 'quito', toBusinessId: 'hero', items: [{ fromProductId: 'a', quantity: 0, toProductId: null }] },
          store.adapters,
        ),
      /inválida/,
    );
  });

  it('flujo completo: sugerir, cambiar destino y trasladar al elegido', async () => {
    const origin = product({ id: 'vert-q', name: 'Adaptador vertical', stock: 3, businessId: 'quito' });
    const suggested = product({ id: 'vert-h', name: 'Adaptador vertical', stock: 19, businessId: 'hero' });
    const other = product({ id: 'tripode-h', name: 'Adaptador para trípode', stock: 4, businessId: 'hero' });

    let lines: TransferLine[] = [];
    ({ lines } = addProductToLines(lines, origin, [suggested, other]));
    assert.equal(lines[0].destProduct?.id, 'vert-h');

    lines = [applyDestChoiceToLine(lines[0], other)];
    lines = [rematchLine(lines[0], [suggested, other])];
    assert.equal(lines[0].destProduct?.id, 'tripode-h');

    const bumped = bumpTransferQuantity(lines, 'vert-q', 1);
    lines = bumped.lines;
    assert.equal(lines[0].quantity, 2);

    const store = memoryStore([origin, suggested, other]);
    await runInventoryTransfer(
      { fromBusinessId: 'quito', toBusinessId: 'hero', items: linesToTransferItems(lines) },
      store.adapters,
    );

    assert.equal(store.stock('quito', 'vert-q'), 1);
    assert.equal(store.stock('hero', 'tripode-h'), 6);
    assert.equal(store.stock('hero', 'vert-h'), 19);
  });
});
