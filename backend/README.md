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

1. Copia `backend/.env.example` a `backend/.env` y define `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` y `MOBILE_JWT_SECRET`. Genera esta última clave con `openssl rand -base64 32`; usa los mismos valores de usuario y contraseña para PostgreSQL y Spring. El archivo `.env` queda ignorado por Git.
2. Desde `backend/`, inicia PostgreSQL con `docker compose up -d`. El puerto de PostgreSQL queda accesible solo desde el propio equipo.
3. Inicia la API con `mvn spring-boot:run`. El perfil `local` se selecciona por defecto y Flyway aplica las migraciones al arrancar.
4. Swagger UI estará disponible en `http://localhost:8080/swagger-ui.html`.

Next.js actúa como BFF: el navegador solicita `/api/...` al mismo origen y la ruta servidora reenvía la cookie de sesión y el token CSRF a Spring. Copia el `.env.example` de la raíz a `.env.local` y configura `SPRING_BACKEND_URL` con el origen interno de Spring; esta variable solo está disponible en el servidor de Next.js. El uso de HTTP se limita a localhost para desarrollo; utiliza HTTPS entre Next.js y Spring en producción y mantén Spring en una red privada.

El perfil `prod` requiere `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `CORS_ALLOWED_ORIGINS` y `MOBILE_JWT_SECRET`. Usa HTTPS para navegador → Next.js y Next.js → Spring, y conserva `SESSION_COOKIE_SECURE=true`. La cookie que Next.js entrega al navegador es `HttpOnly`, `Secure` para orígenes de producción y `SameSite=Lax`; en localhost sobre HTTP se omite `Secure` para poder probar el flujo. Spring valida cada solicitud protegida. OpenAPI queda deshabilitado en producción por defecto; puede habilitarse con `OPENAPI_ENABLED=true`.

Para entregar recuperación de contraseña configura el correo SMTP con `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` y `MAIL_FROM`. `NEXO_PASSWORD_RESET_URL` debe apuntar a la página web pública `/reset-password` (por ejemplo, `https://tienda.example.com/reset-password` en producción); su valor local predeterminado es `http://localhost:3000/reset-password`.

## PostgreSQL compartido por el equipo

`docker compose up -d` crea una base local persistente en la computadora actual; no comparte datos con otras computadoras. El equipo puede utilizar una instancia PostgreSQL compartida; el proveedor, host, nombre de proyecto y credenciales se distribuyen únicamente por el canal privado del equipo. La API se conecta por TLS con verificación del certificado.

1. Danny comparte por un canal privado el archivo `backend/.env.team` de la instancia Neon. Cada integrante lo coloca en `backend/.env.team` dentro de su copia del repositorio. Si hay que reconstruirlo, copia `backend/env.team.example` como `backend/.env.team`, completa las credenciales recibidas y configura una clave `MOBILE_JWT_SECRET` común para todas las instancias del equipo. `.env.team` está ignorado por Git; no lo subas ni lo envíes dentro del repositorio.
2. Si ya están levantados los servicios locales, detenlos desde la raíz con `docker compose down`. Esto conserva el volumen y los datos locales. Para levantar la aplicación usando la base compartida, ejecuta desde la raíz:

   ```powershell
   docker compose -f compose.team.yaml up --build -d
   docker compose -f compose.team.yaml ps
   ```

   Este archivo Compose inicia Spring y Next.js y toma `DATABASE_URL`, `DATABASE_USERNAME` y `DATABASE_PASSWORD` de `backend/.env.team`; no inicia PostgreSQL local ni necesita `backend/.env`. La web queda en `http://localhost:13000` y Swagger en `http://localhost:18080/swagger-ui.html`. Para detenerlo usa `docker compose -f compose.team.yaml down`. Para DBeaver usa los valores del archivo privado del equipo, con SSL activado. No copies el host, el usuario ni la contraseña en archivos públicos o en Git.
3. Como alternativa sin Docker, desde `backend/` cada integrante inicia Spring con `mvn spring-boot:run -Dspring-boot.run.profiles=team`. Desde la raíz inicia Next.js con `npm run dev`; `.env.local` debe apuntar `SPRING_BACKEND_URL` a `http://localhost:8080`. Todas las APIs se conectarán al mismo PostgreSQL remoto y Flyway aplicará las migraciones pendientes al iniciar Spring.

Cuentas, productos, pedidos, ventas, permisos, imágenes y demás filas persistidas en PostgreSQL serán comunes; el carrito guardado en cada navegador seguirá siendo local. Usa el mismo archivo privado en cada computadora para apuntar a la misma base. Configura copias de seguridad automáticas en el proveedor antes de guardar datos importantes. Las credenciales y la URL completa de conexión nunca deben guardarse en Git ni compartirse en canales públicos.

## Primer administrador

