# Seguridad y operaciones de producción

## Controles aplicados en el repositorio

- Next genera un nonce CSP aleatorio por respuesta HTML. Los scripts en línea ya no se autorizan con `unsafe-inline`; las páginas se renderizan por solicitud para poder asignar el nonce, por lo que dejan de servirse como HTML estático.
- Caddy limita cada cuerpo HTTP a 2 MB y aplica topes de tiempo/tamaño a cabeceras y cargas. El BFF de Next vuelve a medir el cuerpo, mantiene máximo 32 lecturas simultáneas por proceso y rechaza cuerpos mayores a 2 MB. Los comprobantes de transferencia existentes admiten hasta 1 MB.
- La API limita por IP cada 10 minutos: 10 intentos de login web/móvil combinados, 8 registros, 10 canjes de invitación, 60 validaciones de descuento, 80 cotizaciones y 12 pedidos. Las IPv6 se agrupan por prefijo `/64`. El límite vive en memoria y protege una instancia; no sustituye un WAF ni una limitación distribuida si se escala.
- Los intentos fallidos ya no bloquean automáticamente una cuenta conocida. Eso evita que cualquiera pueda bloquear a un administrador con cinco contraseñas incorrectas; el límite por IP reduce la fuerza bruta básica.
- Los passwords nuevos se limitan a 72 bytes UTF-8 para evitar la truncación propia de BCrypt; los antiguos siguen autenticándose con el comportamiento que tenían.
- Las sesiones web tienen 30 minutos de inactividad y un máximo absoluto de 8 horas. La sesión se invalida en el servidor al vencer.
- MFA TOTP está disponible para las cuentas web y protege también el login móvil cuando una cuenta lo activa. El secreto queda cifrado con AES-GCM; se requiere una clave Base64 de 32 bytes en `MFA_ENCRYPTION_KEY`. Los códigos de recuperación aleatorios se muestran una sola vez, se guardan como SHA-256 y se consumen al usarlos; pueden regenerarse tras verificar contraseña y segundo factor. El backend exige el segundo factor después de validar la contraseña y evita reutilizar el mismo intervalo TOTP.
- La exención CSRF por Bearer solo cubre rutas `/api/mobile/**`. El resto de las escrituras conserva la validación CSRF.
- Las imágenes base de contenedores y las acciones de GitHub Actions usan digests/SHA completos. Dependabot revisa semanalmente paquetes, imágenes y acciones.
- Los contenedores de producción usan `no-new-privileges`, eliminan capacidades innecesarias y limitan la rotación de logs. Backend y Caddy usan un sistema de archivos raíz de solo lectura.

## Riesgos de aplicación aún abiertos

- Los comprobantes de transferencia pendientes vencen a las 24 horas. El proceso cancela el pedido, libera existencias con movimientos auditables, sincroniza la proyección de pedidos y notifica al cliente vinculado. La tarea usa `FOR UPDATE SKIP LOCKED`, por lo que más de una instancia no libera dos veces el mismo pedido. El equipo debe revisar los comprobantes dentro de ese plazo; si se amplía, actualiza el plazo en el proceso y el mensaje de confirmación.
- La limitación por IP vive en memoria de cada instancia. Al escalar a varias instancias se debe mover a un WAF o almacén compartido; una botnet también puede repartir intentos entre direcciones.
- MFA es optativo por cuenta y no bloquea a usuarios que aún no lo hayan activado. `MFA_ENCRYPTION_KEY` ya está configurada en GitHub `production` y en la VPS; los superadministradores y el personal aún deben enrolarse desde Mi perfil. Activar una política obligatoria requiere confirmar primero el enrolamiento y un proceso de recuperación para evitar dejar fuera a los administradores.
- La clave `MFA_ENCRYPTION_KEY` debe permanecer estable. GitHub Actions la sincroniza a la VPS en cada despliegue desde que se integre el workflow de esta rama. Mantener también una copia de recuperación en un gestor de secretos fuera de la VPS; cambiar la clave sin migrar los secretos cifrados impedirá que las cuentas MFA inicien sesión.
- El CSP bloquea scripts y atributos de estilo en línea. Las tablas administrativas aplican sus columnas mediante clases CSS por sección; si se agrega otra sección, debe añadirse su regla de layout en `src/app/globals.css`.
- La cobertura automatizada existente es limitada frente al tamaño de la aplicación. Añadir pruebas de autorización por rol, abuso de endpoints y concurrencia de inventario junto con nuevas funciones sensibles.

## Acciones externas pendientes

