# Despliegue en Contabo

El Compose de producción ejecuta PostgreSQL, Spring Boot, Next.js y Caddy; `cloudflare-tunnel` conserva el túnel `cloudflared` existente y `wireguard` agrega el acceso privado de despliegue. Caddy publica el sitio con HTTPS automático en el dominio raíz y `www`; `api.<dominio>` publica la API para los clientes móviles. PostgreSQL y Spring no publican puertos del host.

## Preparar el servidor una vez

1. Instala Docker Engine y el plugin de Docker Compose v2 en Ubuntu. Confirma que `docker compose version` responda.
2. Crea un usuario `deploy` con acceso SSH por llave y permiso para ejecutar Docker. No uses `root` en el secreto de GitHub.
3. Crea `/opt/nexo-commerce/deploy/.env.production` a partir de `deploy/production.env.example`. Configura el dominio, una contraseña aleatoria larga para la base de datos, una clave MFA persistente y una clave JWT móvil (`openssl rand -base64 32` para cada clave). Las credenciales de Grafana, el token de recolección y la contraseña del usuario lector de PostgreSQL también deben ser tres claves Base64 independientes de 32 bytes. Guarda las claves en un gestor de secretos y en un respaldo seguro. Cambiar `MFA_ENCRYPTION_KEY` deja inaccesibles las cuentas MFA; cambiar `MOBILE_JWT_SECRET` invalida los JWT móviles vigentes y requiere que el personal vuelva a iniciar sesión. Para el primer arranque, configura las cuatro variables de bootstrap del administrador. Protege el archivo con `chmod 600`.
4. Da propiedad de `/opt/nexo-commerce` al usuario `deploy`. El workflow clona el repositorio ahí la primera vez y, después, actualiza la rama `develop`.
5. Configura la zona en Cloudflare y mantén `@`, `www` y `api` en modo proxy. En el firewall de Contabo, permite TCP 80/443 y UDP 443 solo desde los rangos oficiales de Cloudflare que soporte la instancia. Para la migración gradual a WireGuard, conserva TCP 22 hasta que el workflow complete un despliegue por VPN y hayas comprobado la consola de recuperación de Contabo.

En el primer despliegue, Spring crea el administrador configurado por bootstrap. Cuando confirmes que ya puedes iniciar sesión, cambia `BOOTSTRAP_ADMIN_ENABLED` a `false` y borra nombre, correo y contraseña del archivo. No guardes ese archivo en Git.

Para enviar comprobantes de ventas presenciales, recibos y avisos de estado de pedidos a clientes invitados, configura `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` y `MAIL_FROM` en `.env.production` con las credenciales SMTP del proveedor de correo. Los correos se registran después de confirmar la transacción; si no se configura SMTP, la compra se guarda normalmente, pero no se envía el correo.

## Configurar GitHub Actions

En el repositorio, abre **Settings → Environments → production → Environment secrets** y agrega:

| Secreto | Valor |
| --- | --- |
| `VPS_HOST` | IPv4 pública de Contabo; endpoint UDP 51820 de WireGuard. No se usa como destino SSH tras el bootstrap. |
| `VPS_USER` | Usuario SSH de despliegue |
| `VPS_SSH_KEY` | Llave privada cuyo par público está en `~deploy/.ssh/authorized_keys` |
| `MFA_ENCRYPTION_KEY` | Clave Base64 estable de 32 bytes usada por Spring para cifrar semillas MFA |
| `MOBILE_JWT_SECRET` | Clave Base64 estable de 32 bytes que firma JWT móviles; se sincroniza a la VPS antes de desplegar |
| `GRAFANA_ADMIN_PASSWORD` | Contraseña Base64 aleatoria para iniciar sesión en Grafana como `admin` |
| `PROMETHEUS_SCRAPE_TOKEN` | Token Base64 que autoriza exclusivamente la lectura de métricas del backend |
| `POSTGRES_EXPORTER_PASSWORD` | Contraseña Base64 exclusiva del usuario PostgreSQL `nexo_exporter`, con permisos `pg_monitor` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token del túnel remoto `nexo-production`; se sincroniza a la VPS mediante el wrapper restringido |
| `WIREGUARD_DEPLOY_PRIVATE_KEY` | Llave privada del peer fijo de GitHub Actions; su llave pública queda autorizada solo para `10.77.0.2/32` |

Además, en **Settings → Environments → production → Environment variables**, crea `WIREGUARD_SERVER_PUBLIC_KEY` con la llave pública que muestra el resumen del bootstrap. No es una llave secreta. La llave privada del servidor se genera en la VPS y no se envía a GitHub.

El workflow sincroniza las claves MFA y JWT, las tres credenciales de monitoreo y el token opcional del túnel mediante comandos restringidos del wrapper SSH antes de actualizar los contenedores. No escribas secretos en logs ni los agregues a `.env.production.example`; guarda los valores reales solo en los secretos del entorno `production` y en una copia segura. Para crear cada clave de monitoreo localmente, ejecuta `openssl rand -base64 32` tres veces y agrega cada valor a su secreto correspondiente; no reutilices una clave.

