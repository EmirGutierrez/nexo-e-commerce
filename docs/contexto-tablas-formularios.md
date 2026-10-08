# Alineación de tablas y controles de formularios

## Rama y alcance

- Rama: `feature/inventory-catalog`.
- Cambios únicamente en el frontend Next.js: geometría de tablas y apariencia de controles en formularios modales.
- No se cambiaron servicios, API, backend Java, base de datos ni contratos.

## Tablas

- Las filas y encabezados de la tabla CRUD reutilizable comparten una plantilla de columnas con anchos definidos por el tipo de dato. Esto evita que el contenido diferente de cada fila desplace los campos respecto de los encabezados.
- Las tablas especializadas de contabilidad, compras, ventas, pedidos, marcas, proveedores e historiales relacionados ahora usan anchos de columna consistentes en todas sus filas.
- Se corrigió la definición de la tabla de compras para contemplar sus siete columnas, incluida Acciones.
- Los encabezados y filas ahora ocupan el ancho completo del contenedor. Las tablas CRUD de Marcas, Proveedores, Ingresos y egresos, Compras y Usuarios ya no quedan cortas con un espacio vacío a la derecha.
- En Marcas, las columnas de nombre, descripción y contacto/web se expanden según el espacio disponible; Estado y Acciones mantienen espacio suficiente y alineado entre filas.
- Las tablas mantienen desplazamiento horizontal cuando el ancho de pantalla no permite mostrar todas las columnas.
- Se preservan las acciones, los estados visuales y el contenido existente; solo se normaliza su alineación y distribución.

## Formularios modales

- Los campos desplegables, de cantidad y de texto usan el mismo borde, radio, altura, relleno y tipografía Manrope.
- Los select conservan una flecha discreta y los campos numéricos ocultan los controles de incremento del navegador para mantener la misma presentación.
- Los estados de foco conservan un indicador visible y uniforme. Casillas, radios y carga de archivos mantienen su comportamiento propio.

## Archivos

- `src/app/globals.css`: anchos compartidos de columnas y estilos uniformes de campos modales.
- `src/modules/products/components/AdminCrudModule.tsx`: plantilla idéntica de columnas para encabezado y filas de la tabla CRUD reutilizable.
- `docs/contexto-tablas-formularios.md`: registro del alcance y decisiones visuales.

## Validación

- `npm run build`: completado correctamente, incluidos TypeScript y la generación de rutas.
- `git diff --check`: completado sin errores. Git mostró avisos informativos de conversión LF/CRLF en archivos con cambios preexistentes.

## Descripción propuesta para el PR

Normaliza la alineación de encabezados y filas en las tablas administrativas fijando los anchos de columna compartidos, haciendo que las tablas llenen su sección y corrigiendo la cantidad de columnas de Compras. Unifica los controles select y numéricos de formularios modales con el formato de los campos de texto. Cambios solo de frontend, sin cambios al backend ni a los datos persistidos.
