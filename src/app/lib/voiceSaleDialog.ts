export type VoiceStep = 'collect' | 'choose' | 'more' | 'pay';

export type VoicePaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Otros';

export type VoiceCatalogItem = {
  id: string;
  name: string;
  stock: number;
  price?: number;
};

export type VoiceCartLine = {
  productId: string;
  quantity: number;
  name?: string;
  price?: number;
};

export type VoiceDialogState = {
  step: VoiceStep;
  options: VoiceCatalogItem[];
  pendingQuantity: number;
  chooseAction?: 'add' | 'remove';
};

export type VoiceContext = {
  catalog: VoiceCatalogItem[];
  cart: VoiceCartLine[];
  totalLabel: string;
};

export type VoiceTurn = {
  step: VoiceStep;
  options: VoiceCatalogItem[];
  pendingQuantity: number;
  say: string;
  add?: { product: VoiceCatalogItem; quantity: number };
  adds?: { product: VoiceCatalogItem; quantity: number }[];
  removes?: { productId: string; name: string }[];
  clearCart?: boolean;
  chooseAction?: 'add' | 'remove';
  checkout?: { method: VoicePaymentMethod };
  openPaymentSheet?: boolean;
  closePaymentSheet?: boolean;
  end?: boolean;
};

const QUANTITY_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

const SPOKEN_DIGITS: Record<string, string> = {
  cero: '0',
  uno: '1',
  dos: '2',
  tres: '3',
  cuatro: '4',
  cinco: '5',
  seis: '6',
  siete: '7',
  ocho: '8',
  nueve: '9',
  diez: '10',
};

export function normalizeVoiceText(text: string) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bgo\s+pro\b/g, 'gopro')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function initialVoiceState(): VoiceDialogState {
  return { step: 'collect', options: [], pendingQuantity: 1 };
}

export function openingLine() {
  return '¿Qué vendemos hoy?';
}

function tokensOf(text: string) {
  return normalizeVoiceText(text)
    .split(' ')
    .flatMap((token) => {
      const compound = SPOKEN_COMPOUNDS[token];
      if (compound) return compound;
      const tailDigit = token.match(/^([a-z]{2,})(\d+)$/);
      if (tailDigit) return [tailDigit[1], tailDigit[2], token];
      const headDigit = token.match(/^(\d+)([a-z]{2,})$/);
      if (headDigit) return [headDigit[1], headDigit[2], token];
      return token ? [token] : [];
    });
}

/** Inglés dicho con acento: "tre guay" = 3 Way, "freim" = frame. */
const ENGLISH_ALIAS: Record<string, string> = {
  way: 'way', wei: 'way', wey: 'way', guay: 'way', guey: 'way', huey: 'way', huay: 'way', wuay: 'way',
  frame: 'frame', freim: 'frame', frein: 'frame', frem: 'frame', frei: 'frame',
  black: 'black', blak: 'black', blek: 'black',
  white: 'white', guait: 'white', wait: 'white', wuit: 'white', huait: 'white',
  hero: 'hero', jiro: 'hero', jero: 'hero', hiro: 'hero',
  mini: 'mini',
  duo: 'duo',
  clip: 'clip', klip: 'clip',
  sticker: 'sticker', stickers: 'sticker', stiker: 'sticker', stikers: 'sticker',
  shorty: 'shorty', shorti: 'shorty',
  enduro: 'enduro',
  lens: 'lens',
  max: 'max', maks: 'max',
  pro: 'pro',
  backpack: 'backpack', bacpac: 'backpack',
  extreme: 'extreme', estrim: 'extreme',
  silver: 'silver', silber: 'silver',
  action: 'action',
  osmo: 'osmo',
  media: 'media',
  mod: 'mod',
  mood: 'mood',
};

const SPOKEN_NUMBERS: Record<string, string> = {
  cero: '0', zero: '0', sero: '0',
  uno: '1', one: '1', wan: '1',
  dos: '2', two: '2',
  tres: '3', tre: '3', tri: '3', three: '3', tree: '3',
  cuatro: '4', four: '4',
  cinco: '5', five: '5', faiv: '5',
  seis: '6', six: '6',
  siete: '7', seven: '7',
  ocho: '8', eight: '8', eit: '8',
  nueve: '9', nine: '9', nain: '9',
  diez: '10', ten: '10',
};

const SPOKEN_COMPOUNDS: Record<string, string[]> = {
  triguay: ['3', 'way'],
  treguay: ['3', 'way'],
  triguey: ['3', 'way'],
  triway: ['3', 'way'],
  triwei: ['3', 'way'],
  threeway: ['3', 'way'],
  threeguey: ['3', 'way'],
};

function digitOf(token: string) {
  if (/^\d+$/.test(token)) return token;
  return SPOKEN_NUMBERS[token] || null;
}

