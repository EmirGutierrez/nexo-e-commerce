# Inventario y control del catálogo público

## Rama y alcance

- Rama de trabajo: `feature/inventory-catalog`.
- Cambios realizados en frontend Next.js/React y esta documentación.
- No se modificaron Java, migraciones, esquema ni contratos del backend.
- Inventario y Catálogo usan los registros persistidos del recurso `products` a través de los servicios/BFF existentes. No se agregaron productos de ejemplo ni valores inventados como ubicación de bodega.

## Inventario

- El módulo incorpora la acción **Agregar nuevo producto**.
- El formulario incluye nombre, marca (cargada de marcas persistidas), categoría, código SKU, existencias, costo unitario, precio de venta, ubicación, estado actual e imagen.
- El stock debe ser un entero no negativo; los costos y el precio de venta deben ser mayores que cero. Si el producto se marca **En stock**, requiere al menos una unidad. Si se marca **Sin stock**, la cantidad debe ser cero. **Inactivo** permite conservar el producto sin publicarlo ni ofrecerlo.
- La imagen se selecciona desde el equipo, se valida como JPG/PNG/WEBP, se reduce y comprime en el navegador para ajustarse al tamaño aceptado por el servicio existente. Se muestra una vista previa antes de guardar.
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

- `adminTableService` traduce nombre, marca, categoría, SKU, stock, estado, precio, costo, ubicación e imagen al formato del recurso `products`.
- `cost` y `location` se conservan como atributos del registro de producto. La tienda pública usa el precio, las existencias, estado e imagen existentes.
- La carga de imagen reutiliza el campo `image` admitido por el servicio de productos; el frontend envía una imagen JPEG comprimida y presenta la URL que devuelve el servidor.
- Las marcas se consultan con `brandService.list()`. No se incluyen opciones de marcas de muestra.
- El endpoint público ya excluye los productos Inactivos. No se agregaron endpoints ni se cambió el backend.

## Archivos modificados

- `src/modules/app/components/NexoPages.tsx`: configuración sin filas/cifras de muestra para Inventario y Catálogo; columnas y acción de alta para Inventario.
- `src/modules/products/components/AdminCrudModule.tsx`: formulario de producto con imagen, estado de inventario, validación, publicación, métricas persistidas y paginación reutilizable.
- `src/services/index.ts`: mapeo de costo/ubicación/estado, persistencia del producto e imagen y ubicación real en alertas de stock.
- `src/types.ts`: campos opcionales de costo y ubicación en el tipo de producto.
- `src/app/globals.css`: estilos de vista previa de imagen y paginación responsive.
- `docs/contexto-inventario-catalogo.md`: alcance, comportamiento, contratos y validación.

## Criterios de aceptación

- Se puede registrar un producto desde Inventario con sus datos requeridos y una imagen opcional.
- El listado refleja los productos devueltos por el backend y se actualiza tras registrar o editar.
- El estado refleja la combinación de existencias y estado de actividad; no se usan productos ni ubicaciones estáticas.
- Catálogo permite buscar, filtrar y editar la publicación; muestra el conteo actual de productos visibles y ocultos.
- Las tablas mantienen el formato compartido, exportación CSV y paginación.
- No se modifican backend, base de datos ni contratos.

## Validación

- `npm run build`: completado correctamente con TypeScript y generación de páginas.
- `git diff --check`: sin errores.

## Descripción propuesta para el PR

Amplía Inventario para registrar productos con marca, SKU, existencias, costo, precio, ubicación, estado e imagen, usando el servicio persistente de productos existente. Replantea Catálogo como control de publicación de los productos Activos/Inactivos y muestra el total visible. Actualiza la tabla reutilizable con búsqueda, filtros, ordenamiento, exportación CSV y paginación interactiva, sin agregar datos de muestra ni modificar el backend.

## Pendiente para revisar en integración

- La paginación actual es del lado del cliente porque el servicio existente entrega la lista completa; puede migrarse a paginación del servidor cuando se defina ese contrato.
- Confirmar que el formato de costo y ubicación del registro JSONB coincida con las expectativas del equipo para futuras consultas/reportes de backend.
