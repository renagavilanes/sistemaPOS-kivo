import { Trash2, Plus, Minus, ShoppingCart as CartIcon } from 'lucide-react';
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
      {/* Header */}
      <div className="p-4 border-b bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg text-gray-900">Carrito</h2>
            <p className="text-sm text-gray-500">{items.length} producto{items.length !== 1 ? 's' : ''}</p>
          </div>
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
        </div>
      </div>

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
          <div className="flex-1 overflow-auto">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {items.map((item) => (
                  <div 
                    key={item.product.id} 
                    className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow xl:cursor-default cursor-pointer active:bg-gray-50 xl:active:bg-white"
                    onClick={() => handleCardClick(item)}
                  >
                    {/* Header: Image + Name + Delete */}
                    <div className="flex items-center gap-3 mb-3">
                      {/* Image */}
                      <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        <LazyProductImage
                          productId={item.product.id}
                          initialSrc={item.product.image}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                          eager
                        />
                      </div>

                      {/* Product Name */}
                      <h3 className="flex-1 font-semibold text-base text-gray-900">{item.product.name}</h3>

                      {/* Delete Button - Desktop only */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="hidden xl:flex h-10 w-10 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border-2 border-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveItem(item.product.id);
                        }}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>

                    {/* Quantity + Price Controls - Desktop only */}
                    <div className="hidden xl:flex items-center gap-3 mb-3">
                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between gap-2 border-2 border-gray-200 rounded-full px-4 h-10 flex-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1));
                          }}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="font-semibold text-base text-gray-900">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateQuantity(item.product.id, item.quantity + 1);
                          }}
                          disabled={item.quantity >= item.product.stock}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Price Display/Edit */}
                      <div className="flex items-center justify-center border-2 border-gray-200 rounded-full px-4 h-10 flex-1">
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
                            className="h-8 text-base font-semibold text-center border-0 p-0 focus-visible:ring-0 bg-white"
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
                <span className="font-medium text-gray-900">${items.reduce((sum, item) => sum + item.quantity, 0)}</span>
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