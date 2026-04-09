# 🔌 Base de Datos Lista para Integraciones

## 🎯 **Resumen: ¿Por qué es fácil integrar?**

Este esquema SQL está **diseñado profesionalmente** para permitir integraciones con:

### ✅ **Integraciones Soportadas desde el Día 1:**

1. **Facturación Electrónica**
   - DIAN (Colombia)
   - SAT (México)
   - SUNAT (Perú)
   - Cualquier sistema fiscal

2. **Pasarelas de Pago**
   - Stripe
   - PayPal
   - MercadoPago
   - PayU

3. **E-commerce**
   - WooCommerce
   - Shopify
   - Magento

4. **Contabilidad**
   - QuickBooks
   - Xero
   - Alegra

5. **CRM & Marketing**
   - Salesforce
   - HubSpot
   - Mailchimp

6. **Bancos (Conciliación Bancaria)**
   - PSE
   - APIs Bancarias

---

## 🏗️ **Arquitectura para Integraciones**

### **21 Tablas Totales (11 principales + 10 para integraciones):**

#### **Tablas de Integraciones:**

| # | Tabla | Propósito |
|---|-------|-----------|
| 12 | `business_settings` | Configuraciones flexibles (API keys, tax rates, etc.) |
| 13 | `integrations` | Registro de integraciones activas |
| 14 | `integration_logs` | Auditoría completa de llamadas API |
| 15 | `external_ids` | Mapeo de IDs entre sistemas |
| 16 | `webhooks` | Configuración de webhooks salientes |
| 17 | `webhook_logs` | Log de webhooks enviados |
| 18 | `invoices` | Facturación electrónica (XML, PDF, QR) |
| 19 | `invoice_items` | Detalle de facturas |
| 20 | `subscriptions` | Planes y suscripciones (monetización) |
| 21 | `subscription_payments` | Historial de pagos de suscripción |

---

## 🚀 **Ejemplo: ¿Cómo integrar con Stripe?**

### **Paso 1: Registrar la integración**
```sql
INSERT INTO integrations (business_id, provider, name, status, config)
VALUES (
  'uuid-del-negocio',
  'stripe',
  'Stripe Payments',
  'active',
  '{"webhook_secret": "whsec_...", "api_version": "2024-01-01"}'::jsonb
);
```

### **Paso 2: Cuando haces una venta**
```javascript
// 1. Crear venta en tu base de datos
const sale = await createSale({ ... });

// 2. Crear cargo en Stripe
const stripeCharge = await stripe.charges.create({ ... });

// 3. Guardar el ID externo
await db.external_ids.insert({
  business_id: '...',
  entity_type: 'sale',
  entity_id: sale.id,
  provider: 'stripe',
  external_id: stripeCharge.id
});

// 4. Log de la integración
await db.integration_logs.insert({
  provider: 'stripe',
  action: 'create_charge',
  success: true,
  response_data: stripeCharge
});
```

### **Paso 3: Recibir webhooks de Stripe**
```javascript
// Stripe te notifica cuando hay un pago
app.post('/webhooks/stripe', async (req, res) => {
  const event = req.body;
  
  // Guardar log del webhook recibido
  await db.integration_logs.insert({
    direction: 'incoming',
    provider: 'stripe',
    action: event.type,
    request_data: event
  });
  
  // Procesar el evento
  if (event.type === 'payment_intent.succeeded') {
    // Actualizar tu venta
  }
});
```

---

## 🧩 **Ejemplo: Facturación Electrónica (DIAN Colombia)**

### **1. Configurar integración con proveedor (Alegra, Siigo, etc.)**
```sql
INSERT INTO integrations (business_id, provider, name)
VALUES ('...', 'dian_colombia', 'Facturación DIAN');
```

### **2. Generar factura electrónica**
```javascript
// 1. Tienes la venta
const sale = await getSale(saleId);

// 2. Enviar a proveedor de facturación
const response = await dianProvider.createInvoice({
  sale: sale,
  customer: customer,
  items: saleItems
});

// 3. Guardar factura en tu BD
await db.invoices.insert({
  business_id: sale.business_id,
  sale_id: sale.id,
  invoice_number: response.number,
  cufe: response.cufe,
  xml_url: response.xml_url,
  pdf_url: response.pdf_url,
  qr_code: response.qr_code,
  status: 'authorized'
});
```

---

## 📊 **Ejemplo: Sincronización con WooCommerce**

