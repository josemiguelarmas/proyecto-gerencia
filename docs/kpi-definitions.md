# Definición y Formulación de Métricas Operativas (KPIs)

Este documento establece las definiciones matemáticas rigurosas, fórmulas de cálculo, fuentes de datos y criterios de agregación para los Indicadores Clave de Desempeño (KPIs) de **The Clothes Box** (HU-17, SCRUM-106).

---

## 1. Fuentes de Datos y Colecciones

Todas las métricas se calculan a partir de los registros transaccionales almacenados en el repositorio de datos de la plataforma (`backend/database.js` / `backend/repos/store.js`):

| Colección | Entidad | Campos Clave Utilizados |
| :--- | :--- | :--- |
| `subscriptions` | Suscripciones | `userId`, `plan`, `status`, `startedAt`, `cancelledAt`, `history`, `isDemo` |
| `cancellations` | Cancelaciones | `userId`, `plan`, `reason`, `comment`, `createdAt`, `isDemo` |
| `boxes` | Cajas mensuales | `id`, `userId`, `plan`, `cycle`, `status`, `itemIds`, `deliveredAt`, `isDemo` |
| `ratings` | Valoraciones | `id`, `userId`, `boxId`, `productId`, `score`, `fitScore`, `styleScore`, `createdAt`, `isDemo` |
| `returns` | Devoluciones/Cambios | `id`, `userId`, `boxId`, `productId`, `reason`, `status`, `createdAt`, `isDemo` |
| `settings` | Configuración operativa | `churnThreshold`, `ratingThreshold`, `returnsThreshold` |

### Aislamiento de Datos de Demostración (`isDemo`)
Los registros sintéticos generados por utilidades de demostración (`scripts/seed-demo.js`) poseen la bandera `isDemo: true` (o `seedDemo: true`). El motor de métricas permite excluir explícitamente (`excludeDemo: true`) estos registros para garantizar la higiene analítica y que las pruebas o demostraciones comerciales no contaminen las métricas de negocio reales.

---

## 2. Definiciones Matemáticas y Fórmulas

### 2.1 Suscriptores Activos al Inicio del Mes ($A_{inicio}$)
Cantidad de suscriptores únicos cuya suscripción se encontraba activa inmediatamente antes del primer segundo del mes analizado.

$$\text{ActiveAtStart}(M) = |\{ s \in \text{Subscriptions} \mid \text{activeAt}(s, \text{start}(M)) \}|$$

Donde $\text{activeAt}(s, t)$ evalúa el último evento del historial de $s$ anterior al instante $t$; si dicho evento es de tipo `START`, el suscriptor se considera activo.

### 2.2 Suscriptores Activos al Corte ($A_{corte}$)
Cantidad de suscriptores únicos con suscripción activa al momento de la consulta (o al cierre del mes si el mes consultado ya finalizó).

$$\text{ActiveSubscribers}(M) = |\{ s \in \text{Subscriptions} \mid \text{activeAt}(s, \min(\text{now}, \text{end}(M))) \}|$$

### 2.3 Altas del Mes ($N$)
Total de nuevos suscriptores o reactivaciones formalizadas dentro del rango temporal del mes $[ \text{start}(M), \text{end}(M) )$.

$$\text{NewSubscribers}(M) = \sum_{s \in \text{Subscriptions}} |\{ e \in s.\text{history} \mid e.\text{type} = \text{'START'} \land e.\text{at} \in M \}|$$

### 2.4 Bajas / Cancelaciones del Mes ($C$)
Total de suscripciones canceladas dentro del mes analizado.

$$\text{Cancellations}(M) = \sum_{s \in \text{Subscriptions}} |\{ e \in s.\text{history} \mid e.\text{type} = \text{'CANCEL'} \land e.\text{at} \in M \}|$$

### 2.5 Tasa de Deserción Mensual / Churn ($Churn\%$)
Proporción de cancelaciones ocurridas durante el mes respecto a la base de suscriptores activos al inicio del mismo.

$$\text{Churn\%}(M) = \begin{cases} 
\left( \frac{\text{Cancellations}(M)}{\text{ActiveAtStart}(M)} \right) \times 100 & \text{si } \text{ActiveAtStart}(M) > 0 \\ 
\text{null} & \text{si } \text{ActiveAtStart}(M) = 0 
\end{cases}$$

