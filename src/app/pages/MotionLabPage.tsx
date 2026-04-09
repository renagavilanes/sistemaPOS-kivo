import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/layout/SectionCard';

type FxId =
  | 'wipe'
  | 'radial'
  | 'glitch'
  | 'pixels'
  | 'shutter'
  | 'wave'
  | 'zoom-tunnel'
  | 'ink'
  | 'ink-soft'
  | 'ink-neon'
  | 'ink-double'
  | 'ink-blobs'
  | 'ink-reveal'
  | 'prism'
  | 'spot';

const FX: { id: FxId; title: string; desc: string }[] = [
  { id: 'wipe', title: 'Color Wipe', desc: 'Barrido de color a pantalla completa' },
  { id: 'radial', title: 'Radial Burst', desc: 'Explosión desde el punto del click' },
  { id: 'glitch', title: 'Glitch', desc: 'Flash/glitch cyber (muy fuerte)' },
  { id: 'pixels', title: 'Pixelate', desc: 'Mosaico/píxeles sobre toda la UI' },
  { id: 'shutter', title: 'Shutter', desc: 'Cortina por franjas (cine)' },
  { id: 'wave', title: 'Wave', desc: 'Onda diagonal rápida' },
  { id: 'zoom-tunnel', title: 'Zoom Tunnel', desc: 'Túnel con zoom y blur' },
  { id: 'ink', title: 'Ink Splash', desc: 'Clásica: mancha orgánica expandiéndose' },
  { id: 'ink-soft', title: 'Ink Soft', desc: 'Más suave y elegante (menos agresiva)' },
  { id: 'ink-neon', title: 'Ink Neon', desc: 'Ink con glow “neon” (brand)' },
  { id: 'ink-double', title: 'Ink Double', desc: 'Doble splash en dos pulsos' },
  { id: 'ink-blobs', title: 'Ink Blobs', desc: 'Varias manchas pequeñas que se fusionan' },
  { id: 'ink-reveal', title: 'Ink Reveal', desc: 'Oscurece todo y “revela” con tinta' },
  { id: 'prism', title: 'Prism', desc: 'Separación RGB + flash' },
  { id: 'spot', title: 'Spotlight', desc: 'Luz circular que recorre pantalla' },
];

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(' ');
}

export default function MotionLabPage() {
  const [fxKey, setFxKey] = useState(0);
  const [fxId, setFxId] = useState<FxId | null>(null);
  const [fxXY, setFxXY] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const clearTimer = useRef<number | null>(null);

  const cards = useMemo(() => FX, []);

  const trigger = (id: FxId, ev: React.MouseEvent) => {
    const vx = ev.clientX / window.innerWidth;
    const vy = ev.clientY / window.innerHeight;
    setFxXY({ x: Number.isFinite(vx) ? vx : 0.5, y: Number.isFinite(vy) ? vy : 0.5 });
    setFxId(id);
    setFxKey((k) => k + 1);
  };

  useEffect(() => {
    if (!fxId) return;
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => setFxId(null), 820);
    return () => {
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
    };
  }, [fxId, fxKey]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Motion Lab" subtitle="10 animaciones fuertes para elegir (solo pruebas)" />
      {fxId ? (
        <div
          aria-hidden
          className={`kivo-screenfx kivo-screenfx-${fxId} kivo-screenfx-key-${fxKey}`}
          style={{
            // @ts-expect-error CSS variables
            ['--fx-x' as any]: `${(fxXY.x * 100).toFixed(2)}vw`,
            // @ts-expect-error CSS variables
            ['--fx-y' as any]: `${(fxXY.y * 100).toFixed(2)}vh`,
          }}
        />
      ) : null}
      <div className="p-4 sm:p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((fx) => {
          return (
            <SectionCard key={fx.id}>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{fx.title}</div>
                  <div className="text-xs text-gray-500">{fx.desc}</div>
                </div>

                <div className="relative">
                  <Button
                    type="button"
                    onClick={(e) => trigger(fx.id, e)}
                    className={cx(
                      'w-full h-12 text-base font-semibold bg-gray-900 hover:bg-gray-800 text-white',
                    )}
                  >
                    Probar {fx.title}
                  </Button>
                </div>
              </div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}

