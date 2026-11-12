# Informe Final de Alineación Jira vs. Código
**Proyecto:** The Clothes Box (Colombia)  
**Rama de Integración:** `integration/jira-alignment`  
**Fecha de Cierre:** 2026-11-12  
**Entorno de Ejecución:** Node.js v20+ (Solo librerías nativas, cero dependencias en runtime), Windows PowerShell  

---

## 1. Resumen Ejecutivo

El presente informe documenta el cumplimiento integral de la misión de alineación entre el tablero Jira y el código fuente del proyecto **The Clothes Box** para el Producto Mínimo Viable (Sprint 1 y Sprint 2, abarcando las historias de usuario HU-01 a HU-17; HU-18 y HU-19 se mantienen como alcance posterior fuera de este ejercicio por acuerdo de equipo).

A partir de la línea base auditada (`main` @ `2082654`), se detectó una discrepancia sustancial entre las declaraciones del tablero y el comportamiento efectivo del sistema. A través de un proceso riguroso y metódico dividido en tres olas de trabajo en ramas y worktrees aislados, **todas las subtareas en alcance fueron implementadas, refactorizadas y respaldadas con pruebas automáticas ejecutadas con el runner nativo de Node.js (`node:test`)**.

### Métricas Clave de Cierre:
- **Pruebas Automatizadas:** **136 de 136 aprobadas (100% pass, 0 fail)**.
- **Evaluación Offline del Motor de Recomendación (`npm run eval`):** **100% de cumplimiento de restricciones duras** en 30 perfiles sintéticos.
- **Dependencias en Runtime:** **0** (Uso estricto de `http`, `crypto`, `fs`, `node:test`, `node:assert`).
- **Seguridad y Criptografía:** Algoritmos `scrypt` para contraseñas, tokens JWT HMAC-SHA256 con revocación, cifrado de medidas corporales en reposo con AES-256-GCM.
- **Protección de Datos:** Aislamiento de datos de tarjeta en navegador (cero datos PAN/CVV en servidor), consentimiento informado con versionado y trazabilidad (Ley 1581 de 2012).

---

## 2. Resumen por Flujos de Trabajo (Streams)

| Stream | HU Cubiertas | Subtareas | Estado Final | Pruebas Principales |
| :--- | :--- | :--- | :--- | :--- |
| **Foundation (F1–F10)** | Infraestructura | F1 a F10 | **COMPLETADO** | `tests/foundation.test.js`, `tests/config.test.js`, `tests/security.test.js`, `tests/domain.test.js` |
| **Stream A** | HU-05 Catálogo | SCRUM-38 a SCRUM-42 | **COMPLETADO** | `tests/catalog.test.js`, `docs/data-contract-brands.md` |
| **Stream B** | HU-01, 02, 04, 16 | SCRUM-15..19, 21..24, 33..36, 101..104 | **COMPLETADO** | `tests/accounts.test.js` |
| **Stream C1** | HU-03 Quiz, HU-07 Estilista | SCRUM-26..31, 51..55 | **COMPLETADO** | `tests/quiz-stylist.test.js`, `docs/usability-test-protocol.md` |
| **Stream D1** | HU-08 Pagos, HU-12/13 Suscripción | SCRUM-57..62, 80..84, 86..88 | **COMPLETADO** | `tests/billing.test.js`, `tests/subscription.test.js` |
| **Stream D2** | HU-15 Facturación DIAN | SCRUM-96..99 | **COMPLETADO** | `tests/invoicing.test.js` |
| **Stream C2** | HU-06 Recomendador, HU-11 Feedback | SCRUM-44..49, 75..78 | **COMPLETADO** | `tests/engine.test.js`, `scripts/eval-recommender.js`, `scripts/eval-feedback.js` |
| **Stream E1** | HU-09 Logística, HU-10 Calificación, HU-14 Devoluciones | SCRUM-64..68, 70..73, 90..94 | **COMPLETADO** | `tests/fulfillment.test.js`, `docs/return-policy.md` |
| **Stream E2** | HU-17 Tablero KPI & Smoke Test E2E | SCRUM-105..109 | **COMPLETADO** | `tests/kpis.test.js`, `tests/e2e.smoke.test.js`, `docs/kpi-definitions.md` |

