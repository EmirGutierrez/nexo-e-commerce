# NEXO Commerce Backend

Monolito modular con Spring Boot, PostgreSQL, Flyway y sesiones HTTP administradas por Spring. El módulo `identity` gestiona el registro de clientes, el inicio y cierre de sesión y la consulta del usuario autenticado. Los demás dominios conservan sus datos de demostración.

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

El formulario de acceso del frontend llama a esta API y dirige al usuario según el rol devuelto. Los clientes se registran en `/register`; `customer` no tiene permisos administrativos. Los servicios de catálogo, pedidos y demás dominios conservan sus mocks durante esta etapa.
