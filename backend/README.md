# NEXO Commerce Backend

Monolito modular con Spring Boot, PostgreSQL, Flyway y sesiones HTTP administradas por Spring. `identity` gestiona cuentas, sesiones, roles y permisos. `business` persiste catálogo, inventario, compras, ventas, clientes, pedidos, promociones, descuentos y comprobantes. Los cobros con tarjeta y transferencia siguen siendo simulados.

## Requisitos

- Java 21 o superior
- Maven 3.6.3 o superior
- Docker Desktop con Docker Compose v2.30 o superior

## Arranque completo con Docker Compose

Desde la raíz del repositorio, copia `backend/.env.example` a `backend/.env`, completa usuario y contraseña de PostgreSQL y ejecuta:

```powershell
docker compose up --build -d
docker compose ps
```

Compose construye la API con Maven, crea PostgreSQL, espera a que la base esté lista, inicia Spring para aplicar Flyway y luego levanta Next.js cuando la API responda. La web queda en `http://localhost:13000`, Swagger en `http://localhost:18080/swagger-ui.html` y PostgreSQL en `127.0.0.1:15432`. Para DBeaver usa ese host y puerto, la base `nexo_commerce` y el usuario/contraseña definidos en `backend/.env`.

Los puertos de este proyecto se eligieron para evitar el puerto 5432, que ya estaba ocupado en la computadora donde se preparó esta configuración. Están publicados solo en loopback. Si alguno de esos tres puertos ya estuviera ocupado en otra computadora, cambia el lado izquierdo de su mapeo en `compose.yaml` y actualiza el origen CORS en `backend`; los puertos internos de los contenedores no cambian.

La base usa el volumen persistente `nexo-commerce-dev-data`. `docker compose down` detiene los servicios y conserva los datos. `docker compose down -v` elimina también el volumen y borra la base local: úsalo únicamente si quieres reiniciarla desde cero.

Para revisar los registros usa `docker compose logs -f postgres backend frontend`; para detener todo, `docker compose down`. No necesitas ejecutar Maven ni `npm run dev` aparte cuando uses este Compose: Maven compila el backend durante la construcción de su imagen y Next.js se inicia como servicio del mismo archivo.

## Desarrollo local

1. Copia `backend/.env.example` a `backend/.env` y define `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_USERNAME` y `DATABASE_PASSWORD`. Usa los mismos valores de usuario y contraseña para PostgreSQL y Spring; `.env` queda ignorado por Git.
2. Desde `backend/`, inicia PostgreSQL con `docker compose up -d`. El puerto de PostgreSQL queda accesible solo desde el propio equipo.
3. Inicia la API con `mvn spring-boot:run`. El perfil `local` se selecciona por defecto y Flyway aplica las migraciones al arrancar.
4. Swagger UI estará disponible en `http://localhost:8080/swagger-ui.html`.

Next.js actúa como BFF: el navegador solicita `/api/...` al mismo origen y la ruta servidora reenvía la cookie de sesión y el token CSRF a Spring. Copia el `.env.example` de la raíz a `.env.local` y configura `SPRING_BACKEND_URL` con el origen interno de Spring; esta variable solo está disponible en el servidor de Next.js. El uso de HTTP se limita a localhost para desarrollo; utiliza HTTPS entre Next.js y Spring en producción y mantén Spring en una red privada.

El perfil `prod` requiere `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` y `CORS_ALLOWED_ORIGINS`. Usa HTTPS para navegador → Next.js y Next.js → Spring, y conserva `SESSION_COOKIE_SECURE=true`. La cookie que Next.js entrega al navegador es `HttpOnly`, `Secure` para orígenes de producción y `SameSite=Lax`; en localhost sobre HTTP se omite `Secure` para poder probar el flujo. Spring valida cada solicitud protegida. OpenAPI queda deshabilitado en producción por defecto; puede habilitarse con `OPENAPI_ENABLED=true`.

## PostgreSQL compartido por el equipo

`docker compose up -d` crea una base local persistente en la computadora actual; no comparte datos con otras computadoras. El equipo dispone de una instancia PostgreSQL compartida en Neon (proyecto `fancy-wind-65283432`, base **`nexo_commerce`**). Se restauraron allí los datos de demostración de la base local anterior y Spring aplicó las 17 migraciones Flyway. La API se conecta por TLS con verificación del certificado.

