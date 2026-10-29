# Validación responsive del Dashboard

El layout del Dashboard usa columnas con `minmax(0, 1fr)` para que los valores, paneles y gráficos puedan encogerse sin crear desbordamiento horizontal. La suite `responsiveDashboardStyles.test.ts` verifica que las reglas de los breakpoints estén presentes para estas anchuras:

| Ancho | Métricas | Gráficos y paneles |
| ---: | --- | --- |
| 320 px | Una columna | Una columna |
| 375 px | Dos columnas | Una columna |
| 768 px | Dos columnas | Una columna |
| 1024 px | Dos columnas | Una columna |
| 1280 px | Cuatro columnas | Dos columnas |

La comprobación disponible en este repositorio es estática: Vitest corre en Node/jsdom y no hay un navegador de pruebas configurado. Confirma los breakpoints y reglas flexibles; no sustituye capturas visuales del Dashboard renderizado. Antes de dar el diseño por verificado visualmente, hay que abrir el panel autenticado a esos cinco anchos y comprobar que no haya scroll horizontal, textos cortados ni controles difíciles de usar.
