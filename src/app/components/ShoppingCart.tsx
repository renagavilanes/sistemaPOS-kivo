import { Trash2, Plus, Minus, ShoppingCart as CartIcon } from 'lucide-react';
import { CartEmptyState } from './CartEmptyState';
import { CartItem, UserRole } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { formatCurrency } from '../utils/currency';
import { useState } from 'react';
import { CartItemEditSheet } from './CartItemEditSheet';
import { LazyProductImage } from './LazyProductImage';
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

interface ShoppingCartProps {
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

export function ShoppingCart({
  items,
  onUpdateQuantity,
  onUpdatePrice,
  onRemoveItem,
  onClearCart,
  onProceedToPayment,
  userRole,
  isEditingMovement = false,
  canEditPrice: canEditPriceProp,
}: ShoppingCartProps) {
  // Si se pasa canEditPrice como prop (nuevo sistema de permisos), usarla directamente
  const canEditPrice = canEditPriceProp !== undefined
    ? canEditPriceProp
    : (userRole === 'advanced' || userRole === 'admin' || userRole === 'super_admin');
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [clearCartDialogOpen, setClearCartDialogOpen] = useState(false);

  const calculateSubtotal = (item: CartItem) => item.priceAtSale * item.quantity;

  const total = items.reduce((sum, item) => sum + calculateSubtotal(item), 0);

  const handleCardClick = (item: CartItem) => {
    // Only open sheet on mobile (xl breakpoint is 1280px)
    if (window.innerWidth < 1280) {
      setEditingItem(item);
      setEditSheetOpen(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header: mismo tono que tablas (Inventario) */}
      <div className="flex h-[3.3rem] shrink-0 items-center justify-between gap-3 bg-slate-600 px-3 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <CartIcon className="h-4 w-4 shrink-0 text-white/70" strokeWidth={1.75} />
          <h2 className="truncate text-[15px] font-semibold leading-none">Carrito</h2>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/70">
            {items.length}
          </span>
        </div>
        {items.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setClearCartDialogOpen(true)}
            className="h-8 shrink-0 px-2 text-red-300 hover:bg-white/10 hover:text-red-200"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            <span className="text-xs">Vaciar</span>
          </Button>
        )}
      </div>

      {/* Cart Items */}
      {items.length === 0 ? (
        <>
          <CartEmptyState />
          <div className="p-4 border-t bg-white space-y-4 flex-shrink-0">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total productos:</span>
                <span className="font-medium text-gray-900 tabular-nums">0</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total:</span>
                <span className="text-2xl font-bold text-gray-900">$0</span>
              </div>
            </div>
            <Button
              disabled
              className="w-full h-12 text-base font-semibold bg-gray-900 hover:bg-gray-800 disabled:opacity-40"
            >
              Continuar con el pago
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Scrollable Items Area */}
          <div className="flex-1 overflow-auto">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-2">
                {items.map((item) => (
                  <div 
                    key={item.product.id} 
                    className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow xl:cursor-default cursor-pointer active:bg-gray-50 xl:active:bg-white"
                    onClick={() => handleCardClick(item)}
                  >
                    {/* Header: Image + Name + Delete */}
                    <div className="flex items-start gap-2 mb-2">
                      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                        <LazyProductImage
                          fillParent
                          productId={item.product.id}
                          initialSrc={item.product.image}
                          alt={item.product.name}
                          className="h-full w-full object-cover object-center"
                          eager
                        />
                      </div>

                      <h3 className="flex-1 min-w-0 font-semibold text-sm leading-snug text-gray-900 line-clamp-2 pt-0.5">
                        {item.product.name}
                      </h3>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="hidden xl:flex h-8 w-8 p-0 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md border-2 border-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveItem(item.product.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Quantity + Price Controls - Desktop only */}
                    <div className="hidden xl:flex items-center gap-2 mb-1.5">
                      <div className="flex items-center justify-between gap-1 border-2 border-gray-200 rounded-full px-3 h-9 flex-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1));
                          }}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <span className="font-semibold text-sm text-gray-900">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateQuantity(item.product.id, item.quantity + 1);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-center border-2 border-gray-200 rounded-full px-3 h-9 flex-1">
                        {canEditPrice ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={item.priceAtSale}
                            onChange={(e) => {
                              e.stopPropagation();
                              onUpdatePrice(item.product.id, parseFloat(e.target.value) || 0);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 text-sm font-semibold text-center border-0 p-0 focus-visible:ring-0 bg-white"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">$ {formatCurrency(item.priceAtSale)}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-gray-500">
                      Precio por {item.quantity} unidade{item.quantity !== 1 ? 's' : ''}: ${formatCurrency(calculateSubtotal(item))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Fixed Footer: Total Summary & Checkout */}
          <div className="p-4 border-t bg-white space-y-4 flex-shrink-0">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total productos:</span>
                <span className="font-medium text-gray-900 tabular-nums">{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total:</span>
                <span className="text-2xl font-bold text-gray-900">${formatCurrency(total)}</span>
              </div>
            </div>
            <Button 
              onClick={onProceedToPayment}
              className="w-full h-12 text-base font-semibold bg-gray-900 hover:bg-gray-800"
            >
              {isEditingMovement ? 'Guardar productos' : 'Continuar con el pago'}
            </Button>
          </div>
        </>
      )}

      {/* Edit Item Sheet - Mobile only */}
      <CartItemEditSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        item={editingItem}
        onUpdateQuantity={onUpdateQuantity}
        onUpdatePrice={onUpdatePrice}
        onRemoveItem={onRemoveItem}
        userRole={userRole}
      />

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
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Sí, vaciar carrito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}