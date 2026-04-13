import { Settings, Users, BookUser, ChevronRight, Store, LogOut, Building2, Plus, ChevronDown, QrCode } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useBusiness } from '../contexts/BusinessContext';
import { Button } from '../components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { BusinessSelectorModal } from '../components/BusinessSelectorModal';
import { PageHeader } from '../components/layout/PageHeader';

const menuItems = [
  {
    name: 'Contactos',
    description: 'Gestiona tus clientes',
    icon: BookUser,
    href: '/contacts',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    name: 'Empleados',
    description: 'Administra tu equipo',
    icon: Users,
    href: '/employees',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    name: 'Configuración',
    description: 'Ajustes del negocio',
    icon: Settings,
    href: '/settings',
    color: 'bg-gray-100 text-gray-600',
  },
  {
    name: 'Catálogo virtual',
    description: 'QR y catálogo público',
    icon: QrCode,
    href: '/catalog/settings',
    color: 'bg-emerald-100 text-emerald-700',
  },
];

export default function MorePage() {
  const { user, signOut } = useAuth();
  const { currentBusiness: business, businesses, switchBusiness, createBusiness } = useBusiness();
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [isBusinessSelectorOpen, setIsBusinessSelectorOpen] = useState(false);

  const getFilteredMenuItems = () => {
    if (!business) return menuItems;
    if (business.role === 'owner' || business.permissions?.all === true) return menuItems;
    
    const perms = business.permissions || {};
    return menuItems.filter(item => {
      switch (item.href) {
        case '/contacts':
          return perms.contacts?.view === true; // Solo si tiene permiso de ver contactos
        case '/employees':
          return perms.employees?.view === true;
        case '/settings':
          return perms.settings?.access === true;
        case '/catalog/settings':
          return perms.settings?.access === true;
        default:
          return true;
      }
    });
  };

  const currentMenuItems = getFilteredMenuItems();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleCreateBusiness = async () => {
    if (!newBusinessName.trim()) {
      toast.error('Por favor ingresa el nombre del negocio');
      return;
    }

    setIsCreating(true);

    try {
      await createBusiness({
        name: newBusinessName.trim(),
        email: user?.email,
      });

      toast.success('Negocio creado exitosamente', {
        description: 'Ahora puedes gestionar este nuevo negocio',
      });

      setNewBusinessName('');
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      console.error('Error creando negocio:', error);
      toast.error('Error al crear negocio', {
        description: error.message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchBusiness = (businessId: string) => {
    switchBusiness(businessId);
    toast.success('Negocio cambiado', {
      description: businesses.find(b => b.id === businessId)?.name,
      duration: 2000,
    });
  };

  return (
    <div className="h-full overflow-auto bg-gray-50 pb-20 lg:pb-0">
      <PageHeader
        desktop={
          <div className="bg-white border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Más opciones</h1>
                <p className="text-sm text-gray-600 mt-1">Accede a todas las funcionalidades</p>
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="bg-white border-b px-4 py-4">
            <h1 className="text-xl font-bold text-gray-900">Más</h1>
          </div>
        }
      />

      {/* Business Info Card */}
      <div className="p-4">
        {/* Siempre clickeable en móvil para abrir modal */}
        <button
          onClick={() => setIsBusinessSelectorOpen(true)}
          className="w-full md:pointer-events-none"
        >
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow active:scale-[0.98] md:active:scale-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white/30">
                {(business?.logo || (business as any)?.logo_url) ? (
                  <img 
                    src={business.logo || (business as any).logo_url} 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Store className="w-7 h-7 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <h2 className="text-lg font-bold truncate mb-0.5">{business?.name || 'Mi Negocio'}</h2>
                <p className="text-sm text-white/90 truncate">{user?.email}</p>
                <p className="text-xs text-white/70 mt-1 md:hidden">{businesses.length} {businesses.length === 1 ? 'negocio' : 'negocios'}</p>
              </div>
              <ChevronDown className="w-5 h-5 text-white/80 flex-shrink-0 md:hidden" />
            </div>
          </div>
        </button>
      </div>

      {/* Menu Items */}
      <div className="px-4 space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-3">
          Opciones
        </h2>
        {currentMenuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.href}
              className="block bg-white rounded-lg border hover:border-blue-300 hover:shadow-sm transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-4 p-4">
                <div className={`w-11 h-11 rounded-lg ${item.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 mb-0.5">{item.name}</h3>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* App Info */}
      <div className="px-4 pt-8 pb-6">
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-sm font-semibold text-gray-900">Kivo</p>
          <p className="text-xs text-gray-500 mt-1">Versión 1.0.0</p>
          <p className="text-xs text-gray-400 mt-2">Desarrollado con ❤️</p>
        </div>
      </div>

      {/* Logout Button - Mobile Only */}
      <div className="md:hidden px-4 pb-8">
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-400"
          size="lg"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar Sesión
        </Button>
      </div>

      {/* Dialog para crear negocio */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Crear Nuevo Negocio
            </DialogTitle>
            <DialogDescription>
              Cada negocio tendrá sus propios productos, ventas, clientes y configuración independiente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-sm font-medium">
                Nombre del Negocio *
              </Label>
              <Input
                id="businessName"
                placeholder="Ej: Tienda Centro"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreating) {
                    handleCreateBusiness();
                  }
                }}
                className="h-10"
                autoFocus
              />
              <p className="text-xs text-gray-500">
                Podrás configurar más detalles después en Configuración
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewBusinessName('');
              }}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateBusiness}
              disabled={isCreating || !newBusinessName.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? (
                <>Creando...</>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Negocio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para seleccionar negocio */}
      <BusinessSelectorModal
        open={isBusinessSelectorOpen}
        onOpenChange={setIsBusinessSelectorOpen}
        businesses={businesses}
        currentBusiness={business}
        onSwitchBusiness={handleSwitchBusiness}
        onAddBusiness={() => {
          setIsBusinessSelectorOpen(false);
          setIsCreateDialogOpen(true);
        }}
      />
    </div>
  );
}