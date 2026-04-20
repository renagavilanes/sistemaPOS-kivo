import { useEffect, useRef } from 'react';
import '../../../styles/landing-fx.css';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
}

/**
 * Capa de FX para Landing, aislada del resto de la app.
 * - No modifica markup existente: solo agrega overlay + listeners.
 * - Respeta reduced motion y móviles (coarse pointer).
 */
export function LandingFxOverlay({ enableCursor = false }: { enableCursor?: boolean }) {
  const reducedRef = useRef(true);
  const coarseRef = useRef(true);

  useEffect(() => {
    reducedRef.current = prefersReducedMotion();
    coarseRef.current = isCoarsePointer();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('kivo-landing-fx');
    if (!reducedRef.current) root.classList.add('kivo-landing-fx-motion');
    if (!coarseRef.current) root.classList.add('kivo-landing-fx-fine');

    return () => {
      root.classList.remove('kivo-landing-fx');
      root.classList.remove('kivo-landing-fx-motion');
      root.classList.remove('kivo-landing-fx-fine');
    };
  }, []);

  // Scroll reveal
  useEffect(() => {
    if (reducedRef.current) {
      document.querySelectorAll<HTMLElement>('[data-fx-reveal]').forEach((el) => {
        el.classList.add('kivo-reveal-visible');
      });
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).classList.add('kivo-reveal-visible');
          io.unobserve(e.target);
        }
      },
      { threshold: 0.12 },
    );

    document.querySelectorAll<HTMLElement>('[data-fx-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Ripple (delegación)
  useEffect(() => {
    if (reducedRef.current) return;

    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest<HTMLElement>('[data-fx-ripple]');
      if (!btn) return;
      if (btn.hasAttribute('disabled') || (btn as any).disabled) return;

      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.5;
      const x = ev.clientX - rect.left - size / 2;
      const y = ev.clientY - rect.top - size / 2;
      const ripple = document.createElement('span');
      ripple.className = 'kivo-fx-ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      btn.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 520);
    };

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Cursor custom (opcional y solo fine pointer)
  useEffect(() => {
    if (!enableCursor) return;
    if (reducedRef.current) return;
    if (coarseRef.current) return;

    const cur = document.getElementById('kivo-fx-cursor');
    const ring = document.getElementById('kivo-fx-cursor-ring');
    if (!cur || !ring) return;

    let mx = 0;
    let my = 0;
    let rx = 0;
    let ry = 0;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    let raf = 0;
    const tick = () => {
      cur.style.left = `${mx}px`;
      cur.style.top = `${my}px`;
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.left = `${rx}px`;
      ring.style.top = `${ry}px`;
      raf = window.requestAnimationFrame(tick);
    };

    document.addEventListener('mousemove', onMove, { passive: true });
    raf = window.requestAnimationFrame(tick);

    return () => {
      document.removeEventListener('mousemove', onMove);
      window.cancelAnimationFrame(raf);
    };
  }, [enableCursor]);

  return (
    <>
      <div aria-hidden className="kivo-fx-mesh" />
      {enableCursor ? (
        <>
          <div id="kivo-fx-cursor" aria-hidden className="kivo-fx-cursor" />
          <div id="kivo-fx-cursor-ring" aria-hidden className="kivo-fx-cursor-ring" />
        </>
      ) : null}
    </>
  );
}

