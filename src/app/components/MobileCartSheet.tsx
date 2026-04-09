import { Trash2, Plus, Minus, ShoppingCart as CartIcon, X } from 'lucide-react';
import { CartItem, UserRole } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { LazyProductImage } from './LazyProductImage';
import { SectionCard } from './layout/SectionCard';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { formatCurrency } from '../utils/currency';
import { useState } from 'react';

interface MobileCartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdatePrice: (productId: string, price: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onProceedToPayment: () => void;
  userRole: UserRole;
  isEditingMovement?: boolean;
  canEditPrice?: boolean; // Si se pasa, tiene prioridad sobre userRole
}

export function MobileCartSheet({
  open,
  onOpenChange,
  items,
  onUpdateQuantity,
  onUpdatePrice,
  onRemoveItem,
  onClearCart,
  onProceedToPayment,
  userRole,
  isEditingMovement = false,
  canEditPrice: canEditPriceProp,
}: MobileCartSheetProps) {
  const calculateSubtotal = (item: CartItem) => item.priceAtSale * item.quantity;
  const total = items.reduce((sum, item) => sum + calculateSubtotal(item), 0);
  const [clearCartDialogOpen, setClearCartDialogOpen] = useState(false);

  // Determine if user can edit price
  const canEditPrice = canEditPriceProp !== undefined
    ? canEditPriceProp
    : (userRole === 'advanced' || userRole === 'admin');

  const handleProceedToPayment = () => {
    onOpenChange(false);
    onProceedToPayment();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-full w-full p-0 flex flex-col sm:max-w-full">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0 bg-white">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-left">
              Carrito
              <p className="text-sm text-gray-500 font-normal mt-1">
                {items.length} producto{items.length !== 1 ? 's' : ''}
              </p>
            </SheetTitle>
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setClearCartDialogOpen(true)}
                  className="h-9 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  <span className="text-sm">Vaciar</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-9 w-9 p-0 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-600" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Cart Items */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-400">
            <CartIcon className="w-16 h-16 mb-2" />
            <p className="text-base">Carrito vacío</p>
            <p className="text-sm">Agrega productos para comenzar</p>
          </div>
        ) : (
          <>
            {/* Scrollable Items Area */}
            <ScrollArea className="flex-1 overflow-auto bg-gray-50">
              <div className="p-4 space-y-3">
                {items.map((item) => (
                  <SectionCard key={item.product.id}>
                    {/* Header: Image + Name + Delete */}
                    <div className="flex items-center gap-3 mb-3">
                      {/* Image */}
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <LazyProductImage
                          fillParent
                          productId={item.product.id}
                          initialSrc={item.product.image}
                          alt={item.product.name}
                          className="h-full w-full object-cover object-center"
                          eager
                        />
                      </div>

                      {/* Product Name */}
                      <h3 className="flex-1 font-semibold text-base text-gray-900">{item.product.name}</h3>

                      {/* Delete Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 w-10 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border-2 border-red-600"
                        onClick={() => onRemoveItem(item.product.id)}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>

                    {/* Quantity + Price Controls */}
                    <div className="flex items-center gap-3 mb-2">
                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between gap-2 border-2 border-gray-200 rounded-full px-3 h-10 flex-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                          onClick={() => onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <span className="font-semibold text-sm text-gray-900">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Price Display/Edit */}
                      <div className="flex items-center justify-center border-2 border-gray-200 rounded-full px-3 h-10 flex-1">
                        {canEditPrice ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={item.priceAtSale}
                            onChange={(e) => onUpdatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                            className="h-7 text-sm font-semibold text-center border-0 p-0 focus-visible:ring-0 bg-white"
                          />
                        ) : (
                          <span className="text-base font-semibold text-gray-900">$ {formatCurrency(item.priceAtSale)}</span>
                        )}
                      </div>
                    </div>

                    {/* Price per unit */}
                    <div className="text-sm text-gray-600">
                      Precio por {item.quantity} unidade{item.quantity !== 1 ? 's' : ''}: ${formatCurrency(calculateSubtotal(item))}
                    </div>
                  </SectionCard>
                ))}
              </div>
            </ScrollArea>

            {/* Fixed Footer: Total Summary & Checkout */}
            <div className="px-6 py-4 border-t bg-white space-y-4 flex-shrink-0">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Total productos:</span>
                  <span className="font-medium text-gray-900">
                    ${items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-gray-900">${formatCurrency(total)}</span>
                </div>
              </div>
              <Button
                onClick={handleProceedToPayment}
                className="w-full h-12 text-base font-semibold bg-gray-900 hover:bg-gray-800"
              >
                {isEditingMovement ? 'Guardar productos' : 'Continuar con el pago'}
              </Button>
            </div>
          </>
        )}

        {/* Clear Cart Confirmation Dialog */}
        <AlertDialog open={clearCartDialogOpen} onOpenChange={setClearCartDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Vaciar el carrito?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminarán {items.length} producto{items.length !== 1 ? 's' : ''} del carrito. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onClearCart();
                  setClearCartDialogOpen(false);
                  onOpenChange(false);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Sí, vaciar carrito
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}