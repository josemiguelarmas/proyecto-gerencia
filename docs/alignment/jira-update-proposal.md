# Propuesta de Actualización del Tablero Jira
**Proyecto:** The Clothes Box  
**Rama:** `integration/jira-alignment`  
**Fecha:** 2026-11-12  

---

## 1. Principio Rector

De acuerdo con las directrices de alineación, **ninguna historia de usuario ni subtarea se degrada o mueve hacia abajo** en el tablero de Jira. Esta propuesta presenta únicamente transiciones ascendentes (**"Por hacer" $\to$ "En curso" / "En revisión" $\to$ "Finalizado"**) que se encuentran estrictamente respaldadas por código fuente en funcionamiento en la aplicación servida y cubiertas por pruebas automáticas capaces de fallar en la suite de pruebas.

---

## 2. Historias de Usuario (HU) y Subtareas para Transición

### 2.1 Historias con Cumplimiento Total para Transición a **Finalizado**

| Clave HU | Nombre de la Historia | Estado Anterior en Jira | Estado Propuesto | Justificación y Evidencia en Código |
| :--- | :--- | :--- | :--- | :--- |
| **HU-01** | Registro y acceso | En revisión | **Finalizado** | Validador central en `backend/lib/validate.js`, contraseñas con `scrypt`, tokens con revocación en servidor, verificación de correo y flujo de reseteo. Pruebas: `tests/accounts.test.js`. |
| **HU-02** | Consentimiento informado | En revisión | **Finalizado** | Consulta de política en `GET /api/policy`, casilla no premarcada, auditoría en `consents` con versión y timestamp. Pruebas: `tests/accounts.test.js`. |
| **HU-03** | Quiz de estilo interactivo | En curso | **Finalizado** | Banco de 8 preguntas en seed JSON, progreso guardado en `PUT /api/quiz/progress`, validación de pesos normalizados, integración a perfil versionado y protocolo en `docs/usability-test-protocol.md`. Pruebas: `tests/quiz-stylist.test.js`. |
| **HU-04** | Perfil antropométrico y equivalencias | Finalizado | **Finalizado (Confirmado)** | Captura con guía visual SVG, validación de rangos 422 en backend, tabla de equivalencias por marca en seed JSON y cifrado en reposo con AES-256-GCM. Pruebas: `tests/accounts.test.js`. |
| **HU-05** | Catálogo con stock por variante | En curso | **Finalizado** | Variantes con stock por talla/color, importación CSV hasta 2 MB, disponibilidad en panel admin, auditoría en `inventoryMovements` y contrato de datos en `docs/data-contract-brands.md`. Pruebas: `tests/catalog.test.js`. |
| **HU-06** | Motor de recomendación de outfits | En curso | **Finalizado** | Generación de outfits combinados, 100% de cumplimiento de restricciones duras, explicación persistida de recomendaciones, reglas versionadas y script de evaluación `npm run eval`. Pruebas: `tests/engine.test.js`. |
| **HU-07** | Validación del estilista | En curso | **Finalizado** | Cola de revisión en `GET /api/stylist/boxes`, permisos de rol `STYLIST`, sustitución de prendas, aprobación con motivo y generación de ejemplos de aprendizaje en `corrections`. Pruebas: `tests/quiz-stylist.test.js`. |
| **HU-08** | Plan y pasarela de pago | En curso | **Finalizado** | Tokenización en cliente (cero datos de tarjeta en servidor), webhook firmado con HMAC, reintentos de cobro (1, 3, 5 días), conciliación automática y simulación con `tok_ok`/`tok_declined`. Pruebas: `tests/billing.test.js`. |
| **HU-09** | Despacho y seguimiento logístico | Finalizado | **Finalizado (Confirmado)** | Guardas de aprobación previa (409), captura manual de transportadora y guía, descuento automático de stock (`DISPATCH_OUT`), checklist de picking con empaque sostenible y correo transaccional. Pruebas: `tests/fulfillment.test.js`. |
| **HU-10** | Calificación de prendas | Finalizado | **Finalizado (Confirmado)** | Calificación entera de 1 a 5, separación de `fitScore` y `styleScore`, integración a aprendizaje del motor y cálculo real de satisfacción sin default silencioso de 4.0. Pruebas: `tests/fulfillment.test.js`. |
| **HU-11** | Reentrenamiento del motor por feedback | En curso | **Finalizado** | Ingesta de eventos a `feedbackEvents`, regla acotada de actualización de pesos de atributos, evaluación comparativa antes/después y gestión de versiones de modelo. Pruebas: `tests/engine.test.js`. |
| **HU-12** | Gestión de suscripción (pausa y cambio) | Finalizado | **Finalizado (Confirmado)** | Matriz estricta de 5 estados y 7 acciones, pausa por 1 mes, cambio de plan con regla de corte del día 25 y avisos transaccionales. Pruebas: `tests/subscription.test.js`. |
| **HU-13** | Cancelación y encuesta de salida | Finalizado | **Finalizado (Confirmado)** | Flujo de retención con oferta previa de pausa, cancelación con confirmación explícita, encuesta de salida opcional y reporte admin de motivos. Pruebas: `tests/subscription.test.js`. |
| **HU-14** | Devolución y cambio por talla | En curso | **Finalizado** | Política en `docs/return-policy.md`, cálculo de 5 días hábiles descontando festivos oficiales colombianos 2026, generación de guía inversa en HTML imprimible, reingreso a stock y métricas por marca. Pruebas: `tests/fulfillment.test.js`. |
| **HU-15** | Facturación electrónica DIAN | En curso | **Finalizado** | Emisión automática tras pago aprobado, captura de datos fiscales, cola de reintentos (`PENDING_RETRY` $\to$ `FAILED`) con alertas a operaciones y visor de factura imprimible. Pruebas: `tests/invoicing.test.js`. |
| **HU-16** | Derechos del titular (Ley 1581) | En curso | **Finalizado** | Rectificación de nombre y correo, exportación de datos personales en JSON (`GET /api/me/export`), supresión con verificación de contraseña y bloqueo por cobro pendiente, y registro administrativo de solicitudes. Pruebas: `tests/accounts.test.js`. |
| **HU-17** | Tablero de KPIs y métricas | Finalizado | **Finalizado (Confirmado)** | Definiciones matemáticas en `docs/kpi-definitions.md`, job de materialización en `kpi_snapshots`, filtros por mes y plan, umbrales editables en settings (churn 9%, rating 4.0, returns 10%) con alertas, y prueba de humo integral `tests/e2e.smoke.test.js`. Pruebas: `tests/kpis.test.js`, `tests/e2e.smoke.test.js`. |

