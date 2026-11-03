# Evidencias Sprint 2. The Clothes Box

Comando de prueba. `npm test` (equivale a `node tests/api.test.js`). Resultado al cierre del Prompt 1: **27 de 27 en verde** (15 originales + 12 nuevas).

Verificación manual. Servidor en http://localhost:3000 con una copia de la base, recorriendo cada pantalla en el navegador (detalle en cada HU).

---

## Sesión 1. Prompt 1. Errores y cierre del Sprint 1 (03/11/2026)

### Cambios transversales

| Cambio | Archivos | Motivo |
|---|---|---|
| Las pruebas usan `assert` de Node en lugar de `console.assert` | tests/api.test.js | `console.assert` solo imprime y nunca hacía fallar la suite. Ahora una prueba rota termina con código 1. Las 15 pruebas viejas siguen pasando con aserciones reales. |
| Las pruebas corren sobre una copia temporal de la base | tests/api.test.js L1-L15, backend/database.js L5 (`TCB_DB_FILE`), backend/mail/index.js L7 (`TCB_OUTBOX_FILE`) | Antes cada `npm test` agregaba usuarios de prueba a backend/data/db.json. |
| Configuración central | backend/config.js | Única fuente para la versión de la política, la edad mínima, los días del recordatorio y los motivos de cancelación. |
| Adaptador de correo simulado | backend/mail/index.js | `MAIL_PROVIDER=simulated`. Guarda en backend/data/outbox.json con destinatario, asunto, cuerpo, fecha y tipo. El asunto lleva el prefijo "[SIMULADO]". |
| Bandeja de salida en el panel | backend/routes.js L317 (`GET /api/admin/outbox`), frontend/js/views/adminView.js L429 | Pedido por CLAUDE.md. |
| .gitignore | .gitignore | outbox.json es un dato de ejecución, no se versiona. |

### A. Errores de integración frontend-backend

**A1. #/devoluciones mostraba 0 prendas y "Cambio talla" no abría el formulario.**
- Causa. El frontend leía `returnableItems` y el backend responde `returnableGarments`. Además la vista leía `item.brand`, `item.size`, `item.fit` (como texto) e `item.productId`, que el backend no envía.
- Corrección. frontend/js/views/returnsView.js L17, L40, L70, L74, L84 y L319 (`returnableGarments`). L91 y L193 (`brandName`). L96, L195 y L218-L222 (`fit.size`). L96 (`cut`). L269 (`productId: item.id`).
- El backend ahora también envía `cut` (el corte de la prenda: holgado, regular o ajustado). Antes el corte se perdía porque `fit` se sobrescribía con el cálculo de talla. backend/routes.js L653. El cambio es aditivo y no rompe nada.

**A2. #/historial mostraba "undefined", "[object Object]" y "$NaN".**
- Corrección. frontend/js/views/historyView.js L101 (puntaje desde `userRating.score`, antes leía `box.ratings[item.id].stars` sobre un arreglo). L106 (`brandName`). L107 (`fit.size`). L116 (`cut` y `fit.levelText`). L117 (`priceCOP`).
- Backend. backend/routes.js L618 agrega `cut`.

**A3. Prueba de contrato.** tests/api.test.js prueba 16 (L235-L254). Verifica que `/api/returns` y `/api/boxes/history` entreguen todas las claves que leen las dos pantallas.