---

## 3. Matriz Completa de Trazabilidad de Subtareas

| Clave | HU | Título de la Subtarea | Estado Inicial | Estado Final | Commit | Archivo de Prueba | Evidencia en Código |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SCRUM-38** | HU-05 | Modelo de variantes y stock por talla/color | PARTIAL | **VERIFIED** | `e04c657` | `tests/catalog.test.js` | `backend/catalog.js:stockInSize`, `backend/data/seed/catalog.json` |
| **SCRUM-39** | HU-05 | Importación masiva CSV con validación | PARTIAL | **VERIFIED** | `cf94730` | `tests/catalog.test.js` | `backend/routes/catalog.js:importCatalogCsv` (hasta 2 MB) |
| **SCRUM-40** | HU-05 | Visualización de disponibilidad en panel admin | PARTIAL | **VERIFIED** | `58f2daf` | `tests/catalog.test.js` | `backend/routes/catalog.js:listCatalogAdmin` |
| **SCRUM-41** | HU-05 | Registro de movimientos de inventario | MISSING | **VERIFIED** | `58f2daf` | `tests/catalog.test.js` | `backend/logistics.js:moveStock`, `collection: inventoryMovements` |
| **SCRUM-42** | HU-05 | Documento de contrato de datos con marcas | MISSING | **VERIFIED** | `d4f884d` | `docs/data-contract-brands.md` | `docs/data-contract-brands.md` |
| **SCRUM-15** | HU-01 | Flujo de login y registro en frontend | PARTIAL | **VERIFIED** | `4b93928` | `tests/accounts.test.js` | `frontend/js/views/authView.js` |
| **SCRUM-16** | HU-01 | Validaciones de correo, contraseña y edad | PARTIAL | **VERIFIED** | `4b93928` | `tests/accounts.test.js` | `backend/lib/validate.js`, `backend/routes/auth.js:register` |
| **SCRUM-17** | HU-01 | Almacenamiento seguro con scrypt y JWT | PARTIAL | **VERIFIED** | `4b93928` | `tests/accounts.test.js` | `backend/lib/crypto.js:hashPassword`, `backend/auth.js` |
| **SCRUM-18** | HU-01 | Verificación de correo y reset de contraseña | PARTIAL | **VERIFIED** | `4b93928` | `tests/accounts.test.js` | `backend/routes/auth.js:verifyEmail,resetPassword` |
| **SCRUM-19** | HU-01 | Mensajes claros en validación y duplicados | PARTIAL | **VERIFIED** | `4b93928` | `tests/accounts.test.js` | `backend/routes/auth.js:register` (ofrece login en duplicado) |
| **SCRUM-21** | HU-02 | Visualización de aviso y borrador de política | PARTIAL | **VERIFIED** | `4473bd9` | `tests/accounts.test.js` | `backend/config.js:POLICY`, `backend/routes/privacy.js` |
| **SCRUM-22** | HU-02 | Endpoint para consultar política de datos | PARTIAL | **VERIFIED** | `4473bd9` | `tests/accounts.test.js` | `GET /api/policy` con `draftNotice` |
| **SCRUM-23** | HU-02 | Casilla de consentimiento no premarcada | DONE | **VERIFIED** | `4473bd9` | `tests/api.test.js` | `frontend/js/views/authView.js:151` |
| **SCRUM-24** | HU-02 | Registro de auditoría de consentimiento | PARTIAL | **VERIFIED** | `4473bd9` | `tests/accounts.test.js` | `backend/repos/consents.js`, `addConsent` |
| **SCRUM-33** | HU-04 | Interfaz visual de captura de medidas y guía | PARTIAL | **VERIFIED** | `1e7217d` | `tests/accounts.test.js` | `frontend/js/views/onboardingView.js` (SVG guía anatómica) |
| **SCRUM-34** | HU-04 | Validación estricta de rangos en servidor | MISSING | **VERIFIED** | `1e7217d` | `tests/accounts.test.js` | `backend/routes/profile.js:validateMeasures` (422) |
| **SCRUM-35** | HU-04 | Equivalencias de tallas por marca | MISSING | **VERIFIED** | `1e7217d` | `tests/accounts.test.js` | `backend/data/seed/size-equivalences.json`, `GET/PUT /api/admin/size-equivalences` |
| **SCRUM-36** | HU-04 | Cifrado en reposo de medidas antropométricas | MISSING | **VERIFIED** | `1e7217d` | `tests/accounts.test.js` | `backend/repos/profiles.js` (AES-256-GCM sin texto plano en db) |
| **SCRUM-101** | HU-16 | Rectificación de perfil y medidas por titular | PARTIAL | **VERIFIED** | `b402e3c` | `tests/accounts.test.js` | `PUT /api/account`, `PUT /api/profile` |
| **SCRUM-102** | HU-16 | Supresión de cuenta con confirmación y bloqueo | PARTIAL | **VERIFIED** | `b402e3c` | `tests/accounts.test.js` | `POST /api/account/delete` (bloqueo 409 por cobro pendiente) |
| **SCRUM-103** | HU-16 | Exportación de datos personales en JSON | DONE | **VERIFIED** | `b402e3c` | `tests/accounts.test.js` | `GET /api/profile/export`, `GET /api/me/export` |
| **SCRUM-104** | HU-16 | Registro de solicitudes de titulares | DONE | **VERIFIED** | `b402e3c` | `tests/accounts.test.js` | `GET /api/admin/data-requests`, `db.data.dataRequests` |
| **SCRUM-26** | HU-03 | Banco de preguntas del quiz en seed JSON | MISSING | **VERIFIED** | `403fd8e` | `tests/quiz-stylist.test.js` | `backend/data/seed/quiz.json`, `GET /api/quiz` |
| **SCRUM-27** | HU-03 | Validación de pesos de estilo normalizados | MISSING | **VERIFIED** | `403fd8e` | `tests/quiz-stylist.test.js` | `backend/routes/quiz.js:validateQuizWeights` |
| **SCRUM-28** | HU-03 | Barra de progreso visual e interactiva | PARTIAL | **VERIFIED** | `403fd8e` | `tests/quiz-stylist.test.js` | `frontend/js/views/onboardingView.js` |
| **SCRUM-29** | HU-03 | Guardado automático y reanudación de quiz | MISSING | **VERIFIED** | `403fd8e` | `tests/quiz-stylist.test.js` | `PUT /api/quiz/progress`, `GET /api/quiz/session` |
| **SCRUM-30** | HU-03 | Integración de respuestas al perfil | DONE | **VERIFIED** | `403fd8e` | `tests/api.test.js` | `PUT /api/profile`, versionado de perfil |
| **SCRUM-31** | HU-03 | Protocolo de pruebas de usabilidad del quiz | MISSING | **VERIFIED** | `aba972f` | `docs/usability-test-protocol.md` | `docs/usability-test-protocol.md` (meta 3 min) |
| **SCRUM-51** | HU-07 | Cola de revisión de cajas para estilistas | PARTIAL | **VERIFIED** | `88d2d43` | `tests/quiz-stylist.test.js` | `GET /api/stylist/boxes` |
| **SCRUM-52** | HU-07 | Vista de afinidad y explicación de prendas | DONE | **VERIFIED** | `88d2d43` | `tests/api.test.js` | `stylistBoxView:recommendations,explanation` |
| **SCRUM-53** | HU-07 | Reemplazo y aprobación con registro de motivo | PARTIAL | **VERIFIED** | `88d2d43` | `tests/quiz-stylist.test.js` | `POST /api/stylist/boxes/:id/{approve,replace,reject}` |
| **SCRUM-54** | HU-07 | Control de acceso estricto para rol STYLIST | PARTIAL | **VERIFIED** | `88d2d43` | `tests/quiz-stylist.test.js` | `backend/routes/stylist.js:STYLIST_ACCESS` |
| **SCRUM-55** | HU-07 | Ejemplos de entrenamiento para feedback | MISSING | **VERIFIED** | `88d2d43` | `tests/quiz-stylist.test.js` | `backend/database.js:addCorrection`, `db.data.corrections` |
| **SCRUM-57** | HU-08 | Tokenización en navegador (cero datos de tarjeta) | PARTIAL | **VERIFIED** | `5dd0ade` | `tests/billing.test.js` | `backend/adapters/payments/index.js:tokenize` |
| **SCRUM-58** | HU-08 | Catálogo de planes y regla de costo objetivo | PARTIAL | **VERIFIED** | `3bfd9f0` | `tests/billing.test.js` | `backend/config.js:PLAN_CONFIG`, `PLAN_TARGET_COST_RATE` |
| **SCRUM-59** | HU-08 | Webhook con firma criptográfica y conciliación | PARTIAL | **VERIFIED** | `c1bdda3` | `tests/billing.test.js` | `POST /api/payments/webhook`, `backend/jobs/reconcilePayments.js` |
| **SCRUM-60** | HU-08 | Reintentos automáticos de cobro (1, 3, 5 días) | DONE | **VERIFIED** | `e4c12ea` | `tests/api.test.js` | `backend/billing.js:runPaymentRetries` |
| **SCRUM-61** | HU-08 | Envío de correos transaccionales de pago | DONE | **VERIFIED** | `e4c12ea` | `tests/api.test.js` | `mail.send('SUBSCRIPTION_CONFIRMED', ...)` |
| **SCRUM-62** | HU-08 | Simulación de pasarela (tok_ok, tok_declined) | PARTIAL | **VERIFIED** | `d6c92b3` | `tests/billing.test.js` | `backend/adapters/payments/simulated.js` |
| **SCRUM-80** | HU-12 | Matriz de estados de suscripción | DONE | **VERIFIED** | `e4c12ea` | `tests/api.test.js` | `backend/billing.js:TRANSITIONS` (409 en transiciones inválidas) |
| **SCRUM-81** | HU-12 | Pausa mensual de suscripción sin cobros | DONE | **VERIFIED** | `e4c12ea` | `tests/api.test.js` | `POST /api/subscription/pause` |
| **SCRUM-82** | HU-12 | Cambio de plan y fecha de corte | DONE | **VERIFIED** | `e4c12ea` | `frontend/js/views/profileView.js` | `POST /api/subscription/plan` (regla día 25) |
| **SCRUM-83** | HU-13 | Oferta de pausa al cancelar y confirmación | MISSING | **VERIFIED** | `5a5952a` | `tests/subscription.test.js` | `POST /api/subscription/cancel` (pausa previa, `confirm: true`) |
| **SCRUM-84** | HU-13 | Desactivación de cobros al cancelar | DONE | **VERIFIED** | `e4c12ea` | `tests/api.test.js` | `backend/billing.js:cancelSubscription` |
| **SCRUM-86** | HU-13 | Encuesta de salida con motivos configurables | DONE | **VERIFIED** | `e4c12ea` | `tests/api.test.js` | `config.CANCELLATION_REASONS` |
| **SCRUM-87** | HU-13 | Encuesta opcional con opción de omitir | MISSING | **VERIFIED** | `5a5952a` | `tests/subscription.test.js` | `cancellation.reason = null` sin error |
| **SCRUM-88** | HU-13 | Reporte administrativo de motivos de baja | DONE | **VERIFIED** | `e4c12ea` | `tests/api.test.js` | `GET /api/admin/cancellation-reasons` |
| **SCRUM-96** | HU-15 | Factura electrónica al aprobar pago | DONE | **VERIFIED** | `e8f51d8` | `tests/invoicing.test.js` | `backend/billing.js:issueElectronicInvoice` |
| **SCRUM-97** | HU-15 | Identificador de factura y captura fiscal | PARTIAL | **VERIFIED** | `e8f51d8` | `tests/invoicing.test.js` | `docType`, `docNumber`, `address`, `city` |
| **SCRUM-98** | HU-15 | Cola de reintentos de facturación y alertas | MISSING | **VERIFIED** | `e8f51d8` | `tests/invoicing.test.js` | `PENDING_RETRY`, `FAILED`, alerta operaciones |
| **SCRUM-99** | HU-15 | Consulta de facturas y descarga en PDF simulado | PARTIAL | **VERIFIED** | `e8f51d8` | `tests/invoicing.test.js` | `GET /api/invoices/:id/pdf` (formato imprimible) |
| **SCRUM-44** | HU-06 | Reglas de combinación en seed JSON | MISSING | **VERIFIED** | `f9a21eb` | `tests/engine.test.js` | `backend/data/seed/style-rules.json`, `outfit-rules.json` |
| **SCRUM-45** | HU-06 | Cumplimiento estricto de restricciones duras | PARTIAL | **VERIFIED** | `2a0db7a` | `tests/engine.test.js` | `backend/engine.js:curateBox` (stock, presupuesto, línea, conteo) |
| **SCRUM-46** | HU-06 | Generación de outfits combinados | PARTIAL | **VERIFIED** | `f9a21eb` | `tests/engine.test.js` | `backend/engine.js:generateOutfits`, `frontend/js/views/boxView.js` |
| **SCRUM-47** | HU-06 | Prevención de prendas repetidas | DONE | **VERIFIED** | `2a0db7a` | `tests/api.test.js` | `excludeIds` con fallback `catalogExhausted` |
| **SCRUM-48** | HU-06 | Explicación persistida de recomendaciones | MISSING | **VERIFIED** | `2a0db7a` | `tests/engine.test.js` | `matchedAttributes`, `scoreComponents`, `modelVersion` |
| **SCRUM-49** | HU-06 | Evaluación offline del recomendador | MISSING | **VERIFIED** | `d565917` | `scripts/eval-recommender.js` | `npm run eval` (100% restricciones cumplidas) |
| **SCRUM-75** | HU-11 | Colección de eventos normalizados de feedback | MISSING | **VERIFIED** | `d565917` | `tests/engine.test.js` | `COLLECTIONS: feedbackEvents`, `GET /api/admin/feedback-events` |
| **SCRUM-76** | HU-11 | Regla de actualización acotada de pesos | PARTIAL | **VERIFIED** | `d565917` | `tests/engine.test.js` | `backend/learning.js` (floor 0.3, cap 2.0, $\le 2$ baja, 5 sube) |
| **SCRUM-77** | HU-11 | Evaluación comparativa de cohortes | MISSING | **VERIFIED** | `d565917` | `scripts/eval-feedback.js` | `GET /api/admin/model/eval-feedback` |
| **SCRUM-78** | HU-11 | Versionado criptográfico del conjunto de reglas | MISSING | **VERIFIED** | `f9a21eb` | `tests/engine.test.js` | `backend/modelVersions.js` (hash SHA-256 de reglas, `reglas-v2`) |
| **SCRUM-64** | HU-09 | Validación de estado de caja antes de despacho | PARTIAL | **VERIFIED** | `f1b2269` | `tests/fulfillment.test.js` | `backend/routes/warehouse.js:changeBoxStatus` (409) |
| **SCRUM-65** | HU-09 | Ingreso manual de transportadora y número de guía | MISSING | **VERIFIED** | `f1b2269` | `tests/fulfillment.test.js` | `backend/adapters/logistics/index.js:manualShipment` |
| **SCRUM-66** | HU-09 | Descuento automático de inventario al despachar | PARTIAL | **VERIFIED** | `f1b2269` | `tests/fulfillment.test.js` | `backend/logistics.js:shipBox` (`DISPATCH_OUT`) |
| **SCRUM-67** | HU-09 | Envío de correo transaccional de despacho | PARTIAL | **VERIFIED** | `f1b2269` | `tests/fulfillment.test.js` | `mail.send('BOX_SHIPPED', ...)` |
| **SCRUM-68** | HU-09 | Checklist de empaque con empaque sostenible | MISSING | **VERIFIED** | `f1b2269` | `tests/fulfillment.test.js` | `POST /api/admin/boxes/:id/pack` (`sustainablePackaging: true`) |
| **SCRUM-70** | HU-10 | Calificación individual en escala entera 1 a 5 | PARTIAL | **VERIFIED** | `40f6f70` | `tests/fulfillment.test.js` | `backend/routes/ratings.js` (rechazo de floats o $< 1$ / $> 5$) |
| **SCRUM-71** | HU-10 | Diferenciación entre ajuste de talla y estilo | PARTIAL | **VERIFIED** | `40f6f70` | `tests/fulfillment.test.js` | `fitScore` y `styleScore` en rating |
| **SCRUM-72** | HU-10 | Integración de feedback positivo al perfil | PARTIAL | **VERIFIED** | `40f6f70` | `tests/fulfillment.test.js` | `backend/learning.js:applyRating` |
| **SCRUM-73** | HU-10 | Cálculo real de satisfacción (sin default 4.0) | MISSING | **VERIFIED** | `40f6f70` | `tests/fulfillment.test.js` | `backend/repos/adminReports.js` ('sin datos' en vacío, alerta $< 4$) |
| **SCRUM-90** | HU-14 | Política de devoluciones con borrador legal | MISSING | **VERIFIED** | `70dcf57` | `docs/return-policy.md` | `docs/return-policy.md`, `config.RETURN_POLICY` |
| **SCRUM-91** | HU-14 | Cálculo de días hábiles descontando festivos CO | MISSING | **VERIFIED** | `70dcf57` | `tests/fulfillment.test.js` | `backend/adapters/logistics/index.js` (calendario 2026 oficial) |
| **SCRUM-92** | HU-14 | Guía imprimible para logística inversa | MISSING | **VERIFIED** | `70dcf57` | `tests/fulfillment.test.js` | `GET /api/returns/:id/guide` (HTML imprimible) |
| **SCRUM-93** | HU-14 | Reingreso automático a inventario en devolución | PARTIAL | **VERIFIED** | `70dcf57` | `tests/fulfillment.test.js` | `backend/routes/returns.js:processReturn` (`RETURN_IN`) |
| **SCRUM-94** | HU-14 | Métricas de devoluciones por talla y marca | MISSING | **VERIFIED** | `70dcf57` | `tests/fulfillment.test.js` | `GET /api/admin/returns/metrics` (alerta si $> 10\%$) |
| **SCRUM-106** | HU-17 | Formulación matemática de métricas y fuentes | PARTIAL | **VERIFIED** | `08db284` | `tests/kpis.test.js` | `docs/kpi-definitions.md`, `backend/kpis.js` |
| **SCRUM-107** | HU-17 | Materialización de snapshots de KPI mensuales | PARTIAL | **VERIFIED** | `873ca9a` | `tests/kpis.test.js` | `backend/jobs/kpiSnapshot.js`, `GET/POST /api/admin/kpi-snapshots` |
| **SCRUM-108** | HU-17 | Tablero interactivo con filtros de mes y plan | DONE | **VERIFIED** | `873ca9a` | `tests/kpis.test.js` | `frontend/js/views/admin/kpis.js` |
| **SCRUM-109** | HU-17 | Umbrales de alerta editables en settings | PARTIAL | **VERIFIED** | `873ca9a` | `tests/kpis.test.js` | `GET/PUT /api/admin/settings/thresholds` (churn, rating, returns) |
| **SCRUM-105** | HU-17 | Prueba de humo de ciclo de vida completo (E2E) | MISSING | **VERIFIED** | `1918d04` | `tests/e2e.smoke.test.js` | `tests/e2e.smoke.test.js` (flujo positivo y 6 caminos negativos) |

