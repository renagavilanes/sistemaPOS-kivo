import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, X, UserPlus, Shield, CheckCircle2, XCircle, ChevronLeft, Wrench } from 'lucide-react';
import { supabaseAnonKey, supabaseProjectId } from '../../utils/supabase/publicEnv';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '../components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { Switch } from '../components/ui/switch';
import { Skeleton } from '../components/ui/skeleton';
import { rolePermissions } from '../data/mockEmployees';
import { Employee, EmployeeRole } from '../types';
import { toast } from 'sonner';
import { useScreenFx } from '../contexts/ScreenFxContext';
import { useBusiness } from '../contexts/BusinessContext';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../services/api';
import { useNavigate } from '../utils/navigate'; // ✅ Cambiado de 'react-router' a '../utils/navigate'
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/layout/PageHeader';
import {
  dataTableTheadSticky,
  dthLeft,
  dthRight,
  dthCenter,
} from '../lib/dataTableHeaderClasses';

// Función auxiliar para normalizar texto (remover tildes)
const normalizeText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

// Función para validar email
const validateEmail = (email: string) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Función para obtener el color del rol
const getRoleColor = (role: EmployeeRole) => {
  const colors: Record<EmployeeRole, string> = {
    Administrador: 'bg-purple-100 text-purple-700 border-purple-200',
    Gerente: 'bg-blue-100 text-blue-700 border-blue-200',
    Cajero: 'bg-green-100 text-green-700 border-green-200',
    Inventario: 'bg-orange-100 text-orange-700 border-orange-200',
    'Solo lectura': 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return colors[role];
};

// Función para obtener el nombre legible del permiso
const getPermissionLabel = (key: string) => {
  const labels: Record<string, string> = {
    sales: 'Ventas',
    expenses: 'Gastos',
    products: 'Productos',
    movements: 'Movimientos',
    reports: 'Reportes',
    employees: 'Empleados',
    settings: 'Configuración',
    contacts: 'Contactos',
  };
  return labels[key] || key;
};

// Función para obtener el nombre legible de las acciones
const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    view: 'Ver',
    create: 'Crear',
    edit: 'Editar',
    delete: 'Eliminar',
    cancel: 'Anular',
    export: 'Exportar',
    access: 'Acceder',
    createExpense: 'Crear Gasto',
  };
  return labels[action] || action;
};

// Permisos completos para Admin
const ADMIN_PERMISSIONS = {
  sales: { create: true, view: true, edit: true, cancel: true, createExpense: true },
  expenses: { create: true, view: true, edit: true, cancel: true },
  products: { create: true, view: true, edit: true, delete: true },
  movements: { view: true, edit: true, cancel: true },
  reports: { view: true, export: true },
  employees: { view: true, create: true, edit: true, delete: true },
  settings: { access: true },
  contacts: { view: true, create: true, edit: true },
};

