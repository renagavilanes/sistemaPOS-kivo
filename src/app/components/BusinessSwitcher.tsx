import { useState } from 'react';
import { Building2, Check, ChevronDown, Plus, X } from 'lucide-react';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './ui/sheet';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';

const getRoleLabel = (business: any) => {
  if (!business?.employee_role) return 'Propietario';
  const map: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    cashier: 'Cajero',
    inventory: 'Inventario',
    readonly: 'Solo lectura',
    employee: 'Empleado',
  };
  return map[business.employee_role] || 'Empleado';
};

export function BusinessSwitcher() {
  const { currentBusiness, businesses, switchBusiness, createBusiness } = useBusiness();
  const { user } = useAuth();
  const [isBusinessSheetOpen, setIsBusinessSheetOpen] = useState(false);
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
      setIsBusinessSheetOpen(false);
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
    setIsBusinessSheetOpen(false);
  };

  // Obtener el logo del negocio actual
  const currentLogo = (currentBusiness as any)?.logo || (currentBusiness as any)?.logo_url;

  return (
    <>
      {/* Botón para abrir el selector de negocios */}
      <Button
        variant="ghost"
        onClick={() => setIsBusinessSheetOpen(true)}
        className="w-full justify-between gap-2 h-auto py-3 px-3 hover:bg-gray-50 bg-transparent"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Logo */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {currentLogo ? (
              <img
                src={currentLogo}
                alt="Logo del negocio"
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="w-5 h-5 text-white" />
            )}
          </div>

          {/* Nombre y rol */}
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-semibold truncate text-gray-900">
              {currentBusiness?.name || 'Mi Negocio'}
            </div>
            <div className="text-xs text-gray-500">{getRoleLabel(currentBusiness)}</div>
          </div>
        </div>

        {/* Icono dropdown */}
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </Button>

      {/* Sheet para seleccionar negocio */}
      <Sheet open={isBusinessSheetOpen} onOpenChange={setIsBusinessSheetOpen}>
        <SheetContent side="left" className="w-[300px] sm:w-[400px]">
          <SheetHeader className="relative">
            <SheetTitle>Tus Negocios</SheetTitle>
            <SheetDescription>
              Cambia entre tus negocios o crea uno nuevo
            </SheetDescription>
            <button
              onClick={() => setIsBusinessSheetOpen(false)}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Cerrar</span>
            </button>
          </SheetHeader>

          <div className="mx-[24px] my-[0px]">
            {/* Lista de negocios */}
            {businesses.map((business) => {
              const isActive = currentBusiness?.id === business.id;
              const logo = (business as any).logo || (business as any).logo_url;

              return (
                <button
                  key={business.id}
                  onClick={() => handleSwitchBusiness(business.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 border-2 border-blue-200'
                      : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
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
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium truncate text-gray-900">
                      {business.name}
                    </div>
                    <div className="text-xs text-gray-500">{getRoleLabel(business)}</div>
                  </div>

                  {/* Check si está activo */}
                  {isActive && (
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                </button>
              );
            })}

            {/* Separador */}
            <div className="pt-2"></div>

            {/* Botón Agregar Negocio */}
            <button
              onClick={() => {
                setIsBusinessSheetOpen(false);
                setIsCreateDialogOpen(true);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border-2 border-dashed border-gray-300 text-blue-600 font-medium"
            >
              <Plus className="w-5 h-5" />
              Agregar otro negocio
            </button>
          </div>
        </SheetContent>
      </Sheet>

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