---

## 3. Subtareas Específicas para Cierre

Todas las subtareas asociadas que se encontraban en "Por hacer" o "En curso" en Jira cuentan ahora con código verificado y pruebas que las respaldan:
- **SCRUM-26 a SCRUM-31 (Quiz y Usabilidad):** `Finalizado`.
- **SCRUM-38 a SCRUM-42 (Catálogo e Inventario):** `Finalizado`.
- **SCRUM-44 a SCRUM-49 (Recomendador y Restricciones Duras):** `Finalizado`.
- **SCRUM-51 a SCRUM-55 (Cola de Estilistas y Entrenamiento):** `Finalizado`.
- **SCRUM-57 a SCRUM-62 (Pasarela, Tokenización y Conciliación):** `Finalizado`.
- **SCRUM-64 a SCRUM-68 (Despacho, Packing y Transportadoras):** `Finalizado`.
- **SCRUM-70 a SCRUM-73 (Calificación y Satisfacción):** `Finalizado`.
- **SCRUM-75 a SCRUM-78 (Feedback y Model Versions):** `Finalizado`.
- **SCRUM-83 y SCRUM-87 (Pausa previa y Encuesta Opcional):** `Finalizado`.
- **SCRUM-90 a SCRUM-94 (Devoluciones y Festivos Colombia):** `Finalizado`.
- **SCRUM-96 a SCRUM-99 (Facturación Electrónica y Reintentos):** `Finalizado`.
- **SCRUM-101 y SCRUM-102 (Rectificación y Supresión de Cuenta):** `Finalizado`.
- **SCRUM-105 a SCRUM-109 (KPIs, Snapshots, Umbrales y E2E Smoke Test):** `Finalizado`.

---

## 4. Elementos Fuera de Alcance

- **HU-18 y HU-19 (Could / Post-piloto):** Permanecen en su estado original en Jira ("Por hacer"), ya que fueron clasificadas fuera del alcance del MVP y del cierre del Sprint 2.
