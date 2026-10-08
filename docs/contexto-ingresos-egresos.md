# Módulo de ingresos y egresos

## Rama y alcance

- Rama: `feature/finance-moves`.
- Cambio implementado únicamente en frontend y documentación.
- No se modificaron backend Java, base de datos, migraciones ni contratos de API.
- El nombre visible cambió de **Contabilidad** a **Ingresos y egresos** en la navegación, breadcrumb, encabezado de pantalla y etiqueta de permisos. Se conserva la ruta `/admin/accounting` y el identificador de permisos `accounting` para no romper navegación ni contratos existentes.

## Funcionalidad

- Permite registrar un movimiento de tipo ingreso o egreso con fecha, concepto, categoría, monto en quetzales y estado.
- Valida que los campos requeridos estén completos y que el monto sea mayor que cero.
- Presenta totales por periodo para ingresos y egresos registrados, además del balance neto (ingresos menos egresos). Los movimientos pendientes o anulados no se suman a esos totales.
- Permite consultar el historial, buscar por concepto/categoría, filtrar por periodo, tipo y estado, exportar el resultado filtrado a CSV, ver el detalle y editar el estado de un movimiento.
- La edición permite cambiar entre Registrado, Pendiente y Anulado. Anular requiere confirmación y conserva el registro en el historial; el estado Anulado se excluye de los totales.
- Anular conserva el movimiento en el historial, pero lo excluye de los totales.
- Mantiene el formato visual compartido de los módulos administrativos: tarjetas de resumen, barra de filtros, tabla reutilizada, estados y formulario modal responsive.

## Datos y servicios

- La lista y el alta usan `accountingService.list()` y `accountingService.create()` existentes.
- La edición de estado usa `accountingService.updateStatus()` existente; después de crear o actualizar, se vuelve a consultar el listado para reflejar la respuesta persistida.
- No se agregaron registros de ejemplo ni se alteró el backend.
- Los identificadores internos de ruta, servicio y permisos conservan `accounting`; el cambio de nombre es de interfaz.

## Archivos modificados

- `src/modules/accounting/components/AccountingPage.tsx`: nombre visible, filtro por estado, balance basado solo en movimientos registrados y edición del estado con icono y confirmación de anulación.
- `src/modules/app/components/NexoPages.tsx`: etiqueta del menú y breadcrumb.
- `src/services/roleService.ts`: etiqueta visible del permiso.
- `src/app/globals.css`: distribución explícita de las siete columnas y acciones/fechas en una sola línea, manteniendo desplazamiento horizontal en pantallas estrechas.
- `docs/contexto-ingresos-egresos.md`: contexto y descripción propuesta para el PR.

## Criterios de aceptación

- El módulo se identifica como **Ingresos y egresos**, no como Contabilidad.
- El usuario autorizado puede guardar ingresos y egresos mediante el formulario y el servicio existente.
- El historial se carga de los registros persistidos y permite buscar, filtrar por periodo/tipo/estado, exportar CSV, consultar detalle y editar el estado mediante el icono de edición.
- Las columnas de fecha y acciones permanecen alineadas en una fila; en pantallas estrechas la tabla conserva su ancho y usa desplazamiento horizontal.
- El resumen incluye solo movimientos con estado Registrado; Pendiente y Anulado no alteran el balance presentado.
- Los estilos siguen los patrones de los otros módulos y la pantalla se adapta a móvil.
- No se modifican backend ni migraciones.

## Validación

- `npm run build`: completado correctamente, incluyendo TypeScript y generación de páginas.
- `git diff --check`: sin errores.

## Descripción propuesta para el PR

Renombra el módulo visible de Contabilidad a Ingresos y egresos y enfoca su presentación en los movimientos de caja del negocio. Conserva el registro de ingresos y egresos con validación, resume los movimientos registrados por periodo, añade filtro por estado y mantiene consulta, anulación confirmada y exportación CSV. Usa los servicios persistentes existentes sin cambios en backend ni contratos.
