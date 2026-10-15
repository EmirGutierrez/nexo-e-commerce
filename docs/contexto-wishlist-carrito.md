# Agregar productos de wishlist al carrito

## Rama y alcance

- Rama de trabajo: `feature/wish-to-cart`.
- Cambio limitado al frontend Next.js/React y a esta documentación.
- No se modificaron backend Java, migraciones, base de datos, endpoints ni contratos.

## Análisis del flujo existente

- La página de cuenta del cliente está en `src/modules/commerce/components/CustomerAccountPage.tsx` y muestra la wishlist devuelta por `customerPortalService.wishlist()`.
- El mismo servicio ya ofrece la operación para quitar artículos de wishlist; no fue necesario agregar ni cambiar llamadas al BFF.
- El carrito global vive en `AppContext`, está disponible mediante `useApp()` y se persiste en el navegador bajo `nexo.cart.v1`.
- `addToCart` combina productos repetidos y limita la cantidad al stock publicado por el catálogo. El checkout vuelve a validar precio e inventario con el backend al confirmar el pedido.

## Cambio realizado

- Cada artículo de la wishlist muestra **Agregar al carrito**.
- La acción agrega una unidad mediante el estado compartido del carrito; la cantidad se acumula si ya existe el mismo producto.
- La wishlist no se modifica al agregar el producto: el cliente puede conservarlo entre sus favoritos y también quitarlo con el control existente.
- Los productos inactivos, agotados o cuya existencia ya está completamente en el carrito muestran la acción deshabilitada.
- El control espera a que el carrito local termine de cargar para evitar que la carga inicial desde `localStorage` sobrescriba una adición.
- Al completar la acción se muestra una confirmación en la página de cuenta.
- El precio se presenta en su propia línea, con separación visual antes del botón para evitar que ambos queden pegados o se lean como un solo control.
- El botón cambia a **Agregar otro** cuando ya hay unidades de ese artículo en el carrito; el stock completo en carrito conserva su estado deshabilitado.
- Se añadió un acceso flotante al carrito que acompaña el desplazamiento del cliente en las vistas públicas. Su indicador refleja el total de unidades y anima el cambio de cantidad; se oculta en carrito, checkout y confirmación para evitar duplicar la navegación del flujo.
- Se aplicaron estilos responsive con botones, bordes y tipografía existentes en NEXO.

## Archivos modificados

- `src/modules/commerce/components/CustomerAccountPage.tsx`: integración entre wishlist y carrito compartido, validación de disponibilidad y confirmación.
- `src/modules/app/components/FloatingCartButton.tsx`: acceso flotante compartido y contador accesible.
- `src/modules/app/components/NexoPages.tsx`, `src/modules/commerce/components/CommercePages.tsx` y `src/app/(public)/account/page.tsx`: inclusión del acceso flotante en las vistas públicas.
- `src/app/globals.css`: separación del precio y botón, y estilos responsive del acceso flotante.
- `docs/contexto-wishlist-carrito.md`: alcance, decisiones y validación para la descripción del PR.

## Criterios de aceptación

- Desde **Mi wishlist**, el cliente puede agregar al carrito un producto disponible.
- El carrito conserva la cantidad ya seleccionada y no permite agregar más que el stock disponible.
- Un producto sin stock o inactivo no se puede agregar desde la wishlist.
- La acción no elimina el favorito ni altera las operaciones actuales de wishlist.
- El contador y contenido del carrito se actualizan a través del estado global y persisten con el mecanismo existente del frontend.
- No se introducen datos estáticos ni cambios en el backend.

## Validación

- `npm run build`: completado correctamente en la integración actual.
- `git diff --check`: completado sin errores.

## Descripción propuesta para el PR

Agrega en Mi wishlist una acción para enviar productos disponibles al carrito. La acción se integra con el estado global existente, acumula unidades respetando el stock, espera la carga del carrito local y conserva el producto en favoritos. Incluye estados de disponibilidad y estilos coherentes con la cuenta de cliente. Cambio solo de frontend, sin alterar endpoints ni el backend.
