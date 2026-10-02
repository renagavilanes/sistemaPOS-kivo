import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CartItem, Product } from '../types';
import { LazyProductImage } from './LazyProductImage';
import {
  collapseVoiceTranscript,
  handleVoiceTurn,
  initialVoiceState,
  normalizeVoiceText,
  openingLine,
  parsePayment,
  paymentOnlyMethod,
  type VoiceDialogState,
  type VoicePaymentMethod,
  type VoiceStep,
} from '../lib/voiceSaleDialog';

type VoiceProductCard = {
  id: string;
  name: string;
  image?: string;
  quantity: number;
};

type SpeechResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult> & { length: number };
};

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recognitionCtor(): (new () => SpeechRec) | null {
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return host.SpeechRecognition || host.webkitSpeechRecognition || null;
}

function spanishVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const paulina = voices.find((voice) => voice.name.toLowerCase().startsWith('paulina') && voice.lang?.toLowerCase().startsWith('es'));
  if (paulina) return paulina;
  return voices.find((voice) => voice.lang?.toLowerCase().startsWith('es-mx')) || null;
}

const VOICE_INTRO =
  'Este es un asistente de voz. Te ayuda a añadir productos más rápido al carrito y a finalizar la venta.';
const VOICE_INTRO_KEY = 'kivo_voice_intro_seen';

function voiceIntroSeen(userId: string) {
  try {
    return localStorage.getItem(`${VOICE_INTRO_KEY}_${userId}`) === '1';
  } catch {
    return true;
  }
}

function markVoiceIntroSeen(userId: string) {
  try {
    localStorage.setItem(`${VOICE_INTRO_KEY}_${userId}`, '1');
  } catch {
    /* el navegador no guarda */
  }
}

function isEcho(heard: string, spoken: string) {
  const a = normalizeVoiceText(heard);
  const b = normalizeVoiceText(spoken);
  if (!a || !b || a.length < 12) return false;
  return a.length >= b.length * 0.6 && (b.includes(a) || a.includes(b));
}

