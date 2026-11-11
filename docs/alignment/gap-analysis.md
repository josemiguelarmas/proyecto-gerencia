# Análisis de brechas Jira vs. código (Fase 0)

Fecha: 2026-11-10. Rama auditada: `main` @ `2082654` (copia limpia por `git archive`, sin archivos sin rastrear). Solo lectura.

Criterio: **DONE** = comportamiento en la app servida (`frontend/` + `backend/`) **y** prueba automática que puede fallar. **PARTIAL** = existe parte o falta la prueba. **MISSING** = no existe. Cuando el repo cumple la intención con otro diseño (otro nombre de ruta, otro nombre de colección) se marca DONE y se anota la diferencia.

## Cambios desde la línea base de la auditoría (`dev` @ `217752c`)

- `dev` no se movió. `main` tiene 23 commits nuevos (PR #1 desde `sprint2`, 2026-11-04, autor byrejaxxmodz) con mensajes `HU-xx ...` que cubren HU-01 a HU-17 (Sprint 2, "Prompts" 1 a 5) más `EVIDENCIAS_SPRINT2.md`.
- Ningún commit usa claves `SCRUM-`. No hay ramas sin fusionar con trabajo: `origin/sprint2` ya está dentro de `main`.
- `tests/api.test.js` ahora usa `require('assert')`, termina con `process.exit(1)` si algo falla y corre sobre una copia temporal de `db.json` (`TCB_DB_FILE`). Resultado de la corrida base: **70/70 pruebas pasan, código de salida 0**. Las pruebas pueden fallar (assert real), pero comparten un solo proceso y el puerto fijo 3199.
- El trabajo de una sesión anterior de alineación (base técnica F1–F10 hecha sobre `dev`) quedó en `stash@{0}` y como archivos sin rastrear en la carpeta principal. Se construyó sobre el código viejo: reemplaza `routes.js` y `database.js`, que Sprint 2 amplió mucho, así que no es fusionable tal cual. **No se tocó.**
- Por eso la rama `integration/jira-alignment` se creó desde `main` y no desde `dev` (worktree `..\wt-integration`).

### Defectos de la línea base: estado actual

| Defecto | Estado | Evidencia |
|---|---|---|
| Secreto JWT por defecto en código | PRESENTE | `backend/auth.js:4` |
| Comparación de firma no constante | PRESENTE | `backend/auth.js:24` |
| Tokens de 72 h sin revocación | PRESENTE | `backend/auth.js:6,44` |
| `admin123` re-sembrado al arrancar | PRESENTE | `backend/database.js:66-80,154,171` |
| Credenciales en frontend y README | PRESENTE | `authView.js:26,82`, `adminView.js:82,886`, `README.md:58` |
| CORS `*` | PRESENTE | `backend/routes.js:128,189` |
| Registro sin validar formato de correo | PRESENTE | `backend/routes.js:229-253` |
| Asignación masiva en perfil | PRESENTE | `routes.js:716,726`, `database.js:664-674` |
| Medidas en texto plano en archivo versionado y expuestas al admin | PRESENTE | `routes.js:112`, `adminView.js:363` |
| Sin validación de rangos de medidas en servidor | PRESENTE | solo cliente, `profileView.js:81` |
| Calificación por defecto 4 | PRESENTE | `database.js:786` |
| KPI `'4.8'` de relleno | PRESENTE | `database.js:881`, `adminView.js:146` |
| Guía `TCB-CALI-7829-X` fija | CORREGIDO | `boxView.js:154` |
| `POST /api/boxes/simulate-step` (cliente cambia su caja) | PRESENTE (con guardas 409) | `routes.js:812`, `boxView.js:79,523` |
| Setter de estado admin acepta cualquier transición | PARCIAL (404 ya existe; sin grafo de transiciones) | `routes.js:625-637` |
| Perfil con valores por defecto (178 cm, Zara) y `heightCm` vs `measures.height` | PRESENTE | `profileView.js:27,143,603`, `engine.js:31` |
| Cajas generadas al guardar perfil | PRESENTE | `routes.js:730-733` |
| Sin stock ni variantes | CORREGIDO | `catalog.js` (`stockInSize`), `logistics.js` |
| Presupuesto nunca capturado | PRESENTE | no hay `budget` en el backend |
| Sin rol estilista | CORREGIDO | `routes.js:348-451`, `stylistView.js` |
| `db.json` versionado con usuarios `test_*` | PRESENTE | 13 usuarios, 10 `test_*@test.com` |

## Base técnica (F1–F10)

| Tarea | Estado | Evidencia | Falta | Tamaño |
|---|---|---|---|---|
| F1 Runner de pruebas | PARTIAL | `tests/api.test.js` (1262 líneas, `assert`, `exit(1)`) | `node:test`, archivos por dominio, puerto efímero, carpeta temporal por archivo, reloj inyectable | M |
| F2 Configuración | PARTIAL (otro diseño) | `backend/config.js` (constantes de negocio), `TCB_*` en `database.js:5` | módulo de env con fallo rápido, `DATA_ENCRYPTION_KEY`, `ADMIN_*`, `CORS_ORIGINS`, `.env.example`, carpeta `seed/` | M |
| F3 Higiene de datos | MISSING | `.gitignore` sin `runtime/` ni `.env`; `db.json` versionado | sacar `db.json` de git, mover catálogo a `seed/`, las pruebas deben sembrar sus datos | S |
| F4 Estructura | MISSING | `routes.js` 1245 líneas, `database.js` 909 líneas (escritura atómica ya existe en `:138-142`) | dividir rutas y repositorios por dominio | L |
| F5 Seguridad | MISSING | ver tabla de defectos | todo F5 (rol WAREHOUSE, `requireRole`, rate limit, cabeceras, validador central, CORS) | L |
| F6 Adaptadores | PARTIAL (otro diseño) | `backend/{payments,mail,invoicing,shipping}/index.js` | tokens `tok_ok/declined/flaky`, carpeta de salida, ubicación unificada | M |
| F7 Jobs | PARTIAL | `backend/jobs.js` (recordatorio y cobros); lote manual `routes.js:507` | lote mensual, snapshot KPI, conciliación, ingesta de feedback; desactivar en pruebas | M |
| F8 Contratos de dominio | MISSING | estados de caja dispersos (`PROPOSED`, `APPROVED`, `PREPARING`, `SHIPPED`, `DELIVERED`, `RATED`); máquina de suscripción en `billing.js:39-60` | máquina de estados de caja, `vocab.js`, `business.js` con pruebas unitarias | M |
| F9 CI | MISSING | sin `.github/`, sin `Dockerfile` | `ci.yml`, `Dockerfile`, `docs/staging.md` | S |
| F10 Esqueleto de docs | MISSING | `docs/` solo tiene `ejemplo_catalogo.csv` | `integrations.md`, `kpi-definitions.md`, `progress.md` | S |

## Subtareas por historia

Columna "Jira" = estado declarado de la HU. Números de prueba = `tests/api.test.js`.

### Stream A — HU-05 Catálogo (SCRUM-37, Jira: En curso)

| Clave | Código hoy | Evidencia | Falta | Tamaño |
|---|---|---|---|---|
| SCRUM-38 | PARTIAL | `catalog.js:7-24`, `INITIAL_VARIANT_STOCK=10`; pruebas 28, 54, 61 | entidad Brand, `sku`, `reserved`, `retailPrice`, funciones `reserve/release/consume/restock` | M |
| SCRUM-39 | PARTIAL | `routes.js:495`, `catalog.js:70-165`; prueba 29 | errores `{row, field, message}`, upsert por `sku`, fixtures (bueno, mixto, malformado) | S |
| SCRUM-40 | PARTIAL | carga CSV en `adminView.js:393-398,1015` | editar y borrar (lógico), formulario de edición, `saveProduct` sin usar, validación del POST | M |
| SCRUM-41 | MISSING | — | etiquetado de estilo en la UI admin con vocabulario controlado y validación | S |
| SCRUM-42 | MISSING (doc) | — | `docs/data-contract-brands.md` | S |

### Stream B — HU-01 (SCRUM-14, Finalizado), HU-02 (SCRUM-20, En revisión), HU-04 (SCRUM-32, Finalizado), HU-16 (SCRUM-100, En curso)

| Clave | Código hoy | Evidencia | Falta | Tamaño |
|---|---|---|---|---|
| SCRUM-15 | PARTIAL | `authView.js:161,170,231-273`, `app.js:17-18` | verificación manual de pantallas de recuperar y verificar | S |
| SCRUM-16 | PARTIAL | `routes.js:229-259`; pruebas 19, 20 | formato de correo, contraseña de 8 o más caracteres con letra y número, pista `offer` en el 409 | S |
| SCRUM-17 | PARTIAL | `database.js:10` (scrypt), `auth.js` | pruebas: sin contraseña en claro, token forjado o vencido rechazado | S |
| SCRUM-18 | PARTIAL | `database.js:388`, `routes.js:296,338`; pruebas 21–23 | verificación vence a las 24 h, correo verificado obligatorio para suscribirse, política en reset | S |
| SCRUM-19 | PARTIAL | pruebas 17–23 | pruebas de correo inválido, contraseña débil y rate limit (y el rate limit mismo) | M |
| SCRUM-21 | PARTIAL (doc) | `config.POLICY`, modal `authView.js:284-291` | rótulo "BORRADOR pendiente de revisión legal" | S |
| SCRUM-22 | PARTIAL | modal `authView.js:170-188` | página `/politica-datos` | S |
| SCRUM-23 | DONE | `database.js:370` `addConsent`; prueba 18 | — | — |
| SCRUM-24 | DONE | pruebas 17, 18 | — | — |
| SCRUM-33 | MISSING | — | guía de medidas con SVG en línea | S |
| SCRUM-34 | MISSING | límites de cliente contradictorios (`onboardingView.js:302,309` vs `profileView.js:81,85`) | tabla de rangos compartida, 422 por campo | M |
| SCRUM-35 | MISSING | `BRAND_RUNS` fijo en `engine.js:3` | seed JSON, endpoint admin, comportamiento para marca desconocida | M |
| SCRUM-36 | MISSING | medidas en claro (`database.js:187`, `routes.js:112`) | AES-256-GCM, lectura restringida por rol, prueba de que el archivo no tiene medidas en claro | M |
| Presupuesto (hallazgo) | MISSING | sin `budget` en el backend | `budgetRange` en onboarding y perfil, usado en la curación; una sola fuente `profile.measures` | M |
| SCRUM-101 | PARTIAL | `privacy.js`, `routes.js:1165`; prueba 62 | quitar los 178 cm y 74 kg por defecto, editar los campos que lee el motor vía endpoint validado | S |
| SCRUM-102 | DONE (otro diseño) | `privacy.js:92-148`, `POST /api/account/delete`; pruebas 64, 65 | (en el plan solo se confirma la regla de cobro pendiente) | — |
| SCRUM-103 | DONE (otro diseño) | `GET /api/profile/export`; prueba 63 | — | — |
| SCRUM-104 | DONE | `dataRequests`, `routes.js:553`; prueba 65 | — | — |

### Stream C1 — HU-03 (SCRUM-25, En curso), HU-07 (SCRUM-50, Finalizado)

| Clave | Código hoy | Evidencia | Falta | Tamaño |
|---|---|---|---|---|
| SCRUM-26 | MISSING | preguntas incrustadas en `onboardingView.js` | `seed/quiz.json` (q1–q8 y el juego), `GET /api/quiz` | M |
| SCRUM-27 | PARTIAL | `database.js:664` sin validación | validar estilos contra el vocabulario y pesos en 0..1 (400) | S |
| SCRUM-28 | PARTIAL | juego de estilos ocultos en `onboardingView.js:107-155` | una pregunta por pantalla con las 8 preguntas | M |
| SCRUM-29 | PARTIAL | `routes.js:743-755`, versiones de perfil; pruebas 40, 41 | progreso por pregunta (hoy el tope es el paso 4, no se puede reanudar en la pregunta 5) | S |
| SCRUM-30 | DONE | `database.js:582-605`, `/api/admin/metrics`; prueba 41 | — | — |
| SCRUM-31 | MISSING (doc) | — | `docs/usability-test-protocol.md` | S |
| SCRUM-51 | PARTIAL | `GET /api/stylist/queue`, `stylistView.js`; prueba 34 | filtro por estado | S |
| SCRUM-52 | DONE | `routes.js:92`; pruebas 34, 36 | — | — |
| SCRUM-53 | PARTIAL | `routes.js:377-447`; pruebas 35–38 | máquina de estados formal, `variantId`, prueba de 404 | S |
| SCRUM-54 | PARTIAL | estilista sembrado en código (`database.js:92`); prueba 34 | estilista creado desde variables de entorno, prueba de 401 | S |
| SCRUM-55 | PARTIAL | `db.addCorrection` (`database.js:559`); pruebas 36, 37, 67 | foto del perfil y fecha en el registro | S |

### Stream C2 — HU-06 (SCRUM-43, En revisión), HU-11 (SCRUM-74, En curso)

| Clave | Código hoy | Evidencia | Falta | Tamaño |
|---|---|---|---|---|
| SCRUM-44 | MISSING | reglas fijas en `engine.js` | `seed/style-rules.json` marcado pendiente de estilista | S |
| SCRUM-45 | PARTIAL | `engine.js` `curateBox`; pruebas 30–32 | no repetir prendas (o marcar en la explicación), presupuesto del usuario, cantidad por plan | M |
| SCRUM-46 | MISSING | textos "Outfit 01/02/03" fijos en `boxView.js:261-275` | tabla de compatibilidad, puntaje de la caja completa, mostrar datos persistidos | M |
| SCRUM-47 | PARTIAL | `POST /api/admin/boxes/generate-batch`; prueba 39 | job programado, exigir cobro confirmado, dejar de crear caja al guardar perfil | M |
| SCRUM-48 | PARTIAL | `recommendations[]`; prueba 33 | filtros aplicados y versión del modelo por prenda | S |
| SCRUM-49 | PARTIAL | prueba 32 (6 perfiles) | `scripts/eval-recommender.js`, 30 perfiles fijos, `npm run eval`, métricas | M |
| SCRUM-75 | PARTIAL | `learning.js` `ingestFeedback`; prueba 67 | job programado | S |
| SCRUM-76 | PARTIAL (otro diseño) | `attributeWeights` acotados entre 0.3 y 2; prueba 66 | que una calificación alta suba el peso | S |
| SCRUM-77 | PARTIAL | `scripts/evaluate-model.js`; prueba 68 | endpoint admin, comparación por cohortes | S |
| SCRUM-78 | PARTIAL | `RULES_VERSION` por caja (`database.js:721`) | `model_versions` con hash y versión activa que se pueda cambiar | M |

### Stream D1 — HU-08 (SCRUM-56, Por hacer), HU-12 (SCRUM-79, En curso), HU-13 (SCRUM-85, Finalizado)

| Clave | Código hoy | Evidencia | Falta | Tamaño |
|---|---|---|---|---|
| SCRUM-57 | PARTIAL | `payments/index.js:55-77`, `/api/payments/tokenize` | **el servidor recibe el número de tarjeta y el CVV** (contrario a la especificación): tokenizar en el cliente con el proveedor simulado, 400 ante campos que parezcan tarjeta, `docs/integrations.md` | M |
| SCRUM-58 | PARTIAL | `billing.js:39-60,292-308`; pruebas 44, 48 | exigir correo verificado al suscribirse | S |
| SCRUM-59 | PARTIAL | `billing.js:193-218`, HMAC con `timingSafeEqual`; prueba 47 | idempotencia por id de evento, job de conciliación, efecto del evento en el estado | M |
| SCRUM-60 | DONE | `billing.js:341-397`; prueba 46 | — | — |
| SCRUM-61 | DONE | `payments/index.js:100`, `/api/admin/payments`; pruebas 44, 47 | — | — |
| SCRUM-62 | PARTIAL | pruebas 43–47 | prueba de webhook duplicado y de correo no verificado bloqueado | S |
| SCRUM-80 | DONE | `billing.js:39-60`; prueba 48 | — | — |
| SCRUM-81 | DONE | `SUBSCRIPTION_CUTOFF_DAY`, `billing.js:472-508`; prueba 50 | — | — |
| SCRUM-82 | DONE (otro diseño) | `profileView.js:244-351` (dentro de `#/perfil`) | — | — |
| SCRUM-83 | PARTIAL | oferta de pausa solo en la UI (`profileView.js:316-351`) | oferta y confirmación explícita del lado del servidor, con prueba | S |
| SCRUM-84 | DONE | pruebas 48–51 | — | — |
| SCRUM-86 | DONE | `CANCELLATION_REASONS`; prueba 26 | — | — |
| SCRUM-87 | DONE (otro diseño) | encuesta dentro de la cancelación; pruebas 26, 27 | — | — |
| SCRUM-88 | DONE | `/api/admin/cancellation-reasons`; prueba 26 | — | — |

### Stream D2 — HU-15 (SCRUM-95, Por hacer)

| Clave | Código hoy | Evidencia | Falta | Tamaño |
|---|---|---|---|---|
| SCRUM-96 | DONE | `invoicing/index.js` (`INVOICING_FAIL=1`); prueba 52 | — | — |
| SCRUM-97 | DONE | `billing.js:78-99`, `PUT /api/profile/fiscal`; prueba 52 | — | — |
| SCRUM-98 | PARTIAL | `billing.js:112-186`; prueba 53 | correo de operaciones configurable por variable de entorno, alerta en el log | S |
| SCRUM-99 | PARTIAL | prueba 53 | pasos reales de habilitación DIAN en `docs/integrations.md` | S |

### Stream E1 — HU-09 (SCRUM-63, Finalizado), HU-10 (SCRUM-69, Finalizado), HU-14 (SCRUM-89, En revisión)

| Clave | Código hoy | Evidencia | Falta | Tamaño |
|---|---|---|---|---|
| SCRUM-64 | PARTIAL | `simulate-step` activo (`routes.js:812`) | quitar el endpoint y el botón, migrar unas 10 pruebas, prueba negativa | M |
| SCRUM-65 | PARTIAL | `shipping/index.js`, guía generada; prueba 54 | rol WAREHOUSE, ingreso manual de transportadora y guía | M |
| SCRUM-66 | PARTIAL | `moveStock` (`logistics.js:75,114`); prueba 54 | reservar al aprobar y liberar al rechazar o cancelar | M |
| SCRUM-67 | PARTIAL | correos de despachada y entregada; pruebas 54, 55 | correo "en tránsito" | S |
| SCRUM-68 | PARTIAL | `GET /api/admin/dispatch`; pruebas 35, 56, 57 | checklist de empaque con empaque sostenible, marcar empacada | M |
| SCRUM-70 | PARTIAL | API con `fitScore` y `styleScore`; prueba 24 | verificar la UI con las dos notas | S |
| SCRUM-71 | PARTIAL | `parseScore`; prueba 24 | quitar el `\|\| 4` (`database.js:786`), validar la ruta de lote | S |
| SCRUM-72 | DONE | `jobs.js:9-30`; prueba 25 | — | — |
| SCRUM-73 | PARTIAL | `database.js:881` (`'4.8'`) | "sin datos" cuando no hay calificaciones, alerta bajo 4.0 | S |
| SCRUM-90 | MISSING (doc) | `RETURN_WINDOW_BUSINESS_DAYS` y `RETURN_CONDITIONS` | `RETURN_POLICY` y `docs/return-policy.md` en borrador | S |
| SCRUM-91 | PARTIAL | `logistics.js:215,246`; pruebas 58–60 | festivos colombianos (`shipping/index.js:10` no los descuenta), pruebas de duplicado y festivo | S |
| SCRUM-92 | MISSING | — | guía de devolución en HTML imprimible | S |
| SCRUM-93 | DONE | `logistics.js:316`; prueba 61 | — | — |
| SCRUM-94 | MISSING | `sizeReturnPct` agregado | desglose por talla y por marca, alerta sobre 10 % | S |

### Stream E2 — HU-17 (SCRUM-105, Finalizado) y prueba de humo

| Clave | Código hoy | Evidencia | Falta | Tamaño |
|---|---|---|---|---|
| SCRUM-106 | PARTIAL | `metrics.js:37,41`; prueba 69 | `docs/kpi-definitions.md` | S |
| SCRUM-107 | PARTIAL | `computeKpis`; pruebas 69, 70 | colección `kpi_snapshots` y su job | M |
| SCRUM-108 | DONE | `/api/admin/kpis` con filtros; prueba 70 | (verificar el panel a mano) | — |
| SCRUM-109 | PARTIAL | umbral de churn editable; prueba 70 | umbrales de calificación y devoluciones | S |
| Seed demo (hallazgo) | PARTIAL | `scripts/seed-demo.js` (`seedDemo`) | excluir datos demo de los KPI | S |
| Prueba de humo e2e | MISSING | — | `tests/e2e.smoke.test.js` con caminos positivos y negativos | L |

## Totales

| Stream | Subtareas | DONE | PARTIAL | MISSING | Trabajo restante |
|---|---|---|---|---|---|
| Base F1–F10 | 10 | 0 | 4 | 6 | L |
| A (HU-05) | 5 | 0 | 3 | 2 | M |
| B (HU-01/02/04/16) | 17 (+ presupuesto) | 5 | 8 | 4 (+1) | L |
| C1 (HU-03/07) | 11 | 2 | 7 | 2 | M |
| C2 (HU-06/11) | 10 | 0 | 8 | 2 | L |
| D1 (HU-08/12/13) | 14 | 9 | 5 | 0 | M |
| D2 (HU-15) | 4 | 2 | 2 | 0 | S |
| E1 (HU-09/10/14) | 15 | 2 | 10 | 3 | L |
| E2 (HU-17 + e2e) | 4 (+ 2 hallazgos) | 1 | 3 (+1) | 0 (+1) | M |
| **Total subtareas Jira** | **80** | **21** | **46** | **13** | |

Las HU con Jira "Finalizado" que el código **no** respalda del todo: HU-01, HU-04 (la más débil: 4 subtareas MISSING), HU-07, HU-09, HU-10 y HU-17. Solo HU-13 está completa.
