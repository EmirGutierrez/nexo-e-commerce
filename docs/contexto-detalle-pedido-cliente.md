# Detalle de pedidos en la cuenta del cliente

## Rama y alcance

- Rama: `feature/detail-sale`.
- Cambios limitados al frontend Next.js: historial de compras del cliente, vista de detalle, cabecera reutilizable y estilos de esas pantallas.
- No se modificaron controladores, servicios, entidades, base de datos, migraciones ni contratos del backend.
- Se revisó de forma read-only la respuesta que ya utiliza `/api/catalog/my/orders` para identificar los campos disponibles.

## Experiencia

- Cada pedido del historial ahora es un enlace accesible que abre `/account/orders/{id}`.
- La nueva pantalla presenta folio, fecha, estado, artículos, cantidades, SKU, precios unitarios y subtotales, resumen de importes, descuento/código, pago, datos del destinatario y dirección.
- El progreso visual se deriva del estado persistido del pedido (`Pendiente de pago`, `En preparación`, `Completado` o `Cancelado`) y del estado de pago disponible. Los pedidos cancelados muestran un aviso específico.
- Los artículos no incluyen URL de imagen en la respuesta del pedido actual. La pantalla busca imágenes vigentes en el catálogo público usando el ID de producto y muestra un icono de respaldo cuando el producto o su imagen ya no están disponibles.
- El detalle vuelve a consultar `/api/catalog/my/orders`, que ya limita la respuesta a los pedidos de la cuenta autenticada. No se añadió un endpoint de lectura individual ni se muestra información de otra cuenta.
- Si la persona no tiene sesión de cliente, si el pedido no está en su historial o falla la lectura, se muestra un estado apropiado y un enlace para volver a sus compras.
- El diseño comparte la cabecera de la cuenta y mantiene estilos responsive para escritorio y móvil.

## Datos utilizados

- Respuesta existente: `id`, `createdAt`, `data.orderNumber`, `customer`, `customerEmail`, `customerPhone`, `address`, `date`, `status`, `paymentStatus`, `paymentMethod`, `payment`, `subtotal`, `discountAmount`, `discountCode`, `total` e `items`.
- Renglones existentes: `productId`, `productName`, `sku`, `quantity`, `unitPrice` y `subtotal`.
- Las imágenes se enriquecen en frontend con el catálogo público vigente. No se alteran ni se presentan como una captura histórica del momento de compra.

## Archivos modificados/agregados

- `src/app/(public)/account/orders/[id]/page.tsx`: ruta dinámica de detalle.
- `src/app/(public)/account/page.tsx`: uso de la cabecera común.
- `src/modules/commerce/components/CustomerAccountPage.tsx`: enlaces desde el historial hacia el detalle.
- `src/modules/commerce/components/CustomerOrderDetailPage.tsx`: carga segura de pedido, artículos, progreso y datos de compra.
- `src/modules/commerce/components/CustomerAccountHeader.tsx`: cabecera compartida para cuenta y detalle.
- `src/services/index.ts`: definición frontend ampliada de los campos ya devueltos por el servicio.
- `src/app/globals.css`: estilos del detalle, progreso y estados responsive.
- `docs/contexto-detalle-pedido-cliente.md`: alcance, fuentes de datos y validación para revisión/PR.

## Criterios de aceptación

- Desde Mis compras se puede abrir el detalle de cualquier pedido del historial.
- El detalle muestra los campos existentes sin inventar datos y deriva su línea de progreso del estado persistido.
- Se muestran imágenes vigentes si el catálogo tiene una imagen disponible; un producto sin imagen no bloquea el resto del detalle.
- Un pedido ajeno o no encontrado no se expone: se muestra un estado de error y opción de volver.
- El flujo es responsive y solo usa APIs existentes; no se modifica backend.

## Validación

- `npm run build`: completado correctamente; compilación, TypeScript, generación estática y ruta dinámica `/account/orders/[id]`.
- `git diff --check`: completado sin errores.

## Descripción propuesta para el PR

Permite abrir una pantalla de detalle desde cada pedido del historial de la cuenta. Muestra artículos con imagen disponible, cantidad, precio y subtotal, progreso derivado del estado persistido, importes, descuento, método/estado de pago y datos de entrega. Reutiliza las respuestas existentes del cliente y del catálogo; no agrega endpoints ni modifica backend.
