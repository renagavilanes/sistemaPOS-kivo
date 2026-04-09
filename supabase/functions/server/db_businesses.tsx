// Database helper functions for businesses
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Get all businesses for a user
export async function getUserBusinesses(userId: string) {
  console.log('🔍 Getting businesses for user:', userId);
  
  // 1. Negocios donde el usuario es dueño
  const { data: ownedData, error: ownedError } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (ownedError) {
    console.error('❌ Error getting owned businesses:', ownedError);
    throw ownedError;
  }
  console.log('✅ Owned businesses:', ownedData?.length || 0);

  // 2. Negocios donde el usuario es empleado vinculado
  // Buscamos con user_id sin filtrar is_active para no perder vínculos recién reparados
  const { data: empRowsAll, error: empError } = await supabase
    .from('employees')
    .select('business_id, role, permissions, is_active')
    .eq('user_id', userId);

  if (empError) {
    console.error('❌ Error getting employee businesses:', empError);
    // No lanzar error — continuar solo con los propios
  }
  // Incluir todos los vínculos donde user_id esté asignado (is_active puede variar tras repair)
  const empRows = empRowsAll || [];
  console.log('✅ Employee links encontrados:', empRows.length, empRows.map((r: any) => `biz:${r.business_id} active:${r.is_active}`));

  // 3. Si no hay negocios como empleado, retornar solo los propios
  const employeeBusinessIds = (empRows || [])
    .map((r: any) => r.business_id)
    .filter((id: string) => !(ownedData || []).some((b: any) => b.id === id));

  let employedBusinesses: any[] = [];
  if (employeeBusinessIds.length > 0) {
    const { data: empBizData, error: empBizError } = await supabase
      .from('businesses')
      .select('*')
      .in('id', employeeBusinessIds)
      .eq('active', true);

    if (empBizError) {
      console.error('❌ Error getting employee business details:', empBizError);
    } else {
      // Anotar el rol del empleado en cada negocio
      employedBusinesses = (empBizData || []).map((biz: any) => {
        const empRow = (empRows || []).find((r: any) => r.business_id === biz.id);
        return { ...biz, employee_role: empRow?.role || 'employee' };
      });
      console.log('✅ Employed businesses loaded:', employedBusinesses.length);
    }
  }

  // 4. Combinar: primero los propios, luego los de empleado
  const owned = (ownedData || []).map((b: any) => ({ ...b, employee_role: null }));
  return [...owned, ...employedBusinesses];
}

// Get a single business by ID
export async function getBusinessById(businessId: string, userId: string) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .eq('owner_id', userId)
    .single();

  if (error) throw error;
  return data;
}

// Create a new business
export async function createBusiness(userId: string, businessData: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  country?: string;
  currency?: string;
}) {
  console.log('🏢 Creating business for user:', userId, '- Name:', businessData.name);
  
  const { data, error } = await supabase
    .from('businesses')
    .insert({
      name: businessData.name,
      email: businessData.email || null,
      phone: businessData.phone || null,
      address: businessData.address || null,
      tax_id: businessData.tax_id || null,
      country: businessData.country || 'CO',
      currency: businessData.currency || 'COP',
      owner_id: userId,
      active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating business:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
  
  console.log('✅ Business created:', data.id);
  return data;
}

// Update a business
export async function updateBusiness(businessId: string, userId: string, updates: {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  logo_url?: string;
}) {
  const { data, error } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', businessId)
    .eq('owner_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete (deactivate) a business
export async function deactivateBusiness(businessId: string, userId: string) {
  const { data, error } = await supabase
    .from('businesses')
    .update({ active: false })
    .eq('id', businessId)
    .eq('owner_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get businesses by email
export async function getBusinessesByEmail(email: string) {
  console.log('🔍 Getting businesses by email:', email);
  
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('email', email)
    .eq('active', true);

  if (error) {
    console.error('❌ Error getting businesses by email:', error);
    throw error;
  }
  
  console.log('✅ Found businesses:', data?.length || 0);
  return data || [];
}

// Create business with direct data object (for registration)
export async function createBusinessDirect(businessData: {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  owner_id: string;
  created_at: string;
  is_active: boolean;
}) {
  console.log('🏢 Creating business directly:', businessData.id, '- Name:', businessData.name);
  console.log('📝 Owner ID:', businessData.owner_id);
  console.log('📝 Full business data:', JSON.stringify(businessData, null, 2));
  
  // Verify user exists first
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', businessData.owner_id)
    .single();
  
  if (userError || !userData) {
    console.error('❌ User not found in users table:', businessData.owner_id);
    console.error('User error:', userError);
    throw new Error(`User ${businessData.owner_id} not found in users table. Cannot create business.`);
  }
  
  console.log('✅ User exists:', userData.email);
  
  // Prepare insert data with explicit owner_id
  const insertData = {
    id: businessData.id,
    name: businessData.name,
    email: businessData.email,
    phone: businessData.phone || null,
    owner_id: businessData.owner_id, // Explicitly set owner_id
    active: businessData.is_active,
    country: 'CO',
    currency: 'COP',
  };
  
  console.log('📝 Insert data:', JSON.stringify(insertData, null, 2));
  
  // Insert with owner_id (user should exist in users table now)
  const { data, error } = await supabase
    .from('businesses')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating business:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Error message:', error.message);
    console.error('Error hint:', error.hint);
    console.error('Error code:', error.code);
    throw error;
  }
  
  console.log('✅ Business created directly:', data.id);
  console.log('✅ Business owner_id:', data.owner_id);
  return data;
}