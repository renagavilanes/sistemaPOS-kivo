import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowLeftRight, Building2, Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBusiness } from '../contexts/BusinessContext';
import * as apiService from '../services/api';
import type { Product } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { LazyProductImage } from '../components/LazyProductImage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  addProductToLines,
  applyDestChoiceToLine,
  bumpTransferQuantity,
  linesToTransferItems,
  rematchLine,
  type TransferLine,
} from '../utils/inventoryTransferLogic';
import { searchTextMatches } from '../utils/searchText';

function businessLogoSrc(business: { logo?: string; logo_url?: string } | null | undefined) {
  return String(business?.logo || business?.logo_url || '').trim();
}

function BusinessMark({ business }: { business: { name?: string; logo?: string; logo_url?: string } | null | undefined }) {
  const src = businessLogoSrc(business);
  return (
    <span className="h-7 w-7 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Building2 className="h-3.5 w-3.5 text-gray-500" />
      )}
    </span>
  );
}

function canEditInventory(business: { role?: string; permissions?: any } | null | undefined) {
  if (!business) return false;
  if (business.role === 'owner' || business.permissions?.all === true) return true;
  return business.permissions?.products?.edit === true;
}

function canCreateInventory(business: { role?: string; permissions?: any } | null | undefined) {
  if (!business) return false;
  if (business.role === 'owner' || business.permissions?.all === true) return true;
  return business.permissions?.products?.create === true;
}

function matchHint(kind: MatchKind, destName: string) {
  if (kind === 'barcode') return 'Mismo código';
  if (kind === 'name') return 'Mismo nombre';
  if (kind === 'weak') return `Parecido: ${destName}`;
  return 'No hay uno igual';
}

