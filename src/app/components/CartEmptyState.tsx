import { ShoppingCart } from 'lucide-react';

export function CartEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <ShoppingCart
        className="h-20 w-20 text-gray-300"
        strokeWidth={1.4}
        aria-hidden="true"
      />
      <p className="mt-4 text-sm font-medium text-gray-500">Sin productos aún</p>
      <p className="mt-1 text-sm text-gray-400">Toca un artículo del catálogo para agregarlo.</p>
    </div>
  );
}
