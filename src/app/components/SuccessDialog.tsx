import { useState, useEffect } from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { ScrollArea } from './ui/scroll-area';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { formatCurrency } from '../utils/currency';

interface SuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'sale' | 'expense';
  amount: number;
  defaultName?: string;
  onNewTransaction: () => void;
  onGoToMovements: () => void;
  /** Puede ser async; el diálogo espera a que termine antes de navegar (evita que Movimientos cargue sin el nombre nuevo). */
  onNameChange?: (name: string) => void | Promise<void>;
  onViewReceipt?: () => void;
}

export function SuccessDialog({
  open,
  onOpenChange,
  type,
  amount,
  defaultName = '',
  onNewTransaction,
  onGoToMovements,
  onNameChange,
  onViewReceipt,
}: SuccessDialogProps) {
  const [transactionName, setTransactionName] = useState('');

  // Set default name when dialog opens
  useEffect(() => {
    if (open) {
      console.log('✅ SuccessDialog - Recibiendo defaultName:', defaultName);
      setTransactionName(defaultName);
    }
  }, [open, defaultName]);

  // Play success sound when dialog opens
  useEffect(() => {
    if (open) {
      playSuccessSound();
    }
  }, [open]);

  const playSuccessSound = () => {
    // Create a pleasant notification sound similar to system sounds
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // First note (higher pitch)
    const oscillator1 = audioContext.createOscillator();
    const gainNode1 = audioContext.createGain();
    
    oscillator1.connect(gainNode1);
    gainNode1.connect(audioContext.destination);
    
    oscillator1.type = 'sine';
    oscillator1.frequency.value = 587.33; // D5
    
    gainNode1.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode1.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.01);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator1.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.3);
    
    // Second note (lower pitch, starts slightly after)
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();
    
    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext.destination);
    
    oscillator2.type = 'sine';
    oscillator2.frequency.value = 783.99; // G5
    
    gainNode2.gain.setValueAtTime(0, audioContext.currentTime + 0.1);
    gainNode2.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.11);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator2.start(audioContext.currentTime + 0.1);
    oscillator2.stop(audioContext.currentTime + 0.4);
  };

  const handleNewTransaction = async () => {
    const trimmed = transactionName.trim();
    try {
      if (onNameChange && trimmed) {
        await Promise.resolve(onNameChange(trimmed));
      }
    } catch {
      return;
    }
    setTransactionName('');
    onNewTransaction();
    onOpenChange(false);
  };

  const handleGoToMovements = async () => {
    const trimmed = transactionName.trim();
    try {
      if (onNameChange && trimmed) {
        await Promise.resolve(onNameChange(trimmed));
      }
    } catch {
      return;
    }
    setTransactionName('');
    onGoToMovements();
    onOpenChange(false);
  };

  const isMobile = useMediaQuery('(max-width: 768px)');

  const contentComponent = (
    <div className="kivo-pop-in">
      {/* Success Icon */}
      <div className="flex justify-center">
        <div className={`rounded-full p-4 ${type === 'sale' ? 'bg-green-100' : 'bg-orange-100'} kivo-soft-pulse`}>
          <CheckCircle2 className={`w-16 h-16 ${type === 'sale' ? 'text-green-600' : 'text-orange-600'}`} />
        </div>
      </div>

      {/* Title and Amount */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          {type === 'sale' ? '¡Creaste una venta!' : '¡Creaste un gasto!'}
        </h2>
        <p className="text-base text-gray-600 px-2">
          Se registró en tu balance por un valor de{' '}
          <span className="font-semibold text-gray-900">${formatCurrency(amount)}</span>
        </p>
      </div>

      {/* Optional Name Input */}
      <div className="space-y-2">
        <Label className="text-base text-gray-900">
          ¿Quieres darle un nombre a esta {type === 'sale' ? 'venta' : 'gasto'}?
        </Label>
        <Input
          type="text"
          placeholder="Escríbelo aquí"
          value={transactionName}
          onChange={(e) => setTransactionName(e.target.value)}
          className="h-12 text-base"
        />
      </div>

      {/* Receipt Section */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-gray-900 text-base">Comprobante</h3>
        <p className="text-sm text-gray-600">
          Puedes ver e imprimir el comprobante de {type === 'sale' ? 'venta' : 'gasto'}.
        </p>
        
        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium"
          onClick={onViewReceipt}
        >
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>Ver comprobante</span>
          </div>
        </Button>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-2">
        <Button
          onClick={handleNewTransaction}
          className="w-full h-12 text-base font-semibold bg-gray-900 hover:bg-gray-800 kivo-pressable"
        >
          {type === 'sale' ? 'Seguir vendiendo' : 'Crear otro gasto'}
        </Button>
        
        <Button
          variant="outline"
          onClick={handleGoToMovements}
          className="w-full h-12 font-medium text-base kivo-pressable"
        >
          Ir a movimientos
        </Button>
      </div>
    </div>
  );

  // Mobile: Sheet from bottom
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-auto max-h-[90vh] p-0 rounded-t-3xl overflow-hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>
              {type === 'sale' ? '¡Creaste una venta!' : '¡Creaste un gasto!'}
            </SheetTitle>
          </SheetHeader>

          {/* Close Button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-full bg-gray-900 hover:bg-gray-800 p-2 transition-colors z-10"
          >
            <X className="h-4 w-4 text-white" />
          </button>

          <ScrollArea className="max-h-[90vh]">
            <div className="p-4 space-y-4 pb-6">
              {contentComponent}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Centered Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] w-[calc(100%-2rem)] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {type === 'sale' ? '¡Creaste una venta!' : '¡Creaste un gasto!'}
          </DialogTitle>
          <DialogDescription>
            {type === 'sale' ? 'Detalles de la venta completada exitosamente' : 'Detalles del gasto registrado exitosamente'}
          </DialogDescription>
        </DialogHeader>
        
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-full bg-gray-900 hover:bg-gray-800 p-2 transition-colors z-10"
        >
          <X className="h-4 w-4 text-white" />
        </button>

        <ScrollArea className="max-h-[90vh]">
          <div className="p-8 space-y-6">
            {contentComponent}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}