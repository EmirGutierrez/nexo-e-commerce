# Inventario y control del catálogo público

## Rama y alcance

- Rama de trabajo: `feature/inventory-access-form-polish`.
- Cambios realizados en frontend Next.js/React, servicios y backend Java.
- No se modificaron migraciones ni el esquema de la base de datos.
- Inventario y Catálogo usan los registros persistidos del recurso `products`. No se agregaron productos de ejemplo ni ubicaciones de bodega inventadas.

## Inventario

- El módulo incorpora la acción **Agregar nuevo producto**.
- El formulario incluye nombre, marca (cargada de marcas persistidas), categoría, código SKU, existencias, costo unitario, precio de venta, ubicación, estado actual, descripción e imagen opcional.
- El stock debe ser un entero no negativo; los costos y el precio de venta deben ser mayores que cero. Si el producto se marca **En stock**, requiere al menos una unidad. Si se marca **Sin stock**, la cantidad debe ser cero. **Inactivo** permite conservar el producto sin publicarlo ni ofrecerlo.
- La imagen se selecciona desde el equipo, se valida como JPG/PNG/WEBP, se reduce y comprime en el navegador para ajustarse al tamaño aceptado por el backend. Se muestra una vista previa antes de guardar.
- El estado En stock/Sin stock se representa según las existencias persistidas; Inactivo conserva su estado propio.
- El resumen de productos, unidades, productos sin stock e inactivos se calcula desde la respuesta del servicio, no desde cifras de muestra.

## Catálogo público

- La sección administrativa se presenta como **Catálogo** y consulta los mismos productos persistidos que Inventario.
- La publicación se controla editando el estado del producto: Activo se ofrece en la tienda pública; Inactivo se oculta. Los productos agotados siguen visibles con sus existencias, de acuerdo con el comportamiento actual de la tienda.
- El resumen indica cuántos productos registrados están visibles, ocultos y coinciden con la búsqueda/filtros. El total publicado cambia al guardar el estado.
- El alta de productos se centraliza en Inventario; Catálogo queda dedicado a consulta y publicación.

## Tabla compartida

- La tabla reutilizada conserva búsqueda, filtro por estado, ordenamiento, exportación CSV, acciones CRUD permitidas, estilos y estados con colores.
- Se añadió paginación interactiva de 10, 25 o 50 filas por página y controles responsive.
- La tabla se alimenta de `adminTableService.list()`; altas y ediciones usan los servicios existentes y actualizan la fila con la respuesta del servidor. Si la carga falla, se presenta el error sin datos alternativos.

## Datos y conexión

- `adminTableService` traduce nombre, marca, categoría, SKU, stock, estado, precio, costo, ubicación, descripción e imagen al formato del recurso `products`.
- `cost` y `location` se conservan como atributos del registro de producto. La tienda pública usa el precio, las existencias, estado e imagen existentes.
- La carga opcional de imagen reutiliza el campo `image` admitido por el servicio de productos; el frontend envía una imagen comprimida y presenta la URL que devuelve el servidor.
- Las marcas se consultan con `brandService.list()`. No se incluyen opciones de marcas de muestra.
- `GET` y `POST /api/business/inventory/products` consultan y crean productos con permisos de inventario; `PUT /api/business/inventory/products/{id}` los actualiza con `inventory:edit`. `PATCH` conserva el flujo de ajuste de existencias con motivo.
- El endpoint público ya excluye los productos Inactivos.

## Archivos modificados

- `src/modules/app/components/NexoPages.tsx`: configuración del formulario de Inventario con costo, precio de venta, ubicación y descripción.
- `src/modules/products/components/AdminCrudModule.tsx`: uso de columnas configuradas, campos opcionales y consultas de Inventario con su servicio autorizado.
- `src/services/index.ts`: rutas y mapeo de consulta/edición para Inventario.
- `backend/src/main/java/gt/nexo/commerce/business/api/BusinessRecordController.java` y `backend/src/main/java/gt/nexo/commerce/business/application/BusinessRecordService.java`: rutas de lectura/edición con permisos `inventory:view` y `inventory:edit`.
- `backend/src/test/java/gt/nexo/commerce/business/application/BusinessRecordServiceInventoryPermissionTest.java` y `src/__tests__/inventoryServices.test.ts`: validación de permisos y rutas frontend.
- `README.md`, `backend/README.md`, `deploy/README.md` y `AGENTS.md`: documentación alineada con los comandos y gates reales de CI/CD.

## Criterios de aceptación

- Se puede registrar un producto desde Inventario con sus datos requeridos y una imagen opcional.
- El listado refleja los productos devueltos por el backend y se actualiza tras registrar o editar.
- El estado refleja la combinación de existencias y estado de actividad; no se usan productos ni ubicaciones estáticas.
- Catálogo permite buscar, filtrar y editar la publicación; muestra el conteo actual de productos visibles y ocultos.
- Las tablas mantienen el formato compartido, exportación CSV y paginación.
- Las operaciones de Inventario requieren permisos `inventory:view`, `inventory:create` o `inventory:edit` en el backend.

## Validación

- `npm run test:coverage`: 6 pruebas frontend aprobadas.
- `npm run build`: completado correctamente con TypeScript y generación de páginas.
- `npm audit --audit-level=high`: cero vulnerabilidades.
- `mvn -B verify`: 9 pruebas backend aprobadas.
- `docker compose ... config --quiet` y validación de Caddy: aprobadas.
- `git diff --check`: sin errores.

## Descripción propuesta para el PR

Amplía Inventario para consultar, registrar y editar productos con permisos propios, usando el recurso persistente existente. Replantea Catálogo como control de publicación de los productos Activos/Inactivos y muestra el total visible. Actualiza la tabla reutilizable con búsqueda, filtros, ordenamiento, exportación CSV y paginación interactiva, sin agregar datos de muestra ni cambiar el esquema de la base de datos.

## Pendiente para revisar en integración

- La paginación actual es del lado del cliente porque el servicio existente entrega la lista completa; puede migrarse a paginación del servidor cuando se defina ese contrato.
