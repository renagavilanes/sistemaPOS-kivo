import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScreenFxOverlay, type ScreenFxId } from '../components/ScreenFxOverlay';

type ScreenFxApi = {
  trigger: (fx: ScreenFxId) => void;
  triggerInkDouble: () => void;
};

const Ctx = createContext<ScreenFxApi | null>(null);

export function ScreenFxProvider({ children }: { children: React.ReactNode }) {
  const [fx, setFx] = useState<ScreenFxId | null>(null);
  const [fxKey, setFxKey] = useState(0);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.55 });

  useEffect(() => {
    const onPointerDown = (ev: PointerEvent) => {
      if (!Number.isFinite(ev.clientX) || !Number.isFinite(ev.clientY)) return;
      const x = ev.clientX / window.innerWidth;
      const y = ev.clientY / window.innerHeight;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      lastPointerRef.current = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
    };
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const trigger = useCallback((next: ScreenFxId) => {
    setFx(next);
    setFxKey((k) => k + 1);
  }, []);

  const value = useMemo<ScreenFxApi>(() => ({
    trigger,
    triggerInkDouble: () => trigger('ink-double'),
  }), [trigger]);

  const overlay = (
    <ScreenFxOverlay
      fx={fx}
      fxKey={fxKey}
      xy={lastPointerRef.current}
      onDone={() => setFx(null)}
    />
  );

  return (
    <Ctx.Provider value={value}>
      {typeof document !== 'undefined' ? createPortal(overlay, document.body) : null}
      {children}
    </Ctx.Provider>
  );
}

export function useScreenFx(): ScreenFxApi {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useScreenFx must be used within ScreenFxProvider');
  }
  return v;
}

