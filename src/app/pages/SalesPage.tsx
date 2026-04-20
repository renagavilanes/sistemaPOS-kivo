import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Plus, Store, Receipt, ChevronRight, Building2, Check, ChevronDown, DollarSign, CircleDollarSign } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ProductCatalog } from '../components/ProductCatalog';
import { ShoppingCart } from '../components/ShoppingCart';
import { PaymentSheet } from '../components/PaymentSheet';
import { ExpenseForm } from '../components/ExpenseForm';
import { SuccessDialog } from '../components/SuccessDialog';
import { MobileCartSheet } from '../components/MobileCartSheet';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';
import { Product, CartItem, Expense, UserRole } from '../types';
import { mockClients, expenseCategories } from '../data/mockData';
import { toast } from 'sonner';
import { formatCurrency } from '../utils/currency';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ShoppingCart as CartIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { BusinessSelectorModal } from '../components/BusinessSelectorModal';
import { PageHeader } from '../components/layout/PageHeader';
import { PrimaryTabs } from '../components/layout/PrimaryTabs';
import {
  createSale,
  createFreeSale,
  createExpense,
  getProducts,
  CreateSaleData,
  CreateExpenseData,
  defaultSaleConceptFromCart,
} from '../lib/api';
import { useBusiness } from '../contexts/BusinessContext';
// REMOVIDO: import { useData } from '../contexts/DataContext';
import * as apiService from '../services/api';
import { printReceipt } from '../utils/receiptGenerator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { useScreenFx } from '../contexts/ScreenFxContext';

