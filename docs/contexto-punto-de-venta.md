# Replanteamiento del módulo de ventas como punto de venta

## Rama y alcance

- Rama: `feature/refactor-sales`.
- Se trabajó solo en frontend: pantalla React del módulo de ventas, estilos globales y esta documentación.
- No se modificaron API, backend Java, migraciones ni contratos de servicios.
- El único dato consultado al backend por esta pantalla es el catálogo de productos existente en PostgreSQL, obtenido con `productInventoryService.list()` a través del BFF.
- No se agregaron productos, precios ni existencias de ejemplo. Si el catálogo falla o está vacío, la interfaz muestra el estado correspondiente; no hay datos de respaldo estáticos.

## Experiencia implementada

- La ruta de ventas ahora presenta una pantalla de caja en vez del formulario largo dentro de un modal.
- El catálogo se filtra por SKU/código, nombre y categoría. La búsqueda limita los resultados visibles para que un catálogo extenso siga siendo fácil de explorar; el campo queda enfocado para usar un lector que escriba el código y envíe Enter.
- La cuenta muestra cantidades, disponibilidad y subtotales. Permite sumar/restar unidades y quitar productos. El importe total se recalcula al instante.
- El cobro pide NIT y permite efectivo o tarjeta simulada. Para efectivo exige un monto recibido que cubra el total y muestra el cambio antes de registrar.
- Al confirmar se genera un folio y un comprobante digital imprimible con cliente, NIT, vendedor, artículos, método de pago, total y cambio.
- Los registros creados desde este punto de venta viven en `sessionStorage` mientras la pestaña siga abierta. La disponibilidad del catálogo se ajusta durante esa sesión para evitar vender dos veces las mismas unidades en esta interfaz.
- El historial muestra únicamente las ventas temporales creadas en la pestaña actual; no se consultan ventas anteriores del backend.
- La pantalla tiene estados vacíos/error, controles accesibles y distribución responsive para escritorio y móvil.

## Límites por el alcance solo frontend

- El backend actual acepta únicamente tarjeta simulada o transferencia al registrar una venta. No admite efectivo ni recibe el NIT del cliente en la venta presencial. Para respetar el alcance solicitado, esta pantalla no intenta mandar al API datos que este rechazaría o descartaría.
- Las ventas nuevas no se guardan en PostgreSQL, no reducen inventario compartido y desaparecen al cerrar la pestaña.
- La disponibilidad se calcula desde el stock recibido del catálogo y descuenta solo las cantidades vendidas en la sesión actual; otros usuarios o dispositivos no ven esos cambios temporales.
- El comprobante generado es un recibo interno de demostración. No es una factura electrónica FEL ni un comprobante fiscal autorizado.
- La tarjeta solo se etiqueta como simulada; no se solicitan números, CVV ni otros datos financieros.

Para persistir ventas, NIT, cobro en efectivo, inventario y emitir facturas FEL hace falta trabajo posterior en backend e integración fiscal autorizada.

## Archivos modificados

- `src/modules/sales/components/SalesPage.tsx`: búsqueda/captura de SKU, cuenta, cálculo de efectivo, sesión local, historial y comprobante.
- `src/app/globals.css`: estilos del punto de venta, responsive, estados y recibo imprimible.
- `docs/contexto-punto-de-venta.md`: registro de alcance, decisiones y límites.

## Validación

- `npm run build`: completado correctamente con compilación, TypeScript y generación de páginas.
- No se hicieron cambios ni pruebas del backend.