---

## 4. Supuestos Asumidos para Confirmar con el Negocio / Equipo

En estricto apego a las directrices de integridad, ningún dato legal o comercial sensible fue inventado de forma definitiva. Se listan a continuación todos los supuestos operativos parametrizados:

1. **Borradores Legales (Pendientes de Revisión Legal):**
   - **Política de Tratamiento de Datos Personales (`docs/alignment/01-context.md` y `backend/config.js`):** Formulada bajo el marco de la Ley Estatutaria 1581 de 2012 de Colombia. Marcada explícitamente con `BORRADOR pendiente de revisión legal`.
   - **Política de Cambios y Devoluciones (`docs/return-policy.md`):** Ventana de 5 días hábiles a partir de la entrega para solicitar cambio exclusivo por problemas anatómicos o de talla. Marcada con `BORRADOR PENDIENTE DE REVISIÓN LEGAL`.
2. **Validación de Estilistas de Moda:**
   - Las reglas heurísticas de compatibilidad y pesos de estilo (`backend/data/seed/style-rules.json` y `outfit-rules.json`) están marcadas como `pendiente de validación del estilista`.
3. **Márgenes y Parámetros Comerciales:**
   - **Costos de Adquisición / Precio Mayorista:** Se asume un ratio mayorista por defecto del 30% del precio de venta al público cuando la prenda no especifique costo (`WHOLESALE_RATIO_DEFAULT: 0.30`).
   - **Costo Objetivo de Prendas por Caja:** Se asume que el costo total de las prendas de la caja equivale al 40% del valor de suscripción del plan (`PLAN_TARGET_COST_RATE: 0.40`).
   - **Comisión de Pasarela de Pagos:** Se modela una comisión transaccional del 3.5% sobre cada cobro aprobado (`PAYMENT_FEE_RATE: 0.035`).
   - **Costo Logístico Unitario:** Se modela un costo fijo de despacho de COP 12.000 por envío en Cali (`LOGISTICS_COST_COP: 12000`).
   - **Tratamiento Tributario:** Los valores de planes se asumen con IVA incluido del 19% (`IVA_RATE: 0.19`).