export default function EmployeesPage() {
  const { currentBusiness } = useBusiness();
  const { triggerInkDouble } = useScreenFx();
  const { user } = useAuth();

  // ── Permisos del usuario actual ──────────────────────────────────────────
  const isCurrentUserOwner = currentBusiness?.role === 'owner' || currentBusiness?.permissions?.all === true;
  const empPerms = isCurrentUserOwner
    ? { view: true, create: true, edit: true, delete: true }
    : (currentBusiness?.permissions?.employees || {});
  const canCreate = isCurrentUserOwner || empPerms.create === true;
  const canEdit   = isCurrentUserOwner || empPerms.edit   === true;
  const canDelete = isCurrentUserOwner || empPerms.delete === true;
  // ─────────────────────────────────────────────────────────────────────────

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [repairingId, setRepairingId] = useState<string | null>(null);

  // Form states
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [employeeRole, setEmployeeRole] = useState<EmployeeRole>('Cajero');
  const [employeeIsActive, setEmployeeIsActive] = useState(true);
  const [customPermissions, setCustomPermissions] = useState(rolePermissions.Cajero);

  // Load employees from API
  useEffect(() => {
    if (currentBusiness && user) {
      loadEmployees();
    }
  }, [currentBusiness, user]);

  const loadEmployees = async () => {
    if (!currentBusiness || !user) return;
    
    setLoading(true);
    try {
      console.log('📥 Loading employees from API...');
      const employeesData = await api.getEmployees(currentBusiness.id);
      
      console.log('✅ Employees loaded:', employeesData.length);
      
      // Transform to match Employee interface
      const transformedEmployees: Employee[] = employeesData.map(emp => ({
        id: emp.id,
        userId: emp.userId, // ← preservar para detectar si el empleado vinculó su cuenta
        name: emp.name,
        email: emp.email,
        phone: emp.phone || undefined,
        role: mapRoleFromStorage(emp.role),
        permissions: emp.permissions,
        isActive: emp.is_active,
        isOwner: emp.is_owner,
        createdAt: emp.created_at
      }));
      
      setEmployees(transformedEmployees);
      
      // 🔧 AUTO-REPARACIÓN: Si no hay empleados, crear el empleado owner automáticamente
      if (transformedEmployees.length === 0) {
        console.log('🔧 No hay empleados, creando empleado Admin automáticamente...');
        try {
          await api.createEmployee(currentBusiness.id, {
            name: 'admin',
            email: user.email,
            phone: user.phone || null,
            role: 'admin',
            permissions: ADMIN_PERMISSIONS,
            is_owner: true
          });
          
          // Recargar empleados después de crear
          await loadEmployees();
          
          console.log('✅ Empleado Admin creado automáticamente');
          triggerInkDouble();
          toast.success('Tu cuenta de administrador ha sido creada');
        } catch (error) {
          console.error('❌ Error al crear empleado admin:', error);
          toast.error('Error al crear empleado administrador');
        }
      }
    } catch (error: any) {
      console.error('❌ Error loading employees:', error);
      toast.error('Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  // Map role from storage to EmployeeRole
  const mapRoleFromStorage = (role: string): EmployeeRole => {
    const roleMap: Record<string, EmployeeRole> = {
      'admin': 'Administrador',
      'manager': 'Gerente',
      'cashier': 'Cajero',
      'inventory': 'Inventario',
      'readonly': 'Solo lectura'
    };
    return roleMap[role] || 'Cajero';
  };

  // Map role to storage format
  const mapRoleToStorage = (role: EmployeeRole): string => {
    const roleMap: Record<EmployeeRole, string> = {
      'Administrador': 'admin',
      'Gerente': 'manager',
      'Cajero': 'cashier',
      'Inventario': 'inventory',
      'Solo lectura': 'readonly'
    };
    return roleMap[role] || 'cashier';
  };

  // Filtered employees
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = 
      normalizeText(employee.name).includes(normalizeText(searchTerm)) ||
      normalizeText(employee.email).includes(normalizeText(searchTerm));
    return matchesSearch;
  });

  // Statistics
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.isActive).length;

  // Handle create/edit employee
  const handleSaveEmployee = async () => {
    // Si estamos editando al propietario, solo validar nombre
    if (editingEmployee?.isOwner) {
      if (!employeeName) {
        toast.error('Por favor ingresa un nombre');
        return;
      }
      
      if (!currentBusiness) return;
      
      setLoading(true);
      try {
        // Solo actualizar el nombre del propietario
        await api.updateEmployee(editingEmployee.id, currentBusiness.id, {
          name: employeeName,
          // Mantener todos los demás valores sin cambios
          email: editingEmployee.email,
          phone: editingEmployee.phone || null,
          role: mapRoleToStorage(editingEmployee.role),
          permissions: editingEmployee.permissions,
          is_active: editingEmployee.isActive,
        });
        
        await loadEmployees();
        toast.success('Nombre actualizado correctamente');
      } catch (error: any) {
        toast.error(error.message || 'Error al actualizar nombre');
        console.error(error);
      } finally {
        setLoading(false);
      }
      
      resetForm();
      setCreateSheetOpen(false);
      return;
    }
    
    // Validación normal para otros empleados
    if (!employeeName || !employeeEmail) {
      toast.error('Por favor completa el nombre y correo electrónico');
      return;
    }

    if (!validateEmail(employeeEmail)) {
      toast.error('Por favor ingresa un correo electrónico válido');
      return;
    }

    // Verificar email duplicado
    const emailExists = employees.some(
      e => e.email === employeeEmail && e.id !== editingEmployee?.id
    );
    if (emailExists) {
      toast.error('Este correo electrónico ya está registrado');
      return;
    }

    if (!currentBusiness) return;

    setLoading(true);
    try {
      if (editingEmployee) {
        // Update existing employee
        await api.updateEmployee(editingEmployee.id, currentBusiness.id, {
          name: employeeName,
          email: employeeEmail,
          phone: employeePhone || null,
          role: mapRoleToStorage(employeeRole),
          permissions: customPermissions,
          is_active: employeeIsActive,
        });
        
        await loadEmployees();
        toast.success('Empleado actualizado correctamente');
      } else {
        // Invite new employee (create with temporary password)
        const result = await api.inviteEmployee(currentBusiness.id, {
          name: employeeName,
          email: employeeEmail,
          phone: employeePhone || null,
          role: mapRoleToStorage(employeeRole),
          permissions: customPermissions,
        });
        
        // Show success message
        triggerInkDouble();
        toast.success('✅ Invitación enviada exitosamente', {
          description: `Se ha enviado un correo a ${employeeEmail} con las instrucciones para completar su registro.`,
          duration: 5000,
        });
        
        // Reload employees to show the new one
        await loadEmployees();
      }
    } catch (error: any) {
      toast.error(error.message || `Error al ${editingEmployee ? 'actualizar' : 'crear'} empleado`);
      console.error(error);
    } finally {
      setLoading(false);
    }

    resetForm();
    setCreateSheetOpen(false);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeName(employee.name);
    setEmployeeEmail(employee.email);
    setEmployeePhone(employee.phone || '');
    setEmployeeRole(employee.role);
    setEmployeeIsActive(employee.isActive);
    setCustomPermissions(employee.permissions);
    setCreateSheetOpen(true);
  };

  const handleDeleteClick = (employee: Employee) => {
    if (employee.isOwner) {
      toast.error('No puedes eliminar al propietario del negocio');
      return;
    }
    setEmployeeToDelete(employee);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (employeeToDelete && currentBusiness) {
      setLoading(true);
      try {
        await api.deleteEmployee(employeeToDelete.id, currentBusiness.id);
        await loadEmployees();
        toast.success('Empleado eliminado correctamente');
      } catch (error: any) {
        toast.error(error.message || 'Error al eliminar empleado');
        console.error(error);
      } finally {
        setLoading(false);
      }
      setEmployeeToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const resetForm = () => {
    setEditingEmployee(null);
    setEmployeeName('');
    setEmployeeEmail('');
    setEmployeePhone('');
    setEmployeeRole('Cajero');
    setEmployeeIsActive(true);
    setCustomPermissions(rolePermissions.Cajero);
  };

  const handleRoleChange = (role: EmployeeRole) => {
    // Validar que el rol sea válido antes de actualizar
    const validRoles: EmployeeRole[] = ['Administrador', 'Gerente', 'Cajero', 'Inventario', 'Solo lectura'];
    if (!validRoles.includes(role)) {
      console.error('Rol inválido:', role);
      return;
    }
    
    // Actualizar ambos estados en la misma función para evitar re-renders múltiples
    const permissions = rolePermissions[role] || rolePermissions.Cajero;
    
    setEmployeeRole(role);
    setCustomPermissions(permissions);
  };

  const togglePermission = (key: keyof typeof customPermissions) => {
    setCustomPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const navigate = useNavigate();

  const handleRepairLink = async (employee: Employee) => {
    if (!currentBusiness) return;
    setRepairingId(employee.id);
    try {
      console.log('🔧 [REPAIR] Iniciando reparación para:', employee.email);
      const res = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/repair-employee-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ businessId: currentBusiness.id, email: employee.email }),
        }
      );
      const data = await res.json();
      console.log('🔧 [REPAIR] Respuesta:', res.status, data);
      if (!res.ok) throw new Error(data.error || `Error ${res.status} al reparar vínculo`);
      
      toast.success('✅ Vínculo reparado', {
        description: data.message,
        duration: 5000,
      });
      await loadEmployees();
    } catch (err: any) {
      console.error('❌ [REPAIR] Error:', err);
      toast.error(err.message || 'Error al reparar vínculo');
    } finally {
      setRepairingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <PageHeader
        desktop={
          <div className="bg-white border-b px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Empleados</h1>
                <div className="flex flex-wrap gap-4 mt-1.5 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <span>Total de empleados:</span>
                    <span className="font-semibold text-gray-900">{totalEmployees}</span>
                  </div>
                  <span className="text-gray-300">|</span>
                  <div className="flex items-center gap-1.5">
                    <span>Activos:</span>
                    <span className="font-semibold text-gray-900">{activeEmployees}</span>
                  </div>
                </div>
              </div>
              {canCreate && (
                <Button
                  onClick={() => {
                    resetForm();
                    setCreateSheetOpen(true);
                  }}
                  className="bg-gray-900 hover:bg-gray-800"
                  disabled={loading}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Crear empleado
                </Button>
              )}
            </div>
          </div>
        }
        mobile={
          <div className="bg-white border-b px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => window.history.back()}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Empleados</h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <span>Total:</span>
                <span className="font-semibold text-gray-900">{totalEmployees}</span>
              </div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1.5">
                <span>Activos:</span>
                <span className="font-semibold text-gray-900">{activeEmployees}</span>
              </div>
            </div>
          </div>
        }
      />

      {/* Search - Desktop */}
      <div className="hidden md:block bg-white border-b px-4 sm:px-6 py-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre o correo"
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
      </div>

      {/* Search - Mobile */}
      <div className="md:hidden bg-white border-b px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar empleado"
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
      </div>

      {/* Employees Table - Desktop */}
      <div className="hidden md:block flex-1 overflow-auto px-4 sm:px-6 py-4">
        <div className="bg-white rounded-lg border overflow-hidden flex flex-col h-full">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full">
              <thead className={dataTableTheadSticky}>
                <tr>
                  <th className={dthLeft}>Nombre</th>
                  <th className={dthLeft}>Correo</th>
                  <th className={dthLeft}>Rol</th>
                  <th className={dthCenter}>Estado</th>
                  <th className={dthRight}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={`employees-skeleton-row-${idx}`}>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20 mx-auto" /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Skeleton className="h-8 w-16" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No se encontraron empleados
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{employee.name}</span>
                            {employee.isOwner && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                Propietario
                              </Badge>
                            )}
                          </div>
                          {employee.phone && (
                            <div className="text-xs text-gray-500">{employee.phone}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{employee.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={getRoleColor(employee.role)}>
                          {employee.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {employee.isActive ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-green-600 font-medium">Activo</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-500">Inactivo</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEmployee(employee)}
                              disabled={loading}
                            >
                              <Edit2 className="w-4 h-4 mr-1" />
                              {employee.isOwner ? 'Editar nombre' : 'Editar'}
                            </Button>
                          )}
                          {!employee.isOwner && canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(employee)}
                              disabled={loading}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                          {/* Botón reparar — visible cuando userId es null o undefined (invitado sin vincular) */}
                          {!employee.userId && !employee.isOwner && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Reparar vínculo de cuenta"
                              onClick={() => handleRepairLink(employee)}
                              disabled={loading || repairingId === employee.id}
                            >
                              <Wrench className={`w-4 h-4 ${repairingId === employee.id ? 'animate-spin text-gray-400' : 'text-blue-600'}`} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Employees Grid - Mobile */}
      <div className="md:hidden flex-1 overflow-auto px-4 py-4 pb-20">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={`employees-mobile-skeleton-${idx}`} className="bg-white rounded-lg border p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                  <Skeleton className="h-3 w-44" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No se encontraron empleados
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                className={`bg-white rounded-lg border p-4 ${canEdit ? 'cursor-pointer' : ''}`}
                onClick={() => canEdit && handleEditEmployee(employee)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{employee.name}</span>
                      {employee.isOwner && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          Propietario
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-1">{employee.email}</div>
                    {employee.phone && (
                      <div className="text-xs text-gray-500">{employee.phone}</div>
                    )}
                  </div>
                  {!employee.isOwner && canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(employee);
                      }}
                      className="h-8 w-8 -mt-1 -mr-1"
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                  {/* Botón reparar — visible cuando userId es null o undefined (invitado sin vincular) */}
                  {!employee.isOwner && !employee.userId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Reparar vínculo de cuenta"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRepairLink(employee);
                      }}
                      className="h-8 w-8 -mt-1 -mr-1"
                      disabled={loading || repairingId === employee.id}
                    >
                      <Wrench className={`w-4 h-4 ${repairingId === employee.id ? 'animate-spin text-gray-400' : 'text-blue-600'}`} />
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={getRoleColor(employee.role)}>
                    {employee.role}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    {employee.isActive ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">Activo</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">Inactivo</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button - Mobile */}
      {canCreate && (
        <div className="md:hidden fixed bottom-20 right-4 z-10">
          <Button
            onClick={() => {
              resetForm();
              setCreateSheetOpen(true);
            }}
            className="h-14 w-14 rounded-full shadow-lg bg-gray-900 hover:bg-gray-800"
            size="icon"
            disabled={loading}
          >
            <UserPlus className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Create/Edit Employee Sheet */}
      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col h-full">
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle>
                  {editingEmployee?.isOwner 
                    ? 'Editar mi nombre' 
                    : editingEmployee 
                      ? 'Editar empleado' 
                      : 'Crear empleado'}
                </SheetTitle>
                <SheetDescription>
                  {editingEmployee?.isOwner 
                    ? 'Solo puedes cambiar tu nombre como propietario' 
                    : 'Completa la información del empleado y asigna su rol'}
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <button className="rounded-full p-1.5 hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </SheetClose>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Employee Name */}
              <div className="space-y-2">
                <Label>Nombre completo*</Label>
                <Input
                  placeholder="Ej: Juan Pérez"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="h-12"
                />
              </div>

              {/* Solo mostrar los demás campos si NO es propietario */}
              {!editingEmployee?.isOwner && (
                <>
                  {/* Email */}
                  <div className="space-y-2">
                    <Label>Correo electrónico*</Label>
                    <Input
                      type="email"
                      placeholder="Ej: juan@example.com"
                      value={employeeEmail}
                      onChange={(e) => setEmployeeEmail(e.target.value)}
                      className="h-12"
                    />
                    <p className="text-xs text-gray-500">
                      El empleado usará este correo para iniciar sesión
                    </p>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label>Teléfono (opcional)</Label>
                    <Input
                      type="tel"
                      placeholder="Ej: +593 99 123 4567"
                      value={employeePhone}
                      onChange={(e) => setEmployeePhone(e.target.value)}
                      className="h-12"
                    />
                  </div>

                  {/* Role */}
                  <div className="space-y-2">
                    <Label>Rol*</Label>
                    <select
                      value={employeeRole}
                      onChange={(e) => {
                        const role = e.target.value as EmployeeRole;
                        setEmployeeRole(role);
                        setCustomPermissions(rolePermissions[role] || rolePermissions.Cajero);
                      }}
                      className="flex h-12 w-full items-center justify-between rounded-md border border-input bg-input-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="Administrador">Administrador</option>
                      <option value="Gerente">Gerente</option>
                      <option value="Cajero">Cajero</option>
                      <option value="Inventario">Inventario</option>
                      <option value="Solo lectura">Solo lectura</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                        {employeeIsActive ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Estado del empleado</div>
                        <div className="text-sm text-gray-500">
                          {employeeIsActive ? 'Activo' : 'Inactivo'}
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={employeeIsActive}
                      onCheckedChange={setEmployeeIsActive}
                    />
                  </div>
                </>
              )}

              {/* Permissions - Solo mostrar si NO es propietario */}
              {!editingEmployee?.isOwner && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-600" />
                    <Label>Permisos detallados</Label>
                  </div>
                  <div className="space-y-3">
                    {/* Lista fija de módulos para garantizar que siempre aparezcan todos, incluso si faltan en BD */}
                    {(['sales', 'products', 'movements', 'contacts', 'reports', 'employees', 'settings'] as const).map((moduleKey) => {
                      const modulePermissions = (customPermissions as any)[moduleKey] ?? {};
                      // El módulo "reports" está integrado en Movimientos, no se muestra aquí
                      // El módulo "settings" es solo para el owner, no se expone a empleados
                      if (moduleKey === 'reports' || moduleKey === 'settings') return null;
                      return (
                      <div key={moduleKey} className="border rounded-lg overflow-hidden">
                        {(moduleKey === 'reports' || moduleKey === 'settings') ? null : (<>
                        <div className="bg-gray-100 px-3 py-2 border-b">
                          <span className="text-sm font-semibold text-gray-900">
                            {getPermissionLabel(moduleKey)}
                          </span>
                        </div>
                        <div className="p-2 space-y-1">
                          {(moduleKey === 'sales'
                              ? (['create', 'edit', 'createExpense'] as const).map(k => [k, (modulePermissions as any)[k] ?? false] as [string, boolean])
                              : moduleKey === 'movements'
                              ? (['view', 'edit', 'delete', 'export', 'reports'] as const).map(k => [k, (modulePermissions as any)[k] ?? false] as [string, boolean])
                              : moduleKey === 'contacts'
                              ? (['view', 'create', 'edit'] as const).map(k => [k, (modulePermissions as any)[k] ?? false] as [string, boolean])
                              : Object.entries(modulePermissions)
                            )
                            .map(([actionKey, actionValue]) => {
                              const salesCreate = (customPermissions as any).sales?.create ?? false;
                              const movementsView = (customPermissions as any).movements?.view ?? false;
                              const contactsView = (customPermissions as any).contacts?.view ?? false;

                              // Ventas: edit y createExpense dependen de create
                              const isSalesEdit = moduleKey === 'sales' && actionKey === 'edit';
                              const isSalesCreateExpense = moduleKey === 'sales' && actionKey === 'createExpense';

                              // Movimientos: edit, delete, export dependen de view
                              const isMovementsDependant = moduleKey === 'movements' && (actionKey === 'edit' || actionKey === 'delete' || actionKey === 'export' || actionKey === 'reports');

                              // Contactos: create y edit dependen de view
                              const isContactsDependant = moduleKey === 'contacts' && (actionKey === 'create' || actionKey === 'edit');

                              const isDisabled =
                                ((isSalesEdit || isSalesCreateExpense) && !salesCreate) ||
                                (isMovementsDependant && !movementsView) ||
                                (isContactsDependant && !contactsView);

                              // Descripciones por acción y módulo
                              const getDescription = () => {
                                if (isSalesEdit) return 'Permite modificar el precio al vender';
                                if (isSalesCreateExpense) return 'Permite registrar gastos desde ventas';
                                if (moduleKey === 'movements') {
                                  if (actionKey === 'view') return 'Acceso a la pantalla de movimientos';
                                  if (actionKey === 'edit') return 'Puede cambiar fechas y datos del movimiento';
                                  if (actionKey === 'delete') return 'Puede eliminar ventas y gastos registrados';
                                  if (actionKey === 'export') return 'Puede descargar el historial de movimientos';
                                  if (actionKey === 'reports') return 'Puede ver el panel de reportes y gráficas';
                                }
                                if (moduleKey === 'contacts') {
                                  if (actionKey === 'view') return 'Acceso a la pantalla de contactos';
                                  if (actionKey === 'create') return 'Puede agregar nuevos clientes y proveedores';
                                  if (actionKey === 'edit') return 'Puede editar los datos de un contacto';
                                }
                                return null;
                              };
                              const description = getDescription();

                              return (
                                <div
                                  key={actionKey}
                                  className={`flex items-center justify-between px-2 py-2 rounded ${isDisabled ? 'opacity-40' : 'hover:bg-gray-50'}`}
                                >
                                  <div>
                                    <span className="text-sm text-gray-700">
                                      {actionKey === 'reports' ? 'Reportes' : getActionLabel(actionKey)}
                                    </span>
                                    {description && (
                                      <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                                    )}
                                  </div>
                                  <Switch
                                    checked={actionValue as boolean}
                                    disabled={isDisabled}
                                    onCheckedChange={() => {
                                      if (moduleKey === 'sales' && actionKey === 'create') {
                                        const newCreate = !(actionValue as boolean);
                                        setCustomPermissions(prev => ({
                                          ...prev,
                                          sales: {
                                            ...(prev as any).sales,
                                            create: newCreate,
                                            edit: newCreate ? (prev as any).sales?.edit ?? false : false,
                                            createExpense: newCreate ? (prev as any).sales?.createExpense ?? false : false,
                                          },
                                        }));
                                      } else if (moduleKey === 'movements' && actionKey === 'view') {
                                        const newView = !(actionValue as boolean);
                                        setCustomPermissions(prev => ({
                                          ...prev,
                                          movements: {
                                            ...(prev as any).movements,
                                            view: newView,
                                            edit: newView ? (prev as any).movements?.edit ?? false : false,
                                            delete: newView ? (prev as any).movements?.delete ?? false : false,
                                            export: newView ? (prev as any).movements?.export ?? false : false,
                                            reports: newView ? (prev as any).movements?.reports ?? false : false,
                                          },
                                        }));
                                      } else if (moduleKey === 'contacts' && actionKey === 'view') {
                                        const newView = !(actionValue as boolean);
                                        setCustomPermissions(prev => ({
                                          ...prev,
                                          contacts: {
                                            ...(prev as any).contacts,
                                            view: newView,
                                            create: newView ? (prev as any).contacts?.create ?? false : false,
                                            edit: newView ? (prev as any).contacts?.edit ?? false : false,
                                          },
                                        }));
                                      } else {
                                        setCustomPermissions(prev => ({
                                          ...prev,
                                          [moduleKey]: {
                                            ...prev[moduleKey as keyof typeof prev],
                                            [actionKey]: !actionValue,
                                          },
                                        }));
                                      }
                                    }}
                                  />
                                </div>
                              );
                            })}
                        </div>
                        </>)}
                      </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-500">
                    Los permisos se asignan automáticamente según el rol, pero puedes personalizarlos de forma específica
                  </p>
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
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEmployee}
                className="flex-1 bg-gray-900 hover:bg-gray-800"
                disabled={loading}
              >
                {loading ? 'Guardando...' : editingEmployee?.isOwner 
                  ? 'Actualizar nombre' 
                  : editingEmployee 
                    ? 'Actualizar' 
                    : 'Crear empleado'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar a "{employeeToDelete?.name}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={loading}
            >
              {loading ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}