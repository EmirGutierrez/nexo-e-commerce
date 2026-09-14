# Guía de trabajo de NEXO COMMERCE

Este documento define el trabajo colaborativo del equipo en:

<https://github.com/marce711/nexo-e-commerce>

El Scrum Master coordina tickets, revisiones, merges e integración del producto.

## Flujo oficial

```text
origin/develop → rama personal → pruebas → commit → push → revisión → merge directo a develop → push de develop
```

- `master`: versión estable. No se utiliza para el trabajo diario.
- `develop`: rama principal de integración.
- `feature/*`: rama personal de cada compañero para un ticket o funcionalidad.

No se trabajará con Pull Requests en este proyecto. La integración se realizará mediante revisión y merge directo de la rama personal hacia `develop`.

No se debe modificar directamente `develop` ni `master`. Tampoco se utilizará una rama `main`.

## Preparar el entorno

```bash
git clone https://github.com/marce711/nexo-e-commerce.git
cd nexo-e-commerce
npm install
npm run dev
```

Antes de modificar cualquier archivo:

```bash
git branch --show-current
git status
git fetch origin
```

Confirma que el worktree esté limpio y que el ticket corresponda a la rama en la que vas a trabajar. Si hay cambios locales que no son tuyos, detente y consulta al Scrum Master. No uses `reset --hard` ni sobrescribas cambios existentes.

## Crear una rama personal

Cada ticket debe tener su propia rama creada desde `origin/develop` actualizado:

```bash
git switch develop
git pull origin develop
git switch -c feature/nombre-descriptivo
```

Ejemplos:

- `feature/auth-client-admin`
- `feature/public-store`
- `feature/products`
- `feature/inventory`
- `feature/orders`
- `feature/payments`
- `feature/mobile-expo`

No mezcles tickets, refactors ni mejoras preventivas en una misma rama.

## Alcance estricto

Antes de implementar, analiza el ticket y define qué archivos y capas están involucrados. Implementa únicamente lo solicitado.

No agregues cambios de seguridad, autenticación, CSRF, red, proxy, configuración global, dependencias o infraestructura salvo que el ticket lo solicite explícitamente.

Conserva los cambios locales existentes. No modifiques archivos generados, `dist`, lockfiles o configuraciones si no es estrictamente necesario.

Si la solución requiere salir del alcance del ticket, detente y consulta al Scrum Master.

## Commits y push

Usa commits pequeños y descriptivos:

```text
feat: agrega filtro por categoría
fix: corrige cálculo del total del carrito
refactor: separa servicio de productos
docs: actualiza guía de colaboración
test: valida acceso administrativo
chore: actualiza dependencias
```

Antes de hacer push:

```bash
npm run build
git diff --check
git diff
git status
```

Si todo está correcto:

```bash
git add archivos-relacionados
git commit -m "feat: descripción breve del cambio"
git push -u origin feature/nombre-descriptivo
```

No hagas commits, resets ni reversiones destructivas sin que el Scrum Master lo solicite o autorice.

## Revisión y merge directo a develop

Después del push, informa al Scrum Master:

- Nombre de la rama.
- Ticket atendido.
- Archivos modificados y motivo.
- Pruebas y validaciones ejecutadas.
- Riesgos, decisiones o conflictos pendientes.

El Scrum Master revisará la rama y, desde una copia local controlada, integrará los cambios:

```bash
git fetch origin
git switch develop
git pull origin develop
git merge origin/feature/nombre-descriptivo
git push origin develop
```

La rama personal no debe mergearse si hay conflictos sin resolver, pruebas fallidas o cambios fuera del ticket.

Para actualizar una rama personal antes de la revisión:

```bash
git fetch origin
git switch feature/nombre-descriptivo
git merge origin/develop
npm run build
git push
```

## Resumen del ticket

Cada ticket debe quedar documentado con:

1. Qué se solicitó.
2. Qué archivos y capas se modificaron.
3. Por qué se modificaron.
4. Cómo se probó.
5. Resultado de `npm run build` y validaciones relevantes.
6. Riesgos o pendientes.

## Criterios antes de integrar

- La rama se creó desde `origin/develop` actualizado.
- El cambio está limitado al ticket.
- La compilación termina correctamente.
- Se revisó el diff completo y no hay cambios no relacionados.
- Se probaron las rutas, estados de error, estados vacíos y formularios afectados.
- Se verificó responsive en escritorio y móvil cuando aplique.
- No hay credenciales, tarjetas, CVV, tokens ni datos reales.
- La documentación se actualizó si el ticket introdujo una decisión técnica.
- El Scrum Master realizó la revisión.

## Fases del proyecto

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

Cada fase debe desarrollarse en tickets separados, usando ramas `feature/*` y el flujo de integración directo a `develop` definido arriba.

## Reglas técnicas

- El frontend usa datos ficticios, servicios simulados y estado temporal en memoria mientras no exista backend.
- Los servicios conservan contratos tipados para conectarse posteriormente con Spring Boot.
- La autorización debe validarse visualmente en el frontend y nuevamente en la API futura.
- No se implementan pagos reales en esta etapa.
- La interfaz está en español y usa quetzales con formato `Q 0.00`.
- Las referencias visuales son guías; no se deben copiar dependencias ni código innecesario.
