# NEXO COMMERCE

Tienda de comercio electrónico y panel administrativo de demostración, construido con Next.js App Router, React y TypeScript.

## Ejecutar

Configura e inicia PostgreSQL y Spring Boot siguiendo [backend/README.md](backend/README.md). Copia `.env.example` a `.env.local` en la raíz para que Next.js conozca la URL interna de Spring mediante `SPRING_BACKEND_URL`.

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Para generar y servir una compilación de producción:

```bash
npm run build
npm run start
```

## Estructura

- `src/app`: rutas y layouts de Next.js, organizados en los grupos `(auth)`, `(public)` y `(admin)`.
- `src/modules`: componentes y lógica organizados por áreas del negocio, como autenticación, productos, ventas, compras, contabilidad y proveedores.
- `src/shared`: servicios y utilidades compartidas.
- `src/contexts`, `src/data`, `src/services` y `src/types.ts`: estado compartido, datos y servicios mock que siguen en transición hacia los módulos por dominio.

Las rutas conservan las URLs existentes, incluyendo `/store`, `/cart`, `/checkout`, `/customer/login`, `/admin/login` y las secciones bajo `/admin/*`.

## Funcionalidades de demostración

- Tienda pública con búsqueda, categorías, ordenamiento, catálogo externo DummyJSON y datos locales de respaldo.
- Detalle de producto, carrito en memoria, checkout y confirmación.
- Métodos de pago simulados; no se procesan cobros ni se guardan datos financieros.
- Panel de administración con dashboard, productos, inventario, compras, ventas, clientes, proveedores, marcas, roles, reportes y configuración.
- El acceso administrativo requiere una cuenta creada en Spring Boot mediante el bootstrap inicial configurado fuera del repositorio; consulta `backend/README.md`.

El acceso de personal y clientes usa el BFF de Next.js y sesiones, usuarios y roles de Spring Boot. Los clientes pueden crear una cuenta en `/register`; el formulario de acceso dirige a cada persona según el rol devuelto por la API. Los demás dominios continúan simulados. El carrito vive en memoria; algunas preferencias se guardan en `localStorage`.
