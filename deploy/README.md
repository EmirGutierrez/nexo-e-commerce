# Despliegue en Contabo

El Compose de producción ejecuta PostgreSQL, Spring Boot, Next.js y Caddy. Caddy publica el sitio con HTTPS automático en el dominio raíz y `www`; `api.<dominio>` publica la API para los clientes móviles. PostgreSQL y Spring no publican puertos del host.

## Preparar el servidor una vez

1. Instala Docker Engine y el plugin de Docker Compose v2 en Ubuntu. Confirma que `docker compose version` responda.
2. Crea un usuario `deploy` con acceso SSH por llave y permiso para ejecutar Docker. No uses `root` en el secreto de GitHub.
3. Crea `/opt/nexo-commerce/deploy/.env.production` a partir de `deploy/production.env.example`. Configura el dominio, una contraseña aleatoria larga para la base de datos y una clave MFA persistente (`openssl rand -base64 32`). Guarda la clave en un gestor de secretos y en un respaldo seguro; sin ella no se puede enrolar MFA y cambiarla después deja inaccesibles las cuentas que ya lo usen. Para el primer arranque, configura las cuatro variables de bootstrap del administrador. Protege el archivo con `chmod 600`.
4. Da propiedad de `/opt/nexo-commerce` al usuario `deploy`. El workflow clona el repositorio ahí la primera vez y, después, actualiza la rama `develop`.
5. Configura los registros DNS A de `@`, `www` y `api` con la IPv4 de la VPS. Permite TCP 22 (SSH), 80 y 443; permite UDP 443 para HTTP/3 si quieres usarlo.

En el primer despliegue, Spring crea el administrador configurado por bootstrap. Cuando confirmes que ya puedes iniciar sesión, cambia `BOOTSTRAP_ADMIN_ENABLED` a `false` y borra nombre, correo y contraseña del archivo. No guardes ese archivo en Git.

## Configurar GitHub Actions

En el repositorio, abre **Settings → Secrets and variables → Actions → New repository secret** y agrega:

| Secreto | Valor |
| --- | --- |
| `VPS_HOST` | IPv4 pública de Contabo |
| `VPS_USER` | Usuario SSH de despliegue |
| `VPS_SSH_KEY` | Llave privada cuyo par público está en `~deploy/.ssh/authorized_keys` |

No compartas la llave privada en el repositorio ni en mensajes. El workflow elimina retornos de carro al cargarla para admitir copias desde Windows y valida su formato antes de conectar. La huella ED25519 de la VPS se fija en el workflow y se compara con la respuesta de `ssh-keyscan`; si Contabo cambia la llave del host, actualiza la huella solo después de verificarla desde la consola de la VPS.

Cada push a `develop` ejecuta CI, pero no publica automáticamente en producción. Para desplegar, inicia manualmente el workflow seleccionando `develop`; se exige que pasen pruebas frontend y backend, SonarQube Cloud y la construcción de imágenes. Configura el entorno `production` en GitHub para pedir aprobación de responsables antes de entregar sus secretos al job. Los pushes a otras ramas y los Pull Requests ejecutan CI, pero no despliegan.

El workflow usa `/opt/nexo-commerce` como directorio de despliegue. La primera ejecución requiere que el usuario SSH pueda crear ese directorio y ejecutar Docker; puedes prepararlo con `sudo install -d -o deploy -g deploy /opt/nexo-commerce`.

En el primer despliegue actualizado, el workflow reemplaza la entrada de `VPS_SSH_KEY` en `~deploy/.ssh/authorized_keys` por una entrada `restrict` que fuerza `deploy/nexo-ssh-command.sh`. La llave solo acepta los comandos `health`, `sync-mfa`, `deploy-app` y el bootstrap fijo del workflow; no habilita shell, PTY ni forwarding. El job prueba `health` inmediatamente después de limitar la llave y se detiene si la conexión no funciona. No uses `VPS_SSH_KEY` para administración interactiva. La restricción limita el uso de la llave, pero `deploy` todavía pertenece al grupo `docker`, equivalente a root.

## Comandos útiles en la VPS

```bash
cd /opt/nexo-commerce
docker compose --env-file deploy/.env.production -f compose.prod.yaml ps
docker compose --env-file deploy/.env.production -f compose.prod.yaml logs -f frontend backend postgres caddy
```

La base de datos persiste en el volumen `nexo-commerce-prod-data`. No uses `docker compose down -v` en producción: elimina ese volumen y sus datos.

## Seguridad perimetral y respaldos

Caddy añade HSTS, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` y `X-Content-Type-Options`; Next genera una CSP con nonce por respuesta HTML y Caddy añade una política restrictiva a la API. Caddy limita los cuerpos HTTP a 2 MB y el BFF vuelve a verificar el tamaño. El workflow valida el Caddyfile y la configuración de Compose antes de desplegar. Consulta [seguridad y operaciones](../docs/seguridad-y-operaciones.md) para los controles y las acciones pendientes en GitHub, DNS y VPS.

El volumen de PostgreSQL conserva los datos ante el reinicio de contenedores, pero no es un respaldo. Contabo Auto Backup está activo y guarda copias de la VPS completa fuera del host, en infraestructura del mismo proveedor, con retención limitada. Restaurar desde el panel reemplaza la VPS productiva; nunca uses ese botón para probar una recuperación. Tampoco hay un bucket de Object Storage ni una copia cifrada e independiente confirmada. Antes de usar pedidos con datos reales, configura respaldos cifrados de PostgreSQL en un destino externo y ensaya la restauración en una base aislada. No guardes dumps con direcciones o teléfonos en el repositorio ni en un volumen sin protección.

En DNS, `@` y `api` apuntan a la IPv4 de la VPS y `www` es CNAME al dominio raíz. CAA ya autoriza Let's Encrypt y Sectigo. Hostinger no ofrece DNSSEC para la zona mientras se usen sus nameservers; para activar DNSSEC y un WAF/CDN se debe migrar primero a un proveedor compatible, copiar y validar la zona, actualizar la delegación y publicar el DS que genere ese proveedor. No inventes un valor DS ni cambies nameservers antes de verificar los registros y certificados.

El firewall de red de Contabo `nexo-prod-ingress` está asociado a la VPS. Permite TCP 22/80/443 y UDP 443 desde IPv4 y bloquea el resto del tráfico entrante. SSH sigue accesible desde cualquier IPv4; el usuario `deploy` conserva acceso a Docker, equivalente a root. La llave de GitHub Actions queda limitada al wrapper de despliegue al ejecutar el workflow actualizado.
