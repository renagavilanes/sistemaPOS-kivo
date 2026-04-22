import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, Plus, Edit2, Trash2, Grid3x3, X, Upload, Download, ArrowUpDown, Building2, Check, ChevronDown, PackageOpen, Loader2, DollarSign, ClipboardList, FileSpreadsheet } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import { Skeleton } from '../components/ui/skeleton';
import { BusinessSelectorModal } from '../components/BusinessSelectorModal';
import { PageHeader } from '../components/layout/PageHeader';
import { Product } from '../types';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { useScreenFx } from '../contexts/ScreenFxContext';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { LazyProductImage } from '../components/LazyProductImage';
import { exportProductsToExcel } from '../utils/productExcelExport';
import { getProducts, createProduct, updateProduct, deleteProduct, initializeDemoProducts } from '../lib/api';
import * as apiService from '../services/api';
import { useBusiness } from '../contexts/BusinessContext';
import { formatCurrency } from '../utils/currency';
import {
  dataTableTheadSticky,
  dthLeft,
  dthRight,
  dthRightTight,
} from '../lib/dataTableHeaderClasses';
// REMOVIDO: import { useData } from '../contexts/DataContext';

// v1.0.2 - Database integration

// Función auxiliar para normalizar texto (remover tildes)
const normalizeText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

const loadImageElement = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar la imagen seleccionada.'));
    };
    img.src = objectUrl;
  });

const optimizeImageForProduct = async (file: File): Promise<string> => {
  // Mantiene buena calidad para futuro catálogo y mejora peso para POS.
  const MAX_DIMENSION = 1280;
  const QUALITY = 0.82;

  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo seleccionado no es una imagen.');
  }

  const img = await loadImageElement(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('No se pudo generar la imagen optimizada.'))),
      'image/webp',
      QUALITY,
    );
  });

  const optimizedFile = new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' });
  return fileToDataUrl(optimizedFile);
};

