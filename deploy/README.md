# Despliegue en Contabo

El Compose de producción ejecuta PostgreSQL, Spring Boot, Next.js y Caddy; el perfil opcional `cloudflare-tunnel` agrega `cloudflared` para SSH mediante Access. Caddy publica el sitio con HTTPS automático en el dominio raíz y `www`; `api.<dominio>` publica la API para los clientes móviles. PostgreSQL y Spring no publican puertos del host.

## Preparar el servidor una vez

1. Instala Docker Engine y el plugin de Docker Compose v2 en Ubuntu. Confirma que `docker compose version` responda.
2. Crea un usuario `deploy` con acceso SSH por llave y permiso para ejecutar Docker. No uses `root` en el secreto de GitHub.
3. Crea `/opt/nexo-commerce/deploy/.env.production` a partir de `deploy/production.env.example`. Configura el dominio, una contraseña aleatoria larga para la base de datos y una clave MFA persistente (`openssl rand -base64 32`). Guarda la clave en un gestor de secretos y en un respaldo seguro; sin ella no se puede enrolar MFA y cambiarla después deja inaccesibles las cuentas que ya lo usen. Para el primer arranque, configura las cuatro variables de bootstrap del administrador. Protege el archivo con `chmod 600`.
4. Da propiedad de `/opt/nexo-commerce` al usuario `deploy`. El workflow clona el repositorio ahí la primera vez y, después, actualiza la rama `develop`.
5. Configura la zona en Cloudflare y mantén `@`, `www` y `api` en modo proxy. En el firewall de Contabo, permite TCP 80/443 y UDP 443 solo desde los rangos oficiales de Cloudflare que soporte la instancia. La migración de SSH a Cloudflare Tunnel se detalla abajo; conserva el puerto 22 abierto hasta que el workflow complete un despliegue mediante Access y hayas comprobado la consola de recuperación de Contabo.

En el primer despliegue, Spring crea el administrador configurado por bootstrap. Cuando confirmes que ya puedes iniciar sesión, cambia `BOOTSTRAP_ADMIN_ENABLED` a `false` y borra nombre, correo y contraseña del archivo. No guardes ese archivo en Git.

Para enviar comprobantes de ventas presenciales, recibos y avisos de estado de pedidos a clientes invitados, configura `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` y `MAIL_FROM` en `.env.production` con las credenciales SMTP del proveedor de correo. Los correos se registran después de confirmar la transacción; si no se configura SMTP, la compra se guarda normalmente, pero no se envía el correo.

## Configurar GitHub Actions

En el repositorio, abre **Settings → Environments → production → Environment secrets** y agrega:

| Secreto | Valor |
| --- | --- |
| `VPS_HOST` | IPv4 pública de Contabo; solo se usa mientras se inicializa o recupera el túnel |
| `VPS_USER` | Usuario SSH de despliegue |
| `VPS_SSH_KEY` | Llave privada cuyo par público está en `~deploy/.ssh/authorized_keys` |
| `MFA_ENCRYPTION_KEY` | Clave Base64 estable de 32 bytes usada por Spring para cifrar semillas MFA |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token del túnel remoto `nexo-production`; se sincroniza a la VPS en el primer despliegue directo |
| `CF_ACCESS_CLIENT_ID` | ID del token de servicio para el workflow de producción |
| `CF_ACCESS_CLIENT_SECRET` | Secreto del token de servicio para el workflow de producción |

No compartas la llave privada en el repositorio ni en mensajes. El workflow elimina retornos de carro al cargarla para admitir copias desde Windows y valida su formato antes de conectar. La huella ED25519 de la VPS se fija en el workflow y se compara con la respuesta de `ssh-keyscan`; si Contabo cambia la llave del host, actualiza la huella solo después de verificarla desde la consola de la VPS.

Cada push a `develop` ejecuta CI, pero no publica automáticamente en producción. Para desplegar, inicia manualmente el workflow seleccionando `develop`; se exige que pasen pruebas frontend y backend, SonarQube Cloud y la construcción de imágenes. Configura el entorno `production` en GitHub para pedir aprobación de responsables antes de entregar sus secretos al job. Los pushes a otras ramas y los Pull Requests ejecutan CI, pero no despliegan.

