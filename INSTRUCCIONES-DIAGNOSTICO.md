# 🔧 INSTRUCCIONES PASO A PASO PARA DIAGNOSTICAR EL PROBLEMA

## 📋 PASO 1: Preparación
1. Abre tu navegador en modo incógnito (para empezar desde cero)
2. Abre las **DevTools** (F12 o clic derecho → Inspeccionar)
3. Ve a la pestaña **Console**
4. ⚠️ **IMPORTANTE**: Mantén la consola abierta todo el tiempo

---

## 📋 PASO 2: Registrar una Nueva Cuenta
1. Ve a la página de registro
2. Completa el formulario con:
   - **Nombre del negocio**: "Test Diagnóstico"
   - **Email**: usa un email NUEVO que nunca hayas usado (ej: `test123@test.com`)
   - **Contraseña**: cualquier contraseña de 6+ caracteres
3. Haz clic en "Enviar Código"
4. Usa el código maestro: `999999`
5. Haz clic en "Crear Cuenta"

### ✅ Qué esperar:
- Deberías ver en consola:
  ```
  ✅ Cuenta creada: {...}
  🔐 Iniciando sesión con Supabase client...
  ✅ Sesión obtenida desde Supabase client
  🔑 Access Token: eyJhbGciOiJFUzI1NiIs...
  ```

### ❌ Si ves error:
- Copia TODO el log de la consola y envíamelo

---

## 📋 PASO 3: Usar la Herramienta de Diagnóstico
1. Si lograste registrarte pero ves "Sesión expirada":
   - Ve a **Más** (ícono de menú)
   - Haz clic en **"Diagnóstico"** (nuevo ítem con ícono 🔧)

2. Haz clic en **"▶️ Ejecutar Diagnóstico Completo"**

3. **ESPERA** a que termine (verás 5 pasos)

4. Para CADA paso que tenga un ❌ rojo:
   - Haz clic en "Ver detalles técnicos"
   - Copia el contenido completo

### ✅ Qué significa cada paso:
- **Paso 1**: Verifica que tengas sesión
- **Paso 2**: Verifica que el servidor esté funcionando
- **Paso 3**: 🔥 **ESTE ES EL IMPORTANTE** - Prueba si tu token es válido
- **Paso 4**: Prueba si puedes cargar negocios
- **Paso 5**: Verifica localStorage

---

## 📋 PASO 4: Revisar Logs del Servidor (IMPORTANTE)

### Opción A: Si tienes acceso a Supabase Dashboard
1. Ve a tu proyecto de Supabase
2. Ve a **Edge Functions** → **make-server-3508045b**
3. Haz clic en **"Logs"**
4. Busca los logs que empiezan con:
   ```
   🧪 ========== TEST AUTH ENDPOINT ==========
   ```
5. Copia TODO ese bloque de logs

### Opción B: Si no tienes acceso
1. Dime y te ayudo a configurar el acceso

---

## 📋 PASO 5: Enviarme la Información

Por favor envíame:

### 1️⃣ Logs del Frontend (Consola del Navegador)
- Copia TODO desde que haces clic en "Crear Cuenta" hasta que aparece el error
- Incluye TODOS los emojis (🔐, ✅, ❌, etc.) porque me ayudan a identificar las líneas

### 2️⃣ Resultados del Diagnóstico
- Haz screenshot de la página de diagnóstico
- O copia el JSON de los detalles de cada paso que falló

### 3️⃣ Logs del Servidor
- Copia los logs del servidor que mencionan `🧪 TEST AUTH ENDPOINT`
- Si ves otros logs con `❌ [AUTH]`, cópialos también

---

## 🎯 LO QUE ESTAMOS BUSCANDO

El **Paso 3** del diagnóstico es el más importante. Debe decir:

✅ **CORRECTO**:
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "tu@email.com"
  },
  "message": "Token is valid!"
}
```

❌ **INCORRECTO** (el problema actual):
```json
{
  "success": false,
  "error": "Invalid JWT",
  "step": "token_validation"
}
```

Si el Paso 3 falla, los logs del servidor nos dirán EXACTAMENTE por qué el token no es válido.

---

## 💡 NOTA IMPORTANTE

Los cambios que hice necesitan que el servidor se **re-despliegue**. Si el diagnóstico sigue fallando igual que antes, es posible que:

1. El servidor no se haya actualizado todavía
2. Hay un problema de caché

En ese caso, necesitarás **re-desplegar manualmente** la Edge Function o esperar unos minutos.

---

¿Listo? **Comienza desde el Paso 1** y envíame toda la información del Paso 5. Con esos logs podré identificar exactamente qué está causando el problema del "Invalid JWT".
