# Prompts para Codex Visual — Fases 11 a 22

Repositorio: `EmirGutierrez/nexo-e-commerce`

Cada bloque es un prompt independiente. Ejecuta un solo bloque por tarea en Codex Visual, desde la raíz del repositorio. Las fases 11–22 corresponden a los tickets #12–#23; el ticket #14 (`CRUDs`) queda incluido como Fase 13, ya que la secuencia publicada salta de la Fase 12 a la 14.

## Fase 11 — Apartado de Contabilidad (#12)

```text
Implementa el ticket GitHub #12 — “Fase 11: Apartado de Contabilidad” en este repositorio.

Antes de editar, revisa la estructura actual, las rutas del administrador, `moduleConfig` en `src/modules/app/components/NexoPages.tsx`, los servicios mock en `src/services/index.ts`, los tipos y datos de `src/types.ts` y `src/data/mockData.ts`, y los estilos existentes en `src/app/globals.css`. Conserva Next.js App Router y el lenguaje visual NEXO.

El ticket no trae descripción. Construye un módulo de Contabilidad coherente con el dashboard actual: resumen de ingresos, egresos y balance para un periodo seleccionable; tabla de movimientos con fecha, concepto, categoría, tipo, monto y estado; filtros básicos; y acción para registrar un movimiento mediante formulario con validación. Usa quetzales y datos mock locales; no integres pagos reales ni backend.

Conecta la vista a una ruta administrativa consistente con las rutas existentes y agrega la opción de navegación correspondiente si hace falta. Mantén el estado y las firmas de servicio preparados para sustituir los mocks por API. Incluye estados vacíos, errores de formulario y confirmación al guardar. No rompas módulos existentes ni conviertas información financiera de demostración en datos reales.

Al terminar, resume archivos y decisiones, y ejecuta `npm run build` para verificar TypeScript y producción. No agregues dependencias salvo que sean imprescindibles.
```

## Fase 12 — Modificación del apartado de Pedidos (#13)

```text
Implementa el ticket GitHub #13 — “Fase 12: Modificación del apartado de Pedidos”. El administrador necesita que los pedidos del sitio registren también las compras de mercancía que realiza el negocio.

Inspecciona primero el modelo `Order`, `orders` en `src/data/mockData.ts`, `orderService` en `src/services/index.ts`, las rutas y vistas administrativas de pedidos en `src/modules/app/components/NexoPages.tsx`, y los estilos existentes. Conserva el diseño NEXO, el stack actual y la compatibilidad con pedidos de clientes.

Amplía la vista administrativa para distinguir claramente pedidos de clientes y compras de abastecimiento/mercancía. Permite registrar una compra de mercancía con proveedor, fecha, productos, cantidades, costo unitario y total; muestra el historial y el estado. Valida cantidades y montos positivos, calcula subtotales y total en quetzales, y no mezcles una compra de abastecimiento con una venta al cliente. Utiliza datos mock locales y servicios asíncronos existentes o amplíalos con firmas preparadas para una API REST.

Conserva búsqueda/filtros y acciones actuales de pedidos. Incluye estados vacíos, validación visible y confirmación después de guardar. No integres pagos reales ni backend.

Al terminar, resume los cambios y ejecuta `npm run build`. No agregues dependencias salvo necesidad justificada.
```

## Fase 13 — CRUDs en las tablas (#14)

```text
Implementa el ticket GitHub #14 — “CRUDs”: integrar acciones CRUD en todas las tablas del panel administrativo y representarlas con iconos.

Primero inventaría en `src/modules/app/components/NexoPages.tsx` todos los módulos/tablas administrativos y sus columnas/filas; revisa `src/data/mockData.ts`, `src/types.ts`, `src/services/index.ts` y los iconos/estilos existentes. No cambies el flujo público de tienda salvo que una tabla compartida lo requiera.

Haz que las tablas administrativas pertinentes tengan acciones claras de crear, ver/detallar, editar y eliminar cuando la operación tenga sentido. Usa iconos de `lucide-react` con botones accesibles, etiquetas `aria-label` o texto accesible, tooltips si el patrón existente lo permite, y confirmación antes de eliminar. Implementa formularios con validación y mensajes de éxito/error. Persiste los cambios en estado local/mock durante la sesión y define métodos de servicio asíncronos consistentes para que luego puedan apuntar a API; no afirmes persistencia de servidor.

Evita CRUD destructivo en registros transaccionales: para pedidos, ventas, pagos, facturas e historial usa acciones apropiadas al dominio (ver, cambiar estado o anular con confirmación) en lugar de borrar silenciosamente. Respeta roles si ya hay control de permisos; no inventes backend. Mantén consistencia visual, responsive y compatibilidad con las columnas y datos actuales. No dejes botones decorativos sin comportamiento.

Al terminar, enumera las tablas cubiertas y las acciones disponibles en cada una, señala cualquier excepción justificada y ejecuta `npm run build`. No agregues dependencias salvo que sean imprescindibles.
```

