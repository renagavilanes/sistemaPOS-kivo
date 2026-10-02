const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite';

const INSTRUCTIONS = `Eres el cajero de voz de un punto de venta. Tu única función es armar una venta: entender la frase, elegir productos del inventario, quitarlos, contestar dudas de esa venta y pasar a cobrar.

Responde solo JSON:
{"action":"add|remove|clear|finish|pay|skip|cancel|resume|answer|choose","lines":[{"id":"","quantity":1}],"removeIds":[],"option":1,"method":"Efectivo|Tarjeta|Transferencia|Otros|credito","say":""}

Reglas:
- Usa únicamente ids que aparecen en el inventario. Nunca inventes un producto.
- Si dos productos se parecen y el nombre o el precio no alcanzan para distinguirlos, action "answer" y en say pregunta cuál, con los nombres reales. No elijas al azar.
- Si la frase trae un precio, elige el producto con ese precio.
- "tre guay", "tres guay" o "3 way" es el producto llamado 3 Way. Si dice 2 o dos, es 3 Way 2.0.
- La cantidad dicha ("dos", "tres") va en quantity. Un número de modelo, como gopro 8, no es cantidad ni precio.
- add: lines con los productos a agregar.
- remove: removeIds de productos que ya están en el carrito.
- clear: vaciar el carrito.
- finish: pasar a cobrar, sin método. Si en la misma frase nombra productos, van en lines.
- pay: method obligatorio. credito significa vender a crédito y hay que elegir cliente.
- skip: dejar el carrito como está y no agregar la opción dudosa.
- cancel: anular la venta y vaciar.
- resume: volver a agregar productos.
- choose: option es 1, 2 o 3 según las opciones numeradas.
- answer: precio, stock, qué hay, o una duda de la venta que no cambia el carrito. say es una frase corta en español. Si el producto no está, dilo y pide otro.
- Si hablan de algo ajeno a la venta, action answer y di que solo puedes armar la venta.
- No digas que la venta ya fue registrada.`;

function clip(value: unknown, max: number) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function catalogOf(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max).map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: clip(row.id, 80),
      name: clip(row.name, 80),
      price: Number(row.price) || 0,
      stock: Number(row.stock) || 0,
      quantity: Number(row.quantity) || 0,
    };
  }).filter((item) => item.id && item.name);
}

function readIntent(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function registerVoiceInterpretRoute(app: any, supabaseAuth: any) {
  app.post('/make-server-3508045b/voice/interpret', async (c: any) => {
    const apiKey = (Deno.env.get('GEMINI_API_KEY') ?? '').trim();
    if (!apiKey) return c.json({ fallback: true, reason: 'sin clave' });

    const header = c.req.header('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return c.json({ error: 'No autorizado' }, 401);
    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) return c.json({ error: 'No autorizado' }, 401);

    let body: Record<string, unknown> = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ fallback: true });
    }

    const phrase = clip(body.phrase, 400);
    if (phrase.length < 2) return c.json({ fallback: true });

    const payload = {
      frase: phrase,
      paso: clip(body.step, 20),
      total: clip(body.totalLabel, 40),
      opciones: catalogOf(body.options, 6),
      carrito: catalogOf(body.cart, 40),
      inventario: catalogOf(body.catalog, 400),
    };

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(7000),
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 400,
              responseMimeType: 'application/json',
            },
          }),
        },
      );
      if (!response.ok) {
        console.log('voice interpret fallback', response.status);
        return c.json({ fallback: true });
      }
      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((part: { text?: string }) => part?.text || '').join('');
      const intent = readIntent(text);
      if (!intent) return c.json({ fallback: true });
      return c.json({ intent });
    } catch (err) {
      console.log('voice interpret error', err instanceof Error ? err.message : 'falló');
      return c.json({ fallback: true });
    }
  });
}
