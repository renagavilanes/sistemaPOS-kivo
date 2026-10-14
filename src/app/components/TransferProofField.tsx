import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { optimizeTransferProof } from '../utils/productImage';

interface TransferProofFieldProps {
  value: string | null;
  onChange: (next: string | null) => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
  /** Sin botones. Si no hay foto, no renderiza nada. */
  readOnly?: boolean;
  /** En el modal de venta: botones claros, distintos de las acciones negras. */
  prominent?: boolean;
}

export function TransferProofField({
  value,
  onChange,
  disabled,
  busy,
  readOnly,
  prominent = false,
}: TransferProofFieldProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const locked = disabled || busy || processing;

  if (readOnly && !value) return null;

  const pick = async (file: File | undefined) => {
    if (!file || locked) return;
    setProcessing(true);
    try {
      const dataUrl = await optimizeTransferProof(file);
      await onChange(dataUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la foto');
    } finally {
      setProcessing(false);
    }
  };

  const actionClass = prominent
    ? 'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-2 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50'
    : '';

  return (
    <div className="space-y-2">
      {!value && (
        <p className="text-sm font-semibold text-gray-900">
          {prominent ? 'Foto de la transferencia' : 'Respaldo de la transferencia'}
        </p>
      )}

      {value ? (
        <div className="relative overflow-hidden rounded-lg bg-gray-100">
          <button type="button" onClick={() => setPreviewOpen(true)} className="block w-full">
            <img
              src={value}
              alt="Respaldo de la transferencia"
              className="max-h-36 w-full object-contain"
            />
          </button>
          {!readOnly && (
            <button
              type="button"
              disabled={locked}
              onClick={() => void onChange(null)}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-gray-800 shadow-sm disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Quitar
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          {prominent ? (
            <>
              <button
                type="button"
                className={actionClass}
                disabled={locked}
                onClick={() => cameraRef.current?.click()}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Tomar foto
              </button>
              <button
                type="button"
                className={actionClass}
                disabled={locked}
                onClick={() => galleryRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4" />
                Galería
              </button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 text-sm"
                disabled={locked}
                onClick={() => cameraRef.current?.click()}
              >
                {processing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-1.5 h-4 w-4" />
                )}
                Tomar foto
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 text-sm"
                disabled={locked}
                onClick={() => galleryRef.current?.click()}
              >
                <ImageIcon className="mr-1.5 h-4 w-4" />
                Galería
              </Button>
            </>
          )}
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle>Respaldo de la transferencia</DialogTitle>
          </DialogHeader>
          {value ? (
            <img
              src={value}
              alt="Respaldo de la transferencia"
              className="max-h-[70vh] w-full rounded-md bg-gray-100 object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
