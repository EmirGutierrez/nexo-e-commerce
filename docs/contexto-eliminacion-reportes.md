# Retiro del módulo de Reportes

## Solicitud

Eliminar completamente Reportes para que ninguna vista del área privada permita encontrarlo o abrirlo.

## Cambios realizados

- Se quitó el acceso de Reportes del menú privado, los rótulos del panel, la ruta inicial por rol y la configuración del CRUD genérico.
- El acceso directo a `/admin/reports` ahora redirige a `/admin/dashboard` y no renderiza la vista antigua.
- Se eliminó `reports` del tipo de módulos de permisos, de la matriz mostrada por Roles y permisos, y de los permisos predeterminados del frontend.
- Se retiraron las conversiones de datos de Reportes del cliente de servicios.
- Spring Boot dejó de registrar `reports` como recurso admitido y se eliminó el generador de informes.
- Se restauraron a `src` las migraciones V13, V14 y V15 que ya estaban aplicadas en la base local (SKU/comprador de inventario, portal de cliente y notificaciones). La migración Flyway `V16__remove_reports_module.sql` borra registros y permisos existentes de Reportes y actualiza la restricción de módulos permitidos.
- Se actualizaron `README.md`, `AGENTS.md` y el prompt de permisos archivado para que la documentación refleje el retiro.

## Capas revisadas

Se revisaron las guías Markdown del repositorio, las rutas del App Router, la navegación y autorización visual del panel, el módulo CRUD compartido, los tipos y servicios de permisos, los servicios de datos de administración, el recurso Spring de registros de negocio y las migraciones PostgreSQL.

## Validación

- `npm run build`: correcto, incluye verificación de tipos y generación de páginas.
- `mvn -q -DskipTests compile` en `backend/`: correcto.
- `git diff --check`: correcto.
- La primera ejecución de `mvn spring-boot:run` encontró migraciones antiguas en `target/classes` y duplicados de versión. La base ya tenía V13–V15 aplicadas, así que se restauraron sus archivos fuente y se asignó V16 a Reportes.
- `mvn clean spring-boot:run`: correcto. Flyway validó las 16 migraciones, aplicó V16 y Spring Boot quedó iniciado en el puerto 8080. El proceso de verificación se detuvo después del arranque.