1. **MFA de cuentas:** enrolar y comprobar MFA para superadministradores y personal desde Mi perfil antes de exigirlo como política. Guardar los códigos de recuperación fuera del equipo y respaldar `MFA_ENCRYPTION_KEY` en un gestor de secretos independiente.
2. **DNS y mitigación DDoS:** CAA ya permite Let's Encrypt y Sectigo. Hostinger informa que DNSSEC no está disponible para dominios que usan sus nameservers; activar DNSSEC requeriría cambiar el proveedor DNS o solicitar soporte. Colocar sitio y API detrás de un WAF/CDN y limitar el origen a sus redes; si se añade un proxy delante de Caddy, configurar antes sus rangos de confianza.
3. **Respaldos:** Contabo Auto Backup está activo y muestra dos copias recientes, pero el panel advierte problemas de rendimiento en la región US-central. No se confirmó copia independiente fuera del proveedor ni restauración probada. Configurar copias cifradas externas, conservar generaciones y ensayar una restauración antes de depender de ellas.
4. **VPS:** `deploy` pertenece al grupo `docker`, que equivale a root. Restringir su llave a un comando de despliegue fijo o reemplazarla por un mecanismo temporal; no reutilizarla para administración interactiva. Limitar SSH por VPN o IP administrativa cuando sea posible y activar alertas externas de disponibilidad, disco, memoria y CPU.
5. **Cuenta de Contabo:** el panel todavía ofrece activar autenticación de dos factores. Activarla desde la cuenta del propietario.
6. **Correo del dominio:** si el dominio envía correo, publicar SPF, DKIM y DMARC con una política gradual hasta `quarantine`/`reject`.

## Estado observado en producción (2026-10-16)

- La página pública respondió `200` tras aplicar la clave MFA. El contenedor backend quedó `healthy` y confirmó que recibe una clave configurada, sin mostrar su valor.
- La VPS sirve Ubuntu 22.04.5. UFW está activo con entrada denegada por defecto y reglas para SSH `22`, HTTP `80` y HTTPS `443` en IPv4 e IPv6. Solo Caddy publica `80/443` (TCP y UDP); frontend, backend y PostgreSQL no publican puertos del host.
- SSH ahora rechaza acceso root, contraseñas y X11; `deploy` inicia sesión con llave. Fail2ban está instalado, habilitado y activo con jail SSH (`5` intentos en `10` minutos, bloqueo de `1` hora). `deploy` sigue en el grupo `docker`, equivalente a root.
- El entorno GitHub `production` guarda el secreto `MFA_ENCRYPTION_KEY`, permite despliegues únicamente desde `develop` y exige la aprobación de `EmirGutierrez`. La autoaprobación está permitida por decisión del propietario, así que no representa una revisión independiente. `develop` está protegido contra borrado y force-push; `master` exige PR, una aprobación distinta de quien hizo el último push y los checks `Compilar frontend`, `Probar backend` y `Construir imágenes Docker`.
- Secret scanning, push protection y Dependabot security updates están habilitados en el repositorio público. El workflow de `develop` sincroniza la clave de GitHub a `/opt/nexo-commerce/deploy/.env.production` por SSH sin escribirla en logs, antes de actualizar la aplicación; así los despliegues aprobados mantienen sincronizada la copia de la VPS.
- El dominio y `api` apuntan directamente a la IP de la VPS. La delegación es `byte.dns-parking.com` / `pixel.dns-parking.com`. CAA publica `issue letsencrypt.org` y `issue sectigo.com`; DNSSEC no está activo y Hostinger no lo admite con sus nameservers actuales.
- La VPS ejecuta un respaldo local diario de PostgreSQL y Contabo Auto Backup tiene dos copias recientes. Contabo muestra una incidencia de rendimiento en US-central. No se confirmó respaldo cifrado externo independiente ni restauración probada.
- El panel de Contabo todavía ofrece activar 2FA. El entorno local de producción contiene `backups/` y `deploy/backup-postgres.sh` fuera de Git; se conservaron.

## Operación y verificación

- Después de desplegar, comprobar que cada respuesta HTML incluya un nonce distinto en CSP y en los scripts de Next; comprobar que el CSP no contenga `script-src ... unsafe-inline`.
- En el API, verificar que solicitudes mayores a 2 MB reciban `413`, que los endpoints limitados respondan `429` y que las escrituras de sesión sin CSRF sigan recibiendo `403`.
- Después de configurar `MFA_ENCRYPTION_KEY`, enrolar una cuenta de prueba, validar TOTP web/móvil, confirmar que el mismo código TOTP no se puede reutilizar y verificar que cada código de recuperación funciona una sola vez. Respaldar la clave junto con el procedimiento de recuperación.
- Antes de actualizar una imagen fijada, revisar su origen y avisos de seguridad; integrar la nueva digest por cambio revisado y ejecutar CI.
- Mantener una copia de configuración de Caddy y Compose junto con las instrucciones de recuperación, sin incluir `.env.production` ni llaves privadas.
