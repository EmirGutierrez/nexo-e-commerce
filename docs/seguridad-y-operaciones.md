# Seguridad y operaciones de producción

## Controles aplicados en el repositorio

- Next genera un nonce CSP aleatorio por respuesta HTML. Los scripts en línea ya no se autorizan con `unsafe-inline`; las páginas se renderizan por solicitud para poder asignar el nonce, por lo que dejan de servirse como HTML estático.
- Caddy limita cada cuerpo HTTP a 2 MB y aplica topes de tiempo/tamaño a cabeceras y cargas. El BFF de Next vuelve a medir el cuerpo, mantiene máximo 32 lecturas simultáneas por proceso y rechaza cuerpos mayores a 2 MB. Los comprobantes de transferencia existentes admiten hasta 1 MB.
- La API limita por IP cada 10 minutos: 10 intentos de login web/móvil combinados, 8 registros, 10 canjes de invitación, 60 validaciones de descuento, 80 cotizaciones y 12 pedidos. Las IPv6 se agrupan por prefijo `/64`. El límite vive en memoria y protege una instancia; no sustituye un WAF ni una limitación distribuida si se escala.
- Los intentos fallidos ya no bloquean automáticamente una cuenta conocida. Eso evita que cualquiera pueda bloquear a un administrador con cinco contraseñas incorrectas; el límite por IP reduce la fuerza bruta básica.
- Los passwords nuevos se limitan a 72 bytes UTF-8 para evitar la truncación propia de BCrypt; los antiguos siguen autenticándose con el comportamiento que tenían.
- Las sesiones web tienen 30 minutos de inactividad y un máximo absoluto de 8 horas. La sesión se invalida en el servidor al vencer.
- La exención CSRF por Bearer solo cubre rutas `/api/mobile/**`. El resto de las escrituras conserva la validación CSRF.
- Las imágenes base de contenedores y las acciones de GitHub Actions usan digests/SHA completos. Dependabot revisa semanalmente paquetes, imágenes y acciones.
- Los contenedores de producción usan `no-new-privileges`, eliminan capacidades innecesarias y limitan la rotación de logs. Backend y Caddy usan un sistema de archivos raíz de solo lectura.

## Riesgos de aplicación aún abiertos

- Un pedido público descuenta existencias al crearse. Los pedidos de transferencia pendientes no vencen automáticamente ni liberan stock; una red de bots distribuida puede agotar el inventario aunque exista límite por IP. Definir un plazo comercial y una regla segura para liberar existencias; no cancelar automáticamente hasta acordar ese plazo porque podría haber transferencias legítimas aún no revisadas.
- La limitación por IP vive en memoria de cada instancia. Al escalar a varias instancias se debe mover a un WAF o almacén compartido; una botnet también puede repartir intentos entre direcciones.
- El login no exige MFA. Para proteger superadministradores, MFA sigue siendo una mejora prioritaria que requiere flujo de enrolamiento, recuperación y soporte.
- El CSP ya bloquea scripts en línea sin nonce, pero conserva `style-src-attr 'unsafe-inline'` por los estilos en línea usados por la interfaz. Migrar esos estilos a clases antes de quitar esa excepción.
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
8. **Cuentas administrativas:** exigir MFA para superadministradores y personal, restringir quién puede invitar usuarios y revisar periódicamente cuentas y permisos. La aplicación todavía no implementa un segundo factor.
9. **Correo del dominio:** si el dominio envía correo, publicar SPF, DKIM y DMARC con una política gradual hasta `quarantine`/`reject`.

## Operación y verificación

- Después de desplegar, comprobar que cada respuesta HTML incluya un nonce distinto en CSP y en los scripts de Next; comprobar que el CSP no contenga `script-src ... unsafe-inline`.
- En el API, verificar que solicitudes mayores a 2 MB reciban `413`, que los endpoints limitados respondan `429` y que las escrituras de sesión sin CSRF sigan recibiendo `403`.
- Antes de actualizar una imagen fijada, revisar su origen y avisos de seguridad; integrar la nueva digest por cambio revisado y ejecutar CI.
- Mantener una copia de configuración de Caddy y Compose junto con las instrucciones de recuperación, sin incluir `.env.production` ni llaves privadas.
