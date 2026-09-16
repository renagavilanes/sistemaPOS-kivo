import { suggestDestProduct, type MatchableProduct, type MatchKind } from './productMatch';

export type TransferProduct = MatchableProduct & {
  businessId?: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  image?: string;
  description?: string;
  isActive?: boolean;
};

export type TransferLine = {
  from: TransferProduct;
  quantity: number;
  destMode: 'match' | 'create';
  destProduct: TransferProduct | null;
  matchKind: MatchKind;
  userPicked: boolean;
};

export type TransferItem = {
  fromProductId: string;
  quantity: number;
  toProductId: string | null;
};

export function makeTransferLine(from: TransferProduct, destCatalog: TransferProduct[]): TransferLine {
  const suggestion = suggestDestProduct(from, destCatalog);
  return {
    from,
    quantity: 1,
    destMode: suggestion.product ? 'match' : 'create',
      destProduct: suggestion.product as TransferProduct,
    matchKind: suggestion.kind,
    userPicked: false,
  };
}

export function addProductToLines(
  lines: TransferLine[],
  product: TransferProduct,
  destCatalog: TransferProduct[],
): { lines: TransferLine[]; error?: string } {
  const stock = Math.max(0, Math.trunc(Number(product.stock) || 0));
  if (stock < 1) {
    return { lines, error: `No hay unidades de ${product.name}` };
  }
  const existing = lines.find((line) => line.from.id === product.id);
  if (existing) {
    return {
      lines: lines.map((line) =>
        line.from.id === product.id
          ? { ...line, quantity: Math.min(stock, line.quantity + 1) }
          : line,
      ),
    };
  }
  return { lines: [...lines, makeTransferLine(product, destCatalog)] };
}

export function bumpTransferQuantity(
  lines: TransferLine[],
  productId: string,
  delta: number,
): { lines: TransferLine[]; error?: string } {
  const line = lines.find((item) => item.from.id === productId);
  if (!line) return { lines };
  const max = Math.max(0, Math.trunc(Number(line.from.stock) || 0));
  const next = line.quantity + delta;
  if (next < 1) return { lines: lines.filter((item) => item.from.id !== productId) };
  if (next > max) {
    return { lines, error: `Solo hay ${max} de ${line.from.name}` };
  }
  return {
    lines: lines.map((item) => (item.from.id === productId ? { ...item, quantity: next } : item)),
  };
}

export function applyDestChoiceToLine(line: TransferLine, dest: TransferProduct | null): TransferLine {
  if (!dest) {
    return {
      ...line,
      destMode: 'create',
      destProduct: null,
      matchKind: 'none',
      userPicked: true,
    };
  }
  return {
    ...line,
    destMode: 'match',
    destProduct: dest,
    matchKind: 'name',
    userPicked: true,
  };
}

export function rematchLine(line: TransferLine, destCatalog: TransferProduct[]): TransferLine {
  if (line.userPicked) return line;
  const suggestion = suggestDestProduct(line.from, destCatalog);
  if (suggestion.product) {
    return {
      ...line,
      destMode: 'match',
      destProduct: suggestion.product as TransferProduct | null,
      matchKind: suggestion.kind,
    };
  }
  return {
    ...line,
    destMode: 'create',
    destProduct: null,
    matchKind: 'none',
  };
}

export function linesToTransferItems(lines: TransferLine[]): TransferItem[] {
  return lines.map((line) => ({
    fromProductId: line.from.id,
    quantity: line.quantity,
    toProductId: line.destMode === 'match' && line.destProduct ? line.destProduct.id : null,
  }));
}

export function validateTransferRequest(params: {
  fromBusinessId: string;
  toBusinessId: string;
  items: TransferItem[];
}) {
  if (!params.fromBusinessId || !params.toBusinessId) {
    throw new Error('Faltan los negocios de origen o destino');
  }
  if (params.fromBusinessId === params.toBusinessId) {
    throw new Error('Elige un negocio distinto como destino');
  }
  if (!params.items.length) {
    throw new Error('Agrega al menos un producto');
  }
}

export type TransferAdapters = {
  getProduct: (businessId: string, productId: string) => Promise<TransferProduct>;
  updateStock: (productId: string, businessId: string, stock: number) => Promise<void>;
  createProduct: (
    businessId: string,
    product: Omit<TransferProduct, 'id' | 'businessId'>,
  ) => Promise<TransferProduct>;
  deleteProduct: (productId: string, businessId: string) => Promise<void>;
};

export async function runInventoryTransfer(
  params: {
    fromBusinessId: string;
    toBusinessId: string;
    items: TransferItem[];
  },
  adapters: TransferAdapters,
): Promise<{ createdIds: string[] }> {
  validateTransferRequest(params);

  const rollback: Array<() => Promise<void>> = [];
  const createdIds: string[] = [];

  try {
    for (const item of params.items) {
      const qty = Math.trunc(Number(item.quantity) || 0);
      if (qty < 1) throw new Error('Hay una cantidad inválida');

      const origin = await adapters.getProduct(params.fromBusinessId, item.fromProductId);
      const prevOrigin = Number(origin.stock) || 0;
      if (prevOrigin < qty) {
        throw new Error(`No hay suficiente stock de ${origin.name}`);
      }

      await adapters.updateStock(origin.id, params.fromBusinessId, prevOrigin - qty);
      rollback.push(async () => {
        await adapters.updateStock(origin.id, params.fromBusinessId, prevOrigin);
      });

      if (item.toProductId) {
        const dest = await adapters.getProduct(params.toBusinessId, item.toProductId);
        const prevDest = Number(dest.stock) || 0;
        await adapters.updateStock(dest.id, params.toBusinessId, prevDest + qty);
        rollback.push(async () => {
          await adapters.updateStock(dest.id, params.toBusinessId, prevDest);
        });
      } else {
        const created = await adapters.createProduct(params.toBusinessId, {
          name: origin.name,
          price: origin.price,
          cost: origin.cost || 0,
          stock: qty,
          category: origin.category || 'Sin categoría',
          image: origin.image || '',
          barcode: origin.barcode,
          description: origin.description,
          isActive: origin.isActive,
        });
        createdIds.push(created.id);
        rollback.push(async () => {
          await adapters.deleteProduct(created.id, params.toBusinessId);
        });
      }
    }
    return { createdIds };
  } catch (error) {
    for (const undo of rollback.reverse()) {
      try {
        await undo();
      } catch (rollbackError) {
        console.error('❌ No se pudo revertir un paso del traslado:', rollbackError);
      }
    }
    throw error;
  }
}