function Thumb({
  product,
  dashed,
  businessId,
}: {
  product?: Product | null;
  dashed?: boolean;
  businessId?: string;
}) {
  if (!product) {
    return <div className="h-11 w-11 shrink-0 rounded-md border border-dashed bg-white" />;
  }
  return (
    <div
      className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-gray-100 ${
        dashed ? 'ring-1 ring-dashed ring-gray-300' : ''
      }`}
    >
      <LazyProductImage
        fillParent
        eager
        businessId={businessId}
        productId={product.id}
        initialSrc={product.image}
        alt={product.name}
        className="h-full w-full object-cover object-center"
      />
    </div>
  );
}

export default function InventoryTransferPage() {
  const navigate = useNavigate();
  const { currentBusiness, businesses } = useBusiness();

  const originName = currentBusiness?.name || 'Este negocio';
  const destOptions = useMemo(
    () => businesses.filter((b) => b.id !== currentBusiness?.id && canEditInventory(b)),
    [businesses, currentBusiness?.id],
  );

  const [destId, setDestId] = useState('');
  const destBusiness = destOptions.find((b) => b.id === destId) || null;
  const destName = destBusiness?.name || 'el otro negocio';
  const destCanCreate = canCreateInventory(destBusiness);

  const [originProducts, setOriginProducts] = useState<Product[]>([]);
  const [destProducts, setDestProducts] = useState<Product[]>([]);
  const [originLoading, setOriginLoading] = useState(false);
  const [destLoading, setDestLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentBusiness?.id) {
      setOriginProducts([]);
      return;
    }
    let cancelled = false;
    setOriginLoading(true);
    apiService
      .getProducts(currentBusiness.id)
      .then((data) => {
        if (!cancelled) setOriginProducts(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudieron cargar los productos');
      })
      .finally(() => {
        if (!cancelled) setOriginLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentBusiness?.id]);

  useEffect(() => {
    if (!destId) {
      setDestProducts([]);
      return;
    }
    let cancelled = false;
    setDestLoading(true);
    apiService
      .getProducts(destId)
      .then((data) => {
        if (!cancelled) setDestProducts(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudieron cargar los productos del destino');
      })
      .finally(() => {
        if (!cancelled) setDestLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [destId]);

  useEffect(() => {
    setLines((prev) =>
      prev.map((line) => ({
        ...line,
        userPicked: false,
        destMode: 'create',
        destProduct: null,
        matchKind: 'none',
      })),
    );
  }, [destId]);

  useEffect(() => {
    setLines((prev) => prev.map((line) => rematchLine(line, destProducts)));
  }, [destProducts]);

  const addedQty = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) map.set(line.from.id, line.quantity);
    return map;
  }, [lines]);

  const catalog = useMemo(() => {
    return originProducts
      .filter((p) => p.isActive !== false)
      .filter((p) => searchTextMatches(p.name, searchTerm))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [originProducts, searchTerm]);

  const pickerList = useMemo(() => {
    return destProducts
      .filter((p) => p.isActive !== false)
      .filter((p) => searchTextMatches(p.name, pickerSearch))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [destProducts, pickerSearch]);

  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
  const createCount = lines.filter((line) => line.destMode === 'create').length;
  const matchCount = lines.length - createCount;

  const addProduct = (product: Product) => {
    if (!destId) {
      toast.error('Elige primero a qué negocio vas a enviar');
      return;
    }
    const result = addProductToLines(lines, product, destProducts);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setLines(result.lines);
  };

  const bumpQuantity = (productId: string, delta: number) => {
    const result = bumpTransferQuantity(lines, productId, delta);
    if (result.error) {
      toast.error(`${result.error} en ${originName}`);
      return;
    }
    setLines(result.lines);
  };

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((line) => line.from.id !== productId));
  };

  const applyDestChoice = (productId: string, dest: Product | null) => {
    setLines((prev) =>
      prev.map((line) => (line.from.id === productId ? applyDestChoiceToLine(line, dest) : line)),
    );
    setPickerFor(null);
    setPickerSearch('');
  };

  const confirmTransfer = async () => {
    if (!currentBusiness?.id || !destId) {
      toast.error('Elige el negocio destino');
      return;
    }
    if (!lines.length) {
      toast.error('Agrega productos desde el catálogo');
      return;
    }
    const over = lines.find((line) => line.quantity > (Number(line.from.stock) || 0));
    if (over) {
      toast.error(`No hay suficiente stock de ${over.from.name}`);
      return;
    }
    const needsCreate = lines.some((line) => line.destMode === 'create');
    if (needsCreate && !destCanCreate) {
      toast.error(`No puedes crear productos en ${destName}. Elige uno existente.`);
      return;
    }
    const missingMap = lines.find((line) => line.destMode === 'match' && !line.destProduct);
    if (missingMap) {
      toast.error(`Falta asignar el destino de ${missingMap.from.name}`);
      return;
    }

    setSubmitting(true);
    try {
      await apiService.transferInventory({
        fromBusinessId: currentBusiness.id,
        toBusinessId: destId,
        items: linesToTransferItems(lines),
      });
      window.dispatchEvent(
        new CustomEvent('productsUpdated', { detail: { businessId: currentBusiness.id } }),
      );
      toast.success(`Se trasladaron ${totalUnits} unidades a ${destName}`);
      navigate('/products');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo completar el traslado');
    } finally {
      setSubmitting(false);
    }
  };

  const pickerLine = lines.find((line) => line.from.id === pickerFor) || null;

  return (
    <div className="h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-gray-50">
      <div className="lg:hidden flex-1 flex flex-col items-center justify-center px-6 text-center bg-white">
        <ArrowLeftRight className="h-8 w-8 text-gray-400 mb-3" />
        <p className="text-base font-semibold text-gray-900">Trasladar inventario</p>
        <p className="mt-2 text-sm text-gray-600 max-w-sm">
          Esta pantalla está pensada para computador, con el catálogo y el destino uno al lado del otro.
        </p>
        <Button variant="outline" className="mt-5" onClick={() => navigate('/products')}>
          Volver a inventario
        </Button>
      </div>

      <div className="hidden lg:flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 bg-white border-b px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/products')} className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">Trasladar inventario</h1>
              <p className="text-sm text-gray-600">Mueve unidades de un negocio a otro.</p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 grid grid-cols-[minmax(280px,1.15fr)_minmax(0,1.85fr)]">
          <section className="min-h-0 flex flex-col border-r bg-white">
            <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b bg-slate-50">
              <span className="text-sm font-medium text-gray-900 truncate">Productos de {originName}</span>
              <span className="text-[11px] tabular-nums text-gray-500 border rounded-full px-2 py-0.5 bg-white shrink-0">
                {catalog.length}
              </span>
            </div>
            <div className="shrink-0 p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar para añadir"
                  className="h-10 pl-9"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {originLoading ? (
                <p className="p-4 text-sm text-gray-500">Cargando productos…</p>
              ) : catalog.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No hay productos para mostrar.</p>
              ) : (
                <ul className="divide-y">
                  {catalog.map((product) => {
                    const added = addedQty.get(product.id) || 0;
                    return (
                      <li key={product.id}>
                        <div className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                          <Thumb product={product} businessId={currentBusiness?.id} />
                          <button
                            type="button"
                            onClick={() => addProduct(product)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
                            <div className="text-xs text-gray-500">Stock {product.stock}</div>
                          </button>
                          {added > 0 ? (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-900 tabular-nums">
                              {added}
                            </Badge>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-full h-10 w-10 p-0 bg-gray-900 hover:bg-gray-800 shrink-0"
                            onClick={() => addProduct(product)}
                            aria-label={`Añadir ${product.name}`}
                          >
                            <Plus className="h-5 w-5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="min-h-0 flex flex-col bg-gray-50">
            <div className="shrink-0 grid grid-cols-2 border-b bg-slate-50">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <BusinessMark business={currentBusiness} />
                  <span className="text-sm font-medium text-gray-900 truncate">Sale de {originName}</span>
                </div>
                <span className="text-[11px] tabular-nums text-gray-500 border rounded-full px-2 py-0.5 bg-white shrink-0">
                  {lines.length}
                </span>
              </div>
              {destId ? (
                <div className="px-3 py-2 border-l min-w-0 flex items-center">
                  <Select value={destId} onValueChange={setDestId}>
                    <SelectTrigger className="h-10 bg-white">
                      {destBusiness ? (
                        <span className="flex items-center gap-2 min-w-0">
                          <BusinessMark business={destBusiness} />
                          <span className="truncate">{destBusiness.name}</span>
                        </span>
                      ) : (
                        <SelectValue placeholder="Elige el negocio" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {destOptions.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          <span className="flex items-center gap-2 min-w-0">
                            <BusinessMark business={b} />
                            <span className="truncate">{b.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="border-l bg-white" />
              )}
            </div>
            {!destId ? (
              <div className="min-h-0 flex-1 grid grid-cols-2">
                <div className="p-4 text-sm text-gray-500">
                  Elige el negocio de la derecha para empezar a añadir productos.
                </div>
                <div className="min-h-0 overflow-auto border-l bg-white p-4">
                  <p className="text-sm font-medium text-gray-900 mb-3">¿A qué negocio vas a enviar?</p>
                  <div className="space-y-2">
                    {destOptions.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setDestId(b.id)}
                        className="w-full flex items-center gap-3 rounded-lg border bg-white px-3 py-3 text-left hover:bg-gray-50"
                      >
                        <span className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {businessLogoSrc(b) ? (
                            <img src={businessLogoSrc(b)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Building2 className="h-5 w-5 text-gray-500" />
                          )}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 truncate">{b.name}</span>
                      </button>
                    ))}
                    {destOptions.length === 0 ? (
                      <p className="text-sm text-gray-500">No hay otro negocio con permiso para recibir inventario.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
            <div className="min-h-0 flex-1 overflow-auto p-2 space-y-2">
              {destLoading ? (
                <p className="p-3 text-sm text-gray-500">Cargando catálogo de {destName}…</p>
              ) : lines.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">
                  Añade productos del catálogo. Cada fila une lo que sale con la ficha de destino.
                </p>
              ) : (
                lines.map((line) => {
                  const isCreate = line.destMode === 'create';
                  const tone = isCreate
                    ? 'bg-blue-50'
                    : line.matchKind === 'weak'
                      ? 'bg-amber-50'
                      : 'bg-emerald-50';
                  const join = isCreate
                    ? 'bg-blue-500'
                    : line.matchKind === 'weak'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';
                  return (
                    <div
                      key={line.from.id}
                      className="relative grid grid-cols-2 items-stretch rounded-lg border bg-white overflow-hidden"
                    >
                      <article className="p-3 pr-4">
                        <div className="flex items-start gap-3">
                          <Thumb product={line.from} businessId={currentBusiness?.id} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 leading-snug">{line.from.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Hay {line.from.stock}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLine(line.from.id)}
                            className="text-gray-400 hover:text-red-600"
                            aria-label={`Quitar ${line.from.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-1 border-2 border-gray-200 rounded-full px-3 h-9 w-[148px]">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              bumpQuantity(line.from.id, -1);
                            }}
                            aria-label="Menos"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                          <span className="font-semibold text-sm text-gray-900 tabular-nums">{line.quantity}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              bumpQuantity(line.from.id, 1);
                            }}
                            aria-label="Más"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </article>
                      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-200" />
                      <span
                        className={`pointer-events-none absolute top-1/2 left-1/2 z-[1] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${join}`}
                      />
                      <article className={`p-3 pl-4 ${tone}`}>
                        <div className="flex items-start gap-3">
                          <Thumb
                            product={isCreate ? line.from : line.destProduct}
                            dashed={isCreate}
                            businessId={isCreate ? currentBusiness?.id : destId}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 leading-snug">
                              {isCreate ? `Crear en ${destName}` : line.destProduct?.name}
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              {isCreate
                                ? 'Se copiará este producto'
                                : `Hay ${line.destProduct?.stock ?? 0} · ${matchHint(line.matchKind, line.destProduct?.name || '')}`}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 h-8 bg-white"
                          onClick={() => {
                            setPickerFor(line.from.id);
                            setPickerSearch('');
                          }}
                        >
                          Cambiar
                        </Button>
                      </article>
                    </div>
                  );
                })
              )}
            </div>
            )}
          </section>
        </div>

        <footer className="shrink-0 border-t bg-white px-6 py-3 flex items-center justify-between gap-6">
          <div className="min-w-0 text-sm text-gray-600">
            <p className="font-medium text-gray-900">
              {originName} → {destBusiness ? destName : 'elige destino'}
            </p>
            <p className="mt-0.5">
              {lines.length} productos · {totalUnits} unidades
              {lines.length > 0 ? (
                <>
                  {' '}
                  · {matchCount} se suman al inventario existente
                  {createCount > 0 ? ` · ${createCount} se ${createCount === 1 ? 'crea' : 'crean'} en ${destName}` : ''}
                </>
              ) : null}
            </p>
          </div>
          <Button
            onClick={confirmTransfer}
            disabled={submitting || !destId || lines.length === 0}
            className="bg-gray-900 hover:bg-gray-800 h-11 px-5 shrink-0"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Trasladando…
              </>
            ) : (
              'Confirmar traslado'
            )}
          </Button>
        </footer>
      </div>

      <Dialog open={Boolean(pickerLine)} onOpenChange={(open) => !open && setPickerFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar en {destName}</DialogTitle>
            <DialogDescription>
              {pickerLine ? `Producto que sale: ${pickerLine.from.name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Buscar en el destino"
              className="h-10 pl-9"
            />
          </div>
          <div className="max-h-80 overflow-auto border rounded-md divide-y">
            {destCanCreate && pickerLine ? (
              <button
                type="button"
                onClick={() => applyDestChoice(pickerLine.from.id, null)}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50"
              >
                <div className="text-sm font-medium text-blue-800">Crear en {destName}</div>
                <div className="text-xs text-gray-500">Copia nombre, precio y código</div>
              </button>
            ) : null}
            {pickerList.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => pickerLine && applyDestChoice(pickerLine.from.id, product)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left"
              >
                <Thumb product={product} businessId={destId} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
                  <div className="text-xs text-gray-500">Stock {product.stock}</div>
                </div>
              </button>
            ))}
            {pickerList.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-500">No hay coincidencias en {destName}.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
