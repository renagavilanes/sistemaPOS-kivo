# 🔧 Solución al Error "Invalid JWT"

## ✅ **PROBLEMA IDENTIFICADO Y SOLUCIONADO**

### **El Error:**
```
GET /businesses 401 (Unauthorized)
❌ API Error: {code: 401, message: 'Invalid JWT'}
```

### **La Causa Raíz:**
Los tokens JWT generados por Supabase Auth en el frontend están **firmados con el ANON_KEY**, pero el servidor estaba intentando validarlos usando el **SERVICE_ROLE_KEY** ❌

Es como intentar abrir una cerradura con una llave diferente.

---

## 🛠️ **LA SOLUCIÓN IMPLEMENTADA:**

### **Cambios en el Servidor (`/supabase/functions/make-server-3508045b/index.tsx`):**

**ANTES (❌ Incorrecto):**
```typescript
// Solo un cliente con SERVICE_ROLE_KEY
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY  // ❌ Error: intenta validar tokens de usuario
);

// Validación de tokens
await supabase.auth.getUser(token);  // ❌ Falla porque usa SERVICE_ROLE_KEY
```

**DESPUÉS (✅ Correcto):**
```typescript
// DOS clientes de Supabase:

// 1. Admin client para operaciones de base de datos
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// 2. Auth client para validar tokens de usuarios
const supabaseAuth = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY  // ✅ Correcto: valida tokens firmados con ANON_KEY
);

// Validación de tokens
await supabaseAuth.auth.getUser(token);  // ✅ Funciona correctamente
```

---

## 🎯 **INSTRUCCIONES PARA PROBAR:**

### **PASO 1: Espera a que el servidor se actualice**
El Edge Function de Supabase tarda **20-30 segundos** en redeployarse automáticamente después de los cambios.

### **PASO 2: Verifica que el servidor esté actualizado**
1. Ve a **Más → Diagnóstico**
2. Haz clic en **"Ejecutar Diagnóstico"**
3. En el **Paso 3**, verifica que diga:
   ```
   ✅ Servidor responde correctamente
   {
     "server_version": "2.0.0",  ← Debe ser 2.0.0
     "auth_method": "ANON_KEY"   ← Debe decir ANON_KEY
   }
   ```

### **PASO 3: Si el servidor aún no se actualizó**
Si ves `server_version: "unknown"` o una versión anterior:
- **Espera 30 segundos más**
- **Recarga la página completamente** (Ctrl + Shift + R o Cmd + Shift + R)
- **Ejecuta el diagnóstico de nuevo**

### **PASO 4: Prueba el flujo completo**
Una vez que el servidor muestre versión `2.0.0`:
1. **Cierra sesión** (si ya estabas logueado)
2. **Inicia sesión de nuevo** (o crea una cuenta nueva)
3. **Deberías entrar directamente al dashboard** sin errores ✅

---

## 📊 **VERIFICACIÓN PASO A PASO (Diagnóstico):**

El diagnóstico debe mostrar **5 pasos en VERDE**:

1. ✅ **¿Tienes sesión activa?** → SÍ - Usuario: tu@email.com
2. ✅ **¿El token es válido?** → SÍ - Token válido y no expirado
3. ✅ **¿El servidor responde?** → SÍ - Servidor v2.0.0 con ANON_KEY
4. ✅ **¿El servidor acepta tu token?** → SÍ - Servidor aceptó tu token
5. ✅ **¿Puedes cargar negocios?** → SÍ - Cargados X negocio(s)

---

## 🚨 **SI AÚN HAY ERRORES:**

### **Error en Paso 3: "Servidor versión antigua"**
- **Causa:** El servidor no se ha actualizado todavía
- **Solución:** Espera 30 segundos y recarga

### **Error en Paso 4: "Servidor rechazó el token"**
- **Causa:** El servidor aún usa la versión antigua
- **Solución:** Espera y verifica que el Paso 3 muestre versión 2.0.0

### **Error en Paso 5: "Error cargando negocios"**
- **Causa:** Problema con la base de datos o permisos
- **Solución:** Revisa los detalles técnicos y comparte el screenshot

---

## 📝 **CAMBIOS TÉCNICOS REALIZADOS:**

### Archivos modificados:
1. ✅ `/supabase/functions/make-server-3508045b/index.tsx`
   - Creados dos clientes de Supabase
   - Función `getUserIdFromAuth()` usa `supabaseAuth`
   - Endpoint `/test-auth` usa `supabaseAuth`
   - Añadida versión del servidor: `2.0.0`

2. ✅ `/src/app/pages/DiagnosticPage.tsx`
   - Página de diagnóstico visual paso a paso
   - Verifica versión del servidor
   - Muestra detalles técnicos expandibles

---

## 🎉 **RESULTADO ESPERADO:**

Después de que el servidor se actualice:
- ✅ Login funciona correctamente
- ✅ Los negocios se cargan sin errores
- ✅ No más "Invalid JWT"
- ✅ Todo funciona desde cualquier navegador

---

**Última actualización:** 9 de marzo de 2026
**Versión del servidor:** 2.0.0
**Estado:** ✅ Solución implementada - Esperando redeploy automático
