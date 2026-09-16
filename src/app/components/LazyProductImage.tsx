import { useEffect, useRef, useState } from 'react';
import { useBusiness } from '../contexts/BusinessContext';
import { getProductById, getProductImages } from '../services/api';
import { fetchPublicCatalogImage } from '../lib/virtualCatalogApi';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { compactImageForThumbCache, displayProductImageSrc } from '../utils/productImage';

function cacheKey(businessId: string, productId: string) {
  return `${businessId}::${productId}`;
}

const imageSrcCache = new Map<string, string>();
const fetchInflight = new Map<string, Promise<string>>();

type BatchWaiter = {
  resolve: (src: string) => void;
  reject: (err: unknown) => void;
};

const batchQueue = new Map<string, { ids: Set<string>; waiters: Map<string, BatchWaiter[]>; timer: ReturnType<typeof setTimeout> | null }>();

const IDB_NAME = 'kivo-product-thumbs';
const IDB_STORE = 'src';

function openThumbDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<string> {
  const db = await openThumbDb();
  if (!db) return '';
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : '');
      req.onerror = () => resolve('');
    } catch {
      resolve('');
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  if (!value) return;
  const db = await openThumbDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openThumbDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function rememberSrc(key: string, raw: string): string {
  const display = displayProductImageSrc(raw);
  imageSrcCache.set(key, display);
  if (display) {
    void compactImageForThumbCache(display).then((compact) => {
      const stored = compact || display;
      imageSrcCache.set(key, stored);
      void idbSet(key, stored);
    });
  }
  return display;
}

/** Limpia caché de imagen tras crear/editar producto para que se vea al instante. */
export function invalidateProductImageCache(businessId: string, productId?: string) {
  if (productId) {
    const key = cacheKey(businessId, productId);
    imageSrcCache.delete(key);
    fetchInflight.delete(key);
    void idbDelete(key);
    return;
  }
  for (const key of imageSrcCache.keys()) {
    if (key.startsWith(`${businessId}::`)) imageSrcCache.delete(key);
  }
  for (const key of fetchInflight.keys()) {
    if (key.startsWith(`${businessId}::`)) fetchInflight.delete(key);
  }
}

export function setProductImageCache(businessId: string, productId: string, src: string) {
  const key = cacheKey(businessId, productId);
  const display = displayProductImageSrc(src);
  imageSrcCache.set(key, display);
  void rememberSrc(key, display);
}

function flushBusinessBatch(businessId: string) {
  const batch = batchQueue.get(businessId);
  if (!batch) return;
  batch.timer = null;
  const ids = [...batch.ids];
  batch.ids = new Set();
  if (ids.length === 0) return;

  const chunk = ids.slice(0, 32);
  const leftover = ids.slice(32);
  leftover.forEach((id) => batch.ids.add(id));

  void getProductImages(businessId, chunk)
    .then((images) => {
      chunk.forEach((id) => {
        const key = cacheKey(businessId, id);
        const raw = images[id] || '';
        const stored = raw ? rememberSrc(key, raw) : '';
        if (!raw) imageSrcCache.set(key, '');
        const waiters = batch.waiters.get(id) || [];
        batch.waiters.delete(id);
        waiters.forEach((w) => w.resolve(stored));
      });
      if (batch.ids.size > 0) flushBusinessBatch(businessId);
    })
    .catch((err) => {
      chunk.forEach((id) => {
        const waiters = batch.waiters.get(id) || [];
        batch.waiters.delete(id);
        waiters.forEach((w) => w.reject(err));
      });
    });
}

function enqueueProductImage(businessId: string, productId: string): Promise<string> {
  const key = cacheKey(businessId, productId);
  if (imageSrcCache.has(key)) return Promise.resolve(imageSrcCache.get(key)!);

  let inflight = fetchInflight.get(key);
  if (inflight) return inflight;

  inflight = new Promise<string>((resolve, reject) => {
    let batch = batchQueue.get(businessId);
    if (!batch) {
      batch = { ids: new Set(), waiters: new Map(), timer: null };
      batchQueue.set(businessId, batch);
    }
    batch.ids.add(productId);
    const list = batch.waiters.get(productId) || [];
    list.push({ resolve, reject });
    batch.waiters.set(productId, list);
    if (!batch.timer) {
      batch.timer = setTimeout(() => flushBusinessBatch(businessId), 32);
    }
  }).finally(() => {
    fetchInflight.delete(key);
  });

  fetchInflight.set(key, inflight);
  return inflight;
}

async function resolveProductImageSrc(businessId: string, productId: string): Promise<string> {
  const key = cacheKey(businessId, productId);
  if (imageSrcCache.has(key)) return imageSrcCache.get(key)!;

  const cached = await idbGet(key);
  if (cached) {
    imageSrcCache.set(key, cached);
    return cached;
  }

  try {
    return await enqueueProductImage(businessId, productId);
  } catch {
    try {
      const prod = await getProductById(businessId, productId);
      return rememberSrc(key, prod.image || '');
    } catch {
      imageSrcCache.set(key, '');
      return '';
    }
  }
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
  /**
   * Catálogo público: pide la foto por el slug, solo cuando el producto entra en pantalla.
   */
  publicCatalogSlug?: string;
  /**
   * Negocio dueño del producto. Si no se pasa, usa el negocio actual.
   * Hace falta al mostrar fichas de otro negocio (p. ej. traslado).
   */
  businessId?: string;
}

export function LazyProductImage({
  productId,
  alt,
  className,
  initialSrc,
  eager = false,
  fillParent = false,
  publicCatalogSlug,
  businessId: businessIdProp,
}: LazyProductImageProps) {
  const { currentBusiness } = useBusiness();
  const businessId = businessIdProp || currentBusiness?.id || '';
  const publicSlug = String(publicCatalogSlug || '').trim();

  const fromProps = displayProductImageSrc(initialSrc);
  const [src, setSrc] = useState(fromProps);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = displayProductImageSrc(initialSrc);
    setSrc(next);
    if (businessId && productId && next) {
      setProductImageCache(businessId, productId, next);
    }
  }, [initialSrc, businessId, productId]);

  useEffect(() => {
    const refreshFromServer = () => {
      if (publicSlug && productId) {
        void fetchPublicCatalogImage(publicSlug, productId).then((raw) => setSrc(displayProductImageSrc(raw)));
        return;
      }
      if (!businessId || !productId) return;
      const immediate = displayProductImageSrc(initialSrc);
      if (immediate) {
        setSrc(immediate);
        setProductImageCache(businessId, productId, immediate);
        return;
      }
      invalidateProductImageCache(businessId, productId);
      void resolveProductImageSrc(businessId, productId).then(setSrc);
    };

    const onProductsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ productId?: string; businessId?: string; image?: string }>).detail;
      if (detail?.businessId && detail.businessId !== businessId) return;
      if (detail?.productId && detail.productId !== productId) return;

      if (detail?.image) {
        const url = displayProductImageSrc(detail.image);
        setSrc(url);
        if (businessId && productId) setProductImageCache(businessId, productId, url);
        return;
      }
      refreshFromServer();
    };

    window.addEventListener('productsUpdated', onProductsUpdated);
    return () => window.removeEventListener('productsUpdated', onProductsUpdated);
  }, [businessId, productId, initialSrc, publicSlug]);

  useEffect(() => {
    const immediate = displayProductImageSrc(initialSrc);
    if (immediate) {
      return;
    }

    const load = () => {
      if (publicSlug && productId) {
        void fetchPublicCatalogImage(publicSlug, productId).then((raw) => setSrc(displayProductImageSrc(raw)));
        return;
      }
      if (!businessId || !productId) {
        setSrc('');
        return;
      }
      void resolveProductImageSrc(businessId, productId).then(setSrc);
    };

    if (!publicSlug) {
      if (!businessId || !productId) {
        setSrc('');
        return;
      }
      const key = cacheKey(businessId, productId);
      if (imageSrcCache.has(key)) {
        setSrc(imageSrcCache.get(key)!);
        return;
      }
    }

    if (eager) {
      load();
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
          load();
        },
        { root: null, rootMargin: '640px', threshold: 0.01 },
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
  }, [businessId, productId, initialSrc, eager, publicSlug]);

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
