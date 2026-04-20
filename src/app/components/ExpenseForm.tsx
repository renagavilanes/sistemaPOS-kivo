import { useState, useEffect } from 'react';
import { X, Check, Banknote, CreditCard, Building2, MoreHorizontal, Search, User, Users, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { formatCurrency } from '../utils/currency';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Separator } from './ui/separator';
import { useBusiness } from '../contexts/BusinessContext';
import * as apiService from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';
import { toast } from 'sonner';

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  onSave: (expense: {
    date: string;
    category: string;
    supplier?: string;
    supplierContact?: { id: string; name: string; phone?: string; email?: string; cedula?: string };
    paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Otros' | '-';
    amount: number;
    name?: string;
    status: 'pagada' | 'deuda';
  }) => void;
  // Edit mode props
  isEditMode?: boolean;
  initialData?: {
    date?: string;
    category?: string;
    supplier?: string;
    paymentMethod?: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Otros' | '-';
    amount?: number;
    name?: string;
    status?: 'pagada' | 'deuda';
  };
}

function guessSearchKind(raw: string): 'cedula' | 'text' {
  const t = (raw || '').trim();
  if (!t) return 'text';
  const digits = t.replace(/\D/g, '');
  return digits.length >= Math.max(6, Math.ceil(t.length * 0.7)) ? 'cedula' : 'text';
}

