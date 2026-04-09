import { useState } from 'react';
import { Building2, Check, ChevronDown, Plus } from 'lucide-react';
import { useBusiness } from '../contexts/BusinessContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';

const getRoleLabel = (business: any) => {
  if (!business?.employee_role) return 'Propietario';
  const map: Record<string, string> = {
    admin: 'Administrador', manager: 'Gerente', cashier: 'Cajero',
    inventory: 'Inventario', readonly: 'Solo lectura', employee: 'Empleado',
  };
  return map[business.employee_role] || 'Empleado';
};

interface MobileBusinessHeaderProps {
  rightContent?: React.ReactNode;
}

export function MobileBusinessHeader({ rightContent }: MobileBusinessHeaderProps) {
  const { currentBusiness, businesses, switchBusiness, createBusiness } = useBusiness();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');

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
  };

  // Obtener el logo del negocio actual
  const currentLogo = (currentBusiness as any)?.logo || (currentBusiness as any)?.logo_url;
  const businessKey = `${currentBusiness?.id}-${(currentBusiness as any)?.updated_at || Date.now()}`;

  return (
    <>
      {/* Header fijo en móvil */}
      <div className="md:hidden sticky top-0 z-20 bg-white border-b">
        <div className="flex items-center justify-between px-4 py-2.5">
          {/* Business Selector */}
          <DropdownMenu key={businessKey}>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1 min-w-0 text-left">
                {/* Logo circular más pequeño */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {currentLogo ? (
                    <img
                      key={businessKey}
                      src={currentLogo}
                      alt="Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Nombre del negocio */}
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {currentBusiness?.name || 'Mi Negocio'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                </div>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-[280px]">
              <DropdownMenuLabel className="text-xs font-medium text-gray-500">
                TUS NEGOCIOS
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Lista de negocios */}
              {businesses.map((business) => {
                const isActive = currentBusiness?.id === business.id;
                const logo = (business as any).logo || (business as any).logo_url;

                return (
                  <DropdownMenuItem
                    key={business.id}
                    onClick={() => handleSwitchBusiness(business.id)}
                    className="py-3 px-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {/* Logo */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {logo ? (
                          <img
                            src={logo}
                            alt={business.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-white" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-gray-900">
                          {business.name}
                        </div>
                        <div className="text-xs text-gray-500">{getRoleLabel(business)}</div>
                      </div>

                      {/* Check si está activo */}
                      {isActive && (
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })}

              <DropdownMenuSeparator />

              {/* Botón Agregar Negocio */}
              <DropdownMenuItem
                onClick={() => setIsCreateDialogOpen(true)}
                className="py-3 px-3 cursor-pointer text-blue-600 font-medium"
              >
                <Plus className="w-5 h-5 mr-2" />
                Agregar otro negocio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Contenido derecho (opcional: búsqueda, filtros, etc.) */}
          {rightContent && (
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {rightContent}
            </div>
          )}
        </div>
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
    </>
  );
}