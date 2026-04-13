import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as dbBusinesses from "./db_businesses.tsx";
import * as dbProducts from "./db_products.tsx";
import * as dbBusinessSettings from "./db_business_settings.tsx";
import * as dbCustomers from "./db_customers.tsx";
import * as dbSales from "./db_sales.tsx";
import * as dbExpenses from "./db_expenses.tsx";
import * as dbEmployees from "./db_employees.tsx";
import { createEmployeeV3 } from "./employee_creation_v3.tsx";
import { sendInvitationEmail } from "./send_invitation.tsx";
import { registerAdminRoutes } from "./admin_routes.tsx";

const app = new Hono();

// ── CORS MUST BE FIRST — before all routes and middleware ──
// Hono processes in registration order; OPTIONS preflight must hit CORS first.
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Business-ID", "X-Superadmin-Key"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ================================================================================
// ███████████████████████████████████████████████████████████████████████████████
// SERVER VERSION: 8.0.0 - EMAIL INVITATIONS WITH BREVO
// DEPLOY ID: EMAIL-INVITATIONS-20260315
// ███████████████████████████████████████████████████████████████████████████████
const SERVER_VERSION = '15.3.0-key-in-queryparam';
const DEPLOY_ID = 'KEY-QUERYPARAM-20260318-V8';
console.log('\n\n');
console.log('█'.repeat(80));
console.log('🚀🚀🚀 SERVER STARTING - VERSION:', SERVER_VERSION);
console.log('🚀🚀🚀 DEPLOY ID:', DEPLOY_ID);
console.log('🚀🚀🚀 DEPLOY TIMESTAMP:', new Date().toISOString());
console.log('🔧🔧🔧 CRITICAL FIX: Using separate auth clients');
console.log('   - supabaseAuth: Uses ANON_KEY for validating user tokens');
console.log('   - supabaseAdmin: Uses SERVICE_ROLE_KEY for database operations');
console.log('█'.repeat(80));
console.log('📦 Environment Variables:');
console.log('   SUPABASE_URL:', Deno.env.get('SUPABASE_URL') || '❌ NOT SET');
console.log('   SERVICE_ROLE_KEY:', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? '✅ SET' : '❌ NOT SET');
console.log('   ANON_KEY:', Deno.env.get('SUPABASE_ANON_KEY') ? '✅ SET' : '❌ NOT SET');
console.log('█'.repeat(80));
console.log('\n\n');

// Initialize TWO Supabase clients:
// 1. Admin client with service role key for database operations
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// 2. Auth client with anon key for validating user tokens
const supabaseAuth = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

// Keep reference to admin client as 'supabase' for backward compatibility
const supabase = supabaseAdmin;

console.log('✅ Supabase clients initialized (admin + auth)');
console.log('✅ Using ANON_KEY for auth validation');
console.log('✅ Using SERVICE_ROLE_KEY for database operations');
console.log('='.repeat(50));

// ── Soft hardening toggle (does NOT break current behavior by default) ──
// When you are ready to publish, set HARDEN_PUBLIC=true in the Edge Function env.
const HARDEN_PUBLIC = (Deno.env.get('HARDEN_PUBLIC') ?? '').toLowerCase() === 'true';
const SUPERADMIN_KEY = (Deno.env.get('SUPERADMIN_KEY') ?? '').trim();

/** Desactivado por defecto. Solo para pruebas: ALLOW_MASTER_VERIFICATION_CODE=true en la Edge Function. */
const ALLOW_MASTER_VERIFICATION_CODE =
  (Deno.env.get('ALLOW_MASTER_VERIFICATION_CODE') ?? '').trim().toLowerCase() === 'true';

/** Código real del KV o, si está permitido explícitamente, el de pruebas 999999. */
function verificationCodeMatches(storedCode: string, submitted: string): boolean {
  if (submitted === storedCode) return true;
  if (!ALLOW_MASTER_VERIFICATION_CODE) return false;
  return submitted === '999999';
}

function requireSuperadminKey(c: any): Response | null {
  if (!HARDEN_PUBLIC) return null;
  const provided = (c.req.header('X-Superadmin-Key') ?? '').trim();
  if (!SUPERADMIN_KEY || provided !== SUPERADMIN_KEY) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  return null;
}

// ── Register admin bypass routes (sales/expenses RLS bypass) ──
registerAdminRoutes(app);

// ============================================================================
// CRITICAL: Health check endpoint MUST be defined BEFORE any middleware
// This ensures it's accessible without authentication
// ============================================================================
app.get("/make-server-3508045b/health", (c) => {
  console.log('💚 Health check called - responding with v5.0.0');
  return c.json({ 
    status: "ok",
    version: '5.0.0-health-first',
    deploy_id: 'HEALTH-FIRST-FIX-20240309',
    timestamp: new Date().toISOString(),
    deployment: "HEALTH_ENDPOINT_MOVED_BEFORE_MIDDLEWARE",
    critical_fix: "Health endpoint now before all middleware",
    public_endpoint: true,
  });
});

// Log ALL incoming requests (but health endpoint already responded above)
app.use('*', async (c, next) => {
  console.log(`🌐 [REQUEST] ${c.req.method} ${c.req.url}`);
  console.log(`🌐 [REQUEST] Headers:`, Object.fromEntries(c.req.raw.headers.entries()));
  await next();
  console.log(`🌐 [RESPONSE] Status: ${c.res.status}`);
});

// Enable logger
app.use('*', logger(console.log));

// CORS already registered at the TOP of the file (before all routes)

// Environment check endpoint
app.get("/make-server-3508045b/env-check", (c) => {
  const guard = requireSuperadminKey(c);
  if (guard) return guard;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const hasServiceKey = !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hasAnonKey = !!Deno.env.get('SUPABASE_ANON_KEY');
  
  console.log('🔍 Environment Check:');
  console.log('  SUPABASE_URL:', supabaseUrl);
  console.log('  Has SERVICE_ROLE_KEY:', hasServiceKey);
  console.log('  Has ANON_KEY:', hasAnonKey);
  
  return c.json({
    server_version: SERVER_VERSION,
    deploy_id: DEPLOY_ID,
    server_started_at: new Date().toISOString(),
    auth_method: 'ANON_KEY',
    supabase_url: supabaseUrl || 'NOT SET',
    has_service_role_key: hasServiceKey,
    has_anon_key: hasAnonKey,
    url_matches_project: supabaseUrl?.includes('zcqoussqgigskextorag') || false,
    critical_fix_applied: true,
    fix_description: 'supabaseAuth client uses ANON_KEY for token validation',
  });
});

// Diagnostic endpoint to check database connection
app.get("/make-server-3508045b/diagnostic", async (c) => {
  const guard = requireSuperadminKey(c);
  if (guard) return guard;
  try {
    console.log('🔍 Running diagnostic...');
    
    // Test database connection
    const { data: testData, error: testError } = await supabase
      .from('businesses')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Database test failed:', testError);
      return c.json({
        status: 'error',
        message: 'Database connection failed',
        error: testError.message,
        details: testError,
      }, 500);
    }
    
    console.log('✅ Database connection successful');
    
    return c.json({
      status: 'ok',
      database: 'connected',
      supabase_url: Deno.env.get('SUPABASE_URL') ? 'configured' : 'missing',
      service_role_key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'configured' : 'missing',
    });
  } catch (error: any) {
    console.error('❌ Diagnostic failed:', error);
    return c.json({
      status: 'error',
      message: error.message,
    }, 500);
  }
});

// Test authentication endpoint
app.get("/make-server-3508045b/test-auth", async (c) => {
  const guard = requireSuperadminKey(c);
  if (guard) return guard;
  console.log('\n');
  console.log('🧪 ========== TEST AUTH ENDPOINT ==========');
  
  const authHeader = c.req.header('Authorization');
  console.log('📥 Auth header present:', !!authHeader);
  console.log('📥 Auth header value:', authHeader);
  
  if (!authHeader) {
    return c.json({
      success: false,
      error: 'No Authorization header',
      step: 'header_check',
    }, 401);
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: 'Invalid Authorization format (should be Bearer <token>)',
      step: 'format_check',
    }, 401);
  }
  
  const token = authHeader.replace('Bearer ', '');
  console.log('🔑 Token extracted, length:', token.length);
  console.log('🔑 Token preview:', token.substring(0, 30) + '...');
  
  try {
    console.log('🔐 Calling supabaseAuth.auth.getUser() with ANON_KEY...');
    const { data, error } = await supabaseAuth.auth.getUser(token);
    
    console.log('📊 Response received:');
    console.log('  - Has data:', !!data);
    console.log('  - Has user:', !!data?.user);
    console.log('  - Has error:', !!error);
    
    if (error) {
      console.error('❌ Error details:');
      console.error('  - Message:', error.message);
      console.error('  - Status:', error.status);
      console.error('  - Name:', error.name);
      console.error('  - Full error:', JSON.stringify(error, null, 2));
      
      return c.json({
        success: false,
        error: error.message,
        errorDetails: {
          status: error.status,
          name: error.name,
        },
        step: 'token_validation',
      }, 401);
    }
    
    if (!data || !data.user) {
      console.error('❌ No user in response');
      return c.json({
        success: false,
        error: 'No user found',
        step: 'user_extraction',
      }, 401);
    }
    
    console.log('✅ User validated successfully!');
    console.log('  - Email:', data.user.email);
    console.log('  - ID:', data.user.id);
    console.log('🧪 ========================================\n');
    
    return c.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      message: 'Token is valid!',
    });
    
  } catch (err: any) {
    console.error('❌ Exception caught:');
    console.error('  - Message:', err.message);
    console.error('  - Name:', err.name);
    console.error('  - Stack:', err.stack);
    console.log('🧪 ========================================\n');
    
    return c.json({
      success: false,
      error: err.message,
      errorType: err.name,
      step: 'exception',
    }, 500);
  }
});

// ==================== BUSINESS ENDPOINTS ====================
// VERSION 2.0.1 - Using supabaseAuth (ANON_KEY) for token validation
// LAST UPDATED: 2024-03-09

