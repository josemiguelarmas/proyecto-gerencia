# Plan de ejecución (Fase 0 → Fases 1 a 4)

Base: `integration/jira-alignment` creada desde `main` @ `2082654` (no desde `dev`, que no tiene el trabajo de Sprint 2). Worktree `..\wt-integration`. Detalle de brechas en `gap-analysis.md`.

Principio: el código de Sprint 2 funciona y tiene 70 pruebas que pueden fallar. **No se reescribe**: se extiende y se corrige lo que falta. Se conservan los nombres actuales cuando cumplen la intención (estados `PROPOSED`/`APPROVED`/`PREPARING`/`SHIPPED`/`DELIVERED`/`RATED`, `metrics.js`, `POST /api/account/delete`, etc.), con una tabla de equivalencias en el reporte.

## Fase 1 — Base técnica (un solo worker, secuencial)

Orden y alcance, solo lo PARTIAL o MISSING:

1. **F1 pruebas**: `npm test` pasa a `node --test tests/`. `api.test.js` se conserva tal cual y se envuelve en un archivo `node:test`. Las pruebas nuevas van en archivos por dominio que usan un helper con puerto efímero, carpeta temporal y reloj inyectable. Se demuestra que una falla deliberada da código distinto de 0.
2. **F3 + F2 datos y configuración**: `config/env.js` con fallo rápido para `JWT_SECRET` y `DATA_ENCRYPTION_KEY` (salvo `NODE_ENV=test`). `.env.example`. Las semillas pasan a `backend/data/seed/` y `db.json` sale de git (las pruebas siembran desde `seed/`). Se mantienen las variables `TCB_*` y `*_PROVIDER` que usa el equipo.
3. **F8 contratos**: `domain/boxStateMachine.js` con los estados actuales y guardas por rol, `domain/vocab.js` (desde `config.js`) y pruebas unitarias. La máquina de suscripción de `billing.js` se reexporta, no se reescribe.
4. **F4 estructura**: `routes.js` (1245 líneas) se divide en `routes/<dominio>.js` y `database.js` (909) en `repos/<colección>.js`. Es un cambio mecánico, protegido por las 70 pruebas. Sin esto los streams paralelos chocan en los mismos dos archivos.
5. **F5 seguridad**: JWT con `timingSafeEqual`, `iss`/`aud`, 8 h y versión de token para revocar. Admin y estilista se siembran desde variables de entorno. Se quitan las credenciales de `frontend/` y del README. CORS con lista permitida, límite de body, `lib/validate.js`, rate limit de login, cabeceras de seguridad, rol WAREHOUSE y `requireRole`.
6. **F6, F7, F9, F10**: tokens `tok_ok/tok_declined/tok_flaky` en el proveedor simulado. Los jobs se dividen en `run({now, store, adapters})` y no arrancan en pruebas. CI (ubuntu y windows), `Dockerfile`, `docs/staging.md` y los esqueletos de docs.

Compuerta: suite en verde, prueba de falla deliberada, el servidor arranca solo con variables de entorno, y un grep de la contraseña demo del admin, el secreto JWT viejo y las demás credenciales demo da vacío.

## Oleadas

| Oleada | Streams | Motivo |
|---|---|---|
| 1 | **A** (catálogo y stock), **B** (cuentas, medidas, datos), **C1** (quiz y estilista), **D1+D2** (pagos, suscripción, facturación) | Sin dependencias entre ellos después de F4. D2 es chico y comparte `billing.js` con D1, así que va en el mismo worker. |
| 2 | **C2** (motor y aprendizaje), **E1** (despacho, calificación, devoluciones) | C2 necesita stock (A), presupuesto (B) y estados (C1). E1 necesita estados (C1), reserva de stock (A) y pago (D1). |
| 3 | **E2** (KPIs y prueba de humo e2e) | Necesita todo lo anterior. |

Después de cada worker: revisor de solo lectura, máximo 2 rondas de corrección, fusión secuencial a `integration/jira-alignment` y la suite completa de nuevo.

## Mapa de propiedad de archivos (después de F4)

