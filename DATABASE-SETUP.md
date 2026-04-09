# 🚀 Instrucciones para Configurar la Base de Datos

## 📋 Paso 1: Acceder a Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. En el menú lateral, haz clic en **SQL Editor**

## 📝 Paso 2: Ejecutar el Script

1. Haz clic en **"New query"** (+ New query)
2. Abre el archivo `database-schema.sql` de este proyecto
3. **Copia TODO el contenido** del archivo
4. **Pégalo** en el SQL Editor de Supabase
5. Haz clic en **"Run"** (botón de play en la esquina inferior derecha)

⏱️ El script tardará unos 10-15 segundos en ejecutarse.

## ✅ Paso 3: Verificar

Si todo salió bien, verás un mensaje:
```
status: "Schema created successfully!"
```

Puedes verificar que las tablas se crearon:
1. Ve a **Table Editor** en el menú lateral
2. Deberías ver todas estas tablas:
   - users
   - businesses
   - business_users
   - products
   - customers
   - employees
   - sales
   - sale_items
   - sale_payments
   - expenses
   - stock_history

## 🎯 Paso 4: Avisar para Continuar

Una vez ejecutado el script, **avísame** y yo:
1. ✅ Modificaré todo el backend para usar las tablas reales
2. ✅ Implementaré el sistema multi-negocio
3. ✅ Crearé los endpoints para Super Admin
4. ✅ Migraremos los datos existentes (si los hay)

---

## 📊 ¿Qué incluye este esquema?

### ✨ Características Principales:

1. **Multi-tenant** - Un usuario puede tener múltiples negocios
2. **Seguridad** - Row Level Security (RLS) configurado
3. **Auditoría** - Historial de stock automático
4. **Integridad** - Foreign keys y constraints
5. **Performance** - Índices en todas las columnas importantes
6. **Escalabilidad** - Diseño normalizado y profesional

### 📁 Tablas Principales:

| Tabla | Descripción |
|-------|-------------|
| `users` | Información de usuarios (vinculado a auth.users) |
| `businesses` | Negocios (un usuario puede tener varios) |
| `business_users` | Relación muchos-a-muchos usuarios/negocios |
| `products` | Productos por negocio |
| `customers` | Clientes con gestión de crédito |
| `employees` | Empleados con roles y permisos |
| `sales` | Ventas (contado y crédito) |
| `sale_items` | Items de cada venta |
| `sale_payments` | Pagos múltiples por venta |
| `expenses` | Gastos del negocio |
| `stock_history` | Auditoría de movimientos de inventario |

### 🔄 Funciones Automáticas:

- ✅ **Actualización de stock** - Se descuenta automáticamente al hacer una venta
- ✅ **Historial de stock** - Se registra cada movimiento
- ✅ **Deuda de clientes** - Se actualiza automáticamente en ventas a crédito
- ✅ **Timestamps** - `updated_at` se actualiza solo

### 👁️ Vistas para Reportes:

- `business_stats` - Estadísticas completas de cada negocio
- `products_low_stock` - Productos con inventario bajo
- `top_selling_products` - Productos más vendidos
- `daily_sales` - Ventas agrupadas por día

### 🔒 Seguridad:

- Row Level Security (RLS) habilitado
- Usuarios solo ven datos de SUS negocios
- Preparado para Super Admin (se puede agregar role especial)

---

## ⚠️ Notas Importantes:

1. **Backup**: Si ya tienes datos, haz un backup antes
2. **Una sola vez**: Solo ejecuta el script una vez
3. **Errores**: Si hay errores, copia el mensaje y avísame
4. **Testing**: Puedes probar en un proyecto de prueba primero

---

## 🆘 ¿Problemas?

Si encuentras algún error al ejecutar el script:
1. Copia el mensaje de error completo
2. Toma captura de pantalla
3. Avísame y lo arreglaremos

---

## 🎉 Siguiente Paso

Una vez ejecutado exitosamente, yo me encargaré de:
- Actualizar todo el código del backend
- Implementar el contexto de múltiples negocios
- Crear los endpoints necesarios
- Probar que todo funcione

¡Listo para comenzar! 🚀