No se crean cuentas ni contraseñas en Flyway. Para crear el primer administrador, configura temporalmente `BOOTSTRAP_ADMIN_ENABLED=true`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` en el entorno. La contraseña debe tener entre 16 y 128 caracteres y no más de 72 bytes UTF-8 por el límite de BCrypt. El proceso crea un único usuario `superadmin` y falla si ya existe uno. Después elimina las cuatro variables de bootstrap antes de reiniciar la API.

## API de identidad

Las escrituras con sesión web requieren un token CSRF; las rutas públicas de recuperación de contraseña están exentas y limitadas por IP para que también puedan usarse desde la app móvil. Obtén el token antes de iniciar sesión o registrarte y envía la cookie de sesión y `X-CSRF-TOKEN` en cada escritura web protegida. El navegador usa `credentials: include` con rutas relativas; Spring aplica la autorización. La app móvil autentica con JWT Bearer; sus escrituras solo evitan CSRF después de validar el token.

| Método y ruta | Acceso | Resultado |
|---|---|---|
| `GET /api/auth/csrf` | Público | `{ "token": "…" }` |
| `POST /api/auth/login` | Público + CSRF | Envía `mfaCode` si la cuenta tiene MFA activa; la API responde `401` con `MFA_REQUIRED` o `MFA_INVALID` hasta validar el segundo factor |
| `POST /api/auth/register` | Público + CSRF | Crea un usuario con rol `customer`, inicia sesión y devuelve la cuenta |
| `POST /api/auth/password-reset/request` | Público, limitado por IP | Siempre responde `202`; si la cuenta existe, envía un enlace de un solo uso válido por 30 minutos |
| `POST /api/auth/password-reset/complete` | Público, limitado por IP | Consume el enlace, cambia la contraseña y revoca sesiones web y tokens móviles; `204 No Content` |
| `GET /api/auth/me` | Sesión | Usuario autenticado y permisos vigentes |
| `POST /api/auth/me/password` | Sesión + CSRF | Verifica la contraseña actual y, si está activa, MFA; cambia el hash y revoca las sesiones web y los tokens móviles de la cuenta; `204 No Content` |
| `GET /api/auth/mfa` | Sesión | Estado MFA y cantidad de códigos de recuperación disponibles |
| `POST /api/auth/mfa/enroll/start` | Sesión + CSRF | Requiere la contraseña actual; devuelve el secreto TOTP y URI de enrolamiento |
| `POST /api/auth/mfa/enroll/complete` | Sesión + CSRF | Confirma TOTP y devuelve diez códigos de recuperación una sola vez |
| `POST /api/auth/mfa/recovery-codes/rotate` | Sesión + CSRF | Verifica contraseña y segundo factor, revoca los códigos viejos y devuelve nuevos |
| `POST /api/auth/mfa/disable` | Sesión + CSRF | Requiere contraseña actual y un código MFA; `204 No Content` |
| `POST /api/auth/logout` | Sesión + CSRF | `204 No Content` e invalida la sesión |
| `GET /api/users` | Sesión + `users:view` | Usuarios sin hashes de contraseña |

Ejemplo de credenciales de login: `{ "email": "admin@empresa.gt", "password": "<secreto configurado fuera del repositorio>" }`.

El formulario de acceso del frontend llama a esta API y dirige al usuario según el rol devuelto. Los clientes se registran en `/register`; `customer` no tiene permisos administrativos. El catálogo público y el checkout consultan Spring mediante el BFF; Flyway V9 agrega promociones, descuentos y comprobantes de transferencia.

## Catálogo de demostración opcional

La base nueva inicia sin productos. Para cargar las ocho muestras visuales del frontend como registros reales en PostgreSQL, inicia Spring y ejecuta `node backend/scripts/seed-demo-catalog.mjs` desde la raíz del repositorio. Define antes `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD` en el entorno con una cuenta que tenga permiso `products:create`. El script usa `http://127.0.0.1:8080` por defecto; configura `DEMO_API_ORIGIN` si Spring usa otro puerto. Solo agrega marcas y SKU ausentes, sin modificar los registros existentes. Las credenciales nunca se guardan en el script ni en Flyway.

Los endpoints públicos son `GET /api/catalog/products`, `GET /api/catalog/promotions`, `POST /api/catalog/discounts/validate`, `POST /api/catalog/orders/quote`, `POST /api/catalog/orders` y `GET /api/catalog/orders/submissions/{idempotencyKey}`. El catálogo público serializa solo los campos permitidos y no expone costos ni ubicaciones internas.

Antes de crear el pedido, `POST /api/catalog/orders/quote` calcula precios, ofertas, descuento y existencias actuales sin reservar inventario ni consumir el cupón. La creación envía el total confirmado en `expectedTotal` y requiere `Idempotency-Key: <UUID>`. Spring compara el total dentro de la transacción, vuelve a validar stock y disponibilidad de pago, y guarda pedido, comprobante, cupón e inventario atómicamente. Si cambia el total, responde `409` para que la persona revise la cotización. Repetir la misma clave y solicitud devuelve el mismo resultado sin duplicar el pedido. La consulta por clave permite recuperar una respuesta perdida y solo devuelve referencia, total y estado de pago. Los endpoints de cotización y creación limitan solicitudes por IP y responden `429` con `Retry-After` al superar el límite. La tarjeta solo se simula.