4. **Umbrales de Control Operativo:**
   - Alerta de Churn mensual: $> 9.0\%$ (`CHURN_THRESHOLD_DEFAULT: 9`).
   - Alerta de Satisfacción mínima: $< 4.0$ sobre 5.0 (`RATING_THRESHOLD_DEFAULT: 4.0`).
   - Alerta de Devoluciones por talla: $> 10.0\%$ de las prendas entregadas (`RETURNS_THRESHOLD_DEFAULT: 10`).

---

## 5. Guía de Verificación en Windows PowerShell

Para reproducir y validar de manera independiente los resultados de este informe, ejecute los siguientes comandos en PowerShell desde el directorio de trabajo:

### 5.1 Ejecución de Pruebas Unitarias y de Integración
```powershell
# Ejecutar la suite completa de pruebas automatizadas (136 pruebas)
npm test

# O ejecutar mediante Node de forma explícita
node --test tests/
```

### 5.2 Evaluación Offline del Motor de Recomendación
```powershell
# Evalúa el cumplimiento de restricciones duras en 30 perfiles sintéticos
npm run eval
```

### 5.3 Ejecución de Pruebas Específicas por Dominio
```powershell
# Catálogo e inventario
node --test tests/catalog.test.js

# Cuentas, medidas cifradas y derechos ARCO
node --test tests/accounts.test.js

# Quiz de estilo y flujo de estilista
node --test tests/quiz-stylist.test.js

# Pasarela, pagos recurrentes y suscripción
node --test tests/billing.test.js
node --test tests/subscription.test.js

# Facturación electrónica DIAN
node --test tests/invoicing.test.js

# Motor de recomendación y aprendizaje por feedback
node --test tests/engine.test.js

# Despacho, calificaciones y devoluciones
node --test tests/fulfillment.test.js

# Indicadores de desempeño (KPIs) y snapshots
node --test tests/kpis.test.js

# Prueba de humo completa de extremo a extremo
node --test tests/e2e.smoke.test.js
```

### 5.4 Demostración Interactiva del Servidor
```powershell
# Iniciar el servidor local en puerto 3000
npm start
# Abrir en el navegador: http://localhost:3000
```