## Fase 14 — Mejora visual de la página pública (#15)

```text
Implementa el ticket GitHub #15 — “Fase 14: Mejora en la página pública (diseño)”. El objetivo es hacer la experiencia pública más atractiva mediante animaciones, imágenes y elementos visuales, sin perjudicar claridad ni rendimiento.

Revisa `Landing`, `Store`, fichas y checkout en `src/modules/app/components/NexoPages.tsx`, además de `src/app/globals.css` y los assets locales disponibles. Conserva la identidad de NEXO (crema, azul marino, azul claro y lima) y el stack existente. Mejora las páginas públicas con jerarquía visual, imágenes pertinentes, microinteracciones y animaciones sutiles donde aporten. Prefiere assets ya disponibles; si usas imágenes externas, asegúrate de que fallen de forma elegante y tengan textos alternativos útiles.

Respeta `prefers-reduced-motion`, navegación por teclado, contraste, responsive móvil y tiempos de carga. No alteres la lógica de catálogo, carrito, checkout o autenticación más de lo necesario. Mantén la estética uniforme entre landing, catálogo y detalle de producto y evita animaciones que bloqueen la interacción.

Al terminar, resume las vistas y estilos mejorados y ejecuta `npm run build`. No agregues dependencias salvo que sean imprescindibles.
```

## Fase 15 — Imágenes en Inventario y Catálogo (#16)

```text
Implementa el ticket GitHub #16 — “Fase 15: Imágenes en Inventario y Catálogo”: al seleccionar un producto en las tablas administrativas de Inventario y Catálogo/Productos, mostrar una vista previa de su imagen.

Revisa el tipo `Product`, los datos en `src/data/mockData.ts`, las vistas administrativas y `moduleConfig` en `src/modules/app/components/NexoPages.tsx`, además de los estilos de tabla y modal en `src/app/globals.css`. Usa `product.image` y evita duplicar fuentes de datos.

Agrega una vista previa contextual al seleccionar o abrir un producto desde Inventario y Productos/Catálogo: imagen con proporción adecuada, nombre, SKU, categoría, precio y stock. Si la tabla necesita una miniatura, mantenla discreta y accesible; la previsualización amplia debe funcionar bien en pantallas pequeñas y cerrarse con botón, Escape y clic fuera sin cerrar al interactuar dentro. Incluye fallback visual cuando la URL de imagen esté vacía o falle, y texto alternativo descriptivo.

Conserva filtros, navegación y acciones ya disponibles. No alteres el origen remoto DummyJSON ni hagas que una falla de imagen afecte la tabla.

Al terminar, indica cómo se abre/cierra la vista previa y ejecuta `npm run build`. No agregues dependencias salvo que sean imprescindibles.
```

## Fase 16 — Redireccionamiento de Login (#17)

```text
Implementa el ticket GitHub #17 — “Fase 16: Re direccionamiento de Login”. Elimina la elección repetida de registro/inicio de sesión según tipo de usuario y valida el tipo de usuario para llevarlo al espacio correcto.

Inspecciona `Access`, `CustomerLogin`, `AdminLogin`, `AppContext` (`login`, `user`, `role`) y las rutas/protecciones en `src/modules/app/components/NexoPages.tsx`. Conserva la separación entre cliente y administración y las credenciales de demostración actuales; no incorpores autenticación de servidor.

Simplifica la entrada pública para que el usuario acceda a un formulario de inicio de sesión sin tener que escoger de nuevo entre registro e inicio de sesión. Después de autenticar, redirige clientes a `/store` y personal administrativo a su destino válido dentro de `/admin` según su rol. Rechaza o muestra error cuando el rol no tenga acceso; no confíes solo en el destino enviado por el navegador. Preserva rutas protegidas y retorno razonable a la página solicitada si aplica. Elimina enlaces de registro que no tienen flujo implementado, o sustitúyelos por una explicación clara sin prometer una función inexistente.

Incluye casos de redirección para sesión existente y acceso directo a rutas protegidas; evita bucles entre login y dashboard. Mantén el carácter de demo documentado.

Al terminar, describe el flujo por rol y ejecuta `npm run build`. No agregues dependencias salvo necesidad justificada.
```

