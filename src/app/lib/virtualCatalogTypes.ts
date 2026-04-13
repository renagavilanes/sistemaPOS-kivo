export type OutOfStockMode = 'show' | 'hide' | 'mark_unavailable';

export type VirtualCatalogDelivery = {
  pickup: boolean;
  homeDelivery: boolean;
  homeDeliveryFee: number;
};

export type VirtualCatalogConfig = {
  enabled: boolean;
  slug: string;
  outOfStockMode: OutOfStockMode;
  delivery: VirtualCatalogDelivery;
};

export type PublicCatalogBusiness = {
  id: string;
  name: string;
  phone: string;
  logoUrl: string;
};

export type PublicCatalogProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  image: string;
  availability: 'available' | 'unavailable' | 'out_of_stock';
};

export type PublicCatalogResponse = {
  success: true;
  business: PublicCatalogBusiness;
  catalog: {
    slug: string;
    outOfStockMode: OutOfStockMode;
    delivery: VirtualCatalogDelivery;
  };
  products: PublicCatalogProduct[];
};