| Stream | Archivos |
|---|---|
| A | `routes/catalog.js`, `repos/products.js`, `repos/inventory.js`, `catalog.js`, `views/admin/products.js`, `docs/data-contract-brands.md`, `tests/catalog.test.js` |
| B | `routes/auth.js`, `routes/profile.js`, `routes/privacy.js`, `repos/users.js`, `repos/consents.js`, `privacy.js`, `lib/crypto.js`, `views/authView.js`, `views/profileView.js` (excepto suscripción), `views/onboardingView.js` (paso de medidas), `seed/size-equivalences.json`, `tests/accounts.test.js` |
| C1 | `routes/quiz.js`, `routes/stylist.js`, `seed/quiz.json`, `views/onboardingView.js` (pasos del quiz), `views/stylistView.js`, `docs/usability-test-protocol.md`, `tests/quiz-stylist.test.js` |
| D1+D2 | `routes/subscription.js`, `routes/payments.js`, `billing.js`, `payments/`, `invoicing/`, `views/subscribeView.js`, `views/profileView.js` (bloque de suscripción), `docs/integrations.md`, `tests/billing.test.js` |
| C2 | `engine.js`, `learning.js`, `jobs/boxBatch.js`, `jobs/feedback.js`, `seed/style-rules.json`, `seed/outfit-rules.json`, `scripts/eval-recommender.js`, `tests/fixtures/synthetic-profiles.json`, `views/boxView.js` (outfits), `tests/engine.test.js` |
| E1 | `routes/boxes.js`, `routes/warehouse.js`, `routes/ratings.js`, `routes/returns.js`, `logistics.js`, `shipping/`, `views/boxView.js` (estados), `views/returnsView.js`, `views/warehouseView.js`, `docs/return-policy.md`, `tests/fulfillment.test.js` |
| E2 | `metrics.js`, `jobs/kpiSnapshot.js`, `routes/admin.js` (KPIs y ajustes), `views/admin/kpis.js`, `scripts/seed-demo.js`, `docs/kpi-definitions.md`, `tests/e2e.smoke.test.js` |

`adminView.js` (1106 líneas) lo tocan A, D1 y E2, así que F4 lo divide en `views/admin/<pestaña>.js`. `onboardingView.js` lo comparten B y C1: C1 es dueño del archivo y B entrega el paso de medidas como un módulo aparte (`views/onboarding/measures.js`).

## Riesgos

1. **F4 sobre archivos grandes.** Un error mecánico rompe todo. Lo mitigan las 70 pruebas y que el cambio va en un solo commit revisado.
2. **Quitar `simulate-step`** obliga a migrar unas 10 pruebas viejas a la ruta de bodega o admin. Hay que justificar cada cambio de prueba (regla del `CLAUDE.md`).
3. **Tokenización de tarjeta.** Hoy el servidor recibe el número y el CVV. Cambiarlo afecta `subscribeView.js` y las pruebas 43 y 44.
4. **Cifrado de medidas.** Los registros existentes en claro necesitan una migración. Si se pierde `DATA_ENCRYPTION_KEY`, se pierden las medidas.
5. **Sacar `db.json` de git** rompe el arranque de las pruebas (`api.test.js:13`) hasta que se siembre desde `seed/`. Va primero en F3.

## Supuestos (por confirmar con el equipo)

- Costo objetivo por plan = 40 % del precio. Corte de facturación: se mantiene el día 25 actual (`SUBSCRIPTION_CUTOFF_DAY`). Reintentos +1/+3/+5 días (ya implementado). Pausa de 1 mes. Festivos: lista corta de 2026 en configuración.
- Rangos de medidas: estatura 140–220 cm, peso 38–180 kg (reemplazan los límites contradictorios del cliente).
- Marca desconocida en equivalencias de talla: se usa la talla declarada sin ajuste, y se documenta.

## Decisiones pendientes antes del "go"

1. **Formato de commits.** El prompt pide Conventional Commits en inglés con `Refs: SCRUM-nn`. El `CLAUDE.md` del proyecto pide `HU-XX descripción` en español, un commit por HU. Propuesta: `HU-05 feat(catalog): ...` con `Refs: SCRUM-38` en el cuerpo.
2. **Pruebas.** El `CLAUDE.md` exige pruebas en `tests/api.test.js`; el prompt pide archivos `node:test` por dominio. Propuesta: archivos nuevos por dominio, y `api.test.js` se sigue corriendo dentro de `npm test`.
3. **Trabajo viejo de la sesión anterior** (`stash@{0}` más los archivos sin rastrear en la carpeta principal): no se usa porque está hecho sobre `dev`. El equipo decide si se borra.
4. **`EVIDENCIAS_SPRINT2.md`**: el `CLAUDE.md` pide actualizarlo al final de cada sesión. Se actualizará junto con `report.md`.
