# NEXO Commerce — contexto local de continuidad

Este archivo es una nota de trabajo privada del repositorio. Está excluido de Git en `.gitignore`; no incluir datos personales, secretos o credenciales.

## Estado revisado

- Rama de trabajo autorizada: `feature/customer-orders`.
- Monorepo: Next.js App Router/React/TypeScript en la raíz y Spring Boot/Java 21/PostgreSQL en `backend/`.
- Spring es autoridad para sesiones, permisos y datos de negocio. El navegador llama al BFF Next `/api/...`; el BFF reenvía a Spring.
- El catálogo público lee productos activos de PostgreSQL. Las promociones, pedidos y comprobantes de transferencia ya se persisten.
- El checkout recalcula precio/descuento y reserva inventario en Spring. Tarjeta es simulada; transferencia requiere comprobante y aprobación privada.
- El área privada ya ofrece módulos de clientes, pedidos, pagos y transferencias. Los módulos consumen `business_records` y proyecciones relacionales.
- Antes de este trabajo el encabezado público mostraba el nombre de cliente sin menú; el perfil solo permitía cambiar el nombre; no existían portal, wishlist persistente ni relación de pedido con cuenta autenticada.
- Preferencias existentes en navegador: carrito y productos vistos recientemente. Los pedidos y pagos no son locales.

## Decisiones para el portal del cliente

- Perfil, compras y wishlist viven bajo `/account`; el menú del nombre lleva a esas secciones.
- Edición de nombre utiliza `PATCH /api/auth/me/profile`, que modifica la cuenta autenticada; también sincroniza el registro del cliente privado.
- Wishlist vive en PostgreSQL, vinculada a `app_user` y `products`, con operaciones propias del usuario de sesión. El módulo privado de Clientes muestra cantidad de favoritos.
- Los pedidos de un cliente autenticado se asocian a su `app_user.id` desde el principal de Spring, nunca a un identificador enviado por navegador. Las compras anteriores se vinculan por correo durante Flyway V13.
- `GET /api/catalog/my/orders` limita la respuesta al usuario actual. Refleja estado de pedido y pago, incluidos cambios hechos desde pedidos/transferencias privados.
- Un comprador invitado conserva el flujo público existente; los pedidos solo se muestran en cuenta cuando se hicieron con sesión de cliente.
- Mantener español, Q mediante `formatQ`, enlaces internos Next y estilos globales del proyecto. No integrar cobros reales ni guardar datos financieros.

## Archivos/capas relevantes

- Portal público: `src/app/(public)/account/page.tsx`, `src/modules/commerce/components/CustomerAccountPage.tsx`, `src/modules/app/components/PublicAccountControls.tsx`, `src/app/globals.css`.
- Datos cliente: `src/services/index.ts`; catálogo y checkout existentes en `src/modules/commerce/components/CommercePages.tsx`.
- API y persistencia: `backend/src/main/java/gt/nexo/commerce/business/api/PublicCheckoutController.java`, `BusinessRecordService.java`, `identity/application/UserAccountService.java`, migración `V13__customer_portal_wishlist_and_owned_orders.sql`.
- BFF bajo `src/app/api/[...path]/route.ts`; conserva forwarding y CSRF existentes.
- Verificación de esta entrega: `npm run build` y `mvn compile` terminaron correctamente; `git diff --check` pasó. No se corrieron pruebas automatizadas ni se probó contra una base de datos viva.
- Revisión local pendiente antes de despliegue: aplicar Flyway V13 en una base de pruebas y validar sesión de cliente, acceso denegado, wishlist add/remove, vinculación de compras existentes/nuevas y actualización de pago desde panel.

## Convenciones e instrucciones

- No cambiar de rama. Preservar modificaciones ajenas existentes; revisar `git status` antes de integrar.
- Leer guías Next locales en `node_modules/next/dist/docs/01-app/` antes de cambiar patrones App Router.
- Ejecutar `npm run build` para cambios de frontend; no hay script de tests frontend. Revisar también build backend si el entorno lo permite.
- No actualizar dependencias ni editar infraestructura sin necesidad. Respetar el flujo de `CONTRIBUTING.md`; no crear commits, hacer push ni merge salvo solicitud explícita.