function spokenKey(token: string) {
  if (ENGLISH_ALIAS[token]) return ENGLISH_ALIAS[token];
  const folded = foldToken(token);
  return ENGLISH_ALIAS[folded] || folded;
}

function looksLikeEnglishName(rest: string) {
  const first = rest.split(' ').find(Boolean) || '';
  const key = ENGLISH_ALIAS[first] || ENGLISH_ALIAS[foldToken(first)];
  return Boolean(key);
}

const QUERY_STOPWORDS = new Set([
  'de', 'del', 'para', 'por', 'con', 'y', 'e', 'en', 'el', 'la', 'los', 'las',
  'un', 'una', 'uno', 'al', 'que', 'su', 'se', 'lo', 'le', 'les', 'me', 'te',
  'es', 'mas', 'modelo', 'version',
]);

/** Acerca palabras que suenan parecido: carcaza/carcasa, v/b, h muda. */
function foldToken(token: string) {
  return token
    .replace(/ll/g, 'y')
    .replace(/h/g, '')
    .replace(/qu/g, 'k')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/c(?=[ei])/g, 's')
    .replace(/c/g, 'k');
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) row[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = current;
    }
  }
  return row[b.length];
}

function tokenSimilarity(queryToken: string, nameToken: string) {
  if (queryToken === nameToken) return 1;
  const queryDigit = digitOf(queryToken);
  const nameDigit = digitOf(nameToken);
  if (queryDigit || nameDigit) return queryDigit && nameDigit && queryDigit === nameDigit ? 1 : 0;
  const q = spokenKey(queryToken);
  const n = spokenKey(nameToken);
  if (!q || !n) return 0;
  if (q === n) return 1;
  if (q === `${n}s` || n === `${q}s` || q === `${n}es` || n === `${q}es`) return 0.94;
  if (q.length >= 4 && n.length >= 4 && (q.includes(n) || n.includes(q))) return 0.9;
  const dist = levenshtein(q, n);
  const ratio = 1 - dist / Math.max(q.length, n.length);
  if (Math.min(q.length, n.length) <= 3) return dist <= 1 && ratio >= 0.66 ? ratio : 0;
  return ratio >= 0.74 ? ratio : 0;
}

function queryTokens(query: string) {
  return tokensOf(query).filter((token) => !QUERY_STOPWORDS.has(token));
}

function bestTokenHit(token: string, nameTokens: string[]) {
  const digit = digitOf(token);
  if (digit) return nameTokens.some((nameToken) => digitOf(nameToken) === digit) ? 1 : 0;
  let best = 0;
  for (const nameToken of nameTokens) best = Math.max(best, tokenSimilarity(token, nameToken));
  return best;
}

function scoreAgainstInventory(query: string, catalog: VoiceCatalogItem[]) {
  const spoken = queryTokens(query);
  const names = catalog.map((product) => tokensOf(product.name));
  const frequency = new Map<string, number>();
  for (const tokens of names) {
    const seen = new Set<string>();
    for (const token of tokens) {
      if (/^\d+$/.test(token)) continue;
      const folded = foldToken(token);
      if (seen.has(folded)) continue;
      seen.add(folded);
      frequency.set(folded, (frequency.get(folded) || 0) + 1);
    }
  }

  const weightOf = (token: string) => {
    if (/^\d+$/.test(token)) return 1.35;
    const seen = frequency.get(foldToken(token)) || 0;
    return Math.log((catalog.length + 1) / (seen + 1)) + 1;
  };

  // "añada al carrito" no está en ningún producto: no debe bajar el parecido.
  const inInventory = spoken.filter((token) => names.some((nameTokens) => bestTokenHit(token, nameTokens) >= 0.74));
  const used = inInventory.length ? inInventory : spoken;

  return catalog.map((product, index) => {
    const name = normalizeVoiceText(product.name);
    const spokenName = normalizeVoiceText(query);
    if (name && name === spokenName) return { product, score: 1 };
    const productTokens = names[index];
    if (!used.length || !productTokens.length) return { product, score: 0 };
    let weighted = 0;
    let total = 0;
    for (const token of used) {
      const weight = weightOf(token);
      let best = 0;
      for (const nameToken of productTokens) {
        best = Math.max(best, tokenSimilarity(token, nameToken));
      }
      weighted += best * weight;
      total += weight;
    }
    let score = total ? weighted / total : 0;
    if (name.includes(spokenName)) score = Math.max(score, 0.93);
    return { product, score };
  }).sort((a, b) => b.score - a.score);
}

function samePrice(productPrice: number | undefined, spoken: number) {
  if (productPrice == null || !Number.isFinite(productPrice) || !Number.isFinite(spoken)) return false;
  return Math.abs(productPrice - spoken) < 0.02;
}

function nameFit(query: string, name: string) {
  const spoken = queryTokens(query);
  const nameTokens = queryTokens(name);
  let matched = 0;
  for (const nameToken of nameTokens) {
    if (spoken.some((token) => tokenSimilarity(token, nameToken) >= 0.9)) matched += 1;
  }
  return { matched, extra: Math.max(0, nameTokens.length - matched) };
}

