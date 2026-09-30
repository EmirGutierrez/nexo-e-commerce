# NEXO COMMERCE

Tienda de comercio electrónico y panel administrativo de demostración, construido con Next.js App Router, React y TypeScript.

## Ejecutar

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
- Acceso administrativo de demostración: `superadmin@nexo.gt` / `Admin123!`.

La autenticación, los permisos y los datos son simulados en frontend. La protección administrativa no sustituye autorización del lado del servidor. El estado de sesión y carrito vive en memoria; algunas preferencias se guardan en `localStorage`.