El workflow usa `/opt/nexo-commerce` como directorio de despliegue. La primera ejecución requiere que el usuario SSH pueda crear ese directorio y ejecutar Docker; puedes prepararlo con `sudo install -d -o deploy -g deploy /opt/nexo-commerce`.

En el primer despliegue actualizado, el workflow reemplaza la entrada de `VPS_SSH_KEY` en `~deploy/.ssh/authorized_keys` por una entrada `restrict` que fuerza `deploy/nexo-ssh-command.sh`. La llave solo acepta `health`, `sync-mfa`, `sync-tunnel`, `deploy-app` y el bootstrap fijo del workflow; no habilita shell, PTY ni forwarding. El job prueba `health` inmediatamente después de limitar la llave y se detiene si la conexión no funciona. No uses `VPS_SSH_KEY` para administración interactiva. La restricción limita el uso de la llave, pero `deploy` todavía pertenece al grupo `docker`, equivalente a root.

## Migrar SSH a Cloudflare Tunnel sin costo adicional

El servicio `cloudflared` vive en el perfil Compose `cloudflare-tunnel`. Sin token no arranca y los despliegues existentes siguen usando el acceso directo. El flujo de migración es:

1. Activa MFA en la cuenta Cloudflare. En **Zero Trust → Networks → Tunnels**, crea un túnel remoto llamado `nexo-production`; no publiques el token en el repositorio ni en mensajes.
2. Antes de publicar una ruta, crea una aplicación Access para `ssh.nexo-e-commerce.com` y un token de servicio exclusivo para CI. Agrega una política `Service Auth` que incluya únicamente ese token; no uses una política `Bypass` ni una regla que permita a todos.
3. Agrega la ruta pública `ssh.nexo-e-commerce.com` hacia `ssh://host.docker.internal:22`. Guarda el token del túnel como secreto `CLOUDFLARE_TUNNEL_TOKEN` en el entorno `production` de GitHub. Ejecuta el workflow una vez sin los secretos `CF_ACCESS_CLIENT_ID` y `CF_ACCESS_CLIENT_SECRET`: el workflow conecta por SSH como ahora, sincroniza el token con el wrapper restringido y arranca el perfil Compose del túnel.
4. Confirma que el túnel aparezca `Healthy` en Cloudflare. Guarda el ID y secreto del token de servicio en `CF_ACCESS_CLIENT_ID` y `CF_ACCESS_CLIENT_SECRET`, también en el entorno `production`.
5. Ejecuta de nuevo el workflow. Con ambos secretos de Access configurados, CI conecta mediante `cloudflared access tcp` y valida la misma huella ED25519 del servidor antes de desplegar. La versión cliente está fijada en `2026.5.1` porque versiones posteriores reportaron una regresión con tokens de servicio en conexiones SSH/TCP; actualízala después de confirmar una corrección y probar el acceso.
6. Solo después de que el despliegue por Access termine y se confirme el acceso de recuperación en la consola de Contabo, elimina la regla TCP 22 pública del firewall de Contabo y prueba un despliegue más. Las reglas de 80/443 actuales pueden quedarse: solo aceptan tráfico de Cloudflare.
7. Cuando el despliegue por Access vuelva a funcionar con el firewall cerrado, elimina `VPS_HOST` y `CLOUDFLARE_TUNNEL_TOKEN` de los secretos del entorno `production`. CI ya no los necesita; esto evita conservar en GitHub la IP del origen y el token que permite conectar otro daemon al túnel.

Cloudflare publica Zero Trust Free a $0 para equipos de hasta 50 usuarios ([planes](https://www.cloudflare.com/plans/zero-trust-services/)); Tunnel establece conexiones salientes desde la VPS ([documentación](https://developers.cloudflare.com/use-cases/apis/internal-services/)). El túnel no oculta la IP si se mantienen los registros A actuales; una vez confirmada la ruta SSH se puede evaluar una migración separada de la web. El acceso SSH público debe permanecer disponible hasta completar todos los pasos anteriores.

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
