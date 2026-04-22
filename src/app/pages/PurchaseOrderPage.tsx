import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Download, Loader2, Plus, Minus, Trash2, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { useBusiness } from '../contexts/BusinessContext';
import * as apiService from '../services/api';
import { exportPurchaseOrderToExcel } from '../utils/purchaseOrderExcelExport';
import { Product } from '../types';
import { LazyProductImage } from '../components/LazyProductImage';

const normalizeText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

export default function PurchaseOrderPage() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<'stock-low' | 'stock-high' | 'name-asc' | 'name-desc'>('stock-low');

  // Cabecera editable
  const [providerName, setProviderName] = useState('');
  const [contact, setContact] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));

  // Items del pedido
  const [items, setItems] = useState<Array<{
    productId: string;
    name: string;
    image?: string;
    quantity: number;
    description: string;
  }>>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!currentBusiness?.id) return;
    const load = async () => {
      setProductsLoading(true);
      try {
        const productsData = await apiService.getProducts(currentBusiness.id);
        const mappedProducts = productsData.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          cost: p.cost,
          stock: p.stock,
          category: p.category || 'Sin categoría',
          image: p.image || '',
        }));
        setProducts(mappedProducts);
      } catch (e) {
        console.error('Error cargando productos para pedido:', e);
        toast.error('No se pudieron cargar los productos');
      } finally {
        setProductsLoading(false);
      }
    };
    load();
  }, [currentBusiness?.id]);

  // Precargar datos del negocio si el usuario no ha escrito nada
  useEffect(() => {
    if (!currentBusiness) return;
    if (!contact && currentBusiness.phone) setContact(currentBusiness.phone);
    if (!deliveryAddress && currentBusiness.address) setDeliveryAddress(currentBusiness.address);
  }, [currentBusiness?.id, currentBusiness?.phone, currentBusiness?.address]);

  const filteredProducts = useMemo(() => {
    const q = normalizeText(searchTerm);
    if (!q) return products;
    return products.filter((p) => normalizeText(p.name).includes(q));
  }, [products, searchTerm]);

  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    switch (sortOption) {
      case 'stock-low':
        return arr.sort((a, b) => a.stock - b.stock);
      case 'stock-high':
        return arr.sort((a, b) => b.stock - a.stock);
      case 'name-desc':
        return arr.sort((a, b) => b.name.localeCompare(a.name));
      case 'name-asc':
      default:
        return arr.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [filteredProducts, sortOption]);

  const quickList = useMemo(() => sortedProducts.slice(0, 40), [sortedProducts]);

  const stockIndicator = (stock: number) => {
    const zero = stock === 0;
    const low = stock > 0 && stock < 5;
    const label = zero ? 'Sin stock' : low ? 'Bajo' : 'OK';
    const cls = zero
      ? 'bg-red-500'
      : low
        ? 'bg-amber-500'
        : 'bg-emerald-500';
    return (
      <span className="flex items-center gap-1.5" title={label} aria-label={label}>
        <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
      </span>
    );
  };

  const itemsQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) map.set(i.productId, (map.get(i.productId) || 0) + (Number(i.quantity) || 0));
    return map;
  }, [items]);

  const addProduct = (product: Product) => {
    if (!currentBusiness?.id) return;
    const exists = items.find((i) => i.productId === product.id);
    if (exists) {
      setItems((prev) => prev.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)));
      return;
    }

    // ✅ Optimista: aparece de inmediato (imagen se completa en segundo plano)
    setItems((prev) => [
      ...prev,
      { productId: product.id, name: product.name, image: product.image || '', quantity: 1, description: '' },
    ]);

    apiService
      .getProductById(currentBusiness.id, product.id)
      .then((full) => {
        const img = (full as any)?.image ?? '';
        if (!img) return;
        setItems((prev) => prev.map((i) => (i.productId === product.id ? { ...i, image: img } : i)));
      })
      .catch(() => null);
  };

  const removeItem = (productId: string) => setItems((prev) => prev.filter((i) => i.productId !== productId));
  const updateItem = (productId: string, patch: Partial<{ quantity: number; description: string }>) => {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, ...patch } : i)));
  };

  const convertToPngBase64 = async (source: string, maxSizePx = 96): Promise<string | undefined> => {
    const src = String(source || '').trim();
    if (!src) return undefined;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo cargar imagen'));
      });
      const w = img.naturalWidth || img.width || maxSizePx;
      const h = img.naturalHeight || img.height || maxSizePx;
      const scale = Math.min(1, maxSizePx / Math.max(w, h));
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(img, 0, 0, tw, th);
      const dataUrl = canvas.toDataURL('image/png', 0.92);
      return dataUrl.split(',')[1] || undefined;
    } catch (e) {
      console.warn('No se pudo convertir imagen a PNG base64:', e);
      return undefined;
    }
  };

  const exportExcel = async () => {
    if (!items.length) {
      toast.error('Agrega al menos un producto al pedido');
      return;
    }
    try {
      setExporting(true);
      const itemsWithImages = await Promise.all(
        items.map(async (i, idx) => ({
          index: idx + 1,
          name: i.name,
          description: i.description,
          quantity: Math.max(0, Math.floor(Number(i.quantity) || 0)),
          imagePngBase64: await convertToPngBase64(i.image || ''),
        })),
      );
      const ok = await exportPurchaseOrderToExcel({
        header: {
          businessName: currentBusiness?.name || 'Mi Negocio',
          providerName,
          contact,
          deliveryAddress,
          notes,
          date: dateStr,
        },
        items: itemsWithImages,
      });
      if (ok) toast.success('Pedido exportado a Excel');
      else toast.error('No se pudo exportar el pedido');
    } finally {
      setExporting(false);
    }
  };

  const totalUnits = useMemo(() => items.reduce((s, i) => s + (Number(i.quantity) || 0), 0), [items]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/products')} className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Pedido a proveedor</h1>
              <div className="text-sm text-gray-600">
                Ítems: <span className="font-semibold text-gray-900">{items.length}</span> · Unidades:{' '}
                <span className="font-semibold text-gray-900">{totalUnits}</span>
              </div>
            </div>
          </div>
          <Button
            onClick={exportExcel}
            disabled={exporting}
            className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </>
            )}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Cabecera */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="Ej: Distribuidora XYZ" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>Contacto</Label>
                  <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nombre / Teléfono / Email" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>Dirección / Entrega</Label>
                  <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Opcional" className="h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" className="min-h-20" />
              </div>
            </div>

            {/* Lista para agregar */}
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-gray-900">Agregar productos</div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={sortOption === 'stock-low' ? 'default' : 'outline'}
                    onClick={() => setSortOption('stock-low')}
                    className={sortOption === 'stock-low' ? 'bg-gray-900 hover:bg-gray-800' : ''}
                  >
                    Menos stock
                  </Button>
                  <Button
                    type="button"
                    variant={sortOption === 'name-asc' ? 'default' : 'outline'}
                    onClick={() => setSortOption('name-asc')}
                    className={sortOption === 'name-asc' ? 'bg-gray-900 hover:bg-gray-800' : ''}
                  >
                    A-Z
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar producto para agregar..."
                  className="h-11 pl-10"
                />
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[520px] overflow-auto divide-y">
                  {productsLoading ? (
                    <div className="p-4 text-sm text-gray-500">Cargando productos...</div>
                  ) : quickList.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No hay resultados</div>
                  ) : (
                    quickList.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                      >
                        <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded bg-gray-100">
                          <LazyProductImage
                            fillParent
                            productId={p.id}
                            initialSrc={p.image}
                            alt={p.name}
                            className="h-full w-full object-cover object-center"
                          />
                        </div>

                        <div className="min-w-0 flex-1 flex items-center h-11">
                          <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {(() => {
                            const added = itemsQtyByProduct.get(p.id) || 0;
                            return added > 0 ? (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-900">
                                En pedido: {added}
                              </Badge>
                            ) : null;
                          })()}

                          <div className="text-right min-w-[88px]">
                            <div className="text-[11px] text-gray-500 leading-none">Stock</div>
                            <div className="text-base font-bold text-gray-900 leading-tight">{p.stock}</div>
                          </div>

                          {stockIndicator(p.stock)}

                          <div className="h-9 w-9 rounded-md border flex items-center justify-center text-gray-700 bg-white">
                            <Plus className="w-4 h-4" />
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Nota: las fotos se incrustan en el archivo (puede tardar si hay muchas).
              </div>
            </div>
          </div>

          {/* Items del pedido */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white border rounded-lg p-4">
              <div className="font-semibold text-gray-900 mb-3">Productos en el pedido</div>
              {items.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 bg-gray-50 rounded-lg">Aún no has agregado productos.</div>
              ) : (
                <div className="space-y-3">
                  {items.map((i) => (
                    <div key={i.productId} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded bg-gray-100">
                            <LazyProductImage
                              fillParent
                              productId={i.productId}
                              initialSrc={i.image}
                              alt={i.name}
                              className="h-full w-full object-cover object-center"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate">{i.name}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateItem(i.productId, { quantity: Math.max(0, i.quantity - 1) })}
                            aria-label="Disminuir cantidad"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            value={i.quantity}
                            onChange={(e) => {
                              const n = Math.floor(Number(e.target.value) || 0);
                              updateItem(i.productId, { quantity: Math.max(0, n) });
                            }}
                            className="h-8 w-16 text-right"
                            aria-label="Cantidad"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateItem(i.productId, { quantity: i.quantity + 1 })}
                            aria-label="Aumentar cantidad"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(i.productId)}
                            title="Quitar"
                            aria-label="Quitar producto"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="text-xs font-medium text-gray-600 mb-1">Descripción</div>
                        <Input
                          value={i.description}
                          onChange={(e) => updateItem(i.productId, { description: e.target.value })}
                          placeholder="Ej: Presentación, marca, referencia..."
                          className="h-9"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

