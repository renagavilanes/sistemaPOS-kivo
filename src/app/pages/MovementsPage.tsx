import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Search, Filter, Calendar, MoreVertical, Download, FileText, TrendingUp, DollarSign, CreditCard, ChevronLeft, ChevronRight, X, Users, ChevronRight as ChevronRightIcon, User, Building2, Printer, Receipt, Edit, Trash2, ShoppingCart, Plus, Minus, Check, Banknote, MoreHorizontal, ChevronDown, ChevronUp, Percent, ArrowLeft, Loader2 } from 'lucide-react';
import { ExpenseForm } from '../components/ExpenseForm';
import { ReportsSheet } from '../components/ReportsSheet';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';
import { MobileBusinessHeader } from '../components/MobileBusinessHeader';
import { LazyProductImage } from '../components/LazyProductImage';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { BusinessSelectorModal } from '../components/BusinessSelectorModal';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '../components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { DateCalendar } from '../components/DateCalendar';
import { MonthYearPicker } from '../components/MonthYearPicker';
import { YearPicker } from '../components/YearPicker';
import { format, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { exportMovementsToExcel } from '../utils/excelExport';
import { useBusiness } from '../contexts/BusinessContext';
// REMOVIDO: import { useData } from '../contexts/DataContext';
import * as apiService from '../services/api';
import { printReceipt, shareReceipt } from '../utils/receiptGenerator';
import { getClients, buildLocalDateTimeFromDateAndTime } from '../lib/api';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/layout/SectionCard';
import { dataTableThead, dthMovement } from '../lib/dataTableHeaderClasses';

/** Línea de venta libre (JSON en `sales.items`): sin producto de catálogo → costo 0, ganancia = total. */
function isFreeSaleLineItem(item: any): boolean {
  if (item?.freeSale === true) return true;
  const pid = item?.productId ?? item?.product_id;
  if (pid != null && pid !== '') return false;
  return String(item?.name || '').trim() === 'Venta libre';
}

/** Pagado = verde, Deuda = rojo (misma lógica en tabla y Excel) */
function movementPaymentStatusLabel(status: string): string {
  return status === 'paid' ? 'Pagado' : 'Deuda';
}

function movementPaymentStatusBadgeClass(status: string): string {
  return status === 'paid'
    ? 'border-0 bg-emerald-600 text-white hover:bg-emerald-600 shadow-none'
    : 'border-0 bg-rose-600 text-white hover:bg-rose-600 shadow-none';
}

// Helper function to check if a date is within a range
const isDateInRange = (dateStr: string, filter: string, selectedDay: Date, weekStart: Date, weekEnd: Date, selectedMonth: number, selectedYear: number): boolean => {
  if (!dateStr) return false;
  // Añadir T00:00:00 para forzar interpretación como hora local (no UTC midnight)
  const normalized = typeof dateStr === 'string' && dateStr.length === 10 ? dateStr + 'T00:00:00' : String(dateStr);
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return false;
  date.setHours(0, 0, 0, 0);

  switch (filter) {
    case 'daily': {
      const targetDate = new Date(selectedDay);
      targetDate.setHours(0, 0, 0, 0);
      return date.getTime() === targetDate.getTime();
    }
    case 'weekly': {
      const wStart = new Date(weekStart); wStart.setHours(0, 0, 0, 0);
      const wEnd = new Date(weekEnd); wEnd.setHours(23, 59, 59, 999);
      return isWithinInterval(date, { start: wStart, end: wEnd });
    }
    case 'monthly': {
      const monthStart = startOfMonth(new Date(selectedYear, selectedMonth, 1));
      const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth, 1));
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    }
    case 'yearly': {
      const yearStart = startOfYear(new Date(selectedYear, 0, 1));
      const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
      return isWithinInterval(date, { start: yearStart, end: yearEnd });
    }
    case 'custom': {
      const cStart = new Date(weekStart); cStart.setHours(0, 0, 0, 0);
      const cEnd = new Date(weekEnd); cEnd.setHours(23, 59, 59, 999);
      return isWithinInterval(date, { start: cStart, end: cEnd });
    }
    default:
      return true;
  }
};

// Mock data for movements
const mockMovements = [
  {
    id: '001',
    date: '2026-02-25',
    time: '14:32',
    type: 'sale',
    productConcept: 'Laptop Dell XPS 15',
    quantity: 1,
    total: 45000,
    cost: 35000,
    profit: 10000,
    employee: 'Juan Pérez',
    client: 'Empresa Tech SA',
    paymentMethod: 'card',
    status: 'paid',
    products: [
      {
        id: 'p1',
        name: 'Laptop Dell XPS 15',
        quantity: 1,
        price: 45000,
        cost: 35000,
        image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=100&h=100&fit=crop'
      }
    ]
  },
  {
    id: '002',
    date: '2026-02-25',
    time: '10:15',
    type: 'expense',
    productConcept: 'Renta de local mensual',
    expenseCategory: 'Gastos operativos',
    expenseName: 'Renta de local mensual',
    quantity: 1,
    total: 15000,
    cost: 15000,
    profit: -15000,
    employee: 'Admin',
    client: '-',
    paymentMethod: 'transfer',
    status: 'paid',
    products: [
      {
        id: 'p1',
        name: 'Renta de local mensual',
        quantity: 1,
        price: 15000,
        cost: 15000,
        image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=100&h=100&fit=crop'
      }
    ]
  },
  {
    id: '002b',
    date: '2026-02-25',
    time: '11:45',
    type: 'sale',
    productConcept: 'Equipo de oficina completo',
    quantity: 4,
    total: 28500,
    cost: 21000,
    profit: 7500,
    employee: 'Carlos Ramírez',
    client: 'Distribuidora Norte',
    paymentMethod: 'multiple',
    numPayments: 3,
    status: 'paid',
    payments: [
      { id: '1', amount: 10000, method: 'cash' },
      { id: '2', amount: 8500, method: 'card' },
      { id: '3', amount: 10000, method: 'transfer' }
    ],
    products: [
      {
        id: 'p1',
        name: 'Silla Ergonómica',
        quantity: 2,
        price: 4500,
        cost: 3000,
        image: 'https://images.unsplash.com/photo-1505843513577-22bb7d21e455?w=100&h=100&fit=crop'
      },
      {
        id: 'p2',
        name: 'Escritorio Ejecutivo',
        quantity: 1,
        price: 12000,
        cost: 9000,
        image: 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=100&h=100&fit=crop'
      },
      {
        id: 'p3',
        name: 'Lámpara LED de Escritorio',
        quantity: 1,
        price: 7500,
        cost: 6000,
        image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=100&h=100&fit=crop'
      }
    ]
  },
  {
    id: '003',
    date: '2026-02-24',
    time: '16:48',
    type: 'sale',
    productConcept: 'Venta múltiple (Mouse, Teclado, Audífonos)',
    quantity: 5,
    total: 750.50,
    cost: 450,
    profit: 300.50,
    employee: 'María González',
    client: 'Comercial López',
    paymentMethod: 'cash',
    status: 'paid',
    products: [
      {
        id: 'p1',
        name: 'Mouse Logitech MX Master 3',
        quantity: 2,
        price: 250.50,
        cost: 150,
        image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=100&h=100&fit=crop'
      },
      {
        id: 'p2',
        name: 'Teclado Mecánico RGB',
        quantity: 1,
        price: 300,
        cost: 180,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=100&h=100&fit=crop'
      },
      {
        id: 'p3',
        name: 'Audífonos Bluetooth',
        quantity: 2,
        price: 200,
        cost: 120,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&h=100&fit=crop'
      }
    ]
  },
  {
    id: '004',
    date: '2026-02-24',
    time: '12:20',
    type: 'sale',
    productConcept: 'Teclado Mecánico RGB (x2)',
    quantity: 2,
    total: 3000,
    cost: 2000,
    profit: 1000,
    employee: 'Juan Pérez',
    client: 'Distribuidora Norte',
    paymentMethod: 'card',
    status: 'debt',
    products: [
      {
        id: 'p1',
        name: 'Teclado Mecánico RGB',
        quantity: 2,
        price: 1500,
        cost: 1000,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=100&h=100&fit=crop'
      }
    ]
  },
  {
    id: '005',
    date: '2026-02-23',
    time: '09:00',
    type: 'expense',
    productConcept: 'Servicios públicos (luz, agua, internet)',
    expenseCategory: 'Gastos operativos',
    expenseName: 'Servicios públicos (luz, agua, internet)',
    quantity: 1,
    total: 2500,
    cost: 2500,
    profit: -2500,
    employee: 'Admin',
    client: '-',
    paymentMethod: 'transfer',
    status: 'paid',
    products: [
      {
        id: 'p1',
        name: 'Servicios públicos',
        quantity: 1,
        price: 2500,
        cost: 2500,
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100&h=100&fit=crop'
      }
    ]
  },
  {
    id: '006',
    date: '2026-02-23',
    time: '15:35',
    type: 'sale',
    productConcept: 'Monitor LG UltraWide 34"',
    quantity: 1,
    total: 12500.75,
    cost: 9000,
    profit: 3500.75,
    employee: 'Carlos Ramírez',
    client: 'Grupo Innovación',
    paymentMethod: 'transfer',
    status: 'paid',
    products: [
      {
        id: 'p1',
        name: 'Monitor LG UltraWide 34"',
        quantity: 1,
        price: 12500.75,
        cost: 9000,
        image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=100&h=100&fit=crop'
      }
    ]
  },
  {
    id: '007',
    date: '2026-02-22',
    time: '11:10',
    type: 'sale',
    productConcept: 'Venta de accesorios varios',
    quantity: 8,
    total: 2250,
    cost: 1500,
    profit: 750,
    employee: 'María González',
    client: 'Servicios Globales',
    paymentMethod: 'cash',
    status: 'debt',
    products: [
      {
        id: 'p1',
        name: 'Webcam Logitech C920',
        quantity: 3,
        price: 450,
        cost: 300,
        image: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=100&h=100&fit=crop'
      },
      {
        id: 'p2',
        name: 'Cable HDMI 2m',
        quantity: 5,
        price: 100,
        cost: 60,
        image: 'https://images.unsplash.com/photo-1625948515291-69613efd103f?w=100&h=100&fit=crop'
      }
    ]
  },
  {
    id: '008',
    date: '2026-02-22',
    time: '08:45',
    type: 'expense',
    productConcept: 'Compra de inventario',
    expenseCategory: 'Compras',
    expenseName: 'Compra de inventario',
    quantity: 1,
    total: 25000,
    cost: 25000,
    profit: -25000,
    employee: 'Admin',
    client: '-',
    paymentMethod: 'transfer',
    status: 'paid',
    products: [
      {
        id: 'p1',
        name: 'Compra de inventario variado',
        quantity: 1,
        price: 25000,
        cost: 25000,
        image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=100&h=100&fit=crop'
      }
    ]
  },
];