> **Nota:** Si al inicio del mes no había suscriptores activos ($A_{inicio} = 0$), el churn no es matemáticamente representativo y se reporta como `null`.

### 2.6 Calificación Promedio de Satisfacción ($\overline{R}$)
Media aritmética de los puntajes otorgados por los suscriptores a las prendas de cajas correspondientes al mes.

$$\overline{R}(M) = \frac{\sum_{r \in \text{Ratings}(M)} r.\text{score}}{|\text{Ratings}(M)|}$$

- Escala: Enteros de 1 a 5 (donde 1 es insatisfactorio y 5 es excelente).
- Cada calificación individual diferencia `fitScore` (ajuste anatómico) y `styleScore` (afinidad estética).
- Si no existen calificaciones registradas en el mes, el promedio es `null` (en UI: "sin datos").

### 2.7 Tasa de Devoluciones por Talla ($Dev\%$)
Porcentaje de prendas devueltas por motivos de ajuste o talla en relación con el total de prendas efectivamente entregadas en el mes.

$$\text{SizeReturn\%}(M) = \begin{cases} 
\left( \frac{|\text{Returns}(M)|}{\sum_{b \in \text{DeliveredBoxes}(M)} |b.\text{itemIds}|} \right) \times 100 & \text{si prendas entregadas} > 0 \\ 
\text{null} & \text{si no hubo entregas} 
\end{cases}$$

### 2.8 Distribución de Motivos de Cancelación
Agrupación porcentual y conteo absoluto de cancelaciones clasificadas según la encuesta de salida:
- `precio`: "Precio / costo mensual"
- `estilo`: "El estilo de las prendas no acertó"
- `talla`: "Problemas reiterados de talla o confección"
- `tiempo`: "No dispongo de tiempo / exceso de prendas"
- `otro`: "Otro motivo no especificado"
- `unanswered`: Cancelaciones sin selección de motivo.

---

## 3. Umbrales de Alerta Operativa (SCRUM-109)

El sistema evalúa de forma automática si las métricas mensuales superan o descienden de los umbrales de control fijados por la administración:

| Métrica | Umbral por Defecto | Condición de Disparo de Alerta | Acción / Impacto |
| :--- | :--- | :--- | :--- |
| **Churn Mensual** | `9.0 %` | $\text{Churn\%} > \text{churnThreshold}$ | Bandera roja en panel admin; revisión de retención |
| **Satisfacción** | `4.0 / 5.0` | $\overline{R} < \text{ratingThreshold}$ | Alerta operativa; revisión de reglas de estilistas |
| **Devoluciones** | `10.0 %` | $\text{SizeReturn\%} > \text{returnsThreshold}$ | Alerta de inventario; auditoría de tablas de equivalencia |

Los valores de los umbrales son configurables dinámicamente mediante el endpoint administrativo `PUT /api/admin/settings/thresholds`.

---

## 4. Vistas Materializadas y Snapshots Mensuales (SCRUM-107)

Para optimizar el rendimiento y preservar el registro histórico inmutable de los cierres mensuales, el job de ejecución periódica `backend/jobs/kpiSnapshot.js` calcula y persiste instantáneas en la colección `kpiSnapshots`.

### Estructura del Registro en `kpiSnapshots`:
```json
{
  "id": "snap_202610_all_9f3a",
  "month": "2026-10",
  "plan": "all",
  "kpis": {
    "month": "2026-10",
    "plan": "all",
    "activeSubscribers": 142,
    "activeAtStart": 130,
    "newSubscribers": 24,
    "cancellations": 12,
    "churnPct": 9.2,
    "averageRating": 4.6,
    "ratingsCount": 380,
    "sizeReturnPct": 4.1,
    "sizeReturns": 16,
    "deliveredItems": 390,
    "cancellationReasons": { ... },
    "churnAlert": { "threshold": 9, "active": true, "message": "..." },
    "ratingAlert": { "threshold": 4.0, "active": false, "message": null },
    "returnsAlert": { "threshold": 10.0, "active": false, "message": null }
  },
  "ranAt": "2026-11-01T00:00:00.000Z"
}
```
Las instantáneas se consultan vía `GET /api/admin/kpi-snapshots` y se regeneran manualmente o bajo programación mediante `POST /api/admin/kpi-snapshots/run`.