export default function ProductsPage() {
  const { triggerInkDouble } = useScreenFx();
  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<string | null>(null);
  const [tempSortOption, setTempSortOption] = useState<string | null>(null);
  const [sortDialogOpen, setSortDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false); // ✅ Nuevo estado para modal de categorías

  // Category input states
  const [newCategoryName, setNewCategoryName] = useState('');

  // Form states
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCost, setProductCost] = useState('');
  const [productStock, setProductStock] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productImage, setProductImage] = useState('');
  const [imageProcessing, setImageProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  const { currentBusiness, businesses, switchBusiness } = useBusiness();
  const navigate = useNavigate();
  const [productsLoading, setProductsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [pendingImportRows, setPendingImportRows] = useState<Array<{
    rowNumber: number;
    name: string;
    price: number;
    cost: number;
    stock: number;
    category: string;
  }> | null>(null);
  const [duplicateNames, setDuplicateNames] = useState<string[]>([]);
  const [duplicateSummary, setDuplicateSummary] = useState<{ inFile: number; existing: number }>({ inFile: 0, existing: 0 });

  const downloadImportTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Productos');
      ws.columns = [
        { header: 'Nombre', key: 'name', width: 30 },
        { header: 'Precio', key: 'price', width: 12 },
        { header: 'Costo', key: 'cost', width: 12 },
        { header: 'Stock', key: 'stock', width: 10 },
        { header: 'Categoría', key: 'category', width: 18 },
      ];
      ws.getRow(1).font = { bold: true };
      ws.addRow({ name: 'Ej: Café Americano', price: 3500, cost: 1200, stock: 100, category: 'Bebidas' });
      ws.addRow({ name: 'Ej: Croissant', price: 4000, cost: 1800, stock: 50, category: 'Panadería' });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Plantilla_Productos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error descargando plantilla:', e);
      toast.error('No se pudo descargar la plantilla');
    }
  };

  const normalizeHeader = (h: unknown) =>
    String(h ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const handleImportExcelFile = async (file: File) => {
    if (!currentBusiness?.id) {
      toast.error('No hay negocio seleccionado');
      return;
    }
    setImporting(true);
    try {
      const ab = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(ab);
      const ws = workbook.worksheets[0];
      if (!ws) throw new Error('El Excel no tiene hojas');

      const headerRow = ws.getRow(1);
      const headerToCol: Record<string, number> = {};
      headerRow.eachCell((cell, colNumber) => {
        const key = normalizeHeader(cell.value as any);
        if (key) headerToCol[key] = colNumber;
      });

      const col = (names: string[]) => {
        for (const n of names) {
          const c = headerToCol[normalizeHeader(n)];
          if (c) return c;
        }
        return 0;
      };

      const cName = col(['Nombre', 'Producto', 'name']);
      const cPrice = col(['Precio', 'price']);
      const cCost = col(['Costo', 'cost']);
      const cStock = col(['Stock', 'Cantidad', 'Inventario', 'stock']);
      const cCategory = col(['Categoría', 'Categoria', 'category']);

      if (!cName || !cPrice || !cCost || !cStock) {
        throw new Error('La plantilla debe tener columnas: Nombre, Precio, Costo, Stock (Categoría es opcional).');
      }

      const rows: Array<{
        rowNumber: number;
        name: string;
        price: number;
        cost: number;
        stock: number;
        category: string;
      }> = [];
      const errors: string[] = [];

      // Procesar desde la fila 2
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const name = String(row.getCell(cName).value ?? '').trim();
        const price = Number(row.getCell(cPrice).value ?? NaN);
        const cost = Number(row.getCell(cCost).value ?? NaN);
        const stock = Number(row.getCell(cStock).value ?? NaN);
        const category = cCategory ? String(row.getCell(cCategory).value ?? '').trim() : '';

        // Saltar filas vacías
        if (!name && !row.hasValues) continue;

        if (!name || !Number.isFinite(price) || !Number.isFinite(cost) || !Number.isFinite(stock)) {
          errors.push(`Fila ${r}: datos inválidos (Nombre/Precio/Costo/Stock).`);
          continue;
        }

        rows.push({
          rowNumber: r,
          name,
          price,
          cost,
          stock: Math.max(0, Math.floor(stock)),
          category: category || 'Sin categoría',
        });
      }

      if (errors.length) {
        console.warn('Errores importación (validación):', errors);
        toast.error(`El archivo tiene ${errors.length} filas inválidas (ver consola).`);
        return;
      }

      // Detectar duplicados: en archivo y contra inventario actual (por nombre normalizado)
      const normalizeName = (s: string) => normalizeText(String(s || '').trim());
      const seen = new Map<string, number>();
      const dupInFile = new Set<string>();
      for (const rr of rows) {
        const k = normalizeName(rr.name);
        const n = (seen.get(k) || 0) + 1;
        seen.set(k, n);
        if (n > 1) dupInFile.add(rr.name);
      }

      const existingByKey = new Map<string, Product>();
      products.forEach((p) => existingByKey.set(normalizeName(p.name), p));
      const dupExisting = new Set<string>();
      for (const rr of rows) {
        if (existingByKey.has(normalizeName(rr.name))) dupExisting.add(rr.name);
      }

      const dupNames = Array.from(new Set([...Array.from(dupInFile), ...Array.from(dupExisting)])).slice(0, 20);

      if (dupInFile.size || dupExisting.size) {
        setPendingImportRows(rows);
        setDuplicateNames(dupNames);
        setDuplicateSummary({ inFile: dupInFile.size, existing: dupExisting.size });
        setDuplicateDialogOpen(true);
        return;
      }

      // No hay duplicados → importar directo creando
      let ok = 0;
      let failed = 0;
      const importErrors: string[] = [];
      for (const rr of rows) {
        try {
          await apiService.createProduct(currentBusiness.id, {
            name: rr.name,
            price: rr.price,
            cost: rr.cost,
            stock: rr.stock,
            category: rr.category,
            image: '',
          } as any);
          ok++;
        } catch (e: any) {
          failed++;
          importErrors.push(`Fila ${rr.rowNumber}: ${e?.message || 'error creando producto'}`);
        }
      }

      await reloadProducts();
      window.dispatchEvent(new Event('productsUpdated'));

      if (failed === 0) toast.success(`Importación masiva lista: ${ok} productos`);
      else {
        console.warn('Errores importación:', importErrors);
        toast.error(`Importación masiva: ${ok} ok, ${failed} con error (ver consola)`);
      }
    } catch (e: any) {
      console.error('Error importando Excel:', e);
      toast.error(e?.message || 'No se pudo importar el Excel');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const runImportWithDuplicatePolicy = async (policy: 'keep' | 'replace') => {
    if (!currentBusiness?.id || !pendingImportRows) return;
    setImporting(true);
    try {
      const normalizeName = (s: string) => normalizeText(String(s || '').trim());
      const existingByKey = new Map<string, Product>();
      products.forEach((p) => existingByKey.set(normalizeName(p.name), p));

      let ok = 0;
      let updated = 0;
      let failed = 0;
      const importErrors: string[] = [];

      for (const rr of pendingImportRows) {
        try {
          const existing = existingByKey.get(normalizeName(rr.name));
          if (policy === 'replace' && existing) {
            await apiService.updateProduct(existing.id, currentBusiness.id, {
              name: existing.name, // mantener nombre original
              price: rr.price,
              cost: rr.cost,
              stock: rr.stock,
              category: rr.category,
            } as any);
            updated++;
          } else {
            await apiService.createProduct(currentBusiness.id, {
              name: rr.name,
              price: rr.price,
              cost: rr.cost,
              stock: rr.stock,
              category: rr.category,
              image: '',
            } as any);
            ok++;
          }
        } catch (e: any) {
          failed++;
          importErrors.push(`Fila ${rr.rowNumber}: ${e?.message || 'error importando producto'}`);
        }
      }

      await reloadProducts();
      window.dispatchEvent(new Event('productsUpdated'));

      if (failed === 0) {
        toast.success(policy === 'replace'
          ? `Importación lista: ${ok} creados, ${updated} reemplazados`
          : `Importación lista: ${ok} productos`);
      } else {
        console.warn('Errores importación:', importErrors);
        toast.error(`Importación: ${ok} creados, ${updated} reemplazados, ${failed} con error (ver consola)`);
      }
    } finally {
      setImporting(false);
      setDuplicateDialogOpen(false);
      setPendingImportRows(null);
      setDuplicateNames([]);
      setDuplicateSummary({ inFile: 0, existing: 0 });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Business selector modal state
  const [businessModalOpen, setBusinessModalOpen] = useState(false);

  // ✅ Categorías: combina las de BD con las derivadas de productos cargados.
  // Garantiza que empleados (bloqueados por RLS en tabla categories) vean
  // las categorías que ya existen en sus productos.
  const categoriesFromProducts = [...new Set(
    products.map(p => p.category).filter(c => c && c !== 'Sin categoría')
  )];
  const allCategories = [...new Set([...customCategories, ...categoriesFromProducts])].sort();
  
  // ✅ CARGAR categorías desde Supabase al iniciar
  useEffect(() => {
    if (!currentBusiness) return;
    
    const loadCategories = async () => {
      try {
        const categories = await apiService.getCategories(currentBusiness.id);
        const categoryNames = categories.map(c => c.name);
        console.log('📂 [LOAD] Categorías cargadas desde Supabase:', categoryNames);
        setCustomCategories(categoryNames);
      } catch (error) {
        console.error('❌ Error al cargar categorías:', error);
        setCustomCategories([]);
      }
    };
    
    loadCategories();
  }, [currentBusiness?.id]); // Solo ejecutar cuando cambia el negocio

  // Escuchar cambios de negocio
  useEffect(() => {
    const handleBusinessChange = () => {
      console.log('🔄 Negocio cambió, recargando categorías...');
      if (currentBusiness) {
        apiService.getCategories(currentBusiness.id).then(categories => {
          const categoryNames = categories.map(c => c.name);
          setCustomCategories(categoryNames);
        }).catch(error => {
          console.error('Error recargando categorías:', error);
        });
      }
    };

    window.addEventListener('businessChanged', handleBusinessChange);
    return () => window.removeEventListener('businessChanged', handleBusinessChange);
  }, [currentBusiness]);

  // Calculations
  const totalReferences = products.length;
  const totalInventoryCost = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);

  // Filtered products
  const filteredProducts = products.filter(product => {
    const matchesSearch = normalizeText(product.name).includes(normalizeText(searchTerm));
    const matchesCategory = selectedCategory === 'Todas' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });


  // Sorted products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortOption) {
      // Default sort by name ascending
      return a.name.localeCompare(b.name);
    }

    switch (sortOption) {
      case 'stock-low':
        return a.stock - b.stock;
      case 'stock-high':
        return b.stock - a.stock;
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'date-old':
        return a.id.localeCompare(b.id); // Using ID as proxy for creation date
      case 'date-new':
        return b.id.localeCompare(a.id);
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'sales-low':
      case 'sales-high':
        // These would require sales data - for now, default to name
        return a.name.localeCompare(b.name);
      default:
        return a.name.localeCompare(b.name);
    }
  });

  // El pedido a proveedor ahora vive en /purchase-order (página completa)

  // Handle create/edit product
  const handleSaveProduct = async () => {
    if (!productName || !productPrice || !productCost || !productStock) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    const price = parseFloat(productPrice);
    const cost = parseFloat(productCost);
    const stock = parseInt(productStock);

    if (isNaN(price) || isNaN(cost) || isNaN(stock)) {
      toast.error('Por favor ingresa valores numéricos válidos');
      return;
    }

    if (!currentBusiness) {
      toast.error('No hay un negocio seleccionado');
      return;
    }

    try {
      setLoading(true);

      if (editingProduct) {
        // Update existing product
        console.log('🖼️ Actualizando producto con imagen:', productImage || editingProduct.image);
        
        const result = await updateProduct(editingProduct.id, {
          name: productName,
          price,
          cost,
          stock,
          category: productCategory || editingProduct.category,
          image: productImage || editingProduct.image,
        });

        if (result.success) {
          // Reload products
          await reloadProducts();
          
          // Dispatch custom event to notify other components
          window.dispatchEvent(new Event('productsUpdated'));
          
          toast.success('Producto actualizado correctamente');
        }
      } else {
        // Create new product
        const result = await createProduct({
          name: productName,
          price,
          cost,
          stock,
          category: productCategory || 'Sin categoría',
          image: productImage || '',
        });

        if (result.success) {
          // Reload products
          await reloadProducts();
          
          // Dispatch custom event to notify other components
          window.dispatchEvent(new Event('productsUpdated'));
          
          triggerInkDouble();
          toast.success('Producto creado correctamente');
        }
      }

      resetForm();
      setCreateSheetOpen(false);
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(error.message || 'Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = async (product: Product) => {
    if (!currentBusiness?.id) return;
    setCreateSheetOpen(true);
    setEditingProduct(product);
    setProductName(product.name);
    setProductPrice(product.price.toString());
    setProductCost(product.cost.toString());
    setProductStock(product.stock.toString());
    setProductCategory(product.category);
    setProductImage(product.image || '');
    try {
      const full = await apiService.getProductById(currentBusiness.id, product.id);
      setEditingProduct(full);
      setProductName(full.name);
      setProductPrice(full.price.toString());
      setProductCost(full.cost.toString());
      setProductStock(full.stock.toString());
      setProductCategory(full.category);
      setProductImage(full.image || '');
    } catch (e) {
      console.warn('No se pudo cargar el producto completo; usando datos del listado.', e);
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (productToDelete) {
      try {
        // Delete from database
        await deleteProduct(productToDelete.id);
        
        // Reload products
        await reloadProducts();
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('productsUpdated'));
        
        toast.success('Producto eliminado correctamente');
        setProductToDelete(null);
        setDeleteDialogOpen(false);
      } catch (error: any) {
        console.error('Error deleting product:', error);
        toast.error(error.message || 'Error al eliminar el producto');
      }
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setProductName('');
    setProductPrice('');
    setProductCost('');
    setProductStock('');
    setProductCategory('');
    setProductImage('');
  };

  const handleExport = async () => {
    const success = await exportProductsToExcel(sortedProducts, {
      searchTerm,
      category: selectedCategory,
      sortOption: `${sortOption}`
    });
    if (success) {
      toast.success('Excel exportado correctamente');
    } else {
      toast.error('Error al exportar a Excel');
    }
  };

  // ✅ Función para agregar categoría
  const handleAddCategory = async () => {
    console.log('🚨 [ADD CATEGORY] ========================================');
    console.log('🚨 [ADD CATEGORY] FUNCIÓN EJECUTADA');
    console.log('📝 Valor ingresado RAW:', `"${newCategoryName}"`);
    const value = newCategoryName.trim();
    console.log('📝 Valor después de trim:', `"${value}"`);
    console.log('📋 customCategories ANTES:', JSON.stringify(customCategories));
    console.log('🏢 currentBusiness:', currentBusiness?.id);
    
    if (!value) {
      console.log('❌ Valor vacío - ABORTANDO');
      toast.error('Escribe el nombre de la categoría');
      return;
    }
    
    if (allCategories.includes(value)) {
      console.log('❌ Categoría ya existe - ABORTANDO');
      toast.error('Esta categoría ya existe');
      return;
    }

    if (!currentBusiness) {
      toast.error('No hay negocio seleccionado');
      return;
    }
    
    console.log('✅ VALIDACIONES PASADAS - Creando categoría en Supabase');
    try {
      await apiService.createCategory(currentBusiness.id, { name: value });
      const newCategories = [value, ...customCategories];
      console.log('📦 Nuevo array:', JSON.stringify(newCategories));
      setCustomCategories(newCategories);
      setNewCategoryName('');
      toast.success('Categoría agregada');
      console.log('🚨 [ADD CATEGORY] ======================================== FIN');
    } catch (error) {
      console.error('Error creando categoría:', error);
      toast.error('Error al crear la categoría');
    }
  };

  // ✅ Función para eliminar categoría
  const handleDeleteCategory = async (category: string) => {
    console.log('🗑️ Eliminando categoría:', category);
    
    if (!currentBusiness) {
      toast.error('No hay negocio seleccionado');
      return;
    }

    try {
      // Buscar la categoría por nombre para obtener su ID
      const categories = await apiService.getCategories(currentBusiness.id);
      const categoryToDelete = categories.find(c => c.name === category);
      
      if (categoryToDelete) {
        await apiService.deleteCategory(categoryToDelete.id, currentBusiness.id);
      }
      
      const filtered = customCategories.filter(c => c !== category);
      console.log('📋 Nuevas categorías:', filtered);
      setCustomCategories(filtered);
      toast.success('Categoría eliminada');
    } catch (error) {
      console.error('Error eliminando categoría:', error);
      toast.error('Error al eliminar la categoría');
    }
  };

  // Function to reload products
  const reloadProducts = async () => {
    if (!currentBusiness?.id) return;
    
    setProductsLoading(true);
    try {
      const productsData = await apiService.getProducts(currentBusiness.id);
      
      const mappedProducts = productsData.map((p: any) => {
        let cleanImage = p.image || '';
        if (cleanImage && (
          cleanImage.includes('photo-1670225597315-782633cfbd2a') ||
          cleanImage.includes('unsplash.com') && cleanImage.length > 100
        )) {
          cleanImage = '';
        }
        
        return {
          id: p.id,
          name: p.name,
          price: p.price,
          cost: p.cost,
          stock: p.stock,
          category: p.category || 'Sin categoría',
          image: cleanImage,
        };
      });
      setProducts(mappedProducts);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setProductsLoading(false);
    }
  };

  // Load products when business changes
  useEffect(() => {
    if (!currentBusiness?.id) return;

    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const productsData = await apiService.getProducts(currentBusiness.id);
        
        const mappedProducts = productsData.map((p: any) => {
          // 🧹 Limpiar URLs de imágenes inválidas o problemáticas
          let cleanImage = p.image || '';
          
          // Si la URL contiene ciertos patterns problemáticos, limpiarla
          if (cleanImage && (
            cleanImage.includes('photo-1670225597315-782633cfbd2a') || // URL placeholder antigua
            cleanImage.includes('unsplash.com') && cleanImage.length > 100 // URLs de Unsplash muy largas que suelen fallar
          )) {
            console.log('🧹 Limpiando URL de imagen problemática:', cleanImage);
            cleanImage = '';
          }
          
          return {
            id: p.id,
            name: p.name,
            price: p.price,
            cost: p.cost,
            stock: p.stock,
            category: p.category || 'Sin categoría',
            image: cleanImage,
          };
        });
        setProducts(mappedProducts);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();

    // Escuchar evento de cambio de negocio
    const handleBusinessChanged = () => {
      console.log('🔄 Evento businessChanged recibido - recargando productos');
      loadProducts();
    };
    
    window.addEventListener('businessChanged', handleBusinessChanged);
    
    return () => {
      window.removeEventListener('businessChanged', handleBusinessChanged);
    };
  }, [currentBusiness?.id]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <PageHeader
        desktop={
          <div className="bg-white border-b px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventario</h1>
                <div className="flex flex-wrap gap-4 mt-1.5 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <span>Total de referencias:</span>
                    <span className="font-semibold text-gray-900">{totalReferences}</span>
                  </div>
                  <span className="text-gray-300">|</span>
                  <div className="flex items-center gap-1.5">
                    <span>Costo de inventario:</span>
                    <span className="font-semibold text-gray-900">${formatCurrency(totalInventoryCost)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCategoriesDialogOpen(true)}
                  className="flex-1 sm:flex-none"
                >
                  <Grid3x3 className="w-4 h-4 mr-2" />
                  Categorías
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/purchase-order')}
                  className="flex-1 sm:flex-none"
                >
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Crear pedido
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="flex-1 sm:flex-none bg-gray-900 hover:bg-gray-800">
                      <Plus className="w-4 h-4 mr-2" />
                      Crear productos
                      <ChevronDown className="w-4 h-4 ml-2 opacity-80" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Productos</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => {
                        resetForm();
                        setCreateSheetOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crear producto
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setImportDialogOpen(true);
                      }}
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Importar desde Excel (carga masiva)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="bg-[#272B36] border-b border-slate-700 px-3 py-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              {/* Business Selector */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => setBusinessModalOpen(true)}
                  className="flex items-center gap-2 hover:opacity-90 transition-opacity w-full text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
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

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={handleExport} className="h-9 w-9 text-white hover:bg-white/10">
                  <Download className="w-4 h-4 text-white" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCategoriesDialogOpen(true)}
                  className="h-9 w-9 text-white hover:bg-white/10"
                >
                  <Grid3x3 className="w-4 h-4 text-white" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/70">
              <div className="flex items-center gap-1.5">
                <span>Referencias:</span>
                <span className="font-semibold text-white">{totalReferences}</span>
              </div>
              <span className="text-white/30">|</span>
              <div className="flex items-center gap-1.5">
                <span>Inventario:</span>
                <span className="font-semibold text-white">${formatCurrency(totalInventoryCost)}</span>
              </div>
            </div>
          </div>
        }
      />

      {/* Search and Filters - Desktop */}
      <div className="hidden md:block bg-white border-b px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setSearchTerm('')}
              >
                <X className="w-4 h-4 text-gray-400" />
              </Button>
            )}
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => {
              setTempSortOption(sortOption);
              setSortDialogOpen(true);
            }}
            className={sortOption ? "bg-gray-900 text-white hover:bg-gray-800" : ""}
          >
            <ArrowUpDown className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={handleExport} className="sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Descargar
          </Button>
        </div>

        {/* Category filters */}
        <div className="px-[12px] py-[0px] mx-[0px] my-[12px]">
          <div className="flex items-center gap-2">
            <div className="w-0 flex-1 overflow-x-auto scrollbar-hide">
              <div className="flex flex-nowrap gap-2 min-w-max px-[0px] pt-[12px] pb-[8px]">
                {['Todas', ...allCategories].map((category) => (
                  <Badge
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    className="cursor-pointer whitespace-nowrap flex-shrink-0"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters - Mobile */}
      <div className="md:hidden bg-white border-b py-3">
        <div className="flex gap-2 mb-3 px-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar producto"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 h-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setSearchTerm('')}
              >
                <X className="w-4 h-4 text-gray-400" />
              </Button>
            )}
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => {
              setTempSortOption(sortOption);
              setSortDialogOpen(true);
            }}
            className={sortOption ? "bg-gray-900 text-white hover:bg-gray-800 h-10 w-10" : "h-10 w-10"}
          >
            <ArrowUpDown className="w-4 h-4" />
          </Button>
        </div>

        {/* Category filters */}
        <div className="px-4">
          <div className="flex items-center gap-2">
            <div className="w-0 flex-1 overflow-x-auto scrollbar-hide">
              <div className="flex flex-nowrap gap-2 min-w-max px-[0px] py-[4px]">
                {['Todas', ...allCategories].map((category) => (
                  <Badge
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    className="cursor-pointer whitespace-nowrap flex-shrink-0"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table - Desktop */}
      <div className="hidden md:block flex-1 overflow-auto px-4 sm:px-6 py-4">
        <div className="bg-white rounded-lg border overflow-hidden flex flex-col h-full">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full">
              <thead className={dataTableTheadSticky}>
                <tr>
                  <th className={dthLeft}>Producto</th>
                  <th className={dthRight}>Precio</th>
                  <th className={dthRight}>Costo</th>
                  <th className={dthRightTight}>Ganancia</th>
                  <th className={dthRight}>Cantidad</th>
                  <th className={dthRight}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">{productsLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`products-skeleton-row-${idx}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="px-2 py-3"><Skeleton className="h-4 w-24 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-9 w-20 ml-auto" /></td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-2 mx-[12px] my-[0px]">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <div className="flex flex-col items-center">
                      <PackageOpen className="w-16 h-16 text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg mb-2">No hay productos</p>
                      <p className="text-gray-400">
                        {searchTerm || selectedCategory !== 'Todas' 
                          ? 'No se encontraron resultados con los filtros aplicados'
                          : 'Comienza agregando tu primer producto al inventario'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedProducts.map((product) => {
                  const profit = product.price - product.cost;
                  const profitPercentage = ((profit / product.price) * 100).toFixed(0);

                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="pl-4 pr-0 py-3 w-auto">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-gray-100">
                            <LazyProductImage
                              fillParent
                              productId={product.id}
                              initialSrc={product.image}
                              alt={product.name}
                              className="h-full w-full object-cover object-center"
                            />
                          </div>
                          <div className="min-w-0 max-w-[400px]">
                            <div className="font-medium text-gray-900 truncate" title={product.name}>{product.name}</div>
                            <div className="text-xs text-gray-500 truncate">{product.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="relative ml-auto w-24">
                          <DollarSign className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                          <Input
                            type="number"
                            step="0.01"
                            value={product.price}
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value);
                              if (!isNaN(newPrice)) {
                                setProducts(prev =>
                                  prev.map(p =>
                                    p.id === product.id
                                      ? { ...p, price: newPrice }
                                      : p
                                  )
                                );
                              }
                            }}
                            onBlur={async (e) => {
                              const newPrice = parseFloat(e.target.value);
                              console.log('💾 Intentando guardar precio:', { productId: product.id, newPrice, originalPrice: product.price });
                              if (!isNaN(newPrice)) {
                                try {
                                  const result = await updateProduct(product.id, { price: newPrice });
                                  console.log('✅ Precio guardado:', result);
                                  window.dispatchEvent(new Event('productsUpdated'));
                                  toast.success('Precio actualizado');
                                } catch (error) {
                                  console.error('❌ Error al actualizar precio:', error);
                                  toast.error('Error al guardar el precio');
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            className="h-9 w-full text-right pl-7"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="relative ml-auto w-24">
                          <DollarSign className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                          <Input
                            type="number"
                            step="0.01"
                            value={product.cost}
                            onChange={(e) => {
                              const newCost = parseFloat(e.target.value);
                              if (!isNaN(newCost)) {
                                setProducts(prev =>
                                  prev.map(p =>
                                    p.id === product.id
                                      ? { ...p, cost: newCost }
                                      : p
                                  )
                                );
                              }
                            }}
                            onBlur={async (e) => {
                              const newCost = parseFloat(e.target.value);
                              console.log('💾 Intentando guardar costo:', { productId: product.id, newCost, originalCost: product.cost });
                              if (!isNaN(newCost)) {
                                try {
                                  const result = await updateProduct(product.id, { cost: newCost });
                                  console.log('✅ Costo guardado:', result);
                                  window.dispatchEvent(new Event('productsUpdated'));
                                  toast.success('Costo actualizado');
                                } catch (error) {
                                  console.error('❌ Error al actualizar costo:', error);
                                  toast.error('Error al guardar el costo');
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            className="h-9 w-full text-right pl-7"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-gray-900">${formatCurrency(profit)}</span>
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200"
                          >
                            {profitPercentage}%
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number"
                          value={product.stock}
                          onChange={(e) => {
                            const newStock = parseInt(e.target.value);
                            if (!isNaN(newStock)) {
                              setProducts(prev =>
                                prev.map(p =>
                                  p.id === product.id
                                    ? { ...p, stock: newStock }
                                    : p
                                )
                              );
                            }
                          }}
                          onBlur={async (e) => {
                            const newStock = parseInt(e.target.value);
                            console.log('💾 Intentando guardar stock:', { productId: product.id, newStock, originalStock: product.stock });
                            if (!isNaN(newStock)) {
                              try {
                                const result = await updateProduct(product.id, { stock: newStock });
                                console.log('✅ Stock guardado:', result);
                                window.dispatchEvent(new Event('productsUpdated'));
                                toast.success('Stock actualizado');
                              } catch (error) {
                                console.error('❌ Error al actualizar stock:', error);
                                toast.error('Error al guardar el stock');
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          className="h-9 w-20 text-right ml-auto"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-2 mx-[12px] my-[0px]">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(product)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Products Grid - Mobile */}
      <div className="md:hidden flex-1 overflow-auto px-4 py-4 pb-20">
        {productsLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={`products-skeleton-card-${idx}`} className="bg-white rounded-lg border p-3 flex gap-3">
                <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <PackageOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No hay productos</p>
            <p className="text-sm text-gray-400">
              {searchTerm || selectedCategory !== 'Todas' 
                ? 'No se encontraron resultados'
                : 'Comienza agregando tu primer producto'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedProducts.map((product) => {
              const profit = product.price - product.cost;
              const profitPercentage = ((profit / product.price) * 100).toFixed(0);

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-lg border p-3 flex gap-3"
                  onClick={() => handleEditProduct(product)}
                >
                  {/* Imagen pequeña */}
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    <LazyProductImage
                      fillParent
                      productId={product.id}
                      initialSrc={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover object-center"
                    />
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm line-clamp-1">
                          {product.name}
                        </div>
                        <div className="text-xs text-gray-500">{product.category}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(product);
                        }}
                        className="h-7 w-7 -mt-1 -mr-1 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-base font-bold text-gray-900">
                          ${formatCurrency(product.price)}
                        </span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0">
                          +{profitPercentage}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-500">Stock:</span>
                        <span className="text-sm font-semibold text-gray-900">{product.stock}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button - Mobile */}
      <div className="md:hidden fixed bottom-20 right-4 z-10">
        <Button
          onClick={() => {
            resetForm();
            setCreateSheetOpen(true);
          }}
          className="h-14 w-14 rounded-full shadow-lg bg-gray-900 hover:bg-gray-800"
          size="icon"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Create/Edit Product Sheet */}
      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col h-full">
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <SheetTitle>
                  {editingProduct ? 'Editar producto' : 'Crear producto'}
                </SheetTitle>
                <SheetDescription>
                  Completa la información del producto
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  resetForm();
                  setCreateSheetOpen(false);
                }}
                className="h-8 w-8 rounded-full flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Image Upload - First */}
              <div className="space-y-2">
                <Label>Imagen del producto</Label>
                <div className="flex flex-col gap-4">
                  {productImage && (
                    <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100 relative">
                      <ImageWithFallback
                        src={productImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 bg-white/90 hover:bg-white"
                        onClick={() => setProductImage('')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <div className="flex items-center justify-center gap-2 h-12 px-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer transition-colors">
                        <Upload className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-600">
                          {imageProcessing
                            ? 'Procesando imagen...'
                            : productImage
                            ? 'Cambiar imagen'
                            : 'Subir imagen'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          setImageProcessing(true);
                          try {
                            const optimizedDataUrl = await optimizeImageForProduct(file);
                            setProductImage(optimizedDataUrl);
                          } catch (error) {
                            console.warn('No se pudo optimizar la imagen, usando original:', error);
                            try {
                              const originalDataUrl = await fileToDataUrl(file);
                              setProductImage(originalDataUrl);
                            } catch {
                              toast.error('No se pudo cargar la imagen seleccionada');
                            }
                          } finally {
                            setImageProcessing(false);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Product Name */}
              <div className="space-y-2">
                <Label>Nombre del producto*</Label>
                <Input
                  placeholder="Ej: Café Americano"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="h-12"
                />
              </div>

              {/* Price and Cost */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Precio de venta*</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      className="h-12 pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Costo*</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={productCost}
                      onChange={(e) => setProductCost(e.target.value)}
                      className="h-12 pl-7"
                    />
                  </div>
                </div>
              </div>

              {/* Stock */}
              <div className="space-y-2">
                <Label>Cantidad disponible*</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={productStock}
                  onChange={(e) => setProductStock(e.target.value)}
                  className="h-12"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>Categoría</Label>
                <div className="flex gap-2">
                  {/* Desktop: Select normal */}
                  <div className="hidden md:block flex-1">
                    <Select value={productCategory} onValueChange={setProductCategory}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {allCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Mobile: Botón que abre modal */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCategoryPickerOpen(true)}
                    className="md:hidden flex-1 h-12 justify-between text-left font-normal"
                  >
                    <span className={productCategory ? "text-gray-900" : "text-gray-500"}>
                      {productCategory || "Seleccionar categoría"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCategoriesDialogOpen(true)}
                    className="h-12 w-12"
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Profit Preview */}
              {productPrice && productCost && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Ganancia por unidad</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${formatCurrency(parseFloat(productPrice) - parseFloat(productCost))}
                  </div>
                  <div className="text-sm text-green-600 font-medium mt-1">
                    {(((parseFloat(productPrice) - parseFloat(productCost)) / parseFloat(productPrice)) * 100).toFixed(0)}% de margen
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-6 border-t bg-white">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setCreateSheetOpen(false);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveProduct}
                disabled={loading}
                className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingProduct ? 'Actualizando...' : 'Creando...'}
                  </>
                ) : (
                  editingProduct ? 'Actualizar' : 'Crear producto'
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Categories Sheet - Lateral Derecho (Desktop y Mobile) */}
      <Sheet 
        open={categoriesDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setCategoriesDialogOpen(false);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col h-full">
          <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <SheetTitle className="text-left">Gestionar categorías</SheetTitle>
                <SheetDescription className="text-left">
                  Agrega o elimina categorías para organizar tus productos
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCategoriesDialogOpen(false)}
                className="h-8 w-8 rounded-full flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 pt-4 pb-2 flex-shrink-0">
              <form 
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddCategory();
                }}
              >
                <Input
                  placeholder="Nueva categoría"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="h-12"
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-12 w-12 flex-shrink-0 bg-gray-900 hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </form>
            </div>
            
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-2 pb-6 pt-2">
                {allCategories.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No hay categorías. Agrega una nueva arriba.
                  </div>
                ) : (
                  allCategories.map((category) => (
                    <div
                      key={category}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-medium text-gray-900">{category}</span>
                      {customCategories.includes(category) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCategory(category)}
                          className="h-8 w-8"
                        >
                          <X className="w-4 h-4 text-gray-600" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar "{productToDelete?.name}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Importación masiva desde Excel */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar productos desde Excel</DialogTitle>
            <DialogDescription>
              Esto es una <b>importación masiva</b>. Descarga la plantilla, llénala y súbela aquí.
              Columnas requeridas: <b>Nombre</b>, <b>Precio</b>, <b>Costo</b>, <b>Stock</b>. Categoría es opcional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={downloadImportTemplate} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Descargar plantilla
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Subir Excel
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportExcelFile(f);
                }}
              />
            </div>

            <div className="text-xs text-gray-500">
              Nota: en esta primera versión, la importación <b>crea</b> productos. Si el mismo nombre ya existe, quedará duplicado.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicados detectados en importación */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Productos duplicados detectados</DialogTitle>
            <DialogDescription>
              Encontré posibles duplicados por <b>nombre</b>.
              {duplicateSummary.existing > 0 && (
                <> {duplicateSummary.existing} ya existen en tu inventario.</>
              )}
              {duplicateSummary.inFile > 0 && (
                <> {duplicateSummary.inFile} están repetidos dentro del mismo Excel.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              Ejemplos:
            </div>
            <div className="max-h-40 overflow-auto border rounded-md bg-gray-50 p-3 text-sm text-gray-800">
              {duplicateNames.length ? (
                <ul className="list-disc pl-5 space-y-1">
                  {duplicateNames.map((n) => (
                    <li key={n} className="break-words">{n}</li>
                  ))}
                </ul>
              ) : (
                <div>No hay nombres para mostrar.</div>
              )}
            </div>

            <div className="text-xs text-gray-500">
              - <b>Conservar ambos</b>: crea todos los productos (quedarán duplicados).<br />
              - <b>Reemplazar</b>: si ya existe un producto con ese nombre, se actualiza (precio/costo/stock/categoría).<br />
              - <b>Cancelar</b>: no se importa nada.
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDuplicateDialogOpen(false);
                  setPendingImportRows(null);
                  setDuplicateNames([]);
                  setDuplicateSummary({ inFile: 0, existing: 0 });
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={importing}
                onClick={() => runImportWithDuplicatePolicy('keep')}
              >
                Conservar ambos
              </Button>
              <Button
                className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50"
                disabled={importing}
                onClick={() => runImportWithDuplicatePolicy('replace')}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Reemplazar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sort Sheet */}
      <Sheet open={sortDialogOpen} onOpenChange={setSortDialogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col h-full">
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <SheetTitle>Ordenar inventario</SheetTitle>
                <SheetDescription>
                  Solo puedes aplicar un orden a la vez
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSortDialogOpen(false)}
                className="h-8 w-8 rounded-full flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Por stock */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Por stock</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={tempSortOption === 'stock-low' ? 'default' : 'outline'}
                    onClick={() => setTempSortOption('stock-low')}
                  >
                    Menos stock
                  </Button>
                  <Button
                    variant={tempSortOption === 'stock-high' ? 'default' : 'outline'}
                    onClick={() => setTempSortOption('stock-high')}
                  >
                    Más stock
                  </Button>
                </div>
              </div>

              {/* Por ventas */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Por ventas (últimos 30 días)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={tempSortOption === 'sales-low' ? 'default' : 'outline'}
                    onClick={() => setTempSortOption('sales-low')}
                  >
                    Menos vendidos
                  </Button>
                  <Button
                    variant={tempSortOption === 'sales-high' ? 'default' : 'outline'}
                    onClick={() => setTempSortOption('sales-high')}
                  >
                    Más vendidos
                  </Button>
                </div>
              </div>

              {/* Por nombre */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Por nombre</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={tempSortOption === 'name-asc' ? 'default' : 'outline'}
                    onClick={() => setTempSortOption('name-asc')}
                  >
                    Nombre A-Z
                  </Button>
                  <Button
                    variant={tempSortOption === 'name-desc' ? 'default' : 'outline'}
                    onClick={() => setTempSortOption('name-desc')}
                  >
                    Nombre Z-A
                  </Button>
                </div>
              </div>

              {/* Por fecha de creación */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Por fecha de creación</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={tempSortOption === 'date-old' ? 'default' : 'outline'}
                    onClick={() => setTempSortOption('date-old')}
                  >
                    Más antiguo
                  </Button>
                  <Button
                    variant={tempSortOption === 'date-new' ? 'default' : 'outline'}
                    onClick={() => setTempSortOption('date-new')}
                  >
                    Más reciente
                  </Button>
                </div>
              </div>

              {/* Por precio */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Por precio</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={tempSortOption === 'price-low' ? 'default' : 'outline'}
                    onClick={() => setTempSortOption('price-low')}
                  >
                    Más bajo
                  </Button>
                  <Button
                    variant={tempSortOption === 'price-high' ? 'default' : 'outline'}
                    onClick={() => setTempSortOption('price-high')}
                  >
                    Más alto
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-6 border-t bg-white">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setTempSortOption(null);
                  setSortOption(null);
                  setSortDialogOpen(false);
                }}
                className="flex-1"
              >
                Limpiar
              </Button>
              <Button
                onClick={() => {
                  setSortOption(tempSortOption);
                  setSortDialogOpen(false);
                }}
                className="flex-1 bg-gray-900 hover:bg-gray-800"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Business Selector Modal - Mobile */}
      <BusinessSelectorModal
        open={businessModalOpen}
        onOpenChange={setBusinessModalOpen}
        businesses={businesses}
        currentBusiness={currentBusiness}
        onSwitchBusiness={switchBusiness}
      />

      {/* Category Picker Sheet - Mobile (Bottom) */}
      <Sheet open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
        <SheetContent side="bottom" className="p-0 flex flex-col h-[70vh]">
          <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <SheetTitle>Seleccionar categoría</SheetTitle>
                <SheetDescription>
                  Elige una categoría para el producto
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCategoryPickerOpen(false)}
                className="h-8 w-8 rounded-full flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-2 py-4">
              {allCategories.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No hay categorías disponibles
                </div>
              ) : (
                allCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      setProductCategory(category);
                      setCategoryPickerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
                      productCategory === category
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <span className="font-medium">{category}</span>
                    {productCategory === category && (
                      <Check className="w-5 h-5" />
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}