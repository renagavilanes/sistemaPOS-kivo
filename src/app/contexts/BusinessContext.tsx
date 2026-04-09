import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import {
  clearSessionBusinessId,
  getSavedBusinessIdForUser,
  persistCurrentBusinessId,
} from '../lib/businessSelectionStorage';
import { BusinessLoadingOverlay } from '../components/BusinessLoadingOverlay';
import { toast } from 'sonner';

interface Business {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  country?: string;
  currency?: string;
  logo?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
  role?: 'owner' | 'employee'; // Agregar rol del usuario
  employee_role?: string | null; // Rol específico: cashier, manager, admin, etc.
  permissions?: any; // Permisos específicos del empleado
}

interface BusinessContextType {
  currentBusiness: Business | null;
  businesses: Business[];
  loading: boolean;
  error: string | null;
  switchBusiness: (businessId: string) => void;
  createBusiness: (data: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    tax_id?: string;
  }) => Promise<Business>;
  refreshBusinesses: () => Promise<void>;
  loadBusinesses: () => Promise<void>; // ⭐ EXPONER PÚBLICAMENTE
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { user, session, loading: authLoading } = useAuth();
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingBusinessName, setSwitchingBusinessName] = useState<string>('');
  const [switchingBusinessLogo, setSwitchingBusinessLogo] = useState<string | null>(null);
  // Guard: prevent concurrent/duplicate loadBusinesses calls
  const loadingRef = useRef(false);

  const loadBusinesses = useCallback(async () => {
    if (loadingRef.current) return; // already loading, skip
    loadingRef.current = true;

    if (!user) {
      setBusinesses([]);
      setCurrentBusiness(null);
      loadingRef.current = false;
      return;
    }

    try {
      setLoading(true);

      // 1. Obtener negocios donde el usuario es owner
      const { data: ownedBusinesses, error: ownedError } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id);
      
      if (ownedError) throw new Error(ownedError.message);

      // 2. Obtener negocios donde el usuario es empleado
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('business_id, role, permissions, is_active')
        .eq('user_id', user.id);

      if (employeeError) {
        console.error('⚠️ Error obteniendo empleados:', employeeError);
      }

      // 3. Obtener los negocios donde es empleado
      let employeeBusinesses: Business[] = [];
      if (employeeData && employeeData.length > 0) {
        const businessIds = employeeData.map((e: any) => e.business_id);
        const { data: empBiz, error: empBizError } = await supabase
          .from('businesses')
          .select('*')
          .in('id', businessIds);

        if (empBizError) {
          console.error('⚠️ Error obteniendo negocios de empleado:', empBizError);
        } else {
          employeeBusinesses = (empBiz || []).map((biz: any) => {
            const allEmpRows = (employeeData || []).filter((e: any) => e.business_id === biz.id);
            const empRow = allEmpRows.find((e: any) => e.is_active === true) || allEmpRows[0];
            console.log(`🏢 Permisos para negocio ${biz.name}: is_active=${empRow?.is_active}, role=${empRow?.role}`);
            return { 
              ...biz, 
              role: 'employee' as const,
              employee_role: empRow?.role || 'employee',
              permissions: empRow?.permissions || null
            };
          });
        }
      }

      // 4. Combinar listas (sin duplicados)
      const allBusinesses: Business[] = [];
      (ownedBusinesses || []).forEach((b: any) => {
        allBusinesses.push({ ...b, role: 'owner' as const, employee_role: null, permissions: { all: true } });
      });
      employeeBusinesses.forEach(eb => {
        const existingIndex = allBusinesses.findIndex(b => b.id === eb.id);
        if (existingIndex >= 0) {
          allBusinesses[existingIndex] = { ...allBusinesses[existingIndex], role: 'owner' as const, employee_role: null, permissions: { all: true } };
        } else {
          allBusinesses.push({ ...eb, role: 'employee' as const });
        }
      });

      console.log('🏢 Total negocios encontrados:', allBusinesses.length);
      setBusinesses(allBusinesses);

      // Seleccionar negocio (sesión activa o último usado por esta cuenta)
      if (allBusinesses.length > 0) {
        const savedBusinessId = getSavedBusinessIdForUser(user.id);
        const businessToSelect = savedBusinessId
          ? allBusinesses.find((b: Business) => b.id === savedBusinessId)
          : undefined;
        const selected = businessToSelect ?? allBusinesses[0];
        console.log('🎯 Negocio seleccionado:', selected.name, '(ID:', selected.id + ')');
        setCurrentBusiness(selected);
        persistCurrentBusinessId(user.id, selected.id);
      } else {
        setCurrentBusiness(null);
        clearSessionBusinessId();
      }
    } catch (err: any) {
      console.error('❌ ERROR CARGANDO NEGOCIOS:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsSwitching(false);
      setSwitchingBusinessName('');
      setSwitchingBusinessLogo(null);
      loadingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      loadBusinesses();
    }
  }, [user?.id, authLoading]); // use user.id not user object to avoid re-runs on same user

  const switchBusiness = (businessId: string) => {
    const business = businesses.find(b => b.id === businessId);
    if (business) {
      console.log('🔄 Cambiando a negocio:', business.name);
      
      // Mostrar loading overlay
      setIsSwitching(true);
      setSwitchingBusinessName(business.name);
      setSwitchingBusinessLogo(business.logo || null);
      
      setCurrentBusiness(business);
      persistCurrentBusinessId(user?.id, businessId);
      
      // Disparar evento para que todas las páginas recarguen sus datos
      window.dispatchEvent(new CustomEvent('businessChanged', { 
        detail: { businessId, businessName: business.name } 
      }));
      
      // Ocultar loading después de 1 segundo
      setTimeout(() => {
        setIsSwitching(false);
        setSwitchingBusinessName('');
        setSwitchingBusinessLogo(null);
      }, 1000);
    }
  };

  const createBusiness = async (data: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    tax_id?: string;
  }): Promise<Business> => {
    if (!user || !session) {
      throw new Error('Debes iniciar sesión para crear un negocio');
    }

    try {
      console.log('🏢 Creando nuevo negocio:', data.name);
      
      // Mostrar loading overlay
      setIsSwitching(true);
      setSwitchingBusinessName(data.name);
      setSwitchingBusinessLogo(null);

      const businessData = {
        name: data.name,
        owner_id: user.id,
        email: data.email,
        phone: data.phone,
        address: data.address,
        tax_id: data.tax_id,
        country: 'Colombia',
        currency: 'COP',
        active: true,
      };

      const { data: newBusiness, error } = await supabase
        .from('businesses')
        .insert([businessData])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      console.log('✅ Negocio creado:', newBusiness.id);

      // Actualizar lista de negocios
      const updatedBusinesses = [...businesses, newBusiness];
      setBusinesses(updatedBusinesses);
      
      // Seleccionar el nuevo negocio
      setCurrentBusiness(newBusiness);
      persistCurrentBusinessId(user?.id, newBusiness.id);
      
      // Disparar evento
      window.dispatchEvent(new CustomEvent('businessChanged', { 
        detail: { businessId: newBusiness.id, businessName: newBusiness.name } 
      }));
      
      // Ocultar loading
      setTimeout(() => {
        setIsSwitching(false);
        setSwitchingBusinessName('');
        setSwitchingBusinessLogo(null);
      }, 1000);

      return newBusiness;
    } catch (err: any) {
      console.error('❌ Error creando negocio:', err);
      setIsSwitching(false);
      setSwitchingBusinessName('');
      setSwitchingBusinessLogo(null);
      throw err;
    }
  };

  const refreshBusinesses = async () => {
    await loadBusinesses();
  };

  return (
    <BusinessContext.Provider
      value={{
        currentBusiness,
        businesses,
        loading,
        error,
        switchBusiness,
        createBusiness,
        refreshBusinesses,
        loadBusinesses, // ⭐ EXPONER PÚBLICAMENTE
      }}
    >
      {typeof document !== 'undefined' && isSwitching
        ? createPortal(
            <BusinessLoadingOverlay
              businessName={switchingBusinessName}
              businessLogo={switchingBusinessLogo}
            />,
            document.body,
          )
        : null}
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}