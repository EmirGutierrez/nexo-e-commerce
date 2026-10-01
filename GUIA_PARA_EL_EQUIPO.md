# NEXO Commerce: instalación local para el equipo

Repositorio: https://github.com/EmirGutierrez/nexo-e-commerce
Rama de trabajo compartida: `develop`

Cada integrante debe tener acceso al repositorio y preparar su propia base de datos y sus propias credenciales locales. No hace falta recibir los archivos `.env` de otra persona.

## Requisitos

- Docker Desktop en ejecución, con Docker Compose.
- Java 21 y Maven 3.6.3 o superior.
- Node.js 20.9 o superior y npm.
- Puertos locales 5432 (PostgreSQL), 8080 (Spring Boot) y 3000 (Next.js) disponibles.

## 1. Descargar el proyecto

En PowerShell:

```powershell
git clone https://github.com/EmirGutierrez/nexo-e-commerce.git
cd nexo-e-commerce
git switch develop
```

Si ya tienen el repositorio, actualicen `develop` sin descartar cambios locales:

```powershell
git switch develop
git pull --ff-only origin develop
```

Si Git indica que hay cambios locales o un conflicto, consérvenlos y resuélvanlo antes de continuar; no usen `reset --hard`.

## 2. Crear la configuración local

Desde la raíz del proyecto:

```powershell
Copy-Item .env.example .env.local
Copy-Item backend/.env.example backend/.env
```

En `backend/.env`, elijan un usuario y una contraseña **propios** para PostgreSQL. Deben coincidir los valores de `POSTGRES_USER` y `DATABASE_USERNAME`, así como los de `POSTGRES_PASSWORD` y `DATABASE_PASSWORD`. Por ejemplo, configuren estos campos con sus valores privados:

```dotenv
POSTGRES_DB=nexo_commerce
POSTGRES_USER=<usuario-local-elegido>
POSTGRES_PASSWORD=<contrasena-local-elegida>
POSTGRES_PORT=5432
DATABASE_URL=jdbc:postgresql://localhost:5432/nexo_commerce
DATABASE_USERNAME=<mismo-usuario-local-elegido>
DATABASE_PASSWORD=<misma-contrasena-local-elegida>
```

Conserven las demás variables del archivo de ejemplo. Si cambian el puerto de PostgreSQL, actualicen `POSTGRES_PORT` y el puerto dentro de `DATABASE_URL`.

En `.env.local` debe figurar:

```dotenv
SPRING_BACKEND_URL=http://localhost:8080
```

Esa variable la usa el servidor de Next.js. Para un entorno publicado, configuren una URL segura (`https://`) entre Next.js y Spring Boot.

No suban ni compartan `backend/.env` o `.env.local`: contienen configuración local y pueden contener secretos. Los archivos `.env.example` del repositorio son las plantillas que sí se pueden compartir.

## 3. Levantar PostgreSQL

En una terminal situada en `backend/`:

```powershell
docker compose up -d
docker compose ps
```

Docker crea la base de datos local. Flyway crea las tablas al iniciar Spring Boot.

## 4. Crear el primer administrador e iniciar el backend

Solo en una instalación con la base de datos vacía, usen una terminal de PowerShell situada en `backend/`:

```powershell
$env:BOOTSTRAP_ADMIN_ENABLED = 'true'
$env:BOOTSTRAP_ADMIN_NAME = Read-Host 'Nombre del administrador'
$env:BOOTSTRAP_ADMIN_EMAIL = Read-Host 'Correo del administrador'
$env:BOOTSTRAP_ADMIN_PASSWORD = Read-Host 'Clave propia del administrador (16 a 128 caracteres)'
mvn spring-boot:run
```

Guarden el correo y la clave que eligieron: sirven para entrar al panel administrativo. El proceso de bootstrap solo se debe ejecutar una vez para esa base de datos. Después de que Spring Boot inicie correctamente, pueden detenerlo con `Ctrl+C`; para los siguientes arranques, abran **una terminal nueva** en `backend/` y ejecuten únicamente:

```powershell
mvn spring-boot:run
```

No dejen las variables `BOOTSTRAP_ADMIN_*` activas para los arranques normales. El backend debe permanecer ejecutándose mientras usan la aplicación.

## 5. Iniciar el frontend

En otra terminal, situada en la raíz del proyecto:

```powershell
npm ci
npm run dev
```

Abran http://localhost:3000 e inicien sesión administrativa con el correo y la clave creados en el paso anterior. Los clientes pueden crear su propia cuenta en `/register` y entran a la tienda con su rol `customer`. Next.js reenvía las solicitudes protegidas a Spring Boot. Catálogo, pedidos y los demás dominios siguen usando los mocks actuales.

## 6. Ver la base de datos con DBeaver

Creen una conexión PostgreSQL con estos datos de **su propia** instalación:

| Campo | Valor |
| --- | --- |
| Host | `localhost` |
| Puerto | Valor de `POSTGRES_PORT` en `backend/.env` (por defecto `5432`) |
| Base de datos | Valor de `POSTGRES_DB` (por defecto `nexo_commerce`) |
| Usuario | Valor de `POSTGRES_USER` |
| Contraseña | Valor de `POSTGRES_PASSWORD` |

La contraseña de PostgreSQL y la del administrador son distintas y cada integrante las elige localmente. Si necesitan compartir registros de una base de datos existente, hará falta un respaldo y una restauración de PostgreSQL por separado; el repositorio y Flyway solo contienen la estructura inicial.

## Arranques posteriores

1. Inicien Docker Desktop.
2. En `backend/`, ejecuten `docker compose up -d` y `mvn spring-boot:run` en la terminal del backend.
3. En la raíz, ejecuten `npm run dev` en otra terminal.
4. Entren con el administrador que ya crearon. No repitan el bootstrap.

Para detener los servicios de la aplicación usen `Ctrl+C` en ambas terminales. `docker compose down` detiene PostgreSQL sin borrar el volumen de datos; no usen `docker compose down -v` si desean conservar los usuarios y registros locales.