## Fase 17 — Activar métodos de pago (#18)

```text
Implementa el ticket GitHub #18 — “Fase 17: Activar diferentes métodos de pago”. En el dashboard administrativo se debe poder decidir cuáles métodos configurados aparecen en el sitio público.

Revisa checkout, `paymentService`, `payment` en `src/services/index.ts`, configuración y datos mock, así como los componentes de `src/modules/app/components/NexoPages.tsx` y estilos actuales. El sistema solo simula pagos: no conectes procesadores, no guardes números de tarjeta y no solicites CVV.

Agrega una sección administrativa accesible desde Configuración para activar/desactivar cada método disponible actualmente (tarjeta simulada y transferencia bancaria pendiente de verificación). Refleja inmediatamente la configuración en las opciones de checkout; si un método está desactivado, no debe poder seleccionarse mediante estado obsoleto ni ruta alternativa. Mantén un método activo como mínimo o explica/valida cuando se intenta desactivar el último. Persiste la preferencia en almacenamiento local de navegador o estado existente e encapsula acceso para facilitar futura API. El valor inicial debe respetar el comportamiento actual.

Incluye etiquetas comprensibles, estado activo/inactivo, confirmación/feedback y diseño responsive. No presentes la simulación como cobro real.

Al terminar, explica dónde se configura y cómo se refleja en checkout; ejecuta `npm run build`. No agregues dependencias salvo necesidad justificada.
```

## Fase 18 — Módulo de Ventas (#19)

```text
Implementa el ticket GitHub #19 — “Fase 18: Módulo de Ventas”. El personal debe registrar compras realizadas físicamente en el negocio, crear el listado de productos vendidos, calcular total y generar un comprobante.

Revisa `Product`, `Order`, `orders` y `products`, `salesService`, rutas administrativas y patrones de formularios/modales en `src/modules/app/components/NexoPages.tsx`, `src/services/index.ts`, `src/data/mockData.ts` y `src/app/globals.css`. Distingue una venta presencial de un pedido web y de una compra de mercancía a proveedor.

Implementa el flujo para crear venta presencial: añadir/quitar productos del catálogo, editar cantidades, validar stock disponible, calcular subtotales y total en quetzales, registrar vendedor/fecha y elegir método de pago dentro de los métodos habilitados. Al confirmar, genera un identificador de venta y una vista de comprobante imprimible (sin afirmar que es factura fiscal); actualiza el listado/historial de ventas y el stock en el estado mock de la sesión. Evita confirmar si el carrito está vacío o excede inventario. Incluye detalle de una venta existente y estados vacíos.

Mantén datos locales/mock y firmas de servicio preparadas para API; sin integración de cobros reales. Usa los patrones visuales existentes, accesibilidad y diseño móvil.

Al terminar, resume el flujo de registro y comprobante y ejecuta `npm run build`. No agregues dependencias salvo que sean imprescindibles.
```

## Fase 19 — Módulo de Marcas (#20)

```text
Implementa el ticket GitHub #20 — “Fase 19: Módulo Marcas”. Se necesita registrar y visualizar las marcas del inventario, incluido nombre, productos que se compran y otros datos útiles.

Revisa `moduleConfig`, navegación administrativa, tipos, datos mock, servicios y estilos actuales. El módulo debe integrarse con Productos/Inventario de modo que la marca elegida pueda asociarse con productos; no dupliques productos ni rompas registros actuales que aún no tengan marca.

Crea listado de marcas con nombre, descripción opcional, contacto/web opcionales, cantidad de productos asociados y estado. Implementa crear, ver y editar, además de eliminación protegida: bloquea o advierte claramente si existen productos vinculados y ofrece reasignación cuando sea viable. Incluye búsqueda/filtro, formulario validado, estado vacío y confirmación/feedback. Conserva datos mock locales con interfaz de servicio asíncrona para futura API.

Usa una ruta y navegación consistentes con el panel actual; diseño responsive, labels accesibles y moneda en quetzales cuando haya importes. No agregues dependencias ni backend.

Al terminar, resume el modelo y cómo se asocia una marca a productos y ejecuta `npm run build`.
```

