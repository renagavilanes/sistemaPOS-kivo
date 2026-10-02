import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collapseVoiceTranscript,
  handleVoiceTurn,
  initialVoiceState,
  matchCatalog,
  parsePayment,
  parseProductRequest,
  splitProductClauses,
  type VoiceCatalogItem,
  type VoiceContext,
  type VoiceDialogState,
} from './voiceSaleDialog.ts';

const catalog: VoiceCatalogItem[] = [
  { id: '8', name: 'Cámara GoPro Hero 8', stock: 4 },
  { id: '9', name: 'Cámara GoPro Hero 9', stock: 2 },
  { id: 'f', name: 'Filtro GoPro', stock: 3 },
  { id: 'b', name: 'Batería GoPro', stock: 0 },
];

function ctx(cart: VoiceContext['cart'] = [], totalLabel = '$0'): VoiceContext {
  return { catalog, cart, totalLabel };
}

describe('agente de voz para ventas', () => {
  it('entiende una venta de una cámara gopro 8', () => {
    const parsed = parseProductRequest('oye registra una venta de una camara gopro 8');
    assert.deepEqual(parsed, { quantity: 1, query: 'camara gopro 8', price: null });
    const match = matchCatalog(parsed!.query, catalog);
    assert.equal(match.kind, 'one');
    assert.equal(match.options[0]?.id, '8');
  });

  it('agrega al carrito, pregunta si hay algo más y cobra en efectivo', () => {
    const added = handleVoiceTurn(
      initialVoiceState(),
      'oye registra una venta de una camara gopro 8',
      ctx(),
    );
    assert.equal(added.add?.product.id, '8');
    assert.equal(added.add?.quantity, 1);
    assert.equal(added.step, 'more');
    assert.equal(added.say, 'Añadí el producto Cámara GoPro Hero 8 al carrito.');

    const another = handleVoiceTurn(added, 'un filtro gopro', ctx([{ productId: '8', quantity: 1 }], '450'));
    assert.equal(another.add?.product.id, 'f');
    assert.equal(another.say, 'Añadí el producto Filtro GoPro al carrito.');

    for (const phrase of [
      'eso es todo',
      'finaliza venta',
      'finalicemos la venta',
      'ya finalicemos',
      'vamos a finalizar la venta',
      'terminemos el pedido',
      'cerremos la venta',
      'cierrame la venta',
      'solo eso',
      'nada mas',
      'ya es suficiente',
      'no agregues mas',
      'se acabo',
      'pasemos a pagar',
      'quiero cobrar',
      'confirma la venta',
      'listo para pagar',
      'que mas sigue',
    ]) {
      const pay = handleVoiceTurn(another, phrase, ctx([{ productId: '8', quantity: 1 }], '450'));
      assert.equal(pay.step, 'pay', phrase);
      assert.equal(pay.openPaymentSheet, true);
      assert.equal(pay.say, 'Ok, el total es de $450. ¿Cuál es el método de pago?');
    }
  });

  it('cobra cuando dicen que ya no hay más productos', () => {
    const added = handleVoiceTurn(initialVoiceState(), 'una camara gopro 8', ctx());
    const pay = handleVoiceTurn(added, 'eso es todo', ctx([{ productId: '8', quantity: 1 }], '450'));
    const done = handleVoiceTurn(pay, 'en efectivo', ctx([{ productId: '8', quantity: 1 }], '450'));
    assert.equal(done.checkout?.method, 'Efectivo');
    assert.equal(done.say, 'Ok, la venta ha sido registrada.');
  });

  it('pide elegir cuando el nombre coincide con varias GoPro', () => {
    const turn = handleVoiceTurn(initialVoiceState(), 'una gopro', ctx());
    assert.equal(turn.step, 'choose');
    assert.ok(turn.options.length >= 2);

    const picked = handleVoiceTurn(turn, 'la primera', ctx());
    assert.equal(picked.add?.product.id, turn.options[0]?.id);
    assert.equal(picked.step, 'more');
  });

  it('toma la cantidad y agrega aunque el inventario esté en cero', () => {
    const filters = handleVoiceTurn(initialVoiceState(), 'dos filtros gopro', ctx());
    assert.equal(filters.add?.product.id, 'f');
    assert.equal(filters.add?.quantity, 2);

    const battery = handleVoiceTurn(initialVoiceState(), 'una bateria gopro', ctx());
    assert.equal(battery.add?.product.id, 'b');
    assert.equal(battery.add?.quantity, 1);
    assert.equal(battery.step, 'more');
  });

  it('interpreta un nombre incompleto o parecido contra el inventario', () => {
    const shop: VoiceCatalogItem[] = [
      { id: 'c8', name: 'Carcasa gopro 8', stock: 2 },
      { id: 'c9', name: 'Carcasa gopro 9 - 10 - 11 - 12 - 13', stock: 2 },
      { id: 'frame8', name: 'Frame GoPro 8', stock: 2 },
      { id: 'mica8', name: 'Micas de vidrio Gopro 8', stock: 2 },
      { id: 'negro', name: 'Estuche de silicona gopro 8 (negro)', stock: 2 },
      { id: 'celeste', name: 'Estuche de silicona celeste para GoPro 8', stock: 3 },
      { id: 'cam13', name: 'Cámara GOPRO 13 BLACK', stock: 0 },
      { id: 'cam12', name: 'Cámara de acción GoPro 12', stock: 0 },
      { id: 'bat', name: 'Batería GoPro para 5 - 6 - 7', stock: 1 },
      { id: 'tri', name: 'Adaptador para trípode', stock: 2 },
      { id: 'carg', name: 'Cargador DUO para gopro 8', stock: 0 },
    ];

    assert.equal(matchCatalog('carcasa 8', shop).options[0]?.id, 'c8');
    assert.equal(matchCatalog('carcaza gopro 8', shop).kind, 'one');
    assert.equal(matchCatalog('carcaza gopro 8', shop).options[0]?.id, 'c8');
    assert.equal(matchCatalog('estuche negro 8', shop).options[0]?.id, 'negro');
    assert.equal(matchCatalog('frame 8', shop).options[0]?.id, 'frame8');
    assert.equal(matchCatalog('tripode', shop).options[0]?.id, 'tri');
    assert.equal(matchCatalog('camara 13', shop).options[0]?.id, 'cam13');
    assert.equal(matchCatalog('bateria para la 7', shop).options[0]?.id, 'bat');
    assert.equal(
      matchCatalog('anada el carrito una carcasa de la gopro 8', shop).options[0]?.id,
      'c8',
    );

    const spoken = handleVoiceTurn(
      initialVoiceState(),
      'añada el carrito una carcasa de la gopro 8',
      { catalog: shop, cart: [], totalLabel: '30' },
    );
    assert.equal(spoken.add?.product.id, 'c8');
    assert.equal(spoken.step, 'more');

    const priced = [
      { id: 'v9', name: 'Adaptador vertical', stock: 2, price: 9 },
      { id: 'v25', name: 'Adaptador vertical aluminio', stock: 3, price: 25 },
    ];
    const byPrice = handleVoiceTurn(
      initialVoiceState(),
      'añade un adaptador vertical de $9',
      { catalog: priced, cart: [], totalLabel: '9' },
    );
    assert.equal(byPrice.add?.product.id, 'v9');
    assert.equal(byPrice.say, 'Añadí el producto Adaptador vertical al carrito.');

    const aluminum = handleVoiceTurn(
      initialVoiceState(),
      'un adaptador vertical de 25 dolares',
      { catalog: priced, cart: [], totalLabel: '25' },
    );
    assert.equal(aluminum.add?.product.id, 'v25');

    const ways: VoiceCatalogItem[] = [
      { id: 'w', name: '3 Way', stock: 2, price: 18 },
      { id: 'w2', name: '3 Way 2.0', stock: 0, price: 40 },
    ];
    for (const phrase of ['tre guay', 'tres guay', 'tri way', '3 way', 'triguay']) {
      const heard = handleVoiceTurn(initialVoiceState(), phrase, { catalog: ways, cart: [], totalLabel: '18' });
      assert.equal(heard.add?.product.id, 'w', phrase);
      assert.equal(heard.add?.quantity, 1, phrase);
    }
    const second = handleVoiceTurn(initialVoiceState(), 'tre guay 2', { catalog: ways, cart: [], totalLabel: '40' });
    assert.equal(second.add?.product.id, 'w2');

    const several = matchCatalog('gopro 8', shop);
    assert.equal(several.kind, 'many');
    assert.ok(several.options.some((product) => product.id === 'c8'));
    assert.ok(several.options.some((product) => product.id === 'frame8'));
  });

  it('añade dos productos dichos en la misma frase', () => {
    assert.deepEqual(splitProductClauses('adaptador de telefono de $7 y carcasa de la gopro 12 de $32'), [
      'adaptador de telefono de $7',
      'carcasa de la gopro 12 de $32',
    ]);
    assert.deepEqual(splitProductClauses('frame gopro 9 y 10'), ['frame gopro 9 y 10']);

    const pair: VoiceCatalogItem[] = [
      { id: 'phone', name: 'Adaptador / Soporte para teléfono', stock: 1, price: 7 },
      { id: 'codo', name: 'Base en L / Codo', stock: 2, price: 7 },
      { id: 'c12', name: 'Carcasa gopro 9 - 10 - 11 - 12 - 13', stock: 2, price: 32 },
      { id: 'dji', name: 'Carcasa sumergible DJI Osmo action 3-4-5', stock: 2, price: 32 },
      { id: 'vert', name: 'Adaptador vertical', stock: 2, price: 9 },
    ];
    const turn = handleVoiceTurn(
      initialVoiceState(),
      'adaptador de telefono de $7 y carcasa de la gopro 12 de $32',
      { catalog: pair, cart: [], totalLabel: '39' },
    );
    assert.deepEqual(turn.adds?.map((line) => line.product.id), ['phone', 'c12']);
    assert.match(turn.say, /Adaptador \/ Soporte para teléfono/);
    assert.match(turn.say, /Carcasa gopro 9 - 10 - 11 - 12 - 13/);

    const both = handleVoiceTurn(initialVoiceState(), 'un filtro gopro y una bateria gopro', ctx());
    assert.deepEqual(both.adds?.map((line) => line.product.id), ['f', 'b']);
    assert.equal(both.adds?.[1]?.quantity, 1);
  });

  it('abre el pago, quita productos, vuelve a agregar o cancela', () => {
    const added = handleVoiceTurn(initialVoiceState(), 'una camara gopro 8', ctx());
    const pay = handleVoiceTurn(added, 'finaliza', ctx([{ productId: '8', quantity: 1, name: 'Cámara GoPro Hero 8' }], '450'));
    assert.equal(pay.openPaymentSheet, true);
    assert.match(pay.say, /total es de \$450/);

    const back = handleVoiceTurn(pay, 'regresa a agregar mas', ctx([{ productId: '8', quantity: 1, name: 'Cámara GoPro Hero 8' }], '450'));
    assert.equal(back.step, 'collect');
    assert.equal(back.closePaymentSheet, true);
    assert.equal(back.say, '¿Qué más agrego?');

    const stocked = ctx([
      { productId: '8', quantity: 1, name: 'Cámara GoPro Hero 8', price: 450 },
      { productId: 'f', quantity: 1, name: 'Filtro GoPro', price: 20 },
    ], '470');
    const removed = handleVoiceTurn(
      { step: 'more', options: [], pendingQuantity: 1 },
      'quita el filtro y la camara',
      stocked,
    );
    assert.deepEqual(removed.removes?.map((line) => line.productId), ['f', '8']);
    assert.match(removed.say, /Filtro GoPro/);
    assert.match(removed.say, /Cámara GoPro Hero 8/);
    assert.equal(removed.closePaymentSheet, true);

    const emptied = handleVoiceTurn(
      { step: 'pay', options: [], pendingQuantity: 1 },
      'vacia el carrito',
      stocked,
    );
    assert.equal(emptied.clearCart, true);
    assert.equal(emptied.closePaymentSheet, true);

    const cancelled = handleVoiceTurn(pay, 'cancela la operacion', stocked);
    assert.equal(cancelled.clearCart, true);
    assert.equal(cancelled.end, true);
    assert.equal(cancelled.closePaymentSheet, true);
    assert.match(cancelled.say, /Cancelé la operación/);
  });

  it('cierra la venta de una vez si el método viene en la misma frase', () => {
    const cart = ctx([{ productId: '8', quantity: 1, name: 'Cámara GoPro Hero 8' }], '450');
    const added = handleVoiceTurn(initialVoiceState(), 'una camara gopro 8', ctx());
    const phrases: Array<[string, 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Otros']> = [
      ['finaliza la venta con transferencia', 'Transferencia'],
      ['finaliza con trasnferencia', 'Transferencia'],
      ['cierra la venta en efectivo', 'Efectivo'],
      ['cobrala con tarjeta', 'Tarjeta'],
      ['eso es todo por nequi', 'Transferencia'],
      ['listo con efectivo', 'Efectivo'],
      ['registra la venta con deposito', 'Transferencia'],
      ['ya, con tarjeta', 'Tarjeta'],
      ['pasemos a pagar en efectivo', 'Efectivo'],
      ['quiero cobrar con transferencia', 'Transferencia'],
      ['terminala con daviplata', 'Transferencia'],
      ['confirma la venta con otros', 'Otros'],
    ];
    for (const [phrase, method] of phrases) {
      const done = handleVoiceTurn(added, phrase, cart);
      assert.equal(done.checkout?.method, method, phrase);
      assert.equal(done.openPaymentSheet, undefined, phrase);
      assert.match(done.say, /La venta con .+ ha sido registrada/, phrase);
      assert.match(done.say, /\$450/, phrase);
    }

    const credit = handleVoiceTurn(added, 'finaliza la venta a credito', cart);
    assert.equal(credit.checkout, undefined);
    assert.equal(credit.openPaymentSheet, true);
    assert.equal(credit.end, true);

    const ask = handleVoiceTurn(added, 'finaliza la venta', cart);
    assert.equal(ask.checkout, undefined);
    assert.equal(ask.step, 'pay');
    assert.equal(ask.openPaymentSheet, true);

    const empty = handleVoiceTurn(initialVoiceState(), 'finaliza con efectivo', ctx());
    assert.equal(empty.checkout, undefined);
    assert.match(empty.say, /Todavía no hay productos/);
  });

  it('finaliza o cobra aunque esté eligiendo entre productos parecidos', () => {
    const choosing: VoiceDialogState = {
      step: 'choose',
      options: [
        { id: 'a', name: 'Adaptador para trípode', stock: 2 },
        { id: 'b', name: 'Adaptador para trípode largo', stock: 1 },
      ],
      pendingQuantity: 1,
    };
    const cart = ctx([{ productId: '8', quantity: 1, name: 'Cámara GoPro Hero 8' }], '450');

    const pay = handleVoiceTurn(choosing, 'dejalo asi y finaliza la venta', cart);
    assert.equal(pay.add, undefined);
    assert.equal(pay.step, 'pay');
    assert.equal(pay.openPaymentSheet, true);
    assert.match(pay.say, /método de pago/);

    const done = handleVoiceTurn(choosing, 'efectivo', cart);
    assert.equal(done.checkout?.method, 'Efectivo');
    assert.match(done.say, /registrada/);

    const skip = handleVoiceTurn(choosing, 'dejalo asi', cart);
    assert.equal(skip.add, undefined);
    assert.equal(skip.step, 'more');
    assert.match(skip.say, /se queda así/);

    const fromCart = handleVoiceTurn(
      { step: 'more', options: [], pendingQuantity: 1 },
      'con tarjeta',
      cart,
    );
    assert.equal(fromCart.checkout?.method, 'Tarjeta');
  });

  it('no repite la frase cuando el celular la manda creciendo', () => {
    const growing = [
      'añade',
      'añade un',
      'añade un adaptador',
      'añade un adaptador de soporte para teléfono de $7',
    ];
    const phrase = collapseVoiceTranscript(growing.map((text) => ({ text, final: true })));
    assert.equal(phrase.stable, true);
    assert.equal(phrase.text, 'añade un adaptador de soporte para teléfono de $7');

    const live = collapseVoiceTranscript([
      { text: 'añade un adaptador', final: true },
      { text: 'añade un adaptador de soporte', final: false },
    ]);
    assert.equal(live.stable, false);
    assert.equal(live.text, 'añade un adaptador de soporte');
  });

  it('abre el pago en pantalla cuando la venta es a crédito', () => {
    const state: VoiceDialogState = { step: 'pay', options: [], pendingQuantity: 1 };
    const turn = handleVoiceTurn(state, 'a credito', ctx([{ productId: '8', quantity: 1 }], '450'));
    assert.equal(turn.openPaymentSheet, true);
    assert.equal(turn.end, true);
    assert.equal(parsePayment('tarjeta de credito'), 'Tarjeta');
    assert.equal(parsePayment('nequi'), 'Transferencia');
  });
});