export function VoiceSaleAgent({
  products,
  cartItems,
  totalLabel,
  onAdd,
  onCheckout,
  onOpenPayment,
  onClosePayment,
  onRemove,
  onClearCart,
  onFocusProduct,
}: {
  products: Product[];
  cartItems: CartItem[];
  totalLabel: string;
  onAdd: (product: Product, quantity: number) => void;
  onCheckout: (method: VoicePaymentMethod) => Promise<void>;
  onOpenPayment: () => void;
  onClosePayment: () => void;
  onRemove: (productId: string) => void;
  onClearCart: () => void;
  onFocusProduct: (productId: string) => void;
}) {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [micNote, setMicNote] = useState('');
  const [heard, setHeard] = useState('');
  const [live, setLive] = useState('');
  const [say, setSay] = useState('');
  const [canListen, setCanListen] = useState(true);
  const [step, setStep] = useState<VoiceStep>('collect');
  const [cards, setCards] = useState<VoiceProductCard[]>([]);
  const [introPhase, setIntroPhase] = useState<'telling' | 'cta' | null>(null);
  const [introText, setIntroText] = useState('');

  const stateRef = useRef<VoiceDialogState>(initialVoiceState());
  const recognitionRef = useRef<SpeechRec | null>(null);
  const productsRef = useRef(products);
  const cartRef = useRef(cartItems);
  const totalRef = useRef(totalLabel);
  const onAddRef = useRef(onAdd);
  const onCheckoutRef = useRef(onCheckout);
  const onOpenPaymentRef = useRef(onOpenPayment);
  const onClosePaymentRef = useRef(onClosePayment);
  const onRemoveRef = useRef(onRemove);
  const onClearCartRef = useRef(onClearCart);
  const onFocusProductRef = useRef(onFocusProduct);
  const consumeRef = useRef<(utterance: string) => Promise<void>>(async () => {});
  const speakRef = useRef<(text: string, next: 'listen' | 'stay' | 'close') => void>(() => {});
  const armRef = useRef<() => void>(() => {});
  const speakGenRef = useRef(0);
  const wantListenRef = useRef(false);
  const acceptResultsRef = useRef(false);
  const pendingRef = useRef('');
  const pauseTimerRef = useRef(0);
  const lastSaidRef = useRef('');
  const networkFailsRef = useRef(0);
  const pausedForSpeechRef = useRef(false);
  const speakingRef = useRef(false);
  const onResultRef = useRef<(event: SpeechEvent) => void>(() => {});
  const recognitionRunningRef = useRef(false);
  const phraseStartRef = useRef(0);
  const resultCountRef = useRef(0);
  const introRef = useRef<'telling' | 'cta' | null>(null);
  const introPendingRef = useRef(false);
  introRef.current = introPhase;

  productsRef.current = products;
  cartRef.current = cartItems;
  totalRef.current = totalLabel;
  onAddRef.current = onAdd;
  onCheckoutRef.current = onCheckout;
  onOpenPaymentRef.current = onOpenPayment;
  onClosePaymentRef.current = onClosePayment;
  onRemoveRef.current = onRemove;
  onClearCartRef.current = onClearCart;
  onFocusProductRef.current = onFocusProduct;

  const commitHeard = (text: string) => {
    const clean = text.trim();
    if (!clean || isEcho(clean, lastSaidRef.current)) return;
    window.clearTimeout(pauseTimerRef.current);
    pendingRef.current = '';
    acceptResultsRef.current = false;
    wantListenRef.current = false;
    setLive('');
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ya estaba detenido */
    }
    void consumeRef.current(clean);
  };

  const queuePhrase = (text: string, stable: boolean) => {
    if (!acceptResultsRef.current) return;
    const next = text.replace(/\s+/g, ' ').trim();
    if (next.length < 2) return;
    pendingRef.current = next;
    setLive(next);
    window.clearTimeout(pauseTimerRef.current);
    const paying = Boolean(paymentOnlyMethod(next)) || (stateRef.current.step === 'pay' && Boolean(parsePayment(next)));
    if (!stable && !paying) return;
    const commit = () => {
      if (pendingRef.current.trim().length < 2) return;
      phraseStartRef.current = resultCountRef.current;
      commitHeard(pendingRef.current);
    };
    if (paying) {
      commit();
      return;
    }
    pauseTimerRef.current = window.setTimeout(commit, 800);
  };

  armRef.current = () => {
    const rec = recognitionRef.current;
    if (!rec) {
      setCanListen(false);
      setMicNote('Este navegador no reconoce la voz. Ábrelo en Chrome para hablar.');
      return;
    }
    wantListenRef.current = true;
    setListening(true);
    if (recognitionRunningRef.current) return;
    try {
      rec.start();
    } catch {
      // Sigue abierto o todavía se está cerrando. onend lo reabre si hace falta.
    }
  };

  speakRef.current = (text: string, next: 'listen' | 'stay' | 'close') => {
    const generation = ++speakGenRef.current;
    lastSaidRef.current = text;
    pausedForSpeechRef.current = next === 'listen';
    speakingRef.current = true;
    wantListenRef.current = false;
    acceptResultsRef.current = false;
    if (next === 'listen') setListening(true);
    else setListening(false);
    setLive('');
    setSay(text);
    window.clearTimeout(pauseTimerRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* aún no iniciado */
    }

    const finish = () => {
      if (generation !== speakGenRef.current) return;
      speakingRef.current = false;
      pausedForSpeechRef.current = false;
      if (introPendingRef.current && next === 'stay') {
        introPendingRef.current = false;
        introRef.current = 'cta';
        setIntroText(VOICE_INTRO);
        setIntroPhase('cta');
      }
      if (next === 'listen') armRef.current();
      else if (next === 'close') {
        wantListenRef.current = false;
        setActive(false);
        setListening(false);
      }
    };

    const synth = window.speechSynthesis;
    if (!synth) {
      finish();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    const voice = spanishVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.4;
    let settled = false;
    const done = () => {
      if (settled || generation !== speakGenRef.current) return;
      settled = true;
      window.clearTimeout(fallback);
      finish();
    };
    const fallback = window.setTimeout(done, Math.min(9000, text.length * 75 + 1200));
    utterance.onend = done;
    utterance.onerror = done;
    synth.cancel();
    window.setTimeout(() => {
      if (generation !== speakGenRef.current) return;
      synth.resume();
      synth.speak(utterance);
    }, 60);
  };

  consumeRef.current = async (utterance: string) => {
    const context = {
      catalog: productsRef.current.map((product) => ({
        id: product.id,
        name: product.name,
        stock: Number(product.stock) || 0,
        price: Number(product.price) || 0,
      })),
      cart: cartRef.current.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        name: item.product.name,
        price: Number(item.priceAtSale) || Number(item.product.price) || 0,
      })),
      totalLabel: totalRef.current,
    };
    const turn = handleVoiceTurn(stateRef.current, utterance, context);
    stateRef.current = {
      step: turn.step,
      options: turn.options,
      pendingQuantity: turn.pendingQuantity,
      chooseAction: turn.chooseAction,
    };
    setStep(turn.step);
    setHeard(utterance);
    setSay(turn.say);

    if (turn.closePaymentSheet) onClosePaymentRef.current();
    if (turn.clearCart) onClearCartRef.current();
    turn.removes?.forEach((line, index, all) => {
      if (index === all.length - 1) onFocusProductRef.current(line.productId);
      onRemoveRef.current(line.productId);
    });

    const lines = turn.adds?.length ? turn.adds : turn.add ? [turn.add] : [];
    const nextCards: VoiceProductCard[] = [];
    lines.forEach((line, index) => {
      const product = productsRef.current.find((item) => item.id === line.product.id);
      if (!product) return;
      nextCards.push({
        id: product.id,
        name: product.name,
        image: product.image,
        quantity: line.quantity,
      });
      if (index === lines.length - 1) onFocusProductRef.current(product.id);
      onAddRef.current(product, line.quantity);
    });
    setCards(nextCards);
    if (turn.openPaymentSheet) onOpenPaymentRef.current();

    if (turn.checkout) {
      setBusy(true);
      speakRef.current(turn.say, 'close');
      try {
        await onCheckoutRef.current(turn.checkout.method);
      } catch {
        speakRef.current('No pude registrar la venta. Dime otra vez cómo es el pago.', 'listen');
      } finally {
        setBusy(false);
      }
      return;
    }

    speakRef.current(turn.say, turn.end ? 'close' : 'listen');
  };

  useEffect(() => {
    const Ctor = recognitionCtor();
    setCanListen(Boolean(Ctor));
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => {
      recognitionRunningRef.current = true;
      phraseStartRef.current = 0;
      resultCountRef.current = 0;
      acceptResultsRef.current = true;
      networkFailsRef.current = 0;
      setListening(true);
      setMicNote('');
    };
    rec.onresult = (event) => onResultRef.current(event);
    rec.onerror = (event) => {
      const code = event.error || '';
      if (code === 'aborted' || code === 'no-speech') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        wantListenRef.current = false;
        setListening(false);
        acceptResultsRef.current = false;
        setMicNote('El navegador bloqueó el micrófono. Permítelo en el candado de la barra de dirección y toca Escuchar.');
        return;
      }
      if (code === 'audio-capture') {
        wantListenRef.current = false;
        setListening(false);
        setMicNote('No encuentro un micrófono en este equipo.');
        return;
      }
      if (code === 'network') {
        networkFailsRef.current += 1;
        if (networkFailsRef.current >= 3) {
          wantListenRef.current = false;
          setMicNote('No pude conectar el reconocimiento de voz. Ábrelo en Chrome, con internet, y toca Escuchar.');
        }
      }
    };
    rec.onend = () => {
      recognitionRunningRef.current = false;
      acceptResultsRef.current = false;
      if (pausedForSpeechRef.current) return;
      if (!wantListenRef.current) {
        setListening(false);
        return;
      }
      window.setTimeout(() => {
        if (!wantListenRef.current || recognitionRunningRef.current) return;
        try {
          rec.start();
        } catch {
          /* sigue abierto */
        }
      }, 300);
    };
    recognitionRef.current = rec;

    const loadVoices = () => {
      window.speechSynthesis?.getVoices();
    };
    loadVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      wantListenRef.current = false;
      acceptResultsRef.current = false;
      window.clearTimeout(pauseTimerRef.current);
      try {
        rec.abort();
      } catch {
        /* cerrado */
      }
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, []);

  useEffect(() => {
    if (introPhase === 'cta') {
      setIntroText(VOICE_INTRO);
      return;
    }
    if (introPhase !== 'telling') return;
    setIntroText('');
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setIntroText(VOICE_INTRO.slice(0, index));
      if (index >= VOICE_INTRO.length) window.clearInterval(timer);
    }, 28);
    return () => window.clearInterval(timer);
  }, [introPhase]);

  const begin = () => {
    if (speakingRef.current || introRef.current) return;
    setMicNote('');
    if (!active) {
      stateRef.current = initialVoiceState();
      setStep('collect');
      setHeard('');
      setLive('');
      setCards([]);
      setActive(true);
      const userId = user?.id || 'local';
      if (!voiceIntroSeen(userId)) {
        introRef.current = 'telling';
        introPendingRef.current = true;
        setIntroPhase('telling');
        setListening(false);
        speakRef.current(VOICE_INTRO, 'stay');
        return;
      }
      setListening(true);
      speakRef.current(openingLine(), 'listen');
      return;
    }
    armRef.current();
  };

  const startAfterIntro = () => {
    markVoiceIntroSeen(user?.id || 'local');
    introRef.current = null;
    introPendingRef.current = false;
    setIntroPhase(null);
    setIntroText('');
    setListening(true);
    speakRef.current('¿Quieres vender?', 'listen');
  };

  const stopSession = () => {
    speakGenRef.current += 1;
    speakingRef.current = false;
    pausedForSpeechRef.current = false;
    wantListenRef.current = false;
    acceptResultsRef.current = false;
    recognitionRunningRef.current = false;
    pendingRef.current = '';
    phraseStartRef.current = 0;
    resultCountRef.current = 0;
    window.clearTimeout(pauseTimerRef.current);
    try {
      recognitionRef.current?.abort();
    } catch {
      /* cerrado */
    }
    window.speechSynthesis?.cancel();
    introRef.current = null;
    introPendingRef.current = false;
    setIntroPhase(null);
    setIntroText('');
    setListening(false);
    setLive('');
    setCards([]);
    setActive(false);
    setBusy(false);
  };

  onResultRef.current = (event) => {
    if (!acceptResultsRef.current) return;
    resultCountRef.current = event.results.length;
    const parts = [];
    for (let i = phraseStartRef.current; i < event.results.length; i += 1) {
      parts.push({
        text: String(event.results[i]?.[0]?.transcript || ''),
        final: Boolean(event.results[i]?.isFinal),
      });
    }
    const phrase = collapseVoiceTranscript(parts);
    queuePhrase(phrase.text, phrase.stable);
  };

  const stepLabel =
    step === 'pay'
      ? 'Pago'
      : step === 'more'
        ? 'Carrito'
        : step === 'choose'
          ? 'Elige el producto'
          : 'Producto';

  return (
    <>
      {active && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,100%)] rounded-2xl border border-white/15 bg-black/70 p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Asistente de venta</p>
              <p className="text-xs text-white/60">
                {introPhase === 'telling'
                  ? 'Escucha'
                  : introPhase === 'cta'
                    ? 'Cuando quieras'
                    : busy
                      ? 'Registrando venta…'
                      : listening
                        ? 'Habla ahora'
                        : stepLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={stopSession}
              className="rounded-lg px-2 py-1 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
            >
              Cerrar
            </button>
          </div>
          <p className="mt-3 text-sm text-white" aria-live="polite">{introPhase ? introText : say}</p>
          {introPhase === 'cta' ? (
            <button
              type="button"
              onClick={startAfterIntro}
              className="mt-4 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-gray-900"
            >
              ¿Quieres comenzar?
            </button>
          ) : null}
          {cards.length > 0 ? (
            <div className="mt-3 space-y-2">
              {cards.map((card) => (
                <div key={card.id} className="flex items-center gap-3 rounded-xl bg-white/10 p-2">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/30">
                    <LazyProductImage
                      productId={card.id}
                      alt={card.name}
                      initialSrc={card.image}
                      eager
                      fillParent
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-white">{card.name}</p>
                    {card.quantity > 1 ? (
                      <p className="mt-0.5 text-xs text-white/60">×{card.quantity}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {live ? <p className="mt-2 text-sm font-medium text-red-300">Te oigo: {live}</p> : null}
          {heard ? <p className="mt-2 text-xs text-white/60">Tú: {heard}</p> : null}
          {micNote ? <p className="mt-2 text-xs text-amber-200">{micNote}</p> : null}
          {!canListen ? (
            <p className="mt-2 text-xs text-amber-200">Este navegador no reconoce la voz. Ábrelo en Chrome para hablar.</p>
          ) : null}
        </div>
      )}

      <div className="relative h-10 w-10 shrink-0">
        <button
          type="button"
          onClick={listening ? undefined : begin}
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm ${
            listening ? 'bg-red-600' : 'bg-[#272B36]'
          }`}
          aria-label={listening ? 'Escuchando el micrófono' : 'Registrar una venta por voz'}
        >
          <Mic className={`h-5 w-5 ${listening ? 'animate-pulse' : ''}`} />
        </button>
        <span className="pointer-events-none absolute -right-3 -top-2 inline-flex items-center rounded-full bg-[#2F80FF] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          Nuevo
        </span>
      </div>
    </>
  );
}
