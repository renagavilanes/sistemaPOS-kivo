// NEW FILE: employee_creation_v3.tsx
// This is a completely NEW endpoint to force Figma Make to redeploy
// Created: 2026-03-15

import { Context } from "npm:hono";
import * as dbBusinesses from "./db_businesses.tsx";
import * as dbEmployees from "./db_employees.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export async function createEmployeeV3(c: Context) {
  try {
    console.log('🆕 [CREATE-EMP-V3] ========== NEW ENDPOINT V3 ==========');
    console.log('🆕 [CREATE-EMP-V3] Starting employee creation process...');
    
    const body = await c.req.json();
    const { businessId, name, email, phone, role, permissions, temporaryPassword } = body;
    
    console.log('🆕 [CREATE-EMP-V3] Request data:', { 
      businessId, 
      name, 
      email, 
      role,
      hasPhone: !!phone,
      hasPassword: !!temporaryPassword 
    });
    
    // Validate required fields
    if (!businessId || !name || !email || !role || !permissions) {
      console.error('🆕 [CREATE-EMP-V3] Missing required fields');
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Verify business exists
    console.log('🆕 [CREATE-EMP-V3] Verifying business exists...');
    const business = await dbBusinesses.getBusinessById(businessId);
    if (!business) {
      console.error('🆕 [CREATE-EMP-V3] Business not found');
      return c.json({ error: 'Business not found' }, 404);
    }
    console.log('🆕 [CREATE-EMP-V3] Business verified:', business.name);

    // Check if employee already exists
    console.log('🆕 [CREATE-EMP-V3] Checking if employee exists...');
    const existingEmployee = await dbEmployees.getEmployeeByEmail(businessId, email);
    if (existingEmployee) {
      console.error('🆕 [CREATE-EMP-V3] Employee already exists');
      return c.json({ error: 'Employee already exists in this business' }, 400);
    }
    console.log('🆕 [CREATE-EMP-V3] Employee does not exist, proceeding...');

    // Check if user exists in Auth
    console.log('🆕 [CREATE-EMP-V3] Checking if user exists in Auth...');
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u => u.email === email);
    
    let userId: string;
    let userExists = false;

    if (existingUser) {
      console.log('🆕 [CREATE-EMP-V3] ✅ User already exists in Auth');
      console.log('🆕 [CREATE-EMP-V3] User ID:', existingUser.id);
      userId = existingUser.id;
      userExists = true;
    } else {
      console.log('🆕 [CREATE-EMP-V3] User does not exist, creating new Auth user...');
      
      // Create user in Auth with temporary password
      const password = temporaryPassword || Math.random().toString(36).slice(-12) + 'A1!';
      console.log('🆕 [CREATE-EMP-V3] Password length:', password.length);
      
      const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Auto-confirm since we don't have email server configured
        user_metadata: { name: name }
      });

      if (authError) {
        console.error('🆕 [CREATE-EMP-V3] ❌ Auth error:', authError);
        return c.json({ error: authError.message || 'Failed to create user' }, 500);
      }

      if (!newUser || !newUser.user) {
        console.error('🆕 [CREATE-EMP-V3] ❌ No user returned from createUser');
        return c.json({ error: 'Failed to create user - no user returned' }, 500);
      }

      userId = newUser.user.id;
      console.log('🆕 [CREATE-EMP-V3] ✅ User created in Auth');
      console.log('🆕 [CREATE-EMP-V3] New user ID:', userId);
    }

    // Final validation of userId
    if (!userId) {
      console.error('🆕 [CREATE-EMP-V3] ❌ userId is null or undefined!');
      return c.json({ error: 'Failed to get valid user ID' }, 500);
    }

    console.log('🆕 [CREATE-EMP-V3] Final userId:', userId, 'Type:', typeof userId);

    // Create employee record with validated userId
    console.log('🆕 [CREATE-EMP-V3] Creating employee record in database...');
    await dbEmployees.createEmployee(businessId, {
      user_id: userId,
      name: name,
      email: email,
      phone: phone || null,
      role: role,
      permissions: permissions,
      is_owner: false,
      is_active: true,
    });

    console.log('🆕 [CREATE-EMP-V3] ✅✅✅ Employee created successfully! ✅✅✅');

    return c.json({
      success: true,
      userExists: userExists,
      message: userExists 
        ? 'Employee added to business. User can login with existing credentials.'
        : 'Employee created with temporary password. User should reset password on first login.'
    });
  } catch (error: any) {
    console.error('🆕 [CREATE-EMP-V3] ❌❌❌ CRITICAL ERROR:', error.message);
    console.error('🆕 [CREATE-EMP-V3] Error stack:', error.stack);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
}
