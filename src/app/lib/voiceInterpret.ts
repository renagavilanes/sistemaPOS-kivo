import { API_BASE_URL } from './supabase';
import type { VoiceCartLine, VoiceCatalogItem, VoiceIntent, VoiceStep } from './voiceSaleDialog';

const ACTIONS = new Set([
  'add',
  'remove',
  'clear',
  'finish',
  'pay',
  'skip',
  'cancel',
  'resume',
  'answer',
  'choose',
]);

function asIntent(value: unknown): VoiceIntent | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!ACTIONS.has(String(raw.action))) return null;
  const lines = Array.isArray(raw.lines)
    ? raw.lines
        .map((line) => {
          const item = line as Record<string, unknown>;
          const id = String(item?.id || '').trim();
          if (!id) return null;
          return { id, quantity: Number(item.quantity) || 1 };
        })
        .filter((line): line is { id: string; quantity: number } => Boolean(line))
    : undefined;
  const removeIds = Array.isArray(raw.removeIds)
    ? raw.removeIds.map((id) => String(id || '').trim()).filter(Boolean)
    : undefined;
  return {
    action: String(raw.action) as VoiceIntent['action'],
    lines,
    removeIds,
    option: Number(raw.option) || undefined,
    method: raw.method ? String(raw.method) : undefined,
    say: raw.say ? String(raw.say) : undefined,
  };
}

/** Pide a la IA una orden de venta. Si no hay cuota, red o clave, devuelve null y sigue el bot. */
export async function interpretVoicePhrase(input: {
  accessToken: string;
  phrase: string;
  step: VoiceStep;
  options: VoiceCatalogItem[];
  catalog: VoiceCatalogItem[];
  cart: VoiceCartLine[];
  totalLabel: string;
}): Promise<VoiceIntent | null> {
  if (!input.accessToken || input.phrase.trim().length < 2) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${API_BASE_URL}/voice/interpret`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({
        phrase: input.phrase.slice(0, 400),
        step: input.step,
        totalLabel: input.totalLabel,
        options: input.options.slice(0, 6).map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price ?? 0,
        })),
        catalog: input.catalog.slice(0, 400).map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price ?? 0,
          stock: item.stock,
        })),
        cart: input.cart.map((line) => ({
          id: line.productId,
          name: line.name || '',
          price: line.price ?? 0,
          quantity: line.quantity,
        })),
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || data.fallback) return null;
    return asIntent(data.intent);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
