import { useEffect, useRef, useState } from 'react';
import { useBusiness } from '../contexts/BusinessContext';
import { getProductById } from '../services/api';
import { ImageWithFallback } from './figma/ImageWithFallback';

function usableProductImageSrc(src: string | undefined | null): string {
  if (!src || typeof src !== 'string') return '';
  if (src.includes('unsplash.com')) return '';
  return src;
}

function cacheKey(businessId: string, productId: string) {
  return `${businessId}::${productId}`;
}

const imageSrcCache = new Map<string, string>();
const fetchInflight = new Map<string, Promise<string>>();

async function resolveProductImageSrc(businessId: string, productId: string): Promise<string> {
  const key = cacheKey(businessId, productId);
  if (imageSrcCache.has(key)) {
    return imageSrcCache.get(key)!;
  }
  let p = fetchInflight.get(key);
  if (!p) {
    p = getProductById(businessId, productId)
      .then((prod) => {
        const u = usableProductImageSrc(prod.image);
        imageSrcCache.set(key, u);
        fetchInflight.delete(key);
        return u;
      })
      .catch(() => {
        imageSrcCache.set(key, '');
        fetchInflight.delete(key);
        return '';
      });
    fetchInflight.set(key, p);
  }
  return p;
}

export interface LazyProductImageProps {
  productId: string;
  alt: string;
  className?: string;
  /** Si ya viene en el listado (p. ej. detalle cargado), se usa sin pedir al servidor. */
  initialSrc?: string | null;
  /**
   * true: pide la imagen al abrir (carrito / modal). false: solo al entrar en vista (catálogo).
   */
  eager?: boolean;
  /**
   * Rellena un ancestro con `position: relative` y tamaño definido (p. ej. aspect-ratio).
   * Evita en Safari/WebKit que `h-full` sobre la imagen se resuelva mal dentro de flex.
   */
  fillParent?: boolean;
}

export function LazyProductImage({
  productId,
  alt,
  className,
  initialSrc,
  eager = false,
  fillParent = false,
}: LazyProductImageProps) {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id ?? '';

  const fromProps = usableProductImageSrc(initialSrc);
  const [src, setSrc] = useState(fromProps);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSrc(usableProductImageSrc(initialSrc));
  }, [initialSrc]);

  useEffect(() => {
    const immediate = usableProductImageSrc(initialSrc);
    if (immediate) {
      return;
    }
    if (!businessId || !productId) {
      setSrc('');
      return;
    }

    const key = cacheKey(businessId, productId);
    if (imageSrcCache.has(key)) {
      setSrc(imageSrcCache.get(key)!);
      return;
    }

    if (eager) {
      void resolveProductImageSrc(businessId, productId).then(setSrc);
      return;
    }

    let io: IntersectionObserver | null = null;
    let canceled = false;

    const attach = () => {
      if (canceled || io) return;
      const el = containerRef.current;
      if (!el) return;
      io = new IntersectionObserver(
        (entries) => {
          if (!entries[0]?.isIntersecting) return;
          io?.disconnect();
          io = null;
          void resolveProductImageSrc(businessId, productId).then(setSrc);
        },
        { root: null, rootMargin: '200px', threshold: 0.01 },
      );
      io.observe(el);
    };

    attach();
    const raf = requestAnimationFrame(attach);

    return () => {
      canceled = true;
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [businessId, productId, initialSrc, eager]);

  return (
    <div
      ref={containerRef}
      className={
        fillParent
          ? 'absolute inset-0 min-h-0 overflow-hidden'
          : 'h-full w-full min-h-0'
      }
    >
      <ImageWithFallback src={src} alt={alt} className={className} />
    </div>
  );
}
