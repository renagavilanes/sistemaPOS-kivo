import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

type DetectResult = { ok: boolean; message: string };

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function detectorCtor(): BarcodeDetectorCtor | null {
  const host = window as Window & { BarcodeDetector?: BarcodeDetectorCtor };
  return host.BarcodeDetector || null;
}

function createDetector() {
  const Ctor = detectorCtor();
  if (!Ctor) return null;
  try {
    return new Ctor({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar', 'qr_code'],
    });
  } catch {
    try {
      return new Ctor();
    } catch {
      return null;
    }
  }
}

/**
 * Cámara del teléfono. En escritorio no se monta.
 * Lee unas 4 veces por segundo para no gastar batería ni datos.
 */
export function BarcodeScanner({
  open,
  continuous = false,
  onClose,
  onDetect,
}: {
  open: boolean;
  continuous?: boolean;
  onClose: () => void;
  onDetect: (code: string) => DetectResult;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const continuousRef = useRef(continuous);
  const onCloseRef = useRef(onClose);
  onDetectRef.current = onDetect;
  continuousRef.current = continuous;
  onCloseRef.current = onClose;
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setMessage('');
    const video = videoRef.current;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    const recent = { code: '', at: 0 };

    const stopStream = () => {
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      if (video) video.srcObject = null;
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este teléfono no puede abrir la cámara.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
      } catch {
        if (!stopped) setError('No se pudo abrir la cámara. Revisa el permiso e inténtalo de nuevo.');
        return;
      }
      if (stopped) {
        stopStream();
        return;
      }
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          if (!stopped) setError('No se pudo mostrar la cámara.');
          return;
        }
      }
      if (stopped) {
        stopStream();
        return;
      }
      const detector = createDetector();
      if (!detector) {
        stopStream();
        setError('Este teléfono no lee códigos con la cámara. Puedes escribir el código a mano.');
        return;
      }
      timer = window.setInterval(async () => {
        if (!video || video.readyState < 2) return;
        let raw = '';
        try {
          const found = await detector.detect(video);
          raw = String(found?.[0]?.rawValue || '');
        } catch {
          return;
        }
        if (!raw) return;
        const now = Date.now();
        if (recent.code === raw && now - recent.at < 1200) return;
        recent.code = raw;
        recent.at = now;
        const result = onDetectRef.current(raw);
        if (!result) return;
        setMessage(result.message);
        if (result.ok && !continuousRef.current) onCloseRef.current();
      }, 250);
    };

    void start();
    return () => {
      stopped = true;
      stopStream();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium">Apunta al código</p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
          aria-label="Cerrar cámara"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-36 w-[78%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
        </div>
      </div>
      <div className="px-4 py-4 text-center">
        {error ? (
          <p className="text-sm text-amber-200">{error}</p>
        ) : (
          <p className="text-sm text-white/80">
            {message || (continuous ? 'Cada lectura se agrega al carrito.' : 'La lectura se guarda en el producto.')}
          </p>
        )}
      </div>
    </div>
  );
}
