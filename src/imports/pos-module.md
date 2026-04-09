🎯 Objetivo
Diseñar un módulo principal tipo POS moderno que permita:
•	Registrar ventas
•	Registrar gastos
•	Manejar múltiples métodos de pago
•	Manejar ventas a crédito
•	Editar precios según permisos
•	Funcionar como PWA responsive (desktop + móvil)
Interfaz rápida, limpia y optimizada para uso tipo caja.
 
🧱 Estructura General
Pantalla dividida en 2 grandes estados:
1.	🧾 Modo Venta (por defecto)
2.	💸 Modo Gasto
Selector superior tipo toggle o tabs:
[ Venta ] [ Gasto ]
 
🟢 MODO VENTA
🧩 Layout Desktop
IZQUIERDA — Catálogo de productos
•	Buscador superior
•	Filtros por categoría (chips scrollables)
•	Grid de productos
•	Cada tarjeta muestra:
o	Imagen
o	Nombre
o	Precio
o	Indicador de stock
•	Click agrega al carrito
________________________________________
DERECHA — Carrito
Cada producto agregado debe mostrar:
•	Imagen pequeña
•	Nombre
•	Control cantidad (+ / -)
•	Campo editable de precio (si el rol lo permite)
•	Subtotal por producto
•	Botón eliminar
El subtotal por producto debe calcularse como:
subtotal=priceatsale∗quantitysubtotal=priceatsale∗quantity
________________________________________
🔢 Resumen inferior del carrito
Mostrar:
•	Total productos
•	Total venta grande y destacado
•	Total pagado
•	Saldo pendiente
El total de la venta debe calcularse como:
total=sum(subtotals)total=sum(subtotals)
El saldo restante debe calcularse como:
remaining=total−sum(payments)remaining=total−sum(payments)
________________________________________
💳 Módulo de Pagos Múltiples
Sección expandible “Pagos”.
Permitir agregar múltiples líneas de pago:
Cada línea incluye:
•	Método (Efectivo / Tarjeta / Transferencia)
•	Monto
•	Botón eliminar
Estados automáticos:
•	Si remaining = 0 → Venta pagada
•	Si remaining > 0 y hay pagos → Pago parcial
•	Si no hay pagos → Crédito
________________________________________
🟣 Venta a Crédito
Si el saldo es mayor a 0:
•	Cliente obligatorio
•	Buscador de clientes
•	Botón “Crear cliente”
Indicador visual: “Venta a crédito”
________________________________________
🔐 Permisos
•	Rol básico: no puede editar precio
•	Rol avanzado: puede editar precio antes de confirmar
•	Solo admin puede editar venta confirmada
•	Super admin puede editar siempre
 
🔵 Botón Principal
Botón fijo inferior:
“Confirmar operación”
Debe cambiar dinámicamente:
•	Confirmar venta
•	Confirmar venta a crédito
•	Confirmar pago parcial
 
🔴 MODO GASTO
Al cambiar a modo Gasto, ocultar catálogo y carrito.
Mostrar formulario limpio:
Campos:
•	Fecha (por defecto hoy)
•	Categoría (dropdown obligatorio)
•	Proveedor (opcional)
•	Método de pago (Efectivo / Tarjeta / Transferencia)
•	Monto
•	Notas
Botón inferior fijo:
“Guardar gasto”
 
🎨 Requisitos de Diseño
•	Minimalista
•	Colores neutros
•	Total grande y destacado
•	Diseño táctil
•	Componentes reutilizables
•	Preparado para conexión a Supabase
•	Pensado para uso continuo tipo caja física
 
🧠 Arquitectura implícita (no visible en UI pero considerada)
Entidades necesarias:
•	sales
•	sale_items
•	sale_payments
•	expenses
•	clients
•	suppliers
•	categories
 
🚀 Resultado esperado
Un único módulo operativo donde el usuario puede:
•	Vender productos
•	Dividir pagos
•	Registrar crédito
•	Registrar gastos
•	Trabajar rápido
•	Sin cambiar de pantalla