export default function SalesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentBusiness, businesses, switchBusiness, createBusiness, loading: businessLoading } = useBusiness();
  const { user } = useAuth();

  // ── Permisos del usuario actual ────────────────────────────────────────────
  const isCurrentUserOwner = currentBusiness?.role === 'owner' || currentBusiness?.permissions?.all === true;
  const canEditPrice = isCurrentUserOwner || currentBusiness?.permissions?.sales?.edit === true;
  const canCreateExpense = isCurrentUserOwner || currentBusiness?.permissions?.sales?.createExpense === true;
  // ──────────────────────────────────────────────────────────────────────────

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successDialogType, setSuccessDialogType] = useState<'sale' | 'expense'>('sale');
  const [successDialogAmount, setSuccessDialogAmount] = useState(0);
  const [successDialogDefaultName, setSuccessDialogDefaultName] = useState('');
  const { triggerInkDouble } = useScreenFx();
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const [lastCreatedMovement, setLastCreatedMovement] = useState<any>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptPdfUrl, setReceiptPdfUrl] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [userRole] = useState<UserRole>('advanced');
  const [activeTab, setActiveTab] = useState('sale');
  /** Flujo venta libre: monto capturado antes de abrir PaymentSheet */
  const [freeSaleAmountInput, setFreeSaleAmountInput] = useState('');
  const [freeSaleSubtotal, setFreeSaleSubtotal] = useState(0);
  const [isFreeSaleCheckout, setIsFreeSaleCheckout] = useState(false);
  const [isEditingMovement, setIsEditingMovement] = useState(false);
  const [mobileCartSheetOpen, setMobileCartSheetOpen] = useState(false);
  const hasLoadedRef = useRef(false);

  // Business selector modal state
  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  
  // Create business dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  
  // ✅ Estado para categorías personalizadas
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // ✅ Categorías: combina las de BD con las derivadas de productos cargados.
  // Garantiza que empleados (bloqueados por RLS en tabla categories) vean
  // las categorías que ya existen en sus productos.
  const categoriesFromProducts = [...new Set(
    products.map(p => p.category).filter(c => c && c !== 'Sin categoría')
  )];
  const allCategories = [...new Set([...customCategories, ...categoriesFromProducts])].sort();
  const categories = ['Todas', ...allCategories];

  // ✅ CARGAR categorías desde Supabase al iniciar
  useEffect(() => {
    if (!currentBusiness) return;
    
    const loadCategories = async () => {
      try {
        const categories = await apiService.getCategories(currentBusiness.id);
        const categoryNames = categories.map(c => c.name);
        console.log('📂 [SALES] Categorías cargadas desde Supabase:', categoryNames);
        setCustomCategories(categoryNames);
      } catch (error) {
        console.error('❌ [SALES] Error al cargar categorías:', error);
        setCustomCategories([]);
      }
    };
    
    loadCategories();
  }, [currentBusiness?.id]);


  // ✅ Escuchar cambios en categorías
  useEffect(() => {
    if (!currentBusiness) return;

    const handleCategoriesUpdated = async () => {
      try {
        const categories = await apiService.getCategories(currentBusiness.id);
        const categoryNames = categories.map(c => c.name);
        console.log('🔄 [SALES] Categorías actualizadas:', categoryNames);
        setCustomCategories(categoryNames);
      } catch (error) {
        console.error('❌ [SALES] Error al actualizar categorías:', error);
      }
    };

    window.addEventListener('businessChanged', handleCategoriesUpdated);

    return () => {
      window.removeEventListener('businessChanged', handleCategoriesUpdated);
    };
  }, [currentBusiness?.id]);

  // Load products when business changes
  useEffect(() => {
    if (!currentBusiness?.id) return;

    const loadProducts = async () => {
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
        console.log('✅ Productos cargados en SalesPage:', mappedProducts.length, 'productos');
        setProducts(mappedProducts);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();

    const handleProductsUpdated = () => {
      console.log('🔄 Productos actualizados (evento personalizado), recargando...');
      loadProducts();
    };

    window.addEventListener('productsUpdated', handleProductsUpdated);

    return () => {
      window.removeEventListener('productsUpdated', handleProductsUpdated);
    };
  }, [currentBusiness?.id]);

  // Load products from editing movement on mount
  useEffect(() => {
    const editingMovementData = localStorage.getItem('editingMovement');
    
    let isEditingProducts = (location.state as any)?.isEditingProducts;
    
    if (!isEditingProducts && editingMovementData) {
      try {
        const movementData = JSON.parse(editingMovementData);
        isEditingProducts = movementData.isEditingProducts;
      } catch (error) {
        console.error('Error parsing editingMovement:', error);
      }
    }
    
    if (!isEditingProducts) {
      if (editingMovementData) {
        localStorage.removeItem('editingMovement');
      }
      hasLoadedRef.current = false;
      return;
    }
    
    if (products.length === 0) {
      return;
    }
    
    if (hasLoadedRef.current) {
      return;
    }
    
    hasLoadedRef.current = true;
    
    if (editingMovementData) {
      try {
        const movementData = JSON.parse(editingMovementData);
        
        if (movementData.products && movementData.products.length > 0) {
          const loadedCartItems: CartItem[] = movementData.products.map((product: any) => {
            const fullProduct = products.find(p => p.id === product.id);
            
            if (fullProduct) {
              return {
                product: fullProduct,
                quantity: product.quantity,
                priceAtSale: product.price || fullProduct.price
              };
            }
            
            return {
              product: {
                id: product.id,
                name: product.name,
                price: product.price || 0,
                category: product.category || 'Otros',
                image: product.image,
                stock: 100,
                cost: product.cost || (product.price ? product.price * 0.6 : 0)
              },
              quantity: product.quantity,
              priceAtSale: product.price || 0
            };
          });
          
          setCartItems(loadedCartItems);
          setIsEditingMovement(true);
          toast.success(`${loadedCartItems.length} producto(s) cargado(s) para edición`);
        }
      } catch (error) {
        console.error('Error loading editing movement:', error);
        toast.error('Error al cargar los productos');
        localStorage.removeItem('editingMovement');
      }
    }
  }, [products, location.state]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'expense') {
      setExpenseSheetOpen(true);
    }
  };

  const handleExpenseSheetChange = (open: boolean) => {
    setExpenseSheetOpen(open);
    if (!open) {
      setActiveTab('sale');
    }
  };

  const handleAddToCart = (product: Product) => {
    const existingItem = cartItems.find(item => item.product.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        const updatedItem = { ...existingItem, quantity: existingItem.quantity + 1 };
        const otherItems = cartItems.filter(item => item.product.id !== product.id);
        setCartItems([updatedItem, ...otherItems]);
      } else {
        toast.error('Stock insuficiente');
      }
    } else {
      setCartItems([{
        product,
        quantity: 1,
        priceAtSale: product.price,
      }, ...cartItems]);
    }
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity === 0) {
      setCartItems(cartItems.filter(item => item.product.id !== productId));
    } else {
      setCartItems(cartItems.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const handleUpdatePrice = (productId: string, price: number) => {
    setCartItems(cartItems.map(item =>
      item.product.id === productId
        ? { ...item, priceAtSale: price }
        : item
    ));
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems(cartItems.filter(item => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const total = cartItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);

  const handleProceedToPayment = () => {
    if (isEditingMovement) {
      if (cartItems.length === 0) {
        toast.error('El carrito está vacío. Agrega al menos un producto.');
        return;
      }

      const editingMovementData = localStorage.getItem('editingMovement');
      if (editingMovementData) {
        try {
          const movementData = JSON.parse(editingMovementData);
          
          const updatedProducts = cartItems.map(item => ({
            id: item.product.id,
            name: item.product.name,
            price: item.priceAtSale || item.product.price,
            quantity: item.quantity,
            category: item.product.category,
            image: item.product.image,
            cost: item.product.cost
          }));
          
          const newTotal = updatedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
          const totalCost = updatedProducts.reduce((sum, p) => sum + ((p.cost || 0) * p.quantity), 0);
          const newProfit = newTotal - totalCost;
          
          movementData.products = updatedProducts;
          movementData.total = newTotal;
          movementData.profit = newProfit;
          movementData.productsEdited = true;
          
          localStorage.setItem('editingMovement', JSON.stringify(movementData));
          
          toast.success('Productos actualizados correctamente');
          navigate('/movements');
        } catch (error) {
          console.error('Error saving edited products:', error);
          toast.error('Error al guardar los productos');
        }
      } else {
        toast.error('No se encontraron datos de edición');
        setIsEditingMovement(false);
      }
    } else {
      if (cartItems.length === 0) {
        toast.error('El carrito está vacío. Agrega al menos un producto.');
        return;
      }
      setPaymentSheetOpen(true);
    }
  };

  const parseMoneyInput = (raw: string): number => {
    const t = raw.trim();
    if (!t) return NaN;
    let normalized: string;
    if (t.includes(',') && t.includes('.')) {
      normalized = t.replace(/\./g, '').replace(',', '.');
    } else if (t.includes(',')) {
      normalized = t.replace(',', '.');
    } else {
      normalized = t;
    }
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : NaN;
  };

  const handleProceedFreeSale = () => {
    const parsed = parseMoneyInput(freeSaleAmountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('Ingresa un monto válido mayor a 0');
      return;
    }
    setFreeSaleSubtotal(parsed);
    setIsFreeSaleCheckout(true);
    setPaymentSheetOpen(true);
  };

  const handlePaymentSheetOpenChange = (open: boolean) => {
    setPaymentSheetOpen(open);
    if (!open) {
      setIsFreeSaleCheckout(false);
    }
  };

  // Confirm sale
  const handleConfirmSale = async (saleData: { paymentType: 'pagada' | 'credito'; payments: any[]; client: any; saleDate: string; receiptNote: string; discount: any }) => {
    try {
      if (isFreeSaleCheckout) {
        const result = await createFreeSale({
          subtotal: freeSaleSubtotal,
          paymentType: saleData.paymentType,
          payments: saleData.payments,
          client: saleData.client,
          saleDate: saleData.saleDate,
          receiptNote: saleData.receiptNote,
          discount: saleData.discount,
        });

        if (result.sale && result.sale.id) {
          setLastCreatedId(result.sale.id);
          const dateStr = saleData.saleDate || new Date().toLocaleDateString('en-CA');
          const nowLocal = new Date();
          const timeStr = nowLocal.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          const discountAmt = saleData.discount?.amount || 0;
          const finalTotal = Number(result.sale.total) || freeSaleSubtotal - discountAmt;

          setLastCreatedMovement({
            id: result.sale.id,
            type: 'sale',
            date: dateStr,
            time: timeStr,
            total: finalTotal,
            subtotal: result.sale.subtotal,
            products: [
              {
                id: 'venta-libre',
                name: 'Venta libre',
                quantity: 1,
                price: freeSaleSubtotal,
              },
            ],
            payments: saleData.payments,
            client: saleData.client?.name || '-',
            clientPhone: saleData.client?.phone || null,
            clientEmail: saleData.client?.email || undefined,
            clientCedula: saleData.client?.cedula || undefined,
            paymentType: saleData.paymentType,
            status: result.sale.paymentStatus === 'paid' ? 'paid' : 'pending',
            employee: null,
            notes: saleData.receiptNote || null,
            discount: saleData.discount,
          });
        }

        // El modal SuccessDialog ya confirma el éxito (y reproduce sonido).
        // Evitamos toast para que no estorbe visualmente.

        const successDialogConcept =
          (result.sale?.notes && String(result.sale.notes).trim()) || 'Venta libre';

        localStorage.removeItem('editingMovement');
        setIsEditingMovement(false);
        setFreeSaleAmountInput('');
        setFreeSaleSubtotal(0);
        setIsFreeSaleCheckout(false);
        setPaymentSheetOpen(false);
        // Motion UI fuerte: Ink Double al crear venta (antes de abrir modal)
        triggerInkDouble();
        setSuccessDialogOpen(true);
        setSuccessDialogType('sale');
        setSuccessDialogAmount(Number(result.sale?.total) || 0);
        setSuccessDialogDefaultName(successDialogConcept);
        return;
      }

      const createSaleData: CreateSaleData = {
        cartItems,
        total,
        paymentType: saleData.paymentType,
        payments: saleData.payments,
        client: saleData.client,
        saleDate: saleData.saleDate,
        receiptNote: saleData.receiptNote,
        discount: saleData.discount,
      };
      
      const result = await createSale(createSaleData);
      
      if (result.sale && result.sale.id) {
        setLastCreatedId(result.sale.id);
        
        // ✅ FIX DEFINITIVO FECHAS:
        // Usar la fecha seleccionada directamente (ya tiene la fecha correcta del usuario)
        // y la hora actual local (no parsear desde createdAt para evitar conversión UTC)
        const dateStr = saleData.saleDate || new Date().toLocaleDateString('en-CA');
        const nowLocal = new Date();
        const timeStr = nowLocal.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        setLastCreatedMovement({
          id: result.sale.id,
          type: 'sale',
          date: dateStr,
          time: timeStr,
          total: result.sale.total,
          subtotal: result.sale.subtotal,
          products: cartItems.map(item => ({
            id: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            price: item.priceAtSale || item.product.price,
          })),
          payments: saleData.payments,
          client: saleData.client?.name || '-',
          clientPhone: saleData.client?.phone || null,
          clientEmail: saleData.client?.email || undefined,
          clientCedula: saleData.client?.cedula || undefined,
          paymentType: saleData.paymentType,
          status: result.sale.paymentStatus === 'paid' ? 'paid' : 'pending',
          employee: null,
          notes: saleData.receiptNote || null,
          discount: saleData.discount,
        });
      }
      
      // El modal SuccessDialog ya confirma el éxito (y reproduce sonido).
      // Evitamos toast para que no estorbe visualmente.

      // Debe coincidir con lo guardado en `sales.notes` (createSale). Si aquí solo poníamos el
      // primer producto, al pulsar "Ir a movimientos" onNameChange hacía PATCH y borraba el "+(N) más".
      const successDialogConcept =
        (result.sale?.notes && String(result.sale.notes).trim()) ||
        defaultSaleConceptFromCart(cartItems) ||
        (cartItems[cartItems.length - 1]?.product.name ?? '');

      localStorage.removeItem('editingMovement');
      setIsEditingMovement(false);

      setCartItems([]);
      setPaymentSheetOpen(false);
      // Motion UI fuerte: Ink Double al crear venta (antes de abrir modal)
      triggerInkDouble();
      setSuccessDialogOpen(true);
      setSuccessDialogType('sale');
      setSuccessDialogAmount(total);
      setSuccessDialogDefaultName(successDialogConcept);
    } catch (error) {
      console.error('Error creating sale:', error);
      toast.error('Error al registrar la venta');
      throw error;
    }
  };

  // Save expense
  const handleSaveExpense = async (expense: any) => {
    try {
      const statusMap: { [key: string]: string } = {
        'pagada': 'paid',
        'deuda': 'pending'
      };

      console.log('🟡 SalesPage - Recibiendo gasto de ExpenseForm:', {
        expenseReceived: expense,
        nameField: expense.name,
        categoryField: expense.category
      });

      const expenseData: CreateExpenseData = {
        date: expense.date,
        category: expense.category,
        supplier: expense.supplier,
        paymentMethod: expense.paymentMethod,
        amount: expense.amount,
        notes: expense.name,
        status: statusMap[expense.status] || 'paid',
      };
      
      console.log('🟢 SalesPage - Mapeando a expenseData:', {
        notes: expenseData.notes,
        category: expenseData.category,
        fullExpenseData: expenseData
      });
      
      const result = await createExpense(expenseData);
      
      if (result.expense && result.expense.id) {
        setLastCreatedId(result.expense.id);
        
        // ✅ FIX DEFINITIVO FECHAS:
        // Usar la fecha seleccionada directamente y la hora actual local
        const dateStr = expense.date || new Date().toLocaleDateString('en-CA');
        const nowLocal = new Date();
        const timeStr = nowLocal.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        const pmNorm = String(result.expense.paymentMethod || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{M}/gu, '');
        const paymentMethodCode =
          expenseData.status === 'pending'
            ? 'none'
            : pmNorm === 'efectivo' || pmNorm === 'cash'
              ? 'cash'
              : pmNorm === 'tarjeta' || pmNorm === 'card'
                ? 'card'
                : pmNorm === 'transferencia' || pmNorm === 'transfer'
                  ? 'transfer'
                  : pmNorm === '-' || pmNorm === ''
                    ? 'none'
                    : 'other';

        setLastCreatedMovement({
          id: result.expense.id,
          type: 'expense',
          date: dateStr,
          time: timeStr,
          total: result.expense.amount,
          expenseCategory: result.expense.category,
          supplier: result.expense.description || '-',
          supplierCedula: expense?.supplierContact?.cedula || undefined,
          paymentMethod: paymentMethodCode,
          status: expenseData.status === 'pending' ? 'debt' : 'paid',
          notes: result.expense.notes || null,
        });
      }
      
      console.log('💾 Gasto guardado:', { 
        category: expense.category, 
        name: expense.name, 
        amount: expense.amount,
        savedAs: expenseData 
      });
      triggerInkDouble();
      setSuccessDialogOpen(true);
      setSuccessDialogType('expense');
      setSuccessDialogAmount(expense.amount);
      setSuccessDialogDefaultName(expense.name || expense.category || '');
    } catch (error) {
      console.error('Error creating expense:', error);
      toast.error('Error al registrar el gasto');
    }
  };

  const handleViewReceipt = async () => {
    if (!lastCreatedMovement || !currentBusiness) {
      toast.error('No hay datos del movimiento para generar el recibo');
      return;
    }
    
    try {
      console.log('📄 Generando recibo desde SuccessDialog...', lastCreatedMovement);
      
      let parsedSettings: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(`business_settings_${currentBusiness.id}`);
        if (raw) parsedSettings = JSON.parse(raw);
      } catch {
        /* ignore */
      }
      const businessSettings = {
        businessName: currentBusiness.name || 'Mi Negocio',
        address: currentBusiness.address || '',
        phone: currentBusiness.phone || '',
        email: currentBusiness.email || '',
        logo: (currentBusiness as any).logo || (currentBusiness as any).logo_url || undefined,
        receiptMessage: parsedSettings.receiptMessage,
        taxName: parsedSettings.taxName,
        taxRate: parsedSettings.taxRate,
      };
      
      const enrichedMovement = { ...lastCreatedMovement };
      
      if (lastCreatedMovement.payments && lastCreatedMovement.payments.length > 0) {
        enrichedMovement.paymentMethods = lastCreatedMovement.payments.map((p: any) => ({
          method: p.method || p.type || 'Efectivo',
          amount: Number(p.amount) || 0
        }));
      } else if (lastCreatedMovement.paymentMethod) {
        enrichedMovement.paymentMethods = [{
          method: lastCreatedMovement.paymentMethod === 'cash' ? 'Efectivo' : 
                  lastCreatedMovement.paymentMethod === 'card' ? 'Tarjeta' : 
                  lastCreatedMovement.paymentMethod === 'none' ? '—' :
                  lastCreatedMovement.paymentMethod,
          amount: lastCreatedMovement.total
        }];
      }
      
      console.log('🔍 Datos para PDF:', { enrichedMovement, businessSettings });
      const pdfUrl = await printReceipt(enrichedMovement, businessSettings);
      
      setReceiptPdfUrl(pdfUrl);
      setReceiptNumber(lastCreatedMovement.id?.slice(-8).toUpperCase() || 'N/A');
      setReceiptModalOpen(true);
      
      toast.success('Vista previa generada exitosamente');
    } catch (error) {
      console.error('❌ Error al generar recibo:', error);
      toast.error('Error al generar el recibo');
    }
  };

  useEffect(() => {
    console.log('🔍 [SALES] Estado:', { businessLoading, currentBusiness: currentBusiness?.name });
  }, [businessLoading, currentBusiness]);
  
  if (businessLoading || !currentBusiness) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto">
            <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-900">Cargando negocio...</p>
            <p className="text-sm text-gray-600">Preparando tu espacio de trabajo</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <PageHeader
        desktop={
          <header className="bg-white border-b px-4 sm:px-6 py-4">
            {/* Editing Mode Banner */}
            {isEditingMovement && (
              <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                  <p className="text-sm font-medium text-blue-900">Editando productos de una venta</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCartItems([]);
                      localStorage.removeItem('editingMovement');
                      setIsEditingMovement(false);
                      toast.info('Edición cancelada');
                    }}
                    className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 flex-1 sm:flex-none h-10"
                  >
                    Limpiar carrito
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      localStorage.removeItem('editingMovement');
                      setIsEditingMovement(false);
                      navigate('/movements');
                    }}
                    className="text-blue-700 hover:text-blue-900 hover:bg-blue-100 flex-1 sm:flex-none h-10"
                  >
                    Volver a movimientos
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              {/* Mode Toggle - Centered on desktop */}
              {!isEditingMovement && (
                <div className="flex flex-1 justify-center">
                  <PrimaryTabs
                    value={activeTab}
                    onValueChange={handleTabChange}
                    listClassName="max-w-[560px]"
                    tabs={[
                      { value: 'sale', label: 'Venta', icon: <CartIcon className="w-4 h-4" /> },
                      { value: 'freeSale', label: 'Venta libre', icon: <CircleDollarSign className="w-4 h-4" /> },
                      { value: 'expense', label: 'Gasto', icon: <DollarSign className="w-4 h-4" />, hidden: !canCreateExpense },
                    ]}
                  />
                </div>
              )}

            </div>
          </header>
        }
        mobile={
          <header className="bg-[#272B36] border-b border-slate-700 px-4 sm:px-6 py-3 shadow-sm">
            {/* Editing Mode Banner */}
            {isEditingMovement && (
              <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                  <p className="text-sm font-medium text-blue-900">Editando productos de una venta</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCartItems([]);
                      localStorage.removeItem('editingMovement');
                      setIsEditingMovement(false);
                      toast.info('Edición cancelada');
                    }}
                    className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 flex-1 sm:flex-none h-10"
                  >
                    Limpiar carrito
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      localStorage.removeItem('editingMovement');
                      setIsEditingMovement(false);
                      navigate('/movements');
                    }}
                    className="text-blue-700 hover:text-blue-900 hover:bg-blue-100 flex-1 sm:flex-none h-10"
                  >
                    Volver a movimientos
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              {/* Business Selector - Solo móvil */}
              <div className="md:hidden flex-1 min-w-0 mr-3">
                <button
                  onClick={() => setBusinessModalOpen(true)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity w-full text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/20">
                    {((currentBusiness as any)?.logo || (currentBusiness as any)?.logo_url) ? (
                      <img
                        src={(currentBusiness as any)?.logo || (currentBusiness as any)?.logo_url}
                        alt="Logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                        <Building2 className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <span className="text-sm font-semibold text-white truncate">
                      {currentBusiness?.name || 'Mi Negocio'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                  </div>
                </button>
              </div>
            </div>

            {/* Mode Toggle - Mobile version */}
            {!isEditingMovement && (
              <div className="md:hidden mt-3">
                <PrimaryTabs
                  value={activeTab}
                  onValueChange={handleTabChange}
                  tabs={[
                    { value: 'sale', label: 'Venta', icon: <CartIcon className="w-4 h-4" /> },
                    { value: 'freeSale', label: 'Venta libre', icon: <CircleDollarSign className="w-4 h-4" /> },
                    { value: 'expense', label: 'Gasto', icon: <DollarSign className="w-4 h-4" />, hidden: !canCreateExpense },
                  ]}
                />
              </div>
            )}
          </header>
        }
      />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'freeSale' ? (
          <div className="h-full overflow-auto flex flex-col items-center justify-start p-6 sm:p-10 bg-gray-50/80">
            <div className="w-full max-w-md space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-gray-900">Venta libre</h2>
                <p className="text-sm text-gray-600">
                  Registra un monto sin elegir productos del catálogo. Luego podrás definir pago, cliente y nota como en una venta normal.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="free-sale-amount">Monto *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    id="free-sale-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={freeSaleAmountInput}
                    onChange={(e) => setFreeSaleAmountInput(e.target.value)}
                    className="pl-8 h-12 text-lg"
                  />
                </div>
              </div>
              <Button
                type="button"
                className="w-full h-12"
                onClick={handleProceedFreeSale}
              >
                Continuar al pago
              </Button>
            </div>
          </div>
        ) : (
        <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_450px] overflow-hidden">
          {/* Left: Product Catalog */}
          <div className="h-full lg:border-r overflow-hidden">
            <ProductCatalog
              products={products}
              loading={productsLoading}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onAddToCart={handleAddToCart}
              categories={categories}
              cartItems={cartItems}
              onUpdateQuantity={handleUpdateQuantity}
              canEditPrice={canEditPrice}
            />
          </div>

          {/* Right: Cart - Only visible on desktop (lg and above) */}
          <div className="h-full overflow-hidden hidden lg:block">
            <ShoppingCart
              items={cartItems}
              onUpdateQuantity={handleUpdateQuantity}
              onUpdatePrice={handleUpdatePrice}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              onProceedToPayment={handleProceedToPayment}
              userRole={userRole}
              canEditPrice={canEditPrice}
              isEditingMovement={isEditingMovement}
            />
          </div>
        </div>
        )}
        
        {/* Floating Cart Button - Mobile and Tablet */}
        {activeTab === 'sale' && cartItems.length > 0 && (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-50 p-4 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
            <div className="pointer-events-none bg-gray-50 rounded-t-xl border border-gray-200 border-b-0 p-4">
              <p className="text-sm text-gray-600 font-medium flex items-center justify-between">
                <span>Total:</span>
                <span className="font-bold text-gray-900 text-lg">${formatCurrency(total)}</span>
              </p>
            </div>
            <Button
              size="lg"
              className="w-full h-14 rounded-b-xl shadow-lg bg-gray-900 hover:bg-gray-800 text-white pointer-events-auto flex items-center justify-between px-6"
              onClick={() => setMobileCartSheetOpen(true)}
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full w-10 h-10 flex items-center justify-center">
                  <span className="font-bold text-base">{cartItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
                </div>
                <span className="font-semibold text-base">Ver carrito</span>
              </div>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}
      </main>

      {/* Payment Sheet */}
      <PaymentSheet
        open={paymentSheetOpen}
        onOpenChange={handlePaymentSheetOpenChange}
        cartItems={isFreeSaleCheckout ? [] : cartItems}
        total={isFreeSaleCheckout ? freeSaleSubtotal : total}
        onConfirm={handleConfirmSale}
        userRole={userRole}
      />

      {/* Expense Sheet */}
      <ExpenseForm
        open={expenseSheetOpen}
        onOpenChange={handleExpenseSheetChange}
        categories={expenseCategories}
        onSave={handleSaveExpense}
      />

      {/* Success Dialog */}
      <SuccessDialog
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        type={successDialogType}
        amount={successDialogAmount}
        defaultName={successDialogDefaultName}
        onNameChange={async (name: string) => {
          if (!lastCreatedId || !currentBusiness) return;
          try {
            if (successDialogType === 'sale') {
              await apiService.updateSale(lastCreatedId, currentBusiness.id, {
                notes: name,
              });
            } else if (successDialogType === 'expense') {
              await apiService.updateExpense(lastCreatedId, currentBusiness.id, {
                notes: name,
              });
            }
            console.log(`✅ Nombre / concepto guardado en BD: "${name}"`);
          } catch (error) {
            console.error('Error al guardar nombre personalizado:', error);
            toast.error('No se pudo guardar el nombre. Revisa la conexión e inténtalo de nuevo.');
            throw error;
          }
        }}
        onNewTransaction={() => {
          setSuccessDialogOpen(false);
          if (successDialogType === 'expense') {
            setExpenseSheetOpen(true);
          }
        }}
        onGoToMovements={() => {
          setSuccessDialogOpen(false);
          navigate('/movements');
        }}
        onViewReceipt={handleViewReceipt}
      />

      {/* Mobile Cart Sheet */}
      <MobileCartSheet
        open={mobileCartSheetOpen}
        onOpenChange={setMobileCartSheetOpen}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdatePrice={handleUpdatePrice}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onProceedToPayment={handleProceedToPayment}
        userRole={userRole}
        canEditPrice={canEditPrice}
        isEditingMovement={isEditingMovement}
      />

      {/* Receipt Preview Modal */}
      <ReceiptPreviewModal
        open={receiptModalOpen}
        onOpenChange={(open) => {
          setReceiptModalOpen(open);
          if (!open && receiptPdfUrl) {
            URL.revokeObjectURL(receiptPdfUrl);
            setReceiptPdfUrl(null);
          }
        }}
        pdfUrl={receiptPdfUrl}
        receiptNumber={receiptNumber}
      />

      {/* Business Selector Modal - Mobile */}
      <BusinessSelectorModal
        open={businessModalOpen}
        onOpenChange={setBusinessModalOpen}
        businesses={businesses}
        currentBusiness={currentBusiness}
        onSwitchBusiness={switchBusiness}
        onAddBusiness={() => {
          setBusinessModalOpen(false);
          setIsCreateDialogOpen(true);
        }}
      />
      
      {/* Create Business Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Crear nuevo negocio</DialogTitle>
            <DialogDescription>
              Ingresa el nombre del nuevo negocio que deseas crear.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del negocio</Label>
              <Input
                id="name"
                placeholder="Mi Negocio"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!newBusinessName) {
                  toast.error('El nombre del negocio es requerido');
                  return;
                }
                setIsCreating(true);
                try {
                  const result = await createBusiness({
                    name: newBusinessName,
                    user_id: user?.id || ''
                  });
                  if (result.business && result.business.id) {
                    toast.success('Negocio creado exitosamente');
                    switchBusiness(result.business.id);
                    setIsCreateDialogOpen(false);
                  }
                } catch (error) {
                  console.error('Error creating business:', error);
                  toast.error('Error al crear el negocio');
                } finally {
                  setIsCreating(false);
                }
              }}
              disabled={isCreating}
            >
              {isCreating ? 'Creando...' : 'Crear negocio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}