function chooseRanked(ranked: Array<{ product: VoiceCatalogItem; score: number }>, query = '') {
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < 0.5) return { kind: 'none' as const, options: [] as VoiceCatalogItem[] };

  if (query && best.score >= 0.8) {
    const close = ranked.filter((row) => row.score >= best.score - 0.12).slice(0, 6);
    const rankedFit = close
      .map((row) => ({ ...row, ...nameFit(query, row.product.name) }))
      .sort((a, b) => b.matched - a.matched || a.extra - b.extra || b.score - a.score);
    const top = rankedFit[0];
    const next = rankedFit[1];
    const specific = Boolean(top && top.matched > 0 && (top.extra === 0 || top.matched > (next?.matched || 0)));
    if (specific && top) {
      return { kind: 'one' as const, options: [top.product] };
    }
  }

  const gap = best.score - (second?.score || 0);
  if (gap >= 0.1 || !second) {
    return { kind: 'one' as const, options: [best.product] };
  }

  const options = ranked
    .filter((row) => row.score >= Math.max(0.5, best.score - 0.08))
    .slice(0, 4)
    .map((row) => row.product);

  if (options.length <= 1) return { kind: 'one' as const, options: [best.product] };
  return { kind: 'many' as const, options };
}

export function matchCatalog(query: string, catalog: VoiceCatalogItem[], price?: number | null) {
  const ranked = scoreAgainstInventory(query, catalog);
  if (price == null) return chooseRanked(ranked, query);

  const priced = ranked.filter((row) => samePrice(row.product.price, price) && row.score >= 0.45);
  if (priced.length === 1) return { kind: 'one' as const, options: [priced[0].product] };
  if (priced.length > 1) return chooseRanked(priced, query);
  return chooseRanked(ranked, query);
}