```javascript
// 1. Producto creado en tu POS
const product = await db.products.insert({ ... });

// 2. Sincronizar con WooCommerce
const wcProduct = await woocommerce.createProduct({
  name: product.name,
  price: product.price,
  stock_quantity: product.stock
});

// 3. Guardar relación
await db.external_ids.insert({
  entity_type: 'product',
  entity_id: product.id,
  provider: 'woocommerce',
  external_id: wcProduct.id
});

// 4. Cuando hay venta en WooCommerce
wooCommerce.onWebhook('order.created', async (order) => {
  // Crear venta en tu POS
  const sale = await db.sales.insert({ ... });
  
  // Descontar inventario automáticamente (triggers)
  // Guardar relación
  await db.external_ids.insert({
    entity_type: 'sale',
    entity_id: sale.id,
    provider: 'woocommerce',
    external_id: order.id
  });
});
```

---

## 🔐 **Seguridad de API Keys**

### **Opción 1: Encriptado en la tabla**
```sql
-- Guardar API key encriptada
UPDATE integrations 
SET credentials_encrypted = pgp_sym_encrypt('sk_live_...', 'encryption_key')
WHERE provider = 'stripe';
```

### **Opción 2: Supabase Vault (Recomendado)**
```sql
-- Guardar en Vault
SELECT vault.create_secret('stripe_api_key', 'sk_live_...');

-- Usar desde código
SELECT decrypted_secret 
FROM vault.decrypted_secrets 
WHERE name = 'stripe_api_key';
```

---

## 🎁 **Ventajas de Este Diseño**

### ✅ **Campos JSONB**
- `metadata` en cada tabla → Datos flexibles sin migrations
- Puedes guardar cualquier cosa: `{"stripe_customer_id": "cus_123"}`

### ✅ **Tabla `external_ids`**
- Mapea CUALQUIER entidad con CUALQUIER sistema externo
- Un producto puede tener IDs en: WooCommerce, Shopify, QuickBooks

### ✅ **Tabla `integration_logs`**
- **Auditoría completa** de toda integración
- Debug fácil: ves request, response, errores
- Métricas: cuánto tarda cada API

### ✅ **Tabla `webhooks`**
- Configura webhooks para notificar a OTROS sistemas
- Ejemplo: Notificar a Zapier cuando hay venta

### ✅ **Preparado para Multi-país**
- Campo `country` en businesses
- Campo `currency` en businesses
- Tabla `invoices` soporta DIAN, SAT, SUNAT, etc.

---

## 📋 **Casos de Uso Reales**

### **Caso 1: Tienda Física + Tienda Online**
```
POS (venta física) 
  ↓
Base de Datos
  ↓ (sincronización automática)
WooCommerce (actualiza inventario)
  ↓ (venta online)
Base de Datos (descuenta inventario)
  ↓
POS refleja inventario actualizado
```

### **Caso 2: Multi-país con facturación local**
```
Negocio en Colombia
  → Integración DIAN
  → Facturas con CUFE

Negocio en México  
  → Integración SAT
  → Facturas con UUID

Mismo código, diferentes integraciones
```

### **Caso 3: Suscripciones (Monetización)**
```
Usuario se registra (free)
  ↓
Crece su negocio
  ↓
Upgradeaa a plan Premium
  ↓
Stripe cobra mensualmente
  ↓
Webhook actualiza `subscriptions`
  ↓
Si pago falla → deshabilitar features
```

---

## 🎯 **Resumen Final**

### **¿Es fácil integrar?**
**SÍ, SÚPER FÁCIL** porque el esquema tiene:

1. ✅ Tablas específicas para integraciones
2. ✅ Logs automáticos de todo
3. ✅ Mapeo de IDs externos
4. ✅ JSONB para flexibilidad
5. ✅ Webhooks bidireccionales
6. ✅ Multi-país y multi-moneda
7. ✅ Facturación electrónica built-in
8. ✅ Sistema de suscripciones listo

### **Integraciones comunes que puedes hacer:**
- 🟢 Stripe, PayPal, MercadoPago (Pagos)
- 🟢 DIAN, SAT, SUNAT (Facturación electrónica)
- 🟢 WooCommerce, Shopify (E-commerce)
- 🟢 QuickBooks, Xero, Alegra (Contabilidad)
- 🟢 WhatsApp Business API (Notificaciones)
- 🟢 Twilio (SMS)
- 🟢 SendGrid, Mailchimp (Email marketing)
- 🟢 Zapier, Make.com (Automatizaciones)

---

## 📞 **¿Listo para ejecutar?**

1. Ve a Supabase → SQL Editor
2. Ejecuta `database-schema.sql`
3. Avísame cuando esté listo
4. Empezamos a migrar el código del backend

🚀 **¡Tu base de datos será la más profesional que hayas visto!**