## Grafana y métricas de producción

Tras integrar la rama y desplegar desde `develop`, abre `https://<dominio>/monitoring/` e inicia sesión con el usuario `admin` y el secreto `GRAFANA_ADMIN_PASSWORD`. Grafana aprovisiona el dashboard **NEXO · VPS, PostgreSQL y sitio web** automáticamente.

El dashboard presenta uso de CPU, RAM y almacenamiento del host; salud de la API, PostgreSQL y la página pública; llamadas SQL por segundo y latencia media de ejecución dentro del motor PostgreSQL, más la latencia total del sondeo HTTPS. El exportador limita las estadísticas de sentencias a las 100 con mayor tiempo acumulado y no incluye texto SQL; por tanto, las curvas de consultas y latencia representan esas sentencias registradas, no cada solicitud HTTP de la aplicación. Prometheus conserva 15 días de métricas. PostgreSQL activa `pg_stat_statements` mediante una migración Flyway y reinicia su proceso en la primera actualización para cargar esa extensión; la base y los dashboards conservan sus volúmenes existentes.

Grafana requiere inicio de sesión, no permite registro público ni acceso anónimo, y marca su cookie como segura. Su cuenta se guarda en el volumen persistente; cambiar el secreto `GRAFANA_ADMIN_PASSWORD` por sí solo no cambia una contraseña ya inicializada. Prometheus, Grafana y los exportadores no publican puertos en el host; Prometheus solo vive en una red Docker interna. El endpoint Actuator de métricas está en el puerto privado 8081 y exige `PROMETHEUS_SCRAPE_TOKEN`. PostgreSQL recibe un rol dedicado de lectura `nexo_exporter`; el colector no exporta el texto SQL de las consultas. Solo Blackbox Exporter recibe salida de red para comprobar por HTTPS el dominio público. La VPS se mide desde un exportador de solo lectura que recibe montajes del host sin privilegios adicionales.

No compartas la llave privada en el repositorio ni en mensajes. El workflow elimina retornos de carro al cargarla para admitir copias desde Windows y valida su formato antes de conectar. La huella ED25519 de la VPS se fija en el workflow y se compara con la respuesta de `ssh-keyscan`; si Contabo cambia la llave del host, actualiza la huella solo después de verificarla desde la consola de la VPS.

Cada push a `develop` ejecuta CI, pero no publica automáticamente en producción. Para desplegar, inicia manualmente el workflow seleccionando `develop`; se exige que pasen pruebas frontend y backend, SonarQube Cloud y la construcción de imágenes. Configura el entorno `production` en GitHub para pedir aprobación de responsables antes de entregar sus secretos al job. Los pushes a otras ramas y los Pull Requests ejecutan CI, pero no despliegan.

El workflow usa `/opt/nexo-commerce` como directorio de despliegue. La primera ejecución requiere que el usuario SSH pueda crear ese directorio y ejecutar Docker; puedes prepararlo con `sudo install -d -o deploy -g deploy /opt/nexo-commerce`.

En el primer despliegue actualizado, el workflow reemplaza la entrada de `VPS_SSH_KEY` en `~deploy/.ssh/authorized_keys` por una entrada `restrict` que fuerza `deploy/nexo-ssh-command.sh`. La llave solo acepta `health`, `sync-mfa`, `sync-mobile-jwt`, `sync-monitoring`, `sync-tunnel`, `sync-wireguard`, `wireguard-public-key`, `deploy-app` y el bootstrap fijo; no habilita shell, PTY ni forwarding. El workflow normal valida la huella ED25519 y llega por WireGuard únicamente a `10.77.0.1/32`; no tiene una ruta a otras redes. No uses `VPS_SSH_KEY` para administración interactiva. `deploy` todavía pertenece al grupo `docker`, equivalente a root.

## Migrar SSH de producción a WireGuard

La migración usa GitHub-hosted runners y el perfil Compose `wireguard` en la VPS, sin agregar un proveedor ni costo mensual. La configuración limita el peer de Actions a la IP `10.77.0.2/32`, y el runner solo enruta `10.77.0.1/32`. No permite usar la VPS como salida a Internet ni enrutar a la base de datos. El servicio necesita `NET_ADMIN` y red host para crear `wg0`; recibe además `DAC_READ_SEARCH` para leer la configuración montada con permisos `600` dentro de su directorio `700`, sin hacer pública la llave privada. La imagen WireGuard se construye desde Alpine oficial fijado por digest. Sigue estos pasos:

