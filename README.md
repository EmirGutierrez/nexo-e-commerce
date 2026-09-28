# NEXO COMMERCE

Frontend web de comercio electrónico, ventas e inventario construido desde cero con Vite, React, TypeScript, React Router, Tailwind CSS como dependencia del stack visual y lucide-react.

## Ejecutar

```bash
npm install
npm run dev
```

Para validar producción:

```bash
npm run build
```

## Alcance actual

- Inicio de sesión unificado con selector de tipo de cuenta; el registro aún no está disponible.
- Login administrativo simulado con `superadmin@nexo.gt` / `Admin123!`.
- Redirección de clientes a la tienda y de personal administrativo a una sección permitida por rol. Las rutas `/customer/login` y `/admin/login` siguen disponibles como accesos directos.
- Tienda pública con catálogo, búsqueda instantánea, categorías, ordenamiento y productos destacados.
- Detalle de producto, carrito en memoria, checkout y confirmación de pedido.
- Métodos de pago simulados: tarjeta ficticia y transferencia pendiente de verificación.
- Métodos disponibles en checkout configurables desde `/admin/settings`; las preferencias se guardan en `localStorage` del navegador y ambos métodos comienzan activos.
- Panel administrativo responsive con dashboard, métricas, gráfico, inventario, pedidos, ventas, clientes, productos, usuarios, transferencias, reportes y configuración.
- El módulo Ventas registra ventas presenciales en una sesión mock, descuenta stock y genera comprobantes internos imprimibles; los pedidos web y las compras a proveedores permanecen en sus módulos separados.
- Rutas secundarias para alertas e historial de inventario, facturación, pagos, proveedores, roles y perfil.
- Matriz de permisos por rol y acción, con asignación de rol en la edición de usuarios; la configuración mock se guarda en `localStorage`.
- Catálogo conectado a DummyJSON: actualmente obtiene hasta 194 productos con `limit=0`, y los presenta en páginas de 24 productos.
- Servicios mock asíncronos en `src/services/index.ts`, diseñados para ser sustituidos por una API REST.

## Decisiones técnicas

- El estado de sesión y carrito vive temporalmente en `AppContext`; no se persiste información sensible.
- Los servicios mock devuelven `Promise` para conservar el mismo flujo que usarán los futuros endpoints Spring Boot.
- Las ventas presenciales y sus movimientos de inventario viven solo en memoria durante la sesión; sus comprobantes son internos y no son facturas fiscales.
- Los datos de demostración están relacionados en `src/data/mockData.ts` y usan quetzales con formato `Q 0.00`.
- La protección de `/admin/*` es únicamente de demostración frontend. La autorización real deberá duplicarse en Spring Security/JWT.
- Los permisos por módulo solo ajustan navegación y acceso de rutas en este frontend; no sustituyen controles de autorización en Spring Security ni validaciones en cada endpoint de la API.
- El inicio de sesión de cliente también es simulado: acepta un correo y una contraseña de al menos cuatro caracteres. No existe registro ni autenticación con Google.
- No se implementan cargos reales, almacenamiento de tarjetas, CVV, tokens ni comprobantes bancarios reales.
- La opción de tarjeta solo simula la confirmación; no solicita ni guarda números de tarjeta ni CVV. La transferencia permanece pendiente de verificación.
- El sistema visual usa los tokens definidos en `src/index.css` para mantener la identidad NEXO: crema, azul marino, azul claro y lima.
- La fuente externa de catálogo se encapsula en `src/services/productService.ts`; si falla la red, el frontend vuelve automáticamente a los datos locales.

## Próxima fase sugerida

Separar los módulos de administración en páginas/componentes propios, conectar los servicios a DTOs de Spring Boot, añadir pruebas automatizadas de rutas y permisos, y reemplazar la persistencia en memoria por una sesión segura basada en JWT.
