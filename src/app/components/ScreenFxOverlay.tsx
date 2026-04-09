import { useEffect } from 'react';

export type ScreenFxId = 'ink-double';

export function ScreenFxOverlay({
  fx,
  xy,
  fxKey,
  durationMs = 820,
  onDone,
}: {
  fx: ScreenFxId | null;
  /** Coordenadas normalizadas (0..1) para origen del efecto */
  xy: { x: number; y: number };
  /** Cambia para re-disparar animación */
  fxKey: number;
  durationMs?: number;
  onDone?: () => void;
}) {
  useEffect(() => {
    if (!fx) return;
    const t = window.setTimeout(() => onDone?.(), durationMs);
    return () => window.clearTimeout(t);
  }, [fx, fxKey, durationMs, onDone]);

  if (!fx) return null;

  const x = Math.min(1, Math.max(0, xy.x));
  const y = Math.min(1, Math.max(0, xy.y));

  return (
    <div
      aria-hidden
      className={`kivo-screenfx kivo-screenfx-${fx} kivo-screenfx-key-${fxKey}`}
      style={{
        // @ts-expect-error CSS variables
        ['--fx-x' as any]: `${(x * 100).toFixed(2)}vw`,
        // @ts-expect-error CSS variables
        ['--fx-y' as any]: `${(y * 100).toFixed(2)}vh`,
      }}
    />
  );
}

