import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useBusiness } from './BusinessContext';
import * as apiService from '../services/api';

interface DataContextType {
  // Products
  products: any[];
  productsLoading: boolean;
  refreshProducts: () => Promise<void>;
  
  // Movements
  movements: any[];
  movementsLoading: boolean;
  refreshMovements: () => Promise<void>;
  
  // Customers
  customers: any[];
  customersLoading: boolean;
  refreshCustomers: () => Promise<void>;
  
  // Employees
  employees: any[];
  employeesLoading: boolean;
  refreshEmployees: () => Promise<void>;
  
  // Global refresh
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentBusiness } = useBusiness();
  
  // State
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  
  // Cache tracking - use ref to avoid triggering re-renders
  const lastBusinessIdRef = useRef<string | null>(null);
  
  // Products
  const refreshProducts = useCallback(async () => {
    if (!currentBusiness?.id) return;
    
    setProductsLoading(true);
    try {
      const data = await apiService.getProducts(currentBusiness.id);
      setProducts(data);
      console.log('✅ Products cached:', data.length);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setProductsLoading(false);
    }
  }, [currentBusiness?.id]);
  
  // Movements
  const refreshMovements = useCallback(async () => {
    if (!currentBusiness?.id) return;
    
    setMovementsLoading(true);
    try {
      const data = await apiService.getMovements(currentBusiness.id);
      setMovements(data);
      console.log('✅ Movements cached:', data.length);
    } catch (error) {
      console.error('Error loading movements:', error);
    } finally {
      setMovementsLoading(false);
    }
  }, [currentBusiness?.id]);
  
  // Customers
  const refreshCustomers = useCallback(async () => {
    if (!currentBusiness?.id) return;
    
    setCustomersLoading(true);
    try {
      const data = await apiService.getCustomers(currentBusiness.id);
      setCustomers(data);
      console.log('✅ Customers cached:', data.length);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setCustomersLoading(false);
    }
  }, [currentBusiness?.id]);
  
  // Employees
  const refreshEmployees = useCallback(async () => {
    if (!currentBusiness?.id) return;
    
    setEmployeesLoading(true);
    try {
      const data = await apiService.getEmployees(currentBusiness.id);
      setEmployees(data);
      console.log('✅ Employees cached:', data.length);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setEmployeesLoading(false);
    }
  }, [currentBusiness?.id]);
  
  // Refresh all data
  const refreshAll = useCallback(async () => {
    if (!currentBusiness?.id) return;
    
    console.log('🔄 Refreshing all data for business:', currentBusiness.id);
    await Promise.all([
      refreshProducts(),
      refreshMovements(),
      refreshCustomers(),
      refreshEmployees(),
    ]);
  }, [currentBusiness?.id, refreshProducts, refreshMovements, refreshCustomers, refreshEmployees]);
  
  // Auto-load data when business changes - ONLY TRACK BUSINESS ID
  useEffect(() => {
    if (!currentBusiness?.id) {
      // Clear data when no business
      setProducts([]);
      setMovements([]);
      setCustomers([]);
      setEmployees([]);
      lastBusinessIdRef.current = null;
      return;
    }
    
    // Only refresh if business changed
    if (currentBusiness.id !== lastBusinessIdRef.current) {
      console.log('🏢 Business changed, loading data:', currentBusiness.id);
      lastBusinessIdRef.current = currentBusiness.id;
      
      // Load all data directly
      (async () => {
        await Promise.all([
          refreshProducts(),
          refreshMovements(),
          refreshCustomers(),
          refreshEmployees(),
        ]);
      })();
    }
  }, [currentBusiness?.id]); // SOLO dependencia: currentBusiness?.id
  
  const value = {
    products,
    productsLoading,
    refreshProducts,
    
    movements,
    movementsLoading,
    refreshMovements,
    
    customers,
    customersLoading,
    refreshCustomers,
    
    employees,
    employeesLoading,
    refreshEmployees,
    
    refreshAll,
  };
  
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}