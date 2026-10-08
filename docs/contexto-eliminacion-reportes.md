# Retiro del módulo de Reportes

## Solicitud

Eliminar completamente Reportes para que ninguna vista del área privada permita encontrarlo o abrirlo.

## Cambios realizados

- Se quitó el acceso de Reportes del menú privado, los rótulos del panel, la ruta inicial por rol y la configuración del CRUD genérico.
- El acceso directo a `/admin/reports` ahora redirige a `/admin/dashboard` y no renderiza la vista antigua.
- Se eliminó `reports` del tipo de módulos de permisos, de la matriz mostrada por Roles y permisos, y de los permisos predeterminados del frontend.
- Se retiraron las conversiones de datos de Reportes del cliente de servicios.
- Spring Boot dejó de registrar `reports` como recurso admitido y se eliminó el generador de informes.
- Las migraciones Flyway V13–V15 conservan el portal de cliente, su lista de deseos, los pedidos vinculados a la cuenta y las notificaciones. La migración V16 borra los registros y permisos existentes de Reportes y actualiza la restricción de módulos permitidos.
- Se actualizaron `README.md`, `AGENTS.md` y el prompt de permisos archivado para que la documentación refleje el retiro.

## Capas revisadas

Se revisaron las guías Markdown del repositorio, las rutas del App Router, la navegación y autorización visual del panel, el módulo CRUD compartido, los tipos y servicios de permisos, los servicios de datos de administración, el recurso Spring de registros de negocio y las migraciones PostgreSQL.

## Validación

- La compilación del frontend y las pruebas unitarias de backend se ejecutaron después de integrar este cambio.
- `git diff --check` se verificó antes de cerrar la integración.
- No se aplicaron migraciones contra una base de datos como parte de esta integración; Flyway las ejecutará al iniciar Spring Boot.
