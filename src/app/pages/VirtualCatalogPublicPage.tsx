import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ArrowLeft, MessageCircle, Minus, Plus, ShoppingCart, Store, Truck } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { LazyProductImage } from '../components/LazyProductImage';
import { fetchPublicCatalogBySlug } from '../lib/virtualCatalogApi';
import type { OutOfStockMode, PublicCatalogProduct, PublicCatalogResponse } from '../lib/virtualCatalogTypes';
import { formatCurrency } from '../utils/currency';
import { toast } from 'sonner';

type DeliveryType = 'pickup' | 'homeDelivery';
type MobileStep = 'products' | 'cart' | 'checkout';

type CartLine = { product: PublicCatalogProduct; quantity: number };

function cartStorageKey(slug: string) {
  return `virtual_catalog_cart_${slug}`;
}

function sanitizeWhatsAppNumber(raw: string): string {
  return String(raw || '').replace(/[^\d]/g, '');
}

function buildWhatsAppUrl(phone: string, message: string): string {
  const to = sanitizeWhatsAppNumber(phone);
  const text = encodeURIComponent(message);
  return `https://wa.me/${to}?text=${text}`;
}

function formatOrderMessage(params: {
  businessName: string;
  deliveryType: DeliveryType;
  deliveryFee?: number;
  customer: Record<string, string>;
  lines: Array<{ name: string; quantity: number; unitPrice: number }>;
}): string {
  const { businessName, deliveryType, deliveryFee, customer, lines } = params;
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const fee = deliveryType === 'homeDelivery' ? Number(deliveryFee || 0) : 0;
  const total = subtotal + fee;

  const customerBlock =
    deliveryType === 'pickup'
      ? ['Cliente:', `Nombre: ${customer.name || '-'}`, `Teléfono: ${customer.phone || '-'}`].join('\n')
      : [
          'Cliente:',
          `Nombre: ${customer.name || '-'}`,
          `Teléfono: ${customer.phone || '-'}`,
          `Cédula: ${customer.cedula || '-'}`,
          'Entrega:',
          'Tipo: Domicilio',
          `Ciudad: ${customer.city || '-'}`,
          `Dirección: ${customer.address || '-'}`,
          `Calle principal: ${customer.mainStreet || '-'}`,
          `Calle secundaria: ${customer.secondaryStreet || '-'}`,
          `Referencia: ${customer.reference || '-'}`,
        ].join('\n');

  const productsBlock = lines.length
    ? lines.map((l) => `${l.name} x${l.quantity} → $${formatCurrency(l.unitPrice * l.quantity)}`).join('\n')
    : '(sin productos)';

  const feeLine = deliveryType === 'homeDelivery' && fee > 0 ? `Envío: $${formatCurrency(fee)}` : '';

  return [
    'NUEVO PEDIDO',
    `Negocio: ${businessName}`,
    '',
    customerBlock,
    'Productos:',
    productsBlock,
    '------------------------------',
    `Total: $${formatCurrency(total)}`,
    ...(feeLine ? ['', feeLine] : []),
  ].join('\n');
}

