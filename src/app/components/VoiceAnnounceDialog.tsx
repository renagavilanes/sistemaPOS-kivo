import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

/** Cuentas creadas antes de esta hora ya existían cuando salió la voz. */
const EXISTING_ACCOUNT_BEFORE = Date.parse('2026-10-01T23:15:00.000Z');
const SEEN_KEY = 'kivo_voice_announce_seen';

const POINTS = [
  'El micrófono está junto al buscador, en Vender.',
  'Di el producto y, si hace falta, el precio. También puedes quitarlo hablando.',
  'Para cobrar, di el método: efectivo, tarjeta o transferencia.',
];

function seenKey(userId: string) {
  return `${SEEN_KEY}_${userId}`;
}

export function VoiceAnnounceDialog() {
  const { user, session } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const createdAt = session?.user?.created_at;
    if (!user || !createdAt) return;
    const created = Date.parse(createdAt);
    if (!Number.isFinite(created) || created >= EXISTING_ACCOUNT_BEFORE) return;
    try {
      if (localStorage.getItem(seenKey(user.id))) return;
    } catch {
      return;
    }
    setOpen(true);
  }, [user, session]);

  const dismiss = (next: boolean) => {
    if (!next && user) {
      try {
        localStorage.setItem(seenKey(user.id), '1');
      } catch {
        /* el navegador no guarda */
      }
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={dismiss}>
      <DialogContent className="sm:max-w-md gap-0 overflow-hidden p-0">
        <img
          src="/voice-intro.jpg"
          alt="Asistente de voz junto al punto de venta"
          className="h-56 w-full bg-white object-contain sm:h-64"
        />
        <div className="px-6 pb-6 pt-1">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl">Ya puedes vender por voz</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Habla para añadir productos al carrito y cerrar la venta más rápido.
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-4 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-2.5 text-sm leading-snug text-gray-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2F80FF]" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            className="mt-6 h-12 w-full text-base font-semibold"
            onClick={() => dismiss(false)}
          >
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
