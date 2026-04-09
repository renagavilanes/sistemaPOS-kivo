import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, User, Building2, Users, Mail, Phone, ChevronLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { useBusiness } from '../contexts/BusinessContext';
// REMOVIDO: import { useData } from '../contexts/DataContext';
import * as apiService from '../services/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { formatCurrency } from '../utils/currency';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/layout/SectionCard';
import { Skeleton } from '../components/ui/skeleton';
import { dataTableThead, dthLeft, dthRight } from '../lib/dataTableHeaderClasses';
import { useScreenFx } from '../contexts/ScreenFxContext';

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: 'customer' | 'supplier' | 'both';
  /** Deuda por ventas a crédito (cliente) */
  credit_balance: number;
  /** Deuda por gastos marcados «en deuda» donde el proveedor coincide con el contacto */
  supplier_debt: number;
}

type ContactType = 'all' | 'customer' | 'supplier' | 'both';

export default function ContactsPage() {
  const { currentBusiness } = useBusiness();
  const { triggerInkDouble } = useScreenFx();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContactType>('all');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  /** true al inicio si ya hay negocio → evita un frame de “vacío” antes del fetch */
  const [loading, setLoading] = useState(() => Boolean(currentBusiness?.id));
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    type: 'customer' as 'customer' | 'supplier' | 'both'
  });

  // Load contacts
  useEffect(() => {
    if (!currentBusiness?.id) {
      setLoading(false);
      setContacts([]);
      return;
    }
    void loadContacts();
  }, [currentBusiness?.id]);

  // Apply filters
  useEffect(() => {
    let filtered = contacts;

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.type === typeFilter || c.type === 'both');
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term)
      );
    }

    setFilteredContacts(filtered);
  }, [contacts, searchTerm, typeFilter]);

  const loadContacts = async () => {
    if (!currentBusiness?.id) return;
    
    setLoading(true);
    
    try {
      // Clientes + ventas + gastos (para deuda de proveedor por nombre en description).
      const customersPromise = apiService.getCustomers(currentBusiness.id);
      const salesPromise = apiService
        .getSales(currentBusiness.id, { fields: 'balance' })
        .catch((salesErr) => {
          console.warn('⚠️ ContactsPage: could not load sales for debt calc:', salesErr);
          return [];
        });
      const expensesPromise = apiService
        .getExpenses(currentBusiness.id, { limit: 8000 })
        .catch((expErr) => {
          console.warn('⚠️ ContactsPage: could not load expenses for supplier debt:', expErr);
          return [];
        });

      const [customersData, sales, expenses] = await Promise.all([
        customersPromise,
        salesPromise,
        expensesPromise,
      ]);
      console.log(
        '✅ ContactsPage: customers:',
        customersData.length,
        'sales:',
        sales.length,
        'expenses:',
        expenses.length,
      );

      const mapped = customersData.map(c => {
        const customerSales = sales.filter((s: any) => s.customerId === c.id);
        const credit_balance = customerSales.reduce((sum: number, sale: any) => {
          if (sale.paymentStatus === 'pending') {
            return sum + sale.total;
          } else if (sale.paymentStatus === 'partial') {
            return sum + (sale.total - sale.paidAmount);
          }
          return sum;
        }, 0);

        const t = c.type;
        const contactType: 'customer' | 'supplier' | 'both' =
          t === 'supplier' || t === 'customer' || t === 'both' ? t : 'customer';

        const nameKey = (c.name || '').trim().toLowerCase();
        let supplier_debt = 0;
        if (contactType === 'supplier' || contactType === 'both') {
          supplier_debt = expenses.reduce((sum, e) => {
            const ps = String(e.paymentStatus || '').toLowerCase();
            if (ps === 'paid') return sum;
            const desc = (e.description || '').trim().toLowerCase();
            if (desc !== nameKey) return sum;
            return sum + (Number(e.amount) || 0);
          }, 0);
        }

        return {
          id: c.id,
          name: c.name,
          email: c.email || null,
          phone: c.phone || null,
          type: contactType,
          credit_balance,
          supplier_debt,
        };
      });
      setContacts(mapped);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Error al cargar los contactos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSheet = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        name: contact.name,
        phone: contact.phone || '',
        email: contact.email || '',
        type: contact.type
      });
    } else {
      setEditingContact(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        type: 'customer'
      });
    }
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingContact(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      type: 'customer'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentBusiness?.id) {
      toast.error('No hay negocio seleccionado');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    try {
      if (editingContact) {
        // Update existing contact
        await apiService.updateCustomer(editingContact.id, currentBusiness.id, {
          name: formData.name.trim(),
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          type: formData.type,
        });
        toast.success('Contacto actualizado correctamente');
      } else {
        // Create new contact
        await apiService.createCustomer(currentBusiness.id, {
          name: formData.name.trim(),
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          type: formData.type,
          creditLimit: 0,
          currentBalance: 0
        });
        triggerInkDouble();
        toast.success('Contacto creado correctamente');
      }
      
      await loadContacts(); // ✅ Reload contacts
      handleCloseSheet();
    } catch (error) {
      console.error('Error al guardar contacto:', error);
      toast.error('Error al guardar el contacto');
    }
  };

  const handleDelete = async (contact: Contact) => {
    if (!currentBusiness?.id) return;
    
    if (confirm(`¿Eliminar a ${contact.name}?`)) {
      try {
        await apiService.deleteCustomer(contact.id, currentBusiness.id);
        toast.success('Contacto eliminado');
        await loadContacts(); // ✅ Reload contacts
      } catch (error) {
        console.error('Error al eliminar:', error);
        toast.error('Error al eliminar el contacto');
      }
    }
  };

  const handleOpenDebtInMovements = (contact: Contact) => {
    const hasSupplierDebt = contact.supplier_debt > 0 && (contact.type === 'supplier' || contact.type === 'both');
    const hasSaleDebt = contact.credit_balance > 0 && (contact.type === 'customer' || contact.type === 'both');

    if (hasSupplierDebt) {
      navigate('/movements', {
        state: {
          prefilterDebtSupplierId: contact.id,
          prefilterDebtSupplierName: contact.name,
          prefilterNonce: Date.now(),
        },
      });
      return;
    }

    if (hasSaleDebt) {
      navigate('/movements', {
        state: {
          prefilterDebtClientName: contact.name,
          prefilterDebtContactId: contact.id,
          prefilterNonce: Date.now(),
        },
      });
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'customer': return 'Cliente';
      case 'supplier': return 'Proveedor';
      case 'both': return 'Cliente & Proveedor';
      default: return type;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'customer': return 'bg-blue-100 text-blue-700';
      case 'supplier': return 'bg-orange-100 text-orange-700';
      case 'both': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const navigate = useNavigate();

  // ── Permisos de contactos ──────────────────────────────────────────────────
  const isOwner = currentBusiness?.role === 'owner' || currentBusiness?.permissions?.all === true;
  const contactPerms = currentBusiness?.permissions?.contacts;
  const canViewContacts  = isOwner || (contactPerms?.view   ?? false);
  const canCreateContact = isOwner || (contactPerms?.create ?? false);
  const canEditContact   = isOwner || (contactPerms?.edit   ?? false);
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Mobile Layout */}
      <div className="md:hidden">
        <PageHeader
          mobile={
            <div className="lg:hidden bg-white border-b">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate('/more')}
                    className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900">Contactos</h1>
                    <p className="text-sm text-gray-600">Clientes & Proveedores</p>
                  </div>
                </div>
              </div>

              {/* Mobile Search */}
              <div className="px-4 pb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar contacto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
              </div>

              {/* Mobile Filter Chips */}
              <div className="px-4 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    typeFilter === 'all'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Todos ({loading ? '…' : contacts.length})
                </button>
                <button
                  onClick={() => setTypeFilter('customer')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    typeFilter === 'customer'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  Clientes ({loading ? '…' : contacts.filter(c => c.type === 'customer' || c.type === 'both').length})
                </button>
                <button
                  onClick={() => setTypeFilter('supplier')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    typeFilter === 'supplier'
                      ? 'bg-orange-600 text-white'
                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  }`}
                >
                  Proveedores ({loading ? '…' : contacts.filter(c => c.type === 'supplier' || c.type === 'both').length})
                </button>
              </div>
            </div>
          }
        />

        {/* Sin acceso en móvil */}
        {!canViewContacts ? (
          <div className="p-8 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Sin acceso</p>
            <p className="text-sm text-gray-400 mt-1">No tienes permiso para ver los contactos.</p>
          </div>
        ) : (
          <>
            {/* Mobile Contact Cards */}
            <div className="p-4 space-y-3 pb-24">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={`contacts-mobile-skeleton-${idx}`} className="bg-white rounded-lg border p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-5 w-24 rounded-full" />
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Skeleton className="h-8 w-8 rounded-lg" />
                          <Skeleton className="h-8 w-8 rounded-lg" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-36" />
                        <Skeleton className="h-3 w-44" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No hay contactos</p>
                  <p className="text-sm text-gray-400 mb-4">
                    {searchTerm || typeFilter !== 'all' 
                      ? 'No se encontraron resultados'
                      : 'Comienza agregando tu primer contacto'}
                  </p>
                  {!searchTerm && typeFilter === 'all' && canCreateContact && (
                    <Button onClick={() => handleOpenSheet()} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Contacto
                    </Button>
                  )}
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div key={contact.id} className="bg-white rounded-lg border p-4 active:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1">{contact.name}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(contact.type)}`}>
                          {getTypeLabel(contact.type)}
                        </span>
                      </div>
                      <div className="flex gap-1 ml-2">
                        {canEditContact && (
                          <button
                            onClick={() => handleOpenSheet(contact)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canEditContact && (
                          <button
                            onClick={() => handleDelete(contact)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {contact.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="w-4 h-4 mr-2 text-gray-400" />
                          {contact.phone}
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-4 h-4 mr-2 text-gray-400" />
                          {contact.email}
                        </div>
                      )}
                      {contact.credit_balance + contact.supplier_debt > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-xs text-gray-500">Deuda pendiente</div>
                          <button
                            type="button"
                            onClick={() => handleOpenDebtInMovements(contact)}
                            className="text-red-600 font-semibold hover:underline underline-offset-2"
                          >
                            ${formatCurrency(contact.credit_balance + contact.supplier_debt)}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Mobile FAB — solo si puede crear */}
            {canCreateContact && (
              <div className="fixed bottom-20 right-4 z-20">
                <Button
                  onClick={() => handleOpenSheet()}
                  className="h-14 w-14 rounded-full shadow-lg"
                  size="icon"
                >
                  <Plus className="w-6 h-6" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block flex-1 overflow-auto">
        <div className="bg-white border-b px-4 sm:px-6 py-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Clientes & Proveedores</h1>
            <p className="text-sm text-gray-600 mt-1">Gestiona tus contactos de negocio</p>
          </div>
        </div>

        {!canViewContacts ? (
          <div className="p-6">
            <div className="bg-white rounded-lg border border-gray-300/90 shadow-[var(--shadow-card)] p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium text-lg">Sin acceso a contactos</p>
              <p className="text-sm text-gray-400 mt-1">No tienes permiso para ver esta sección.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Filters and Actions */}
            <div className="bg-white border-b px-4 sm:px-6 py-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Buscar por nombre, teléfono o correo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Type Filter */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setTypeFilter('all')}
                    className={`flex items-center gap-2 ${
                      typeFilter === 'all'
                        ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800 hover:text-white'
                        : ''
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Todos
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setTypeFilter('customer')}
                    className={`flex items-center gap-2 ${
                      typeFilter === 'customer'
                        ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800 hover:text-white'
                        : ''
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Clientes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setTypeFilter('supplier')}
                    className={`flex items-center gap-2 ${
                      typeFilter === 'supplier'
                        ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800 hover:text-white'
                        : ''
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Proveedores
                  </Button>
                </div>

                {/* Add Button — solo si puede crear */}
                {canCreateContact && (
                  <Button
                    onClick={() => handleOpenSheet()}
                    className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo Contacto
                  </Button>
                )}
              </div>
            </div>

            <>
              {/* Stats */}
              <div className="px-4 sm:px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Contactos</p>
                      <p className="text-2xl font-bold text-gray-900 tabular-nums">
                        {loading ? '—' : contacts.length}
                      </p>
                    </div>
                    <Users className="w-10 h-10 text-gray-400" />
                  </div>
                </SectionCard>
                <SectionCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Clientes</p>
                      <p className="text-2xl font-bold text-blue-600 tabular-nums">
                        {loading ? '—' : contacts.filter(c => c.type === 'customer' || c.type === 'both').length}
                      </p>
                    </div>
                    <User className="w-10 h-10 text-blue-400" />
                  </div>
                </SectionCard>
                <SectionCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Proveedores</p>
                      <p className="text-2xl font-bold text-orange-600 tabular-nums">
                        {loading ? '—' : contacts.filter(c => c.type === 'supplier' || c.type === 'both').length}
                      </p>
                    </div>
                    <Building2 className="w-10 h-10 text-orange-400" />
                  </div>
                </SectionCard>
              </div>

              {/* Contacts Table */}
              <div className="px-4 sm:px-6 pb-6">
                <div className="bg-white rounded-lg border border-gray-300/90 shadow-[var(--shadow-card)] overflow-hidden">
                {loading ? (
                  <div className="text-center py-16 px-4">
                    <div className="space-y-3">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={`contacts-desktop-skeleton-${idx}`} className="grid grid-cols-6 gap-4 items-center px-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-5 w-24 rounded-full" />
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-4 w-20" />
                          <div className="justify-self-end flex gap-2">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-2">No hay contactos</p>
                    <p className="text-gray-400 mb-4">
                      {searchTerm || typeFilter !== 'all' 
                        ? 'No se encontraron resultados con los filtros aplicados'
                        : 'Comienza agregando tu primer cliente o proveedor'}
                    </p>
                    {!searchTerm && typeFilter === 'all' && canCreateContact && (
                      <Button onClick={() => handleOpenSheet()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Contacto
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={dataTableThead}>
                        <tr>
                          <th className={dthLeft}>Nombre</th>
                          <th className={dthLeft}>Tipo</th>
                          <th className={dthLeft}>Teléfono</th>
                          <th className={dthLeft}>Correo</th>
                          <th className={dthLeft}>Deuda</th>
                          {canEditContact && <th className={dthRight}>Acciones</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredContacts.map((contact) => (
                          <tr key={contact.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{contact.name}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(contact.type)}`}>
                                {getTypeLabel(contact.type)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-600">
                              {contact.phone || '-'}
                            </td>
                            <td className="py-3 px-4 text-gray-600">
                              {contact.email || '-'}
                            </td>
                            <td className="py-3 px-4">
                              {contact.credit_balance + contact.supplier_debt > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDebtInMovements(contact)}
                                  className="text-red-600 font-medium hover:underline underline-offset-2"
                                >
                                  ${formatCurrency(contact.credit_balance + contact.supplier_debt)}
                                </button>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            {canEditContact && (
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenSheet(contact)}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(contact)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                </div>
              </div>
            </>
          </>
        )}
      </div>

      {/* Add/Edit Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="mx-[24px] my-[0px] p-[0px] space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Nombre <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Juan Pérez"
                required
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Teléfono
              </label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Ej: ejemplo@correo.com"
                type="email"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Tipo</Label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as 'customer' | 'supplier' | 'both',
                  })
                }
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="customer">Cliente</option>
                <option value="supplier">Proveedor</option>
                <option value="both">Cliente y proveedor</option>
              </select>
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 left-0 right-0 flex gap-3 pt-4 pb-4 bg-white border-t -mx-6 px-6 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseSheet}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                {editingContact ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}