## Fase 20 — Módulo de Proveedores (#21)

```text
Implementa el ticket GitHub #21 — “Fase 20: Módulo de Proveedores”. Debe permitir administrar a quienes abastecen mercancía al negocio, con nombre, contacto y productos abastecidos.

Revisa el módulo `suppliers` existente en `moduleConfig`, `supplierService`, las rutas/navegación, tipos, mock data y estilos. Completa la vista demostrativa actual con un modelo consistente y una interfaz usable; no mantengas botones sin acción.

Implementa listado con nombre/empresa, persona de contacto, teléfono, correo, productos abastecidos, último pedido y estado. Añade búsqueda y filtros por estado; crear, ver y editar proveedores; archivar o eliminar con confirmación y protección cuando haya relaciones de abastecimiento. Permite asociar productos existentes sin duplicarlos y prepara el flujo de compra de mercancía para seleccionar un proveedor. Usa datos locales mock y servicio asíncrono; no conectes backend.

Valida campos, muestra estados vacíos y feedback, usa moneda quetzal cuando corresponda y asegura accesibilidad/responsividad coherentes con NEXO.

Al terminar, explica cómo se vinculan proveedor y productos y ejecuta `npm run build`. No agregues dependencias salvo necesidad justificada.
```

## Fase 21 — Modales de advertencia (#22)

```text
Implementa el ticket GitHub #22 — “Fase 21: Modales de Advertencia”. En el dashboard administrativo deben aparecer avisos ante eventos como stock bajo, compra registrada o cambio de estado de venta.

Inspecciona el dashboard, inventario, pedidos/ventas, `activities`, `Modal` y componentes de alertas existentes en `src/modules/app/components/NexoPages.tsx`, servicios, contexto y estilos. Diseña un mecanismo común y reutilizable, evitando que cada pantalla implemente modales incompatibles.

Muestra un modal accesible para eventos importantes: bajo stock al entrar/actualizar datos, compra de mercancía registrada y cambio relevante de estado de una venta/pedido. El modal debe comunicar qué ocurrió, entidad afectada y siguiente acción; permite cerrar con botón y Escape, conserva foco y no se cierra por clic dentro. Evita repetir la misma alerta en cada render o mostrar un modal por cada producto: agrupa avisos de stock bajo o presenta un resumen con enlace a Inventario. Diferencia advertencia, éxito e información. Si la operación necesita confirmación destructiva, mantenla separada del aviso informativo.

Usa el sistema de eventos/estado existente o añade uno pequeño en contexto, con comportamiento determinista en datos mock. No uses notificaciones externas ni dependencias.

Al terminar, enumera los eventos cubiertos y cómo se evita la repetición excesiva; ejecuta `npm run build`.
```

## Fase 22 — Especificación de permisos (#23)

```text
Implementa el ticket GitHub #23 — “Fase 22: Especificación de permisos”. La configuración de permisos asignada a un usuario debe ser fácil de entender y usar, con checkboxes por cada función que se desea permitir.

Revisa `Role`, `User`, `roleLabels`, `roleService`, la vista actual de Roles y permisos, `AppContext` y navegación/rutas en `src/modules/app/components/NexoPages.tsx`. Conserva el carácter de demostración frontend y no afirmes seguridad real de servidor.

Rediseña el editor de permisos como matriz legible: filas por módulo/función (dashboard, productos, inventario, pedidos, ventas, clientes, proveedores, reportes, configuración y usuarios/roles) y columnas/selección por acción cuando corresponda (ver, crear, editar, eliminar o aprobar). Usa checkboxes con etiquetas accesibles, encabezados y agrupaciones; permite seleccionar/desmarcar un módulo, muestra resumen de cambios sin guardar y ofrece guardar/cancelar. Asegura que el rol Súper Administrador tenga acceso completo y que no pueda quitarse accidentalmente a sí mismo el último acceso administrativo. Asocia permisos a roles y permite consultar/asignar el rol a usuarios mediante el flujo existente.

Guarda el estado mock/local de forma coherente, actualiza la UI según el rol actual donde sea viable y deja explícito que la autorización real debe repetirse en Spring Security/API. Añade validación, feedback y diseño responsive; no uses un único checkbox ambiguo para toda la tabla.

Al terminar, explica el modelo de permisos y sus límites de demo y ejecuta `npm run build`. No agregues dependencias salvo que sean imprescindibles.
```

