<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Contexto técnico de NEXO COMMERCE

Guía de entrada para asistentes de IA y colaboradores que continúen el trabajo en este repositorio. Para las reglas de ramas y revisión del equipo, consulta también [CONTRIBUTING.md](./CONTRIBUTING.md).

## Propósito

NEXO es una tienda de demostración y un panel administrativo para un negocio minorista. La interfaz está en español, los precios se muestran en quetzales (`Q`) y la experiencia pública prioriza catálogo, carrito y checkout.

El repositorio contiene dos aplicaciones:

- Frontend Next.js en la raíz.
- API Java con Spring Boot y PostgreSQL en `backend/`.

La autenticación, catálogo, pedidos, clientes y módulos principales del panel usan Spring a través del BFF de Next.js. Verifica cada ruta concreta antes de asumir persistencia; algunos recursos visuales de la portada siguen siendo ilustrativos.

## Tecnologías y ejecución

Frontend: Next.js App Router, React, TypeScript y `lucide-react`.

```bash
npm ci
npm run dev
npm run build
npm run start
```

El frontend abre en `http://localhost:3000`. Para iniciar la API y la base de datos, sigue [backend/README.md](./backend/README.md). La raíz incluye `.env.example`; copia el archivo a `.env.local` y configura `SPRING_BACKEND_URL` para el servidor Next.js. No agregues contraseñas ni secretos a Git.

Backend: Java 21, Spring Boot, Spring Security, PostgreSQL, Flyway y sesiones HTTP. Spring es la autoridad de la sesión y los permisos administrativos. Next.js ofrece rutas BFF bajo `/api/...` que reenvían las solicitudes al backend.

## Mapa del frontend

- `src/app`: layouts, grupos de rutas y API BFF de Next.js.
- `src/modules`: componentes y lógica por dominio; por ejemplo autenticación, productos, ventas, compras, contabilidad, proveedores y comercio.
- `src/contexts/AppContext.tsx`: carrito persistido en el navegador, usuario, roles, configuración de pagos y alertas administrativas.
- `src/data/mockData.ts`: recursos visuales heredados y helper de formato; no es la fuente del catálogo público.
- `src/services`: clientes del BFF para autenticación, inventario, pedidos y demás dominios.
- `src/shared`: cliente HTTP y utilidades compartidas.
- `src/types.ts`: tipos comunes del frontend.
- `backend/src`: aplicación Spring y módulos backend.

Las rutas públicas están bajo `src/app/(public)`: `/`, `/store`, `/product/[id]`, `/cart`, `/checkout` y `/confirmation`. Las rutas administrativas están bajo `src/app/(admin)/admin`; el segmento dinámico entrega secciones como `/admin/offers` y `/admin/transfers` al `AdminSection` de `NexoPages.tsx`.

## Funcionalidades actuales

- La tienda obtiene el catálogo de PostgreSQL mediante Spring y el BFF. Los productos inactivos no aparecen en la tienda.
- Las promociones, anuncios y códigos se guardan en PostgreSQL desde `/admin/offers`. El backend valida vigencia, precio, compra mínima y límite de usos; recalcula el descuento al registrar el pedido.
- Los productos vistos recientemente se registran en el navegador.
- El carrito se conserva en `localStorage`; el checkout valida precios y existencias en Spring antes de guardar el pedido.
- El checkout simula tarjeta y transferencia. La transferencia guarda el comprobante en PostgreSQL y el personal autorizado lo revisa en `/admin/transfers`; no se inicia ningún cobro real.
- Solo el carrito y los productos vistos recientemente son preferencias locales. Los pedidos, promociones y comprobantes son compartidos desde PostgreSQL.
- El acceso de personal y clientes inicia/restaura la sesión mediante el BFF y Spring.
- El panel privado ya no incluye Reportes: la navegación no lo muestra y `/admin/reports` redirige al resumen. El backend rechaza el recurso y Flyway elimina sus permisos y registros existentes.

Claves locales relevantes: `nexo.cart.v1` y `nexo-recent-products-v1`. El checkout usa `sessionStorage` solo para pasar temporalmente el código aplicado y el resultado de confirmación entre pantallas.

## Reglas para cambios

- Lee los archivos de dominio y las instrucciones aplicables antes de editar. Conserva los cambios preexistentes del worktree.
- Las páginas de App Router son componentes servidor por defecto. Añade `'use client'` solo a los componentes que usan estado, eventos, hooks del navegador o `localStorage`.
- Prefiere enlaces internos de `next/link`, conserva las rutas existentes y deja las reglas visuales globales en `src/app/globals.css` o los estilos del dominio correspondiente.
- Valida entradas y casos vacíos/error. Los cambios a roles o acceso deben comprobar autorización en la capa adecuada; el frontend no reemplaza los controles del backend.
- No conectes un proveedor de pago real ni guardes datos financieros. Los pagos actuales son simulaciones.
- Mantén textos y errores de interfaz en español. Formatea importes con el helper `formatQ` de `src/data/mockData.ts`.
- No actualices dependencias ni cambies infraestructura para corregir un problema local si el cambio no lo requiere.
- Revisa `git diff` antes de integrar. Para cambios de frontend, ejecuta `npm run build`; este repositorio no define un script de pruebas frontend en `package.json`.

## Zonas que requieren cuidado

- `src/modules/app/components/NexoPages.tsx` contiene piezas antiguas y varias líneas JSX extensas; las pantallas nuevas de comercio viven en `src/modules/commerce/components/`.
- `src/services/roleService.ts` usa los permisos de la sesión autenticada para mostrar el panel; Spring autoriza cada operación protegida.
- No confundas el estado local del navegador con información compartida del backend: `localStorage` no sincroniza usuarios ni dispositivos.
- `CONTRIBUTING.md` define el flujo de ramas del equipo. Si las instrucciones de la tarea indican otro destino de integración, sigue la solicitud explícita del usuario.
