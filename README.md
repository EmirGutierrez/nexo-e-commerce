# NEXO COMMERCE

Tienda de comercio electrónico y panel administrativo de demostración, construido con Next.js App Router, React y TypeScript.

## Ejecutar

Configura e inicia PostgreSQL y Spring Boot siguiendo [backend/README.md](backend/README.md). Copia `.env.example` a `.env.local` en la raíz para que Next.js conozca la URL interna de Spring mediante `SPRING_BACKEND_URL`.

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>.

El registro y el inicio de sesión requieren que PostgreSQL y Spring Boot sigan ejecutándose. Si el formulario indica que el servicio de acceso no está disponible, comprueba que `http://localhost:8080/api/auth/csrf` responde antes de volver a intentarlo. `npm run dev` inicia solamente Next.js.

Para generar y servir una compilación de producción:

```bash
npm run build
npm run start
```

## Trabajo en equipo

Las instrucciones completas de colaboración, ramas, revisión y merges están en [CONTRIBUTING.md](./CONTRIBUTING.md).

El contexto técnico para asistentes de IA y colaboradores está en [AGENTS.md](./AGENTS.md).

La descripción del estado actual, la arquitectura y la evolución técnica está en [docs/contexto-proyecto.md](./docs/contexto-proyecto.md).

El flujo oficial es `origin/develop → feature/* → revisión → merge directo a develop → master`. No se utilizan Pull Requests, `main` ni cambios directos sobre `develop` o `master`.

## Estructura y alcance actual

- `src/app`: rutas y layouts de Next.js, organizados en los grupos `(auth)`, `(public)` y `(admin)`.
- `src/modules`: componentes y lógica organizados por áreas del negocio, como autenticación, productos, ventas, compras, contabilidad y proveedores.
- `src/shared`: servicios y utilidades compartidas.
- `src/contexts`, `src/data`, `src/services` y `src/types.ts`: estado compartido, datos y servicios mock que siguen en transición hacia los módulos por dominio.

Las rutas conservan las URLs existentes, incluyendo `/store`, `/cart`, `/checkout`, `/customer/login`, `/admin/login` y las secciones bajo `/admin/*`.

## Funcionalidades de demostración

- Tienda pública con búsqueda, categorías, ordenamiento y catálogo persistido en PostgreSQL.
- Detalle de producto, ofertas, anuncios, productos vistos recientemente, carrito, códigos de descuento, checkout y confirmación.
- Métodos de pago simulados y revisión de comprobantes guardados en PostgreSQL; no se procesan cobros reales.
- Panel de administración con dashboard, productos, inventario, compras, ventas, clientes, proveedores, marcas, roles y configuración.
- Gestión de ofertas, anuncios y códigos de descuento para Súper Administrador.
- El acceso administrativo requiere una cuenta creada en Spring Boot mediante el bootstrap inicial configurado fuera del repositorio; consulta `backend/README.md`.

El acceso de personal y clientes usa el BFF de Next.js y sesiones, usuarios y roles de Spring Boot. Los clientes pueden crear una cuenta en `/register`; el formulario de acceso dirige a cada persona según el rol devuelto por la API. Catálogo, pedidos, promociones y comprobantes se guardan en PostgreSQL. El carrito y los productos vistos recientemente se guardan en `localStorage`.
