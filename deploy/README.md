# Despliegue en Contabo

El Compose de producción ejecuta PostgreSQL, Spring Boot, Next.js y Caddy. Caddy publica el sitio con HTTPS automático en el dominio raíz y `www`; `api.<dominio>` publica la API para los clientes móviles. PostgreSQL y Spring no publican puertos del host.

## Preparar el servidor una vez

1. Instala Docker Engine y el plugin de Docker Compose v2 en Ubuntu. Confirma que `docker compose version` responda.
2. Crea un usuario `deploy` con acceso SSH por llave y permiso para ejecutar Docker. No uses `root` en el secreto de GitHub.
3. Crea `/opt/nexo-commerce/deploy/.env.production` a partir de `deploy/production.env.example`. Configura el dominio, una contraseña aleatoria larga para la base de datos y, para el primer arranque, las cuatro variables de bootstrap del administrador. Protege el archivo con `chmod 600`.
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

Cada push a `develop` despliega después de que pasen la compilación del frontend, las pruebas de Spring y la construcción de las imágenes Docker. Los pushes a otras ramas ejecutan CI, pero no despliegan. También se puede iniciar manualmente el workflow seleccionando `develop`.

El workflow usa `/opt/nexo-commerce` como directorio de despliegue. La primera ejecución requiere que el usuario SSH pueda crear ese directorio y ejecutar Docker; puedes prepararlo con `sudo install -d -o deploy -g deploy /opt/nexo-commerce`.

## Comandos útiles en la VPS

```bash
cd /opt/nexo-commerce
docker compose --env-file deploy/.env.production -f compose.prod.yaml ps
docker compose --env-file deploy/.env.production -f compose.prod.yaml logs -f frontend backend postgres caddy
```

La base de datos persiste en el volumen `nexo-commerce-prod-data`. No uses `docker compose down -v` en producción: elimina ese volumen y sus datos.
