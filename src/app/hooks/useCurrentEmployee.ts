import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBusiness } from '../contexts/BusinessContext';
import * as localStore from '../lib/localStorageService';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: any;
  is_owner: boolean;
}

export function useCurrentEmployee() {
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && currentBusiness) {
      // Buscar el empleado que coincide con el email del usuario actual
      const currentEmployee = localStore.getEmployeeByEmail(currentBusiness.id, user.email);
      setEmployee(currentEmployee);
      setLoading(false);
    } else {
      setEmployee(null);
      setLoading(false);
    }
  }, [user, currentBusiness]);

  return { employee, loading };
}
