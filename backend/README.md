# NEXO Commerce Backend

Monolito modular con Spring Boot, PostgreSQL, Flyway y sesiones HTTP administradas por Spring. `identity` gestiona cuentas, sesiones, roles y permisos. `business` persiste catálogo, inventario, compras, ventas, clientes, pedidos, promociones, descuentos y comprobantes. Los cobros con tarjeta y transferencia siguen siendo simulados.

## Requisitos

- Java 21 o superior
- Maven 3.6.3 o superior
- Docker Desktop con Compose

## Desarrollo local

1. Copia `.env.example` a `.env` dentro de `backend/` y define `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_USERNAME` y `DATABASE_PASSWORD`. Usa una contraseña local propia; los valores de `.env` quedan ignorados por Git.
2. Desde `backend/`, inicia PostgreSQL con `docker compose up -d`. El puerto de PostgreSQL queda accesible solo desde el propio equipo.
3. Inicia la API con `mvn spring-boot:run`. El perfil `local` se selecciona por defecto y Flyway aplica las migraciones al arrancar.
4. Swagger UI estará disponible en `http://localhost:8080/swagger-ui.html`.

Next.js actúa como BFF: el navegador solicita `/api/...` al mismo origen y la ruta servidora reenvía la cookie de sesión y el token CSRF a Spring. Copia el `.env.example` de la raíz a `.env.local` y configura `SPRING_BACKEND_URL` con el origen interno de Spring; esta variable solo está disponible en el servidor de Next.js. El uso de HTTP se limita a localhost para desarrollo; utiliza HTTPS entre Next.js y Spring en producción y mantén Spring en una red privada.

El perfil `prod` requiere `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` y `CORS_ALLOWED_ORIGINS`. Usa HTTPS para navegador → Next.js y Next.js → Spring, y conserva `SESSION_COOKIE_SECURE=true`. La cookie que Next.js entrega al navegador es `HttpOnly`, `Secure` para orígenes de producción y `SameSite=Lax`; en localhost sobre HTTP se omite `Secure` para poder probar el flujo. Spring valida cada solicitud protegida. OpenAPI queda deshabilitado en producción por defecto; puede habilitarse con `OPENAPI_ENABLED=true`.

## Primer administrador

No se crean cuentas ni contraseñas en Flyway. Para crear el primer administrador, configura temporalmente `BOOTSTRAP_ADMIN_ENABLED=true`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` en el entorno. La contraseña debe tener entre 16 y 128 caracteres. El proceso crea un único usuario `superadmin` y falla si ya existe uno. Después elimina las cuatro variables de bootstrap antes de reiniciar la API.

## API de identidad

Todas las escrituras requieren un token CSRF; las operaciones privadas también requieren una sesión. Obtén el token antes de iniciar sesión o registrarte y envía la cookie de sesión y la cabecera `X-CSRF-TOKEN` en cada POST. El navegador usa `credentials: include` con rutas relativas; la autorización se aplica en Spring.

| Método y ruta | Acceso | Resultado |
|---|---|---|
| `GET /api/auth/csrf` | Público | `{ "token": "…" }` |
| `POST /api/auth/login` | Público + CSRF | `{ "id": "…", "name": "…", "email": "…", "role": "superadmin", "status": "ACTIVE", "permissions": ["users:view"] }` |
| `POST /api/auth/register` | Público + CSRF | Crea un usuario con rol `customer`, inicia sesión y devuelve la cuenta |
| `GET /api/auth/me` | Sesión | Usuario autenticado y permisos vigentes |
| `POST /api/auth/logout` | Sesión + CSRF | `204 No Content` e invalida la sesión |
| `GET /api/users` | Sesión + `users:view` | Usuarios sin hashes de contraseña |

Ejemplo de credenciales de login: `{ "email": "admin@empresa.gt", "password": "<secreto configurado fuera del repositorio>" }`.

El formulario de acceso del frontend llama a esta API y dirige al usuario según el rol devuelto. Los clientes se registran en `/register`; `customer` no tiene permisos administrativos. El catálogo público y el checkout consultan Spring mediante el BFF; Flyway V9 agrega promociones, descuentos y comprobantes de transferencia.

## Catálogo de demostración opcional

La base nueva inicia sin productos. Para cargar las ocho muestras visuales del frontend como registros reales en PostgreSQL, inicia Spring y ejecuta `node backend/scripts/seed-demo-catalog.mjs` desde la raíz del repositorio. Define antes `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD` en el entorno con una cuenta que tenga permiso `products:create`. El script usa `http://127.0.0.1:8080` por defecto; configura `DEMO_API_ORIGIN` si Spring usa otro puerto. Solo agrega marcas y SKU ausentes, sin modificar los registros existentes. Las credenciales nunca se guardan en el script ni en Flyway.

Los endpoints públicos son `GET /api/catalog/products`, `GET /api/catalog/promotions`, `POST /api/catalog/discounts/validate` y `POST /api/catalog/orders`. El pedido se crea de forma transaccional: Spring consulta el precio y la oferta vigentes, comprueba existencias, aplica y contabiliza el cupón, guarda el comprobante de transferencia cuando corresponde y reserva inventario. La tarjeta solo se simula. Las promociones se administran en `GET/PUT /api/business/promotions`; los comprobantes se consultan y revisan en `GET /api/business/transfers/receipts` y `PATCH /api/business/transfers/receipts/{id}` con permisos de pedidos.
