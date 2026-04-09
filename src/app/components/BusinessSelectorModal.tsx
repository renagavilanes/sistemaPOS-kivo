import { X, Building2, ChevronRight, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

interface Business {
  id: string;
  name: string;
  logo?: string;
  logo_url?: string;
  created_at?: string;
  role?: 'owner' | 'employee';
  employee_role?: 'admin' | 'manager' | 'cashier' | 'inventory' | 'readonly' | 'employee';
}

interface BusinessSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businesses: Business[];
  currentBusiness: Business | null;
  onSwitchBusiness: (businessId: string) => void;
  onAddBusiness?: () => void;
}

export function BusinessSelectorModal({
  open,
  onOpenChange,
  businesses,
  currentBusiness,
  onSwitchBusiness,
  onAddBusiness,
}: BusinessSelectorModalProps) {
  const navigate = useNavigate();

  const handleSwitchBusiness = (business: Business) => {
    if (business.id !== currentBusiness?.id) {
      onSwitchBusiness(business.id);
      onOpenChange(false);
    }
  };

  const handleEditBusiness = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/settings');
    onOpenChange(false);
  };

  const handleAddBusiness = () => {
    if (onAddBusiness) {
      onAddBusiness();
    } else {
      navigate('/settings');
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="p-0 gap-0 max-w-full w-full bottom-0 top-auto translate-y-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-3xl rounded-b-none border-0 max-h-[85vh] overflow-hidden"
        style={{
          animation: open ? 'slideUp 0.3s ease-out' : 'slideDown 0.2s ease-in'
        }}
      >
        <style>{`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
          @keyframes slideDown {
            from {
              transform: translateY(0);
            }
            to {
              transform: translateY(100%);
            }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-center px-5 py-4 border-b bg-white">
          <DialogTitle className="text-lg font-semibold text-gray-900">Cuentas</DialogTitle>
          <DialogDescription className="sr-only">
            Selecciona un negocio para gestionar o crea uno nuevo
          </DialogDescription>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-64px)] bg-gray-50">
          <div className="p-4 space-y-2">
            {businesses.map((business) => {
              const isActive = currentBusiness?.id === business.id;
              const logo = (business as any).logo || (business as any).logo_url;

              return (
                <button
                  key={business.id}
                  onClick={() => handleSwitchBusiness(business)}
                  className={`w-full rounded-2xl p-4 flex items-center gap-3 transition-all ${
                    isActive
                      ? 'bg-yellow-50 border-2 border-yellow-400'
                      : 'bg-white border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Logo */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {logo ? (
                      <img
                        src={logo}
                        alt={business.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-white" />
                    )}
                  </div>

                  {/* Business Info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {business.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {isActive 
                        ? 'Negocio actual' 
                        : (business as any).employee_role
                          ? (() => {
                              const map: Record<string, string> = {
                                admin: 'Administrador', manager: 'Gerente', cashier: 'Cajero',
                                inventory: 'Inventario', readonly: 'Solo lectura', employee: 'Empleado',
                              };
                              return map[(business as any).employee_role] || 'Empleado';
                            })()
                          : 'Propietario'
                      }
                    </div>
                  </div>

                  {/* Action */}
                  {isActive ? (
                    <ChevronRight className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
              );
            })}

            {/* Add Business Button */}
            <button
              onClick={handleAddBusiness}
              className="w-full rounded-2xl p-4 flex items-center gap-3 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Plus className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-blue-600">
                  Agregar otro negocio
                </div>
                <div className="text-sm text-gray-500">
                  Crear una nueva cuenta
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-400 flex-shrink-0" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}