export function ExpenseForm({ 
  open, 
  onOpenChange, 
  categories, 
  onSave,
  isEditMode = false,
  initialData
}: ExpenseFormProps) {
  const { currentBusiness } = useBusiness();
  const isMobile = useIsMobile();
  const [contacts, setContacts] = useState<{ id: string; name: string; phone?: string; email?: string; cedula?: string }[]>([]);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [selectedSupplierContact, setSelectedSupplierContact] = useState<{ id: string; name: string; phone?: string; email?: string; cedula?: string } | null>(null);
  
  // ✅ FIX: Usar fecha LOCAL en lugar de UTC
  const getLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const today = getLocalDateString();
  
  // Initialize with default values
  const [expenseStatus, setExpenseStatus] = useState<'pagada' | 'deuda'>('pagada');
  const [expenseDate, setExpenseDate] = useState(today);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Otros' | '-'>('Efectivo');
  
  // States for quick supplier creation
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({
    name: '',
    type: 'supplier' as 'customer' | 'supplier' | 'both',
    phone: '',
    email: '',
    cedula: '',
  });

  // Load all contacts from API
  useEffect(() => {
    if (currentBusiness?.id) {
      apiService.getCustomers(currentBusiness.id).then(allContacts => {
        setContacts(allContacts.map(c => ({ 
          id: c.id, 
          name: c.name,
          phone: c.phone,
          email: c.email,
          cedula: (c as any).cedula,
        })));
      }).catch(error => {
        console.error('Error loading contacts:', error);
      });
    }
  }, [currentBusiness, open]);

  // Update form fields when modal opens (for both create and edit mode)
  useEffect(() => {
    if (open) {
      if (isEditMode && initialData) {
        // Edit mode: load existing data
        setExpenseStatus(initialData.status || 'pagada');
        setExpenseDate(initialData.date || today);
        setCategory(initialData.category || '');
        setAmount(initialData.amount?.toString() || '');
        setExpenseName(initialData.name || '');
        setSelectedSupplier(initialData.supplier || '');
        setPaymentMethod(initialData.paymentMethod || 'Efectivo');
      } else {
        // Create mode: reset to defaults
        setExpenseStatus('pagada');
        setExpenseDate(today);
        setCategory('');
        setAmount('');
        setExpenseName('');
        setSelectedSupplier('');
        setSelectedSupplierContact(null);
        setPaymentMethod('Efectivo');
      }
    }
  }, [open, isEditMode, initialData, today]);

  const totalValue = parseFloat(amount) || 0;

  const handleConfirm = () => {
    if (!category || !amount) {
      return;
    }

    console.log('🔵 ExpenseForm - Enviando gasto:', {
      category,
      expenseName,
      amount: totalValue,
      finalNameValue: expenseName || undefined
    });

    onSave({
      date: expenseDate,
      category,
      supplier: selectedSupplier ? selectedSupplier : undefined,
      supplierContact: selectedSupplierContact ? selectedSupplierContact : undefined,
      paymentMethod: expenseStatus === 'deuda' ? '-' : paymentMethod,
      amount: totalValue,
      name: expenseName || undefined,
      status: expenseStatus,
    });

    // Reset
    setExpenseStatus('pagada');
    setExpenseDate(today);
    setCategory('');
    setAmount('');
    setExpenseName('');
    setSelectedSupplier('');
    setSelectedSupplierContact(null);
    setPaymentMethod('Efectivo');
    onOpenChange(false);
  };

  const canConfirm = category && amount && totalValue > 0;

  // Handle quick supplier creation
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentBusiness?.id || !newSupplierForm.name.trim()) {
      return;
    }

    // Save via API
    try {
      const newSupplier = await apiService.createCustomer(currentBusiness.id, {
        name: newSupplierForm.name.trim(),
        phone: newSupplierForm.phone.trim() || undefined,
        email: newSupplierForm.email.trim() || undefined,
        cedula: newSupplierForm.cedula.trim() || undefined,
        type: 'supplier',
        creditLimit: 0,
        currentBalance: 0
      });
      
      // Update local state
      setContacts([...contacts, { 
        id: newSupplier.id, 
        name: newSupplier.name,
        phone: newSupplier.phone,
        email: newSupplier.email,
        cedula: (newSupplier as any).cedula,
      }]);
      
      // Select the newly created supplier
      setSelectedSupplier(newSupplier.name);
      setSelectedSupplierContact({
        id: newSupplier.id,
        name: newSupplier.name,
        phone: newSupplier.phone,
        email: newSupplier.email,
        cedula: (newSupplier as any).cedula,
      });
      
      // Close modals and reset form
      setIsCreatingSupplier(false);
      setSupplierDialogOpen(false);
      setContactSearchTerm('');
      setNewSupplierForm({
        name: '',
        type: 'supplier',
        phone: '',
        email: '',
        cedula: '',
      });
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast.error(
        'No se pudo crear el proveedor. Revisa la consola; en servidor aplica la migración contact_type y redespliega la función.',
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col h-full overflow-x-hidden">
        {/* Header */}
        <SheetHeader className="px-2 sm:px-6 py-2 sm:py-4 border-b flex-shrink-0">
          <SheetTitle className="text-base sm:text-xl font-semibold">
            {isEditMode ? 'Editar gasto' : 'Nuevo gasto'}
          </SheetTitle>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">
            Los campos marcados con asterisco (*) son obligatorios
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-2 sm:p-6 pb-28 sm:pb-24 space-y-3 sm:space-y-6">
            {/* Status Toggle */}
            <div className="flex gap-2">
              <Button
                variant={expenseStatus === 'pagada' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setExpenseStatus('pagada')}
              >
                Pagada
              </Button>
              <Button
                variant={expenseStatus === 'deuda' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setExpenseStatus('deuda')}
              >
                En deuda
              </Button>
            </div>

            {/* Expense Date */}
            <div className="space-y-2">
              <Label>Fecha del gasto*</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Categoría del gasto*</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Valor*</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 text-right text-2xl font-semibold"
              />
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Valor total</span>
                <span className="text-red-600 font-semibold">= ${formatCurrency(totalValue)}</span>
              </div>
            </div>

            {/* Solo si está pagada: igual que venta "Pagada". En "En deuda" no se elige medio (como venta a crédito). */}
            {expenseStatus === 'pagada' && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label>Selecciona el método de pago*</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={paymentMethod === 'Efectivo' ? 'default' : 'outline'}
                      className="h-24 flex flex-col gap-2 relative"
                      onClick={() => setPaymentMethod('Efectivo')}
                    >
                      {paymentMethod === 'Efectivo' && (
                        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <Banknote className="w-8 h-8" />
                      <span className="text-sm">Efectivo</span>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === 'Tarjeta' ? 'default' : 'outline'}
                      className="h-24 flex flex-col gap-2 relative"
                      onClick={() => setPaymentMethod('Tarjeta')}
                    >
                      {paymentMethod === 'Tarjeta' && (
                        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <CreditCard className="w-8 h-8" />
                      <span className="text-sm">Tarjeta</span>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === 'Transferencia' ? 'default' : 'outline'}
                      className="h-24 flex flex-col gap-2 relative"
                      onClick={() => setPaymentMethod('Transferencia')}
                    >
                      {paymentMethod === 'Transferencia' && (
                        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <Building2 className="w-8 h-8" />
                      <span className="text-sm">Transferencia</span>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === 'Otros' ? 'default' : 'outline'}
                      className="h-24 flex flex-col gap-2 relative"
                      onClick={() => setPaymentMethod('Otros')}
                    >
                      {paymentMethod === 'Otros' && (
                        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <MoreHorizontal className="w-8 h-8" />
                      <span className="text-sm">Otros</span>
                    </Button>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Expense Name (Optional) */}
            <div className="space-y-2">
              <Label>¿Quieres darle un nombre a este gasto?</Label>
              <Input
                type="text"
                placeholder="Escríbelo aquí"
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            {/* Supplier Input */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Label>Agrega un proveedor al gasto</Label>
                {expenseStatus === 'deuda' && (
                  <span className="text-xs font-medium rounded-md bg-primary/10 text-primary px-2 py-0.5">
                    Recomendado
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 justify-start text-left font-normal"
                onClick={() => setSupplierDialogOpen(true)}
              >
                {selectedSupplier || 'Seleccionar proveedor (opcional)'}
              </Button>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t bg-white flex-shrink-0">
          <Button
            onClick={handleConfirm}
            size="lg"
            className="w-full h-14 sm:h-[60px] text-base sm:text-lg font-semibold bg-gray-900 hover:bg-gray-800 text-white"
            disabled={!canConfirm}
          >
            {isEditMode ? 'Guardar cambios' : 'Crear gasto'}
          </Button>
        </div>
      </SheetContent>

      {/* Supplier Selection - Desktop (Dialog) or Mobile (Sheet) */}
      {isMobile ? (
        <Sheet open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
          <SheetContent side="bottom" className="h-full w-full p-0 flex flex-col">
            <SheetHeader className="px-6 py-4 border-b flex-shrink-0 bg-white">
              <div className="space-y-3">
                <div>
                  <SheetTitle>Seleccionar Contacto</SheetTitle>
                  <p className="text-sm text-gray-500 mt-1">Elige un contacto de la lista o agrega uno nuevo.</p>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="bg-gray-900 text-white hover:bg-gray-800"
                    onClick={() => {
                      setSupplierDialogOpen(false);
                      setIsCreatingSupplier(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nuevo Contacto
                  </Button>
                </div>
              </div>
            </SheetHeader>
            
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search Input */}
              <div className="px-6 py-4 bg-white border-b flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nombre o cédula..."
                    value={contactSearchTerm}
                    onChange={(e) => setContactSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Contact List */}
              <ScrollArea className="flex-1 bg-gray-50">
                <div className="p-4 space-y-2">
                  {(() => {
                    const filteredContacts = contacts.filter(contact => {
                      const searchLower = contactSearchTerm.toLowerCase();
                      return (
                        contact.name.toLowerCase().includes(searchLower) ||
                        contact.email?.toLowerCase().includes(searchLower) ||
                        contact.phone?.toLowerCase().includes(searchLower) ||
                        (contact as any).cedula?.toLowerCase().includes(searchLower)
                      );
                    });

                    return filteredContacts.length > 0 ? (
                      filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => {
                            setSelectedSupplier(contact.name);
                            setSelectedSupplierContact(contact as any);
                            setSupplierDialogOpen(false);
                            setContactSearchTerm('');
                          }}
                          className="w-full text-left p-4 bg-white border rounded-lg hover:bg-gray-50 transition-colors active:scale-[0.98]"
                        >
                          <p className="font-medium text-base">{contact.name}</p>
                          {((contact as any).cedula || contact.phone || contact.email) && (
                            <p className="text-sm text-gray-500 mt-1">
                              {[
                                (contact as any).cedula ? `Cédula: ${(contact as any).cedula}` : null,
                                contact.phone,
                                contact.email,
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-8 space-y-3">
                        <p>
                          {contactSearchTerm 
                            ? 'No se encontraron contactos con ese término de búsqueda.'
                            : 'No hay contactos registrados. Agrega uno nuevo.'}
                        </p>
                        {contactSearchTerm.trim() && (
                          <div className="flex justify-center">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                const term = contactSearchTerm.trim();
                                const kind = guessSearchKind(term);
                                setSupplierDialogOpen(false);
                                setNewSupplierForm({
                                  name: kind === 'text' ? term : '',
                                  type: 'supplier',
                                  phone: '',
                                  email: '',
                                  cedula: kind === 'cedula' ? term : '',
                                });
                                setIsCreatingSupplier(true);
                              }}
                            >
                              Crear contacto con {guessSearchKind(contactSearchTerm) === 'cedula' ? 'cédula' : 'nombre'}: {contactSearchTerm.trim()}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <div className="space-y-3">
                <div>
                  <DialogTitle>Seleccionar Contacto</DialogTitle>
                  <DialogDescription>Elige un contacto de la lista o agrega uno nuevo.</DialogDescription>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="bg-gray-900 text-white hover:bg-gray-800"
                    onClick={() => {
                      setSupplierDialogOpen(false);
                      setIsCreatingSupplier(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nuevo Contacto
                  </Button>
                </div>
              </div>
            </DialogHeader>
            
            {/* Search Input */}
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                    placeholder="Buscar por nombre o cédula..."
                  value={contactSearchTerm}
                  onChange={(e) => setContactSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 mt-4">
              <div className="space-y-2">
                {(() => {
                  const filteredContacts = contacts.filter(contact => {
                    const searchLower = contactSearchTerm.toLowerCase();
                    return (
                      contact.name.toLowerCase().includes(searchLower) ||
                      contact.email?.toLowerCase().includes(searchLower) ||
                      contact.phone?.toLowerCase().includes(searchLower) ||
                      (contact as any).cedula?.toLowerCase().includes(searchLower)
                    );
                  });

                  return filteredContacts.length > 0 ? (
                    filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => {
                          setSelectedSupplier(contact.name);
                          setSelectedSupplierContact(contact as any);
                          setSupplierDialogOpen(false);
                          setContactSearchTerm('');
                        }}
                        className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium">{contact.name}</p>
                        {((contact as any).cedula || contact.phone || contact.email) && (
                          <p className="text-sm text-gray-500">
                            {[
                              (contact as any).cedula ? `Cédula: ${(contact as any).cedula}` : null,
                              contact.phone,
                              contact.email,
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4 space-y-3">
                      <p>
                        {contactSearchTerm 
                          ? 'No se encontraron contactos con ese término de búsqueda.'
                          : 'No hay contactos registrados. Agrega uno nuevo.'}
                      </p>
                      {contactSearchTerm.trim() && (
                        <div className="flex justify-center">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const term = contactSearchTerm.trim();
                              const kind = guessSearchKind(term);
                              setSupplierDialogOpen(false);
                              setNewSupplierForm({
                                name: kind === 'text' ? term : '',
                                type: 'supplier',
                                phone: '',
                                email: '',
                                cedula: kind === 'cedula' ? term : '',
                              });
                              setIsCreatingSupplier(true);
                            }}
                          >
                            Crear contacto con {guessSearchKind(contactSearchTerm) === 'cedula' ? 'cédula' : 'nombre'}: {contactSearchTerm.trim()}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Quick Supplier Creation Sheet */}
      <Sheet open={isCreatingSupplier} onOpenChange={setIsCreatingSupplier}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto" aria-describedby="new-contact-description">
          <SheetHeader>
            <SheetTitle>Nuevo proveedor</SheetTitle>
            <p id="new-contact-description" className="sr-only">Formulario para crear un nuevo contacto</p>
          </SheetHeader>

          <form onSubmit={handleCreateSupplier} className="mx-[24px] my-[0px] p-[0px] space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Nombre <span className="text-red-500">*</span>
              </label>
              <Input
                value={newSupplierForm.name}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                placeholder="Ej: Juan Pérez o Distribuidora XYZ"
                required
              />
            </div>

            {/* Cedula */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Cédula (opcional)
              </label>
              <Input
                value={newSupplierForm.cedula}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, cedula: e.target.value })}
                placeholder="Ej: 1804321532"
                inputMode="numeric"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Teléfono
              </label>
              <Input
                value={newSupplierForm.phone}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                placeholder="Ej: 0991234567"
                type="tel"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Correo Electrónico
              </label>
              <Input
                value={newSupplierForm.email}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, email: e.target.value })}
                placeholder="Ej: ejemplo@correo.com"
                type="email"
              />
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 left-0 right-0 flex gap-3 pt-4 pb-4 bg-white border-t -mx-6 px-6 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreatingSupplier(false);
                  setNewSupplierForm({
                    name: '',
                    type: 'supplier',
                    phone: '',
                    email: '',
                    cedula: '',
                  });
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Crear proveedor
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </Sheet>
  );
}