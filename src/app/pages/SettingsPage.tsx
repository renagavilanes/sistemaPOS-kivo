import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useBusiness } from '../contexts/BusinessContext';
import { supabase } from '../lib/supabase';
import { BusinessLoadingOverlay } from '../components/BusinessLoadingOverlay';
import { toast } from 'sonner';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Settings, Store, Save, Upload, X, Building2, FileText, Receipt, Trash2, AlertTriangle, User, Mail, Calendar, Lock, ShieldCheck, Check, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { formatDate as formatDateUtil } from '../utils/date';
import { PageHeader } from '../components/layout/PageHeader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { supabaseProjectId } from '../../utils/supabase/publicEnv';
import { clearSessionBusinessId } from '../lib/businessSelectionStorage';

interface BusinessSettings {
  businessName: string;
  phone: string;
  address: string;
  logo: string;
  businessType: string;
  receiptMessage: string;
  taxRate: string;
  taxName: string;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { currentBusiness, refreshBusinesses, businesses } = useBusiness();
  const [saving, setSaving] = useState(false);
  const [deletingBusiness, setDeletingBusiness] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [showDeleteAccountPassword, setShowDeleteAccountPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [settings, setSettings] = useState<BusinessSettings>({
    businessName: '',
    phone: '',
    address: '',
    logo: '',
    businessType: '',
    receiptMessage: '¡Gracias por su compra!',
    taxRate: '15',
    taxName: 'IVA',
  });

  // Cargar configuración del negocio actual
  useEffect(() => {
    if (currentBusiness) {
      setSettings(prev => ({
        ...prev,
        businessName: currentBusiness.name || prev.businessName,
        phone: currentBusiness.phone || prev.phone,
        address: currentBusiness.address || prev.address,
        logo: currentBusiness.logo || currentBusiness.logo_url || prev.logo,
        businessType: currentBusiness.businessType || prev.businessType,
        receiptMessage: currentBusiness.receiptMessage || prev.receiptMessage,
        taxRate: currentBusiness.taxRate || prev.taxRate,
        taxName: currentBusiness.taxName || prev.taxName,
      }));
    }
  }, [currentBusiness]);

  const handleSave = async () => {
    if (!currentBusiness) {
      toast.error('No hay un negocio seleccionado');
      return;
    }

    setSaving(true);
    
    try {
      // 1️⃣ Actualizar en Supabase
      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          name: settings.businessName,
          phone: settings.phone,
          address: settings.address,
          logo_url: settings.logo, // La columna en la base de datos se llama logo_url
          updated_at: new Date().toISOString()
        })
        .eq('id', currentBusiness.id);

      if (updateError) {
        console.error('❌ Error actualizando negocio en Supabase:', updateError);
        toast.error('Error al guardar en la base de datos');
        setSaving(false);
        return;
      }

      console.log('✅ Negocio actualizado en Supabase correctamente');

      // 2️⃣ Actualizar localStorage para compatibilidad
      localStorage.setItem(`business_settings_${currentBusiness.id}`, JSON.stringify(settings));
      
      const business = JSON.parse(localStorage.getItem(`business_${currentBusiness.id}`) || '{}');
      if (business) {
        business.name = settings.businessName;
        business.phone = settings.phone;
        business.address = settings.address;
        business.logo = settings.logo;
        business.logo_url = settings.logo;
        business.businessType = settings.businessType;
        business.receiptMessage = settings.receiptMessage;
        business.taxRate = settings.taxRate;
        business.taxName = settings.taxName;
        business.updated_at = new Date().toISOString();
        localStorage.setItem(`business_${currentBusiness.id}`, JSON.stringify(business));
        
        const allBusinesses = JSON.parse(localStorage.getItem('pos_businesses') || '[]');
        const businessIndex = allBusinesses.findIndex((b: any) => b.id === currentBusiness.id);
        if (businessIndex !== -1) {
          allBusinesses[businessIndex] = {
            ...allBusinesses[businessIndex],
            name: settings.businessName,
            phone: settings.phone,
            address: settings.address,
            logo_url: settings.logo,
            updated_at: new Date().toISOString()
          };
          localStorage.setItem('pos_businesses', JSON.stringify(allBusinesses));
        }
      }

      // 3️⃣ Refrescar los negocios en el contexto
      await refreshBusinesses();
      
      // 4️⃣ Disparar evento para notificar el cambio
      window.dispatchEvent(new CustomEvent('businessUpdated', { detail: { businessId: currentBusiness.id } }));
      
      toast.success('Configuración guardada correctamente');
    } catch (error: any) {
      console.error('❌ Error guardando configuración:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof BusinessSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida');
      return;
    }

    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen es muy grande. Máximo 2MB');
      return;
    }

    // Convertir a base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setSettings(prev => ({ ...prev, logo: base64String }));
      toast.success('Logo cargado correctamente');
    };
    reader.onerror = () => {
      toast.error('Error al cargar la imagen');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings(prev => ({ ...prev, logo: '' }));
    toast.success('Logo eliminado');
  };

  const mapAuthPasswordError = (message: string): string => {
    const m = message.toLowerCase();
    if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
      return 'La contraseña actual es incorrecta';
    }
    if (m.includes('email not confirmed')) {
      return 'Debes verificar tu correo antes de cambiar la contraseña';
    }
    if (m.includes('same password')) {
      return 'La nueva contraseña debe ser distinta a la actual';
    }
    if (m.includes('password')) {
      return message;
    }
    return message;
  };

  const handleChangePassword = async () => {
    setPasswordError('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Por favor completa todos los campos');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!user?.email?.trim()) {
      setPasswordError('No hay email en la sesión; inicia sesión de nuevo e inténtalo');
      return;
    }

    const email = user.email.trim();

    const { data: sessionData } = await supabase.auth.getSession();
    const hasSupabaseSession = Boolean(sessionData.session?.user?.id);

    // Sin sesión Supabase: flujo antiguo solo en localStorage (muy pocos casos)
    if (!hasSupabaseSession) {
      const legacyAccounts = JSON.parse(localStorage.getItem('pos_saved_accounts') || '[]');
      const legacyAccount = Array.isArray(legacyAccounts)
        ? legacyAccounts.find(
            (a: { email?: string }) => (a?.email || '').toLowerCase() === email.toLowerCase(),
          )
        : null;
      if (legacyAccount && typeof legacyAccount.password === 'string') {
        if (legacyAccount.password !== passwordForm.currentPassword) {
          setPasswordError('La contraseña actual es incorrecta');
          return;
        }
        legacyAccount.password = passwordForm.newPassword;
        const updated = legacyAccounts.map((a: { email?: string }) =>
          (a?.email || '').toLowerCase() === email.toLowerCase() ? legacyAccount : a,
        );
        localStorage.setItem('pos_saved_accounts', JSON.stringify(updated));
        const currentSession = JSON.parse(localStorage.getItem('pos_session') || '{}');
        if (currentSession.user && (currentSession.user.email || '').toLowerCase() === email.toLowerCase()) {
          currentSession.user.password = passwordForm.newPassword;
          localStorage.setItem('pos_session', JSON.stringify(currentSession));
        }
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordError('');
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setChangePasswordDialogOpen(false);
        toast.success('Contraseña actualizada correctamente');
        return;
      }
      setPasswordError('No hay sesión activa. Cierra sesión e inicia de nuevo con tu correo.');
      return;
    }

    setPasswordBusy(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password: passwordForm.currentPassword,
      });
      if (signErr) {
        setPasswordError(mapAuthPasswordError(signErr.message));
        return;
      }

      const { error: updErr } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });
      if (updErr) {
        setPasswordError(mapAuthPasswordError(updErr.message));
        return;
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordError('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setChangePasswordDialogOpen(false);
      toast.success('Contraseña actualizada correctamente');
    } finally {
      setPasswordBusy(false);
    }
  };

  const businessTypes = [
    { id: 'store', label: 'Tienda', emoji: '🏪' },
    { id: 'restaurant', label: 'Restaurante', emoji: '🍕' },
    { id: 'cafe', label: 'Cafetería', emoji: '☕' },
    { id: 'supermarket', label: 'Supermercado', emoji: '🛒' },
    { id: 'salon', label: 'Salón de Belleza', emoji: '💇' },
    { id: 'hardware', label: 'Ferretería', emoji: '🔧' },
    { id: 'clothing', label: 'Ropa', emoji: '👕' },
    { id: 'tech', label: 'Tecnología', emoji: '📱' },
    { id: 'pharmacy', label: 'Farmacia', emoji: '💊' },
    { id: 'bakery', label: 'Panadería', emoji: '🥖' },
    { id: 'other', label: 'Otro', emoji: '🏢' },
  ];

  const handleDeleteBusiness = async () => {
    if (!currentBusiness) {
      toast.error('No hay un negocio seleccionado');
      return;
    }

    // Cerrar el diálogo de confirmación
    setDeleteDialogOpen(false);
    
    // Mostrar el overlay de loading
    setDeletingBusiness(true);

    try {
      console.log('🗑️ Iniciando eliminación del negocio:', currentBusiness.id);
      
      // 1️⃣ Eliminar de Supabase PRIMERO
      const { error: deleteError } = await supabase
        .from('businesses')
        .delete()
        .eq('id', currentBusiness.id);

      if (deleteError) {
        console.error('❌ Error eliminando negocio de Supabase:', deleteError);
        toast.error('Error al eliminar el negocio de la base de datos');
        setDeletingBusiness(false);
        return;
      }

      console.log('✅ Negocio eliminado de Supabase correctamente');

      // 2️⃣ Eliminar todos los datos del negocio de localStorage
      const keysToDelete = [
        `business_${currentBusiness.id}`,
        `business_settings_${currentBusiness.id}`,
        `products_${currentBusiness.id}`,
        `movements_${currentBusiness.id}`,
        `customers_${currentBusiness.id}`,
        `employees_${currentBusiness.id}`,
        `custom_categories_${currentBusiness.id}`,
      ];

      keysToDelete.forEach(key => {
        console.log('🗑️ Eliminando key de localStorage:', key);
        localStorage.removeItem(key);
      });

      // 3️⃣ Eliminar del array global de negocios en localStorage
      const allBusinesses = JSON.parse(localStorage.getItem('pos_businesses') || '[]');
      console.log('📋 Negocios antes de filtrar:', allBusinesses.length);
      const updatedBusinesses = allBusinesses.filter((b: any) => b.id !== currentBusiness.id);
      console.log('📋 Negocios después de filtrar:', updatedBusinesses.length);
      localStorage.setItem('pos_businesses', JSON.stringify(updatedBusinesses));

      // 4️⃣ Limpiar el negocio actual (puntero de sesión)
      clearSessionBusinessId();

      console.log('✅ Negocio eliminado completamente');
      
      // 5️⃣ Disparar evento para notificar la eliminación
      window.dispatchEvent(new CustomEvent('businessDeleted', { detail: { businessId: currentBusiness.id } }));
      
      // 6️⃣ Navegar a login forzando recarga completa
      setTimeout(() => {
        setDeletingBusiness(false);
        toast.success('Negocio eliminado correctamente', {
          description: 'Ahora puedes crear un nuevo negocio o seleccionar otro existente',
          duration: 4000,
        });
        // Forzar recarga completa para que el contexto se actualice
        window.location.href = '/login';
      }, 800);
    } catch (error: any) {
      console.error('❌ Error eliminando negocio:', error);
      toast.error('Error al eliminar el negocio');
      setDeletingBusiness(false);
    }
  };

  const ownedBusinessesCount = (businesses || []).filter((b: any) => b?.role === 'owner').length;
  const employeeBusinessesCount = (businesses || []).filter((b: any) => b?.role !== 'owner').length;

  const handleDeleteAccount = async () => {
    if (deleteAccountConfirmText.trim() !== 'ELIMINAR MI CUENTA') {
      toast.error('Debes escribir exactamente: ELIMINAR MI CUENTA');
      return;
    }

    if (!user?.email) {
      toast.error('No se pudo identificar tu cuenta. Inicia sesión nuevamente.');
      return;
    }

    if (!deleteAccountPassword) {
      toast.error('Ingresa tu contraseña actual para confirmar.');
      return;
    }

    setDeletingAccount(true);
    try {
      // Si el edge function todavía tiene `Verify JWT` activo, el gateway puede bloquear
      // la request aunque el endpoint revalide email/password. Para evitarlo, generamos
      // un JWT fresco con la contraseña actual y lo enviamos en Authorization.
      const signInRes = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deleteAccountPassword,
      });
      if (signInRes.error) {
        throw new Error(signInRes.error.message || 'Credenciales inválidas');
      }

      // Leer la sesión justo después del sign-in para evitar usar un token stale.
      const { data: sessionAfterSignIn } = await supabase.auth.getSession();
      const accessToken = sessionAfterSignIn.session?.access_token?.trim();

      if (!accessToken || typeof accessToken !== 'string') {
        throw new Error('No se pudo generar el token de sesión');
      }

      // El endpoint ahora revalida credenciales server-side (email + password),
      // por lo que no dependemos del JWT del cliente.
      console.log('🧾 [DELETE ACCOUNT] access token length:', accessToken.length);
      const response = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-3508045b/account/delete-self`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            confirmText: deleteAccountConfirmText.trim(),
            email: user.email,
            password: deleteAccountPassword,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'No se pudo eliminar la cuenta');
      }

      toast.success('Cuenta eliminada correctamente');
      setDeleteAccountDialogOpen(false);
      setDeleteAccountConfirmText('');
      setDeleteAccountPassword('');
      setShowDeleteAccountPassword(false);

      try {
        await signOut();
      } catch {
        // If auth user was deleted first, signOut may fail silently.
      }
      window.location.href = '/login';
    } catch (error: any) {
      console.error('❌ Error eliminando cuenta:', error);
      toast.error(error?.message || 'Error al eliminar la cuenta');
    } finally {
      setDeletingAccount(false);
    }
  };

  // Formatear fecha de creación
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No disponible';
    return formatDateUtil(dateString);
  };

  return (
    <div className="h-full overflow-auto bg-gray-50 pb-20 lg:pb-0">
      <PageHeader
        desktop={
          <div className="bg-white border-b px-4 py-4 sm:px-6">
            <div className="w-full md:mx-auto md:max-w-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
                  <p className="text-sm text-gray-600 mt-1">Gestiona tu cuenta y negocio</p>
                </div>
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="bg-white border-b px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/more')}
                className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
            </div>
          </div>
        }
      />

      {/* Content — en lg+ columna centrada; en móvil/tablet sin sidebar, ancho completo */}
      <div className="w-full space-y-4 p-4 md:mx-auto md:max-w-3xl md:p-6">
        {/* Información de la Cuenta - BLOQUEADA */}
        <div className="bg-white rounded-lg border">
          {/* Section Header */}
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Información de la Cuenta</h2>
              <p className="text-xs text-gray-600">Datos de acceso protegidos</p>
            </div>
          </div>

          {/* Section Content */}
          <div className="p-4 space-y-4">
            {/* Información Compacta */}
            <div className="space-y-3">
              {/* Email */}
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">Email de la cuenta</p>
                  <p className="font-medium text-gray-900 truncate">{user?.email || 'No disponible'}</p>
                </div>
                <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>

              {/* Miembro desde */}
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Miembro desde</p>
                  <p className="font-medium text-gray-900">{formatDate(user?.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Divisor */}
            <div className="border-t pt-4">
              <Button
                onClick={() => setChangePasswordDialogOpen(true)}
                variant="outline"
                className="w-full"
              >
                <Lock className="w-4 h-4 mr-2" />
                Cambiar Contraseña
              </Button>
            </div>
          </div>
        </div>

        {/* Información del Negocio - EDITABLE */}
        <div className="bg-white rounded-lg border">
          {/* Section Header */}
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Información del Negocio</h2>
              <p className="text-xs text-gray-600">Datos de tu empresa (editables)</p>
            </div>
          </div>

          {/* Section Content */}
          <div className="p-4 space-y-4">
            {/* Logo del Negocio */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Logo del Negocio</Label>
              
              {!settings.logo ? (
                <div>
                  <label 
                    htmlFor="logo-upload"
                    className="flex items-center justify-center gap-2 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">Seleccionar imagen</span>
                  </label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">JPG, PNG o GIF (máx. 2MB)</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-16 h-16 border-2 border-gray-200 rounded-lg overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
                    <img 
                      src={settings.logo} 
                      alt="Logo" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">Logo cargado</p>
                    <p className="text-xs text-gray-500">Aparecerá en los recibos</p>
                  </div>
                  <div className="flex gap-2">
                    <label 
                      htmlFor="logo-upload-change"
                      className="px-3 py-1.5 text-xs font-medium bg-white border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      Cambiar
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    id="logo-upload-change"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Nombre del Negocio */}
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-sm font-medium">Nombre del Negocio *</Label>
              <Input
                id="businessName"
                value={settings.businessName}
                onChange={(e) => handleChange('businessName', e.target.value)}
                placeholder="Ej: Tienda El Sol"
                className="h-10"
              />
            </div>

            {/* Grid 2 columnas en desktop */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">Teléfono del Negocio</Label>
                <Input
                  id="phone"
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+593 99 123 4567"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium">Dirección</Label>
                <Input
                  id="address"
                  value={settings.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Ej: Av. Amazonas N34-123, Quito"
                  className="h-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tipo de Negocio */}
        <div className="bg-white rounded-lg border">
          {/* Section Header */}
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
              <Store className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Tipo de Negocio</h2>
              <p className="text-xs text-gray-600">Categoría que mejor describe tu empresa</p>
            </div>
          </div>

          {/* Section Content */}
          <div className="p-4">
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {businessTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleChange('businessType', type.id)}
                  className={`p-3 rounded-lg border-2 transition-all hover:border-blue-300 flex flex-col items-center gap-1.5 ${
                    settings.businessType === type.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="text-2xl">{type.emoji}</div>
                  <div className="text-[10px] leading-tight font-medium text-gray-700 text-center">{type.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Configuración de Recibos */}
        <div className="bg-white rounded-lg border">
          {/* Section Header */}
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Configuración de Recibos</h2>
              <p className="text-xs text-gray-600">Personaliza tus comprobantes de venta</p>
            </div>
          </div>

          {/* Section Content */}
          <div className="p-4 space-y-4">
            {/* Mensaje en Recibos */}
            <div className="space-y-2">
              <Label htmlFor="receiptMessage" className="text-sm font-medium">Mensaje en Recibos</Label>
              <Textarea
                id="receiptMessage"
                value={settings.receiptMessage}
                onChange={(e) => handleChange('receiptMessage', e.target.value)}
                placeholder="Mensaje que aparecerá en los recibos"
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-gray-500">Aparecerá al final de cada recibo</p>
            </div>

            {/* Grid 2 columnas */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="taxName" className="text-sm font-medium">Nombre del Impuesto</Label>
                <Input
                  id="taxName"
                  value={settings.taxName}
                  onChange={(e) => handleChange('taxName', e.target.value)}
                  placeholder="IVA, IGV, IVU"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxRate" className="text-sm font-medium">Tasa de Impuesto (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  value={settings.taxRate}
                  onChange={(e) => handleChange('taxRate', e.target.value)}
                  placeholder="15"
                  min="0"
                  max="100"
                  step="0.01"
                  className="h-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Botón Guardar - Desktop */}
        <div className="hidden md:block">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            {saving ? (
              <>Guardando...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar Configuración
              </>
            )}
          </Button>
        </div>

        {/* Zona Peligrosa */}
        <div className="bg-white rounded-lg border border-red-200">
          {/* Section Header */}
          <div className="px-4 py-3 border-b border-red-200 bg-red-50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-red-900">Zona Peligrosa</h2>
              <p className="text-xs text-red-700">Acciones irreversibles</p>
            </div>
          </div>

          {/* Section Content */}
          <div className="p-4">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Eliminar Negocio</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Esta acción eliminará permanentemente todos los datos del negocio: productos, movimientos, clientes y empleados. 
                  Tu cuenta de usuario se mantendrá intacta.
                </p>
              </div>
              <Button
                onClick={() => setDeleteDialogOpen(true)}
                variant="destructive"
                className="w-full md:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar Negocio
              </Button>
            </div>

            <div className="pt-3 border-t border-red-100 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Eliminar Mi Cuenta</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Se eliminará tu acceso completo. Si eres propietario, también se eliminarán tus negocios.
                  Si eres empleado, se desactivarán tus vínculos con esos negocios.
                </p>
                <p className="text-xs text-gray-500">
                  Propietario en {ownedBusinessesCount} negocio(s) · Empleado en {employeeBusinessesCount} negocio(s)
                </p>
              </div>
              <Button
                onClick={() => setDeleteAccountDialogOpen(true)}
                variant="outline"
                className="w-full md:w-auto text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
              >
                <User className="w-4 h-4 mr-2" />
                Eliminar Mi Cuenta
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Botón Guardar Fijo - Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-10">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          {saving ? (
            <>Guardando...</>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Guardar Configuración
            </>
          )}
        </Button>
      </div>

      {/* Change Password Dialog */}
      <AlertDialog open={changePasswordDialogOpen} onOpenChange={setChangePasswordDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Cambiar Contraseña
            </AlertDialogTitle>
            <AlertDialogDescription>
              Actualiza tu contraseña de acceso
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Error Message */}
            {passwordError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{passwordError}</p>
              </div>
            )}

            {/* Contraseña Actual */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-sm font-medium">Contraseña Actual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Ingresa tu contraseña actual"
                  disabled={passwordBusy}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Nueva Contraseña */}
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium">Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  disabled={passwordBusy}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirmar Nueva Contraseña */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Repite la nueva contraseña"
                  minLength={6}
                  disabled={passwordBusy}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={passwordBusy}
              onClick={() => {
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setPasswordError('');
                setShowCurrentPassword(false);
                setShowNewPassword(false);
                setShowConfirmPassword(false);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              disabled={passwordBusy}
              onClick={() => void handleChangePassword()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {passwordBusy ? 'Guardando…' : 'Cambiar Contraseña'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              ¿Eliminar Negocio?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Esta accin es <strong>permanente e irreversible</strong>. Se eliminarán:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Todos los productos</li>
                  <li>Todos los movimientos (ventas y gastos)</li>
                  <li>Todos los clientes</li>
                  <li>Todos los empleados</li>
                  <li>Toda la configuración del negocio</li>
                </ul>
                <p className="font-semibold text-gray-900 pt-2">
                  Tu cuenta de usuario se mantendrá y podrás crear un nuevo negocio.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBusiness}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Sí, Eliminar Todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              ¿Eliminar mi cuenta?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Esta acción es <strong>irreversible</strong>. Para confirmar, escribe:
                </p>
                <p className="font-semibold text-gray-900">ELIMINAR MI CUENTA</p>
                <p className="text-sm text-gray-600">
                  Propietario en {ownedBusinessesCount} negocio(s) · Empleado en {employeeBusinessesCount} negocio(s)
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-account-confirm">Confirmación</Label>
            <Input
              id="delete-account-confirm"
              placeholder="Escribe: ELIMINAR MI CUENTA"
              value={deleteAccountConfirmText}
              onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
              disabled={deletingAccount}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-account-password">Contraseña actual</Label>
            <div className="relative">
              <Input
                id="delete-account-password"
                type={showDeleteAccountPassword ? 'text' : 'password'}
                placeholder="Ingresa tu contraseña"
                value={deleteAccountPassword}
                onChange={(e) => setDeleteAccountPassword(e.target.value)}
                disabled={deletingAccount}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowDeleteAccountPassword(!showDeleteAccountPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showDeleteAccountPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletingAccount}
              onClick={() => {
                setDeleteAccountConfirmText('');
                setDeleteAccountPassword('');
                setShowDeleteAccountPassword(false);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              onClick={() => void handleDeleteAccount()}
              disabled={deletingAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingAccount ? 'Eliminando…' : 'Sí, eliminar mi cuenta'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Business Deleting Overlay */}
      {deletingBusiness && <BusinessLoadingOverlay businessName={settings.businessName} businessLogo={settings.logo} />}
    </div>
  );
}