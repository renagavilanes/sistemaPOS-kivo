import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export interface Employee {
  id: string;
  business_id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  permissions: any;
  is_active: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

// Get all employees for a business
export async function getEmployees(businessId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting employees:', error);
    throw new Error(`Error getting employees: ${error.message}`);
  }

  return data || [];
}

// Get employee by ID
export async function getEmployeeById(employeeId: string, businessId: string): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .eq('business_id', businessId)
    .single();

  if (error) {
    console.error('Error getting employee:', error);
    throw new Error(`Error getting employee: ${error.message}`);
  }

  return data;
}

// Get employee by email
export async function getEmployeeByEmail(businessId: string, email: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('business_id', businessId)
    .ilike('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error getting employee by email:', error);
    throw new Error(`Error getting employee by email: ${error.message}`);
  }

  return data;
}

// Create employee
export async function createEmployee(businessId: string, employeeData: {
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  permissions: any;
  is_owner?: boolean;
  is_active?: boolean;
  user_id?: string | null;
}): Promise<Employee> {
  // Safely handle user_id - ensure it's a valid UUID or null
  let safeUserId: string | null = null;
  if (employeeData.user_id && typeof employeeData.user_id === 'string' && employeeData.user_id.length > 0 && employeeData.user_id !== 'undefined') {
    safeUserId = employeeData.user_id;
  }
  
  console.log('🔍 [DB] Creating employee with user_id:', safeUserId, 'type:', typeof safeUserId);
  
  const employee = {
    business_id: businessId,
    user_id: safeUserId,
    name: employeeData.name,
    email: employeeData.email,
    phone: employeeData.phone || null,
    role: employeeData.role,
    permissions: employeeData.permissions,
    is_active: employeeData.is_active !== undefined ? employeeData.is_active : true,
    is_owner: employeeData.is_owner || false,
  };

  const { data, error } = await supabase
    .from('employees')
    .insert(employee)
    .select()
    .single();

  if (error) {
    console.error('Error creating employee:', error);
    throw new Error(`Error creating employee: ${error.message}`);
  }

  console.log('✅ Employee created:', data.name, '(', data.email, ')');
  return data;
}

// Update employee
export async function updateEmployee(employeeId: string, businessId: string, updates: Partial<Employee>): Promise<Employee> {
  // Remove fields that shouldn't be updated
  const { id, business_id, created_at, ...allowedUpdates } = updates as any;

  const { data, error } = await supabase
    .from('employees')
    .update({
      ...allowedUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) {
    console.error('Error updating employee:', error);
    throw new Error(`Error updating employee: ${error.message}`);
  }

  console.log('✅ Employee updated:', data.name);
  return data;
}

// Delete (deactivate) employee
export async function deleteEmployee(employeeId: string, businessId: string): Promise<Employee> {
  // First check if employee is owner
  const employee = await getEmployeeById(employeeId, businessId);
  
  if (employee.is_owner) {
    throw new Error('Cannot delete owner employee');
  }

  const { data, error } = await supabase
    .from('employees')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) {
    console.error('Error deleting employee:', error);
    throw new Error(`Error deleting employee: ${error.message}`);
  }

  console.log('✅ Employee deactivated:', data.name);
  return data;
}