// Helper function to get user ID from authorization header
async function getUserIdFromAuth(authHeader: string | null): Promise<string | null> {
  console.log('🔐 [AUTH] Validating auth header...');
  
  if (!authHeader) {
    console.log('❌ [AUTH] No authorization header provided');
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  console.log('🔐 [AUTH] Token preview:', token.substring(0, 20) + '...');
  console.log('🔐 [AUTH] Token length:', token.length);
  
  try {
    // IMPORTANT: Use the supabaseAuth client with ANON_KEY to validate user tokens
    // User tokens are signed with the ANON_KEY, not SERVICE_ROLE_KEY
    console.log('🔐 [AUTH] Validating token with anon key...');
    const { data, error } = await supabaseAuth.auth.getUser(token);
    
    console.log('🔐 [AUTH] getUser response - has data:', !!data);
    console.log('🔐 [AUTH] getUser response - has user:', !!data?.user);
    console.log('🔐 [AUTH] getUser response - has error:', !!error);
    
    if (error) {
      console.error('❌ [AUTH] Error validating token:', error.message);
      console.error('❌ [AUTH] Error code:', error.status);
      console.error('❌ [AUTH] Error name:', error.name);
      console.error('❌ [AUTH] Full error:', JSON.stringify(error, null, 2));
      return null;
    }
    
    if (!data || !data.user) {
      console.error('❌ [AUTH] No user found in response');
      console.error('❌ [AUTH] Data:', JSON.stringify(data, null, 2));
      return null;
    }
    
    console.log('✅ [AUTH] User validated successfully!');
    console.log('✅ [AUTH] User email:', data.user.email);
    console.log('✅ [AUTH] User ID:', data.user.id);
    return data.user.id;
  } catch (err: any) {
    console.error('❌ [AUTH] Exception during validation');
    console.error('❌ [AUTH] Exception message:', err.message);
    console.error('❌ [AUTH] Exception name:', err.name);
    console.error('❌ [AUTH] Exception stack:', err.stack);
    return null;
  }
}

// Get all businesses for logged-in user
app.get("/make-server-3508045b/businesses", async (c) => {
  try {
    console.log('📊 [GET /businesses] Request received');
    const authHeader = c.req.header('Authorization');
    console.log('📊 [GET /businesses] Auth header present:', !!authHeader);
    
    const userId = await getUserIdFromAuth(authHeader);
    if (!userId) {
      console.log('❌ [GET /businesses] Unauthorized - no userId');
      return c.json({ code: 401, message: 'Invalid JWT' }, 401);
    }

    console.log('✅ [GET /businesses] User authenticated:', userId);
    const businesses = await dbBusinesses.getUserBusinesses(userId);
    console.log('✅ [GET /businesses] Found', businesses.length, 'businesses');

    return c.json({
      success: true,
      businesses,
    });
  } catch (error: any) {
    console.error('❌ [GET /businesses] Error:', error.message);
    console.error('❌ [GET /businesses] Stack:', error.stack);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Get single business
app.get("/make-server-3508045b/businesses/:businessId", async (c) => {
  try {
    const userId = await getUserIdFromAuth(c.req.header('Authorization'));
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const businessId = c.req.param('businessId');
    const business = await dbBusinesses.getBusinessById(businessId, userId);

    return c.json({
      success: true,
      business,
    });
  } catch (error: any) {
    console.error('Error getting business:', error);
    return c.json({ error: error.message || 'Not found' }, 404);
  }
});

// Create new business
app.post("/make-server-3508045b/businesses", async (c) => {
  try {
    const userId = await getUserIdFromAuth(c.req.header('Authorization'));
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { name, email, phone, address, tax_id, country, currency } = body;

    if (!name) {
      return c.json({ error: 'Business name is required' }, 400);
    }

    const business = await dbBusinesses.createBusiness(userId, {
      name,
      email,
      phone,
      address,
      tax_id,
      country,
      currency,
    });

    console.log('✅ Negocio creado:', business.id, '-', business.name);

    return c.json({
      success: true,
      business,
    });
  } catch (error: any) {
    console.error('Error creating business:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Update business
app.put("/make-server-3508045b/businesses/:businessId", async (c) => {
  try {
    const userId = await getUserIdFromAuth(c.req.header('Authorization'));
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const businessId = c.req.param('businessId');
    const body = await c.req.json();

    const business = await dbBusinesses.updateBusiness(businessId, userId, body);

    return c.json({
      success: true,
      business,
    });
  } catch (error: any) {
    console.error('Error updating business:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Delete (deactivate) business
app.delete("/make-server-3508045b/businesses/:businessId", async (c) => {
  try {
    const userId = await getUserIdFromAuth(c.req.header('Authorization'));
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const businessId = c.req.param('businessId');
    const business = await dbBusinesses.deactivateBusiness(businessId, userId);

    return c.json({
      success: true,
      message: 'Business deactivated successfully',
      business,
    });
  } catch (error: any) {
    console.error('Error deleting business:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Delete authenticated user account (owner + employee scenarios).
// IMPORTANT: This endpoint re-validates credentials server-side (email + password),
// so it does NOT rely on the client's JWT validity (fixes Invalid JWT issues).
app.post("/make-server-3508045b/account/delete-self", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const confirmText = String(body?.confirmText ?? '').trim();
    const email = String(body?.email ?? '').trim();
    const password = String(body?.password ?? '').trim();

    if (confirmText !== 'ELIMINAR MI CUENTA') {
      return c.json({ error: 'Confirmación inválida' }, 400);
    }
    if (!email || !password) {
      return c.json({ error: 'Faltan email o contraseña' }, 400);
    }

    // Re-validate credentials using the server's anon auth client.
    const { data: authData, error: authErr } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr || !authData?.user) {
      return c.json({ error: authErr?.message || 'Credenciales inválidas' }, 401);
    }

    const userId = authData.user.id;

    // 1) Delete businesses owned by user (cascade removes business-scoped data).
    const { data: ownedBusinesses, error: ownedErr } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId);
    if (ownedErr) {
      return c.json({ error: ownedErr.message }, 500);
    }

    const ownedIds = (ownedBusinesses ?? []).map((b: any) => b.id).filter(Boolean);
    if (ownedIds.length > 0) {
      const { error: delOwnedErr } = await supabase
        .from('businesses')
        .delete()
        .in('id', ownedIds);
      if (delOwnedErr) {
        return c.json({ error: delOwnedErr.message }, 500);
      }
    }

    // 2) Soft-unlink user from employee memberships in other businesses.
    const { error: unlinkErr } = await supabase
      .from('employees')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (unlinkErr) {
      return c.json({ error: unlinkErr.message }, 500);
    }

    // 3) Remove user metadata row (if exists).
    const { error: deleteUserRowErr } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    if (deleteUserRowErr) {
      return c.json({ error: deleteUserRowErr.message }, 500);
    }

    // 4) Remove auth account.
    const { error: deleteAuthErr } = await supabase.auth.admin.deleteUser(userId);
    if (deleteAuthErr) {
      return c.json({ error: deleteAuthErr.message }, 500);
    }

    return c.json({
      success: true,
      ownedBusinessesDeleted: ownedIds.length,
      message: 'Cuenta eliminada correctamente',
    });
  } catch (error: any) {
    console.error('Error deleting own account:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ==================== END BUSINESS ENDPOINTS ====================

// DESARROLLO: Endpoint para eliminar un usuario por email
app.delete("/make-server-3508045b/dev/delete-user/:email", async (c) => {
  const guard = requireSuperadminKey(c);
  if (guard) return guard;
  try {
    const email = decodeURIComponent(c.req.param('email'));
    
    console.log('🗑️ INICIANDO ELIMINACIÓN DE USUARIO:', email);
    console.log('='.repeat(60));
    
    const deleted = {
      authUser: false,
      businessData: false,
      verification: false,
      emailMapping: false,
    };
    
    const errors: string[] = [];
    
    // 1. Delete user from Supabase Auth FIRST (most important)
    try {
      console.log('📋 PASO 1: Buscando usuario en Supabase Auth...');
      
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('❌ Error al listar usuarios:', listError);
        errors.push(`List users error: ${listError.message}`);
      } else {
        console.log(`✅ Usuarios encontrados: ${listData?.users?.length || 0}`);
        
        if (listData?.users) {
          const user = listData.users.find((u: any) => u.email === email);
          
          if (user) {
            console.log(`✅ Usuario encontrado con ID: ${user.id}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Creado: ${user.created_at}`);
            console.log('🗑️ Intentando eliminar usuario de Auth...');
            
            const { data: deleteData, error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
            
            if (deleteError) {
              console.error('❌ ERROR AL ELIMINAR DE AUTH:', deleteError);
              errors.push(`Delete auth error: ${deleteError.message}`);
            } else {
              console.log('✅✅✅ USUARIO ELIMINADO EXITOSAMENTE DE AUTH');
              deleted.authUser = true;
            }
          } else {
            console.log('⚠️ Usuario NO encontrado en Auth (puede que ya fue eliminado)');
            errors.push('Usuario no encontrado en Auth');
          }
        }
      }
    } catch (authError: any) {
      console.error('❌ EXCEPCIÓN al procesar Auth:', authError);
      errors.push(`Auth exception: ${authError.message}`);
    }
    
    console.log('='.repeat(60));
    
    // 2. Get and delete business data
    try {
      console.log('📋 PASO 2: Eliminando datos del negocio...');
      const businessId = await kv.get(`business:email:${email}`);
      
      if (businessId) {
        console.log(`✅ Business ID encontrado: ${businessId}`);
        
        // Delete business data
        await kv.del(`business:${businessId}`);
        deleted.businessData = true;
        console.log('✅ Datos del negocio eliminados');
        
        // Delete email mapping
        await kv.del(`business:email:${email}`);
        deleted.emailMapping = true;
        console.log('✅ Mapeo de email eliminado');
      } else {
        console.log('⚠️ No se encontró business ID para este email');
      }
    } catch (kvError: any) {
      console.error('❌ Error eliminando datos de KV:', kvError);
      errors.push(`KV error: ${kvError.message}`);
    }
    
    // 3. Delete pending verification
    try {
      console.log('📋 PASO 3: Eliminando verificación pendiente...');
      await kv.del(`verification:${email}`);
      deleted.verification = true;
      console.log('✅ Verificación eliminada');
    } catch (verError: any) {
      console.error('❌ Error eliminando verificación:', verError);
      errors.push(`Verification error: ${verError.message}`);
    }
    
    console.log('='.repeat(60));
    console.log('🎬 PROCESO COMPLETADO');
    console.log('Resultados:', deleted);
    console.log('Errores:', errors.length > 0 ? errors : 'Ninguno');
    console.log('='.repeat(60));
    
    return c.json({
      success: deleted.authUser || deleted.businessData || deleted.verification,
      message: `Usuario ${email} procesado`,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
      critical: !deleted.authUser ? 'Usuario aún existe en Supabase Auth - debes eliminarlo manualmente' : undefined,
    });
  } catch (error: any) {
    console.error('❌❌❌ ERROR GENERAL:', error);
    return c.json({ 
      error: error.message,
      stack: error.stack,
    }, 500);
  }
});

// Test Brevo configuration endpoint
app.get("/make-server-3508045b/test-brevo", async (c) => {
  const guard = requireSuperadminKey(c);
  if (guard) return guard;
  try {
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const brevoSenderEmail = Deno.env.get('BREVO_SENDER_EMAIL');
    const appUrl = Deno.env.get('APP_URL');
    
    return c.json({
      configured: !!brevoApiKey,
      hasApiKey: !!brevoApiKey,
      hasSenderEmail: !!brevoSenderEmail,
      hasAppUrl: !!appUrl,
      senderEmail: brevoSenderEmail || 'No configurado',
      appUrl: appUrl || 'No configurado',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// NEW: Send test email endpoint
app.post("/make-server-3508045b/test-send-email", async (c) => {
  const guard = requireSuperadminKey(c);
  if (guard) return guard;
  try {
    const body = await c.req.json();
    const { email } = body;

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    console.log('=== TEST EMAIL REQUEST ===');
    console.log('Target email:', email);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Test de Email Exitoso</h1>
          </div>
          <div class="content">
            <h2>¡El sistema de emails funciona!</h2>
            <p>Este es un email de prueba del Sistema POS.</p>
            <p>Si recibes este mensaje, significa que la integración con Brevo está funcionando correctamente.</p>
            <p><strong>Hora de envío:</strong> ${new Date().toLocaleString('es-ES')}</p>
          </div>
          <div class="footer">
            <p>Sistema POS - Email de Prueba</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmailWithBrevo(email, '✅ Email de Prueba - Sistema POS', htmlContent);

    return c.json({
      success: true,
      message: 'Test email sent successfully',
      brevoResponse: result,
    });
  } catch (error: any) {
    console.error('Test email error:', error);
    return c.json({ 
      success: false,
      error: error.message || 'Failed to send test email',
    }, 500);
  }
});

// Helper function to generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to send email via Brevo
async function sendEmailWithBrevo(to: string, subject: string, htmlContent: string) {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY');
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL');
  
  console.log('=== SENDING EMAIL VIA BREVO ===');
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('Has API Key:', !!brevoApiKey);
  console.log('API Key preview:', brevoApiKey ? `${brevoApiKey.substring(0, 10)}...` : 'NOT SET');
  console.log('Sender email:', senderEmail || 'NOT SET');
  
  if (!brevoApiKey) {
    console.error('❌ BREVO_API_KEY not configured');
    throw new Error('Email service not configured - BREVO_API_KEY missing');
  }

  if (!senderEmail) {
    console.error('❌ BREVO_SENDER_EMAIL not configured');
    throw new Error('Email service not configured - BREVO_SENDER_EMAIL missing. Please set it to a verified email in Brevo (e.g., your personal email).');
  }

  console.log('Using sender email:', senderEmail);

  const payload = {
    sender: {
      name: 'Sistema POS',
      email: senderEmail,
    },
    to: [{ email: to }],
    subject,
    htmlContent,
  };

  console.log('Calling Brevo API...');
  
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('Brevo response status:', response.status);
    console.log('Brevo response:', responseText);

    if (!response.ok) {
      console.error('❌ Brevo API error:', responseText);
      throw new Error(`Failed to send email: ${responseText}`);
    }

    console.log('✅ Email sent successfully!');
    return JSON.parse(responseText);
  } catch (error: any) {
    console.error('❌ Error calling Brevo API:', error.message);
    throw error;
  }
}

// Sign up endpoint (creates user with auto-confirmed email)
app.post("/make-server-3508045b/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, metadata } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    console.log('📝 [SIGNUP] Creating user:', email);

    // Create user with auto-confirmed email
    // Using admin.createUser which auto-confirms the email
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email since email server isn't configured
      user_metadata: metadata || {},
    });

    if (error) {
      console.error('❌ Error creating user:', error);
      
      // Check if user already exists
      if (error.message?.includes('already') || error.message?.includes('registered')) {
        return c.json({ 
          error: 'Este correo ya está registrado',
          code: 'USER_EXISTS',
        }, 400);
      }
      
      return c.json({ error: error.message }, 500);
    }

    console.log('✅ User created successfully:', data.user.id);

    return c.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error: any) {
    console.error('❌ Error in signup endpoint:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// DEBUG: List all users in Auth
app.get("/make-server-3508045b/debug-list-users", async (c) => {
  const guard = requireSuperadminKey(c);
  if (guard) return guard;
  try {
    console.log('🔍 [DEBUG] Listing all auth users...');
    
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Error listing users:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ Found ${data.users.length} users`);
    
    return c.json({
      success: true,
      count: data.users.length,
      users: data.users.map((u: any) => ({
        id: u.id,
        email: u.email,
        email_confirmed_at: u.email_confirmed_at,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      })),
    });
  } catch (error: any) {
    console.error('❌ Error in debug-list-users endpoint:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// DEBUG: Reset password for test user
app.post("/make-server-3508045b/debug-reset-password", async (c) => {
  const guard = requireSuperadminKey(c);
  if (guard) return guard;
  try {
    const { email, newPassword } = await c.req.json();
    
    console.log('🔧 [DEBUG] Resetting password for:', email);
    
    // Find user by email
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      return c.json({ error: listError.message }, 500);
    }
    
    const user = listData.users.find((u: any) => u.email === email);
    
    if (!user) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }
    
    console.log('✅ Usuario encontrado:', user.id);
    
    // Update user password
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );
    
    if (error) {
      console.error('❌ Error updating password:', error);
      return c.json({ error: error.message }, 500);
    }
    
    console.log('✅ Password updated successfully');
    
    // Check if user has business
    console.log('🔍 Checking if user has business...');
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id);
    
    let businessMessage = '';
    if (businessError) {
      console.error('❌ Error checking businesses:', businessError);
      businessMessage = `Error checking businesses: ${businessError.message}`;
    } else if (!businessData || businessData.length === 0) {
      console.log('⚠️ User has no business, creating one...');
      
      // Create business for user
      try {
        await dbBusinesses.createBusinessDirect({
          id: user.id,
          name: 'Negocio de Prueba',
          email: user.email!,
          phone: null,
          owner_id: user.id,
          created_at: new Date().toISOString(),
          is_active: true,
        });
        
        businessMessage = 'Business created successfully';
        console.log('✅ Business created for user');
      } catch (createError: any) {
        console.error('❌ Error creating business:', createError);
        businessMessage = `Error creating business: ${createError.message}`;
      }
    } else {
      businessMessage = `User already has ${businessData.length} business(es)`;
      console.log('✅ User has businesses:', businessData.length);
    }
    
    return c.json({
      success: true,
      message: 'Contraseña actualizada',
      businessInfo: businessMessage,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error: any) {
    console.error('❌ Error in debug-reset-password endpoint:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Direct registration endpoint - creates user and business in one step
app.post("/make-server-3508045b/direct-register", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, businessName, phone } = body;

    if (!email || !password || !businessName) {
      return c.json({ error: 'Email, password, and business name are required' }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    console.log('📝 [DIRECT REGISTER] Starting registration for:', email);

    // Check if business already exists in database
    const existingBusinesses = await dbBusinesses.getBusinessesByEmail(email);
    if (existingBusinesses && existingBusinesses.length > 0) {
      console.log('❌ Business already exists');
      return c.json({ 
        error: 'Este correo ya está registrado. Por favor inicia sesión.',
        code: 'ALREADY_EXISTS',
      }, 400);
    }

    // Check if user exists in Supabase Auth and clean up if needed
    try {
      console.log('🔍 Checking for existing users...');
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      
      if (!listError && listData?.users) {
        const existingUser = listData.users.find((u: any) => u.email === email);
        
        if (existingUser) {
          console.log('⚠️ Found existing auth user, attempting cleanup...');
          const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
          
          if (deleteError) {
            console.error('❌ Cannot delete existing user:', deleteError);
            return c.json({ 
              error: 'Este email ya está en uso. Por favor contacta soporte.',
              code: 'USER_EXISTS',
            }, 409);
          }
          
          console.log('✅ Cleaned up existing auth user');
          // Wait for Supabase to process the deletion
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (checkError: any) {
      console.error('⚠️ Error checking existing users:', checkError);
      // Continue anyway - createUser will fail if user exists
    }

    // Create user in Supabase Auth
    console.log('🚀 Creating user in Auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email since email server isn't configured
      user_metadata: {
        business_name: businessName,
        phone: phone || null,
        role: 'admin',
      },
    });

    if (authError) {
      console.error('❌ Error creating user in Auth:', authError);
      return c.json({ 
        error: authError.message || 'Error al crear usuario',
        details: authError,
      }, 500);
    }

    console.log('✅ User created in Auth:', authData.user.id);

    // Create user in users table first
    console.log('📝 Creating user record in database...');
    try {
      const { error: userTableError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          full_name: businessName, // Store business name as full_name temporarily
          created_at: new Date().toISOString(),
        });

      if (userTableError) {
        console.error('❌ Error creating user in users table:', userTableError);
        // If user already exists, continue (might be a retry)
        if (!userTableError.message?.includes('duplicate') && !userTableError.message?.includes('already exists')) {
          throw userTableError;
        } else {
          console.log('⚠️ User already exists in users table, continuing...');
        }
      } else {
        console.log('✅ User record created in database');
      }
      
      // Wait a bit to ensure the user record is committed
      console.log('⏳ Waiting for database to commit...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (userError: any) {
      console.error('❌ Error creating user record:', userError);
      // Clean up auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return c.json({ 
        error: 'Error al crear el usuario en la base de datos',
        details: userError.message,
      }, 500);
    }

    // Create business in database
    const businessId = authData.user.id;
    const businessData = {
      id: businessId,
      name: businessName,
      email,
      phone: phone || null,
      owner_id: businessId,
      created_at: new Date().toISOString(),
      is_active: true,
    };

    try {
      await dbBusinesses.createBusinessDirect(businessData);
      console.log('✅ Business created in database:', businessId);
    } catch (dbError: any) {
      console.error('❌ Error creating business in database:', dbError);
      // Try to clean up the auth user and users table
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('users').delete().eq('id', authData.user.id);
      return c.json({ 
        error: 'Error al crear el negocio en la base de datos',
        details: dbError.message,
      }, 500);
    }

    // Create owner employee record
    console.log('📝 Creating owner employee record...');
    try {
      await dbEmployees.createEmployee(businessId, {
        user_id: authData.user.id,  // Link to auth user
        name: businessName,
        email: email,
        phone: phone || null,
        role: 'admin',
        permissions: {
          sales: { view: true, create: true, edit: true, delete: true },
          products: { view: true, create: true, edit: true, delete: true },
          customers: { view: true, create: true, edit: true, delete: true },
          expenses: { view: true, create: true, edit: true, delete: true },
          reports: { view: true },
          settings: { view: true, edit: true }
        },
        is_owner: true,
        is_active: true,
      });
      console.log('✅ Owner employee record created with user_id:', authData.user.id);
    } catch (empError: any) {
      console.error('⚠️ Error creating employee record:', empError);
      // Don't fail registration if employee creation fails
      console.log('⚠️ Continuing without employee record (can be created later)');
    }

    return c.json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      business: {
        id: businessId,
        name: businessName,
      },
    });
  } catch (error: any) {
    console.error('❌ Error in direct-register endpoint:', error);
    return c.json({ 
      error: error.message || 'Internal server error',
      details: error.stack,
    }, 500);
  }
});

// Register business endpoint
app.post("/make-server-3508045b/register-business", async (c) => {
  try {
    const body = await c.req.json();
    const { businessName, email, phone } = body;

    if (!businessName || !email) {
      return c.json({ error: 'Business name and email are required' }, 400);
    }

    // Check if email already exists in our KV store (fully registered)
    const existingBusinessId = await kv.get(`business:email:${email}`);
    
    if (existingBusinessId) {
      // User has already completed registration
      return c.json({ 
        error: 'Este correo ya está registrado y verificado. Por favor inicia sesión.',
        code: 'ALREADY_VERIFIED',
      }, 400);
    }

    // Check if there's a pending verification (not completed)
    const existingVerification = await kv.get(`verification:${email}`);
    
    if (existingVerification) {
      // User already has a pending verification, just resend the code
      const { code, expiresAt, businessName: existingBusinessName } = JSON.parse(existingVerification);
      
      // Check if code is still valid
      if (Date.now() < expiresAt) {
        // Resend the same code
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔄 Código de Verificación</h1>
              </div>
              <div class="content">
                <h2>Hola ${existingBusinessName},</h2>
                <p>Aquí está tu código de verificación:</p>
                <div class="code">${code}</div>
                <p>Este código expirará en ${Math.ceil((expiresAt - Date.now()) / 1000 / 60)} minutos.</p>
              </div>
              <div class="footer">
                <p>Sistema POS - Gestión inteligente para tu negocio</p>
              </div>
            </div>
          </body>
          </html>
        `;

        // Try to send email, but don't fail if it doesn't work
        try {
          await sendEmailWithBrevo(email, '🔐 Tu Código de Verificación - Sistema POS', htmlContent);
          console.log('✅ Email reenviado exitosamente');
        } catch (emailError: any) {
          console.error('⚠️ No se pudo enviar el email (continuando):', emailError.message);
        }

        return c.json({ 
          success: true,
          message: 'Código reenviado. Revisa tu correo.',
          resent: true,
        });
      }
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store verification code temporarily
    await kv.set(`verification:${email}`, JSON.stringify({
      code,
      businessName,
      phone,
      expiresAt,
    }));

    // Send verification email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ¡Bienvenido a tu Sistema POS!</h1>
          </div>
          <div class="content">
            <h2>Hola ${businessName},</h2>
            <p>Gracias por registrarte. Para completar tu registro, usa el siguiente código de verificación:</p>
            <div class="code">${code}</div>
            <p>Este código expirará en 15 minutos.</p>
            <p>Si no solicitaste este código, puedes ignorar este correo.</p>
          </div>
          <div class="footer">
            <p>Sistema POS - Gestión inteligente para tu negocio</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Try to send email, but don't fail if it doesn't work
    try {
      await sendEmailWithBrevo(email, '🔐 Código de Verificación - Sistema POS', htmlContent);
      console.log('✅ Email de verificación enviado exitosamente');
    } catch (emailError: any) {
      console.error('⚠️ No se pudo enviar el email (continuando):', emailError.message);
    }

    return c.json({ 
      success: true,
      message: 'Verification code sent successfully',
    });
  } catch (error: any) {
    console.error('Error registering business:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Simplified registration endpoint - creates user and business directly without email verification
app.post("/make-server-3508045b/verify-code-with-password", async (c) => {
  try {
    const body = await c.req.json();
    const { email, code, password } = body;

    if (!email || !code || !password) {
      return c.json({ error: 'Email, code, and password are required' }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    console.log('📝 [REGISTER] Verifying code and creating account for:', email);

    // Get verification data (business info)
    const verificationData = await kv.get(`verification:${email}`);
    if (!verificationData) {
      return c.json({ 
        error: 'Información de registro no encontrada. Por favor intenta registrarte nuevamente.',
        code: 'NOT_FOUND',
      }, 400);
    }

    const { code: storedCode, businessName, phone, expiresAt } = JSON.parse(verificationData);

    // Check if code expired
    if (Date.now() > expiresAt) {
      await kv.del(`verification:${email}`);
      return c.json({ 
        error: 'El c��digo ha expirado. Por favor solicita uno nuevo.',
        code: 'EXPIRED',
      }, 400);
    }

    if (!verificationCodeMatches(storedCode, code)) {
      return c.json({ 
        error: 'Código inválido',
        code: 'INVALID_CODE',
      }, 400);
    }

    if (ALLOW_MASTER_VERIFICATION_CODE && code === '999999' && code !== storedCode) {
      console.log('🔓 Código maestro de pruebas (ALLOW_MASTER_VERIFICATION_CODE=true)');
    }

    console.log('✅ Código verificado correctamente');
    console.log('📝 Business info:', { businessName, phone });

    // Check if user already exists in Supabase Auth
    try {
      console.log('🔍 Checking if user exists...');
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('❌ Error listing users:', listError);
      } else if (listData?.users) {
        const existingUser = listData.users.find((u: any) => u.email === email);
        
        if (existingUser) {
          console.log('⚠️ User already exists, attempting to delete...');
          const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
          
          if (deleteError) {
            console.error('❌ Cannot delete existing user:', deleteError);
            return c.json({ 
              error: 'Este email ya está registrado. Por favor inicia sesión o usa otro email.',
              code: 'USER_EXISTS',
            }, 409);
          }
          
          console.log('✅ Previous user deleted');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (checkError: any) {
      console.error('⚠️ Error checking users:', checkError);
    }

    // Create user in Supabase Auth
    console.log('🚀 Creating user in Auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        business_name: businessName,
        phone,
        role: 'admin',
      },
    });

    if (authError) {
      console.error('❌ Error creating user:', authError);
      return c.json({ 
        error: authError.message || 'Error al crear usuario',
        details: authError,
      }, 500);
    }

    console.log('✅ User created:', authData.user.id);

    // Create user in users table first
    console.log('📝 Creating user record in database...');
    try {
      const { error: userTableError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          full_name: businessName, // Store business name as full_name temporarily
          created_at: new Date().toISOString(),
        });

      if (userTableError) {
        console.error('❌ Error creating user in users table:', userTableError);
        // If user already exists, continue (might be a retry)
        if (!userTableError.message?.includes('duplicate') && !userTableError.message?.includes('already exists')) {
          throw userTableError;
        } else {
          console.log('⚠️ User already exists in users table, continuing...');
        }
      } else {
        console.log('✅ User record created in database');
      }
      
      // Wait a bit to ensure the user record is committed
      console.log('⏳ Waiting for database to commit...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (userError: any) {
      console.error('❌ Error creating user record:', userError);
      // Clean up auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return c.json({ 
        error: 'Error al crear el usuario en la base de datos',
        details: userError.message,
      }, 500);
    }

    // Store business data in database
    const businessId = authData.user.id;
    const businessData = {
      id: businessId,
      name: businessName,
      email,
      phone: phone || null,
      owner_id: businessId,
      created_at: new Date().toISOString(),
      is_active: true,
    };

    // Save to database using db_businesses module
    try {
      await dbBusinesses.createBusinessDirect(businessData);
      console.log('✅ Business created in database:', businessId);
      
      // Wait for database consistency
      console.log('⏳ Waiting for database consistency...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (dbError: any) {
      console.error('❌ Error creating business in database:', dbError);
      // Try to clean up the auth user and users table
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('users').delete().eq('id', authData.user.id);
      return c.json({ 
        error: 'Error al crear el negocio en la base de datos',
        details: dbError.message,
      }, 500);
    }

    // Create owner employee record
    console.log('📝 [EMPLOYEE] Starting creation...');
    console.log('📝 [EMPLOYEE] Business ID:', businessId);
    console.log('📝 [EMPLOYEE] Name:', businessName);
    console.log('📝 [EMPLOYEE] Email:', email);
    try {
      const employeeData = {
        name: businessName,
        email: email,
        phone: phone || null,
        role: 'admin',
        permissions: {
          sales: { view: true, create: true, edit: true, delete: true },
          products: { view: true, create: true, edit: true, delete: true },
          customers: { view: true, create: true, edit: true, delete: true },
          expenses: { view: true, create: true, edit: true, delete: true },
          reports: { view: true },
          settings: { view: true, edit: true }
        },
        is_owner: true,
      };
      console.log('📝 [EMPLOYEE] Creating with data:', JSON.stringify(employeeData, null, 2));
      
      const createdEmployee = await dbEmployees.createEmployee(businessId, employeeData);
      console.log('✅ [EMPLOYEE] Successfully created! ID:', createdEmployee.id);
    } catch (empError: any) {
      console.error('❌ [EMPLOYEE] FAILED TO CREATE');
      console.error('❌ [EMPLOYEE] Error:', empError.message);
      console.error('❌ [EMPLOYEE] Stack:', empError.stack);
      // Don't fail registration if employee creation fails
      console.log('⚠️ [EMPLOYEE] Continuing without employee (can be created later)');
    }

    // Clean up verification data
    await kv.del(`verification:${email}`);

    // Return success - client will sign in with the password
    console.log('✅ Registration complete - client should sign in now');

    return c.json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      business: {
        id: businessId,
        name: businessName,
      },
      // Don't include session - client will sign in
    });
  } catch (error: any) {
    console.error('❌ Error in register endpoint:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Check if user exists endpoint (for invitation flow)
app.post("/make-server-3508045b/check-user-exists", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    console.log('🔍 [CHECK-USER] Checking if user exists:', email);

    // Query auth.users table to check if user exists
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return c.json({ error: 'Error checking user existence' }, 500);
    }

    const existingUser = listData?.users?.find((u: any) => u.email === email);
    const exists = !!existingUser;

    console.log('👤 [CHECK-USER] User exists:', exists);

    return c.json({ exists });
  } catch (error: any) {
    console.error('❌ Error in check-user-exists endpoint:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Verify code and create business endpoint
app.post("/make-server-3508045b/verify-code", async (c) => {
  try {
    const body = await c.req.json();
    const { email, code, password } = body;

    if (!email || !code) {
      return c.json({ error: 'Email and code are required' }, 400);
    }

    if (!password || password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Get verification data
    const verificationData = await kv.get(`verification:${email}`);
    if (!verificationData) {
      return c.json({ error: 'Código no encontrado o expirado' }, 400);
    }

    const { code: storedCode, businessName, phone, expiresAt } = JSON.parse(verificationData);

    // Check if code expired
    if (Date.now() > expiresAt) {
      await kv.del(`verification:${email}`);
      return c.json({ error: 'El código ha expirado' }, 400);
    }

    if (!verificationCodeMatches(storedCode, code)) {
      return c.json({ error: 'Código inválido' }, 400);
    }

    if (ALLOW_MASTER_VERIFICATION_CODE && code === '999999' && code !== storedCode) {
      console.log('🔓 Código maestro de pruebas (ALLOW_MASTER_VERIFICATION_CODE=true)');
    }

    console.log('✅ Código verificado correctamente');
    console.log('📝 Intentando crear usuario en Supabase Auth...');

    // Check if user already exists in Supabase Auth (from incomplete registration)
    try {
      console.log('🔍 Verificando si el usuario ya existe...');
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('❌ Error al listar usuarios:', listError);
      } else if (listData?.users) {
        console.log(`📋 Total de usuarios en Auth: ${listData.users.length}`);
        const existingUser = listData.users.find((u: any) => u.email === email);
        
        if (existingUser) {
          console.log('⚠️⚠️⚠️ USUARIO YA EXISTE EN AUTH');
          console.log('User ID:', existingUser.id);
          console.log('Email:', existingUser.email);
          console.log('🗑️ Intentando eliminar usuario previo...');
          
          // Delete the incomplete user
          const { data: deleteData, error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
          
          if (deleteError) {
            console.error('❌❌❌ ERROR AL ELIMINAR USUARIO:', deleteError);
            console.error('Error details:', JSON.stringify(deleteError, null, 2));
            
            // Return error - cannot create user if deletion fails
            return c.json({ 
              error: 'Este email ya está registrado. Por favor, elimínalo manualmente desde Supabase Auth o usa /dev-tools.',
              code: 'USER_EXISTS_CANNOT_DELETE',
              existingUserId: existingUser.id,
            }, 409);
          } else {
            console.log('✅✅✅ USUARIO PREVIO ELIMINADO CORRECTAMENTE');
            // Wait a moment for Supabase to process the deletion
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('⏳ Esperando 1 segundo para que Supabase procese la eliminación...');
          }
        } else {
          console.log('✅ No existe usuario previo con este email');
        }
      }
    } catch (checkError: any) {
      console.error('⚠️ Error al verificar usuarios existentes:', checkError);
      console.error('Stack:', checkError.stack);
    }

    console.log('🚀 Procediendo a crear usuario...');

    // Create user in Supabase Auth with the provided password
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password, // Use the password provided by the user
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        business_name: businessName,
        phone,
        role: 'admin',
      },
    });

    if (authError) {
      console.error('❌❌❌ Error creating user in Supabase Auth:', authError);
      console.error('Error details:', JSON.stringify(authError, null, 2));
      
      // Return detailed error message
      return c.json({ 
        error: authError.message || 'Error creating user account',
        details: authError,
        hint: 'Si el error persiste, elimina el usuario manualmente desde: https://supabase.com/dashboard/project/hhnfcmvvttulcjxmfnit/auth/users',
      }, 500);
    }

    console.log('✅ Usuario creado exitosamente en Supabase Auth');
    console.log('User ID:', authData.user.id);

    // Store business data
    const businessId = authData.user.id;
    const businessData = {
      id: businessId,
      name: businessName,
      email,
      phone,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`business:${businessId}`, JSON.stringify(businessData));
    await kv.set(`business:email:${email}`, businessId);

    // Delete verification code
    await kv.del(`verification:${email}`);

    // Sign in the user with the new password
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error('Error signing in:', signInError);
      // Account was created but login failed - user can login manually
      return c.json({
        success: true,
        message: 'Account created successfully. Please login.',
        business: businessData,
      });
    }

    return c.json({
      success: true,
      message: 'Business created successfully',
      business: businessData,
      session: signInData?.session,
    });
  } catch (error: any) {
    console.error('Error verifying code:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Resend verification code endpoint
app.post("/make-server-3508045b/resend-code", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Get existing verification data
    const existingData = await kv.get(`verification:${email}`);
    if (!existingData) {
      return c.json({ error: 'No pending verification found' }, 400);
    }

    const { businessName, phone } = JSON.parse(existingData);

    // Generate new code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Update verification data
    await kv.set(`verification:${email}`, JSON.stringify({
      code,
      businessName,
      phone,
      expiresAt,
    }));

    // Send new verification email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Nuevo Código de Verificación</h1>
          </div>
          <div class="content">
            <h2>Hola ${businessName},</h2>
            <p>Has solicitado un nuevo código de verificación:</p>
            <div class="code">${code}</div>
            <p>Este código expirará en 15 minutos.</p>
          </div>
          <div class="footer">
            <p>Sistema POS - Gestión inteligente para tu negocio</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmailWithBrevo(email, '🔐 Nuevo Código de Verificación - Sistema POS', htmlContent);

    return c.json({
      success: true,
      message: 'Verification code resent successfully',
    });
  } catch (error: any) {
    console.error('Error resending code:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Login: Send verification code
app.post("/make-server-3508045b/login-send-code", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    console.log('🔐 [LOGIN] Solicitando código para:', email);

    // Check if user exists in Supabase Auth
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error al listar usuarios:', listError);
      return c.json({ error: 'Error checking user' }, 500);
    }

    const existingUser = listData?.users?.find((u: any) => u.email === email);
    
    if (!existingUser) {
      console.log('❌ Usuario no encontrado:', email);
      return c.json({ 
        error: 'No existe una cuenta con este correo',
        code: 'USER_NOT_FOUND',
      }, 404);
    }

    console.log('✅ Usuario encontrado:', existingUser.id);

    // Check if there's already a pending login code
    const existingCode = await kv.get(`login:${email}`);
    
    if (existingCode) {
      const { expiresAt } = JSON.parse(existingCode);
      
      // If code is still valid, resend the same code
      if (Date.now() < expiresAt) {
        const { code: storedCode } = JSON.parse(existingCode);
        
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Código de Inicio de Sesión</h1>
              </div>
              <div class="content">
                <h2>¡Hola!</h2>
                <p>Aquí está tu código para iniciar sesión:</p>
                <div class="code">${storedCode}</div>
                <p>Este código expirará en ${Math.ceil((expiresAt - Date.now()) / 1000 / 60)} minutos.</p>
                <p>Si no solicitaste este código, puedes ignorar este correo.</p>
              </div>
              <div class="footer">
                <p>Sistema POS - Gestión inteligente para tu negocio</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await sendEmailWithBrevo(email, '🔐 Código de Inicio de Sesión - Sistema POS', htmlContent);

        return c.json({ 
          success: true,
          message: 'Código reenviado. Revisa tu correo.',
        });
      }
    }

    // Generate new verification code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store login code
    await kv.set(`login:${email}`, JSON.stringify({
      code,
      userId: existingUser.id,
      expiresAt,
      attempts: 0,
    }));

    console.log('✅ Código generado y guardado');

    // Send verification email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Código de Inicio de Sesión</h1>
          </div>
          <div class="content">
            <h2>¡Bienvenido de nuevo!</h2>
            <p>Usa este código para iniciar sesión en tu Sistema POS:</p>
            <div class="code">${code}</div>
            <p>Este código expirará en 10 minutos.</p>
            <p>Si no solicitaste este código, puedes ignorar este correo de forma segura.</p>
          </div>
          <div class="footer">
            <p>Sistema POS - Gestión inteligente para tu negocio</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmailWithBrevo(email, '🔐 Código de Inicio de Sesión - Sistema POS', htmlContent);

    console.log('✅ Email enviado exitosamente');

    return c.json({ 
      success: true,
      message: 'Verification code sent successfully',
    });
  } catch (error: any) {
    console.error('❌ Error sending login code:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Login: Verify code and sign in
app.post("/make-server-3508045b/login-verify-code", async (c) => {
  try {
    const body = await c.req.json();
    const { email, code } = body;

    if (!email || !code) {
      return c.json({ error: 'Email and code are required' }, 400);
    }

    console.log('🔐 [LOGIN] Verificando código para:', email);

    // Get login code data
    const loginData = await kv.get(`login:${email}`);
    if (!loginData) {
      return c.json({ error: 'Código no encontrado o expirado' }, 400);
    }

    const { code: storedCode, userId, expiresAt, attempts } = JSON.parse(loginData);

    // Check if code expired
    if (Date.now() > expiresAt) {
      await kv.del(`login:${email}`);
      return c.json({ error: 'El código ha expirado' }, 400);
    }

    // Check attempts
    if (attempts >= 5) {
      await kv.del(`login:${email}`);
      return c.json({ error: 'Demasiados intentos. Solicita un nuevo código.' }, 400);
    }

    if (!verificationCodeMatches(storedCode, code)) {
      // Increment attempts
      await kv.set(`login:${email}`, JSON.stringify({
        code: storedCode,
        userId,
        expiresAt,
        attempts: attempts + 1,
      }));
      
      return c.json({ 
        error: `Código incorrecto. Te quedan ${4 - attempts} intentos.`,
      }, 400);
    }

    if (ALLOW_MASTER_VERIFICATION_CODE && code === '999999' && code !== storedCode) {
      console.log('🔓 Código maestro de pruebas (ALLOW_MASTER_VERIFICATION_CODE=true)');
    }

    console.log('✅ Código verificado correctamente');

    // Delete the login code
    await kv.del(`login:${email}`);

    // Generate a magic link for authentication
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (error) {
      console.error('❌ Error generating magic link:', error);
      return c.json({ error: 'Error generating session' }, 500);
    }

    console.log('✅ Sesión generada exitosamente');

    return c.json({
      success: true,
      message: 'Login successful',
      magicLink: data,
    });
  } catch (error: any) {
    console.error('❌ Error verifying login code:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Forgot Password: Send verification code
app.post("/make-server-3508045b/forgot-password-send-code", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    console.log('🔐 [FORGOT PASSWORD] Solicitando código para:', email);

    // Check if user exists in Supabase Auth
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error al listar usuarios:', listError);
      return c.json({ error: 'Error checking user' }, 500);
    }

    const existingUser = listData?.users?.find((u: any) => u.email === email);
    
    if (!existingUser) {
      console.log('❌ Usuario no encontrado:', email);
      return c.json({ 
        error: 'No existe una cuenta con este correo',
        code: 'USER_NOT_FOUND',
      }, 404);
    }

    console.log('✅ Usuario encontrado:', existingUser.id);

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store password reset code
    await kv.set(`password-reset:${email}`, JSON.stringify({
      code,
      userId: existingUser.id,
      expiresAt,
      attempts: 0,
      verified: false,
    }));

    console.log('✅ Código de recuperación generado y guardado');

    // Send verification email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Recuperación de Contraseña</h1>
          </div>
          <div class="content">
            <h2>¡Hola!</h2>
            <p>Has solicitado recuperar tu contraseña. Usa este código para continuar:</p>
            <div class="code">${code}</div>
            <p>Este código expirará en 15 minutos.</p>
            <div class="warning">
              <strong>⚠️ Importante:</strong> Si no solicitaste este cambio, ignora este correo. Tu contraseña permanecerá segura.
            </div>
          </div>
          <div class="footer">
            <p>Sistema POS - Gestión inteligente para tu negocio</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log('📧 CÓDIGO DE RECUPERACIÓN (para pruebas):', code);
    console.log('💡 Usa este código para recuperar la contraseña');

    // Try to send email, but don't fail if it doesn't work (development mode)
    let emailSent = false;
    try {
      await sendEmailWithBrevo(email, '🔐 Recuperar Contraseña - Sistema POS', htmlContent);
      console.log('✅ Email de recuperación enviado exitosamente');
      emailSent = true;
    } catch (emailError: any) {
      console.error('⚠️ No se pudo enviar email (modo desarrollo):', emailError.message);
      console.log('📧 El código se mostrará en la consola para pruebas');
      // Don't fail the request, just log the error
    }

    return c.json({ 
      success: true,
      message: 'Verification code sent successfully',
      emailSent,
      // Include code in response for development/testing
      devCode: code,
      devNote: 'Este código solo se muestra en desarrollo. Revisa la consola del servidor.'
    });
  } catch (error: any) {
    console.error('❌ Error sending password reset code:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Forgot Password: Verify code
app.post("/make-server-3508045b/forgot-password-verify-code", async (c) => {
  try {
    const body = await c.req.json();
    const { email, code } = body;

    if (!email || !code) {
      return c.json({ error: 'Email and code are required' }, 400);
    }

    console.log('🔐 [FORGOT PASSWORD] Verificando código para:', email);

    // Get password reset data
    const resetData = await kv.get(`password-reset:${email}`);
    if (!resetData) {
      return c.json({ error: 'Código no encontrado o expirado' }, 400);
    }

    const { code: storedCode, userId, expiresAt, attempts, verified } = JSON.parse(resetData);

    // Check if code expired
    if (Date.now() > expiresAt) {
      await kv.del(`password-reset:${email}`);
      return c.json({ error: 'El código ha expirado' }, 400);
    }

    // Check attempts
    if (attempts >= 5) {
      await kv.del(`password-reset:${email}`);
      return c.json({ error: 'Demasiados intentos. Solicita un nuevo código.' }, 400);
    }

    if (!verificationCodeMatches(storedCode, code)) {
      // Increment attempts
      await kv.set(`password-reset:${email}`, JSON.stringify({
        code: storedCode,
        userId,
        expiresAt,
        attempts: attempts + 1,
        verified: false,
      }));
      
      return c.json({ 
        error: `Código incorrecto. Te quedan ${4 - attempts} intentos.`,
      }, 400);
    }

    if (ALLOW_MASTER_VERIFICATION_CODE && code === '999999' && code !== storedCode) {
      console.log('🔓 Código maestro de pruebas (ALLOW_MASTER_VERIFICATION_CODE=true)');
    }

    console.log('✅ Código verificado correctamente');

    // Mark as verified
    await kv.set(`password-reset:${email}`, JSON.stringify({
      code: storedCode,
      userId,
      expiresAt,
      attempts,
      verified: true,
    }));

    return c.json({
      success: true,
      message: 'Code verified successfully',
    });
  } catch (error: any) {
    console.error('❌ Error verifying password reset code:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Forgot Password: Reset password
app.post("/make-server-3508045b/forgot-password-reset", async (c) => {
  try {
    const body = await c.req.json();
    const { email, code, newPassword } = body;

    if (!email || !code || !newPassword) {
      return c.json({ error: 'Email, code, and new password are required' }, 400);
    }

    if (newPassword.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    console.log('🔐 [FORGOT PASSWORD] Cambiando contraseña para:', email);

    // Get password reset data
    const resetData = await kv.get(`password-reset:${email}`);
    if (!resetData) {
      return c.json({ error: 'Código no encontrado o expirado' }, 400);
    }

    const { code: storedCode, userId, expiresAt, verified } = JSON.parse(resetData);

    // Check if code expired
    if (Date.now() > expiresAt) {
      await kv.del(`password-reset:${email}`);
      return c.json({ error: 'El código ha expirado' }, 400);
    }

    // Verify code matches
    if (code !== storedCode) {
      return c.json({ error: 'Código inválido' }, 400);
    }

    // Check if code was verified
    if (!verified) {
      return c.json({ error: 'El código no ha sido verificado' }, 400);
    }

    console.log('✅ Actualizando contraseña en Supabase...');

    // Update password in Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('❌ Error al actualizar contraseña:', updateError);
      return c.json({ error: 'Error updating password' }, 500);
    }

    // Delete the reset code
    await kv.del(`password-reset:${email}`);

    console.log('✅ Contraseña actualizada exitosamente');

    return c.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    console.error('❌ Error resetting password:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Get business by user ID endpoint
app.get("/make-server-3508045b/business/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    
    const businessData = await kv.get(`business:${userId}`);
    if (!businessData) {
      return c.json({ error: 'Business not found' }, 404);
    }

    return c.json({
      success: true,
      business: JSON.parse(businessData),
    });
  } catch (error: any) {
    console.error('Error fetching business:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ==================== POS ENDPOINTS ====================

// Helper function to get business ID from header or auth
async function getBusinessIdFromRequest(c: any): Promise<string | null> {
  // Try to get business ID from header first
  const businessIdHeader = c.req.header('X-Business-ID');
  if (businessIdHeader) {
    console.log('📍 Business ID from header:', businessIdHeader);
    return businessIdHeader;
  }
  
  // Fallback: Get user from auth token and find their business
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    console.log('❌ No authorization header');
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  
  if (error || !user) {
    console.log('❌ Error getting user from token:', error);
    return null;
  }
  
  console.log('✅ User found:', user.id, user.email);
  
  // Get the employee record to find their business
  // NOTE: A user may have multiple employee records (duplicates). We always pick
  // the ACTIVE one (is_active=true), ordered by creation date desc to get latest.
  console.log('🔍 Looking for ACTIVE employee with user_id:', user.id);
  const { data: employeeRows, error: employeeError } = await supabaseAdmin
    .from('employees')
    .select('business_id, user_id, email, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  
  const employeeData = employeeRows?.[0] ?? null;

  if (employeeError) {
    console.error('❌ Error getting employee by user_id:', employeeError.code, employeeError.message);
    console.log('🔍 Trying to find active employee by email:', user.email);
    
    // Fallback: Try to find by email (active only, latest record)
    const { data: emailRows, error: emailError } = await supabaseAdmin
      .from('employees')
      .select('business_id, user_id, email, is_active')
      .eq('email', user.email)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    const employeeByEmail = emailRows?.[0] ?? null;
    
    if (emailError || !employeeByEmail) {
      console.error('❌ Active employee not found by email either:', emailError?.message);
      return null;
    }
    
    console.log('✅ Active employee found by email:', employeeByEmail);
    
    // Update the user_id for this employee
    if (!employeeByEmail.user_id) {
      console.log('📝 Updating employee user_id...');
      await supabaseAdmin
        .from('employees')
        .update({ user_id: user.id })
        .eq('email', user.email)
        .eq('is_active', true);
      console.log('✅ Employee user_id updated');
    }
    
    return employeeByEmail.business_id;
  }
  
  if (!employeeData) {
    console.error('❌ No active employee record found for user_id:', user.id);
    return null;
  }
  
  console.log('✅ Active employee found:', employeeData);
  return employeeData.business_id;
}

// NOTE: /admin/* routes (sales, expenses) are registered via registerAdminRoutes(app) above.

// ─── GET EXPENSES (bypasses RLS for employees) ────────────────────────────────
app.get("/make-server-3508045b/db/expenses", async (c) => {
  try {
    const businessId = c.req.header('X-Business-ID');
    if (!businessId) return c.json({ error: 'Missing X-Business-ID header' }, 400);
    console.log('📊 [DB/EXPENSES] Fetching for business:', businessId);

    let q = supabaseAdmin.from('expenses').select('*').eq('business_id', businessId).order('created_at', { ascending: false });
    const from = c.req.query('from'); const to = c.req.query('to'); const lim = c.req.query('limit');
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', to);
    if (lim) q = q.limit(Number(lim));

    const { data, error } = await q;
    if (error) { console.error('❌ [DB/EXPENSES]', error); return c.json({ error: error.message }, 500); }
    console.log(`✅ [DB/EXPENSES] ${data?.length ?? 0} records`);
    return c.json({ success: true, expenses: data ?? [] });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ─── DELETE SALE (bypasses RLS for employees) ─────────────────────────────────
app.delete("/make-server-3508045b/db/sales/:saleId", async (c) => {
  try {
    const businessId = c.req.header('X-Business-ID');
    if (!businessId) return c.json({ error: 'Missing X-Business-ID header' }, 400);
    const saleId = c.req.param('saleId');
    const { error } = await supabaseAdmin.from('sales').delete().eq('id', saleId).eq('business_id', businessId);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ─── PATCH SALE (bypasses RLS for employees) ──────────────────────────────────
app.patch("/make-server-3508045b/db/sales/:saleId", async (c) => {
  try {
    const businessId = c.req.header('X-Business-ID');
    if (!businessId) return c.json({ error: 'Missing X-Business-ID header' }, 400);
    const saleId = c.req.param('saleId');
    const body = await c.req.json();
    const upd: Record<string, any> = {};
    if (body.notes !== undefined) upd.notes = body.notes;
    if (body.paymentStatus !== undefined) upd.payment_status = body.paymentStatus;
    if (body.paidAmount !== undefined) upd.paid_amount = body.paidAmount;
    if (body.createdBy !== undefined) upd.created_by = body.createdBy;
    const { data, error } = await supabaseAdmin.from('sales').update(upd).eq('id', saleId).eq('business_id', businessId).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, sale: data });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ─── POST EXPENSE (bypasses RLS for employees) ────────────────────────────────
app.post("/make-server-3508045b/db/expenses", async (c) => {
  try {
    const businessId = c.req.header('X-Business-ID');
    if (!businessId) return c.json({ error: 'Missing X-Business-ID header' }, 400);
    const b = await c.req.json();
    const rawSt = String(b.paymentStatus ?? 'paid').toLowerCase();
    const paySt =
      rawSt === 'pending' || rawSt === 'debt' || rawSt === 'deuda' ? 'pending' : rawSt === 'partial' ? 'partial' : 'paid';
    const { data, error } = await supabaseAdmin.from('expenses').insert({
      business_id: businessId, category: b.category || 'Otros', description: b.description || null,
      amount: Number(b.amount), payment_method: b.paymentMethod || 'Efectivo',
      payment_status: paySt,
      receipt_image: b.receiptImage || null, notes: b.notes || null,
      created_by: b.createdBy || null, created_at: b.createdAt || new Date().toISOString(),
    }).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, expense: data });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

function mapProductRow(p: any) {
  return {
    id: p.id,
    businessId: p.business_id,
    name: p.name,
    price: p.price,
    cost: p.cost || 0,
    stock: p.stock || 0,
    category: p.category || 'Sin categoría',
    image: p.image ?? '',
    barcode: p.barcode ?? null,
    description: p.description ?? null,
    isActive: p.is_active ?? true,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

// ==================== PUBLIC VIRTUAL CATALOG ====================
// Sin sesión: resuelve negocio por slug y devuelve payload sanitizado (sin costos internos).
app.get("/make-server-3508045b/public/catalog/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const businessId = await dbBusinessSettings.findBusinessIdByVirtualCatalogSlug(slug);
    if (!businessId) {
      return c.json({ error: "Catálogo no encontrado" }, 404);
    }

    const { data: biz, error: bizErr } = await supabaseAdmin
      .from("businesses")
      .select("id, name, phone, logo_url, active")
      .eq("id", businessId)
      .maybeSingle();

    if (bizErr) return c.json({ error: bizErr.message }, 500);
    if (!biz || biz.active === false) {
      return c.json({ error: "Negocio no disponible" }, 404);
    }

    const row = await dbBusinessSettings.getVirtualCatalogRowByBusinessId(businessId);
    const rawCfg = (row?.value ?? {}) as dbBusinessSettings.VirtualCatalogConfig;

    const enabled = rawCfg.enabled !== false; // default true si existe fila vacía
    if (!enabled) {
      return c.json({ error: "Catálogo desactivado" }, 404);
    }

    const outOfStockMode: dbBusinessSettings.OutOfStockMode =
      rawCfg.outOfStockMode === "hide" || rawCfg.outOfStockMode === "show" || rawCfg.outOfStockMode === "mark_unavailable"
        ? rawCfg.outOfStockMode
        : "mark_unavailable";

    const delivery = {
      pickup: rawCfg.delivery?.pickup !== false,
      homeDelivery: rawCfg.delivery?.homeDelivery === true,
      homeDeliveryFee: Number(rawCfg.delivery?.homeDeliveryFee || 0) || 0,
    };

    const productsRaw = await dbProducts.getProducts(businessId, { includeImage: true });

    const publicProducts: any[] = [];
    for (const p of productsRaw as any[]) {
      const isActive = p?.is_active !== false;
      if (!isActive) continue;

      const stock = Number(p?.stock ?? 0) || 0;
      const availability =
        stock > 0 ? "available" : outOfStockMode === "mark_unavailable" ? "unavailable" : "out_of_stock";

      if (outOfStockMode === "hide" && stock <= 0) continue;

      publicProducts.push({
        id: String(p.id),
        name: String(p.name),
        price: Number(p.price),
        stock,
        category: p.category || "Sin categoría",
        image: p.image ?? "",
        availability,
      });
    }

    return c.json({
      success: true,
      business: {
        id: String(biz.id),
        name: String(biz.name || ""),
        phone: biz.phone ? String(biz.phone) : "",
        logoUrl: biz.logo_url ? String(biz.logo_url) : "",
      },
      catalog: {
        slug: String(rawCfg.slug || "").trim(),
        outOfStockMode,
        delivery,
      },
      products: publicProducts,
    });
  } catch (e: any) {
    console.error("[PUBLIC CATALOG] Error:", e);
    return c.json({ error: e?.message || "Internal server error" }, 500);
  }
});

// Un producto completo (imagen + descripción) para edición / detalle
app.get("/make-server-3508045b/products/:id", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing product id' }, 400);
    }
    const row = await dbProducts.getProductById(id, businessId);
    return c.json({ success: true, product: mapProductRow(row) });
  } catch (error: any) {
    if (error?.code === 'PGRST116') {
      return c.json({ error: 'Producto no encontrado' }, 404);
    }
    const msg = error?.message || String(error);
    console.error('Error getting product:', error);
    return c.json({ error: msg || 'Internal server error' }, 500);
  }
});

// Listado de productos: por defecto sin columna `image` (reduce MB en red). ?includeImage=1 para compatibilidad.
app.get("/make-server-3508045b/products", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const includeImage =
      c.req.query('includeImage') === '1' ||
      c.req.query('includeImage') === 'true';

    console.log('📦 Getting products for business:', businessId, includeImage ? '(con imágenes)' : '(sin imágenes)');
    const products = await dbProducts.getProducts(businessId, { includeImage });
    console.log(`📦 Found ${products.length} products for business ${businessId}`);

    const mappedProducts = products.map((p: any) => mapProductRow(p));

    return c.json({
      success: true,
      products: mappedProducts,
    });
  } catch (error: any) {
    console.error('Error getting products:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Create product endpoint
app.post("/make-server-3508045b/products", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { name, price, cost, stock, category, image } = body;

    if (!name || price === undefined) {
      return c.json({ error: 'Name and price are required' }, 400);
    }

    console.log('📦 Creating product for business:', businessId, '- Product:', name);

    const product = await dbProducts.createProduct(businessId, {
      name,
      price,
      cost: cost || 0,
      stock: stock || 0,
      category: category || 'Otros',
      image: image || '',
    });

    // Map database fields to frontend format
    const mappedProduct = {
      id: product.id,
      businessId: product.business_id,
      name: product.name,
      price: product.price,
      cost: product.cost || 0,
      stock: product.stock || 0,
      category: product.category || 'Otros',
      image: product.image || '',
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    };

    return c.json({
      success: true,
      product: mappedProduct,
    });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ==================== SALES DB ENDPOINT ====================
// Inserts directly into the Supabase 'sales' table using the admin client
// (SERVICE_ROLE_KEY), bypassing RLS — required for employees.
app.post("/make-server-3508045b/sales/db-create", async (c) => {
  try {
    const businessId = c.req.header('X-Business-ID');
    if (!businessId) {
      return c.json({ error: 'Missing X-Business-ID header' }, 400);
    }

    const body = await c.req.json();
    console.log('💰 [SALES/DB-CREATE] Received for business:', businessId);

    const {
      customerId,
      total,
      subtotal,
      discount,
      tax,
      paymentMethod,
      paymentStatus,
      paidAmount,
      changeAmount,
      items,
      payments,
      notes,
      createdBy,
      createdAt,
    } = body;

    if (!items || items.length === 0) {
      return c.json({ error: 'items is required' }, 400);
    }

    // Generate sale number using admin client (bypasses RLS)
    const { data: lastSale } = await supabaseAdmin
      .from('sales')
      .select('sale_number')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let saleNumber = 'V-0001';
    if (lastSale?.sale_number) {
      const lastNumber = parseInt(lastSale.sale_number.replace(/\D/g, ''), 10);
      if (!isNaN(lastNumber)) {
        saleNumber = `V-${String(lastNumber + 1).padStart(4, '0')}`;
      }
    }

    const insertData: Record<string, any> = {
      business_id: businessId,
      customer_id: customerId || null,
      sale_number: saleNumber,
      total: Number(total) || 0,
      subtotal: Number(subtotal) || 0,
      tax: Number(tax) || 0,
      discount: Number(discount) || 0,
      payment_method: paymentMethod || 'Efectivo',
      payment_status: paymentStatus || 'paid',
      paid_amount: Number(paidAmount) || 0,
      change_amount: Number(changeAmount) || 0,
      items: items,
      payments: payments || [],
      notes: notes || null,
      created_by: createdBy || null,
      created_at: createdAt || new Date().toISOString(),
    };

    console.log('💰 [SALES/DB-CREATE] Inserting sale:', saleNumber);

    const { data, error } = await supabaseAdmin
      .from('sales')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ [SALES/DB-CREATE] Error inserting sale:', error);
      return c.json({ error: error.message, details: error }, 500);
    }

    console.log('✅ [SALES/DB-CREATE] Sale created:', data.id, data.sale_number);

    // Update product stock
    for (const item of items) {
      const productId = item.productId || item.product_id;
      const qty = item.quantity || 1;
      if (!productId) continue;

      const { data: prod } = await supabaseAdmin
        .from('products')
        .select('stock')
        .eq('id', productId)
        .eq('business_id', businessId)
        .single();

      if (prod) {
        const newStock = Math.max(0, prod.stock - qty);
        await supabaseAdmin
          .from('products')
          .update({ stock: newStock })
          .eq('id', productId)
          .eq('business_id', businessId);
        console.log(`📦 Stock updated: product ${productId} → ${newStock}`);
      }
    }

    return c.json({ success: true, sale: data });
  } catch (error: any) {
    console.error('❌ [SALES/DB-CREATE] Unexpected error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// DELETE sale from DB (bypasses RLS for employees)
app.delete("/make-server-3508045b/sales/db-delete/:saleId", async (c) => {
  try {
    const businessId = c.req.header('X-Business-ID');
    if (!businessId) return c.json({ error: 'Missing X-Business-ID header' }, 400);
    const saleId = c.req.param('saleId');

    const { error } = await supabaseAdmin
      .from('sales')
      .delete()
      .eq('id', saleId)
      .eq('business_id', businessId);

    if (error) {
      console.error('❌ [SALES/DB-DELETE] Error:', error);
      return c.json({ error: error.message }, 500);
    }
    console.log('✅ [SALES/DB-DELETE] Sale deleted:', saleId);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// PATCH sale in DB (bypasses RLS for employees) — mismo alcance que /admin/sales/:id (Movimientos)
app.patch("/make-server-3508045b/sales/db-update/:saleId", async (c) => {
  try {
    const businessId = c.req.header('X-Business-ID');
    if (!businessId) return c.json({ error: 'Missing X-Business-ID header' }, 400);
    const saleId = c.req.param('saleId');
    const body = await c.req.json();

    const updateData: Record<string, any> = {};
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.paymentStatus !== undefined) updateData.payment_status = body.paymentStatus;
    if (body.paidAmount !== undefined) updateData.paid_amount = Number(body.paidAmount);
    if (body.changeAmount !== undefined) updateData.change_amount = Number(body.changeAmount);
    if (body.customerId !== undefined) updateData.customer_id = body.customerId;
    if (body.total !== undefined) updateData.total = Number(body.total);
    if (body.subtotal !== undefined) updateData.subtotal = Number(body.subtotal);
    if (body.discount !== undefined) updateData.discount = Number(body.discount);
    if (body.tax !== undefined) updateData.tax = Number(body.tax);
    if (body.paymentMethod !== undefined) updateData.payment_method = body.paymentMethod;
    if (body.createdAt !== undefined) updateData.created_at = body.createdAt;
    if (body.createdBy !== undefined) updateData.created_by = body.createdBy;
    if (body.payments !== undefined) updateData.payments = body.payments;
    if (body.items !== undefined) {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return c.json({ error: 'items must be a non-empty array' }, 400);
      }
      updateData.items = body.items;
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    console.log('💾 [SALES/DB-UPDATE] PATCH sale', saleId, 'keys:', Object.keys(updateData).join(','));

    const { data, error } = await supabaseAdmin
      .from('sales')
      .update(updateData)
      .eq('id', saleId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      console.error('❌ [SALES/DB-UPDATE] Error:', error);
      return c.json({ error: error.message }, 500);
    }
    console.log('✅ [SALES/DB-UPDATE] Sale updated:', saleId);
    return c.json({ success: true, sale: data });
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// GET sales from DB (bypasses RLS for employees) — v9.0.1
app.get("/make-server-3508045b/sales/db-list", async (c) => {
  try {
    console.log('📊 [SALES/DB-LIST] v9.0.1 handler reached');
    const businessId = c.req.header('X-Business-ID');
    if (!businessId) {
      return c.json({ error: 'Missing X-Business-ID header' }, 400);
    }

    let query = supabaseAdmin
      .from('sales')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    const from = c.req.query('from');
    const to = c.req.query('to');
    const limit = c.req.query('limit');
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (limit) query = query.limit(parseInt(limit));

    const { data, error } = await query;
    if (error) {
      console.error('❌ [SALES/DB-LIST] Error:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ [SALES/DB-LIST] Retrieved ${data?.length || 0} sales for business ${businessId}`);
    return c.json({ success: true, sales: data || [] });
  } catch (error: any) {
    console.error('❌ [SALES/DB-LIST] Unexpected error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// GET expenses from DB (bypasses RLS for employees) — v9.0.1
app.get("/make-server-3508045b/expenses/db-list", async (c) => {
  try {
    console.log('📊 [EXPENSES/DB-LIST] v9.0.1 handler reached');
    const businessId = c.req.header('X-Business-ID');
    if (!businessId) {
      return c.json({ error: 'Missing X-Business-ID header' }, 400);
    }

    let query = supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    const from = c.req.query('from');
    const to = c.req.query('to');
    const limit = c.req.query('limit');
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (limit) query = query.limit(parseInt(limit));

    const { data, error } = await query;
    if (error) {
      console.error('❌ [EXPENSES/DB-LIST] Error:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ [EXPENSES/DB-LIST] Retrieved ${data?.length || 0} expenses for business ${businessId}`);
    return c.json({ success: true, expenses: data || [] });
  } catch (error: any) {
    console.error('❌ [EXPENSES/DB-LIST] Unexpected error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// POST expense to DB (bypasses RLS for employees)
app.post("/make-server-3508045b/expenses/db-create", async (c) => {
  try {
    const businessId = c.req.header('X-Business-ID');
    if (!businessId) {
      return c.json({ error: 'Missing X-Business-ID header' }, 400);
    }

    const body = await c.req.json();
    const { category, description, amount, paymentMethod, receiptImage, notes, createdBy, createdAt } = body;

    if (!amount || amount <= 0) {
      return c.json({ error: 'Valid amount is required' }, 400);
    }

    const insertData = {
      business_id: businessId,
      category: category || 'Otros',
      description: description || null,
      amount: Number(amount),
      payment_method: paymentMethod || 'Efectivo',
      receipt_image: receiptImage || null,
      notes: notes || null,
      created_by: createdBy || null,
      created_at: createdAt || new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('expenses')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ [EXPENSES/DB-CREATE] Error:', error);
      return c.json({ error: error.message, details: error }, 500);
    }

    console.log('✅ [EXPENSES/DB-CREATE] Expense created:', data.id);
    return c.json({ success: true, expense: data });
  } catch (error: any) {
    console.error('❌ [EXPENSES/DB-CREATE] Unexpected error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Create sale endpoint (KV store - legacy)
app.post("/make-server-3508045b/sales", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { cartItems, total, paymentType, payments, client, saleDate, receiptNote, discount } = body;

    if (!cartItems || cartItems.length === 0) {
      return c.json({ error: 'Cart items are required' }, 400);
    }

    // Generate sale ID
    const saleId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Calculate profit
    const totalCost = cartItems.reduce((sum: number, item: any) => {
      return sum + ((item.product.cost || 0) * item.quantity);
    }, 0);
    const profit = total - totalCost;

    // Prepare sale data
    const saleData = {
      id: saleId,
      businessId,
      type: 'sale',
      date: saleDate || now.split('T')[0],
      products: cartItems.map((item: any) => ({
        id: item.product.id,
        name: item.product.name,
        price: item.priceAtSale,
        quantity: item.quantity,
        category: item.product.category,
        image: item.product.image,
        cost: item.product.cost,
      })),
      total,
      profit,
      paymentType, // 'pagada' or 'credito'
      payments: paymentType === 'pagada' ? payments : [],
      client: client || null,
      receiptNote: receiptNote || '',
      discount: discount || { percent: 0, amount: 0 },
      status: paymentType === 'credito' ? 'pending' : 'completed',
      createdAt: now,
      updatedAt: now,
    };

    // Save sale
    await kv.set(`sale:${businessId}:${saleId}`, JSON.stringify(saleData));

    // Update product stock
    for (const item of cartItems) {
      const productKey = `product:${businessId}:${item.product.id}`;
      const productData = await kv.get(productKey);
      
      if (productData) {
        const product = JSON.parse(productData);
        product.stock = Math.max(0, product.stock - item.quantity);
        product.updatedAt = now;
        await kv.set(productKey, JSON.stringify(product));
      }
    }

    return c.json({
      success: true,
      sale: saleData,
    });
  } catch (error: any) {
    console.error('Error creating sale:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Create expense endpoint
app.post("/make-server-3508045b/expenses", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { date, category, supplier, paymentMethod, amount, notes } = body;

    if (!amount || amount <= 0) {
      return c.json({ error: 'Valid amount is required' }, 400);
    }

    // Generate expense ID
    const expenseId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Prepare expense data
    const expenseData = {
      id: expenseId,
      businessId,
      type: 'expense',
      date: date || now.split('T')[0],
      category: category || 'Otros',
      supplier: supplier || '',
      paymentMethod: paymentMethod || 'Efectivo',
      amount,
      notes: notes || '',
      createdAt: now,
      updatedAt: now,
    };

    // Save expense
    await kv.set(`expense:${businessId}:${expenseId}`, JSON.stringify(expenseData));

    return c.json({
      success: true,
      expense: expenseData,
    });
  } catch (error: any) {
    console.error('Error creating expense:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Get movements (sales + expenses) endpoint
app.get("/make-server-3508045b/movements", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all sales
    const salesKeys = await kv.getByPrefix(`sale:${businessId}:`);
    const sales = salesKeys.map((data: string) => JSON.parse(data));

    // Get all expenses
    const expensesKeys = await kv.getByPrefix(`expense:${businessId}:`);
    const expenses = expensesKeys.map((data: string) => JSON.parse(data));

    // Combine and sort by date (newest first)
    const movements = [...sales, ...expenses].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return c.json({
      success: true,
      movements,
    });
  } catch (error: any) {
    console.error('Error getting movements:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Get clients endpoint
app.get("/make-server-3508045b/clients", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const clientsKeys = await kv.getByPrefix(`client:${businessId}:`);
    const clients = clientsKeys.map((data: string) => JSON.parse(data));

    return c.json({
      success: true,
      clients,
    });
  } catch (error: any) {
    console.error('Error getting clients:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Create client endpoint
app.post("/make-server-3508045b/clients", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { name, phone, email } = body;

    if (!name) {
      return c.json({ error: 'Name is required' }, 400);
    }

    const clientId = crypto.randomUUID();
    const now = new Date().toISOString();

    const clientData = {
      id: clientId,
      businessId,
      name,
      phone: phone || '',
      email: email || '',
      createdAt: now,
      updatedAt: now,
    };

    await kv.set(`client:${businessId}:${clientId}`, JSON.stringify(clientData));

    return c.json({
      success: true,
      client: clientData,
    });
  } catch (error: any) {
    console.error('Error creating client:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ==================== CUSTOMERS ENDPOINTS (bypasses RLS via SERVICE_ROLE_KEY) ====================

// GET /customers — lista todos los contactos del negocio
app.get("/make-server-3508045b/customers", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) return c.json({ error: 'Unauthorized' }, 401);

    console.log('👥 Getting customers for business:', businessId);
    const rows = await dbCustomers.getCustomers(businessId);
    console.log(`👥 Found ${rows.length} customers`);

    const customers = rows.map((c: any) => ({
      id: c.id,
      businessId: c.business_id,
      name: c.name,
      email: c.email || null,
      phone: c.phone || null,
      address: c.address || null,
      taxId: c.tax_id || null,
      type: c.contact_type || 'customer',
      creditLimit: c.credit_limit || 0,
      currentBalance: c.current_balance || 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return c.json({ success: true, customers });
  } catch (error: any) {
    console.error('Error getting customers:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// POST /customers — crea un nuevo contacto
app.post("/make-server-3508045b/customers", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const { name, email, phone, address, tax_id } = body;
    const contactTypeRaw =
      body.contact_type ?? body.contactType ?? body.type ?? body.customer_type;

    if (!name) return c.json({ error: 'Name is required' }, 400);

    const row = await dbCustomers.createCustomer(businessId, {
      name,
      email,
      phone,
      address,
      tax_id,
      contact_type: contactTypeRaw,
    });

    const customer = {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      email: row.email || null,
      phone: row.phone || null,
      address: row.address || null,
      taxId: row.tax_id || null,
      type: row.contact_type || 'customer',
      creditLimit: row.credit_limit || 0,
      currentBalance: row.current_balance || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return c.json({ success: true, customer });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// PUT /customers/:id — actualiza un contacto
app.put("/make-server-3508045b/customers/:id", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) return c.json({ error: 'Unauthorized' }, 401);

    const customerId = c.req.param('id');
    const body = await c.req.json();
    const { name, email, phone, address, tax_id } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (tax_id !== undefined) updates.tax_id = tax_id;
    if (
      body.contact_type !== undefined ||
      body.contactType !== undefined ||
      body.type !== undefined ||
      body.customer_type !== undefined
    ) {
      updates.contact_type =
        body.contact_type ?? body.contactType ?? body.type ?? body.customer_type;
    }

    const row = await dbCustomers.updateCustomer(customerId, businessId, updates);

    const customer = {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      email: row.email || null,
      phone: row.phone || null,
      address: row.address || null,
      taxId: row.tax_id || null,
      type: row.contact_type || 'customer',
      creditLimit: row.credit_limit || 0,
      currentBalance: row.current_balance || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return c.json({ success: true, customer });
  } catch (error: any) {
    console.error('Error updating customer:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// DELETE /customers/:id — desactiva (soft-delete) un contacto
app.delete("/make-server-3508045b/customers/:id", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) return c.json({ error: 'Unauthorized' }, 401);

    const customerId = c.req.param('id');
    await dbCustomers.deactivateCustomer(customerId, businessId);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ==================== EMPLOYEES ENDPOINTS ====================

// Get all employees for a business
app.get("/make-server-3508045b/employees", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('👥 Getting employees for business:', businessId);
    const employees = await dbEmployees.getEmployees(businessId);

    return c.json({
      success: true,
      employees,
    });
  } catch (error: any) {
    console.error('Error getting employees:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Get employee by ID
app.get("/make-server-3508045b/employees/:employeeId", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const employeeId = c.req.param('employeeId');
    const employee = await dbEmployees.getEmployeeById(employeeId, businessId);

    return c.json({
      success: true,
      employee,
    });
  } catch (error: any) {
    console.error('Error getting employee:', error);
    return c.json({ error: error.message || 'Not found' }, 404);
  }
});

// Create employee
app.post("/make-server-3508045b/employees", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { name, email, phone, role, permissions, is_owner } = body;

    if (!name || !email || !role || !permissions) {
      return c.json({ error: 'Name, email, role, and permissions are required' }, 400);
    }

    console.log('👤 Creating employee for business:', businessId, '- Employee:', name);

    // Check if employee with same email already exists
    const existingEmployee = await dbEmployees.getEmployeeByEmail(businessId, email);
    if (existingEmployee) {
      return c.json({ error: 'Employee with this email already exists' }, 400);
    }

    const employee = await dbEmployees.createEmployee(businessId, {
      name,
      email,
      phone: phone || null,
      role,
      permissions,
      is_owner: is_owner || false,
    });

    return c.json({
      success: true,
      employee,
    });
  } catch (error: any) {
    console.error('Error creating employee:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Update employee
app.put("/make-server-3508045b/employees/:employeeId", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const employeeId = c.req.param('employeeId');
    const body = await c.req.json();

    console.log('👤 Updating employee:', employeeId, 'for business:', businessId);

    // If updating email, check it doesn't exist for another employee
    if (body.email) {
      const existingEmployee = await dbEmployees.getEmployeeByEmail(businessId, body.email);
      if (existingEmployee && existingEmployee.id !== employeeId) {
        return c.json({ error: 'Employee with this email already exists' }, 400);
      }
    }

    const employee = await dbEmployees.updateEmployee(employeeId, businessId, body);

    return c.json({
      success: true,
      employee,
    });
  } catch (error: any) {
    console.error('Error updating employee:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Delete (deactivate) employee
app.delete("/make-server-3508045b/employees/:employeeId", async (c) => {
  try {
    const businessId = await getBusinessIdFromRequest(c);
    if (!businessId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const employeeId = c.req.param('employeeId');

    console.log('👤 Deleting employee:', employeeId, 'for business:', businessId);

    const employee = await dbEmployees.deleteEmployee(employeeId, businessId);

    return c.json({
      success: true,
      message: 'Employee deactivated successfully',
      employee,
    });
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    
    // Check if error is about owner
    if (error.message.includes('owner')) {
      return c.json({ error: 'Cannot delete owner employee' }, 400);
    }
    
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ==================== END EMPLOYEES ENDPOINTS ====================

// ==================== EMPLOYEE INVITATIONS ENDPOINTS ====================

// Helper function to generate random invitation token
function generateInvitationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Fix employee user_id (migration endpoint — migration already done, always returns success)
app.post("/make-server-3508045b/fix-employee-user-id", async (c) => {
  try {
    console.log('🔧 [FIX] Migration already complete, returning success.');
    // Migration is done — publicAnonKey cannot be validated as a user JWT (missing sub claim).
    // Just return alreadyFixed so the frontend stops retrying.
    return c.json({ success: true, alreadyFixed: true, message: 'Migration already complete' });

    // Dead code below kept for reference only
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('✅ [FIX] User found:', user.id, user.email);
    
    // Find employee record with this email but without user_id
    const { data: employeeData, error: employeeError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('email', user.email)
      .is('user_id', null)
      .single();
    
    if (employeeError || !employeeData) {
      console.log('❌ [FIX] No employee found without user_id for:', user.email);
      return c.json({ 
        error: 'No employee record found that needs fixing',
        alreadyFixed: true 
      }, 200);
    }
    
    console.log('📝 [FIX] Found employee to fix:', employeeData.id, employeeData.name);
    
    // Update employee with user_id
    const { data: updatedEmployee, error: updateError } = await supabaseAdmin
      .from('employees')
      .update({ user_id: user.id })
      .eq('id', employeeData.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ [FIX] Error updating employee:', updateError);
      return c.json({ error: 'Error updating employee' }, 500);
    }
    
    console.log('✅ [FIX] Employee user_id fixed successfully!');
    
    return c.json({
      success: true,
      message: 'Employee user_id fixed successfully',
      employee: updatedEmployee,
    });
  } catch (error: any) {
    console.error('❌ [FIX] Error fixing employee:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Invite employee (send invitation email)
app.post("/make-server-3508045b/invite-employee", async (c) => {
  try {
    console.log('📧 [INVITE v2.0.3] Starting invitation process...');
    console.log('📧 [INVITE v2.0.3] This is the NEW version that reads businessId from BODY');
    
    // Get body first
    const body = await c.req.json();
    const { businessId, name, email, phone, role, permissions } = body;
    
    console.log('📧 [INVITE] Request data:', { name, email, role });
    console.log('📧 [INVITE] Business ID from body:', businessId);
    console.log('📧 [INVITE] Business ID type:', typeof businessId);
    console.log('📧 [INVITE] Business ID is undefined?', businessId === undefined);
    console.log('📧 [INVITE] Business ID is "undefined"?', businessId === 'undefined');
    
    if (!businessId || businessId === 'undefined') {
      console.error('❌ [INVITE] No business ID in body - unauthorized');
      return c.json({ error: 'Unauthorized - No business ID provided' }, 401);
    }

    // Validate required fields
    if (!name || !email || !role || !permissions) {
      console.error('❌ [INVITE] Missing required fields');
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('❌ [INVITE] Invalid email format');
      return c.json({ error: 'Invalid email format' }, 400);
    }

    console.log('📧 [INVITE] Checking if employee already exists...');
    // Check if employee already exists in this business
    const existingEmployee = await dbEmployees.getEmployeeByEmail(businessId, email);
    if (existingEmployee) {
      console.error('❌ [INVITE] Employee already exists');
      return c.json({ error: 'This employee is already part of your business' }, 400);
    }

    console.log('📧 [INVITE] Getting business information...');
    // Get business information
    const business = await dbBusinesses.getBusinessById(businessId);
    if (!business) {
      console.error('❌ [INVITE] Business not found');
      return c.json({ error: 'Business not found' }, 404);
    }

    console.log('📧 [INVITE] Business found:', business.name);
    console.log('📧 [INVITE] Checking if user exists in Auth...');
    
    // Check if user exists in Auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUsers.users.some(u => u.email === email);

    console.log('🔍 [INVITE] User exists in Auth:', userExists);

    // Generate invitation token
    const token = generateInvitationToken();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

    console.log('📧 [INVITE] Saving invitation to kv_store...');
    // Save invitation to kv_store
    await kv.set(`invitation:${token}`, {
      businessId,
      businessName: business.name,
      email,
      name,
      phone: phone || null,
      role,
      permissions,
      userExists,
      createdAt: Date.now(),
      expiresAt,
    });

    console.log('💾 [INVITE] Invitation saved with token:', token);

    // Get role name in Spanish
    const roleNames: Record<string, string> = {
      admin: 'Administrador',
      manager: 'Gerente',
      cashier: 'Cajero',
      inventory: 'Inventario',
      viewer: 'Solo lectura',
    };
    const roleName = roleNames[role] || role;

    // Build invitation URL (frontend will handle this route)
    const figmaFileKey = Deno.env.get('FIGMA_FILE_KEY') || '5Fd3OHhMY2lssTlq3IRIEy';
    const invitationUrl = `https://www.figma.com/make/${figmaFileKey}/POS#/invite/${token}`;

    // Prepare email content based on user existence
    let htmlContent = '';
    let subject = '';

    if (userExists) {
      // Template for existing user
      subject = `📬 Invitación a ${business.name} - Sistema POS`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .button { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏪 Nueva Invitación de Negocio</h1>
            </div>
            <div class="content">
              <h2>¡Hola!</h2>
              <p>Has sido invitado a formar parte del equipo de <strong>${business.name}</strong>.</p>
              
              <div class="info-box">
                <p><strong>📋 Detalles de la invitación:</strong></p>
                <p>🏪 <strong>Negocio:</strong> ${business.name}</p>
                <p>👤 <strong>Tu rol:</strong> ${roleName}</p>
              </div>

              <p>Como ya tienes una cuenta en Sistema POS, solo necesitas aceptar la invitación para comenzar a trabajar con este negocio.</p>
              
              <p style="text-align: center;">
                <a href="${invitationUrl}" class="button">✅ Aceptar Invitación</a>
              </p>

              <p style="color: #6b7280; font-size: 14px;">Esta invitación expirará en 7 días.</p>
            </div>
            <div class="footer">
              <p>Sistema POS - Gestión inteligente para tu negocio</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // Template for new user
      subject = `🎉 Bienvenido a ${business.name} - Sistema POS`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .button { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 ��Bienvenido a Sistema POS!</h1>
            </div>
            <div class="content">
              <h2>¡Hola ${name}!</h2>
              <p>Has sido invitado a formar parte del equipo de <strong>${business.name}</strong>.</p>
              
              <div class="info-box">
                <p><strong>📋 Detalles de tu invitación:</strong></p>
                <p>🏪 <strong>Negocio:</strong> ${business.name}</p>
                <p>👤 <strong>Tu rol:</strong> ${roleName}</p>
                <p>📧 <strong>Tu correo:</strong> ${email}</p>
              </div>

              <p>Para comenzar, necesitas crear tu cuenta en Sistema POS. Es rápido y fácil:</p>
              
              <p style="text-align: center;">
                <a href="${invitationUrl}" class="button">🚀 Crear Mi Cuenta</a>
              </p>

              <p>Una vez que crees tu cuenta, automáticamente formarás parte de <strong>${business.name}</strong> con el rol de <strong>${roleName}</strong>.</p>

              <p style="color: #6b7280; font-size: 14px;">Esta invitación expirará en 7 días.</p>
            </div>
            <div class="footer">
              <p>Sistema POS - Gestión inteligente para tu negocio</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Send email with Brevo
    try {
      console.log('📧 [INVITE] Sending email via Brevo...');
      await sendEmailWithBrevo(email, subject, htmlContent);
      console.log('✅ [INVITE] Invitation email sent to:', email);
    } catch (emailError: any) {
      console.error('⚠️ [INVITE] Error sending invitation email:', emailError.message);
      // Don't fail the invitation if email fails
    }

    console.log('✅ [INVITE] Invitation process completed successfully');
    return c.json({
      success: true,
      message: 'Invitation sent successfully',
      token,
      userExists,
    });
  } catch (error: any) {
    console.error('❌ [INVITE] Error inviting employee:', error);
    console.error('❌ [INVITE] Error stack:', error.stack);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Validate invitation token
app.get("/make-server-3508045b/validate-invitation/:token", async (c) => {
  try {
    const token = c.req.param('token');
    
    console.log('🔍 Validating invitation token:', token);

    // Get invitation from kv_store
    const invitation = await kv.get(`invitation:${token}`);

    if (!invitation) {
      return c.json({ error: 'Invalid or expired invitation' }, 404);
    }

    // Check if expired
    if (Date.now() > invitation.expiresAt) {
      await kv.del(`invitation:${token}`);
      return c.json({ error: 'Invitation has expired' }, 400);
    }

    return c.json({
      success: true,
      invitation: {
        businessName: invitation.businessName,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        userExists: invitation.userExists,
      },
    });
  } catch (error: any) {
    console.error('Error validating invitation:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Accept invitation
app.post("/make-server-3508045b/accept-invitation", async (c) => {
  try {
    const body = await c.req.json();
    const { token, password } = body;

    console.log('✅ Accepting invitation with token:', token);

    // Get invitation from kv_store
    const invitation = await kv.get(`invitation:${token}`);

    if (!invitation) {
      return c.json({ error: 'Invalid or expired invitation' }, 404);
    }

    // Check if expired
    if (Date.now() > invitation.expiresAt) {
      await kv.del(`invitation:${token}`);
      return c.json({ error: 'Invitation has expired' }, 400);
    }

    let userId: string;

    // If user doesn't exist, create account
    if (!invitation.userExists) {
      if (!password || password.length < 6) {
        return c.json({ error: 'Password must be at least 6 characters' }, 400);
      }

      console.log('👤 Creating new user account for:', invitation.email);

      const { data: newUser, error: signupError } = await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: { name: invitation.name },
      });

      if (signupError) {
        console.error('❌ Error creating user:', signupError);
        return c.json({ error: signupError.message }, 400);
      }

      userId = newUser.user.id;
      console.log('✅ User created with ID:', userId);
    } else {
      // User exists, get their ID from Auth
      console.log('👤 User exists, looking up ID for:', invitation.email);
      
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers.users.find(u => u.email === invitation.email);
      
      if (!existingUser) {
        return c.json({ error: 'User not found' }, 404);
      }

      userId = existingUser.id;
      console.log('✅ Found user ID:', userId);
    }

    // Create employee record
    console.log('📝 Creating employee record...');
    await dbEmployees.createEmployee(invitation.businessId, {
      name: invitation.name,
      email: invitation.email,
      phone: invitation.phone,
      role: invitation.role,
      permissions: invitation.permissions,
      is_owner: false,
      is_active: true,
    });

    console.log('✅ Employee record created');

    // Delete invitation token
    await kv.del(`invitation:${token}`);
    console.log('🗑️ Invitation token deleted');

    return c.json({
      success: true,
      message: 'Invitation accepted successfully',
      userExists: invitation.userExists,
      email: invitation.email,
    });
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// Create employee with auth account (v2 - new endpoint to force redeploy)
app.post("/make-server-3508045b/create-employee-v2", async (c) => {
  try {
    console.log('👤 [CREATE-EMP-V2] Starting employee creation process...');
    
    const body = await c.req.json();
    const { businessId, name, email, phone, role, permissions, temporaryPassword } = body;
    
    console.log('👤 [CREATE-EMP-V2] Request data:', { businessId, name, email, role });
    
    if (!businessId || !name || !email || !role || !permissions) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Verify business exists
    const business = await dbBusinesses.getBusinessById(businessId);
    if (!business) {
      return c.json({ error: 'Business not found' }, 404);
    }

    // Check if employee already exists
    const existingEmployee = await dbEmployees.getEmployeeByEmail(businessId, email);
    if (existingEmployee) {
      return c.json({ error: 'Employee already exists in this business' }, 400);
    }

    console.log('👤 [CREATE-EMP-V2] Checking if user exists in Auth...');
    
    // Check if user exists in Auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u => u.email === email);
    
    let userId: string | null = null;
    let userExists = false;

    if (existingUser) {
      console.log('👤 [CREATE-EMP-V2] User already exists in Auth');
      userId = existingUser.id;
      userExists = true;
      console.log('👤 [CREATE-EMP-V2] userId from existing:', userId, 'type:', typeof userId);
    } else {
      console.log('👤 [CREATE-EMP-V2] Creating new user in Auth...');
      
      // Create user in Auth with temporary password
      const password = temporaryPassword || Math.random().toString(36).slice(-12) + 'A1!';
      console.log('👤 [CREATE-EMP-V2] Using password length:', password.length);
      
      const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Auto-confirm since we don't have email server configured
        user_metadata: { name: name }
      });

      if (authError || !newUser.user) {
        console.error('��� [CREATE-EMP-V2] Error creating user:', authError);
        return c.json({ error: authError?.message || 'Failed to create user' }, 500);
      }

      userId = newUser.user.id;
      console.log('✅ [CREATE-EMP-V2] User created in Auth:', userId, 'type:', typeof userId);
    }

    // Validate userId before inserting
    if (!userId || typeof userId !== 'string' || userId.length === 0) {
      console.error('❌ [CREATE-EMP-V2] Invalid userId:', userId);
      return c.json({ error: 'Failed to get valid user ID' }, 500);
    }

    // Create employee record
    console.log('👤 [CREATE-EMP-V2] Creating employee record with userId:', userId);
    await dbEmployees.createEmployee(businessId, {
      user_id: userId, // ⚠️ FIX: Vincular el user_id
      name,
      email,
      phone: phone || null,
      role,
      permissions,
      is_owner: false,
      is_active: true,
    });

    console.log('✅ [CREATE-EMP-V2] Employee created successfully');

    return c.json({
      success: true,
      userExists,
      message: userExists 
        ? 'Employee added to business. User can login with existing credentials.'
        : 'Employee created with temporary password. User should reset password on first login.'
    });
  } catch (error: any) {
    console.error('❌ [CREATE-EMP-V2] Error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ==================== END EMPLOYEE INVITATIONS ENDPOINTS ====================

// NEW V3 ENDPOINT - Completely separate to force redeploy
app.post("/make-server-3508045b/create-employee-v3", createEmployeeV3);

// SEND INVITATION EMAIL ENDPOINT
app.post("/make-server-3508045b/send-invitation", sendInvitationEmail);

// CHECK IF USER EXISTS (for invite links)
app.post("/make-server-3508045b/check-user-exists", async (c) => {
  try {
    const { email } = await c.req.json();
    console.log('🔍 [CHECK-USER] Checking if user exists:', email);

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Get all users and check if email exists
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ [CHECK-USER] Error:', error);
      return c.json({ error: error.message }, 500);
    }

    const exists = users.users.some(u => u.email === email);
    console.log('✅ [CHECK-USER] User exists?', exists);

    return c.json({ exists });
  } catch (error: any) {
    console.error('❌ [CHECK-USER] Fatal error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// CREATE USER (for invite links with new users)
app.post("/make-server-3508045b/create-user", async (c) => {
  try {
    const { email, password, name, phone } = await c.req.json();
    console.log('👤 [CREATE-USER] Creating user:', email);

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Create user in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        phone
      }
    });

    if (error) {
      console.error('❌ [CREATE-USER] Error:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log('✅ [CREATE-USER] User created:', data.user?.id);
    return c.json({ userId: data.user?.id });
  } catch (error: any) {
    console.error('❌ [CREATE-USER] Fatal error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ACCEPT INVITE ENDPOINT - Complete invitation process
app.post("/make-server-3508045b/accept-invite", async (c) => {
  try {
    const { businessId, email, userId } = await c.req.json();
    
    console.log('📥 ACCEPT INVITE:', { businessId, email, userId });

    if (!businessId || !email || !userId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Actualizar employee con el user_id
    const { data: employee, error: updateError } = await supabaseAdmin
      .from('employees')
      .update({ user_id: userId, is_active: true })
      .eq('business_id', businessId)
      .ilike('email', email)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating employee:', updateError);
      return c.json({ error: updateError.message }, 500);
    }

    console.log('✅ Employee activated:', employee);

    return c.json({
      success: true,
      employee,
    });
  } catch (error: any) {
    console.error('❌ [ACCEPT-INVITE] Error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// CHECK USER EXISTS - verifica si un email ya tiene cuenta en auth.users
app.post("/make-server-3508045b/check-user-exists", async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) return c.json({ error: 'Email requerido' }, 400);

    console.log('🔍 [CHECK-USER] Buscando usuario por email:', email);

    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      console.error('❌ [CHECK-USER] Error listando usuarios:', error);
      return c.json({ exists: false });
    }

    const user = data.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    console.log('🔍 [CHECK-USER] Usuario encontrado:', !!user, user?.id);

    return c.json({
      exists: !!user,
      userId: user?.id || null,
    });
  } catch (error: any) {
    console.error('❌ [CHECK-USER] Error:', error);
    return c.json({ exists: false });
  }
});

// REPAIR EMPLOYEE LINK - vincula manualmente un empleado con su cuenta de auth
app.post("/make-server-3508045b/repair-employee-link", async (c) => {
  try {
    const { businessId, email } = await c.req.json();
    if (!businessId || !email) {
      return c.json({ error: 'businessId y email son requeridos' }, 400);
    }

    const emailClean = email.trim().toLowerCase();
    console.log('🔧 [REPAIR] email:', emailClean, '| negocio:', businessId);

    // 1. Verificar que el negocio existe
    const { data: bizData, error: bizError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .single();

    if (bizError || !bizData) {
      return c.json({ error: 'Negocio no encontrado' }, 404);
    }

    // 2. Verificar que el empleado existe en la tabla (incluyendo inactivos)
    const { data: empData, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, email, user_id, is_active')
      .eq('business_id', businessId)
      .ilike('email', emailClean)
      .order('is_active', { ascending: false }); // activos primero

    if (empError) {
      console.error('❌ [REPAIR] Error buscando empleado:', empError);
      return c.json({ error: `Error al buscar empleado: ${empError.message}` }, 500);
    }

    if (!empData || empData.length === 0) {
      return c.json({ error: `No existe empleado con email ${email} en este negocio` }, 404);
    }

    console.log('✅ [REPAIR] Filas encontradas:', empData.length, '| Usando id:', empData[0].id, '| is_active:', empData[0].is_active);

    // 3. Buscar en auth.users con paginación completa (default Supabase = 50 por página)
    let authUser: any = null;
    let page = 1;
    while (!authUser) {
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (listError) {
        console.error('❌ [REPAIR] listUsers error pág', page, ':', listError);
        return c.json({ error: `Error consultando auth.users: ${listError.message}` }, 500);
      }

      if (!listData?.users?.length) break;

      authUser = listData.users.find(
        (u: any) => u.email?.toLowerCase() === emailClean
      );

      if (listData.users.length < 1000) break;
      page++;
    }

    if (!authUser) {
      return c.json({
        error: `El email ${email} no tiene cuenta en Supabase todavía. Debe aceptar la invitación primero.`,
      }, 404);
    }

    console.log('✅ [REPAIR] auth.users id:', authUser.id);

    // 4. Actualizar SOLO por id específico (row con is_active preferida)
    // Actualizamos user_id Y forzamos is_active=true para que aparezca en getUserBusinesses
    const targetId = empData[0].id;
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('employees')
      .update({ user_id: authUser.id, is_active: true })
      .eq('id', targetId)
      .select();

    if (updateError) {
      console.error('❌ [REPAIR] Update error:', updateError);
      return c.json({ error: `Error al actualizar: ${updateError.message}` }, 500);
    }

    console.log('✅ [REPAIR] OK — empleado actualizado id:', targetId);

    return c.json({
      success: true,
      message: `Cuenta vinculada. ${email} ya puede ver este negocio.`,
      employee: updated?.[0] || null,
    });
  } catch (error: any) {
    console.error('❌ [REPAIR] Excepción:', error.message);
    return c.json({ error: error.message || 'Error interno' }, 500);
  }
});

// ============================================================================
// Super Admin: Edge Function dedicada (slug p. ej. swift-task en superadminEdgeSlug.ts; no duplicar aquí).

// Error handler
app.onError((err, c) => {
  console.error('❌ [GLOBAL ERROR]:', err.message);
  console.error('❌ [GLOBAL ERROR] Stack:', err.stack);
  return c.json({ error: 'Internal server error', details: err.message }, 500);
});

console.log('✅ All routes registered');
console.log('🚀 Starting server v6.0.0-invitations...');
console.log('🚀 Deploy ID:', DEPLOY_ID);
console.log('🚀 TIMESTAMP:', new Date().toISOString());

Deno.serve(app.fetch);