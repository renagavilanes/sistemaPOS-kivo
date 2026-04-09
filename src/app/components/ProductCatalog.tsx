import { useState } from 'react';
import { Search, Package, Plus, Minus } from 'lucide-react';
import { Product, CartItem } from '../types';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { formatCurrency } from '../utils/currency';
import { ScrollArea } from './ui/scroll-area';
import { LazyProductImage } from './LazyProductImage';

interface ProductCatalogProps {
  products: Product[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onAddToCart: (product: Product) => void;
  categories: string[];
  cartItems?: any[]; // For showing quantity in mobile
  onUpdateQuantity?: (productId: string, quantity: number) => void;
  canEditPrice?: boolean; // Allows editing product price before adding to cart
  loading?: boolean;
}

export function ProductCatalog({
  products,
  selectedCategory,
  onCategoryChange,
  searchTerm,
  onSearchChange,
  onAddToCart,
  categories,
  cartItems = [],
  onUpdateQuantity,
  canEditPrice = false,
  loading = false,
}: ProductCatalogProps) {
  // Function to remove accents/tildes from text
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'Todas' || product.category === selectedCategory;
    const normalizedProductName = normalizeText(product.name);
    const normalizedSearchTerm = normalizeText(searchTerm);
    const matchesSearch = normalizedProductName.includes(normalizedSearchTerm);
    return matchesCategory && matchesSearch;
  });

  // Get quantity from cart for each product
  const getProductQuantity = (productId: string) => {
    const cartItem = cartItems.find(item => item.product.id === productId);
    return cartItem ? cartItem.quantity : 0;
  };

  const handleQuantityChange = (product: Product, newQuantity: number) => {
    if (newQuantity === 0) {
      // Remove from cart
      if (onUpdateQuantity) {
        onUpdateQuantity(product.id, 0);
      }
    } else if (newQuantity > 0) {
      // Update quantity or add to cart — no stock limit, allows negative inventory
      if (getProductQuantity(product.id) === 0) {
        handleAddToCartWithPrice(product);
      } else if (onUpdateQuantity) {
        onUpdateQuantity(product.id, newQuantity);
      }
    }
  };

  const [customPrices, setCustomPrices] = useState<Record<string, string>>({});

  const getEffectivePrice = (product: Product): number => {
    if (!canEditPrice) return product.price;
    const custom = customPrices[product.id];
    if (custom === undefined || custom === '') return product.price;
    const parsed = parseFloat(custom);
    return isNaN(parsed) || parsed < 0 ? product.price : parsed;
  };

  const handleAddToCartWithPrice = (product: Product) => {
    const effectivePrice = getEffectivePrice(product);
    onAddToCart({ ...product, price: effectivePrice });
  };

  return (
    <div className="flex flex-col h-full lg:bg-gray-50">
      {/* Search */}
      <div className="p-4 border-b bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="p-4 border-b bg-white lg:border-0">
        <div className="flex items-center gap-2">
          <div className="w-0 flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex flex-nowrap gap-2 pb-2 min-w-max">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  className="cursor-pointer whitespace-nowrap text-sm flex-shrink-0"
                  onClick={() => onCategoryChange(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 pb-32 lg:pb-4 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div key={`sale-product-skeleton-${idx}`} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="hidden lg:block">
                  <Skeleton className="w-full aspect-[5/4] rounded-none" />
                  <div className="w-full flex flex-col items-center gap-2 px-[16px] py-[8px]">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                  </div>
                </div>

                <div className="lg:hidden flex gap-3 p-3">
                  <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[400px] px-4">
            <div className="text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">No hay productos</p>
              <p className="text-gray-400">
                {searchTerm || selectedCategory !== 'Todas'
                  ? 'No se encontraron productos con los filtros aplicados'
                  : 'Los productos aparecerán aquí'}
              </p>
            </div>
          </div>
        ) : (
        <div className="p-4 pb-32 lg:pb-4 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4">
          {filteredProducts.map((product) => {
            const quantity = getProductQuantity(product.id);
            
            return (
              <div
                key={product.id}
                className={`border border-gray-200 rounded-lg overflow-hidden bg-white transition-all shadow-sm hover:shadow-md ${
                  quantity > 0 ? 'ring-2 ring-blue-600' : ''
                }`}
              >
                {/* Desktop view - clickable card */}
                <div className="hidden lg:block">
                  <Button
                    variant="ghost"
                    className="h-auto p-0 w-full hover:bg-gray-50 flex flex-col"
                    onClick={() => handleAddToCartWithPrice(product)}
                  >
                    {/* Imagen ~20% menos alta que 1:1 (altura = 80% del ancho) para compactar la tarjeta */}
                    <div className="w-full aspect-[5/4] bg-gray-100 relative overflow-hidden">
                      <LazyProductImage
                        productId={product.id}
                        initialSrc={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      {product.stock <= 0 && (
                        <div className="absolute top-2 right-2">
                          <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium">
                            Stock: {product.stock}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="w-full flex flex-col items-center gap-2 px-[16px] py-[8px]">
                      {/* Price */}
                      {canEditPrice ? (
                        <div
                          className="flex items-center gap-0.5"
                          onClick={e => e.stopPropagation()}
                        >
                          <span className="font-bold text-gray-900 text-lg">${formatCurrency(product.price)}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-gray-900 text-lg">${formatCurrency(product.price)}</span>
                      )}
                      
                      {/* Name - Fixed height container for alignment */}
                      <div className="w-full h-[40px] flex items-center justify-center px-2">
                        <p 
                          className="font-medium text-sm text-gray-700 text-center w-full"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: '2',
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: '1.4',
                            wordWrap: 'break-word',
                            whiteSpace: 'normal'
                          } as React.CSSProperties}
                        >
                          {product.name}
                        </p>
                      </div>
                      
                      {/* Stock badge */}
                      {product.stock > 0 ? (
                        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-[12px] py-[4px] mx-[0px] my-[4px]">
                          {product.stock} disponibles
                        </span>
                      ) : (
                        <span className="text-xs text-orange-600 bg-orange-50 px-3 py-1 rounded-full font-medium">
                          Stock: {product.stock}
                        </span>
                      )}
                    </div>
                  </Button>
                </div>

                {/* Mobile & Tablet view - with quantity controls */}
                <div className="lg:hidden flex gap-3 p-3">
                  {/* Product Image (20% menor que 20×20 → 16×16) */}
                  <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden relative">
                    <LazyProductImage
                      productId={product.id}
                      initialSrc={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    {product.stock <= 0 && (
                      <div className="absolute top-1 right-1">
                        <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-medium leading-none">
                          {product.stock}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm mb-1 line-clamp-2 text-gray-900">{product.name}</h3>
                    <p className={`text-xs mb-2 ${product.stock <= 0 ? 'text-orange-500 font-medium' : 'text-gray-500'}`}>
                      {product.stock > 0 ? `${product.stock} disponibles` : `Stock: ${product.stock}`}
                    </p>
                    {canEditPrice ? (
                      <div className="flex items-center gap-0.5">
                        <span className="text-gray-500 font-semibold text-base">$</span>
                        <span
                          className="font-semibold text-base text-gray-900 w-24 text-left m-0 p-0"
                          title="Precio para esta venta"
                        >
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                    ) : (
                      <p className="font-semibold text-base text-gray-900">${formatCurrency(product.price)}</p>
                    )}
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center">
                    {quantity === 0 ? (
                      <Button
                        size="sm"
                        variant="default"
                        className="rounded-full h-10 w-10 p-0 bg-gray-900 hover:bg-gray-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuantityChange(product, 1);
                        }}
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 bg-gray-100 rounded-full px-2 py-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full h-8 w-8 p-0 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuantityChange(product, quantity - 1);
                          }}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="font-semibold text-sm min-w-[20px] text-center text-gray-900">{quantity}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full h-8 w-8 p-0 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuantityChange(product, quantity + 1);
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </ScrollArea>
    </div>
  );
}