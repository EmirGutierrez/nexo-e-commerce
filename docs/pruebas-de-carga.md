# Monitoreo y pruebas con k6, Prometheus y Grafana

La instrumentación cubre el backend local y el despliegue de producción. Spring Boot exporta métricas HTTP, JVM y del pool PostgreSQL; Prometheus las recoge y Grafana carga dos dashboards: **NEXO · Backend** y **NEXO · Pruebas k6**. k6 consulta únicamente `GET /store` y envía los resultados mediante Prometheus remote write.

## Ejecutar localmente

1. Configura `backend/.env` según [backend/README.md](../backend/README.md) y levanta la tienda:

   ```powershell
   docker compose up --build -d
   ```

2. Inicia Prometheus y Grafana:

   ```powershell
   docker compose --profile monitoring up -d prometheus grafana
   ```

3. Ejecuta la prueba local de rampa de 1 a 5 usuarios virtuales:

   ```powershell
   docker compose --profile monitoring --profile loadtest run --rm k6
   ```

Abre Grafana en `http://localhost:13001` con el usuario `admin` y la contraseña local `nexo-local-only`. Para cambiarla, define `GRAFANA_ADMIN_PASSWORD` antes de iniciar Compose. Prometheus está en `http://localhost:19090`. El endpoint local de métricas se sirve en `http://localhost:18080/actuator/prometheus`; el puerto del host queda ligado a loopback.

En **NEXO · Backend** verás el estado del scrape, solicitudes por método y ruta, latencias p95/p99, errores 5xx, heap/CPU/hilos de Java y conexiones/espera del pool PostgreSQL. En **NEXO · Pruebas k6**, usa **Test ID** para elegir una ejecución; por defecto se muestran todas las que están dentro del rango de tiempo. Los percentiles de k6 se conservan como datos históricos y Grafana los formatea en milisegundos.

### Probar la tienda de producción desde el equipo local

Con Prometheus y Grafana locales en ejecución, esta prueba breve apunta a producción y guarda sus resultados solo en el Prometheus local. Usa un identificador distinto en cada ejecución:

```powershell
docker compose --profile monitoring --profile loadtest run --rm `
  -e BASE_URL=https://nexo-e-commerce.com `
  -e K6_PROFILE=production `
  -e TEST_ID=nexo-prod-manual-01 `
  -e K6_PROMETHEUS_RW_LABELS=environment=production k6
```

El perfil `production` tiene un máximo de dos usuarios virtuales durante 40 segundos y solo solicita `GET /store`. Luego, en Grafana local, selecciona `nexo-prod-manual-01` en **Test ID**. Esta ejecución mide navegador/Cloudflare/red hasta la tienda; no recoge heap, CPU ni conexiones de la instancia productiva. Esas métricas aparecen en el Grafana de producción después de desplegar esta integración.

## Activar en producción

Antes del próximo despliegue, el archivo privado `/opt/nexo-commerce/deploy/.env.production` en la VPS debe tener dos valores nuevos. Genéralos en la VPS y guárdalos directamente en ese archivo; no los añadas al repositorio ni los compartas en mensajes:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

El primer resultado va en `PROMETHEUS_SCRAPE_TOKEN` y el segundo en `GRAFANA_ADMIN_PASSWORD`. También puede definirse `GRAFANA_ADMIN_USER`; si se omite, será `admin`. Protege el archivo con permisos `600`.

Al desplegar la rama `develop` desde Actions y aprobar el entorno `production`, Compose inicia Prometheus y Grafana. El workflow ejecuta después un smoke test de 40 segundos, con un máximo de dos usuarios virtuales, dentro de la red privada de la VPS. Solo solicita la tienda; no crea pedidos ni modifica datos. Las métricas aparecen en Grafana en:

```text
https://<SITE_DOMAIN>/monitoring/
```

Inicia sesión con el usuario y la contraseña de Grafana configurados en la VPS. El puerto de Prometheus no se publica. Spring atiende métricas en el puerto interno 8081 y exige `PROMETHEUS_SCRAPE_TOKEN`; Caddy no enruta ese endpoint. Prometheus conserva siete días de métricas y Grafana guarda sus datos en volúmenes persistentes.

El smoke test de producción mide la aplicación en la red interna de Docker, no la latencia de Cloudflare ni la de la conexión del usuario. El workflow ya comprueba aparte que la web y la API públicas responden.

## Revisar resultados

- En **NEXO · Backend**, el indicador **Backend** debe ser `ACTIVO`; los paneles muestran solicitudes, latencia p95/p99, errores 5xx, recursos JVM y uso del pool DB.
- En **NEXO · Pruebas k6**, selecciona el `testid` de la ejecución. La tienda debe responder 200, la tasa de error ser 0 % y los checks estar al 100 %.
- El output `experimental-prometheus-rw` de k6 aún es experimental; la imagen queda fijada para evitar cambios inesperados.

## Detener servicios locales

La ejecución de k6 termina por sí sola. Para detener Prometheus y Grafana sin parar la tienda ni borrar los datos:

```powershell
docker compose --profile monitoring stop prometheus grafana
```

No uses `docker compose down -v`: también borraría el volumen de PostgreSQL y los volúmenes locales de monitoreo.