**Verificación manual.** Con la cuenta demo (caja #3 entregada), #/devoluciones muestra "elegibles para cambio (9)" con marca, talla, tejido y corte. El botón abre el formulario. #/historial muestra "Talla S · Corte holgado · Ajuste seguro · $125.000" sin "undefined", "NaN" ni "[object Object]". El enlace "Cambio talla" del historial abre el formulario de la prenda correcta.

---

### HU-02 Consentimiento de datos personales

Escenarios Gherkin cubiertos. **3 de 3.**

| Escenario | Código | Prueba |
|---|---|---|
| Registro sin casilla de consentimiento. Se rechaza con "El consentimiento es obligatorio" y no se crea la cuenta | backend/routes.js L119-L122 · frontend/js/views/authView.js L191-L194 (no envía el formulario) | Prueba 17 |
| Registro con casilla. Crea la cuenta y deja el registro de auditoría con fecha y versión | backend/routes.js L139-L140 · backend/database.js L326 (`addConsent`, colección `consents`: userId, accepted, policyVersion, acceptedAt) | Prueba 18 |
| La política es consultable desde el registro | backend/config.js L4-L16 (`POLICY` v1.0, Ley 1581 de 2012) · backend/routes.js L110 (`GET /api/policy`) · frontend/js/views/authView.js L151 (casilla no premarcada) y L264 (modal) | Manual |

Detalles.
- Si la versión aceptada no es la vigente, responde 400 con `POLICY_OUTDATED` (backend/routes.js L123-L125).
- **Verificación manual.** Sin la casilla aparece el aviso y no se envía nada (no se creó token). El modal muestra "Versión v1.0" y "Pendiente de revisión legal". Con la casilla se crea la cuenta y redirige a #/empezar.

**Pendiente.** El texto de la política está marcado como **PENDIENTE DE REVISIÓN LEGAL**. Necesita revisión de un abogado antes del piloto. Es una decisión del equipo y no se puede resolver en código.

---

### HU-01 Registro y acceso. Pendientes del Sprint 1

Escenarios Gherkin cubiertos. **3 de 3** (antes 1,5).

| Punto | Código | Prueba |
|---|---|---|
| Mayoría de edad. Fecha de nacimiento obligatoria y menores de 18 rechazados | backend/routes.js L9 (`ageFromBirthDate`) y L126-L132 · frontend/js/views/authView.js L142-L144 (campo con `max`) y L183-L186 | Prueba 19 |
| Correo duplicado. Mensaje exacto "Este correo ya está registrado" con los enlaces "Iniciar sesión" y "Recuperar contraseña" | backend/routes.js L136-L138 (409, `EMAIL_EXISTS`) · frontend/js/views/authView.js L211-L215 | Prueba 20 |
| Recuperación de contraseña. Token de un solo uso que vence en 1 hora. Solo se guarda su hash. El enlace llega a la bandeja de salida | backend/routes.js L147 (`/api/auth/forgot`) y L168 (`/api/auth/reset`) · backend/database.js L344 (`createAuthToken`, SHA-256) y L360 (`consumeAuthToken`) · frontend/js/views/authView.js L46 y L226 · frontend/js/views/accountLinksView.js L23 (#/restablecer) | Pruebas 21 y 22 |
| Verificación de correo. Token por correo, endpoint y campo `emailVerified`. No bloquea el inicio de sesión. Muestra un aviso en el perfil | backend/routes.js L30, L181 y L223 (reenviar) · frontend/js/views/accountLinksView.js L79 (#/verificar) · frontend/js/views/profileView.js L41 | Prueba 23 |

Detalles.
- `/api/auth/forgot` responde igual exista o no el correo, para no revelar qué cuentas existen.
- Las cuentas creadas antes del Sprint 2 (demo y admin) no tienen `emailVerified`, así que no muestran el aviso. Solo las cuentas nuevas lo ven.
- **Verificación manual.** Con un correo duplicado salen el mensaje y los dos enlaces. Un menor de edad ve "Debes ser mayor de 18 años…". El enlace #/verificar muestra "¡Correo verificado!" y el aviso desaparece del perfil. "¿Olvidaste tu contraseña?" lleva el enlace a la bandeja. #/restablecer cambia la contraseña y, al reutilizar el enlace, dice "El enlace no es válido, ya se usó o venció".

---

### HU-10 Calificación de la caja. Pendientes del Sprint 1

Escenarios Gherkin cubiertos. **3 de 3** (antes 2).

| Punto | Código | Prueba |
|---|---|---|
| Ajuste y estilo se califican por separado, de 1 a 5 | backend/routes.js L41 (`parseScore`) y L479-L497 · backend/database.js L545 y L561 (`fitScore`, `styleScore`) · frontend/js/views/boxView.js L395 (dos selectores) y L437 | Prueba 24 |
| Calificación parcial. Se puede calificar solo el ajuste o solo el estilo | Mismo código. Al menos uno es obligatorio y uno fuera de 1-5 da 400 | Prueba 24 |
| Recordatorio a los 3 días sin calificar, sin repetir (`reminderSentAt`) | backend/jobs.js L8 (`runReviewReminders`) y L36 (al arrancar y cada hora) · backend/server.js L74 · backend/routes.js L322 (`POST /api/admin/jobs/review-reminders`) · frontend/js/views/adminView.js L533 (botón) | Prueba 25 |

Revisión pedida en el prompt. **Antes había un solo puntaje (`score`)**, así que se separó.
- `score` se conserva como puntaje general. Si el cliente no lo envía, se calcula como el promedio redondeado de los parciales. El promedio del panel (`averageSatisfaction`, backend/database.js `getAdminMetrics`) no cambia de fórmula.
- La recalibración del perfil (base de HU-11) ahora usa `styleScore` cuando existe y si no `score` (backend/routes.js L503). Así una buena nota de ajuste con mala nota de estilo ya no refuerza el estilo de la prenda.
- El endpoint por lote `/api/boxes/:id/ratings` sigue recibiendo un solo `score`. No lo usa ninguna pantalla actual, así que se dejó igual.
- La caja "no está calificada" si tiene menos calificaciones que prendas y su estado es DELIVERED.
- **Verificación manual.** El modal de "Mi Caja" muestra "Ajuste de la talla" y "Estilo de la prenda" con la opción "Sin calificar por ahora". Sin ninguno sale el aviso. Con solo ajuste se guarda y la tarjeta dice "Ajuste 5/5". Al arrancar el servidor, el job envió recordatorios a las cajas entregadas sin calificar, visibles en la bandeja con "[SIMULADO]". Un segundo clic en "Ejecutar recordatorios" envía 0.

---

### HU-13 Encuesta de salida

Escenarios Gherkin cubiertos. **3 de 3** (antes solo en el prototipo js/screens/plan.js).

| Punto | Código | Prueba |
|---|---|---|
| Al cancelar se pregunta el motivo (precio, estilo no acertó, talla, tiempo, otro) más un comentario opcional | backend/config.js `CANCELLATION_REASONS` · frontend/js/views/profileView.js L189 ("Mi suscripción") y L220 (`openCancelModal`) | Prueba 26 |
| La encuesta no bloquea la cancelación | backend/routes.js L731-L757 (motivo opcional. Un motivo desconocido se guarda como sin respuesta) | Prueba 27 |
| La respuesta queda asociada a la cancelación y hay un conteo agregado para HU-17 | backend/database.js L398 (`addCancellation`, colección `cancellations`) y L412 · backend/routes.js L327 (`GET /api/admin/cancellation-reasons`) · frontend/js/views/adminView.js L406 (pestaña "Motivos de Cancelación") | Prueba 26 |

Detalles.
- La cancelación no existía en el backend. Se creó un `POST /api/subscription/cancel` mínimo y un `GET /api/subscription` (backend/routes.js L726). Cancelar dos veces responde 409.
- **Verificación manual.** En "Mi Perfil", "Mi suscripción" muestra Activa. "Cancelar suscripción" abre la encuesta con los 5 motivos y el botón "Seguir con mi suscripción". Tras confirmar dice "Cancelada el 3/11/2026". En el panel, la pestaña de motivos suma 1 en "El estilo no acertó".

**Pendientes.**
- **Suscripción provisional (HU-08).** Mientras no exista el pago, `getSubscription` (backend/database.js L372) considera ACTIVE a todo usuario con perfil completo. Hay un TODO en el código. HU-08 debe reemplazarlo.
- **Pausa como alternativa (HU-12).** El modal de cancelación todavía no ofrece pausar. Esa opción la agrega HU-12 (Prompt 3).

---

### Observaciones fuera del alcance de este prompt

- **frontend/js/views/profileView.js (formulario de medidas).** Guarda `heightCm`, `weightKg`, `usualSizeTop`, etc. Pero el motor (backend/engine.js `calculateBodyIndex`) lee `profile.measures.height`, `measures.weight` y `measures.usual`. Editar medidas desde "Mi Perfil" no recalibra la talla. No se tocó porque no estaba en el Prompt 1. Se recomienda corregirlo junto con HU-16 (edición de "Mis datos").
- **backend/data/db.json.** Trae unos 10 usuarios `test_…@test.com` que dejaron corridas viejas de las pruebas. Por eso, al arrancar, el job de HU-10 les envía recordatorios simulados. Desde este sprint las pruebas ya no escriben en ese archivo. El equipo decide si limpiarlos (no se borraron para no alterar datos sin consultar).

### Commits de esta sesión (rama `sprint2`)

| Commit | Contenido |
|---|---|
| Fix integración de devoluciones e historial | returnsView.js, historyView.js y el campo `cut` de backend/routes.js |
| HU-02 Consentimiento de datos en el registro | Archivos compartidos del backend (routes.js, database.js, config.js, mail, jobs.js, server.js), tests/api.test.js, api.js, adminView.js, authView.js, CLAUDE.md |
| HU-01 Recuperación de contraseña y verificación de correo | accountLinksView.js, rutas #/restablecer y #/verificar (app.js, index.html) |
| HU-10 Calificación separada de ajuste y estilo | boxView.js |
| HU-13 Encuesta de salida al cancelar | profileView.js |
| Evidencias Sprint 2 Prompt 1 | Este archivo |

Varios archivos compartidos tienen fragmentos de varias HU dentro del mismo bloque de cambios, así que no se pueden separar sin dejar commits intermedios rotos. Por eso van en el commit de HU-02, que es el primero. Lo mismo pasa con authView.js (HU-02 y HU-01) y profileView.js (aviso de verificación de HU-01 y suscripción de HU-13). Las tablas de cada HU dicen qué líneas pertenecen a cada una.