export default function VirtualCatalogPublicPage() {
  const { slug: slugParam } = useParams();
  const slug = String(slugParam || '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicCatalogResponse | null>(null);

  const [mobileStep, setMobileStep] = useState<MobileStep>('products');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [customer, setCustomer] = useState<Record<string, string>>({
    name: '',
    phone: '',
    cedula: '',
    city: '',
    address: '',
    mainStreet: '',
    secondaryStreet: '',
    reference: '',
  });

  const [cart, setCart] = useState<CartLine[]>([]);

  useEffect(() => {
    if (!slug) {
      setError('Catálogo inválido');
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPublicCatalogBySlug(slug);
        setData(res);

        // Defaults de entrega según config
        const d = res.catalog.delivery;
        if (d.pickup && !d.homeDelivery) setDeliveryType('pickup');
        if (!d.pickup && d.homeDelivery) setDeliveryType('homeDelivery');
        if (d.pickup && d.homeDelivery) setDeliveryType('pickup');

        // Carrito persistido
        try {
          const raw = localStorage.getItem(cartStorageKey(slug));
          if (!raw) return;
          const parsed = JSON.parse(raw) as { lines?: Array<{ id: string; quantity: number }> };
          const map = new Map((res.products || []).map((p) => [p.id, p]));
          const lines = (parsed.lines || [])
            .map((l) => {
              const p = map.get(l.id);
              if (!p) return null;
              return { product: p, quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)) };
            })
            .filter(Boolean) as CartLine[];
          setCart(lines);
        } catch {
          // ignore
        }
      } catch (e: any) {
        setData(null);
        setError(e?.message || 'No se pudo cargar el catálogo');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const lines = cart.map((l) => ({ id: l.product.id, quantity: l.quantity }));
    localStorage.setItem(cartStorageKey(slug), JSON.stringify({ lines }));
  }, [cart, slug]);

  useEffect(() => {
    if (cart.length === 0 && mobileStep !== 'products') {
      setMobileStep('products');
    }
  }, [cart.length, mobileStep]);

  const outOfStockMode: OutOfStockMode | null = data?.catalog.outOfStockMode ?? null;

  const categories = useMemo(() => {
    const cats = [...new Set((data?.products || []).map((p) => (p.category || '').trim()).filter(Boolean))].sort();
    return ['Todas', ...cats];
  }, [data?.products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = (data?.products || []).slice();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    if (selectedCategory !== 'Todas') list = list.filter((p) => (p.category || '') === selectedCategory);
    return list;
  }, [data?.products, search, selectedCategory]);

  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const fee =
    deliveryType === 'homeDelivery' && data?.catalog.delivery.homeDelivery
      ? Number(data.catalog.delivery.homeDeliveryFee || 0) || 0
      : 0;
  const total = subtotal + fee;

  const getQtyInCart = (productId: string) => cart.find((l) => l.product.id === productId)?.quantity ?? 0;

  const setQty = (productId: string, qty: number) => {
    const q = Math.max(0, Math.floor(qty));
    setCart((prev) => {
      if (q <= 0) return prev.filter((l) => l.product.id !== productId);
      return prev.map((l) => (l.product.id === productId ? { ...l, quantity: q } : l));
    });
  };

  const canAddProduct = (p: PublicCatalogProduct) => {
    if (!outOfStockMode) return false;
    if (p.availability === 'unavailable') return false;
    if (p.stock <= 0 && outOfStockMode === 'show') return false; // permitimos “ver” pero no comprar
    if (p.stock <= 0) return false;
    return true;
  };

  const addToCart = (p: PublicCatalogProduct) => {
    if (!canAddProduct(p)) {
      if (p.availability === 'unavailable') toast.error('Producto no disponible');
      else if (p.stock <= 0) toast.error('Producto sin stock');
      else toast.error('No se puede agregar este producto');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (!existing) return [{ product: p, quantity: 1 }, ...prev];
      if (existing.quantity >= p.stock) {
        toast.error('Stock insuficiente');
        return prev;
      }
      return prev.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
    });
  };

  const incQty = (p: PublicCatalogProduct) => addToCart(p);
  const decQty = (p: PublicCatalogProduct) => {
    const current = getQtyInCart(p.id);
    if (current <= 0) return;
    setQty(p.id, current - 1);
  };

  const validate = (): string | null => {
    if (!data) return 'Catálogo no disponible';
    if (cart.length === 0) return 'El carrito está vacío';
    if (!data.business.phone.trim()) return 'El negocio no tiene WhatsApp configurado';

    const d = data.catalog.delivery;
    if (deliveryType === 'pickup' && !d.pickup) return 'Retiro no disponible';
    if (deliveryType === 'homeDelivery' && !d.homeDelivery) return 'Domicilio no disponible';

    if (!customer.name.trim()) return 'Nombre es obligatorio';
    if (!customer.phone.trim()) return 'Teléfono es obligatorio';

    if (deliveryType === 'homeDelivery') {
      const required = ['cedula', 'city', 'address', 'mainStreet', 'secondaryStreet', 'reference'] as const;
      for (const k of required) {
        if (!String(customer[k] || '').trim()) return 'Completa todos los datos de entrega';
      }
    }
    return null;
  };

  const sendWhatsApp = () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!data) return;

    const lines = cart.map((l) => ({
      name: l.product.name,
      quantity: l.quantity,
      unitPrice: l.product.price,
    }));

    const msg = formatOrderMessage({
      businessName: data.business.name,
      deliveryType,
      deliveryFee: data.catalog.delivery.homeDeliveryFee,
      customer,
      lines,
    });

    const url = buildWhatsAppUrl(data.business.phone, msg);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!slug) {
    return <div className="min-h-[100dvh] flex items-center justify-center text-sm text-gray-600">Catálogo inválido</div>;
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-gray-200 border-t-[#272B36] animate-spin" />
          <div className="text-sm text-gray-700 font-medium">Cargando catálogo…</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-6 text-center space-y-3">
          <div className="text-base font-semibold text-gray-900">No disponible</div>
          <div className="text-sm text-gray-600">{error || 'No se pudo cargar este catálogo.'}</div>
          <Button className="w-full rounded-xl" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const businessInitial = (data.business.name || 'N').trim().slice(0, 1).toUpperCase();

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  if (mobileStep === 'checkout') setMobileStep('cart');
                  else if (mobileStep === 'cart') setMobileStep('products');
                  else window.history.back();
                }}
                className="lg:hidden h-9 w-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center flex-shrink-0 active:scale-[0.98]"
                aria-label="Volver"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="h-10 w-10 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {data.business.logoUrl ? (
                  <img src={data.business.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-gray-800">{businessInitial}</span>
                )}
              </div>

              <div className="min-w-0">
                <div className="text-[15px] sm:text-base font-bold text-gray-900 truncate leading-tight">{data.business.name}</div>
                <div className="text-[11px] text-gray-500 lg:hidden leading-tight mt-0.5">
                  {mobileStep === 'products' ? 'Catálogo' : mobileStep === 'cart' ? 'Carrito' : 'Entrega'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileStep('cart')}
              className="relative h-10 w-10 rounded-2xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center flex-shrink-0 active:scale-[0.98]"
              aria-label="Ver carrito"
            >
              <ShoppingCart className="h-5 w-5 text-gray-800" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-[#272B36] text-white text-[11px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:py-5 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        <div className="space-y-4 lg:order-1">
          <div className={`bg-white rounded-2xl border border-gray-200 p-4 ${mobileStep !== 'products' ? 'hidden lg:block' : ''}`}>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Buscar</Label>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..." className="h-10" />
              </div>
              {categories.length > 1 && (
                <div className="space-y-2">
                  <Label>Categorías</Label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium transition-colors ${
                          selectedCategory === cat ? 'bg-[#272B36] text-white border-[#272B36]' : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 ${
              mobileStep !== 'products' ? 'hidden lg:grid' : ''
            }`}
          >
            {filteredProducts.map((p) => {
              const qty = getQtyInCart(p.id);
              const disabledCard = p.availability === 'unavailable';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={disabledCard}
                  className={`text-left border border-gray-200 rounded-lg overflow-hidden bg-white transition-all shadow-sm hover:shadow-md active:scale-[0.99] disabled:opacity-60 ${
                    qty > 0 ? 'ring-2 ring-blue-600' : ''
                  }`}
                >
                  <div className="relative">
                    <div className="hidden sm:block relative aspect-[5/4] w-full shrink-0 overflow-hidden bg-gray-100">
                      <LazyProductImage
                        fillParent
                        productId={p.id}
                        initialSrc={p.image}
                        alt={p.name}
                        className="h-full w-full object-cover object-center"
                      />
                    </div>
                    <div className="sm:hidden h-20 w-full bg-gray-100 overflow-hidden">
                      <LazyProductImage
                        fillParent
                        productId={p.id}
                        initialSrc={p.image}
                        alt={p.name}
                        className="h-full w-full object-cover object-center"
                      />
                    </div>

                    {qty > 0 && (
                      <div className="absolute top-2 right-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/95 border border-gray-200 shadow-sm px-2 py-1 text-xs font-semibold text-gray-900">
                          <ShoppingCart className="h-3.5 w-3.5" />
                          {qty}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="min-h-[36px]">
                      <div className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">{p.name}</div>
                      <div className="text-xs text-gray-500 truncate">{p.category || '—'}</div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-gray-900 text-base">${formatCurrency(p.price)}</div>
                      {p.availability === 'unavailable' ? (
                        <span className="text-xs text-gray-600 bg-gray-100 rounded-full px-2 py-1 font-medium">No disponible</span>
                      ) : p.stock <= 0 ? (
                        <span className="text-xs text-orange-700 bg-orange-50 rounded-full px-2 py-1 font-medium">Sin stock</span>
                      ) : (
                        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-1 font-medium">Disponible</span>
                      )}
                    </div>

                    {qty > 0 && (
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-xs text-gray-500 shrink-0">Cantidad</div>
                        <div
                          className="flex items-center gap-2 bg-gray-100 rounded-full px-2 py-1 max-w-full"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <button
                            type="button"
                            className="rounded-full h-8 w-8 p-0 hover:bg-gray-200 flex items-center justify-center shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              decQty(p);
                            }}
                            aria-label="Disminuir"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-semibold text-sm min-w-[20px] text-center text-gray-900 shrink-0">{qty}</span>
                          <button
                            type="button"
                            className="rounded-full h-8 w-8 p-0 hover:bg-gray-200 flex items-center justify-center shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              incQty(p);
                            }}
                            aria-label="Aumentar"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile cart */}
          <div className={`${mobileStep === 'cart' ? 'block' : 'hidden'} lg:hidden`}>
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Carrito</h2>
                <span className="text-sm text-gray-600">{cartCount} item(s)</span>
              </div>

              <div className="mt-3 space-y-2">
                {cart.map((l) => (
                  <div key={l.product.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{l.product.name}</div>
                      <div className="text-xs text-gray-500">${formatCurrency(l.product.price)} c/u</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-9 w-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center active:scale-[0.98]"
                        onClick={() => setQty(l.product.id, l.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="w-10 text-center text-sm font-semibold">{l.quantity}</div>
                      <button
                        type="button"
                        className="h-9 w-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center active:scale-[0.98]"
                        onClick={() => {
                          const p = l.product;
                          if (l.quantity >= p.stock) {
                            toast.error('Stock insuficiente');
                            return;
                          }
                          setQty(p.id, l.quantity + 1);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">${formatCurrency(subtotal)}</span>
                </div>
                {deliveryType === 'homeDelivery' && fee > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Envío</span>
                    <span className="font-semibold text-gray-900">${formatCurrency(fee)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-gray-700 font-semibold">Total</span>
                  <span className="font-bold text-gray-900">${formatCurrency(total)}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setCart([])} disabled={cart.length === 0} className="rounded-xl">
                  Vaciar
                </Button>
                <Button
                  onClick={() => setMobileStep('checkout')}
                  disabled={cart.length === 0}
                  className="rounded-xl bg-[#272B36] hover:bg-[#1f222b]"
                >
                  Continuar
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile checkout */}
          <div className={`${mobileStep === 'checkout' ? 'block' : 'hidden'} lg:hidden`}>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Entrega y datos</h2>
                <button type="button" onClick={() => setMobileStep('cart')} className="text-sm font-semibold text-gray-700 hover:underline">
                  Ver carrito
                </button>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">${formatCurrency(subtotal)}</span>
                </div>
                {deliveryType === 'homeDelivery' && fee > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Envío</span>
                    <span className="font-semibold text-gray-900">${formatCurrency(fee)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-gray-700 font-semibold">Total</span>
                  <span className="font-bold text-gray-900">${formatCurrency(total)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Método de entrega</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('pickup')}
                    disabled={!data.catalog.delivery.pickup}
                    className={`rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98] ${
                      deliveryType === 'pickup' ? 'bg-[#272B36] text-white border-[#272B36]' : 'bg-white hover:bg-gray-50'
                    } ${!data.catalog.delivery.pickup ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Store className="h-4 w-4" />
                    Retiro
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('homeDelivery')}
                    disabled={!data.catalog.delivery.homeDelivery}
                    className={`rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98] ${
                      deliveryType === 'homeDelivery' ? 'bg-[#272B36] text-white border-[#272B36]' : 'bg-white hover:bg-gray-50'
                    } ${!data.catalog.delivery.homeDelivery ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Truck className="h-4 w-4" />
                    Domicilio
                  </button>
                </div>
              </div>

              {deliveryType === 'homeDelivery' && fee > 0 && (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">
                  Envío: <span className="font-semibold">${formatCurrency(fee)}</span> (se suma al total)
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono *</Label>
                  <Input value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} />
                </div>
              </div>

              {deliveryType === 'homeDelivery' && (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Cédula *</Label>
                      <Input value={customer.cedula} onChange={(e) => setCustomer((c) => ({ ...c, cedula: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Ciudad *</Label>
                      <Input value={customer.city} onChange={(e) => setCustomer((c) => ({ ...c, city: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección *</Label>
                    <Input value={customer.address} onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Calle principal *</Label>
                      <Input value={customer.mainStreet} onChange={(e) => setCustomer((c) => ({ ...c, mainStreet: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Calle secundaria *</Label>
                      <Input
                        value={customer.secondaryStreet}
                        onChange={(e) => setCustomer((c) => ({ ...c, secondaryStreet: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Referencia *</Label>
                    <Input value={customer.reference} onChange={(e) => setCustomer((c) => ({ ...c, reference: e.target.value }))} />
                  </div>
                </>
              )}

              <Button className="w-full h-12 bg-green-600 hover:bg-green-700 rounded-xl" onClick={sendWhatsApp}>
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar pedido por WhatsApp
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop column */}
        <div className="space-y-4 hidden lg:block lg:order-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Carrito</h2>
              <span className="text-sm text-gray-600">{cartCount} item(s)</span>
            </div>

            <div className="mt-3 space-y-2">
              {cart.length === 0 ? (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">Agrega productos para armar tu pedido.</div>
              ) : (
                cart.map((l) => (
                  <div key={l.product.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{l.product.name}</div>
                      <div className="text-xs text-gray-500">${formatCurrency(l.product.price)} c/u</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-9 w-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center active:scale-[0.98]"
                        onClick={() => setQty(l.product.id, l.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="w-10 text-center text-sm font-semibold">{l.quantity}</div>
                      <button
                        type="button"
                        className="h-9 w-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center active:scale-[0.98]"
                        onClick={() => {
                          const p = l.product;
                          if (l.quantity >= p.stock) {
                            toast.error('Stock insuficiente');
                            return;
                          }
                          setQty(p.id, l.quantity + 1);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold text-gray-900">${formatCurrency(subtotal)}</span>
              </div>
              {deliveryType === 'homeDelivery' && fee > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Envío</span>
                  <span className="font-semibold text-gray-900">${formatCurrency(fee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm pt-2 border-t">
                <span className="text-gray-700 font-semibold">Total</span>
                <span className="font-bold text-gray-900">${formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mt-3">
              <Button variant="outline" className="w-full rounded-xl" onClick={() => setCart([])} disabled={cart.length === 0}>
                Vaciar carrito
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
            <div className="space-y-2">
              <Label>Método de entrega</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryType('pickup')}
                  disabled={!data.catalog.delivery.pickup}
                  className={`rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    deliveryType === 'pickup' ? 'bg-[#272B36] text-white border-[#272B36]' : 'bg-white hover:bg-gray-50'
                  } ${!data.catalog.delivery.pickup ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Store className="h-4 w-4" />
                  Retiro
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType('homeDelivery')}
                  disabled={!data.catalog.delivery.homeDelivery}
                  className={`rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    deliveryType === 'homeDelivery' ? 'bg-[#272B36] text-white border-[#272B36]' : 'bg-white hover:bg-gray-50'
                  } ${!data.catalog.delivery.homeDelivery ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Truck className="h-4 w-4" />
                  Domicilio
                </button>
              </div>
            </div>

            {deliveryType === 'homeDelivery' && fee > 0 && (
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">
                Envío: <span className="font-semibold">${formatCurrency(fee)}</span> (se suma al total)
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono *</Label>
                <Input value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} />
              </div>
            </div>

            {deliveryType === 'homeDelivery' && (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Cédula *</Label>
                    <Input value={customer.cedula} onChange={(e) => setCustomer((c) => ({ ...c, cedula: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciudad *</Label>
                    <Input value={customer.city} onChange={(e) => setCustomer((c) => ({ ...c, city: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dirección *</Label>
                  <Input value={customer.address} onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Calle principal *</Label>
                    <Input value={customer.mainStreet} onChange={(e) => setCustomer((c) => ({ ...c, mainStreet: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Calle secundaria *</Label>
                    <Input
                      value={customer.secondaryStreet}
                      onChange={(e) => setCustomer((c) => ({ ...c, secondaryStreet: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Referencia *</Label>
                  <Input value={customer.reference} onChange={(e) => setCustomer((c) => ({ ...c, reference: e.target.value }))} />
                </div>
              </>
            )}

            <Button className="w-full h-12 bg-green-600 hover:bg-green-700 rounded-xl" onClick={sendWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar pedido por WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
