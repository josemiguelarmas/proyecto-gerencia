# Definiciones de KPIs (borrador)

Esqueleto para que el equipo valide las fórmulas. Describe lo que hoy calcula `computeKpis` en `backend/metrics.js` (HU-17) para un mes y un plan. El stream E2 completa este documento.

| KPI | Fórmula actual | Notas |
|---|---|---|
| Suscriptores activos | Suscripciones cuyo último evento antes del corte del mes es un alta. | El corte es el fin del mes o hoy, lo que ocurra primero. |
| Activos al inicio | Igual, al primer día del mes. | Denominador del churn. |
| Altas | Eventos `START` dentro del mes. | |
| Cancelaciones | Eventos `CANCEL` dentro del mes. | |
| Churn % | Cancelaciones / activos al inicio × 100, con un decimal. | Sin activos al inicio no se calcula. Alerta si supera el umbral (9 % por defecto, editable en el panel). |
| Calificación promedio | Promedio de `score` de las calificaciones creadas en el mes. | |
| % de devoluciones por talla | Devoluciones creadas en el mes / prendas de cajas entregadas en el mes × 100. | El numerador y el denominador no siempre son del mismo ciclo. Pendiente de validar. |
| Motivos de cancelación | Conteo por motivo de la encuesta de salida, más los que no respondieron. | |

## Pendiente de definir con el equipo

- Si el churn debe contar las pausas.
- Ventana de las devoluciones (por mes de creación o por mes de entrega de la caja).
- Metas por KPI y cuáles se reportan al curso.
- Snapshot mensual (tarea F7) para que los meses cerrados no cambien.
