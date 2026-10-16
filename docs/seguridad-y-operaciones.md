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
- MFA es optativo por cuenta y no bloquea a usuarios que aún no lo hayan activado. Tras configurar `MFA_ENCRYPTION_KEY`, los superadministradores y el personal deben enrolarse desde Mi perfil; activar una política obligatoria requiere confirmar primero el enrolamiento y un proceso de recuperación para evitar dejar fuera a los administradores.
- La clave `MFA_ENCRYPTION_KEY` debe permanecer estable y respaldarse en el gestor de secretos. Cambiarla sin migrar los secretos cifrados impedirá que las cuentas MFA inicien sesión.
- El CSP bloquea scripts y atributos de estilo en línea. Las tablas administrativas aplican sus columnas mediante clases CSS por sección; si se agrega otra sección, debe añadirse su regla de layout en `src/app/globals.css`.
- La cobertura automatizada existente es limitada frente al tamaño de la aplicación. Añadir pruebas de autorización por rol, abuso de endpoints y concurrencia de inventario junto con nuevas funciones sensibles.

## Acciones externas pendientes

Estas medidas requieren acceso de propietario a GitHub, al proveedor DNS o a la VPS. El repositorio no puede activarlas por sí solo.

1. **GitHub:** proteger `develop` y `master`; exigir revisión de otra persona, CI exitoso y prohibir force-push/borrado. Configurar el entorno `production` con aprobación manual de responsables y limitar qué ramas pueden desplegar.
2. **GitHub:** habilitar secret scanning con push protection y code scanning. Revisar periódicamente alertas de Dependabot y rotar cualquier secreto que aparezca en el historial.
3. **VPS:** permitir entrada solo a SSH, HTTP y HTTPS; mantener SSH con llaves, desactivar login root y autenticación por contraseña, y limitar SSH por VPN o IP administrativa cuando sea posible.
4. **VPS:** el usuario de despliegue que pertenece al grupo `docker` equivale a root. Restringir esa llave SSH a un comando de despliegue fijo o reemplazarla por un mecanismo temporal; no reutilizarla para administración interactiva.
5. **VPS:** habilitar actualizaciones de seguridad del sistema, alertas de disco/memoria/CPU y monitoreo externo de disponibilidad. Mantener un procedimiento de recuperación probado.
6. **Base de datos:** automatizar copias cifradas fuera de la VPS, conservar varias generaciones y probar restauraciones periódicamente. El volumen Docker local no protege ante pérdida o compromiso del servidor.
7. **DNS y mitigación DDoS:** activar DNSSEC y CAA en el proveedor DNS. Colocar sitio y API detrás de un WAF/CDN con protección DDoS y limitar el acceso al origen a sus redes. Si se añade un proxy delante de Caddy, configurar sus rangos de confianza antes: la limitación actual depende de que Caddy sea la entrada pública directa.
8. **Cuentas administrativas:** configurar y respaldar `MFA_ENCRYPTION_KEY`, enrolar y comprobar MFA para superadministradores y personal antes de exigirlo como política. Restringir quién puede invitar usuarios y revisar periódicamente cuentas y permisos.
9. **Correo del dominio:** si el dominio envía correo, publicar SPF, DKIM y DMARC con una política gradual hasta `quarantine`/`reject`.

## Estado observado en producción (2026-10-16)

- La página pública y `/api/catalog/products` respondieron `200`; `/actuator/health` respondió `401`, coherente con un endpoint de salud protegido.
- La VPS sirve Ubuntu 22.04.5. Solo Caddy publica puertos `80/443`; frontend, backend y PostgreSQL no tienen puertos de host publicados. En el host también escucha SSH en `22`.
- La cuenta SSH `deploy` autentica con llave y está en el grupo `docker` (equivalente a root). `sudo` solicita contraseña, así que no pude verificar UFW ni la configuración efectiva de `sshd` con esa cuenta.
- El checkout de producción sigue en `develop` (`fb514e6`), distinto de esta rama de seguridad. Dos solicitudes públicas mostraron una CSP sin nonce y con `unsafe-inline` en `script-src`; la CSP nueva de esta rama todavía no está activa en el dominio.
- El dominio y `api` apuntan directamente a la IP de la VPS. La delegación observada es `byte.dns-parking.com` / `pixel.dns-parking.com`; las consultas DNS no encontraron registros CAA ni DS, por lo que no observé CAA ni DNSSEC activos.
- El checkout de producción contiene `backups/` y `deploy/backup-postgres.sh` sin seguimiento por Git. Se conservaron; no se confirmó que las copias salgan de la VPS ni que una restauración funcione.
- La integración de GitHub denegó la lectura de branch protection (`403`) y no hay `gh` CLI instalado. El estado de reglas, secret scanning y aprobaciones de despliegue queda sin verificar; no se deben interpretar como activados.
- Este estado es una captura de `develop@fb514e6`, anterior a los cambios de la rama actual. La cobertura frontend global registrada tras la validación anterior era `21.62%`; el flujo de pedido del cliente y el proxy CSP tienen cobertura dirigida.

## Operación y verificación

- Después de desplegar, comprobar que cada respuesta HTML incluya un nonce distinto en CSP y en los scripts de Next; comprobar que el CSP no contenga `script-src ... unsafe-inline`.
- En el API, verificar que solicitudes mayores a 2 MB reciban `413`, que los endpoints limitados respondan `429` y que las escrituras de sesión sin CSRF sigan recibiendo `403`.
- Después de configurar `MFA_ENCRYPTION_KEY`, enrolar una cuenta de prueba, validar TOTP web/móvil, confirmar que el mismo código TOTP no se puede reutilizar y verificar que cada código de recuperación funciona una sola vez. Respaldar la clave junto con el procedimiento de recuperación.
- Antes de actualizar una imagen fijada, revisar su origen y avisos de seguridad; integrar la nueva digest por cambio revisado y ejecutar CI.
- Mantener una copia de configuración de Caddy y Compose junto con las instrucciones de recuperación, sin incluir `.env.production` ni llaves privadas.