1. Danny comparte por un canal privado el archivo `backend/.env.team` de la instancia Neon. Cada integrante lo coloca en `backend/.env.team` dentro de su copia del repositorio. Si hay que reconstruirlo, copia `backend/env.team.example` como `backend/.env.team` y completa las credenciales recibidas. `.env.team` está ignorado por Git; no lo subas ni lo envíes dentro del repositorio.
2. Si ya están levantados los servicios locales, detenlos desde la raíz con `docker compose down`. Esto conserva el volumen y los datos locales. Para levantar la aplicación usando la base compartida, ejecuta desde la raíz:

   ```powershell
   docker compose -f compose.team.yaml up --build -d
   docker compose -f compose.team.yaml ps
   ```

   Este archivo Compose inicia Spring y Next.js y toma `DATABASE_URL`, `DATABASE_USERNAME` y `DATABASE_PASSWORD` de `backend/.env.team`; no inicia PostgreSQL local ni necesita `backend/.env`. La web queda en `http://localhost:13000` y Swagger en `http://localhost:18080/swagger-ui.html`. Para detenerlo usa `docker compose -f compose.team.yaml down`. Para DBeaver usa el host directo `ep-fancy-firefly-b5jrgfbt.c-7.us-east-2.aws.neon.tech`, puerto `5432`, base `nexo_commerce`, usuario `neondb_owner`, la contraseña recibida por privado y SSL activado.
3. Como alternativa sin Docker, desde `backend/` cada integrante inicia Spring con `mvn spring-boot:run -Dspring-boot.run.profiles=team`. Desde la raíz inicia Next.js con `npm run dev`; `.env.local` debe apuntar `SPRING_BACKEND_URL` a `http://localhost:8080`. Todas las APIs se conectarán al mismo PostgreSQL remoto y Flyway aplicará las migraciones pendientes al iniciar Spring.

Cuentas, productos, pedidos, ventas, permisos, imágenes y demás filas persistidas en PostgreSQL serán comunes; el carrito guardado en cada navegador seguirá siendo local. Usa el mismo archivo privado en cada computadora para apuntar a la misma base. Configura copias de seguridad automáticas en el proveedor antes de guardar datos importantes. Las credenciales y la URL completa de conexión nunca deben guardarse en Git ni compartirse en canales públicos.

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

## Sesiones móviles

Las apps móviles usan un token opaco independiente de la cookie web. `POST /api/mobile/auth/login` valida las mismas cuentas, devuelve el token una sola vez y guarda solo su hash SHA-256 en PostgreSQL. El token dura siete días por defecto (`MOBILE_ACCESS_TOKEN_LIFETIME` permite cambiarlo), se revoca al cerrar sesión y se rechaza si la cuenta deja de estar activa o queda bloqueada. Las peticiones móviles protegidas envían `Authorization: Bearer <token>`; Spring carga los permisos vigentes del usuario en cada petición. Estas rutas no dependen del BFF de Next.js.

| Método y ruta | Acceso | Resultado |
|---|---|---|
| `POST /api/mobile/auth/login` | Público; JSON | `{ "accessToken": "…", "tokenType": "Bearer", "expiresAt": "…", "user": { "id": "…", "role": "sales", "permissions": ["sales:view"] } }` |
| `GET /api/mobile/auth/me` | Bearer token | Usuario autenticado y permisos vigentes |
| `POST /api/mobile/auth/logout` | Bearer token | `204 No Content` y revoca el token |

La protección CSRF se conserva para las sesiones web con cookie. Las solicitudes autenticadas con `Bearer` no usan CSRF porque el sistema operativo no adjunta ese encabezado automáticamente como hace un navegador con una cookie. Usa HTTPS fuera del entorno local.

Para probar Expo Go en un teléfono físico dentro de la red local, inicia Spring con `SERVER_ADDRESS=0.0.0.0`, configura el firewall para permitir el acceso desde esa red y usa una URL alcanzable desde el dispositivo en `EXPO_PUBLIC_API_URL`. No expongas el servidor de desarrollo a Internet.

## Operación desde la app

La app usa los mismos registros persistidos para productos, inventario, clientes, proveedores, ventas y pedidos que consulta el sitio web. `POST /api/business/orders` requiere el permiso `orders:create`; Spring valida los datos del cliente, disponibilidad de pago, promociones y stock, registra al usuario responsable y reserva existencias en una transacción. Las compras de proveedor admiten varios artículos y generan sus movimientos de inventario.

Los productos nuevos se registran desde Inventario mediante `POST /api/business/inventory/products`, autorizado con `inventory:create`. El personal puede incluir en `image` un `data:image/jpeg;base64,...`, PNG o WEBP de hasta 140 KB al crear o editar un producto. Spring valida el formato, guarda el archivo en PostgreSQL mediante Flyway V11 y reemplaza el contenido recibido por una URL compartida (`GET /api/catalog/products/{id}/image`). También se pueden guardar URLs externas convencionales. El BFF de Next.js reenvía esa ruta de imagen junto con el resto de `/api/...`.
