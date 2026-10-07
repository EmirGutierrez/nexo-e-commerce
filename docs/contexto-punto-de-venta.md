# Módulo de ventas: punto de venta e historial general

## Rama y alcance

- Rama de trabajo: `feature/refactor-sales`.
- Los cambios de este PR están en frontend: pantalla del módulo, estilos y esta documentación.
- No se modificaron backend Java, migraciones ni contratos/API.
- El frontend utiliza servicios existentes del BFF para leer catálogo, ventas presenciales y pedidos en línea, y para actualizar el estado de pedidos web.

## Flujo de entrada

Al entrar al módulo, el usuario elige entre:

1. **Venta presencial:** abre el punto de venta con búsqueda de productos por SKU/código, nombre o categoría; cuenta, cantidades, eliminación de artículos, total, captura de NIT y cobro en efectivo o tarjeta simulada.
2. **Consultar ventas:** abre el historial general con ventas presenciales persistidas, pedidos de tienda en línea y, si existen, ventas temporales creadas en la pestaña actual.

Las opciones visibles respetan los permisos de creación y consulta de ventas/pedidos configurados para el rol.

## Historial y cambio de estado

- El historial presenta folio, tipo de registro, cliente, NIT, fecha, método de pago, estado, total y acciones. Nombre de cliente y NIT ocupan columnas independientes.
- El NIT aparece cuando fue capturado en la venta presencial; el modelo de los pedidos web existentes no entrega ese campo, así que se muestra como no disponible para esos pedidos.
- La columna resumida de productos se quitó de la tabla. La acción **Ver** abre el registro y muestra todos los productos con SKU, cantidad, precio unitario y subtotal.
- Los pedidos en línea conservan sus renglones de productos desde el registro de respuesta que ya entrega el BFF. Las ventas presenciales muestran los renglones guardados por el backend o por la sesión actual.
- Las ventas presenciales persistidas se obtienen de `salesService.listInPerson()`; los pedidos web se obtienen de `orderService.list()`.
- La tabla usa la estructura reutilizada de los módulos administrativos: barra de filtros, tabla `data-table`, columna de acciones y paginación.
- Incluye búsqueda por folio/cliente/pago/estado y filtros por periodo (todos, 30 días, 90 días o mes actual), tipo de registro y estado.
- **Ver** abre el detalle disponible para cada registro. **Editar** abre un formulario para actualizar el estado de un pedido web; usuarios con permiso `orders:approve` pueden avanzar por los estados permitidos. Cancelar pide confirmación. El cambio se envía mediante `orderService.updateStatus()` y se refleja en la lista al completarse.
- El botón **Exportar CSV** descarga todos los registros que coinciden con los filtros actuales, aunque haya más de una página.
- La paginación funciona en el frontend con tamaños de 10, 25 o 50 filas por página.
- No se ofrece eliminar pedidos/ventas: los servicios existentes no tienen operación de borrado y estos registros forman parte del historial comercial.
- Las ventas presenciales se presentan con estado **Completado**, porque representan transacciones cerradas en el momento. No hay una operación de servicio existente para editar el estado de las ventas presenciales.
- Los comprobantes de ventas presenciales creadas desde el nuevo POS siguen siendo temporales en `sessionStorage` y aparecen identificados como temporales/no sincronizados.
- No se agregaron productos, pedidos ni ventas de ejemplo.

## Límites de persistencia del POS

- El catálogo y su inventario inicial se consultan desde PostgreSQL mediante el servicio existente. La disponibilidad mostrada descuenta ventas creadas solo en la sesión actual.
- El flujo POS solicita NIT, permite efectivo con cálculo de cambio y tarjeta simulada, pero **no registra** estas nuevas ventas en PostgreSQL ni procesa cobros. No reduce inventario compartido y los registros temporales desaparecen al cerrar la pestaña.
- Se quitó la advertencia de modo demostración del POS. El botón **Cancelar venta** solicita confirmación y luego limpia carrito, búsqueda, datos del cliente y datos del pago antes de registrar.
- La cancelación del borrador es local y no llama al backend; ventas ya registradas en el historial no se eliminan desde esta acción.
- La venta genera un comprobante interno imprimible; no es factura electrónica FEL ni comprobante fiscal autorizado.
- La actualización de estado de pedidos web sí utiliza el endpoint existente; no se agregó lógica ni endpoint de backend.
- Persistir las nuevas ventas del POS, NIT, pagos en efectivo e inventario compartido requerirá una ampliación posterior del backend. Emitir FEL requiere además integración fiscal autorizada.
- Para conectar la persistencia, el backend deberá aceptar los productos/cantidades, cliente/NIT y método de pago/cantidad recibida, devolver folio/estado/detalle y actualizar existencias de forma transaccional. El frontend ya consulta el catálogo real y conserva los servicios existentes del historial; no se alteraron contratos en este cambio.

## Archivos de frontend/documentación

- `src/modules/sales/components/SalesPage.tsx`: selector inicial de flujo, punto de venta, consulta combinada y cambios de estado de pedidos en línea.
- `src/app/globals.css`: estilos para selector, tablas del historial y punto de venta responsive.
- `docs/contexto-punto-de-venta.md`: alcance, comportamiento y límites para continuidad y descripción del PR.

## Criterios de aceptación

- Al entrar a Ventas aparecen las opciones de registrar una venta presencial y consultar el historial.
- El punto de venta conserva búsqueda, carrito, edición de cantidades, NIT, total, efectivo/cambio, tarjeta simulada y comprobante imprimible.
- El POS no muestra la advertencia removida; el botón de cancelación limpia el borrador solo después de confirmar.
- El historial obtiene los registros reales disponibles mediante los servicios existentes y distingue tipo, fecha, estado, pago y total sin datos estáticos de ejemplo.
- El detalle de cada registro enumera todos los artículos disponibles; cliente y NIT se muestran por separado, y las ventas presenciales aparecen como completadas.
- El usuario puede filtrar por tiempo, tipo, estado y texto; ver detalles y editar el estado de pedidos web con permiso, con confirmación de cancelación.
- La exportación CSV respeta filtros y contiene todo el resultado filtrado; la paginación recorre los registros por bloques configurables.
- El diseño sigue responsive y respeta permisos del rol.
- No se editan archivos del backend ni migraciones.

## Validación

- `npm run build`: compilación, TypeScript y generación de páginas completados correctamente.
- `git diff --check`: sin errores de whitespace.
- No se ejecutaron pruebas backend ni se modificó backend.
