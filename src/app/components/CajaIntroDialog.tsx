import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface CajaIntroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const POINTS = [
  'Cada empleado tiene su caja. Al abrirla registras el efectivo que dejas.',
  'Las ventas en efectivo entran y los gastos en efectivo salen. Tarjeta y transferencia no van al cajón.',
  'Al cerrar comparas lo contado con lo esperado: cuadra, faltante o sobrante.',
];

export function CajaIntroDialog({ open, onOpenChange }: CajaIntroDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 overflow-hidden p-0">
        <img
          src="/caja-intro.jpg"
          alt=""
          className="h-52 w-full bg-white object-contain"
        />
        <div className="px-6 pb-6 pt-1">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl">Así funciona Cajas</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              El efectivo de cada empleado, separado de los movimientos.
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
            onClick={() => onOpenChange(false)}
          >
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