function parseMoneyToken(token: string) {
  const spoken = SPOKEN_DIGITS[token];
  if (spoken) return Number(spoken);
  const value = Number(token.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Saca "de $9", "de 9 dólares" o "a nueve" para no confundir el precio con el modelo. */
export function takeSpokenPrice(raw: string): { price: number | null; rest: string } {
  const text = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const patterns = [
    /\$\s*(\d+(?:[.,]\d{1,2})?)/,
    /(\d+(?:[.,]\d{1,2})?)\s*(?:dolares|pesos)\b/,
    /(?:de|a|por|cuesta|vale)\s+(\d+(?:[.,]\d{1,2})?|cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:dolares|pesos)?\s*$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match || match.index == null) continue;
    const price = parseMoneyToken(match[1]);
    if (price == null) continue;
    const rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`.replace(/\s+/g, ' ').trim();
    return { price, rest };
  }

  return { price: null, rest: raw };
}

function cleanCommand(raw: string) {
  let text = normalizeVoiceText(raw);
  text = text
    .replace(/\b(por favor|al carrito|el carrito|del carrito|carrito)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const lead = /^(oye|hola|hey|buenas|favor|registra|registrar|registrame|quiero|vender|vende|agrega|agregar|agregue|agregame|anade|anada|anademe|mete|meteme|pon|ponme|ponle|suma|sumame|dame)\s+/;
  while (lead.test(text)) text = text.replace(lead, '');
  text = text.replace(/^(una venta de|la venta de|venta de)\s+/, '');
  return text.trim();
}

export function parseProductRequest(raw: string): { quantity: number; query: string; price: number | null } | null {
  const priced = takeSpokenPrice(raw);
  let text = cleanCommand(priced.rest);
  if (!text) {
    if (priced.price == null) return null;
    return { quantity: 1, query: '', price: priced.price };
  }

  let quantity = 1;
  const amount = text.match(/^(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+)\s+(.+)$/);
  const keepNumberInName = Boolean(amount && looksLikeEnglishName(amount[2]));
  if (amount && !keepNumberInName) {
    const word = amount[1];
    if (QUANTITY_WORDS[word]) {
      quantity = QUANTITY_WORDS[word];
      text = amount[2];
    } else if (/^\d+$/.test(word)) {
      const numeric = Number(word);
      if (numeric >= 1 && numeric <= 20) {
        quantity = numeric;
        text = amount[2];
      }
    }
  }

  text = text
    .replace(/^(de|la|el|los|las)\s+/, '')
    .replace(/\b(cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/g, (word) => SPOKEN_DIGITS[word] || word)
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length < 2) {
    if (priced.price == null) return null;
    return { quantity, query: '', price: priced.price };
  }
  return { quantity, query: text, price: priced.price };
}

function isStop(text: string) {
  return /^(para|parar|detener|chau|adios|salir)$/.test(text);
}

function isAbort(text: string) {
  const compact = text.replace(FINISH_FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (/^(cancela|cancelar|anula|anular|aborta|abortar|descarta|descartar|olvidalo|olvida|olvidalo todo|deja eso|dejalo)$/.test(compact)) return true;
  return /\b(cancela|cancelar|anula|anular|aborta|abortar|descarta|descartar)\b/.test(compact)
    && /\b(venta|operacion|pedido|orden|todo|carrito)\b/.test(compact);
}

function isClearCart(text: string) {
  return /\b(vacia|vaciar|vacialo|vacia el carrito|limpia|limpiar|limpia el carrito|borra todo|quita todo|quitar todo|elimina todo|eliminar todo|saca todo|sacar todo|quita todos|elimina todos|borra el carrito|borra los productos|quita los productos|elimina los productos)\b/.test(text);
}

function isRemoveCommand(text: string) {
  return isClearCart(text)
    || /\b(quita|quiteme|quitame|quitar|elimina|eliminar|saca|sacame|sacar|borra|borrar|remueve|remover|resta|restame|devuelve|devolver)\b/.test(text)
    || /\b(ya no quiero|no quiero el|no quiero la|no quiero los|no quiero las|sin el|sin la|sin los|sin las)\b/.test(text);
}

function productQueryFromClause(raw: string) {
  let text = normalizeVoiceText(raw);
  text = text.replace(/\b(por favor|del carrito|al carrito|el carrito|carrito)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const lead = /^(quita|quiteme|quitame|quitar|elimina|eliminar|saca|sacame|sacar|borra|borrar|remueve|remover|resta|restame|devuelve|devolver|fuera|ya no quiero|no quiero|sin)\s+/;
  while (lead.test(text)) text = text.replace(lead, '');
  text = text.replace(/^(el|la|los|las|un|una|uno)\s+/, '').trim();
  return text;
}

function wantsToResumeAdding(text: string) {
  const words = text.split(' ').filter(Boolean);
  const namesAProduct = /\b(agrega|agregar|anade|anada|suma|pon|mete)\b/.test(text)
    && words.length > 2
    && !/\b(mas|otro|otra|otros|otras)\b/.test(text);
  if (namesAProduct) return false;
  if (/^(agrega|agregar|otro|otra|espera|volver|volvamos|regresa|regresemos|atras|sigue|continuar|continua|sigamos)$/.test(text)) return true;
  return /\b(agregar mas|agrega mas|anadir mas|anade mas|seguir agregando|sigue agregando|volver a agregar|volvamos a agregar|regresar a agregar|regresa a agregar|mas productos|otros productos|otro producto|otra cosa|quiero agregar|quiero anadir|agrega otro|agregar otro|volver al catalogo|volver a los productos|regresar a los productos|sigamos agregando|continua agregando|aun no|todavia no|espera agrego|regresar|volvamos)\b/.test(text);
}

const FINISH_FILLER = /\b(por favor|porfa|gracias|muchas|muchisimas|amigo|oye|eh|este|pues|ahora|entonces|bueno|ok|okay|dale|favor)\b/g;

const FINISH_EXACT = /^(no|nop|nel|nada|nada mas|eso es todo|solo eso|solamente eso|unicamente eso|unicamente|solamente|ya|ya esta|ya estuvo|ya no|ya no mas|listo|con eso|con eso basta|eso nomas|eso no mas|no quiero mas|no quiero nada mas|asi nomas|asi esta|asi esta bien|que mas sigue|fin|final|hasta ahi|hasta aqui|es todo|seria todo|eso seria todo|basta|suficiente|es suficiente|ya es suficiente|se acabo|ya se acabo|se termino|y ya|y listo|y nada mas|caja|a la caja|a cobrar|a pagar|cobrar|cobralo|cobrarlo|cobra|pagar|paga|paguemos|cobremos|finaliza|finalizar|finalice|finalicen|finalicemos|finalizamos|termina|terminar|terminemos|termine|terminen|cierra|cerrar|cerremos|cierre|cierren|cierrala|cierralo|cierrame|acaba|acabar|acabemos|acabe|completa|completar|completemos|concluye|concluir|concluyamos|procesa|procesar|confirma|confirmar|confirmemos|procede|procedamos|registra la venta|registrar la venta|registrala|guardala|guardalo)$/;

const FINISH_VERB = /\b(finaliz\w*|finalic\w*|termina|terminar|terminemos|termine|terminen|termino|terminamos|terminala|terminalo|cierr\w*|cerremos|cerrar|cierre|cierren|cerramos|cerrarla|cerrarlo|cerramosla|acab\w*|complet\w*|conclu\w*|cobremos|cobrar|cobrala|cobralo|cobrarlo|cobramos|cobra|paguemos|pagar|pagamos|pagala|pagalo|paga|proces\w*|confirm\w*|proced\w*)\b/;

const FINISH_PHRASE = /\b(eso es todo|solo eso|solamente eso|unicamente eso|nada mas|es todo|seria todo|que mas sigue|hasta ahi|hasta aqui|no mas|no quiero mas|no quiero nada mas|no agregues mas|no anadas mas|no mas productos|sin mas|y listo|y ya|ya estuvo|se acabo|ya se acabo|se termino|es suficiente|ya es suficiente|con eso basta|con eso es suficiente|con eso ya|asi esta|asi nomas|asi esta bien|por ahora|a la caja|pasar a caja|pasa a caja|ir a caja|vamos a pagar|vamos a cobrar|vamos a finalizar|vamos a terminar|vamos a cerrar|quiero pagar|quiero cobrar|quiero finalizar|quiero terminar|quiero cerrar|hay que finalizar|hay que terminar|hay que cerrar|hay que cobrar|puedes cobrar|puedes finalizar|puedes cerrar|puedes terminar|listo para pagar|listo para cobrar|pasemos a pagar|pasar a pagar|ir a pagar|pasa a pagar|registra la venta|registrar la venta|guarda la venta|guarda el pedido|cierra la venta|cierra el pedido|cierra la orden)\b/;

function isFinish(text: string) {
  const compact = text.replace(FINISH_FILLER, ' ').replace(/\s+/g, ' ').trim();
  const bare = compact.replace(/^(ya|entonces|bueno|ok|okay|dale)\s+/, '').trim();
  const phrases = bare && bare !== compact ? [compact, bare] : [compact];
  return phrases.some((phrase) => FINISH_EXACT.test(phrase) || FINISH_VERB.test(phrase) || FINISH_PHRASE.test(phrase));
}

function isYesOnly(text: string) {
  return /^(si|sip|claro|dale|ok|okay|agrega otro|otro|otra)$/.test(text);
}

const PAYMENT_WORD = /\b(tarjetas|tarjeta|tarjta|datafono|debito|visa|mastercard|transferencias|transferencia|transfer|trasferencia|trasnferencia|transferecia|nequi|daviplata|deuna|depositos|deposito|consignacion|efectivo|efetivo|efecivo|cash|contado|billetes|billete|credito|fiado|fiao|fiar|otro medio|otros)\b/g;

export function parsePayment(raw: string): VoicePaymentMethod | 'credito' | null {
  const text = normalizeVoiceText(raw);
  if (/\b(tarjetas|tarjeta|tarjta|datafono|debito|visa|mastercard)\b/.test(text)) return 'Tarjeta';
  if (
    /\b(transferencias|transferencia|transfer|trasferencia|trasnferencia|transferecia|nequi|daviplata|deuna|depositos|deposito|consignacion)\b/.test(text)
    || /\b(con|por|en|mediante|pago)\s+de\s+una\b/.test(text)
  ) return 'Transferencia';
  if (/\b(efectivo|efetivo|efecivo|cash|contado|billetes|billete)\b/.test(text)) return 'Efectivo';
  if (/\b(otros|otro medio)\b/.test(text)) return 'Otros';
  if (/\b(credito|fiado|fiao|fiar)\b/.test(text)) return 'credito';
  return null;
}

function bundledPayment(text: string): VoicePaymentMethod | 'credito' | null {
  const method = parsePayment(text);
  if (!method) return null;
  if (isFinish(text)) return method;
  const stripped = text
    .replace(PAYMENT_WORD, ' ')
    .replace(/\bde\s+una\b/g, ' ')
    .replace(/\b(con|en|por|mediante|usando|via|pago|metodo|forma|medio|de|el|la|los|las|un|una|y|a)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped || stripped === text) return null;
  return isFinish(stripped) ? method : null;
}

function spokenMethod(method: VoicePaymentMethod) {
  if (method === 'Efectivo') return 'efectivo';
  if (method === 'Tarjeta') return 'tarjeta';
  if (method === 'Transferencia') return 'transferencia';
  return 'otro medio';
}

function cartHasItems(context: VoiceContext) {
  return context.cart.some((line) => line.quantity > 0);
}

function sayOptions(options: VoiceCatalogItem[]) {
  const list = options.map((product, index) => `${index + 1}, ${product.name}`).join('. ');
  return `En el inventario se parecen estas. ${list}. ¿Cuál es?`;
}

function spokenTotal(totalLabel: string) {
  const clean = String(totalLabel || '').trim();
  if (!clean) return '$0';
  return clean.startsWith('$') ? clean : `$${clean}`;
}

function paymentPrompt(totalLabel: string) {
  return `Ok, el total es de ${spokenTotal(totalLabel)}. ¿Cuál es el método de pago?`;
}

function keep(state: VoiceDialogState, say: string, extra: Partial<VoiceTurn> = {}): VoiceTurn {
  return {
    step: state.step,
    options: state.options,
    pendingQuantity: state.pendingQuantity,
    say,
    ...extra,
  };
}

function goPay(state: VoiceDialogState, context: VoiceContext): VoiceTurn {
  return {
    step: 'pay',
    options: [],
    pendingQuantity: state.pendingQuantity,
    say: paymentPrompt(context.totalLabel),
    openPaymentSheet: true,
  };
}

function completeSale(state: VoiceDialogState, context: VoiceContext, method: VoicePaymentMethod | 'credito'): VoiceTurn {
  if (method === 'credito') {
    return {
      step: 'pay',
      options: [],
      pendingQuantity: state.pendingQuantity,
      say: 'Para vender a crédito hay que elegir el cliente. Te abro la pantalla de pago.',
      openPaymentSheet: true,
      end: true,
    };
  }
  return {
    step: 'pay',
    options: [],
    pendingQuantity: state.pendingQuantity,
    say: `Ok, el total es de ${spokenTotal(context.totalLabel)}. La venta con ${spokenMethod(method)} ha sido registrada.`,
    checkout: { method },
  };
}

function resumeAdding(): VoiceTurn {
  return {
    step: 'collect',
    options: [],
    pendingQuantity: 1,
    say: '¿Qué más agrego?',
    closePaymentSheet: true,
  };
}

function abortSale(): VoiceTurn {
  return {
    step: 'collect',
    options: [],
    pendingQuantity: 1,
    say: 'Cancelé la operación. El carrito quedó vacío.',
    clearCart: true,
    closePaymentSheet: true,
    end: true,
  };
}

function cartCatalog(context: VoiceContext): VoiceCatalogItem[] {
  return context.cart
    .filter((line) => line.quantity > 0)
    .map((line) => ({
      id: line.productId,
      name: line.name || context.catalog.find((product) => product.id === line.productId)?.name || 'Producto',
      stock: line.quantity,
      price: line.price,
    }));
}

function removalTurn(removed: VoiceCatalogItem[], context: VoiceContext, step: VoiceStep): VoiceTurn {
  const removedIds = new Set(removed.map((product) => product.id));
  const remaining = context.cart.filter((line) => line.quantity > 0 && !removedIds.has(line.productId));
  const names = joinSpoken(removed.map((product) => `el producto ${product.name}`));
  const removes = removed.map((product) => ({ productId: product.id, name: product.name }));
  if (!remaining.length) {
    return {
      step: 'collect',
      options: [],
      pendingQuantity: 1,
      say: `Quité ${names} del carrito. El carrito quedó vacío.`,
      removes,
      closePaymentSheet: true,
    };
  }
  return {
    step: step === 'pay' ? 'pay' : 'more',
    options: [],
    pendingQuantity: 1,
    say: `Quité ${names} del carrito.`,
    removes,
  };
}

function removeProducts(raw: string, context: VoiceContext, step: VoiceStep): VoiceTurn {
  const text = normalizeVoiceText(raw);
  if (isClearCart(text)) {
    return {
      step: 'collect',
      options: [],
      pendingQuantity: 1,
      say: 'Vacié el carrito.',
      clearCart: true,
      closePaymentSheet: true,
    };
  }

  const inCart = cartCatalog(context);
  if (!inCart.length) {
    return {
      step: 'collect',
      options: [],
      pendingQuantity: 1,
      say: 'El carrito está vacío. Dime cuál agrego.',
    };
  }

  const clauses = splitProductClauses(raw);
  const removed: VoiceCatalogItem[] = [];
  const missing: string[] = [];
  let ambiguous: VoiceCatalogItem[] | null = null;

  for (const clause of clauses.length ? clauses : [raw]) {
    const query = productQueryFromClause(clause);
    if (!query || /^(ese|eso|este|esta|el ultimo|la ultima)$/.test(query)) {
      const target = inCart.find((product) => !removed.some((item) => item.id === product.id));
      if (target) removed.push(target);
      continue;
    }
    const pool = inCart.filter((product) => !removed.some((item) => item.id === product.id));
    const priced = parseProductRequest(clause)?.price ?? null;
    const match = matchCatalog(query, pool, priced);
    if (match.kind === 'one') removed.push(match.options[0]);
    else if (match.kind === 'many' && !ambiguous) ambiguous = match.options;
    else if (match.kind === 'none') missing.push(query);
  }

  if (!removed.length && ambiguous) {
    return {
      step: 'choose',
      chooseAction: 'remove',
      options: ambiguous,
      pendingQuantity: 1,
      say: `En el carrito se parecen estas. ${ambiguous.map((product, index) => `${index + 1}, ${product.name}`).join('. ')}. ¿Cuál quito?`,
    };
  }
  if (!removed.length) {
    return {
      step: step === 'pay' ? 'pay' : 'more',
      options: [],
      pendingQuantity: 1,
      say: `No hallé ${joinSpoken(missing)} en el carrito.`,
    };
  }

  const turn = removalTurn(removed, context, step);
  if (ambiguous) {
    return {
      ...turn,
      step: 'choose',
      chooseAction: 'remove',
      options: ambiguous,
      say: `${turn.say} ${ambiguous.map((product, index) => `${index + 1}, ${product.name}`).join('. ')}. ¿Cuál más quito?`,
    };
  }
  if (missing.length) turn.say = `${turn.say} No hallé ${joinSpoken(missing)} en el carrito.`;
  return turn;
}

function addedLine(product: VoiceCatalogItem, quantity: number) {
  return quantity > 1 ? `${quantity} del producto ${product.name}` : `el producto ${product.name}`;
}

function joinSpoken(parts: string[]) {
  if (parts.length <= 1) return parts[0] || '';
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

function addProducts(lines: { product: VoiceCatalogItem; quantity: number }[]): VoiceTurn {
  const say = `Añadí ${joinSpoken(lines.map((line) => addedLine(line.product, line.quantity)))} al carrito.`;
  return {
    step: 'more',
    options: [],
    pendingQuantity: 1,
    say,
    add: lines[0],
    adds: lines,
  };
}

function addProduct(product: VoiceCatalogItem, quantity: number, _mentionedPrice?: number | null): VoiceTurn {
  return addProducts([{ product, quantity }]);
}

/** Separa "el adaptador de $7 y la carcasa de $32" sin partir "gopro 9 y 10". */
export function splitProductClauses(raw: string): string[] {
  const text = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bgo\s+pro\b/g, 'gopro')
    .replace(/[^a-z0-9\s$,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return [];

  const pieces = text.split(/\s*(?:,|\by\b|\be\b|\btambien\b|\bademas\b)\s+(?=(?:un|una|uno|el|la|los|las|otro|otra|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+\s+)?[a-z])/);
  const clauses: string[] = [];
  for (const piece of pieces) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const letters = trimmed.replace(/[^a-z]/g, '');
    if (letters.length < 3 && clauses.length) clauses[clauses.length - 1] += ` y ${trimmed}`;
    else clauses.push(trimmed);
  }
  return clauses.length ? clauses : [text];
}

type ResolvedClause =
  | { kind: 'one'; product: VoiceCatalogItem; quantity: number }
  | { kind: 'many'; options: VoiceCatalogItem[]; quantity: number; query: string }
  | { kind: 'none'; query: string; quantity: number };

function resolveClause(raw: string, context: VoiceContext, fallbackQuantity = 1): ResolvedClause {
  const parsed = parseProductRequest(raw);
  const query = parsed?.query;
  const quantity = parsed?.quantity || fallbackQuantity;
  const price = parsed?.price ?? null;
  if (!query) {
    if (price != null) {
      const priced = context.catalog.filter((product) => samePrice(product.price, price));
      if (priced.length === 1) return { kind: 'one', product: priced[0], quantity };
      if (priced.length > 1) return { kind: 'many', options: priced.slice(0, 4), quantity, query: '' };
    }
    return { kind: 'none', query: '', quantity };
  }

  const match = matchCatalog(query, context.catalog, price);
  if (match.kind === 'none') return { kind: 'none', query, quantity };
  if (match.kind === 'many') return { kind: 'many', options: match.options, quantity, query };
  return { kind: 'one', product: match.options[0], quantity };
}

function turnFromResolved(resolved: ResolvedClause[]): VoiceTurn {
  const added = resolved.filter((item): item is Extract<ResolvedClause, { kind: 'one' }> => item.kind === 'one');
  const pending = resolved.filter((item) => item.kind !== 'one');
  const lines = added.map((item) => ({ product: item.product, quantity: item.quantity }));

  if (!lines.length) {
    const problem = pending[0];
    if (problem?.kind === 'many') {
      return {
        step: 'choose',
        options: problem.options,
        pendingQuantity: problem.quantity,
        say: sayOptions(problem.options),
      };
    }
    const query = problem && 'query' in problem ? problem.query : '';
    return {
      step: 'collect',
      options: [],
      pendingQuantity: 1,
      say: query
        ? `No hallé en el inventario algo parecido a ${query}. Dime otra palabra del producto.`
        : 'Dime el nombre del producto.',
    };
  }

  const addedTurn = addProducts(lines);
  if (!pending.length) return addedTurn;

  const problem = pending[0];
  if (problem.kind === 'many') {
    return {
      ...addedTurn,
      step: 'choose',
      options: problem.options,
      pendingQuantity: problem.quantity,
      say: `${addedTurn.say} ${sayOptions(problem.options)}`,
    };
  }

  const missing = pending
    .filter((item): item is Extract<ResolvedClause, { kind: 'none' }> => item.kind === 'none' && Boolean(item.query))
    .map((item) => item.query);
  const missingSay = missing.length
    ? ` No hallé ${joinSpoken(missing)}.`
    : '';
  return { ...addedTurn, say: `${addedTurn.say}${missingSay}` };
}

function searchAndAdd(raw: string, context: VoiceContext, fallbackQuantity = 1): VoiceTurn {
  const clauses = splitProductClauses(raw);
  const resolved = (clauses.length ? clauses : [raw]).map((clause) => resolveClause(clause, context, fallbackQuantity));
  return turnFromResolved(resolved);
}

function pickOption(raw: string, options: VoiceCatalogItem[]) {
  const text = cleanCommand(raw);
  const ordinals: Record<string, number> = {
    '1': 0,
    uno: 0,
    una: 0,
    primero: 0,
    primera: 0,
    'la primera': 0,
    'el primero': 0,
    '2': 1,
    dos: 1,
    segundo: 1,
    segunda: 1,
    'la segunda': 1,
    'el segundo': 1,
    '3': 2,
    tres: 2,
    tercero: 2,
    tercera: 2,
    'la tercera': 2,
    'el tercero': 2,
    '4': 3,
    cuatro: 3,
    cuarto: 3,
    cuarta: 3,
    'la cuarta': 3,
    'el cuarto': 3,
  };
  if (text in ordinals && options[ordinals[text]]) return options[ordinals[text]];

  const numbered = text.match(/^(la|el|opcion|numero)?\s*(\d+)$/);
  if (numbered) {
    const index = Number(numbered[2]) - 1;
    if (options[index]) return options[index];
  }

  const match = matchCatalog(text, options);
  if (match.kind === 'one') return match.options[0];
  return null;
}

export function handleVoiceTurn(state: VoiceDialogState, raw: string, context: VoiceContext): VoiceTurn {
  const text = normalizeVoiceText(raw);
  if (!text) {
    return keep(state, 'No te escuché. Repite, por favor.');
  }
  if (isStop(text)) {
    return keep(state, 'Detuve el asistente. El carrito se queda como está.', { end: true });
  }
  if (isAbort(text)) return abortSale();

  const bundled = bundledPayment(text);
  if (bundled) {
    if (!cartHasItems(context)) {
      return keep(state, 'Todavía no hay productos. Dime cuál agrego.');
    }
    return completeSale(state, context, bundled);
  }

  if (cartHasItems(context) && !isFinish(text) && isRemoveCommand(text)) {
    return removeProducts(raw, context, state.step);
  }

  if (state.step === 'choose' && state.chooseAction === 'remove') {
    if (/^(ninguna|ninguno|otra|nada)$/.test(text)) {
      return {
        step: 'more',
        options: [],
        pendingQuantity: 1,
        say: 'De acuerdo. No quité nada más.',
      };
    }
    const picked = pickOption(productQueryFromClause(raw) || raw, state.options);
    if (picked) return removalTurn([picked], context, 'more');
    return removeProducts(raw, context, state.step);
  }

  if (state.step === 'choose') {
    if (/^(ninguna|ninguno|otra)$/.test(text)) {
      return {
        step: 'collect',
        options: [],
        pendingQuantity: 1,
        say: 'De acuerdo. Dime el producto otra vez.',
      };
    }
    const picked = pickOption(raw, state.options);
    if (picked) return addProduct(picked, state.pendingQuantity, parseProductRequest(raw)?.price);
    return searchAndAdd(raw, context);
  }

  if (state.step === 'more') {
    if (isFinish(text)) return goPay(state, context);
    if (isYesOnly(text) || wantsToResumeAdding(text)) return resumeAdding();
    const affirmed = text.match(/^(si|claro|dale|ok|okay)\s+(.+)$/);
    return searchAndAdd(affirmed ? affirmed[2] : raw, context);
  }

  if (state.step === 'pay') {
    if (wantsToResumeAdding(text) || isYesOnly(text)) return resumeAdding();
    if (isRemoveCommand(text)) return removeProducts(raw, context, 'pay');
    const method = parsePayment(text);
    if (method === 'credito') {
      return keep(state, 'Para vender a crédito hay que elegir el cliente. Te abro la pantalla de pago.', {
        openPaymentSheet: true,
        end: true,
      });
    }
    if (method) {
      if (!cartHasItems(context)) {
        return {
          step: 'collect',
          options: [],
          pendingQuantity: 1,
          say: 'El carrito está vacío. Dime primero el producto.',
          closePaymentSheet: true,
        };
      }
      return keep(state, 'Ok, la venta ha sido registrada.', {
        checkout: { method },
      });
    }
    const request = parseProductRequest(raw);
    if (request?.query) return { ...searchAndAdd(raw, context), closePaymentSheet: true };
    return keep(state, 'Puedes decir efectivo, tarjeta, transferencia o crédito.');
  }

  if (cartHasItems(context) && isFinish(text)) {
    return goPay(state, context);
  }
  if (!cartHasItems(context) && isFinish(text)) {
    return keep(state, 'Todavía no hay productos. Dime cuál agrego.');
  }

  return searchAndAdd(raw, context);
}
