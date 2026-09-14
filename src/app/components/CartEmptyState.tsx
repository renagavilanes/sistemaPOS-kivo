import { MousePointerClick, ShoppingCart } from 'lucide-react';

/** Estado vacío del carrito: tarjeta compacta, sin el icono gigante centrado. */
export function CartEmptyState() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#272B36] text-white">
              <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-gray-900">Sin productos aún</p>
              <p className="mt-1 text-sm leading-snug text-gray-500">
                Toca un artículo del catálogo para agregarlo a esta venta.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
            <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            Un toque suma 1 unidad
          </div>
        </div>
      </div>
    </div>
  );
}