1. En el firewall de Contabo `nexo-prod-ingress`, agrega **UDP 51820** con origen `0.0.0.0/0`. El WireGuard descarta paquetes sin clave válida; el firewall del host aplica una excepción solo para ese puerto durante la vida del servicio. Conserva TCP 22 durante esta fase.
2. Genera una pareja de llaves para GitHub Actions con `wg genkey` y `wg pubkey`; guarda su llave privada como secreto `WIREGUARD_DEPLOY_PRIVATE_KEY` en `production`. La privada del servidor se genera en la VPS. No guardes llaves privadas en Git ni en la bitácora de Actions.
3. En **Actions → CI → Run workflow**, elige la rama `develop` y la operación **bootstrap-wireguard**; aprueba el job en `production`. El workflow valida la huella SSH, limita la llave, sincroniza la configuración, arranca WireGuard y prueba SSH sobre `10.77.0.1` mientras TCP 22 sigue disponible.
4. Copia `WIREGUARD_SERVER_PUBLIC_KEY` del resumen del job a las variables del entorno `production`. La llave privada permanece en `/opt/nexo-commerce/deploy/.runtime/wireguard/wg0.conf` con permisos `600`, y la carpeta queda fuera de Git.
5. Ejecuta el workflow normal de CI con destino `develop`; aprueba el entorno y confirma que el despliegue completo y las comprobaciones públicas terminan por WireGuard. Si falla, TCP 22 aún sirve como recuperación mientras se corrige.
6. Comprueba que puedes abrir la consola de recuperación de Contabo. Luego elimina la regla TCP 22 del firewall de Contabo y ejecuta otro despliegue completo. El acceso interactivo SSH queda disponible solo por un peer VPN configurado; hasta crear ese peer, la consola de Contabo es la vía administrativa de recuperación.
7. Verifica externamente que TCP 22 ya no responda, UDP 51820 acepte únicamente handshakes WireGuard y los puertos web directos sigan cerrados; confirma también que el sitio y la API continúan `200` detrás de Cloudflare. Mantén `VPS_HOST`: el runner todavía lo necesita como endpoint UDP.

Hasta completar y verificar el paso 6, TCP 22 debe permanecer habilitado en el firewall externo. El túnel de Cloudflare existente puede seguir ejecutándose para su propósito actual; esta migración no publica una ruta SSH de Cloudflare Access.

## Comandos útiles en la VPS

```bash
cd /opt/nexo-commerce
docker compose --env-file deploy/.env.production -f compose.prod.yaml ps
docker compose --env-file deploy/.env.production -f compose.prod.yaml logs -f frontend backend postgres caddy
```

La base de datos persiste en el volumen `nexo-commerce-prod-data`. No uses `docker compose down -v` en producción: elimina ese volumen y sus datos.

## Seguridad perimetral y respaldos

Caddy añade HSTS, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` y `X-Content-Type-Options`; Next genera una CSP con nonce por respuesta HTML y Caddy añade una política restrictiva a la API. Caddy limita los cuerpos HTTP a 2 MB y el BFF vuelve a verificar el tamaño. El workflow valida el Caddyfile y la configuración de Compose antes de desplegar. Consulta [seguridad y operaciones](../docs/seguridad-y-operaciones.md) para los controles y las acciones pendientes en GitHub, DNS y VPS.

El volumen de PostgreSQL conserva los datos ante el reinicio de contenedores, pero no es un respaldo. Contabo Auto Backup estaba activo y mostraba cinco copias en la última inspección autenticada del 19 de octubre de 2026; su estado y retención deben confirmarse de nuevo en el panel. Las copias de la VPS se guardan en infraestructura del mismo proveedor. Restaurar desde el panel reemplaza la VPS productiva; nunca uses ese botón para probar una recuperación. No hay una copia cifrada e independiente ni una restauración aislada confirmadas. Antes de usar pedidos con datos reales, configura respaldos cifrados de PostgreSQL en otro destino y ensaya la restauración en una base aislada. No guardes dumps con direcciones o teléfonos en el repositorio ni en un volumen sin protección, y no contrates almacenamiento sin acordar el costo.

Cloudflare es el DNS/CDN autoritativo: `@`, `api` y `www` están proxied; CAA autoriza Let's Encrypt y Sectigo. DNSSEC está activo con el DS generado por Cloudflare, publicado en Hostinger. La zona proxied oculta las direcciones de origen en consultas DNS públicas y permite aplicar reglas WAF de Cloudflare. Comprueba periódicamente que TLS siga en `Full (strict)` y que las reglas del firewall solo acepten tráfico web desde rangos oficiales de Cloudflare. No desactives DNSSEC ni cambies el DS sin coordinar el cambio de proveedor y comprobar la propagación.

El firewall de red de Contabo `nexo-prod-ingress` está activo y asociado a la VPS. La ejecución de producción #130 aplicó con éxito la llave de GitHub Actions restringida al wrapper. La revisión del panel del 20 de octubre confirmó cuatro reglas: TCP 80/443 y UDP 443 solo desde los rangos IPv4 oficiales de Cloudflare; TCP 22 desde cualquier IPv4; y descarte del resto del tráfico entrante. Una comprobación externa no pudo conectar a los puertos web directos del origen, mientras el sitio respondió a través de Cloudflare. El repositorio ya prepara un perfil opcional para Tunnel y el workflow admite el transporte por Access una vez configurados sus secretos; falta crear el túnel y probarlo antes de cerrar TCP 22. `deploy` aún pertenece al grupo `docker`, equivalente a root; no lo quites hasta migrar a privilegios mínimos y probar recuperación por consola.
