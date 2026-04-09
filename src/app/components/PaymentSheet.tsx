import { useState, useEffect } from 'react';
import { ArrowLeft, Check, ChevronRight, CreditCard, Banknote, Building2, MoreHorizontal, ChevronDown, ChevronUp, Percent, X, User, Users, Plus, Search, Loader2 } from 'lucide-react';
import { CartItem, Payment, Client, UserRole } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Textarea } from './ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
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
import { formatCurrency } from '../utils/currency';
import { useBusiness } from '../contexts/BusinessContext';
import * as apiService from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';

interface PaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartItems: CartItem[];
  total: number;
  onConfirm: (saleData: any) => void | Promise<void>;
  userRole: UserRole;
}

interface PaymentField {
  id: string;
  amount: string;
  method: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Otros';
}

export function PaymentSheet({
  open,
  onOpenChange,
  cartItems,
  total,
  onConfirm,
  userRole,
}: PaymentSheetProps) {
  const { currentBusiness } = useBusiness();
  const isMobile = useIsMobile();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [paymentType, setPaymentType] = useState<'pagada' | 'credito'>('pagada');

  // ── Permiso para crear contactos desde ventas ─────────────────────────────
  const isOwner = currentBusiness?.role === 'owner' || currentBusiness?.permissions?.all === true;
  const canCreateContact = isOwner || (currentBusiness?.permissions?.contacts?.create ?? false);
  // ─────────────────────────────────────────────────────────────────────────

  // ✅ FIX: Usar fecha LOCAL en lugar de UTC
  const getLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [saleDate, setSaleDate] = useState(getLocalDateString());
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [numPayments, setNumPayments] = useState(1);
  const [singlePaymentMethod, setSinglePaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Otros'>('Efectivo');
  const [paymentFields, setPaymentFields] = useState<PaymentField[]>([
    { id: '1', amount: '', method: 'Efectivo' }
  ]);
  const [receiptNote, setReceiptNote] = useState('');
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [discountActive, setDiscountActive] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [creatingSale, setCreatingSale] = useState(false);

  // States for quick client creation
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    type: 'both' as 'customer' | 'supplier' | 'both',
    phone: '',
    email: '',
  });

  // Load all contacts from API
  useEffect(() => {
    if (currentBusiness?.id) {
      apiService.getCustomers(currentBusiness.id).then(allContacts => {
        setClients(allContacts);
      }).catch(error => {
        console.error('Error loading contacts:', error);
      });
    }
  }, [currentBusiness, open]);


  // Calculate discount
  const subtotal = total;
  const discountValue = parseFloat(discountAmount) || 0;
  const totalWithDiscount = subtotal - discountValue;

  const handleDiscountPercentChange = (value: string) => {
    setDiscountPercent(value);
    const percent = parseFloat(value) || 0;
    const amount = (subtotal * percent) / 100;
    setDiscountAmount(amount.toFixed(2));
  };

  const handleDiscountAmountChange = (value: string) => {
    setDiscountAmount(value);
    const amount = parseFloat(value) || 0;
    const percent = subtotal > 0 ? (amount / subtotal) * 100 : 0;
    setDiscountPercent(percent.toFixed(2));
  };

  // Update payment fields when numPayments changes
  const handleNumPaymentsChange = (num: number) => {
    setNumPayments(num);
    if (num === 1) {
      // Single payment - no fields needed
      setSinglePaymentMethod('Efectivo');
    } else {
      const newFields: PaymentField[] = [];
      for (let i = 0; i < num; i++) {
        newFields.push({
          id: `${i + 1}`,
          amount: paymentFields[i]?.amount || '',
          method: paymentFields[i]?.method || 'Efectivo',
        });
      }
      setPaymentFields(newFields);
    }
  };

  const updatePaymentField = (id: string, field: 'amount' | 'method', value: string) => {
    setPaymentFields(paymentFields.map(pf =>
      pf.id === id ? { ...pf, [field]: value } : pf
    ));
  };

  const totalPaid = numPayments === 1 
    ? totalWithDiscount 
    : paymentFields.reduce((sum, field) => {
        const amount = parseFloat(field.amount) || 0;
        return sum + amount;
      }, 0);

  const paymentsMatchTotal = Math.abs(totalPaid - totalWithDiscount) < 0.01;

  const handleConfirm = async () => {
    if (paymentType === 'credito' && !selectedClient) {
      return;
    }
    if (paymentType === 'pagada' && !paymentsMatchTotal) {
      return;
    }

    // Prepare payment data (crédito: no enviar un "pago" por el total — eso hacía que la BD guardara paid/pagado)
    const paymentsData =
      paymentType === 'credito'
        ? []
        : numPayments === 1
          ? [{ method: singlePaymentMethod, amount: totalWithDiscount }]
          : paymentFields.map(field => ({
              method: field.method,
              amount: parseFloat(field.amount) || 0
            }));

    const saleData = {
      paymentType,
      payments: paymentsData,
      client: selectedClient,
      saleDate,
      receiptNote,
      discount: discountActive ? {
        percent: parseFloat(discountPercent) || 0,
        amount: parseFloat(discountAmount) || 0
      } : { percent: 0, amount: 0 }
    };

    try {
      setCreatingSale(true);
      await Promise.resolve(onConfirm(saleData));

      setPaymentFields([{ id: '1', amount: '', method: 'Efectivo' }]);
      setSelectedClient(null);
      setPaymentType('pagada');
      setNumPayments(1);
      setSinglePaymentMethod('Efectivo');
      setReceiptNote('');
      setDiscountActive(false);
      setDiscountPercent('0');
      setDiscountAmount('0');
      onOpenChange(false);
    } catch {
      // El padre ya mostró toast; mantener el sheet abierto para reintentar
    } finally {
      setCreatingSale(false);
    }
  };

  const canConfirm = paymentType === 'pagada' ? paymentsMatchTotal : selectedClient !== null;

  // Handle quick client creation
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentBusiness?.id || !newClientForm.name.trim()) {
      return;
    }

    // Save via API
    try {
      const newClient = await apiService.createCustomer(currentBusiness.id, {
        name: newClientForm.name.trim(),
        phone: newClientForm.phone.trim() || undefined,
        email: newClientForm.email.trim() || undefined,
        type: 'customer',
        creditLimit: 0,
        currentBalance: 0
      });
      
      // Update local state
      setClients([...clients, newClient]);
      
      // Select the newly created client
      setSelectedClient(newClient);
      
      // Close modals and reset form
      setIsCreatingClient(false);
      setClientDialogOpen(false);
      setClientSearchTerm('');
      setNewClientForm({
        name: '',
        type: 'both',
        phone: '',
        email: '',
      });
    } catch (error) {
      console.error('Error creating client:', error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col h-full overflow-x-hidden">
        {/* Header */}
        <SheetHeader className="px-2 sm:px-6 py-2 sm:py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <SheetTitle className="text-base sm:text-xl">Pago</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-2 sm:p-6 space-y-3 sm:space-y-6">
            {/* Payment Type Toggle */}
            <div className="flex gap-2">
              <Button
                variant={paymentType === 'pagada' ? 'default' : 'outline'}
                className="flex-1 text-sm"
                onClick={() => setPaymentType('pagada')}
              >
                Pagada
              </Button>
              <Button
                variant={paymentType === 'credito' ? 'default' : 'outline'}
                className="flex-1 text-sm"
                onClick={() => setPaymentType('credito')}
              >
                A crédito
              </Button>
            </div>

            {/* Sale Date */}
            <div className="space-y-2">
              <Label className="text-sm">Fecha de la venta *</Label>
              <Input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Client Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {paymentType === 'credito' && (
                  <Badge variant="default" className="text-xs">Requerido</Badge>
                )}
                <Label className="text-sm">Cliente</Label>
              </div>
              {selectedClient ? (
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{selectedClient.name}</p>
                    {selectedClient.phone && (
                      <p className="text-sm text-gray-500">{selectedClient.phone}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedClient(null)}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setClientDialogOpen(true)}
                >
                  Selecciona un cliente
                </Button>
              )}
            </div>

            <Separator />

            {/* Discount Section */}
            {!discountActive ? (
              <button
                onClick={() => setDiscountActive(true)}
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
                      setDiscountActive(false);
                      setDiscountPercent('0');
                      setDiscountAmount('0');
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
                      value={discountPercent}
                      onChange={(e) => handleDiscountPercentChange(e.target.value)}
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
                      value={discountAmount}
                      onChange={(e) => handleDiscountAmountChange(e.target.value)}
                      className="pl-7 h-12 text-base"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {paymentType === 'pagada' && (
              <>
                {/* Number of Payments */}
                <div className="space-y-3">
                  <Label className="text-xs sm:text-sm break-words leading-tight">Selecciona el número de pagos que realizarás y el método de pago*</Label>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <Button
                        key={num}
                        variant={numPayments === num ? 'default' : 'outline'}
                        className="w-10 h-10 sm:w-12 sm:h-12 text-sm"
                        onClick={() => handleNumPaymentsChange(num)}
                      >
                        {num}
                      </Button>
                    ))}
                    <Button
                      variant={numPayments === 0 ? 'default' : 'outline'}
                      className="px-3 h-10 sm:px-4 sm:h-12 text-sm"
                      onClick={() => handleNumPaymentsChange(0)}
                    >
                      Otro
                    </Button>
                  </div>
                </div>

                {/* Single Payment Method Selection */}
                {numPayments === 1 && (
                  <div className="space-y-3">
                    <Label className="text-xs sm:text-sm">Selecciona el método de pago*</Label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <Button
                        variant={singlePaymentMethod === 'Efectivo' ? 'default' : 'outline'}
                        className="h-24 flex flex-col gap-2 relative"
                        onClick={() => setSinglePaymentMethod('Efectivo')}
                      >
                        {singlePaymentMethod === 'Efectivo' && (
                          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <Banknote className="w-8 h-8" />
                        <span className="text-sm">Efectivo</span>
                      </Button>
                      <Button
                        variant={singlePaymentMethod === 'Tarjeta' ? 'default' : 'outline'}
                        className="h-24 flex flex-col gap-2 relative"
                        onClick={() => setSinglePaymentMethod('Tarjeta')}
                      >
                        {singlePaymentMethod === 'Tarjeta' && (
                          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <CreditCard className="w-8 h-8" />
                        <span className="text-sm">Tarjeta</span>
                      </Button>
                      <Button
                        variant={singlePaymentMethod === 'Transferencia' ? 'default' : 'outline'}
                        className="h-24 flex flex-col gap-2 relative"
                        onClick={() => setSinglePaymentMethod('Transferencia')}
                      >
                        {singlePaymentMethod === 'Transferencia' && (
                          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <Building2 className="w-8 h-8" />
                        <span className="text-sm">Transferencia</span>
                      </Button>
                      <Button
                        variant={singlePaymentMethod === 'Otros' ? 'default' : 'outline'}
                        className="h-24 flex flex-col gap-2 relative"
                        onClick={() => setSinglePaymentMethod('Otros')}
                      >
                        {singlePaymentMethod === 'Otros' && (
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
                {numPayments > 1 && (
                  <div className="space-y-4">
                    {paymentFields.map((field, index) => (
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
                                value={field.amount}
                                onChange={(e) => updatePaymentField(field.id, 'amount', e.target.value)}
                                className="pl-7 text-base"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Método de pago</Label>
                            <Select
                              value={field.method}
                              onValueChange={(value: any) => updatePaymentField(field.id, 'method', value)}
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
                {numPayments > 1 && paymentFields.length > 0 && (
                  <div className={`p-4 rounded-lg border-2 flex items-center gap-3 ${
                    paymentsMatchTotal 
                      ? 'bg-green-50 border-green-300' 
                      : 'bg-yellow-50 border-yellow-300'
                  }`}>
                    {paymentsMatchTotal && (
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                    <p className={`text-sm font-medium ${
                      paymentsMatchTotal ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {paymentsMatchTotal 
                        ? `Los pagos suman el total de la orden: $${formatCurrency(totalWithDiscount)}`
                        : `Los pagos ($${formatCurrency(totalPaid)}) no suman el total: $${formatCurrency(totalWithDiscount)}`
                      }
                    </p>
                  </div>
                )}

                <Separator />
              </>
            )}

            {/* Payment Details - Collapsible */}
            <Collapsible open={paymentDetailsOpen} onOpenChange={setPaymentDetailsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto font-semibold">
                  Detalle del pago
                  {paymentDetailsOpen ? (
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
                    value={receiptNote}
                    onChange={(e) => setReceiptNote(e.target.value)}
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
            onClick={() => void handleConfirm()}
            size="lg"
            className="w-full h-14 sm:h-[60px] text-base sm:text-lg font-semibold bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50 kivo-pressable relative overflow-hidden"
            disabled={!canConfirm || creatingSale}
          >
            {creatingSale ? (
              <span aria-hidden className="absolute inset-0 kivo-saving-overlay" />
            ) : null}
            {creatingSale ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                <span className="text-base sm:text-lg font-medium">
                  {paymentType === 'pagada' ? 'Creando venta...' : 'Creando venta a crédito...'}
                </span>
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-base sm:text-lg font-medium">{numPayments}</span>
                <span className="text-base sm:text-lg font-medium">
                  {paymentType === 'pagada' ? 'Crear venta' : 'Crear venta a crédito'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-bold">${formatCurrency(totalWithDiscount)}</span>
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            )}
          </Button>
        </div>
      </SheetContent>

      {/* Quick Client Creation Sheet */}
      <Sheet open={isCreatingClient} onOpenChange={setIsCreatingClient}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto" aria-describedby="new-client-description">
          <SheetHeader>
            <SheetTitle>Nuevo Contacto</SheetTitle>
            <p id="new-client-description" className="sr-only">Formulario para crear un nuevo contacto</p>
          </SheetHeader>

          <form onSubmit={handleCreateClient} className="mx-[24px] my-[0px] p-[0px] space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Nombre <span className="text-red-500">*</span>
              </label>
              <Input
                value={newClientForm.name}
                onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                placeholder="Ej: Juan Pérez o Distribuidora XYZ"
                required
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Teléfono
              </label>
              <Input
                value={newClientForm.phone}
                onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
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
                value={newClientForm.email}
                onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
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
                  setIsCreatingClient(false);
                  setNewClientForm({
                    name: '',
                    type: 'both',
                    phone: '',
                    email: '',
                  });
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Crear
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Client Selection - Desktop (Dialog) or Mobile (Sheet) */}
      {isMobile ? (
        <Sheet open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
          <SheetContent side="bottom" className="h-full w-full p-0 flex flex-col">
            <SheetHeader className="px-6 py-4 border-b flex-shrink-0 bg-white">
              <div className="space-y-3">
                <div>
                  <SheetTitle>Seleccionar Cliente</SheetTitle>
                  <p className="text-sm text-gray-500 mt-1">Elige un cliente de la lista o crea uno nuevo.</p>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="bg-gray-900 text-white hover:bg-gray-800"
                    onClick={() => {
                      setClientDialogOpen(false);
                      setIsCreatingClient(true);
                    }}
                    disabled={!canCreateContact}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nuevo Cliente
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
                    placeholder="Buscar por nombre, email o teléfono..."
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Client List */}
              <ScrollArea className="flex-1 bg-gray-50">
                <div className="p-4 space-y-2">
                  {(() => {
                    const filteredClients = clients.filter(client => {
                      const searchLower = clientSearchTerm.toLowerCase();
                      return (
                        client.name.toLowerCase().includes(searchLower) ||
                        client.email?.toLowerCase().includes(searchLower) ||
                        client.phone?.toLowerCase().includes(searchLower)
                      );
                    });

                    return filteredClients.length > 0 ? (
                      filteredClients.map((client) => (
                        <button
                          key={client.id}
                          onClick={() => {
                            setSelectedClient(client);
                            setClientDialogOpen(false);
                            setClientSearchTerm('');
                          }}
                          className="w-full text-left p-4 bg-white border rounded-lg hover:bg-gray-50 transition-colors active:scale-[0.98]"
                        >
                          <p className="font-medium text-base">{client.name}</p>
                          {(client.phone || client.email) && (
                            <p className="text-sm text-gray-500 mt-1">
                              {[client.phone, client.email].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-8">
                        {clientSearchTerm 
                          ? 'No se encontraron clientes con ese término de búsqueda.'
                          : 'No hay clientes registrados. Agrega uno nuevo.'}
                      </p>
                    );
                  })()}
                </div>
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <div className="space-y-3">
                <div>
                  <DialogTitle>Seleccionar Cliente</DialogTitle>
                  <DialogDescription>Elige un cliente de la lista o crea uno nuevo.</DialogDescription>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="bg-gray-900 text-white hover:bg-gray-800"
                    onClick={() => {
                      setClientDialogOpen(false);
                      setIsCreatingClient(true);
                    }}
                    disabled={!canCreateContact}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nuevo Cliente
                  </Button>
                </div>
              </div>
            </DialogHeader>
            
            {/* Search Input */}
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 mt-4">
              <div className="space-y-2">
                {(() => {
                  const filteredClients = clients.filter(client => {
                    const searchLower = clientSearchTerm.toLowerCase();
                    return (
                      client.name.toLowerCase().includes(searchLower) ||
                      client.email?.toLowerCase().includes(searchLower) ||
                      client.phone?.toLowerCase().includes(searchLower)
                    );
                  });

                  return filteredClients.length > 0 ? (
                    filteredClients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedClient(client);
                          setClientDialogOpen(false);
                          setClientSearchTerm('');
                        }}
                        className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium">{client.name}</p>
                        {(client.phone || client.email) && (
                          <p className="text-sm text-gray-500">
                            {[client.phone, client.email].filter(Boolean).join(' • ')}
                          </p>
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      {clientSearchTerm 
                        ? 'No se encontraron clientes con ese término de búsqueda.'
                        : 'No hay clientes registrados. Agrega uno nuevo.'}
                    </p>
                  );
                })()}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </Sheet>
  );
}