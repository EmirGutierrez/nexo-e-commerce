# Guía de trabajo de NEXO COMMERCE

Este documento define cómo debe colaborar el equipo en el repositorio:

<https://github.com/marce711/nexo-e-commerce>

La persona responsable de priorizar, revisar y coordinar la integración es el Scrum Master del proyecto.

## Estrategia de ramas

```text
feature/*  →  develop  →  master
```

- `master`: versión estable y lista para producción.
- `develop`: rama principal de integración del equipo.
- `feature/*`: rama individual para una funcionalidad, mejora o corrección.

No se debe trabajar directamente sobre `master` ni `develop`.

Ejemplos de nombres:

- `feature/frontend-foundation`
- `feature/auth-client-admin`
- `feature/public-store`
- `feature/admin-dashboard`
- `feature/products`
- `feature/inventory`
- `feature/orders`
- `feature/payments`
- `feature/mobile-expo`

## Preparar el entorno

```bash
git clone https://github.com/marce711/nexo-e-commerce.git
cd nexo-e-commerce
npm install
npm run dev
```

Antes de trabajar, revisar siempre la rama y el estado:

```bash
git branch --show-current
git status
git fetch origin
```

Si existen cambios locales que no son tuyos, detente y consulta al Scrum Master. No uses `reset --hard` ni sobrescribas archivos sin autorización.

## Crear una rama de trabajo

Todas las ramas feature deben crearse desde la versión actualizada de `develop`:

```bash
git switch develop
git pull origin develop
git switch -c feature/nombre-descriptivo
```

Una rama debe concentrarse en una sola funcionalidad. Mantén los cambios pequeños y evita mezclar refactorizaciones no relacionadas.

## Commits

Usar mensajes claros y descriptivos, preferiblemente con esta convención:

```text
feat: agrega filtro por categoría
fix: corrige cálculo del total del carrito
refactor: separa servicio de productos
docs: actualiza guía de colaboración
test: valida acceso administrativo
chore: actualiza dependencias
```

Antes de confirmar:

```bash
npm run build
git diff --check
git status
```

## Pull Requests

El flujo obligatorio es:

1. Actualizar la rama feature con `develop`.
2. Ejecutar compilación y pruebas.
3. Hacer push de la rama feature.
4. Abrir un Pull Request desde `feature/*` hacia `develop`.
5. Esperar la revisión y aprobación del Scrum Master.
6. Resolver observaciones y actualizar el mismo Pull Request.
7. Integrar a `develop` únicamente cuando la revisión esté completa.
8. Promover `develop` a `master` mediante otro Pull Request cuando la versión esté validada.

```bash
git add .
git commit -m "feat: descripción breve del cambio"
git push -u origin feature/nombre-descriptivo
```

El Pull Request debe explicar qué cambió, cómo probarlo, qué rutas o módulos fueron afectados y adjuntar capturas cuando el cambio sea visual.

Para actualizar una feature antes de solicitar revisión:

```bash
git fetch origin
git switch feature/nombre-descriptivo
git merge origin/develop
npm run build
git push
```

Si el merge presenta conflictos, resuélvelos con cuidado y solicita apoyo al Scrum Master si el conflicto afecta otra funcionalidad.

## Configuración recomendada para el Scrum Master

En GitHub, configura reglas para `develop` y `master` que:

- Requieran Pull Request antes de integrar.
- Requieran al menos una revisión aprobada.
- Requieran que los checks de compilación pasen.
- Bloqueen push directo, force push y eliminación de la rama.
- Exijan resolver conversaciones antes de fusionar.

El Scrum Master revisa alcance, calidad, pruebas, conflictos y cumplimiento de la arquitectura antes de aprobar.

## Criterios antes de integrar

- La rama parte de `develop` actualizado.
- La compilación `npm run build` termina correctamente.
- Las rutas nuevas y existentes funcionan.
- Se probaron estados de carga, error, vacío y éxito cuando corresponda.
- La interfaz funciona en escritorio y móvil.
- No hay credenciales, tarjetas, CVV, tokens reales ni datos personales reales.
- No se agregan dependencias o archivos generados innecesarios.
- La funcionalidad está documentada si introduce una decisión técnica nueva.
- El Pull Request tiene revisión aprobada.

## Orden de desarrollo por fases

1. Frontend web con React, Vite, TypeScript, Tailwind CSS, React Router y lucide-react.
2. Acceso dividido entre Cliente y Administrador.
3. Tienda pública.
4. Panel de Súper Administrador.
5. Roles y permisos.
6. Productos, pedidos, ventas e inventario.
7. Pagos simulados y verificación de transferencias.
8. Aplicación móvil con React Native y Expo Go.
9. Backend con Spring Boot y Spring Security.
10. Integración con APIs y base de datos.

Cada fase debe desarrollarse en una o más ramas feature, validarse y luego integrarse mediante Pull Request.

## Reglas técnicas del proyecto

- El frontend usa datos ficticios, servicios simulados y estado temporal en memoria mientras no exista backend.
- Los servicios deben conservar contratos tipados que puedan conectarse posteriormente con Spring Boot.
- La autorización debe implementarse visualmente en el frontend y volver a validarse en la API futura.
- No se implementan pagos reales en esta etapa.
- El idioma de la interfaz es español y los precios usan quetzales con formato `Q 0.00`.
- Las referencias visuales y prototipos son guías; no se deben copiar dependencias ni código innecesario.
