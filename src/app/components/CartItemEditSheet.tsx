import { useState, useEffect } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { formatCurrency } from '../utils/currency';
import type { CartItem, UserRole } from '../types';
import { LazyProductImage } from './LazyProductImage';

interface CartItemEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CartItem | null;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdatePrice: (productId: string, price: number) => void;
  onRemoveItem: (productId: string) => void;
  userRole: UserRole;
  canEditPrice?: boolean; // Si se pasa, tiene prioridad sobre userRole
}

export function CartItemEditSheet({
  open,
  onOpenChange,
  item,
  onUpdateQuantity,
  onUpdatePrice,
  onRemoveItem,
  userRole,
  canEditPrice: canEditPriceProp,
}: CartItemEditSheetProps) {
  const [localQuantity, setLocalQuantity] = useState(1);
  const [localPrice, setLocalPrice] = useState('0');

  const canEditPrice = canEditPriceProp !== undefined
    ? canEditPriceProp
    : (userRole === 'advanced' || userRole === 'admin' || userRole === 'super_admin');

  // Update local state when item changes
  useEffect(() => {
    if (item) {
      setLocalQuantity(item.quantity);
      setLocalPrice(item.priceAtSale.toString());
    }
  }, [item]);

  if (!item) return null;

  const priceNum = parseFloat(localPrice) || 0;
  const subtotal = priceNum * localQuantity;

  const handleConfirm = () => {
    onUpdateQuantity(item.product.id, localQuantity);
    onUpdatePrice(item.product.id, priceNum);
    onOpenChange(false);
  };

  const handleDelete = () => {
    onRemoveItem(item.product.id);
    onOpenChange(false);
  };

  const handleIncrement = () => {
    if (localQuantity < item.product.stock) {
      setLocalQuantity(prev => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (localQuantity > 1) {
      setLocalQuantity(prev => prev - 1);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle>Editar producto</SheetTitle>
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl border-2 border-red-500"
              onClick={handleDelete}
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
          <SheetDescription>
            Ajusta la cantidad y precio del producto
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="space-y-6">
            {/* Product Image */}
            <div className="flex justify-center">
              <div className="w-32 h-32 bg-gray-100 rounded-2xl overflow-hidden">
                <LazyProductImage
                  productId={item.product.id}
                  initialSrc={item.product.image}
                  alt={item.product.name}
                  className="w-full h-full object-cover"
                  eager
                />
              </div>
            </div>

            {/* Product Name */}
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900">{item.product.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{item.product.category}</p>
            </div>

            {/* Quantity Control */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Cantidad</label>
              <div className="flex items-center justify-center gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 w-14 rounded-full border-2"
                  onClick={handleDecrement}
                  disabled={localQuantity <= 1}
                >
                  <Minus className="w-6 h-6" />
                </Button>
                <div className="min-w-[80px] text-center">
                  <span className="text-4xl font-bold">{localQuantity}</span>
                </div>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 w-14 rounded-full border-2"
                  onClick={handleIncrement}
                  disabled={localQuantity >= item.product.stock}
                >
                  <Plus className="w-6 h-6" />
                </Button>
              </div>
              {localQuantity >= item.product.stock && (
                <p className="text-xs text-amber-600 text-center">
                  Stock máximo disponible: {item.product.stock}
                </p>
              )}
            </div>

            {/* Price Control */}
            {canEditPrice && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Precio unitario</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-gray-700">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={localPrice}
                    onChange={(e) => setLocalPrice(e.target.value)}
                    className="h-16 text-2xl font-bold text-center pl-8 border-2"
                  />
                </div>
              </div>
            )}

            {!canEditPrice && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Precio unitario</label>
                <div className="h-16 flex items-center justify-center bg-gray-50 rounded-lg border-2">
                  <span className="text-2xl font-bold">${formatCurrency(priceNum)}</span>
                </div>
              </div>
            )}

            {/* Subtotal Info */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Precio por unidad:</span>
                <span className="font-semibold">${formatCurrency(priceNum)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Cantidad:</span>
                <span className="font-semibold">{localQuantity}</span>
              </div>
              <div className="h-px bg-gray-300 my-2"></div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Subtotal:</span>
                <span className="text-2xl font-bold text-gray-900">${formatCurrency(subtotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-white flex-shrink-0">
          <Button
            onClick={handleConfirm}
            className="w-full h-14 text-lg font-semibold bg-gray-900 hover:bg-gray-800"
          >
            Confirmar - ${formatCurrency(subtotal)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}