Las promociones se administran en `GET/PUT /api/business/promotions`; los comprobantes se consultan y revisan en `GET /api/business/transfers/receipts` y `PATCH /api/business/transfers/receipts/{id}` con permisos de pedidos.

## Sesiones móviles

Las apps móviles usan un JWT firmado con HS256, independiente de la cookie web. `POST /api/mobile/auth/login` valida las mismas cuentas y devuelve el JWT una sola vez. Incluye emisor, audiencia móvil, UUID del usuario (`sub`), identificador único (`jti`), fecha de emisión y vencimiento. Spring verifica algoritmo, firma, fechas y claims; además guarda solo el hash SHA-256 del JWT en PostgreSQL para conservar la revocación inmediata al cerrar sesión. En cada petición protegida el backend consulta ese registro, verifica que la cuenta siga activa y carga sus permisos vigentes. El JWT dura siete días por defecto (`MOBILE_ACCESS_TOKEN_LIFETIME` permite cambiarlo). Las peticiones móviles envían `Authorization: Bearer <JWT>` y la app lo guarda con Expo SecureStore. Estas rutas no dependen del BFF de Next.js.

Configura `MOBILE_JWT_SECRET` como Base64 de exactamente 32 bytes aleatorios usando `openssl rand -base64 32`. Mantén la misma clave en todas las instancias que comparten la base de datos; no la guardes en Git ni la reutilices como `MFA_ENCRYPTION_KEY`. Si la rotas, los JWT móviles emitidos con la clave anterior dejan de funcionar y el personal deberá iniciar sesión nuevamente.

MFA TOTP es obligatoria para las cuentas internas y opcional para clientes. El personal completa el enrolamiento desde **Mi perfil → Verificación en dos pasos**; el login web y móvil exige el segundo factor una vez activado, y las cuentas de personal sin enrolar quedan limitadas hasta completarlo. Antes de iniciar Spring, configura `MFA_ENCRYPTION_KEY` como Base64 de 32 bytes aleatorios (por ejemplo, `openssl rand -base64 32`) en el gestor de secretos o archivo de entorno ignorado por Git. Conserva esa clave en una copia segura y no la rotes sin migrar los secretos. El enrolamiento entrega diez códigos de recuperación, que se muestran una sola vez.

| Método y ruta | Acceso | Resultado |
|---|---|---|
| `POST /api/mobile/auth/login` | Público; JSON | `{ "accessToken": "…", "tokenType": "Bearer", "expiresAt": "…", "user": { "id": "…", "role": "sales", "permissions": ["sales:view"] } }` |
| `GET /api/mobile/auth/me` | Bearer token | Usuario autenticado y permisos vigentes |
| `POST /api/mobile/auth/logout` | Bearer token | `204 No Content` y revoca el token |

La protección CSRF se conserva para las sesiones web con cookie. Las operaciones bajo `/api/mobile/**`, `/api/business/**`, `/api/users/**` y `/api/roles/**` se eximen de CSRF únicamente si el backend ya validó el JWT Bearer de esa solicitud. Presentar un encabezado Bearer inválido rechaza la petición, incluso cuando se acompaña de una cookie web. El login móvil tiene su propia exención pública; el resto de las rutas conserva CSRF. Usa HTTPS fuera del entorno local.

Para probar Expo Go en un teléfono físico dentro de la red local, inicia Spring con `SERVER_ADDRESS=0.0.0.0`, configura el firewall para permitir el acceso desde esa red y usa una URL alcanzable desde el dispositivo en `EXPO_PUBLIC_API_URL`. No expongas el servidor de desarrollo a Internet.

## Operación desde la app

La app usa los mismos registros persistidos para productos, inventario, clientes, proveedores, ventas y pedidos que consulta el sitio web. `POST /api/business/orders` requiere el permiso `orders:create`; Spring valida los datos del cliente, disponibilidad de pago, promociones y stock, registra al usuario responsable y reserva existencias en una transacción. Las compras de proveedor admiten varios artículos y generan sus movimientos de inventario.

Los productos nuevos se registran desde Inventario mediante `POST /api/business/inventory/products`, autorizado con `inventory:create`. El módulo consulta productos con `GET /api/business/inventory/products` (`inventory:view`) y edita sus datos con `PUT /api/business/inventory/products/{id}` (`inventory:edit`); los ajustes de existencias con motivo usan `PATCH /api/business/inventory/products/{id}`. El personal puede incluir opcionalmente en `image` un `data:image/jpeg;base64,...`, PNG o WEBP de hasta 140 KB al crear o editar un producto. Spring valida el formato, guarda el archivo en PostgreSQL mediante Flyway V11 y reemplaza el contenido recibido por una URL compartida (`GET /api/catalog/products/{id}/image`). También se pueden guardar URLs externas convencionales. El BFF de Next.js reenvía esa ruta de imagen junto con el resto de `/api/...`.