export default function MovementsPage() {
  const { currentBusiness, businesses, switchBusiness, createBusiness } = useBusiness();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Permisos del usuario en movimientos ─────────────────────────────────
  const isOwner = currentBusiness?.role === 'owner' || (currentBusiness?.permissions as any)?.all === true;
  const movPerms = isOwner ? { view: true, edit: true, delete: true, export: true, reports: true } : ((currentBusiness?.permissions as any)?.movements || {});
  const canEditMovement    = isOwner || (movPerms as any).edit    === true;
  const canDeleteMovement  = isOwner || (movPerms as any).delete  === true;
  const canExportMovement  = isOwner || (movPerms as any).export  === true;
  const canReportsMovement = isOwner || (movPerms as any).reports === true;
  // ─────────────────────────────────────────────────────────────────────────

  // Local state for data
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Movements state
  const [movements, setMovements] = useState<any[]>([]);
  
  // Load all data when business changes - OPTIMIZED: Load everything in parallel
  useEffect(() => {
    if (!currentBusiness?.id) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        // Load ALL data in parallel for maximum speed
        const [productsData, customersData, employeesData, salesData, expensesData] = await Promise.all([
          apiService.getProducts(currentBusiness.id),
          apiService.getCustomers(currentBusiness.id),
          apiService.getEmployees(currentBusiness.id),
          apiService.getSales(currentBusiness.id),
          apiService.getExpenses(currentBusiness.id),
        ]);
        
        setProducts(productsData);
        setCustomers(customersData);
        setEmployees(employeesData);
        
        // Process movements immediately with loaded data
        processMovements(salesData, expensesData, productsData, customersData, employeesData);
        
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [currentBusiness?.id]);
  
  // Helper function to process movements (extracted for reusability)
  const processMovements = (
    salesData: any[], 
    expensesData: any[], 
    productsData: any[], 
    customersData: any[], 
    employeesData: any[]
  ) => {
    try {
          
      // Helper function to get current product image by ID
      const getCurrentProductImage = (productId: string | null, fallbackImage: string): string => {
        if (productId) {
          const currentProduct = productsData.find(prod => prod.id === productId);
          if (currentProduct && currentProduct.image) {
            return currentProduct.image;
          }
        }
        return (fallbackImage && !fallbackImage.includes('unsplash.com')) ? fallbackImage : '';
      };
      
      // Helper function to get client name by ID
      const getClientName = (customerId: string | null): string => {
        if (!customerId) return '-';
        const client = customersData.find(c => c.id === customerId);
        return client ? client.name : '-';
      };
      
      // Helper function to get employee name by UUID
      const getEmployeeName = (createdBy: string | null): string => {
        if (!createdBy) return 'Usuario';
        
        let employee = employeesData.find(emp => emp.userId === createdBy);
        
        if (!employee && createdBy === currentBusiness?.id) {
          employee = employeesData.find(emp => emp.is_owner === true);
        }
        
        return employee ? employee.name : 'Usuario';
      };
          
      // Transform sales to movements format
      const salesMovements = salesData.map((movement: any) => {
        const items = movement.items || [];
        const totalQuantity = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
        const totalCost = items.reduce((sum: number, item: any) => {
          if (isFreeSaleLineItem(item)) return sum;
          return sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0) * 0.6);
        }, 0);
        const totalAmount = Number(movement.total) || 0;
        
        let productConcept = movement.notes || 'Venta general';
        if (!movement.notes) {
          // Mismo orden que el carrito al crear: índice 0 = último añadido; el primero elegido es el último del array.
          const primary = items.length ? items[items.length - 1] : null;
          if (items.length === 1) {
            productConcept = primary?.name || 'Producto';
          } else if (items.length > 1) {
            productConcept = `${primary?.name || 'Producto'} +(${items.length - 1}) más`;
          }
        }
        
        const saleDateTime = new Date(movement.createdAt || movement.created_at);
        const dateStr = format(saleDateTime, 'yyyy-MM-dd');
        const timeStr = format(saleDateTime, 'HH:mm');
        
        return {
          id: movement.id,
          date: dateStr,
          time: timeStr,
          type: 'sale',
          productConcept: productConcept,
          quantity: totalQuantity,
          total: totalAmount,
          cost: totalCost,
          profit: totalAmount - totalCost,
          employee: getEmployeeName(movement.createdBy),
          employeeId: null,
          client: getClientName(movement.customerId),
          paymentMethod: (() => {
            const ps = String(movement.paymentStatus ?? '').toLowerCase();
            const pays = movement.payments || [];
            if (ps === 'pending' && (!Array.isArray(pays) || pays.length === 0)) {
              return 'none';
            }
            if (pays.length > 1) return 'multiple';
            const raw = String(movement.paymentMethod ?? '').toLowerCase();
            if (raw === 'efectivo') return 'cash';
            if (raw === 'tarjeta') return 'card';
            if (raw === 'transferencia') return 'transfer';
            return 'other';
          })(),
          status: String(movement.paymentStatus ?? '').toLowerCase() === 'paid' ? 'paid' : 'debt',
          /** Copia explícita del estado en BD (pending/partial/paid) para el formulario de edición */
          salePaymentStatus: String(movement.paymentStatus ?? '').toLowerCase() || undefined,
          payments: (movement.payments || []).map((p: any) => ({
            ...p,
            method: p.method?.toLowerCase() === 'efectivo' ? 'cash' :
                    p.method?.toLowerCase() === 'tarjeta' ? 'card' :
                    p.method?.toLowerCase() === 'transferencia' ? 'transfer' :
                    p.method?.toLowerCase() === 'otros' ? 'other' :
                    p.method || 'cash'
          })),
          numPayments: (movement.payments || []).length || 1,
          products: items.map((item: any) => ({
            id: item.productId || String(Math.random()),
            product_id: item.productId || null,
            name: item.name || 'Producto',
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
            cost: isFreeSaleLineItem(item) ? 0 : Number(item.price) * 0.6 || 0,
            image: getCurrentProductImage(item.productId, '')
          })),
          notes: movement.notes,
          discount: movement.discount
        };
      });
      
      // Transform expenses to movements format
      const expensesMovements = expensesData.map((movement: any) => {
        const amount = Number(movement.amount) || 0;
        const expenseDateTime = new Date(movement.createdAt || movement.created_at);
        const dateStr = format(expenseDateTime, 'yyyy-MM-dd');
        const timeStr = format(expenseDateTime, 'HH:mm');
        
        return {
          id: movement.id,
          date: dateStr,
          time: timeStr,
          type: 'expense',
          productConcept: movement.notes || movement.description || movement.category,
          expenseCategory: movement.category || 'Otros',
          expenseName: movement.notes || movement.description || movement.category,
          quantity: 1,
          total: amount,
          cost: amount,
          profit: -amount,
          employee: getEmployeeName(movement.createdBy),
          employeeId: null,
          client: '-',
          supplier: movement.description || '',
          paymentMethod: (() => {
            const st = String(movement.paymentStatus ?? movement.payment_status ?? 'paid').toLowerCase();
            if (st === 'pending') return 'none';
            const m = String(movement.paymentMethod || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/\p{M}/gu, '');
            if (m === '-' || m === '') return 'none';
            if (m === 'efectivo' || m === 'cash') return 'cash';
            if (m === 'tarjeta' || m === 'card') return 'card';
            if (m === 'transferencia' || m === 'transfer') return 'transfer';
            if (m === 'credito' || m === 'credit') return 'none';
            return 'other';
          })(),
          status:
            String(movement.paymentStatus ?? movement.payment_status ?? 'paid').toLowerCase() === 'paid'
              ? 'paid'
              : 'debt',
          products: [{
            id: '1',
            name: movement.notes || movement.description || movement.category || 'Gasto',
            quantity: 1,
            price: amount,
            cost: amount,
            image: ''
          }],
          notes: movement.notes
        };
      });
      
      // Combine all movements
      const formattedMovements = [...salesMovements, ...expensesMovements];
      
      setMovements(formattedMovements);
    } catch (error) {
      console.error('Error procesando movimientos:', error);
      toast.error('Error al procesar movimientos');
      setMovements([]);
    }
  };
  
  const [typeFilter, setTypeFilter] = useState('sale');
  const [dateFilter, setDateFilter] = useState('weekly');
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  
  // Date selection states
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weekEnd, setWeekEnd] = useState(endOfWeek(new Date(), { weekStartsOn: 1 }));

  // Filter Sheet states
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  
  // Selector modal states
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(false);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [showSupplierSelector, setShowSupplierSelector] = useState(false);
  
  // Search states
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');

  // Detail Sheet states
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);

  // Receipt Preview Modal states
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptPdfUrl, setReceiptPdfUrl] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState('');
  const lastAppliedDebtPrefilterNonceRef = useRef<number | null>(null);

  // Edit Sheet states
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Helper function to display client name (handles both names and old UUIDs)
  const displayClientName = (clientValue: string): string => {
    if (!clientValue || clientValue === '-') return '-';
    
    // Check if it looks like a UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientValue);
    
    if (isUUID) {
      // Try to find the client name from the clients list
      const client = mockClients.find(c => c.id === clientValue);
      return client ? client.name : 'Cliente desconocido';
    }
    
    // It's already a name, return it
    return clientValue;
  };

  useEffect(() => {
    const navState = (location.state || {}) as {
      prefilterDebtClientName?: string;
      prefilterDebtContactId?: string;
      prefilterDebtSupplierId?: string;
      prefilterDebtSupplierName?: string;
      prefilterNonce?: number;
    };

    if (!navState.prefilterNonce) return;
    if (lastAppliedDebtPrefilterNonceRef.current === navState.prefilterNonce) return;

    // Contactos → proveedor: gastos en deuda filtrados por ese proveedor
    if (navState.prefilterDebtSupplierId || navState.prefilterDebtSupplierName) {
      lastAppliedDebtPrefilterNonceRef.current = navState.prefilterNonce;

      const matchedSupplier = navState.prefilterDebtSupplierId
        ? customers.find((c) => c.id === navState.prefilterDebtSupplierId)
        : customers.find(
            (c) =>
              (c.name || '').trim().toLowerCase() ===
              (navState.prefilterDebtSupplierName || '').trim().toLowerCase(),
          );

      setTypeFilter('expense');
      setDateFilter('all');
      // Solo filtro por proveedor (chip); el buscador de texto no cruza bien con proveedor y deja la tabla vacía.
      setSearchTerm('');
      setSelectedPaymentStatuses(['debt']);
      setSelectedPaymentMethods([]);
      setSelectedEmployees([]);
      setSelectedClients([]);
      if (matchedSupplier) {
        setSelectedSuppliers([matchedSupplier.id]);
      } else if (navState.prefilterDebtSupplierId) {
        setSelectedSuppliers([navState.prefilterDebtSupplierId]);
      } else {
        setSelectedSuppliers([]);
      }

      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    if (!navState.prefilterDebtClientName && !navState.prefilterDebtContactId) return;

    lastAppliedDebtPrefilterNonceRef.current = navState.prefilterNonce;

    // Prefiltro desde Contactos → deudas del cliente (ventas a crédito).
    const matchedClient = navState.prefilterDebtContactId
      ? customers.find((c) => c.id === navState.prefilterDebtContactId)
      : customers.find(
          (c) =>
            (c.name || '').trim().toLowerCase() ===
            (navState.prefilterDebtClientName || '').trim().toLowerCase(),
        );

    setTypeFilter('sale');
    setDateFilter('all');
    setSearchTerm(matchedClient ? '' : navState.prefilterDebtClientName || '');
    setSelectedPaymentStatuses(['debt']);
    setSelectedPaymentMethods([]);
    setSelectedEmployees([]);
    setSelectedClients(matchedClient ? [matchedClient.id] : []);
    setSelectedSuppliers([]);

    navigate(location.pathname, { replace: true, state: null });
  }, [customers, location.pathname, location.state, navigate]);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editNumPayments, setEditNumPayments] = useState(1);
  const [editPayments, setEditPayments] = useState<Array<{ id: string; amount: string; method: string }>>([{ id: '1', amount: '', method: 'Efectivo' }]);
  const [editDiscountActive, setEditDiscountActive] = useState(false);
  const [editDiscountPercent, setEditDiscountPercent] = useState('0');
  const [editDiscountAmount, setEditDiscountAmount] = useState('0');
  const [editSelectedClient, setEditSelectedClient] = useState<any>(null);
  const [editClientDialogOpen, setEditClientDialogOpen] = useState(false);
  const [editSelectedEmployee, setEditSelectedEmployee] = useState<any>(null);
  const [editEmployeeDialogOpen, setEditEmployeeDialogOpen] = useState(false);
  const [editSinglePaymentMethod, setEditSinglePaymentMethod] = useState('Efectivo');
  const [editPaymentDetailsOpen, setEditPaymentDetailsOpen] = useState(false);
  const [editReceiptNote, setEditReceiptNote] = useState('');
  const [editSaleStatus, setEditSaleStatus] = useState<'paid' | 'credit'>('paid');

  /**
   * Tab Pagado / A crédito al editar una venta.
   * Prioriza `salePaymentStatus` (viene de la API). Si no existe, usa `status` del movimiento (misma lógica que el badge).
   * Trata como venta todo lo que no sea gasto explícito (por si falta `type` en datos viejos).
   */
  const movementToEditSaleTab = useCallback((m: any): 'paid' | 'credit' => {
    if (!m || m.type === 'expense') return 'paid';
    const ps = String(m.salePaymentStatus ?? '').toLowerCase();
    if (ps === 'paid') return 'paid';
    if (ps === 'pending' || ps === 'partial') return 'credit';
    if (ps) return 'credit';
    return m.status === 'paid' ? 'paid' : 'credit';
  }, []);

  // Delete Confirmation Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [movementToDelete, setMovementToDelete] = useState<any>(null);
  
  // Date Period Sheet state
  const [datePeriodSheetOpen, setDatePeriodSheetOpen] = useState(false);
  
  // Custom Range Sheet state
  const [customRangeSheetOpen, setCustomRangeSheetOpen] = useState(false);
  const [tempCustomStart, setTempCustomStart] = useState(new Date('2026-02-24'));
  const [tempCustomEnd, setTempCustomEnd] = useState(new Date('2026-02-25'));
  
  // Reports Sheet state
  const [reportsSheetOpen, setReportsSheetOpen] = useState(false);
  
  // Business selector modal state
  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  
  // Ref for mobile filter scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Business settings for receipts
  const [businessSettings, setBusinessSettings] = useState({
    businessName: '',
    phone: '',
    address: '',
    email: '',
    logo: '',
    businessType: '',
    receiptMessage: '¡Gracias por su compra!',
    taxRate: '15',
    taxName: 'IVA',
  });

  // Load business settings
  useEffect(() => {
    if (currentBusiness?.id) {
      const savedSettings = localStorage.getItem(`business_settings_${currentBusiness.id}`);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setBusinessSettings({
          ...parsed,
          logo:
            parsed.logo ||
            (currentBusiness as any)?.logo_url ||
            (currentBusiness as any)?.logo ||
            '',
        });
      } else {
        // Use business info as fallback
        setBusinessSettings(prev => ({
          ...prev,
          businessName: currentBusiness.name || '',
          phone: currentBusiness.phone || '',
          address: currentBusiness.address || '',
          email: currentBusiness.email || '',
          logo: (currentBusiness as any).logo || (currentBusiness as any).logo_url || '',
        }));
      }
    }
  }, [currentBusiness]);

  // Clients list from cached context
  const mockClients = customers.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone || null,
    email: c.email || null,
  }));

  // Suppliers list from cached customers
  const suppliersList = [
    { id: 'all', name: 'Todos los proveedores', initials: 'ALL' },
    ...customers.map(s => ({
      id: s.id,
      name: s.name,
      initials: s.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    }))
  ];

  // Detect when returning from editing products
  useEffect(() => {
    const checkForEditedProducts = () => {
      const editingMovementData = localStorage.getItem('editingMovement');
      if (editingMovementData) {
        try {
          const movementData = JSON.parse(editingMovementData);
          
          // Check if products were edited
          if (movementData.productsEdited) {
            // Find the movement being edited
            const movement = movements.find(m => m.id === movementData.id);
            
            if (movement) {
              // Calculate new total based on updated products
              const newTotal = movementData.products.reduce((sum: number, product: any) => {
                return sum + (product.price * product.quantity);
              }, 0);
              
              // Calculate new profit based on updated products
              const totalCost = movementData.products.reduce((sum: number, product: any) => {
                return sum + ((product.cost || 0) * product.quantity);
              }, 0);
              const newProfit = newTotal - totalCost;
              
              // Create updated movement using data from localStorage (not from movements array)
              const updatedMovement = { 
                ...movementData, // Use localStorage data first
                products: movementData.products,
                total: newTotal,
                profit: newProfit,
                // Preserve edited fields from localStorage
                date: movementData.editDate || movementData.date,
                time: movementData.editTime || movementData.time,
                client: movementData.editSelectedClient?.name || movementData.client,
                employee: movementData.editSelectedEmployee?.name || movementData.employee,
                productConcept: movementData.editNote || movementData.productConcept
              };
              
              setSelectedMovement(updatedMovement);
              
              // Restore all saved states from localStorage (always prefer localStorage values)
              setEditDate(movementData.editDate || movementData.date);
              setEditTime(movementData.editTime || movementData.time);
              
              // Restore client
              if (movementData.editSelectedClient) {
                setEditSelectedClient(movementData.editSelectedClient);
              } else {
                setEditSelectedClient(null);
              }
              
              // Restore employee
              if (movementData.editSelectedEmployee) {
                setEditSelectedEmployee(movementData.editSelectedEmployee);
              } else {
                setEditSelectedEmployee(null);
              }
              
              setEditNote(movementData.editNote || updatedMovement.productConcept);
              setEditNumPayments(movementData.editNumPayments || 1);
              setEditSinglePaymentMethod(movementData.editSinglePaymentMethod || 'Efectivo');
              setEditPayments(movementData.editPayments || [{ id: '1', amount: formatCurrency(newTotal), method: 'Efectivo' }]);
              setEditDiscountActive(movementData.editDiscountActive || false);
              setEditDiscountPercent(movementData.editDiscountPercent || '0');
              setEditDiscountAmount(movementData.editDiscountAmount || '0');
              setEditReceiptNote(movementData.editReceiptNote || '');
              {
                const tab = movementData.editSaleStatus;
                setEditSaleStatus(
                  tab === 'paid' || tab === 'credit'
                    ? tab
                    : movementToEditSaleTab(movementData),
                );
              }
              
              // Open edit sheet
              setDetailSheetOpen(false);
              setEditSheetOpen(true);
              
              // Remove the flag but keep the data for further edits
              movementData.productsEdited = false;
              localStorage.setItem('editingMovement', JSON.stringify(movementData));
            }
          }
        } catch (error) {
          console.error('Error loading edited products:', error);
        }
      }
    };

    // Check on mount
    checkForEditedProducts();

    // Also check when window gains focus (user returns from another page)
    const handleFocus = () => {
      checkForEditedProducts();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [movements]);

  // Auto-scroll to selected filter option on mobile
  useEffect(() => {
    if (scrollContainerRef.current) {
      // Use setTimeout to ensure DOM is fully rendered before scrolling
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const selectedButton = scrollContainerRef.current.querySelector('[data-selected="true"]');
          if (selectedButton) {
            selectedButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      }, 100);
    }
  }, [dateFilter, selectedDay, selectedMonth, selectedYear, weekStart]);

  /** Suma precio×cantidad de líneas (base antes de descuento), alineado con saveEdit. */
  const grossSubtotalFromMovement = (m: any) =>
    m?.products?.reduce(
      (sum: number, p: any) => sum + (Number(p.price) || 0) * (Number(p.quantity) || 0),
      0,
    ) ?? 0;

  const applySaleDiscountToEditState = useCallback((m: any) => {
    if (!m || m.type !== 'sale') {
      setEditDiscountActive(false);
      setEditDiscountPercent('0');
      setEditDiscountAmount('0');
      return;
    }
    const disc = Number(m.discount) || 0;
    const gross =
      m.products?.reduce(
        (sum: number, p: any) => sum + (Number(p.price) || 0) * (Number(p.quantity) || 0),
        0,
      ) ?? 0;
    if (disc > 0) {
      setEditDiscountActive(true);
      setEditDiscountAmount(disc.toFixed(2));
      setEditDiscountPercent(gross > 0 ? ((disc / gross) * 100).toFixed(2) : '0');
    } else {
      setEditDiscountActive(false);
      setEditDiscountPercent('0');
      setEditDiscountAmount('0');
    }
  }, []);

  // Load data when edit sheet opens
  useEffect(() => {
    if (editSheetOpen && selectedMovement) {
      console.log('Edit sheet opened, loading data for movement:', selectedMovement.id);
      
      // Calculate total if not present
      const calculatedTotal = selectedMovement.total || 
        (selectedMovement.products?.reduce((sum: number, product: any) => {
          return sum + (product.price * product.quantity);
        }, 0) ?? 0);
      
      console.log('Calculated total:', calculatedTotal);
      
      setEditDate(selectedMovement.date);
      setEditTime(selectedMovement.time);
      
      // Set client (handle both name and UUID)
      const clientName = displayClientName(selectedMovement.client);
      const client = mockClients.find(c => c.name === clientName);
      console.log('Loading client:', selectedMovement.client, 'Display name:', clientName, 'Found:', client);
      setEditSelectedClient(client || null);
      
      // Set employee
      const employee = employees.find(e => e.name === selectedMovement.employee);
      console.log('Loading employee:', selectedMovement.employee, 'Found:', employee);
      setEditSelectedEmployee(employee || null);
      
      setEditNote(selectedMovement.productConcept);
      
      // Load payment method from movement
      // Map payment method codes to labels
      const paymentMethodMap: Record<string, string> = {
        'cash': 'Efectivo',
        'card': 'Tarjeta',
        'transfer': 'Transferencia',
        'other': 'Otro'
      };
      
      // Check if it's a multiple payment
      if (selectedMovement.paymentMethod === 'multiple' && selectedMovement.payments) {
        console.log('Loading multiple payments:', selectedMovement.payments);
        setEditNumPayments(selectedMovement.numPayments || selectedMovement.payments.length);
        setEditSinglePaymentMethod('Efectivo');
        
        // Convert payments from codes to labels and format amounts
        const formattedPayments = selectedMovement.payments.map((payment: any) => ({
          id: payment.id,
          amount: formatCurrency(payment.amount),
          method: paymentMethodMap[payment.method] || 'Efectivo'
        }));
        
        setEditPayments(formattedPayments);
      } else {
        // Single payment
        const paymentMethodLabel = paymentMethodMap[selectedMovement.paymentMethod] || 'Efectivo';
        console.log('Loading payment method:', selectedMovement.paymentMethod, 'Mapped to:', paymentMethodLabel);
        
        setEditNumPayments(1);
        setEditSinglePaymentMethod(paymentMethodLabel);
        setEditPayments([{ id: '1', amount: formatCurrency(calculatedTotal), method: paymentMethodLabel }]);
      }

      applySaleDiscountToEditState(selectedMovement);

      setEditReceiptNote('');

      // Debe coincidir con el estado real de la venta (evita que quede "Pagado" si el efecto pisa otros campos al abrir)
      if (selectedMovement.type === 'sale') {
        setEditSaleStatus(movementToEditSaleTab(selectedMovement));
      }
      
      console.log('Data loaded successfully');
    }
  }, [editSheetOpen, selectedMovement, movementToEditSaleTab, applySaleDiscountToEditState]);

  /** `none` = sin medio aplicable (venta a crédito / gasto en deuda); no sale en filtros. */
  const paymentMethods = [
    { id: 'none', label: '—' },
    { id: 'cash', label: 'Efectivo' },
    { id: 'card', label: 'Tarjeta' },
    { id: 'transfer', label: 'Transferencia' },
    { id: 'other', label: 'Otro' },
  ];

  const paymentMethodsForFilter = paymentMethods.filter((m) => m.id !== 'none');

  const paymentMethodLabelForMovement = (methodId: string) =>
    methodId === 'none' ? '—' : paymentMethods.find((m) => m.id === methodId)?.label ?? '—';

  // Build employee list from actual employees
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  const employeesList = employees.map(emp => ({
    id: emp.id,
    name: emp.name,
    initials: getInitials(emp.name)
  }));

  const clientsList = [
    { id: 'all', name: 'Todos los clientes', initials: 'ALL' },
    ...mockClients.map(c => ({
      id: c.id,
      name: c.name,
      initials: c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    }))
  ];

  const togglePaymentMethod = (methodId: string) => {
    setSelectedPaymentMethods(prev => 
      prev.includes(methodId) 
        ? prev.filter(id => id !== methodId)
        : [...prev, methodId]
    );
  };

  const togglePaymentStatus = (status: string) => {
    setSelectedPaymentStatuses(prev =>
      prev.includes(status)
        ? prev.filter(id => id !== status)
        : [...prev, status]
    );
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const toggleClient = (clientId: string) => {
    if (clientId === 'all') {
      setSelectedClients([]);
      return;
    }

    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev.filter(id => id !== 'all'), clientId]
    );
  };

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const applyFilters = () => {
    setFilterSheetOpen(false);
  };

  const clearFilters = () => {
    setSelectedPaymentMethods([]);
    setSelectedPaymentStatuses([]);
    setSelectedEmployees([]);
    setSelectedClients([]);
    setSelectedSuppliers([]);
  };

  const clearAllAppliedFilters = () => {
    setSelectedPaymentMethods([]);
    setSelectedPaymentStatuses([]);
    setSelectedEmployees([]);
    setSelectedClients([]);
    setSelectedSuppliers([]);
  };

  const removeAppliedFilter = (filterType: string, value?: string) => {
    if (filterType === 'paymentMethod' && value) {
      setSelectedPaymentMethods(prev => prev.filter(id => id !== value));
    } else if (filterType === 'paymentStatus' && value) {
      setSelectedPaymentStatuses(prev => prev.filter(id => id !== value));
    } else if (filterType === 'employee') {
      setSelectedEmployees([]);
    } else if (filterType === 'client') {
      setSelectedClients([]);
    } else if (filterType === 'supplier') {
      setSelectedSuppliers([]);
    }
  };

  // Get active filters count
  const activeFiltersCount = 
    selectedPaymentMethods.length + 
    selectedPaymentStatuses.length +
    selectedEmployees.length + 
    selectedClients.length + 
    selectedSuppliers.length;

  // Sync temp filters when opening sheet
  const openFilterSheet = () => {
    setFilterSheetOpen(true);
  };

  // Format date display based on filter type
  const getDateDisplayText = () => {
    switch (dateFilter) {
      case 'daily':
        return selectedDay.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      case 'weekly':
        return `${format(weekStart, 'dd MMM', { locale: es })} | ${format(weekEnd, 'dd MMM', { locale: es })}`;
      case 'monthly':
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${monthNames[selectedMonth]} ${selectedYear}`;
      case 'yearly':
        return `${selectedYear}`;
      case 'custom':
        return `${format(weekStart, 'dd MMM', { locale: es })} | ${format(weekEnd, 'dd MMM', { locale: es })}`;
      default:
        return 'Seleccionar fecha';
    }
  };

  // Filter movements
  // CRITICAL: Filter FIRST on the original movements array (date, type, etc. are reliable here),
  // THEN expand multi-payment sales into separate rows.
  // This prevents expanded rows from bypassing the date/type filters.
  const passesMovementFilters = (movement: (typeof movements)[0], applyTypeFilter: boolean) => {
    const matchesType =
      !applyTypeFilter || typeFilter === 'all' || movement.type === typeFilter;
    const matchesSearch =
      !searchTerm ||
      (movement.productConcept || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (movement.client || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (movement.id || '').includes(searchTerm);
    const matchesDate =
      dateFilter === 'all' ||
      isDateInRange(movement.date, dateFilter, selectedDay, weekStart, weekEnd, selectedMonth, selectedYear);

    const matchesPaymentMethod =
      selectedPaymentMethods.length === 0 || selectedPaymentMethods.includes(movement.paymentMethod);

    const matchesPaymentStatus =
      selectedPaymentStatuses.length === 0 || selectedPaymentStatuses.includes(movement.status);

    const matchesEmployee =
      selectedEmployees.length === 0 ||
      selectedEmployees.some((empId) => {
        if (movement.employeeId) {
          return movement.employeeId === empId;
        }
        const emp = employees.find((e) => e.id === empId);
        return emp && movement.employee === emp.name;
      });

    const matchesClient =
      selectedClients.length === 0 ||
      selectedClients.some((clientId) => {
        const client = mockClients.find((c) => c.id === clientId);
        return client && displayClientName(movement.client) === client.name;
      });

    const matchesSupplier =
      selectedSuppliers.length === 0 ||
      selectedSuppliers.some((supplierId) => {
        const supplier = suppliersList.find((s) => s.id === supplierId);
        return supplier && movement.supplier === supplier.name;
      });

    return (
      matchesType &&
      matchesSearch &&
      matchesDate &&
      matchesPaymentMethod &&
      matchesPaymentStatus &&
      matchesEmployee &&
      matchesClient &&
      matchesSupplier
    );
  };

  const expandPartialPayments = (movement: (typeof movements)[0]) => {
    if (movement.paymentMethod === 'multiple' && movement.payments && movement.payments.length > 0) {
      return movement.payments.map((payment: any, index: number) => ({
        ...movement,
        id: `${movement.id}-payment-${payment.id || index}`,
        originalId: movement.id,
        paymentMethod: payment.method,
        total: payment.amount,
        isPartialPayment: true,
        paymentIndex: index + 1,
        totalPayments: movement.payments.length,
        productConcept: movement.productConcept,
        profit: 0,
      }));
    }
    return [movement];
  };

  const filteredMovements = movements
    .filter((m) => passesMovementFilters(m, true))
    .flatMap((movement) => expandPartialPayments(movement));

  /** Excel: incluir ventas y gastos aunque el usuario filtre solo uno en la tabla */
  const filteredMovementsForExport = movements
    .filter((m) => passesMovementFilters(m, false))
    .flatMap((movement) => expandPartialPayments(movement));

  // Calculate totals - Apply ALL filters including search, payment methods, employees, clients, and suppliers
  const allMovementsForStats = movements.filter((movement) => {
    const matchesSearch = movement.productConcept.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.id.includes(searchTerm);
    const matchesDate = dateFilter === 'all' || isDateInRange(movement.date, dateFilter, selectedDay, weekStart, weekEnd, selectedMonth, selectedYear);
    
    // Apply payment method filter
    const matchesPaymentMethod = selectedPaymentMethods.length === 0 || 
                                  selectedPaymentMethods.includes(movement.paymentMethod);
    
    // Apply payment status filter
    const matchesPaymentStatus = selectedPaymentStatuses.length === 0 ||
                                  selectedPaymentStatuses.includes(movement.status);
    
    // Apply employee filter - Match by employeeId (reliable) or name (fallback)
    const matchesEmployee = selectedEmployees.length === 0 || 
                            selectedEmployees.some(empId => {
                              // Try to match by employeeId first (reliable for name changes)
                              if (movement.employeeId) {
                                return movement.employeeId === empId;
                              }
                              // Fallback to name matching for old data
                              const emp = employees.find(e => e.id === empId);
                              return emp && movement.employee === emp.name;
                            });
    
    // Apply client filter (for sales)
    const matchesClient = selectedClients.length === 0 || 
                          selectedClients.some(clientId => {
                            const client = mockClients.find(c => c.id === clientId);
                            return client && displayClientName(movement.client) === client.name;
                          });
    
    // Apply supplier filter (for expenses)
    const matchesSupplier = selectedSuppliers.length === 0 ||
                           selectedSuppliers.some(supplierId => {
                             const supplier = suppliersList.find(s => s.id === supplierId);
                             return supplier && movement.supplier === supplier.name;
                           });
    
    return matchesSearch && matchesDate && matchesPaymentMethod && matchesPaymentStatus && matchesEmployee && matchesClient && matchesSupplier;
  });

  const totalSales = allMovementsForStats
    .filter(m => m.type === 'sale')
    .reduce((sum, m) => sum + m.total, 0);
  const totalExpenses = allMovementsForStats
    .filter(m => m.type === 'expense')
    .reduce((sum, m) => sum + m.total, 0);
  const totalProfit = allMovementsForStats.reduce((sum, m) => sum + m.profit, 0);

  // Calculate reports data
  const salesMovements = allMovementsForStats.filter(m => m.type === 'sale');
  const salesCount = salesMovements.length;
  const productsCost = salesMovements.reduce((sum, m) => {
    return sum + (m.products?.reduce((pSum: number, p: any) => pSum + ((p.cost || 0) * p.quantity), 0) || 0);
  }, 0);
  const netProfit = totalSales - totalExpenses - productsCost;
  const averageTicket = salesCount > 0 ? totalSales / salesCount : 0;
  const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
  
  // Calculate payment methods distribution
  const paymentMethodsMap: { [key: string]: { count: number; total: number } } = {};
  salesMovements.forEach(m => {
    const method = paymentMethodLabelForMovement(m.paymentMethod);
    if (!paymentMethodsMap[method]) {
      paymentMethodsMap[method] = { count: 0, total: 0 };
    }
    paymentMethodsMap[method].count += 1;
    paymentMethodsMap[method].total += m.total;
  });
  const paymentMethodsData = Object.entries(paymentMethodsMap).map(([method, data]) => ({
    method,
    count: data.count,
    total: data.total
  })).sort((a, b) => b.total - a.total);

  // Calculate collaborators (top sellers)
  const collaboratorsMap: { [key: string]: { salesCount: number; salesTotal: number } } = {};
  salesMovements.forEach(m => {
    const employeeName = m.employee || 'Sin asignar';
    if (!collaboratorsMap[employeeName]) {
      collaboratorsMap[employeeName] = { salesCount: 0, salesTotal: 0 };
    }
    collaboratorsMap[employeeName].salesCount += 1;
    collaboratorsMap[employeeName].salesTotal += m.total;
  });
  const collaboratorsData = Object.entries(collaboratorsMap).map(([name, data]) => ({
    name,
    salesCount: data.salesCount,
    salesTotal: data.salesTotal
  })).sort((a, b) => b.salesTotal - a.salesTotal);

  // Calculate top products
  const productsMap: { [key: string]: { quantity: number; revenue: number } } = {};
  salesMovements.forEach(m => {
    if (m.products && m.products.length > 0) {
      m.products.forEach((p: any) => {
        const productName = p.name || 'Producto sin nombre';
        if (!productsMap[productName]) {
          productsMap[productName] = { quantity: 0, revenue: 0 };
        }
        productsMap[productName].quantity += p.quantity;
        productsMap[productName].revenue += (p.price || 0) * p.quantity;
      });
    }
  });
  const topProductsData = Object.entries(productsMap).map(([name, data]) => ({
    name,
    quantity: data.quantity,
    revenue: data.revenue
  })).sort((a, b) => b.revenue - a.revenue);

  const reportsData = {
    salesCount,
    salesTotal: totalSales,
    expensesTotal: totalExpenses,
    netProfit,
    productsCost,
    averageTicket,
    profitMargin,
    paymentMethods: paymentMethodsData,
    collaborators: collaboratorsData,
    topProducts: topProductsData
  };

  // Get filter label for reports
  const getFilterLabel = () => {
    const parts = [];
    
    // Date filter
    if (dateFilter === 'daily') {
      parts.push(format(selectedDay, "d 'de' MMMM, yyyy", { locale: es }));
    } else if (dateFilter === 'weekly') {
      parts.push(`Semana del ${format(weekStart, 'd MMM', { locale: es })} al ${format(weekEnd, 'd MMM', { locale: es })}`);
    } else if (dateFilter === 'monthly') {
      parts.push(format(new Date(selectedYear, selectedMonth), "MMMM yyyy", { locale: es }));
    } else if (dateFilter === 'yearly') {
      parts.push(`Año ${selectedYear}`);
    } else {
      parts.push('Todos los períodos');
    }
    
    // Type filter
    if (typeFilter === 'sale') {
      parts.push('Ventas');
    } else if (typeFilter === 'expense') {
      parts.push('Gastos');
    }
    
    return parts.join(' • ');
  };

  // Edit Functions
  const openEditSheet = (movement?: any) => {
    const movementToEdit = movement || selectedMovement;
    if (!movementToEdit) return;
    
    console.log('Opening edit sheet - Movement ID:', movementToEdit.id, 'Date:', movementToEdit.date);
    
    // Calculate total if not present
    const calculatedTotal = movementToEdit.total || 
      (movementToEdit.products?.reduce((sum: number, product: any) => {
        return sum + (product.price * product.quantity);
      }, 0) ?? 0);
    
    setEditDate(movementToEdit.date);
    setEditTime(movementToEdit.time);
    
    // Set client
    const client = mockClients.find(c => c.name === movementToEdit.client);
    console.log('Setting client:', movementToEdit.client, 'Found:', client?.name || 'null');
    setEditSelectedClient(client || null);
    
    // Set employee
    const employee = employees.find(e => e.name === movementToEdit.employee);
    console.log('Setting employee:', movementToEdit.employee, 'Found:', employee?.name || 'null');
    setEditSelectedEmployee(employee || null);
    
    setEditNote(movementToEdit.productConcept);
    setEditNumPayments(1);
    setEditSinglePaymentMethod('Efectivo');
    setEditPayments([{ id: '1', amount: formatCurrency(calculatedTotal), method: 'Efectivo' }]);
    applySaleDiscountToEditState(movementToEdit);
    setEditReceiptNote('');
    const mappedStatus = movementToEditSaleTab(movementToEdit);
    console.log('Setting sale status - Original:', movementToEdit.status, 'Mapped:', mappedStatus);
    setEditSaleStatus(mappedStatus);
    setDetailSheetOpen(false);
    setEditSheetOpen(true);
  };

  const handleEditNumPaymentsChange = (num: number) => {
    setEditNumPayments(num);
    if (num === 1) {
      setEditPayments([{ id: '1', amount: '', method: editSinglePaymentMethod || 'Efectivo' }]);
    } else if (num === 0) {
      // Custom number
      setEditPayments([]);
    } else {
      const newPayments = Array(num).fill(null).map((_, index) => {
        if (editPayments[index]) {
          return {
            ...editPayments[index],
            amount: editPayments[index].amount || '',
            method: editPayments[index].method || 'Efectivo'
          };
        }
        return { id: `${index + 1}`, amount: '', method: 'Efectivo' };
      });
      setEditPayments(newPayments);
    }
  };

  const updateEditPaymentField = (id: string, field: 'amount' | 'method', value: string) => {
    setEditPayments(prev => 
      prev.map(p => p.id === id ? { ...p, [field]: value || (field === 'amount' ? '' : 'Efectivo') } : p)
    );
  };

  const getEditGrossProductsTotal = () => grossSubtotalFromMovement(selectedMovement);

  const handleEditDiscountPercentChange = (value: string) => {
    setEditDiscountPercent(value);
    const percent = parseFloat(value) || 0;
    const gross = getEditGrossProductsTotal();
    const discountAmt = gross > 0 ? (gross * percent) / 100 : 0;
    setEditDiscountAmount(discountAmt.toFixed(2));
  };

  const handleEditDiscountAmountChange = (value: string) => {
    setEditDiscountAmount(value);
    const amount = parseFloat(value) || 0;
    const gross = getEditGrossProductsTotal();
    const percent = gross > 0 ? (amount / gross) * 100 : 0;
    setEditDiscountPercent(percent.toFixed(2));
  };

  const getEditTotalPayments = () => {
    return editPayments.reduce((sum, payment) => {
      const amount = parseFloat(payment.amount) || 0;
      return sum + amount;
    }, 0);
  };

  const getEditTotalWithDiscount = () => {
    if (!selectedMovement) return 0;
    const gross = getEditGrossProductsTotal();
    const discount = editDiscountActive ? parseFloat(editDiscountAmount) || 0 : 0;
    return Math.max(0, gross - discount);
  };

  const editPaymentsMatchTotal = () => {
    if (editNumPayments === 1) return true;
    const total = getEditTotalPayments();
    const expected = getEditTotalWithDiscount();
    return Math.abs(total - expected) < 0.01;
  };

  const handleEditProducts = () => {
    // Guardar datos en localStorage para recuperarlos al volver
    localStorage.setItem('editingMovement', JSON.stringify({
      ...selectedMovement,
      isEditingProducts: true, // ← Agregar bandera aquí
      editDate,
      editTime,
      editSelectedClient,
      editSelectedEmployee,
      editNote,
      editPayments,
      editNumPayments,
      editSinglePaymentMethod,
      editDiscountActive,
      editDiscountAmount,
      editDiscountPercent,
      editReceiptNote,
      editSaleStatus,
    }));
    
    // Navegar a la página de ventas con state para indicar que es una edición
    navigate('/sales', { state: { isEditingProducts: true } });
  };

  const saveEdit = async () => {
    if (!selectedMovement || !currentBusiness?.id) return;
    
    // Calculate new total from products
    const productsTotal = selectedMovement.products.reduce((sum, product) => {
      return sum + (product.price * product.quantity);
    }, 0);
    
    // Calculate total cost and profit
    const totalCost = selectedMovement.products.reduce((sum, product) => {
      return sum + ((product.cost || 0) * product.quantity);
    }, 0);
    
    // Calculate final total with discount
    const discount = editDiscountActive ? parseFloat(editDiscountAmount) || 0 : 0;
    const finalTotal = productsTotal - discount;
    
    // Calculate profit (total after discount - total cost)
    const newProfit = finalTotal - totalCost;
    
    // Map payment method labels back to codes
    const paymentMethodCodeMap: Record<string, string> = {
      'Efectivo': 'cash',
      'Tarjeta': 'card',
      'Transferencia': 'transfer',
      'Otro': 'other'
    };
    
    // Determine if it's multiple payments
    let paymentData: any = {};
    
    if (editNumPayments > 1) {
      // Multiple payments
      const parsedPayments = editPayments.map(payment => ({
        id: payment.id,
        amount: parseFloat(payment.amount.replace(/\./g, '').replace(',', '.')),
        method: paymentMethodCodeMap[payment.method] || 'cash'
      }));
      
      paymentData = {
        payment_type: 'multiple',
        payments: parsedPayments
      };
    } else {
      // Single payment
      const paymentMethodCode = paymentMethodCodeMap[editSinglePaymentMethod] || 'cash';
      paymentData = {
        payment_type: paymentMethodCode,
        payments: []
      };
    }
    
    // Mismo formato de líneas que al crear venta (JSONB en Supabase)
    const items = selectedMovement.products.map((product: any) => {
      const qty = Number(product.quantity) || 0;
      const price = Number(product.price) || 0;
      return {
        productId: product.product_id || product.id,
        name: product.name,
        price,
        quantity: qty,
        subtotal: price * qty,
        discount: 0,
      };
    });

    const createdAtIso = buildLocalDateTimeFromDateAndTime(editDate, editTime);
    const paidAmountFinal = editSaleStatus === 'credit' ? 0 : finalTotal;
    const changeAmountFinal = 0;

    let paymentMethodDb: string;
    if (editSaleStatus === 'credit') {
      paymentMethodDb = 'Crédito';
    } else if (paymentData.payment_type === 'multiple') {
      paymentMethodDb = 'Múltiple';
    } else if (paymentData.payment_type === 'cash') {
      paymentMethodDb = 'Efectivo';
    } else if (paymentData.payment_type === 'card') {
      paymentMethodDb = 'Tarjeta';
    } else if (paymentData.payment_type === 'transfer') {
      paymentMethodDb = 'Transferencia';
    } else {
      paymentMethodDb = 'Otros';
    }

    if (!editSelectedEmployee) {
      toast.error('Selecciona un vendedor.');
      return;
    }
    const sellerUserId = editSelectedEmployee.userId;
    if (!sellerUserId || typeof sellerUserId !== 'string') {
      toast.error(
        'Este vendedor no tiene cuenta vinculada. Solo puedes asignar empleados que ya hayan aceptado la invitación.',
      );
      return;
    }

    // Update sale via API (persistencia en BD) y recargar ventas para que la lista = lo guardado
    try {
      setSavingEdit(true);
      await apiService.updateSale(selectedMovement.id, currentBusiness.id, {
        customerId: editSelectedClient?.id ?? null,
        createdBy: sellerUserId,
        items,
        subtotal: productsTotal,
        discount,
        total: finalTotal,
        tax: 0,
        paymentMethod: paymentMethodDb,
        paymentStatus: editSaleStatus === 'credit' ? 'pending' : 'paid',
        paidAmount: paidAmountFinal,
        changeAmount: changeAmountFinal,
        payments: paymentData.payments || [],
        notes: editNote || null,
        createdAt: createdAtIso,
      });

      const [salesData, expensesData] = await Promise.all([
        apiService.getSales(currentBusiness.id),
        apiService.getExpenses(currentBusiness.id),
      ]);
      processMovements(salesData, expensesData, products, customers, employees);

      const refreshed = salesData.find((s) => s.id === selectedMovement.id);
      if (refreshed) {
        const itemsDb = refreshed.items || [];
        const totalCostRef = itemsDb.reduce(
          (sum: number, item: any) =>
            sum +
            (isFreeSaleLineItem(item)
              ? 0
              : (Number(item.price) || 0) * (Number(item.quantity) || 0) * 0.6),
          0,
        );
        const totalAmt = Number(refreshed.total) || 0;
        const saleDateTime = new Date(refreshed.createdAt);
        setSelectedMovement({
          ...selectedMovement,
          date: format(saleDateTime, 'yyyy-MM-dd'),
          time: format(saleDateTime, 'HH:mm'),
          client: editSelectedClient?.name || selectedMovement.client,
          employee:
            employees.find((e) => e.userId === refreshed.createdBy)?.name ||
            editSelectedEmployee?.name ||
            selectedMovement.employee,
          productConcept: refreshed.notes || selectedMovement.productConcept,
          products: itemsDb.map((item: any) => ({
            id: item.productId || item.id,
            product_id: item.productId || null,
            name: item.name || 'Producto',
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
            cost: isFreeSaleLineItem(item) ? 0 : Number(item.price) * 0.6 || 0,
            image: selectedMovement.products?.find((p: any) => p.product_id === item.productId || p.id === item.productId)?.image || '',
          })),
          total: totalAmt,
          profit: totalAmt - totalCostRef,
          discount: Number(refreshed.discount) || 0,
          status: String(refreshed.paymentStatus).toLowerCase() === 'paid' ? 'paid' : 'debt',
          salePaymentStatus: String(refreshed.paymentStatus).toLowerCase(),
          paymentMethod:
            (refreshed.payments || []).length > 1
              ? 'multiple'
              : refreshed.paymentMethod?.toLowerCase() === 'efectivo'
                ? 'cash'
                : refreshed.paymentMethod?.toLowerCase() === 'tarjeta'
                  ? 'card'
                  : refreshed.paymentMethod?.toLowerCase() === 'transferencia'
                    ? 'transfer'
                    : 'other',
          numPayments: Math.max(1, (refreshed.payments || []).length),
          payments: (refreshed.payments || []).map((p: any) => ({
            ...p,
            method:
              p.method?.toLowerCase() === 'efectivo'
                ? 'cash'
                : p.method?.toLowerCase() === 'tarjeta'
                  ? 'card'
                  : p.method?.toLowerCase() === 'transferencia'
                    ? 'transfer'
                    : p.method?.toLowerCase() === 'otros'
                      ? 'other'
                      : p.method || 'cash',
          })),
        });
      }

      toast.success('Cambios guardados correctamente');

      localStorage.removeItem('editingMovement');

      setEditSheetOpen(false);
    } catch (error) {
      console.error('Error updating sale:', error);
      toast.error('Error al actualizar la venta');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle delete confirmation
  const handleDeleteClick = () => {
    setMovementToDelete(selectedMovement);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!movementToDelete || !currentBusiness?.id) return;
    
    try {
      // Delete via API based on type
      if (movementToDelete.type === 'sale') {
        await apiService.deleteSale(movementToDelete.id, currentBusiness.id);
      } else if (movementToDelete.type === 'expense') {
        await apiService.deleteExpense(movementToDelete.id, currentBusiness.id);
      }
      
      // Remove from movements array in state
      setMovements(movements.filter(m => m.id !== movementToDelete.id));
      
      toast.success('Movimiento eliminado correctamente');
    } catch (error) {
      console.error('Error deleting movement:', error);
      toast.error('Error al eliminar el movimiento');
    }
    
    // Close dialogs
    setDeleteDialogOpen(false);
    setDetailSheetOpen(false);
    setMovementToDelete(null);
  };

  // Handle print receipt - Abre modal con vista previa del PDF
  const handlePrintReceipt = async () => {
    if (!selectedMovement) return;
    
    try {
      // Ventas con varios pagos se expanden en filas: id/total pueden ser del pago parcial.
      // Siempre generar el recibo con el movimiento completo (venta/gasto real).
      const baseMovement =
        selectedMovement.originalId
          ? movements.find((m) => m.id === selectedMovement.originalId) ?? selectedMovement
          : selectedMovement;

      // Enrich movement with client phone if available
      const enrichedMovement: any = { ...baseMovement };
      
      if (baseMovement.type === 'sale') {
        if (baseMovement.client && baseMovement.client !== '-') {
          const clientName = displayClientName(baseMovement.client);
          const client = customers.find((c: any) => String(c?.name || '').trim() === clientName);
          if (client?.phone) enrichedMovement.clientPhone = client.phone;
          if (client?.email) enrichedMovement.clientEmail = client.email;
          if (client?.cedula) enrichedMovement.clientCedula = client.cedula;
        }
      }
      
      // Add notes field for expenses (use expenseName)
      if (baseMovement.type === 'expense' && baseMovement.expenseName) {
        enrichedMovement.notes = baseMovement.expenseName;
      }
      
      // Add payment methods array from payments if available
      if (baseMovement.payments && baseMovement.payments.length > 0) {
        enrichedMovement.paymentMethods = baseMovement.payments.map((p: any) => ({
          method: p.method || p.type || 'Efectivo',
          amount: Number(p.amount) || 0
        }));
      } else if (baseMovement.paymentMethod) {
        enrichedMovement.paymentMethods = [{
          method: baseMovement.paymentMethod === 'cash' ? 'Efectivo' : 
                  baseMovement.paymentMethod === 'card' ? 'Tarjeta' : 
                  baseMovement.paymentMethod,
          amount: Number(baseMovement.total) || 0
        }];
      }
      
      console.log('📄 Generando recibo...', enrichedMovement);
      const pdfUrl = await printReceipt(enrichedMovement, businessSettings);
      
      // Guardar URL y número de recibo para el modal
      const idForLabel = String(baseMovement.id ?? '');
      setReceiptPdfUrl(pdfUrl);
      setReceiptNumber(idForLabel.replace(/[^a-zA-Z0-9-]/g, '').slice(-8).toUpperCase() || 'RECIBO');
      setReceiptModalOpen(true);
      
      toast.success('Vista previa generada exitosamente');
    } catch (error) {
      console.error('❌ Error al generar recibo:', error);
      toast.error('Error al generar el recibo');
    }
  };

  // Expense categories
  const expenseCategories = [
    'Productos',
    'Servicios',
    'Marketing',
    'Mantenimiento',
    'Salarios',
    'Renta',
    'Servicios públicos',
    'Impuestos',
    'Gastos operativos',
    'Compras',
    'Otros',
  ];

  // Handle save edited expense
  const handleSaveEditedExpense = async (expense: any) => {
    if (!selectedMovement || !currentBusiness?.id) return;

    // Map payment method to the format expected
    const paymentMethodMap: { [key: string]: string } = {
      'Efectivo': 'cash',
      'Tarjeta': 'card',
      'Transferencia': 'transfer',
      'Otros': 'other',
    };

    // Map status from Spanish to English
    const statusMap: { [key: string]: string } = {
      'pagada': 'paid',
      'deuda': 'pending'
    };

    // Update expense via API (incl. fecha → created_at en BD)
    try {
      await apiService.updateExpense(selectedMovement.id, currentBusiness.id, {
        category: expense.category,
        description: expense.name || expense.category,
        amount: expense.amount,
        paymentMethod: expense.status === 'deuda' ? '-' : expense.paymentMethod,
        paymentStatus: (statusMap[expense.status] || 'paid') as 'paid' | 'pending',
        notes: expense.name || null,
        createdAt: buildLocalDateTimeFromDateAndTime(expense.date, '12:00'),
      });
    } catch (error) {
      console.error('Error updating expense:', error);
      toast.error('Error al actualizar el gasto');
      return;
    }

    // Update the movement with new expense data, maintaining structure
    const updatedMovement = {
      ...selectedMovement,
      date: expense.date,
      productConcept: expense.name || expense.category,
      total: expense.amount,
      cost: expense.amount,
      profit: -expense.amount,
      paymentMethod: expense.status === 'deuda' ? 'none' : paymentMethodMap[expense.paymentMethod] || 'cash',
      status: statusMap[expense.status] || 'paid',
      // Store category and name separately for editing
      expenseCategory: expense.category,
      expenseName: expense.name,
      supplier: expense.supplier || '',
      // Update products array to match the new expense
      products: [{
        id: selectedMovement.products?.[0]?.id || 'p1',
        name: expense.name || expense.category,
        quantity: 1,
        price: expense.amount,
        image: (selectedMovement.products?.[0]?.image && !selectedMovement.products[0].image.includes('unsplash.com')) ? selectedMovement.products[0].image : ''
      }]
    };

    // Update in movements array
    setMovements(movements.map(m => m.id === updatedMovement.id ? updatedMovement : m));

    toast.success('Gasto actualizado correctamente');
    
    // Clean up localStorage after successful save
    localStorage.removeItem('editingMovement');
    
    setEditSheetOpen(false);
  };

  // Export to Excel function
  const exportToExcel = async () => {
    const success = await exportMovementsToExcel(filteredMovementsForExport, getFilterLabel());
    if (success) {
      toast.success('Excel exportado correctamente');
    } else {
      toast.error('Error al exportar a Excel');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* No business selected */}
      {!currentBusiness && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-600">No hay negocio seleccionado</p>
          </div>
        </div>
      )}
      
      {/* Main content */}
      {currentBusiness && (
        <>
          <PageHeader
            desktop={
              <header className="bg-white border-b border-gray-300/80 px-4 sm:px-6 py-4 shadow-[var(--shadow-card)]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Movimientos</h1>
                    <p className="text-sm text-gray-500 mt-1">Historial de ventas y gastos</p>
                  </div>

                  <div className="flex gap-2">
                    {canExportMovement && (
                      <Button variant="outline" size="sm" onClick={exportToExcel}>
                        <Download className="w-4 h-4 mr-2" />
                        Exportar
                      </Button>
                    )}
                    {canReportsMovement && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="hidden md:flex"
                        onClick={() => setReportsSheetOpen(true)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Reportes
                      </Button>
                    )}
                  </div>
                </div>
              </header>
            }
            mobile={
              <header className="bg-[#272B36] border-b border-slate-700 px-3 py-2.5 shadow-sm sticky top-0 z-10">
                <div className="flex items-center justify-between gap-2">
                  {/* Business Selector */}
                  <button
                    onClick={() => setBusinessModalOpen(true)}
                    className="flex items-center gap-2 hover:opacity-90 transition-opacity flex-1 min-w-0 text-left"
                  >
                    {/* Logo */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
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

                    {/* Nombre del negocio */}
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className="text-sm font-semibold text-white truncate">
                        {currentBusiness?.name || 'Mi Negocio'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                    </div>
                  </button>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-white hover:bg-white/10"
                      onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                    >
                      <Search className="w-4 h-4 text-white" />
                    </Button>
                    {canReportsMovement && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-white hover:bg-white/10"
                        onClick={() => setReportsSheetOpen(true)}
                      >
                        <FileText className="w-4 h-4 text-white" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 relative text-white hover:bg-white/10"
                      onClick={openFilterSheet}
                    >
                      <Filter className="w-4 h-4 text-white" />
                      {activeFiltersCount > 0 && (
                        <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-teal-600 rounded-full" />
                      )}
                    </Button>
                  </div>
                </div>
              </header>
            }
            below={
              <>
                {/* Mobile Search Bar */}
                {mobileSearchOpen && (
                  <div className="md:hidden bg-[#272B36] border-b border-slate-700 px-2 sm:px-3 py-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-4 h-4" />
                      <Input
                        placeholder="Buscar concepto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-9 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        autoFocus
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            }
          />

      {/* Date Selector - Mobile Horizontal Scroll */}
      <div className="md:hidden bg-[#272B36] border-b border-slate-700 px-2 sm:px-3 py-1.5 sm:py-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Scrollable options container */}
          <div ref={scrollContainerRef} className="w-0 flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 min-w-max">
              {/* Dynamic content based on date filter */}
              {dateFilter === 'daily' && Array.from({ length: 5 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (4 - i));
                const isSelected = selectedDay && 
                  date.getDate() === selectedDay.getDate() &&
                  date.getMonth() === selectedDay.getMonth() &&
                  date.getFullYear() === selectedDay.getFullYear();
                
                return (
                  <button
                    key={i}
                    data-selected={isSelected}
                    onClick={() => {
                      setDateFilter('daily');
                      setSelectedDay(date);
                    }}
                    className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-10 sm:w-14 sm:h-11 rounded-lg transition-colors ${
                      isSelected 
                        ? 'bg-white text-[#272B36] shadow-md border-2 border-[#272B36]' 
                        : 'bg-white/10 text-white/85 hover:bg-white/15'
                    }`}
                  >
                    <span className="text-[10px] sm:text-[11px] font-medium">
                      {format(date, 'd MMM', { locale: es })}
                    </span>
                  </button>
                );
              })}

              {dateFilter === 'monthly' && Array.from({ length: 5 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - (4 - i));
                const isSelected = date.getMonth() === selectedMonth && 
                  date.getFullYear() === selectedYear;
                
                return (
                  <button
                    key={i}
                    data-selected={isSelected}
                    onClick={() => {
                      setDateFilter('monthly');
                      setSelectedMonth(date.getMonth());
                      setSelectedYear(date.getFullYear());
                    }}
                    className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-10 sm:w-14 sm:h-11 rounded-lg transition-colors ${
                      isSelected 
                        ? 'bg-white text-[#272B36] shadow-md border-2 border-[#272B36]' 
                        : 'bg-white/10 text-white/85 hover:bg-white/15'
                    }`}
                  >
                    <span className="text-[10px] sm:text-[11px] font-medium capitalize">
                      {format(date, 'MMM', { locale: es })}
                    </span>
                  </button>
                );
              })}

              {dateFilter === 'weekly' && Array.from({ length: 5 }, (_, i) => {
                const today = new Date();
                const weekOffset = 4 - i;
                const referenceDate = new Date(today);
                referenceDate.setDate(today.getDate() - (weekOffset * 7));
                const weekStartDate = startOfWeek(referenceDate, { weekStartsOn: 1 });
                const weekEndDate = endOfWeek(referenceDate, { weekStartsOn: 1 });
                
                const isSelected = weekStart && 
                  weekStartDate.getDate() === weekStart.getDate() &&
                  weekStartDate.getMonth() === weekStart.getMonth() &&
                  weekStartDate.getFullYear() === weekStart.getFullYear();
                
                return (
                  <button
                    key={i}
                    data-selected={isSelected}
                    onClick={() => {
                      setDateFilter('weekly');
                      setWeekStart(weekStartDate);
                      setWeekEnd(weekEndDate);
                    }}
                    className={`flex-shrink-0 flex flex-col items-center justify-center px-2 h-10 sm:h-11 rounded-lg transition-colors ${
                      isSelected 
                        ? 'bg-white text-[#272B36] shadow-md border-2 border-[#272B36]' 
                        : 'bg-white/10 text-white/85 hover:bg-white/15'
                    }`}
                  >
                    <span className="text-[11px] sm:text-[10px] font-medium whitespace-nowrap">
                      {format(weekStartDate, 'd MMM', { locale: es })} - {format(weekEndDate, 'd MMM', { locale: es })}
                    </span>
                  </button>
                );
              })}

              {dateFilter === 'yearly' && Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - (4 - i);
                const isSelected = year === selectedYear;
                
                return (
                  <button
                    key={i}
                    data-selected={isSelected}
                    onClick={() => {
                      setDateFilter('yearly');
                      setSelectedYear(year);
                    }}
                    className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-10 sm:w-14 sm:h-11 rounded-lg transition-colors ${
                      isSelected 
                        ? 'bg-white text-[#272B36] shadow-md border-2 border-[#272B36]' 
                        : 'bg-white/10 text-white/85 hover:bg-white/15'
                    }`}
                  >
                    <span className="text-[10px] sm:text-[11px] font-medium">
                      {year}
                    </span>
                  </button>
                );
              })}

              {dateFilter === 'custom' && (
                <div className="flex items-center justify-center py-1 min-w-[120px] flex-shrink-0">
                  <span className="text-xs text-white/70">
                    Rango personalizado
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Fixed calendar button */}
          <button 
            onClick={() => setDatePeriodSheetOpen(true)}
            className="flex-shrink-0 flex items-center justify-center w-12 h-10 sm:w-14 sm:h-11 rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors"
          >
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Filters Section - Desktop Only */}
      <div className="hidden md:block px-4 sm:px-6 py-4">
        <SectionCard>
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Button */}
            <Button variant="outline" size="sm" onClick={openFilterSheet}>
              <Filter className="w-4 h-4 mr-2" />
              Filtrar
              {activeFiltersCount > 0 && (
                <Badge className="ml-2" variant="secondary">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {/* Date Preset Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Semana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Día</SelectItem>
                <SelectItem value="weekly">Semana</SelectItem>
                <SelectItem value="monthly">Mes</SelectItem>
                <SelectItem value="yearly">Año</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Selector - Changes based on filter type */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[180px] justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  {getDateDisplayText()}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                {/* Daily - Full Calendar */}
                {dateFilter === 'daily' && (
                  <DateCalendar
                    mode="single"
                    selected={selectedDay}
                    onSelect={(date) => date && setSelectedDay(date)}
                  />
                )}

                {/* Weekly - Calendar with range */}
                {dateFilter === 'weekly' && (
                  <DateCalendar
                    mode="range"
                    weekMode={true}
                    selected={{ from: weekStart, to: weekEnd }}
                    onSelect={(range: any) => {
                      if (range?.from) setWeekStart(range.from);
                      if (range?.to) setWeekEnd(range.to);
                    }}
                  />
                )}

                {/* Monthly - Month/Year picker */}
                {dateFilter === 'monthly' && (
                  <MonthYearPicker
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onMonthChange={setSelectedMonth}
                    onYearChange={setSelectedYear}
                  />
                )}

                {/* Yearly - Year picker */}
                {dateFilter === 'yearly' && (
                  <YearPicker
                    selectedYear={selectedYear}
                    onYearChange={setSelectedYear}
                  />
                )}

                {/* Custom - Calendar with range */}
                {dateFilter === 'custom' && (
                  <DateCalendar
                    mode="range"
                    selected={{ from: weekStart, to: weekEnd }}
                    onSelect={(range: any) => {
                      if (range?.from) setWeekStart(range.from);
                      if (range?.to) setWeekEnd(range.to);
                    }}
                  />
                )}
              </PopoverContent>
            </Popover>
            
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar concepto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Applied Filters Section - Desktop Only */}
      {activeFiltersCount > 0 && (
        <div className="hidden md:block px-4 sm:px-6 pb-4">
          <SectionCard>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Filtros aplicados</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllAppliedFilters}
                className="h-auto p-0 text-xs text-gray-600 hover:text-gray-900"
              >
                Limpiar todos
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Payment Method Chips */}
              {selectedPaymentMethods.map((methodId) => {
                const method = paymentMethods.find(m => m.id === methodId);
                return (
                  <div
                    key={methodId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-full text-sm text-[#272B36]"
                  >
                    <span>{method?.label}</span>
                    <button
                      onClick={() => removeAppliedFilter('paymentMethod', methodId)}
                      className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* Payment Status Chips */}
              {selectedPaymentStatuses.map((status) => (
                <div
                  key={status}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-full text-sm text-[#272B36]"
                >
                  <span>{status === 'paid' ? 'Pagado' : status === 'debt' ? 'Deuda' : status}</span>
                  <button
                    onClick={() => removeAppliedFilter('paymentStatus', status)}
                    className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              
              {/* Employee Chip */}
              {selectedEmployees.length > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-full text-sm text-[#272B36]">
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    {selectedEmployees.map(empId => employees.find(e => e.id === empId)?.name).filter(Boolean).join(', ')}
                  </span>
                  <button
                    onClick={() => removeAppliedFilter('employee')}
                    className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              
              {/* Client Chip */}
              {selectedClients.length > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-full text-sm text-[#272B36]">
                  <User className="w-3.5 h-3.5" />
                  <span>{selectedClients.map(clientId => clientsList.find(c => c.id === clientId)?.name).filter(Boolean).join(', ')}</span>
                  <button
                    onClick={() => removeAppliedFilter('client')}
                    className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              
              {/* Supplier Chip */}
              {selectedSuppliers.length > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-full text-sm text-[#272B36]">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{selectedSuppliers.map(supplierId => suppliersList.find(s => s.id === supplierId)?.name).filter(Boolean).join(', ')}</span>
                  <button
                    onClick={() => removeAppliedFilter('supplier')}
                    className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Summary Cards - Desktop */}
      <div className="hidden md:block px-4 sm:px-6 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Balance Card */}
          <div className="bg-white rounded-lg p-4 shadow-md border-2 border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 mb-0.5">Balance Total</p>
                <p className={`font-bold ${(totalSales - totalExpenses) >= 0 ? 'text-emerald-700' : 'text-rose-700'} text-[24px]`}>
                  ${formatCurrency(totalSales - totalExpenses)}
                </p>
              </div>
            </div>
          </div>

          {/* Sales Card */}
          <SectionCard>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 mb-0.5">Ventas totales</p>
                <p className="text-2xl font-bold text-emerald-700">${formatCurrency(totalSales)}</p>
              </div>
            </div>
          </SectionCard>

          {/* Expenses Card */}
          <SectionCard>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-6 h-6 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 mb-0.5">Gastos totales</p>
                <p className="text-2xl font-bold text-rose-700">${formatCurrency(totalExpenses)}</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Summary Cards - Mobile */}
      <div className="md:hidden px-4 py-3">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-[12px]">
          {/* Balance Header */}
          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b">
            <span className="text-sm sm:text-base text-gray-600 font-medium flex-shrink-0">Balance</span>
            <span className={`text-xl sm:text-2xl font-bold break-words text-right ${(totalSales - totalExpenses) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              ${formatCurrency(totalSales - totalExpenses)}
            </span>
          </div>

          {/* Ingresos y Egresos */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-600 font-medium">Ingresos</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-emerald-700 break-words">${formatCurrency(totalSales)}</p>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-600 font-medium">Egresos</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-rose-700 break-words">${formatCurrency(totalExpenses)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Table */}
      <div className="flex-1 px-0 md:px-4 sm:px-6 pb-0 md:pb-4 overflow-hidden">
        <Tabs value={typeFilter} onValueChange={setTypeFilter} className="h-full flex flex-col">
          {/* Tabs Header - Desktop */}
          <div className="hidden md:block bg-white rounded-t-lg border border-gray-300/90 shadow-[var(--shadow-card)] px-4 pt-4 pb-4 relative z-10">
            <TabsList className="w-full grid grid-cols-2 gap-2 p-2 bg-gray-100 h-auto">
              <TabsTrigger value="sale" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Ventas
              </TabsTrigger>
              <TabsTrigger value="expense" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Gastos
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tabs Header - Mobile */}
          <div className="md:hidden bg-gray-50/95 border-b sticky top-0 z-10 backdrop-blur">
            <div className="px-4 py-2">
              <TabsList className="w-full grid grid-cols-2 h-11 p-1 bg-gray-100 rounded-xl border border-gray-200 shadow-sm">
              <TabsTrigger 
                value="sale" 
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700 text-gray-600"
              >
                Ingresos
              </TabsTrigger>
              <TabsTrigger 
                value="expense" 
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-rose-700 text-gray-600"
              >
                Egresos
              </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Table Content */}
          <div className="md:bg-white md:rounded-b-lg md:border md:border-gray-300/90 md:shadow-[var(--shadow-card)] flex-1 flex flex-col overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-auto flex-1">
              <table className="w-full">
                <thead className={dataTableThead}>
                  <tr>
                    <th className={`${dthMovement} w-[30%]`}>Concepto</th>
                    <th className={`${dthMovement} w-[15%]`}>Valor</th>
                    <th className={`${dthMovement} w-[14%]`}>Medio de pago</th>
                    <th className={`${dthMovement} w-[17%]`}>Fecha y hora</th>
                    <th className={`${dthMovement} w-[12%]`}>Empleado</th>
                    <th className={`${dthMovement} w-[12%]`}>Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, idx) => (
                      <tr key={`movements-skeleton-row-${idx}`}>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-56" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      </tr>
                    ))
                  ) : filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12">
                        <div className="flex flex-col items-center">
                          <Receipt className="w-16 h-16 text-gray-300 mb-4" />
                          <p className="text-gray-500 text-lg mb-2">No hay movimientos</p>
                          <p className="text-gray-400">
                            {searchTerm || typeFilter !== 'all' || dateFilter !== 'all' || selectedPaymentMethods.length > 0 || selectedPaymentStatuses.length > 0
                              ? 'No se encontraron resultados con los filtros aplicados'
                              : 'Los movimientos de ventas y gastos aparecerán aquí'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                  filteredMovements.map((movement) => {
                    const paymentMethodLabel = paymentMethodLabelForMovement(movement.paymentMethod);
                    
                    // Determine position in group for styling
                    const isFirstInGroup = movement.isPartialPayment && movement.paymentIndex === 1;
                    const isLastInGroup = movement.isPartialPayment && movement.paymentIndex === movement.totalPayments;
                    
                    // Build dynamic classes
                    let rowClasses = "hover:bg-gray-50 transition-colors cursor-pointer ";
                    
                    if (movement.isPartialPayment) {
                      rowClasses += "border-l-2 border-l-gray-300 ";
                      
                      if (isFirstInGroup) {
                        rowClasses += "border-t border-t-gray-200 ";
                      }
                      if (isLastInGroup) {
                        rowClasses += "border-b border-b-gray-200 ";
                      }
                      if (!isLastInGroup) {
                        rowClasses += "border-b-0 ";
                      }
                    }
                    
                    return (
                      <tr 
                        key={movement.id} 
                        className={rowClasses}
                        onClick={() => {
                          // If it's a partial payment, find the original movement
                          const originalMovement = movement.isPartialPayment 
                            ? movements.find(m => m.id === movement.originalId)
                            : movement;
                          setSelectedMovement(originalMovement || movement);
                          setDetailSheetOpen(true);
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {movement.isPartialPayment && (
                              <div className="flex flex-col items-center justify-center w-5 h-5 rounded bg-gray-200 text-gray-600 text-xs font-medium flex-shrink-0">
                                {movement.paymentIndex}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900 line-clamp-2">{movement.productConcept}</span>
                              {movement.isPartialPayment && (
                                <span className="text-xs text-gray-500">
                                  Pago {movement.paymentIndex} de {movement.totalPayments}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">${formatCurrency(movement.total)}</span>
                            {!movement.isPartialPayment && movement.type === 'sale' && (
                              <span className={`text-xs font-medium ${movement.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                Ganancia: ${formatCurrency(movement.profit)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {paymentMethodLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-900">{formatDate(movement.date)}</span>
                            <span className="text-xs text-gray-500">{movement.time}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{movement.employee}</td>
                        <td className="px-4 py-3">
                          <Badge
                            className={`text-xs ${movementPaymentStatusBadgeClass(movement.status)}`}
                          >
                            {movementPaymentStatusLabel(movement.status)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden overflow-y-auto overflow-x-hidden flex-1 bg-gray-50 pb-20">
              {loading ? (
                <div className="p-2 space-y-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={`movements-mobile-skeleton-${idx}`} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))}
                </div>
              ) : filteredMovements.length === 0 ? (
                <div className="text-center py-12 mx-4 bg-white rounded-lg mt-4">
                  <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No hay movimientos</p>
                  <p className="text-sm text-gray-400">
                    {searchTerm || typeFilter !== 'all' || dateFilter !== 'all' || selectedPaymentMethods.length > 0 || selectedPaymentStatuses.length > 0
                      ? 'No se encontraron resultados'
                      : 'Los movimientos aparecerán aquí'}
                  </p>
                </div>
              ) : (
                <div className="p-1.5 sm:p-2 space-y-1.5 sm:space-y-2">
                  {(() => {
                    const renderedIds = new Set();
                    
                    return filteredMovements.map((movement, index) => {
                      // Skip if already rendered as part of a group
                      if (renderedIds.has(movement.id)) return null;
                      
                      const paymentMethodLabel = paymentMethodLabelForMovement(movement.paymentMethod);
                      
                      // Check if this is a partial payment
                      if (movement.isPartialPayment) {
                        // Find all related payments
                        const relatedPayments = filteredMovements.filter(m => 
                          m.isPartialPayment && 
                          m.originalId === movement.originalId &&
                          m.productConcept === movement.productConcept
                        );
                        
                        // Mark all as rendered
                        relatedPayments.forEach(p => renderedIds.add(p.id));
                        
                        // Calculate total paid
                        const totalPaid = relatedPayments.reduce((sum, p) => sum + p.total, 0);
                        
                        // Render grouped card
                        return (
                          <div 
                            key={`group-${movement.originalId || movement.id}`}
                            className="bg-white rounded-lg shadow-sm border border-gray-200"
                          >
                            {/* Header with title and total */}
                            <div className="p-2.5 sm:p-3 border-b border-gray-100">
                              <div className="flex items-start gap-2">
                                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                                  movement.type === 'sale' ? 'bg-teal-50' : 'bg-red-50'
                                }`}>
                                  {movement.type === 'sale' ? (
                                    <DollarSign className="w-4 h-4 text-teal-600" />
                                  ) : (
                                    <CreditCard className="w-4 h-4 text-red-600" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-gray-900 text-base leading-tight break-words">
                                    {movement.productConcept}
                                  </h3>
                                  <p className="text-sm text-gray-500 mt-0.5">
                                    {relatedPayments.length} pagos • Total: <span className="font-semibold text-gray-700">${formatCurrency(totalPaid)}</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            {/* List of payments */}
                            <div className="divide-y divide-gray-100">
                              {relatedPayments.map((payment, idx) => {
                                const payMethod = paymentMethodLabelForMovement(payment.paymentMethod);
                                return (
                                  <div
                                    key={payment.id}
                                    className="p-2.5 sm:p-3 active:bg-gray-50 transition-colors"
                                    onClick={() => {
                                      const originalMovement = movements.find(m => m.id === payment.originalId) || payment;
                                      setSelectedMovement(originalMovement);
                                      setDetailSheetOpen(true);
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-2 flex-1 min-w-0">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex-shrink-0">
                                          {payment.paymentIndex}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 text-sm text-gray-500 flex-wrap mb-1">
                                            <span className="flex-shrink-0">{payMethod}</span>
                                            <span className="flex-shrink-0">•</span>
                                            <span className="flex-shrink-0">{formatDate(payment.date)}</span>
                                            <span className="flex-shrink-0">-</span>
                                            <span className="flex-shrink-0">{payment.time}</span>
                                          </div>
                                          <Badge
                                            className={`text-sm h-6 ${movementPaymentStatusBadgeClass(payment.status)}`}
                                          >
                                            {movementPaymentStatusLabel(payment.status)}
                                          </Badge>
                                        </div>
                                      </div>
                                      <p className={`font-bold text-base flex-shrink-0 whitespace-nowrap ${
                                        payment.type === 'sale' ? 'text-teal-600' : 'text-red-600'
                                      }`}>
                                        ${formatCurrency(payment.total)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      
                      // Regular single movement (not partial payment)
                      renderedIds.add(movement.id);
                      
                      return (
                        <div 
                          key={movement.id} 
                          className="bg-white rounded-lg sm:p-2.5 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors p-[12px]"
                          onClick={() => {
                            const originalMovement = movement.isPartialPayment 
                              ? movements.find(m => m.id === movement.originalId)
                              : movement;
                            setSelectedMovement(originalMovement || movement);
                            setDetailSheetOpen(true);
                          }}
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            {/* Icon */}
                            <div className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center ${
                              movement.type === 'sale' ? 'bg-teal-50' : 'bg-red-50'
                            }`}>
                              {movement.type === 'sale' ? (
                                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
                              ) : (
                                <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Title and Amount Row */}
                              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1">
                                <h3 className="font-semibold text-gray-900 text-base sm:text-base leading-tight break-words line-clamp-2 col-start-1 row-start-1">
                                  {movement.productConcept}
                                </h3>
                                <p className={`font-bold text-base sm:text-base whitespace-nowrap col-start-2 row-start-1 self-start ${
                                  movement.type === 'sale' ? 'text-teal-600' : 'text-red-600'
                                }`}>
                                  ${formatCurrency(movement.total)}
                                </p>
                                {/* Details Row */}
                                <div className="col-start-1 row-start-2 flex items-center gap-1 sm:gap-1.5 text-sm sm:text-sm text-gray-500 flex-wrap min-w-0">
                                  <span className="flex-shrink-0">{paymentMethodLabel}</span>
                                  <span className="flex-shrink-0">•</span>
                                  <span className="flex-shrink-0">{formatDate(movement.date)}</span>
                                  <span className="flex-shrink-0">-</span>
                                  <span className="flex-shrink-0">{movement.time}</span>
                                </div>
                                <div className="col-start-2 row-start-2 self-end justify-self-end">
                                  <Badge
                                    className={`text-xs h-5 px-2 ${movementPaymentStatusBadgeClass(movement.status)}`}
                                  >
                                    {movementPaymentStatusLabel(movement.status)}
                                  </Badge>
                                </div>
                              </div>

                              {/* Status moved under amount (mobile compact) */}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

          </div>
        </Tabs>
      </div>

      {/* Filter Sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <SheetTitle className="text-xl font-bold">Filtros</SheetTitle>
                <SheetDescription className="sr-only">
                  Opciones de filtrado para movimientos
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFilterSheetOpen(false)}
                className="h-8 w-8 rounded-full flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>
          <div className="py-6 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
            {/* Payment Methods */}
            <div className="ml-[24px] mr-[0px] mt-[0px] mb-[24px]">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Métodos de pago</h3>
              <div className="flex flex-wrap gap-2">
                {paymentMethodsForFilter.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => togglePaymentMethod(method.id)}
                    className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                      selectedPaymentMethods.includes(method.id)
                        ? 'bg-teal-50 border-teal-500 text-teal-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Status */}
            <div className="ml-[24px] mr-[0px] mt-[0px] mb-[24px]">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Estado de pago</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => togglePaymentStatus('paid')}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                    selectedPaymentStatuses.includes('paid')
                      ? 'bg-teal-50 border-teal-500 text-teal-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  Pagado
                </button>
                <button
                  onClick={() => togglePaymentStatus('debt')}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                    selectedPaymentStatuses.includes('debt')
                      ? 'bg-teal-50 border-teal-500 text-teal-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  En deuda
                </button>
              </div>
            </div>

            {/* Employees */}
            <div className="mx-[24px] my-[0px]">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Empleados</h3>
              <button
                onClick={() => setShowEmployeeSelector(!showEmployeeSelector)}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-teal-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedEmployees.length === 0 
                      ? 'Seleccionar empleados' 
                      : `${selectedEmployees.length} seleccionado${selectedEmployees.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-gray-400" />
              </button>
              {showEmployeeSelector && (
                <div className="mt-2 space-y-2">
                  <Input
                    placeholder="Buscar empleado..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-300 focus:border-teal-500"
                  />
                  {employeesList
                    .filter(e => e.name.toLowerCase().includes(employeeSearch.toLowerCase()))
                    .map((employee) => (
                      <button
                        key={employee.id}
                        onClick={() => toggleEmployee(employee.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          selectedEmployees.includes(employee.id)
                            ? 'bg-teal-50 border border-teal-200' 
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                          employee.id === 'all' ? 'bg-gray-200 text-gray-600' : 'bg-teal-100 text-teal-700'
                        }`}>
                          {employee.initials}
                        </div>
                        <span className="text-sm font-medium text-gray-900 flex-1 text-left">{employee.name}</span>
                        {selectedEmployees.includes(employee.id) && (
                          <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Clients */}
            <div className="mx-[24px] my-[0px]">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Clientes</h3>
              <button
                onClick={() => setShowClientSelector(!showClientSelector)}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-teal-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedClients.length === 0 
                      ? 'Seleccionar clientes' 
                      : `${selectedClients.length} seleccionado${selectedClients.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-gray-400" />
              </button>
              {showClientSelector && (
                <div className="mt-2 space-y-2">
                  <Input
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-300 focus:border-teal-500"
                  />
                  {clientsList
                    .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                    .map((client) => (
                      <button
                        key={client.id}
                        onClick={() => toggleClient(client.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          selectedClients.includes(client.id)
                            ? 'bg-teal-50 border border-teal-200' 
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                          client.id === 'all' ? 'bg-gray-200 text-gray-600' : 'bg-teal-100 text-teal-700'
                        }`}>
                          {client.initials}
                        </div>
                        <span className="text-sm font-medium text-gray-900 flex-1 text-left">{client.name}</span>
                        {selectedClients.includes(client.id) && (
                          <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Suppliers */}
            <div className="mx-[24px] my-[0px]">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Proveedores</h3>
              <button
                onClick={() => setShowSupplierSelector(!showSupplierSelector)}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-teal-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedSuppliers.length === 0 
                      ? 'Seleccionar proveedores' 
                      : `${selectedSuppliers.length} seleccionado${selectedSuppliers.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-gray-400" />
              </button>
              {showSupplierSelector && (
                <div className="mt-2 space-y-2">
                  <Input
                    placeholder="Buscar proveedor..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-300 focus:border-teal-500"
                  />
                  {suppliersList
                    .filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
                    .map((supplier) => (
                      <button
                        key={supplier.id}
                        onClick={() => toggleSupplier(supplier.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          selectedSuppliers.includes(supplier.id)
                            ? 'bg-teal-50 border border-teal-200' 
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                          supplier.id === 'all' ? 'bg-gray-200 text-gray-600' : 'bg-teal-100 text-teal-700'
                        }`}>
                          {supplier.initials}
                        </div>
                        <span className="text-sm font-medium text-gray-900 flex-1 text-left">{supplier.name}</span>
                        {tempSelectedSuppliers.includes(supplier.id) && (
                          <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="border-t pt-4 flex-row gap-3">
            <Button 
              variant="ghost" 
              className="flex-1 text-gray-700" 
              onClick={clearFilters}
            >
              Limpiar filtros
            </Button>
            <Button 
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white" 
              onClick={applyFilters}
            >
              Filtrar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet */}
      {selectedMovement && (
        <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="border-b pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <SheetTitle className="text-lg font-bold">
                    {selectedMovement.productConcept 
                      ? `${selectedMovement.type === 'sale' ? 'Venta' : 'Gasto'}: ${selectedMovement.productConcept}`
                      : `${selectedMovement.type === 'sale' ? 'Venta' : 'Gasto'} #${selectedMovement.id}`}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Detalles del movimiento
                  </SheetDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDetailSheetOpen(false)}
                  className="h-8 w-8 rounded-full flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </SheetHeader>

            {/* Content */}
            <div className="py-6 mx-[24px] my-[0px]">
              {/* Total and Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-600 mb-1">Total</p>
                  <p className="text-2xl font-bold text-gray-900">${formatCurrency(selectedMovement.total)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-600 mb-1">Estado</p>
                  <Badge
                    className={`text-sm mt-1 ${movementPaymentStatusBadgeClass(selectedMovement.status)}`}
                  >
                    {movementPaymentStatusLabel(selectedMovement.status)}
                  </Badge>
                </div>
              </div>

              {/* Info Section */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Fecha y hora</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(selectedMovement.date)} {selectedMovement.time}</span>
                </div>

                {selectedMovement.paymentMethod === 'multiple' && selectedMovement.payments ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-semibold text-gray-900">Pagos múltiples ({selectedMovement.numPayments})</span>
                    </div>
                    <div className="space-y-2">
                      {selectedMovement.payments.map((payment: any, index: number) => {
                        const PaymentIcon = payment.method === 'cash' ? Banknote : 
                                           payment.method === 'card' ? CreditCard : 
                                           payment.method === 'transfer' ? ArrowLeft : 
                                           MoreHorizontal;
                        
                        return (
                          <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center flex-shrink-0">
                                <PaymentIcon className="w-4 h-4 text-gray-700" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{paymentMethodLabelForMovement(payment.method)}</p>
                                <p className="text-xs text-gray-500">Pago {index + 1} de {selectedMovement.numPayments}</p>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-gray-900">${formatCurrency(payment.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Método de pago</span>
                    <Badge variant="outline" className="text-xs">
                      {paymentMethodLabelForMovement(selectedMovement.paymentMethod)}
                    </Badge>
                  </div>
                )}

                {selectedMovement.type === 'sale' ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Cliente</span>
                      <span className="text-sm font-medium text-gray-900">{displayClientName(selectedMovement.client)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Empleado</span>
                      <span className="text-sm font-medium text-gray-900">{selectedMovement.employee}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Descuento</span>
                      <span className="text-sm font-medium text-gray-900">
                        {Number(selectedMovement.discount) > 0
                          ? `$${formatCurrency(Number(selectedMovement.discount))}`
                          : '-'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Ganancia</span>
                      <span className={`text-sm font-bold ${selectedMovement.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${formatCurrency(selectedMovement.profit)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Categoría</span>
                      <span className="text-sm font-medium text-gray-900">{selectedMovement.expenseCategory || 'N/A'}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Proveedor</span>
                      <span className="text-sm font-medium text-gray-900">{selectedMovement.supplier || 'N/A'}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Empleado</span>
                      <span className="text-sm font-medium text-gray-900">{selectedMovement.employee}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Products List */}
              {selectedMovement.type === 'sale' && selectedMovement.products && selectedMovement.products.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Productos ({selectedMovement.products.length})</h3>
                  <div className="space-y-2">
                    {selectedMovement.products.map((product: any) => {
                      const lineName =
                        (typeof product.name === 'string' && product.name.trim()) ||
                        (typeof product.productName === 'string' && product.productName.trim()) ||
                        'Producto';
                      return (
                        <div
                          key={product.id}
                          className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-3 items-center p-3 bg-gray-50 rounded-lg min-w-0"
                        >
                          {/*
                            Contenedor con tamaño fijo + fillParent evita que el wrapper empuje el grid y corrige escala en Safari.
                          */}
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded">
                            <LazyProductImage
                              fillParent
                              productId={product.product_id || product.id}
                              initialSrc={product.image}
                              alt={lineName}
                              className="h-full w-full object-cover object-center rounded"
                              eager
                            />
                          </div>
                          <div className="min-w-0 flex flex-col gap-0.5 justify-center text-left">
                            <p className="text-sm font-medium text-gray-900 leading-snug break-words line-clamp-2">
                              {lineName}
                            </p>
                            <p className="text-xs text-gray-600 tabular-nums">
                              Cant. {product.quantity}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 shrink-0 text-right pl-2 tabular-nums">
                            ${formatCurrency(product.price)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <SheetFooter className="sticky bottom-0 bg-white border-t pt-4 pb-2 flex-row gap-2 z-10">
              <Button variant="outline" size="icon" onClick={handlePrintReceipt}>
                <Receipt className="w-4 h-4" />
              </Button>
              
              {canEditMovement && (
                <Button variant="outline" className="flex-1" onClick={openEditSheet}>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}
              {canDeleteMovement && (
                <Button variant="destructive" className="flex-1" onClick={handleDeleteClick}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              )}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

      {/* Edit Sheet */}
      {selectedMovement && selectedMovement.type === 'expense' && (
        <ExpenseForm
          key={selectedMovement.id}
          open={editSheetOpen}
          onOpenChange={setEditSheetOpen}
          categories={expenseCategories}
          suppliers={[]}
          onSave={handleSaveEditedExpense}
          isEditMode={true}
          initialData={{
            date: selectedMovement.date,
            category: (selectedMovement as any).expenseCategory || selectedMovement.productConcept,
            name: (selectedMovement as any).expenseName || '',
            supplier: selectedMovement.supplier || '',
            amount: selectedMovement.total,
            paymentMethod:
              selectedMovement.paymentMethod === 'none'
                ? '-'
                : selectedMovement.paymentMethod === 'cash'
                  ? 'Efectivo'
                  : selectedMovement.paymentMethod === 'card'
                    ? 'Tarjeta'
                    : selectedMovement.paymentMethod === 'transfer'
                      ? 'Transferencia'
                      : 'Otros',
            status: selectedMovement.status === 'paid' ? 'pagada' : 'deuda',
          }}
        />
      )}

      {/* Edit Sheet - Sale */}
      {selectedMovement && selectedMovement.type === 'sale' && (
        <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col h-full overflow-x-hidden">
            {/* Header */}
            <SheetHeader className="px-2 sm:px-6 py-2 sm:py-4 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditSheetOpen(false)}
                  className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <SheetTitle className="text-base sm:text-xl">
                  Editar {selectedMovement.productConcept 
                    ? `${selectedMovement.type === 'sale' ? 'Venta' : 'Gasto'}: ${selectedMovement.productConcept}`
                    : `${selectedMovement.type === 'sale' ? 'Venta' : 'Gasto'} #${selectedMovement.id}`}
                </SheetTitle>
              </div>
              <SheetDescription className="sr-only">
                Formulario de edición de movimiento
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="p-2 sm:p-6 space-y-3 sm:space-y-6">
                {/* Status Toggle */}
                <div className="flex gap-2">
                  <Button
                    variant={editSaleStatus === 'paid' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEditSaleStatus('paid')}
                  >
                    Pagado
                  </Button>
                  <Button
                    variant={editSaleStatus === 'credit' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEditSaleStatus('credit')}
                  >
                    A crédito
                  </Button>
                </div>

                {/* Editar Productos - Clickable Section */}
                <button
                  onClick={handleEditProducts}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border-2 border-gray-200 hover:border-teal-500 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-teal-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">
                        {selectedMovement.products.length} producto{selectedMovement.products.length > 1 ? 's' : ''} seleccionado{selectedMovement.products.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-gray-600">
                        ${formatCurrency(selectedMovement.total)}
                      </p>
                    </div>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                </button>

                <Separator />

                {/* Sale Date */}
                <div className="space-y-2">
                  <Label className="text-sm">Fecha de la venta *</Label>
                  <Input
                    type="date"
                    value={editDate || ''}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* Client Selection */}
                <div className="space-y-2">
                  <Label className="text-sm">Cliente</Label>
                  {editSelectedClient ? (
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{editSelectedClient.name}</p>
                        {editSelectedClient.phone && (
                          <p className="text-sm text-gray-500">{editSelectedClient.phone}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditSelectedClient(null)}
                      >
                        Cambiar
                      </Button>
                    </div>
                  ) : (
                    <Dialog open={editClientDialogOpen} onOpenChange={setEditClientDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          Selecciona un cliente
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Seleccionar Cliente</DialogTitle>
                          <DialogDescription>Elige un cliente de la lista o crea uno nuevo.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 mt-4">
                          {mockClients.map((client) => (
                            <button
                              key={client.id}
                              onClick={() => {
                                setEditSelectedClient(client);
                                setEditClientDialogOpen(false);
                              }}
                              className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <p className="font-medium">{client.name}</p>
                              {client.phone && (
                                <p className="text-sm text-gray-500">{client.phone}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {/* Employee Selection */}
                <div className="space-y-2">
                  <Label className="text-sm">Vendedor *</Label>
                  {editSelectedEmployee ? (
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{editSelectedEmployee.name}</p>
                        {editSelectedEmployee.role && (
                          <p className="text-sm text-gray-500">{editSelectedEmployee.role}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditSelectedEmployee(null)}
                      >
                        Cambiar
                      </Button>
                    </div>
                  ) : (
                    <Dialog open={editEmployeeDialogOpen} onOpenChange={setEditEmployeeDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          Selecciona un vendedor
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Seleccionar Vendedor</DialogTitle>
                          <DialogDescription>Elige un vendedor de la lista.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 mt-4">
                          {employees.map((employee) => (
                            <button
                              key={employee.id}
                              onClick={() => {
                                setEditSelectedEmployee(employee);
                                setEditEmployeeDialogOpen(false);
                              }}
                              className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <p className="font-medium">{employee.name}</p>
                              {employee.role && (
                                <p className="text-sm text-gray-500">{employee.role}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                <Separator />

                {/* Discount Section */}
                {!editDiscountActive ? (
                  <button
                    onClick={() => setEditDiscountActive(true)}
                    className="flex items-center gap-2 text-gray-900 hover:text-gray-700 transition-colors"
                  >
                    <Percent className="w-5 h-5" />
                    <span className="font-medium underline">Agregar un descuento</span>
                  </button>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">Descuento</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-gray-300 hover:bg-gray-400"
                        onClick={() => {
                          setEditDiscountActive(false);
                          setEditDiscountPercent('0');
                          setEditDiscountAmount('0');
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          value={editDiscountPercent || '0'}
                          onChange={(e) => handleEditDiscountPercentChange(e.target.value)}
                          className="pr-8 h-12 text-base"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={editDiscountAmount || '0'}
                          onChange={(e) => handleEditDiscountAmountChange(e.target.value)}
                          className="pl-7 h-12 text-base"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Number of Payments */}
                <div className="space-y-3">
                  <Label className="text-xs sm:text-sm break-words leading-tight">Selecciona el número de pagos que realizarás y el método de pago*</Label>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <Button
                        key={num}
                        variant={editNumPayments === num ? 'default' : 'outline'}
                        className="w-10 h-10 sm:w-12 sm:h-12 text-sm"
                        onClick={() => handleEditNumPaymentsChange(num)}
                      >
                        {num}
                      </Button>
                    ))}
                    <Button
                      variant={editNumPayments === 0 ? 'default' : 'outline'}
                      className="px-3 h-10 sm:px-4 sm:h-12 text-sm"
                      onClick={() => handleEditNumPaymentsChange(0)}
                    >
                      Otro
                    </Button>
                  </div>
                </div>

                {/* Single Payment Method Selection */}
                {editNumPayments === 1 && (
                  <div className="space-y-3">
                    <Label className="text-xs sm:text-sm">Selecciona el método de pago*</Label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <Button
                        variant={editSinglePaymentMethod === 'Efectivo' ? 'default' : 'outline'}
                        className="h-24 flex flex-col gap-2 relative"
                        onClick={() => setEditSinglePaymentMethod('Efectivo')}
                      >
                        {editSinglePaymentMethod === 'Efectivo' && (
                          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <Banknote className="w-8 h-8" />
                        <span className="text-sm">Efectivo</span>
                      </Button>
                      <Button
                        variant={editSinglePaymentMethod === 'Tarjeta' ? 'default' : 'outline'}
                        className="h-24 flex flex-col gap-2 relative"
                        onClick={() => setEditSinglePaymentMethod('Tarjeta')}
                      >
                        {editSinglePaymentMethod === 'Tarjeta' && (
                          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <CreditCard className="w-8 h-8" />
                        <span className="text-sm">Tarjeta</span>
                      </Button>
                      <Button
                        variant={editSinglePaymentMethod === 'Transferencia' ? 'default' : 'outline'}
                        className="h-24 flex flex-col gap-2 relative"
                        onClick={() => setEditSinglePaymentMethod('Transferencia')}
                      >
                        {editSinglePaymentMethod === 'Transferencia' && (
                          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <Building2 className="w-8 h-8" />
                        <span className="text-sm">Transferencia</span>
                      </Button>
                      <Button
                        variant={editSinglePaymentMethod === 'Otros' ? 'default' : 'outline'}
                        className="h-24 flex flex-col gap-2 relative"
                        onClick={() => setEditSinglePaymentMethod('Otros')}
                      >
                        {editSinglePaymentMethod === 'Otros' && (
                          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <MoreHorizontal className="w-8 h-8" />
                        <span className="text-sm">Otros</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Multiple Payment Fields */}
                {editNumPayments > 1 && (
                  <div className="space-y-4">
                    {editPayments.map((field) => (
                      <div key={field.id} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Monto a pagar</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                value={field.amount || ''}
                                onChange={(e) => updateEditPaymentField(field.id, 'amount', e.target.value)}
                                className="pl-7 text-base"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Método de pago</Label>
                            <Select
                              value={field.method || 'Efectivo'}
                              onValueChange={(value: any) => updateEditPaymentField(field.id, 'method', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Efectivo">Efectivo</SelectItem>
                                <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                                <SelectItem value="Transferencia">Transferencia</SelectItem>
                                <SelectItem value="Otros">Otros</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment Validation - Only for multiple payments */}
                {editNumPayments > 1 && editPayments.length > 0 && (
                  <div className={`p-4 rounded-lg border-2 flex items-center gap-3 ${
                    editPaymentsMatchTotal() 
                      ? 'bg-green-50 border-green-300' 
                      : 'bg-yellow-50 border-yellow-300'
                  }`}>
                    {editPaymentsMatchTotal() && (
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                    <p className={`text-sm font-medium ${
                      editPaymentsMatchTotal() ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {editPaymentsMatchTotal() 
                        ? `Los pagos suman el total de la orden: $${formatCurrency(getEditTotalWithDiscount())}`
                        : `Los pagos ($${formatCurrency(getEditTotalPayments())}) no suman el total: $${formatCurrency(getEditTotalWithDiscount())}`
                      }
                    </p>
                  </div>
                )}

                <Separator />

                {/* Payment Details - Collapsible */}
                <Collapsible open={editPaymentDetailsOpen} onOpenChange={setEditPaymentDetailsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto font-semibold">
                      Detalle del pago
                      {editPaymentDetailsOpen ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-3">
                    {/* Receipt Note */}
                    <div className="space-y-2">
                      <Label>Nota del comprobante</Label>
                      <Textarea
                        placeholder="Agregar nota..."
                        value={editReceiptNote}
                        onChange={(e) => setEditReceiptNote(e.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 sm:p-6 border-t bg-white flex-shrink-0">
              <Button 
                onClick={saveEdit}
                size="lg"
                disabled={savingEdit}
                className="w-full h-14 sm:h-[60px] text-base sm:text-lg font-semibold bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                    <span className="text-base sm:text-lg font-medium">Guardando...</span>
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-base sm:text-lg font-medium">{editNumPayments}</span>
                    <span className="text-base sm:text-lg font-medium">Guardar cambios</span>
                    <div className="flex items-center gap-2">
                      <span className="text-base sm:text-lg font-bold">${formatCurrency(getEditTotalWithDiscount())}</span>
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Confirmar Eliminación
            </DialogTitle>
            <DialogDescription className="pt-4">
              ¿Estás seguro de que deseas eliminar este movimiento?
            </DialogDescription>
          </DialogHeader>
          
          {movementToDelete && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tipo:</span>
                <Badge variant={movementToDelete.type === 'sale' ? 'default' : 'destructive'}>
                  {movementToDelete.type === 'sale' ? 'Venta' : 'Gasto'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Concepto:</span>
                <span className="text-sm font-medium text-gray-900">{movementToDelete.productConcept}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Monto:</span>
                <span className="text-sm font-bold text-gray-900">${formatCurrency(movementToDelete.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Fecha:</span>
                <span className="text-sm text-gray-900">{formatDate(movementToDelete.date)} {movementToDelete.time}</span>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold">!</span>
            </div>
            <p className="text-sm text-amber-800">
              Esta acción no se puede deshacer. El movimiento será eliminado permanentemente.
            </p>
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={confirmDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Date Period Selector Sheet */}
      <Sheet open={datePeriodSheetOpen} onOpenChange={setDatePeriodSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-3xl">
          <SheetHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <SheetTitle className="text-lg font-semibold text-center">Seleccionar período</SheetTitle>
                <SheetDescription className="sr-only">
                  Selecciona el tipo de período para filtrar los movimientos
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDatePeriodSheetOpen(false)}
                className="h-8 w-8 rounded-full flex-shrink-0 absolute top-4 right-4"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>
          
          <div className="py-2 mx-[24px] my-[0px]">
            {/* Daily Option */}
            <button
              onClick={() => {
                setDateFilter('daily');
                setDatePeriodSheetOpen(false);
              }}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                dateFilter === 'daily' 
                  ? 'border-teal-500 bg-teal-50' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="font-medium text-gray-900">Diario</span>
              {dateFilter === 'daily' && <Check className="w-5 h-5 text-teal-600" />}
            </button>

            {/* Weekly Option */}
            <button
              onClick={() => {
                setDateFilter('weekly');
                setDatePeriodSheetOpen(false);
              }}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                dateFilter === 'weekly' 
                  ? 'border-teal-500 bg-teal-50' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="font-medium text-gray-900">Semanal</span>
              {dateFilter === 'weekly' && <Check className="w-5 h-5 text-teal-600" />}
            </button>

            {/* Monthly Option */}
            <button
              onClick={() => {
                setDateFilter('monthly');
                setDatePeriodSheetOpen(false);
              }}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                dateFilter === 'monthly' 
                  ? 'border-teal-500 bg-teal-50' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="font-medium text-gray-900">Mensual</span>
              {dateFilter === 'monthly' && <Check className="w-5 h-5 text-teal-600" />}
            </button>

            {/* Yearly Option */}
            <button
              onClick={() => {
                setDateFilter('yearly');
                setDatePeriodSheetOpen(false);
              }}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                dateFilter === 'yearly' 
                  ? 'border-teal-500 bg-teal-50' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="font-medium text-gray-900">Anual</span>
              {dateFilter === 'yearly' && <Check className="w-5 h-5 text-teal-600" />}
            </button>

            {/* Custom Range Option */}
            <button
              onClick={() => {
                // Initialize temp dates with current weekStart/weekEnd
                setTempCustomStart(weekStart);
                setTempCustomEnd(weekEnd);
                // Close filter sheet and open custom range sheet
                setDatePeriodSheetOpen(false);
                setCustomRangeSheetOpen(true);
              }}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                dateFilter === 'custom' 
                  ? 'border-teal-500 bg-teal-50' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="font-medium text-gray-900">Rango personalizado</span>
              {dateFilter === 'custom' && <Check className="w-5 h-5 text-teal-600" />}
            </button>

          </div>
        </SheetContent>
      </Sheet>

      {/* Custom Range Sheet - Separate screen for selecting date range */}
      <Sheet open={customRangeSheetOpen} onOpenChange={setCustomRangeSheetOpen}>
        <SheetContent side="bottom" className="h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col">
          <SheetHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCustomRangeSheetOpen(false);
                  setDatePeriodSheetOpen(true);
                }}
                className="p-1 h-auto"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <SheetTitle>Rango personalizado</SheetTitle>
            </div>
            <SheetDescription>
              Selecciona el rango de fechas que deseas filtrar
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4">
            <div className="w-full sm:max-w-md sm:mx-auto px-3 sm:px-0">
              <DateCalendar
                mode="range"
                selected={{ from: tempCustomStart, to: tempCustomEnd }}
                onSelect={(range: any) => {
                  if (range?.from) setTempCustomStart(range.from);
                  if (range?.to) setTempCustomEnd(range.to);
                }}
              />
            </div>
          </div>

          <SheetFooter className="flex-row gap-2 pt-4 border-t">
            <div className="w-full max-w-md mx-auto flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCustomRangeSheetOpen(false);
                  setDatePeriodSheetOpen(true);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  // Apply the custom range
                  setWeekStart(tempCustomStart);
                  setWeekEnd(tempCustomEnd);
                  setDateFilter('custom');
                  setCustomRangeSheetOpen(false);
                  toast.success('Rango personalizado aplicado');
                }}
                className="flex-1 bg-teal-500 hover:bg-teal-600"
              >
                Aplicar
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Reports Sheet */}
      <ReportsSheet
        open={reportsSheetOpen}
        onOpenChange={setReportsSheetOpen}
        data={reportsData}
        filterLabel={getFilterLabel()}
      />

      {/* Receipt Preview Modal */}
      <ReceiptPreviewModal
        open={receiptModalOpen}
        onOpenChange={(open) => {
          setReceiptModalOpen(open);
          // Limpiar URL cuando se cierra el modal
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
      />
      </>
      )}
    </div>
  );
}