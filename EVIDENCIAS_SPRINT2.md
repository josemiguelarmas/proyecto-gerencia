# Evidencias Sprint 2. The Clothes Box

Comando de prueba. `npm test` (equivale a `node tests/api.test.js`). Resultado al cierre del Sprint 2 (Prompt 5): **70 de 70 en verde** (15 originales + 12 del Prompt 1 + 15 del Prompt 2 + 11 del Prompt 3 + 8 del Prompt 4 + 9 del Prompt 5). La tabla de las 17 HU está al final de este archivo.

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

---

## Sesión 2. Prompt 2. Catálogo y curaduría (03/11/2026)

### Cambios transversales

| Cambio | Archivos | Motivo |
|---|---|---|
| Las pruebas también copian el catálogo (`TCB_CATALOG_FILE`) | backend/database.js L6, tests/api.test.js L11-L14 | La importación CSV escribe el catálogo. Así `npm test` no modifica backend/data/catalog.json. |
| IDs de caja aleatorios | backend/database.js L591 | Antes el ID salía de los últimos 6 dígitos de `Date.now()`. El servicio batch crea varias cajas en el mismo milisegundo y se repetían IDs. |
| Ajuste de las pruebas viejas 5, 6 y 7 | tests/api.test.js prueba 5 | Desde HU-07 la caja nace PROPOSED y una estilista la aprueba antes de PREPARING. La intención no cambia: las prendas siguen ocultas hasta DELIVERED, y la prueba 5 ahora lo verifica también en PROPOSED. Las pruebas 6, 7 y 14 pasan sin cambios. |
| `totalClients` cuenta solo el rol CLIENT | backend/database.js `getAdminMetrics` | Antes contaba "todo lo que no es ADMIN" y habría incluido a la estilista. |
| Corrección en el quiz | frontend/js/views/onboardingView.js `mount` | app.js llama `mount(root, store)`, pero la vista usaba el segundo argumento como función de re-render. Al elegir estilos se lanzaba un error y la tarjeta no se actualizaba. |

### HU-05 Catálogo

Escenarios Gherkin cubiertos. **2 de 2** (antes 0,5).

| Punto | Código | Prueba |
|---|---|---|
| Modelo de variantes (talla, color, stock) y migración de las 18 prendas con stock 10 | backend/catalog.js L11 (`normalizeProduct`) · scripts/migrate-catalog-variants.js · backend/data/catalog.json (migrado y versionado) · backend/database.js (normaliza al cargar) | Prueba 28 |
| Importación CSV fila por fila con reporte de importadas y errores con motivo | backend/catalog.js L36 (`parseCsv`, sin dependencias) y L75 (`importCatalogCsv`) · backend/routes.js L443 (`POST /api/admin/products/import`) · frontend/js/views/adminView.js L347 (pantalla de carga y tabla de errores) · docs/ejemplo_catalogo.csv | Prueba 29 |
| El motor no elige prendas sin stock en la talla del usuario | backend/engine.js L165 | Prueba 30 |

Detalles.
- Columnas obligatorias: marca, nombre, categoria, estilo, ocasion, talla, color, precio_mayorista, stock. Columnas opcionales: precio_venta, ciudad, corte, tejido, linea, imagen_url. Estilos y ocasiones múltiples se separan con `|`.
- Una fila con la misma marca y nombre de una prenda existente actualiza esa prenda (stock de la variante y precio mayorista). Si no existe, crea una prenda nueva.
- Validaciones por fila: campos vacíos, categoría, talla, estilo, ocasión, precio entero positivo, stock entero ≥ 0 y filas duplicadas dentro del archivo.
- El ejemplo se descarga desde el panel. Lo sirve backend/server.js en `/docs/ejemplo_catalogo.csv`.
- **Verificación manual.** En Panel → Catálogo cargué el ejemplo más una fila con talla XXXL. El reporte dijo "7 filas importadas · 1 con error · 4 prendas nuevas" y mostró la fila 9 con su motivo. Cada prenda muestra su stock por talla y su precio mayorista.

**Pendiente (decisión del equipo).** Las 18 prendas originales no tienen precio mayorista real. Se estimó como **30 % del precio de venta** (`WHOLESALE_RATIO_DEFAULT`, backend/config.js L41) y en el panel aparecen marcadas "(estimado)". Hay que reemplazarlo con el precio real de cada marca, importándolo por CSV.

### HU-06 Motor de recomendación

Escenarios Gherkin cubiertos. **3 de 3** (antes 2,5).

| Punto | Código | Prueba |
|---|---|---|
| Costo objetivo por plan. La caja no lo supera. Si la mejor combinación lo supera, se reemplaza la prenda más cara por la mejor alternativa | backend/config.js L24-L36 · backend/engine.js L143 (`curateBox`) y L182 (bucle de reemplazo) | Pruebas 31 y 32 |
| Explicación guardada por prenda (estilo, ocasión, ajuste, puntaje) y visible en el detalle de la caja y en el panel del estilista | backend/engine.js L103 (`scoreProduct`) y L125 (`explain`) · box.recommendations (backend/routes.js L59 `createCuratedBox`) · frontend/js/views/boxView.js L314 · frontend/js/views/stylistView.js · frontend/js/views/adminView.js L276 | Prueba 33 |
| Servicio batch de la caja del mes | backend/routes.js L455 (`POST /api/admin/boxes/generate-batch`) · frontend/js/views/adminView.js L218 | Prueba 39 |

**Fórmula del costo objetivo** (costo mayorista de las prendas de la caja).

`costo objetivo = precio del plan × (1 − 3,5 % comisión pasarela − 10 % margen mínimo) − 12.000 COP de logística y empaque`

| Plan | Precio | Prendas | Costo objetivo |
|---|---|---|---|
| Esencial | 129.900 | 3 | 100.364 |
| Estilo | 199.900 | 5 | 160.914 |

- **Perfiles sintéticos (prueba 32).** Son 6 perfiles con planes, líneas, cortes y tallas distintas (de S a XXL). Resultado: **100 % de cajas dentro del tope, 100 % con talla disponible y 100 % completas**.
- **Batch.** Toma los clientes con suscripción ACTIVE y perfil completo. Omite a quien tiene una caja en curso o ya tiene la caja del mes. Las cajas nuevas quedan PROPOSED para el estilista.
- **Verificación manual.** El batch generó 11 cajas: "100 % dentro del costo objetivo · 100 % completas". En "Mi Caja", cada prenda revelada muestra "Por qué te la elegimos…". La cola del estilista muestra el costo contra el objetivo (por ejemplo, $92.340 / $100.364).

**Pendientes (decisión del equipo).**
- La logística de 12.000 COP por caja y el margen mínimo del 10 % son supuestos. Con el mayorista al 30 % el tope es alcanzable. Si el mayorista real es mayor (por ejemplo, 50 % del precio de venta), ninguna caja cabe en el tope y el motor las marca como `withinCap: false`. **Esto es una señal sobre la viabilidad del precio del plan que conviene revisar.**
- ~~El batch usa la suscripción provisional de HU-13.~~ Resuelto en el Prompt 3: el batch usa las suscripciones pagadas (ver sesión 3).

### HU-07 Validación del estilista

Escenarios Gherkin cubiertos. **3 de 3** (antes 0).

| Escenario | Código | Prueba |
|---|---|---|
| El estilista aprueba la caja. Queda APPROVED ("Lista para despacho") con quién y cuándo | backend/routes.js L337 · frontend/js/views/stylistView.js | Prueba 38 |
| El estilista reemplaza una prenda con motivo, validando talla y stock del suscriptor. La corrección queda en `corrections` | backend/routes.js L347 · backend/database.js L442 (`addCorrection`) · alternativas en L312 | Prueba 36 |
| El despacho se bloquea si la caja no está aprobada (409 "La caja no ha sido aprobada") | backend/routes.js L691 (simulate-step) y L514 (cambio de estado del admin) | Prueba 35 |
| Rechazo de la propuesta (adicional) | backend/routes.js L378 | Prueba 37 |
| Rol STYLIST y permisos | backend/routes.js L298 (`/api/stylist/*` para STYLIST y ADMIN) · backend/database.js L92 (usuario estilista; desde F5 se siembra con STYLIST_EMAIL y STYLIST_PASSWORD, sin contraseña en el código) | Prueba 34 |

Detalles.
- **Estados.** PROPOSED → APPROVED → PREPARING → SHIPPED → DELIVERED → RATED. Las cajas creadas antes de HU-07 (PREPARING, SHIPPED…) se consideran aprobadas.
- **Rutas del admin.** No permiten pasar una caja a APPROVED ni a PROPOSED (backend/routes.js L505). La aprobación se hace solo desde la cola, para que quede registro de quién y por qué.
- **Registro de cada acción.** Cada acción guarda en `box.reviewLog` quién, rol, cuándo, acción y motivo. Reemplazar y rechazar exigen motivo y además escriben en `corrections`, que usará HU-11.
- **Rechazo.** El motor arma una propuesta nueva sin las prendas rechazadas y la caja vuelve a la cola (`proposalVersion` + 1). Si no hay alternativas, la caja queda con menos prendas y el estilista la ve en la cola.
- **Frontend.**
  - **Pantalla.** Nueva pantalla #/estilista (frontend/js/views/stylistView.js) con la cola, el perfil del suscriptor, las prendas propuestas y su motivo, y botones para aprobar, reemplazar y rechazar.
  - **Acceso.** Hay acceso rápido "Cuenta Estilista" en el login.
  - **Mi Caja.** El cliente ve "Tu estilista está revisando tu selección" y luego "Tu caja está lista para despacho" (frontend/js/views/boxView.js L102).
- **Verificación manual.**
  - **Bloqueo.** Como cliente, "Simular avance" sobre una caja PROPOSED muestra "La caja no ha sido aprobada".
  - **Reemplazo.** Como estilista, reemplazar sin motivo pide escribirlo. Con motivo queda en el historial de revisión.
  - **Aprobación.** Al aprobar, la cola queda vacía. El cliente ve "Lista para despacho" y la prenda reemplazada dice "Elegida por tu estilista: Prefiere colores tierra".
  - **Celular.** La cola se ve bien a 375 px de ancho.

**Pendiente.** En celular la lista de cajas va arriba y el detalle abajo. Con muchas cajas en cola hay que bajar para ver el detalle. Se puede mejorar con un filtro o paginación si la cola crece.

### HU-03 Quiz de estilo

Escenarios Gherkin cubiertos. **3 de 3** (antes 1,5).

| Punto | Código | Prueba |
|---|---|---|
| Guardar el progreso parcial en el backend y retomar desde la pregunta donde quedó al volver a iniciar sesión | backend/routes.js L614 y L618 (`/api/quiz/progress`) · backend/database.js L458 · frontend/js/views/onboardingView.js L153 y L160 (`resumeOrStart`) | Prueba 40 |
| Juego de estilos ocultos (6 rondas de dos fotos). El resultado se guarda como pesos del perfil (`styleWeights`) y el motor lo usa | frontend/js/views/onboardingView.js L108 y L127 · backend/engine.js L103 (bono por peso) | Pruebas 41 y 42 |
| Repetir el quiz crea una nueva versión del perfil y conserva las anteriores con fecha | backend/routes.js L591 · backend/database.js L503 (`archiveProfileVersion`) · backend/routes.js L629 (`/api/profile/history`) · frontend/js/views/onboardingView.js L179 (`startRepeat`) · frontend/js/views/profileView.js L192 y L207 | Prueba 41 |
| Tiempo de completado (inicio y fin) visible en el panel admin, con meta de 3 minutos | backend/database.js L475 y L488 · backend/routes.js L417 · frontend/js/views/adminView.js L101 | Prueba 41 |

Detalles.
- El quiz pasa de 3 a 4 pasos: estilos, juego, ocasión/plan y medidas. El juego se puede saltar.
- El tiempo corre desde que la persona abre el quiz con sesión iniciada (se crea la sesión) hasta que guarda el último paso.
- **Verificación manual.**
  - **Retomar.** Hice 2 rondas del juego, cerré sesión y volví a entrar. El quiz retomó en "Ronda 3 de 6" con el aviso "Retomamos tu quiz donde quedaste".
  - **Terminar.** Al terminar dijo "¡Perfil guardado en 0:18 min!" y la caja quedó en revisión del estilista.
  - **Repetir.** "Repetir quiz de estilo" en el perfil guardó la v2 y listó la "v1 · hasta el 3/11/2026".
  - **Panel.** Muestra "TIEMPO DEL QUIZ 0:11 min · Meta 3:00 min".

**Pendiente.** El quiz exige sesión iniciada (ya era así antes de este sprint). Una persona sin cuenta no tiene progreso guardado. Si el equipo quiere un quiz sin registro previo, hay que definir dónde guardar ese progreso.

### Commits de esta sesión (rama `sprint2`)

| Commit | Contenido |
|---|---|
| HU-05 Variantes de catálogo con stock e importación CSV | backend/catalog.js, migración, catalog.json, docs/ejemplo_catalogo.csv, servidor del CSV, backend/config.js, backend/database.js, backend/engine.js, backend/routes.js, tests/api.test.js, api.js, adminView.js (archivos compartidos) |
| HU-07 Rol estilista, estados de caja y cola de curaduría | stylistView.js, estilos, rutas y navegación (app.js, index.html, authView.js), db.json con el usuario estilista |
| HU-06 Motivo de cada prenda en Mi Caja | boxView.js |
| HU-03 Juego de estilos, progreso y versiones del perfil | onboardingView.js, profileView.js |
| Evidencias Sprint 2 Prompt 2 | Este archivo |

Igual que en la sesión 1, los archivos compartidos mezclan las cuatro HU dentro de los mismos bloques de cambios. Van en el primer commit (HU-05) y las tablas de arriba dicen qué líneas pertenecen a cada HU.


---

## Sesión 3. Prompt 3. Suscripción, pagos y facturación (04/11/2026)

### Cambios transversales

| Cambio | Archivos | Motivo |
|---|---|---|
| Módulo de suscripción y cobro | backend/billing.js (nuevo) | Concentra la máquina de estados, los cobros, la conciliación y la facturación. Las rutas solo llaman a sus funciones, y las pruebas pueden pasarle una fecha (`now`) para simular el paso del tiempo. |
| Adaptadores simulados | backend/payments/index.js (`PAYMENT_PROVIDER=simulated`) · backend/invoicing/index.js (`INVOICING_PROVIDER=simulated`) | Igual que el correo: la interfaz es la que tendría un proveedor real y el proveedor se elige por variable de entorno. Todo lo que generan dice SIMULADO. Sin dependencias nuevas (HMAC y hashes con `crypto` de Node). |
| La suscripción ya no se deriva del perfil | backend/database.js L415 (`getSubscription`) | Antes un perfil completo contaba como ACTIVE (TODO de HU-13). Ahora la suscripción nace con el primer pago aprobado; sin registro el estado es NONE. |
| Suscripción del cliente demo | backend/database.js L102 · backend/data/db.json | demo@theclothesbox.co queda ACTIVE con la tarjeta de prueba 4242 y datos fiscales de ejemplo, para que la demo siga funcionando sin pagar. Se crea sola al arrancar, como la estilista. |
| Batch de cajas solo para suscripciones al día | backend/routes.js L504 | Omite a quien está en pausa, en mora o con un cobro en reintento, con el motivo en el reporte. Cierra el pendiente de HU-06. |
| Jobs de cobro y reintento de facturas | backend/jobs.js L38 | Corren al arrancar y cada hora junto al recordatorio de HU-10. Solo actúan sobre lo vencido, así que correrlos seguido no cobra dos veces. |
| Estilos de avisos | frontend/css/screens.css (final) | Las clases `banner--info`, `banner--warn` y `banner--danger` se usaban en varias pantallas pero no tenían estilo. Se definieron con los colores de tokens.css porque los avisos de pago, pausa y mora deben verse. Las pantallas viejas que ya las usaban también se ven mejor. |
| Ajuste de pruebas viejas 26, 27 y del ayudante `newClient` | tests/api.test.js L404, L421 y L447 | Esas pruebas cancelaban o generaban cajas para usuarios con la suscripción derivada del perfil. Ahora primero pagan con la tarjeta 4242 (`subscribeWith`, L84). La intención de cada prueba no cambia. |

### HU-08 Plan y pago recurrente

Escenarios Gherkin cubiertos. **3 de 3** (antes 0).

| Escenario | Código | Prueba |
|---|---|---|
| Pago aprobado: cobra COP 129.900 (Esencial) o COP 199.900 (Estilo), deja la suscripción ACTIVE y manda la confirmación a la bandeja de salida | backend/billing.js L264 (`subscribe`) y L227 (`chargeSubscription`) · backend/routes.js L1093 · frontend/js/views/subscribeView.js | Pruebas 43 y 44 |
| Pago rechazado: responde el motivo (402) y no activa | backend/payments/index.js L90 (`charge`) · backend/billing.js L288 | Prueba 45 |
| Cobro recurrente que falla: reintenta a 1, 3 y 5 días, pasa a PAST_DUE y avisa para actualizar el medio de pago | backend/billing.js L338 (`billOne`) y L397 (`runRecurringBilling`) · backend/config.js L64 (`PAYMENT_RETRY_DAYS`) · backend/routes.js L552 (endpoint manual) · actualizar tarjeta: backend/billing.js L422 y backend/routes.js L1110 | Prueba 46 |
| Pagos con comisión del 3,5 %, webhook con firma HMAC y conciliación; reporte de comisión en el panel | backend/billing.js L192 (`processPaymentWebhook`) y L507 (`paymentsReport`) · backend/payments/index.js L123 y L131 · backend/routes.js L210 (webhook) y L542 · frontend/js/views/adminView.js L499 (pestaña Pagos) | Prueba 47 |

Detalles.
- **Interfaz del adaptador.** `tokenize`, `charge` con llave de idempotencia, `buildWebhook` y `verifyWebhook` (HMAC-SHA256 con `PAYMENT_WEBHOOK_SECRET`). `describeToken` devuelve marca y últimos 4.
- **Tarjetas de prueba** (backend/payments/index.js L9). 4242 4242 4242 4242 aprueba. 4000 0000 0000 0002 rechaza con "Fondos insuficientes". 4000 0000 0000 0341 aprueba el primer cobro y rechaza los recurrentes. Cualquier otra tarjeta válida (Luhn) aprueba.
- **Datos de tarjeta.** El número y el CVV llegan solo a `POST /api/payments/tokenize` (backend/routes.js L1087), que los valida y devuelve un token. No se guardan ni se registran. La suscripción guarda token, marca y últimos 4, y el token no se devuelve al cliente (`publicSubscription`, backend/billing.js L63). La prueba 44 busca el número completo y el CVV dentro de la base y no los encuentra. El formulario borra número, vencimiento y CVV después de tokenizar.
- **Idempotencia.** Cada cobro tiene una llave: `initial_<usuario>_<fecha>_<token>`, `recurring_<suscripción>_<periodo>` y `..._r<n>` para cada reintento. La pasarela simulada y la colección `payments` devuelven el mismo resultado si la llave se repite. La prueba 46 corre el cobro varias veces y verifica que hay exactamente un pago por intento.
- **Reintentos.** Mientras se reintenta, la suscripción sigue ACTIVE con `dunning` (fecha del primer fallo, intentos, próximo reintento) y el cliente ve el aviso. Al fallar el último reintento pasa a PAST_DUE y se envía `PAYMENT_PAST_DUE`. Con otra tarjeta el cobro pendiente se hace en el acto y vuelve a ACTIVE.
- **Conciliación.** Cada pago nace con conciliación PENDING. El proveedor simulado entrega su webhook firmado apenas cobra y pasa por la misma verificación que el endpoint. Si estado y monto coinciden queda OK; si no, MISMATCH con el detalle. Una firma inválida responde 401.
- **Pantalla.** #/suscripcion (frontend/js/views/subscribeView.js): plan, tarjeta y datos fiscales, con el aviso "Pago SIMULADO" y las tarjetas de prueba. Al terminar el quiz, si no hay suscripción pagada, la app lleva a esta pantalla (frontend/js/views/onboardingView.js L510).
- **Verificación manual.**
  - **Rechazo.** Con un cliente nuevo pagué con 0002. La pantalla mostró "El pago fue rechazado: Fondos insuficientes. Tu suscripción no se activó." y borró los datos de la tarjeta.
  - **Aprobación.** Con 4242 llevó a "Mi Caja". El perfil mostró "Plan Esencial · COP 129.900/mes · Activa · Visa •••• 4242 (SIMULADO) · Próximo cobro: 4 de diciembre de 2026".
  - **Mora.** Un cliente con 0341. En Panel → Pagos ejecuté el cobro con fecha simulada 5/12/2026: "1 aprobados · 1 rechazados con reintento programado". Con los días 6, 8 y 10 quedó en pago pendiente. Como ese cliente vi el aviso rojo, actualicé la tarjeta a 4242 y volvió a Activa con el mensaje "Pago aprobado con Visa terminada en 4242".
  - **Reporte.** Panel → Pagos muestra cobrado, comisión, neto, conciliados y la tabla por mes.
  - **Celular.** La pantalla de pago a 375 px no tiene scroll horizontal.

**Pendientes.**
- **Tokenización en el navegador.** Con una pasarela real (por ejemplo, Wompi), la tarjeta va del navegador a la pasarela y el backend solo recibe el token. Aquí el backend simula ese paso. Al conectar la pasarela real hay que mover la tokenización al navegador.
- **Pagos durante la mora (decisión del equipo).** Mientras se reintenta un cobro no se generan cajas nuevas (el batch la omite). Falta definir si una caja ya aprobada se despacha durante los reintentos. Hoy solo se bloquea el despacho en pausa.
- **Paso del quiz al pago.** No recorrí el quiz completo a mano en esta sesión: la pantalla de pago la abrí directamente. El cambio en onboardingView.js es la redirección al terminar.

### HU-12 Pausar, cambiar plan o cancelar

Escenarios Gherkin cubiertos. **3 de 3** (antes solo en el prototipo js/screens/plan.js).

| Escenario | Código | Prueba |
|---|---|---|
| Pausar 1 mes: no cobra ni despacha ese mes y se reanuda sola | backend/billing.js L448 (`pause`), L459 (`resume`) y L397 (reanudación automática en `runRecurringBilling`) · backend/routes.js L1122 · bloqueo de despacho en backend/routes.js L773 · batch en L504 | Prueba 49 |
| Cambiar de plan antes del día de corte aplica desde la próxima caja; después del corte, en el ciclo siguiente | backend/billing.js L469 (`planChangeEffect`) y L479 (`changePlan`) · aplicación del cambio programado en `billOne` (L338) · backend/config.js L68 (`SUBSCRIPTION_CUTOFF_DAY`, 25) | Prueba 50 |
| Cancelar detiene los cobros futuros; antes de confirmar se ofrece pausar; se conecta la encuesta de HU-13 | backend/routes.js L1142 · frontend/js/views/profileView.js L327 (`openPauseInsteadModal`) y L442 (encuesta) | Prueba 51 |
| Matriz de transiciones con las válidas y las inválidas, incluido PAST_DUE | backend/billing.js L39 (`TRANSITIONS`), L51 y L56 | Prueba 48 |

**Matriz de transiciones** (las demás combinaciones responden 409 con el estado actual).

| Acción | Desde | Hacia |
|---|---|---|
| Suscribirse | NONE, CANCELLED | ACTIVE |
| Pausar | ACTIVE (sin cobro en reintento) | PAUSED |
| Reanudar | PAUSED (manual o automático) | ACTIVE |
| Cambiar plan | ACTIVE, PAUSED | el mismo estado |
| Cancelar | ACTIVE, PAUSED, PAST_DUE | CANCELLED |
| Actualizar medio de pago | ACTIVE, PAUSED, PAST_DUE | ACTIVE si el cobro pendiente se aprueba |
| Cobro fallido tras los reintentos (sistema) | ACTIVE | PAST_DUE |

Detalles.
- **Pausa.** Se salta el próximo cobro y su caja. `pausedUntil` = fecha de ese cobro + 1 mes, y ahí vuelve el cobro. Reanudar antes recupera el cobro saltado si aún no pasó.
- **Cambio de plan.** Antes del día 25 cambia el plan de la suscripción y del perfil, así que la próxima caja y el próximo cobro usan el plan nuevo. Desde el día 25 queda como `pendingPlan` desde el cobro siguiente al próximo. Elegir de nuevo el plan actual deshace un cambio programado.
- **Cancelar.** Borra la próxima fecha de cobro, el cambio programado y los reintentos. Se puede volver a suscribir.
- **Pantalla.** "Mi Perfil › Mi suscripción" (frontend/js/views/profileView.js L249). Muestra estado, tarjeta, próximo cobro y avisos de pausa, reintento, mora o cambio programado. Los botones dependen del estado. Incluye la tabla de pagos y facturas.
- **Verificación manual.**
  - **Cancelar.** "Cancelar suscripción" abrió primero "¿Prefieres pausar un mes?".
  - **Pausar.** Elegí pausar y el perfil mostró "En pausa… Se reanuda solo el 4 de enero de 2027" con "Reanudar ahora".
  - **Cambiar plan.** El modal explicó que hoy es antes del día de corte y que el cambio aplica desde la próxima caja. Confirmé Estilo y quedó "Plan Estilo · COP 199.900/mes".
  - **Mora.** En pago pendiente solo aparecen "Actualizar medio de pago" y "Cancelar".

**Pendientes.**
- **Cambio de plan después del corte.** Hoy es 4 de noviembre, así que en pantalla solo verifiqué el caso antes del corte. El caso después del corte está cubierto en la prueba 50 con fechas fijas (10 y 26 de noviembre).
- **Saldo a favor (decisión del equipo).** El prototipo ofrecía "saltar un mes" con saldo a favor. Aquí la pausa no cobra ese mes, así que no se genera saldo. Hay que confirmar si se mantiene así.
- **Pausas de más de un mes.** Duran 1 mes (`PAUSE_MONTHS`). El prototipo permitía elegir varios meses. Falta confirmar si se necesita.

### HU-15 Facturación electrónica

Escenarios Gherkin cubiertos. **2 de 2** (antes 0).

| Escenario | Código | Prueba |
|---|---|---|
| Tras cada cobro exitoso se genera la factura con consecutivo, datos fiscales, IVA y total, marcada SIMULADO, y se manda a la bandeja de salida | backend/billing.js L152 (`invoiceForPayment`) y L126 (`tryIssue`) · backend/invoicing/index.js L10 · backend/database.js L468 (`addInvoice`, consecutivo) | Prueba 52 |
| Datos fiscales del suscriptor (tipo y número de documento, dirección y ciudad) en el pago o en el perfil | backend/billing.js L78 (`validateFiscal`) · backend/routes.js L1133 · frontend/js/views/subscribeView.js (paso 3) · frontend/js/views/profileView.js L204 y L416 | Prueba 52 |
| Si el proveedor falla (`INVOICING_FAIL=1`), la factura queda PENDING_RETRY con reintentos y una alerta visible en el panel | backend/billing.js L112 (`alertTeam`) y L176 (`runInvoiceRetries`) · backend/database.js L487 · backend/config.js L73 (`INVOICE_RETRY_MINUTES`) · backend/routes.js L558 y L567 · frontend/js/views/adminView.js L582 (pestaña Facturación) | Prueba 53 |

Detalles.
- **Número.** Prefijo SETT (el que usa el ambiente de habilitación de la DIAN) y consecutivo sin saltos (`SETT-1`, `SETT-2`…). El CUFE es un SHA-384 simulado.
- **IVA.** El precio del plan incluye IVA del 19 %: subtotal = total / 1,19 y el IVA es la diferencia. Esencial: 109.160 + 20.740 = 129.900.
- **El cobro no depende de la factura.** Si el proveedor falla, el pago queda aprobado y la factura entra a la cola. Los reintentos son a los 5, 30 y 120 minutos. Al agotarlos queda FAILED con la alerta abierta para revisión manual.
- **Datos fiscales al reintentar.** Cada reintento vuelve a leer los datos fiscales del usuario. Si faltaban y la persona los completa en el perfil, el reintento ya los usa.
- **Alertas.** Se ven en Panel → Facturación (la pestaña muestra el número de alertas) y llegan como `INVOICE_ALERT` a operaciones@theclothesbox.co en la bandeja simulada. Se cierran solas al emitirse la factura.
- **Verificación manual.**
  - **Falla.** Arranqué el servidor con `INVOICING_FAIL=1` y un cliente pagó el plan Estilo con NIT 900123456-7. El pago quedó aprobado y la factura SETT-5 en "Pendiente de reintento · intento 1". El panel mostró "Facturación (1 alertas)" y el banner rojo con el motivo.
  - **Reintento.** Sin la variable, el reintento emitió SETT-5, cerró la alerta y mandó "[SIMULADO] Tu factura electrónica SETT-5" a la bandeja.
  - **Tabla.** Muestra subtotal, IVA y total de cada factura (por ejemplo, $167.983 + $31.917 = $199.900).

**Pendientes (decisión del equipo).**
- **Tratamiento tributario.** Falta validar con un contador que el precio incluye IVA del 19 % y que la tarifa aplica a la suscripción como servicio con prendas.
- **Datos del emisor.** Razón social y NIT son de ejemplo (backend/config.js, `ISSUER`).
- **Proveedor real.** Al conectarlo se necesitan la resolución de numeración de la DIAN, el rango autorizado y el certificado de firma.
- **Factura FAILED.** No hay botón para emitirla a mano desde el panel. Hoy se corrige la causa y se reintenta por el endpoint.

### Commits de esta sesión (rama `sprint2`)

| Commit | Contenido |
|---|---|
| HU-08 Pago recurrente simulado con reintentos y conciliación | backend/payments/, backend/billing.js, backend/invoicing/ (billing lo carga), backend/config.js, backend/database.js, backend/jobs.js, backend/routes.js, backend/data/db.json, tests/api.test.js, subscribeView.js, api.js, app.js, index.html, onboardingView.js, adminView.js, screens.css (archivos compartidos) |
| HU-12 Pausar, cambiar plan o cancelar desde Mi suscripción | profileView.js (sección "Mi suscripción") |
| HU-15 Datos fiscales en el perfil | profileView.js (sección "Datos de facturación") |
| Evidencias Sprint 2 Prompt 3 | Este archivo |

Igual que en las sesiones anteriores, backend/billing.js y las rutas mezclan las tres HU. Van en el primer commit (HU-08) y las tablas de arriba dicen qué líneas pertenecen a cada HU. El adaptador de facturación va en ese mismo commit porque billing.js lo carga y, sin él, el commit no arrancaría.


---

## Sesión 4. Prompt 4. Logística (04/11/2026)

### Cambios transversales

| Cambio | Archivos | Motivo |
|---|---|---|
| Módulo de logística | backend/logistics.js (nuevo) | Concentra el bloqueo del despacho, la guía, el stock por variante y los cambios por talla. Lo usan el avance del cliente (`simulate-step`) y el cambio de estado del administrador, así ambos aplican las mismas reglas. |
| Adaptador del operador logístico | backend/shipping/index.js (`SHIPPING_PROVIDER=simulated`) | Genera guías de despacho y de devolución inversa marcadas "Operador logístico SIMULADO". Sin dependencias nuevas. El consecutivo diario lo asigna backend/logistics.js L91 contando las guías ya guardadas. |
| Movimientos de inventario | backend/database.js L23 (`inventoryMovements`) · backend/logistics.js L68 (`moveStock`) · backend/routes.js L608 | Cada salida por despacho, reserva por cambio y reingreso por devolución queda registrada con stock antes y después, motivo y referencia. |
| Ajuste de la prueba vieja 5 | tests/api.test.js L159 | El cliente de las pruebas 5 a 7 no tenía suscripción pagada y desde HU-09 no se le despacha. Ahora la prueba primero verifica el 409 "Pago no confirmado" y luego paga con 4242. Lo que comprueba la prueba (prendas ocultas hasta la entrega) no cambia. La prueba 26 ya no paga de nuevo; verifica que la suscripción sigue activa. |
| Ajuste de la prueba vieja 28 | tests/api.test.js L462 | Revisaba stock 10 en el catálogo en memoria. Desde HU-09 los despachos de las pruebas anteriores descuentan stock, así que ahora revisa el catálogo versionado (backend/data/catalog.json), que es lo que dejó la migración. |
| Talla recibida en "Devoluciones" | backend/routes.js L1003 | Antes la talla de cada prenda se recalculaba con el perfil actual. Al pedir un cambio, el perfil se recalibra y la talla mostrada cambiaba (en la verificación manual, el jean pasó de M a L). Ahora se muestra la talla que se despachó. El historial muestra el nombre de la prenda en lugar de su ID. |

### HU-09 Despacho y seguimiento

Escenarios Gherkin cubiertos. **3 de 3** (antes 1,5).

| Escenario | Código | Prueba |
|---|---|---|
| Despacho de caja aprobada: genera la guía `TCB-AAAAMMDD-0001` con el operador simulado, guarda `trackingNumber`, descuenta el stock de las variantes y manda el número al suscriptor | backend/logistics.js L102 (`shipBox`) y L141 (`advanceBox`) · backend/shipping/index.js L27 · backend/routes.js L598 (admin) y L784 (cliente) | Prueba 54 |
| Seguimiento: el suscriptor ve guía, operador, entrega estimada y los eventos (preparación, despacho, entrega), y recibe los avisos de despachada y entregada | backend/logistics.js L141 · backend/routes.js (`/api/boxes/current`, campos `carrier`, `trackingEvents`) · frontend/js/views/boxView.js L150 | Prueba 55 |
| Pago no confirmado: si la caja no está APPROVED responde 409 "La caja no ha sido aprobada"; si el pago del ciclo no está confirmado, 409 "Pago no confirmado" | backend/logistics.js L37 (`paymentStatus`) y L47 (`dispatchBlock`) | Prueba 56 |
| Vista "Cajas por despachar" con lista de picking y empaque | backend/logistics.js L169 (`dispatchQueue`) · backend/routes.js L603 · frontend/js/views/adminView.js L508 y L815 | Prueba 57 |

Detalles.
- **Pago del ciclo confirmado.** La suscripción está ACTIVE, sin cobro en reintento y con el próximo cobro en el futuro. Sin suscripción, en mora (PAST_DUE), con reintento o cancelada responde "Pago no confirmado". En pausa se mantiene el mensaje de HU-12.
- **Dónde se bloquea.** Al salir de bodega: de APPROVED a PREPARING, SHIPPED o DELIVERED, y de PREPARING a SHIPPED. Aplica igual al botón del cliente y al cambio de estado del administrador. Si el administrador pasa una caja directo a DELIVERED, la guía y el descuento de stock se hacen igual.
- **Stock.** Al despachar, por cada prenda se descuenta 1 en la variante de la talla del suscriptor (la del color con más stock) y la caja guarda `shippedVariants` (prenda, talla y color). Ese dato se usa para el reingreso de HU-14.
- **Avisos.** `BOX_SHIPPED` con número de guía, operador y entrega estimada (2 días hábiles), y `BOX_DELIVERED` con la guía y el plazo de cambio. Ambos en la bandeja de salida.
- **Picking.** "Cajas por despachar" agrupa por prenda, talla y color con la cantidad y el stock, y marca "falta stock" si no alcanza. Cada caja muestra el suscriptor, la dirección, sus prendas y si el pago está confirmado. Los botones se desactivan cuando la caja está bloqueada.
- **Verificación manual.**
  - **Cajas.** Preparé dos clientes con caja aprobada: Lucía con pago y Mateo sin pago. En Panel → Por despachar aparecieron las dos, con un picking de 6 prendas. Mateo decía "Pago no confirmado" y tenía los botones desactivados.
  - **Despacho.** "Marcar despachada y generar guía" en la caja de Lucía mostró "Caja despachada con guía TCB-20261104-0001. Aviso enviado al suscriptor." y el stock de esas prendas bajó de 10 a 9.
  - **Seguimiento.** Como Lucía, "Mi Caja" mostró la guía, "Operador logístico SIMULADO", entrega estimada el viernes 6 de noviembre y el evento "Guía generada y paquete recogido".
  - **Avisos.** Al entregar, la bandeja tenía `BOX_SHIPPED` y `BOX_DELIVERED`, ambos con la guía.
  - **Celular.** La pestaña se ve a 375 px sin scroll horizontal de la página; la tabla de picking se desplaza dentro de su recuadro.

**Pendientes.**
- **Color de la prenda.** El motor elige la prenda y la talla, pero no el color. Al despachar se toma la variante con más stock en esa talla. Si el equipo quiere que el estilista elija el color, hay que agregarlo a HU-07.
- **Stock negativo.** Si no hay stock al despachar, la variante queda en 0 (no negativa) y el picking avisa "falta stock", pero el despacho no se bloquea. Falta decidir si debe bloquearse.
- **Cancelada con caja aprobada (decisión del equipo).** Una caja aprobada de una suscripción cancelada no se despacha ("Pago no confirmado") aunque el ciclo se haya pagado antes de cancelar.

### HU-14 Cambio o devolución por talla

Escenarios Gherkin cubiertos. **3 de 3** (antes 0,5).

| Escenario | Código | Prueba |
|---|---|---|
| Plazo único de 5 días hábiles desde la entrega, validado en el backend; fuera de plazo responde 422 con las condiciones del cambio | backend/config.js L35 y L80 (`RETURN_WINDOW_BUSINESS_DAYS`, `RETURN_CONDITIONS`) · backend/logistics.js L211 (`returnDeadline`) y L226 · backend/routes.js L206 (`/api/config`) y L1014 · frontend/js/views/returnsView.js L16, L102 y L323 | Prueba 58 |
| Con stock en la talla pedida: guía de devolución inversa y envío programado de la otra talla | backend/logistics.js L226 (`requestReturn`) · backend/shipping/index.js L42 · backend/routes.js L1033 · frontend/js/views/returnsView.js L138 | Prueba 59 |
| Sin stock en la talla pedida: la respuesta ofrece una prenda equivalente o devolver, y el frontend deja elegir | backend/logistics.js L218 (`equivalentsFor`) · frontend/js/views/returnsView.js L304 | Prueba 60 |
| Reingreso de inventario: al marcar la prenda recibida, el stock de esa variante sube en 1 y queda el motivo | backend/logistics.js L333 (`receiveReturn`) · backend/routes.js L630 · frontend/js/views/adminView.js L467 (estado "Prenda recibida") | Prueba 61 |

Detalles.
- **Una sola constante.** El plazo es `RETURN_WINDOW_BUSINESS_DAYS` (5, configurable por variable de entorno). El backend lo usa para validar y el frontend lo lee de `GET /api/config`, así que la vista ya no dice "15 días". La fecha límite es el fin del quinto día hábil después de la entrega (viernes 6 → viernes 13 de noviembre).
- **Fuera de plazo.** El backend responde 422 con `code: RETURN_WINDOW_EXPIRED`, la fecha límite y las condiciones del cambio. En la vista, cada prenda muestra hasta cuándo se puede pedir el cambio; fuera de plazo el botón se cambia por "Fuera de plazo".
- **Guías.** La devolución inversa usa `TCB-DEV-AAAAMMDD-0001`. Cuando se envía una talla o prenda de reemplazo, ese envío tiene su propia guía `TCB-AAAAMMDD-NNNN`, que sigue el consecutivo de los despachos. El cliente ve las dos en el historial y le llega el aviso `RETURN_SCHEDULED`.
- **Con stock.** Se reserva 1 unidad de la talla pedida (movimiento `EXCHANGE_OUT`) y el envío queda programado para la fecha de recogida.
- **Sin stock.** La respuesta es 409 con `code: NO_STOCK_IN_SIZE` y hasta 3 prendas equivalentes: misma categoría, con stock en la talla pedida, que el cliente no haya recibido, ordenadas por el puntaje del motor. El modal muestra esas opciones y "Solo devolver la prenda", y el cliente envía su elección.
- **Un cambio por prenda.** Si se repite la solicitud para la misma prenda de la misma caja, responde 409.
- **Reingreso.** Al pasar a RECEIVED (o a COMPLETED si se saltó RECEIVED) la variante despachada sube 1, con el motivo de talla, y queda el movimiento `RETURN_IN`. Solo ocurre una vez.
- **Verificación manual.**
  - **Plazo.** "Devoluciones" dice "Plazo de cambio: 5 días hábiles desde la entrega", y cada prenda dice "Puedes pedir el cambio hasta el miércoles, 11 de noviembre" (entregada el miércoles 4).
  - **Sin stock.** Con la importación CSV del panel dejé en 0 la camiseta Punto Blanco talla L. Al pedirla en L, el modal mostró "No tenemos … en talla L" con 3 prendas equivalentes y "Solo devolver la prenda". Elegí la Camisa de Lino y quedó "Recogeremos la prenda (guía TCB-DEV-20261104-0001) y te enviaremos Camisa de Lino Manga Corta Resort en talla L".
  - **Con stock.** El jean de M a L quedó con la guía TCB-DEV-20261104-0002 y el envío de la nueva talla. El historial muestra las dos guías de cada solicitud.
  - **Reingreso.** En Panel → Devoluciones marqué el jean como "Prenda recibida (reingresa stock)". La talla M pasó de 9 a 10 y quedó el movimiento `RETURN_IN M TOO_SMALL 9→10`.
  - **Fuera de plazo.** El 422 solo lo cubre la prueba 58: en pantalla una prenda vencida ya no tiene botón.

**Pendientes (decisión del equipo).**
- **Festivos.** Los días hábiles cuentan de lunes a viernes, sin festivos colombianos. Hay que decidir si se cargan los festivos.
- **Solo devolver.** No hay compensación definida: la solicitud queda con `creditPending: true`. El equipo debe decidir si se da saldo a favor, se descuenta del siguiente cobro o no aplica.
- **Equivalente con otro precio.** La prenda equivalente puede tener otro precio mayorista. No se valida que quepa en el costo objetivo de la caja (HU-06).
- **Estado en el panel.** Al cambiar el estado de una devolución, la tabla del panel no se refresca sola (ya era así antes); se ve al recargar.

### Commits de esta sesión (rama `sprint2`)

| Commit | Contenido |
|---|---|
| HU-09 Despacho con guía simulada, stock y cola de picking | backend/shipping/, backend/logistics.js, backend/config.js, backend/database.js, backend/routes.js, tests/api.test.js, api.js, adminView.js, boxView.js (archivos compartidos) |
| HU-14 Plazo de 5 días hábiles, guías inversas y elección sin stock | returnsView.js |
| Evidencias Sprint 2 Prompt 4 | Este archivo |

Igual que en las sesiones anteriores, backend/logistics.js y las rutas mezclan las dos HU. Van en el primer commit (HU-09) y las tablas de arriba dicen qué líneas pertenecen a cada HU.


---

## Sesión 5. Prompt 5. Cumplimiento y métricas (04/11/2026)

### Cambios transversales

| Cambio | Archivos | Motivo |
|---|---|---|
| Módulos nuevos | backend/privacy.js (HU-16), backend/learning.js (HU-11), backend/metrics.js (HU-17) | Igual que billing.js y logistics.js: las rutas solo llaman a sus funciones y las pruebas pueden usarlas directamente. Sin dependencias nuevas. |
| Colecciones `dataRequests` y `settings` | backend/database.js L23, L499 (`addDataRequest`) y L517 (`getSetting`, `setSetting`) | Registro de solicitudes del titular y ajustes editables desde el panel (umbral de churn). |
| El manejador de errores devuelve `code` | backend/routes.js L1236 | Antes solo devolvía el mensaje. Ahora incluye el código (por ejemplo `EMAIL_EXISTS` o `PENDING_CHARGE`) cuando el error lo trae, para que el frontend reaccione. Las respuestas que ya tenían su propio código no cambian. |
| Historial de altas y bajas en la suscripción | backend/billing.js L307 · backend/routes.js L1216 · backend/privacy.js (cancelación al eliminar) | El churn mensual necesita saber quién estaba activo al inicio de cada mes, aun si se canceló y volvió a suscribirse. Las suscripciones viejas sin historial se reconstruyen con `startedAt` y `cancelledAt` (backend/metrics.js L16). |
| Sesión inválida tras eliminar la cuenta | backend/auth.js L42 | Un token emitido antes de eliminar la cuenta deja de servir. |
| La factura conserva los datos fiscales si el titular se elimina | backend/billing.js L129 | Un reintento de factura no debe tomar los datos anonimizados. |
| Ninguna prueba vieja cambió | tests/api.test.js | Las 61 pruebas anteriores pasan sin ajustes. |

### HU-16 Derechos del titular

Escenarios Gherkin cubiertos. **2 de 2** (antes 0,5).

| Escenario | Código | Prueba |
|---|---|---|
| "Mis datos" permite editar nombre y correo, con validación y correo único | backend/privacy.js L18 (`updateAccount`) · backend/routes.js L1165 (`PUT /api/account`) · frontend/js/views/profileView.js L590 (formulario "Información de Cuenta") | Prueba 62 |
| Eliminar cuenta con contraseña: bloqueo si hay cobro pendiente; si procede, anonimiza nombre, correo, perfil y medidas, conserva facturas y pagos, cancela la suscripción y manda la confirmación | backend/privacy.js L92 (`deleteAccount`) · backend/routes.js L1181 · frontend/js/views/profileView.js L205 y L469 | Pruebas 64 y 65 |
| Exportación en JSON de datos personales, perfil, cajas y calificaciones | backend/privacy.js L58 (`exportData`) · backend/routes.js L1176 (`GET /api/profile/export`) · frontend/js/views/profileView.js L453 | Prueba 63 |
| Colección `dataRequests` con tipo, fecha y tiempo de respuesta, y vista en el panel | backend/database.js L499 · backend/privacy.js L150 · backend/routes.js L553 · frontend/js/views/adminView.js L594 (pestaña "Solicitudes de datos") | Prueba 65 |

Detalles.
- **Correo nuevo.** Queda sin verificar, se manda el enlace de verificación al correo nuevo y un aviso `EMAIL_CHANGED` al anterior. Un correo ya registrado responde 409 "Este correo ya está registrado".
- **Cobro pendiente.** La cuenta no se elimina si la suscripción está PAST_DUE o tiene un cobro en reintento. Responde 409 `PENDING_CHARGE` con el mensaje de qué hacer, y la solicitud queda registrada como bloqueada.
- **Qué se anonimiza.** Nombre ("Usuario eliminado"), correo (`eliminado_<id>@anonimo.invalid`), contraseña, fecha de nacimiento y datos fiscales del usuario. Se borran el perfil y las medidas, el historial de versiones, las sesiones del quiz y los tokens. Las direcciones de cajas y devoluciones quedan como "Dirección anonimizada" y se borran los comentarios de las calificaciones.
- **Qué se conserva.** Los pagos y las facturas, por obligación tributaria; cada factura guarda su propia copia de los datos fiscales. También se conservan los registros de consentimiento como prueba de la autorización, y los puntajes de las calificaciones (sin texto) para las métricas. El token de la tarjeta se borra.
- **Plazos.** La vista muestra el plazo legal por tipo de solicitud (Ley 1581: consultas 10 días hábiles, reclamos 15) junto al tiempo real de respuesta.
- **Verificación manual.**
  - **Correo duplicado.** Con una clienta nueva, cambiar el correo a demo@theclothesbox.co mostró "Este correo ya está registrado".
  - **Correo nuevo.** Con otro correo mostró "Datos actualizados. Te enviamos un enlace para verificar…" y el aviso de verificación pasó a mostrar el correo nuevo.
  - **Exportación.** Trae cuenta (sin contraseña), consentimientos, perfil con medidas, suscripción, pagos, facturas, cajas, calificaciones y devoluciones. La revisé con la misma llamada que usa el botón "Descargar mis datos (JSON)", sin descargar el archivo en el navegador.
  - **Eliminación.** Con una contraseña equivocada mostró "La contraseña no es correcta…". Con la correcta cerró la sesión y mostró "Tu cuenta fue eliminada…". La factura SETT-1 sigue con la cédula de la clienta y la confirmación `ACCOUNT_DELETED` llegó a su correo.
  - **Panel.** "Solicitudes de datos" lista la supresión (49 ms), la consulta (0 ms) y la rectificación (4 ms).

**Pendientes (decisión del equipo).**
- **Plazo de conservación.** Hay que validar con asesoría legal cuánto tiempo se guardan pagos y facturas y qué otros datos (consentimientos, puntajes de calificación) pueden conservarse tras la supresión.
- **Solicitudes por correo.** Las que lleguen a datos@theclothesbox.co no entran a `dataRequests`; hoy solo se registran las que se hacen desde la app.

### HU-11 Reentrenamiento del motor

Escenarios Gherkin cubiertos. **2 de 2** (antes 0,5).

| Punto | Código | Prueba |
|---|---|---|
| Una calificación de estilo de 2 o menos reduce el peso de los atributos de la prenda en el perfil, con piso | backend/learning.js L32 (`applyRating`) y L8 (`clamp`) · backend/engine.js L103 (`learnedFactor`) y L109 · backend/config.js L83 (`LEARNING`) | Prueba 66 |
| Las correcciones del estilista son ejemplos: la prenda reemplazada penaliza y la nueva suma | backend/learning.js L40 (`applyCorrection`) | Prueba 67 |
| `ingestFeedback` ejecutable por el administrador | backend/learning.js L61 · backend/routes.js L558 · frontend/js/views/adminView.js L965 (botón "Reentrenar motor con el feedback" en la pestaña Feedback) | Prueba 67 |
| Evaluación antes y después con perfiles sintéticos | scripts/evaluate-model.js | Prueba 68 |
| `rulesVersion` en cada caja y en el perfil | backend/config.js L82 · backend/routes.js L79 (`createCuratedBox`) · backend/database.js L721 · backend/learning.js L61 | Prueba 67 |

Detalles.
- **El modelo.** Cada perfil tiene factores por atributo (`attributeWeights` de estilo, ocasión y corte) que multiplican los puntos de `scoreProduct`. Empiezan en 1, nunca bajan de 0,3 (piso) ni pasan de 2. Una calificación de estilo de 2 o menos multiplica los atributos de la prenda por 0,6.
- **Correcciones.** Solo cambia lo que distingue a una prenda de la otra. Los atributos de la prenda retirada que no tiene la nueva se multiplican por 0,9 (0,95 si fue un rechazo de toda la caja). Los propios de la nueva se multiplican por 1,1 y sus estilos suman 0,25 al bono `styleWeights`. Lo que comparten no cambia, porque si no, la penalización y el premio se anulaban (lo detectó la prueba 67).
- **Idempotente.** Cada calificación y cada corrección quedan marcadas con `learnedAt` y no se aprenden dos veces. El perfil guarda `rulesVersion` y `learningRevision`, y cada caja guarda con qué `rulesVersion` y qué revisión del perfil se armó.
- **Evaluación.** `node scripts/evaluate-model.js [n]` genera perfiles cuyo gusto real difiere de lo declarado en el quiz. Compara la caja del mes siguiente sin aprender contra la caja tras aprender del primer mes. Resultado con el catálogo actual:

| Perfiles | Calificación simulada antes | Después | Mejoran | Empeoran |
|---|---|---|---|---|
| 40 | 3,52 | 3,57 | 6 | 1 |
| 200 | 3,45 | 3,55 | 31 | 7 |

- **Verificación manual.** En Panel → Feedback, "Reentrenar motor con el feedback" mostró "Motor reglas-v2: 13 calificaciones (0 con estilo ≤ 2) y 0 correcciones del estilista procesadas · 0 perfiles actualizados".

**Pendientes.**
- **La mejora es pequeña.** Con 18 prendas y el tope de costo de HU-06 casi no hay alternativas por categoría, así que bajar el peso de un estilo no siempre cambia la caja. Probé penalizaciones de 0,8, 0,6 y 0,5 (resultado 3,55, 3,57 y 3,59 con 40 perfiles) y dejé 0,6 como valor intermedio. El efecto debería crecer con un catálogo más grande. La evaluación es simulada: hay que validarla con calificaciones reales del piloto.
- **Ejecución automática (decisión del equipo).** El reentrenamiento corre cuando el administrador lo pide; no está en los jobs programados. Hay que decidir si se corre solo, por ejemplo cada semana.

### HU-17 Panel de KPIs

Escenarios Gherkin cubiertos. **2 de 2** (antes 0,5).

| Punto | Código | Prueba |
|---|---|---|
| Indicadores del mes: activos, altas, churn (cancelaciones del mes ÷ activos al inicio), calificación promedio, % de devoluciones por talla y motivos de cancelación de HU-13 | backend/metrics.js L31 (`computeKpis`) y L25 (`activeAt`) · backend/routes.js L563 | Prueba 69 |
| Filtros por mes y por plan | backend/routes.js L563 (`?month=AAAA-MM&plan=`) · frontend/js/views/adminView.js L529 y L947 | Pruebas 69 y 70 |
| Alerta visible cuando el churn supera el umbral (9 % por defecto, configurable desde el panel) | backend/config.js L85 · backend/routes.js L574 · frontend/js/views/adminView.js L529 | Pruebas 69 y 70 |
| scripts/seed-demo.js con unos 100 usuarios sintéticos marcados como datos de prueba | scripts/seed-demo.js · backend/routes.js L514 (el batch no les arma cajas) | Prueba 70 |

Detalles.
- **Activos.** Se cuentan las suscripciones cuyo último evento antes de la fecha es un alta. Una suscripción en pausa o en mora cuenta como activa porque no ha cancelado.
- **Altas.** Incluyen las reactivaciones.
- **Devoluciones por talla.** Solicitudes del mes ÷ prendas entregadas en el mes.
- **Calificación promedio.** Usa el puntaje general de las calificaciones creadas en el mes.
- **Filtro por plan.** Usa el plan del evento (alta o baja) o de la caja.
- **Seed.** 100 usuarios con correo `@seed.theclothesbox.test`, `seedDemo: true`, sin contraseña ni medio de pago. El 55 % ya estaba suscrito antes de la ventana de 3 meses y el 22 % cancela. Trae unas 230 cajas, unas 830 calificaciones y unas 50 devoluciones. `--reset` borra solo esos datos. El cobro recurrente no los toca (sin fecha de cobro) y el batch los omite. Volver a correr el seed reemplaza los datos de la corrida anterior.
- **Verificación manual.** Sobre una copia de la base con el seed:
  - **Noviembre.** 82 activos, 11 altas, churn 7,8 %, ★ 4,2 y 9 % de devoluciones, sin alerta.
  - **Octubre.** Muestra "Alerta de churn. El churn de 2026-10 es 12,2 % y supera el umbral de 9 %".
  - **Umbral.** Con 15 % la alerta desaparece. Con el filtro Estilo el churn de octubre es 15,4 % y la alerta vuelve.
  - **Motivos.** Las barras de motivos de cancelación muestran el conteo por motivo y las cancelaciones sin respuesta.

**Pendientes.**
- **Cambios de plan.** No se guardan como eventos. Si alguien pasa de Esencial a Estilo, el filtro por plan lo sigue contando en el plan de su alta. Hay que definir si se historizan.
- **Seed sobre la base real.** `node scripts/seed-demo.js` escribe en backend/data/db.json salvo que se use `TCB_DB_FILE`. No lo dejé aplicado en la base versionada: el equipo decide si la demo se hace sobre una copia o sobre la base con `--reset` al final.

### Commits de esta sesión (rama `sprint2`)

| Commit | Contenido |
|---|---|
| HU-16 Editar, exportar y eliminar datos del titular con registro de solicitudes | backend/privacy.js, backend/learning.js, backend/metrics.js, backend/config.js, backend/database.js, backend/auth.js, backend/billing.js, backend/engine.js, backend/routes.js, tests/api.test.js, scripts/evaluate-model.js, scripts/seed-demo.js, api.js (archivos compartidos), profileView.js ("Mis datos") y adminView.js (pestaña "Solicitudes de datos") |
| HU-11 Botón de reentrenamiento del motor en el panel | adminView.js (botón "Reentrenar motor con el feedback") |
| HU-17 Panel de KPIs del mes con filtros y alerta de churn | adminView.js (pestaña "KPIs del mes"), README.md |
| Evidencias Sprint 2 Prompt 5 | Este archivo |

Igual que en las sesiones anteriores, las rutas, las pruebas y el panel mezclan las tres HU. Van en el primer commit (HU-16) y las tablas de arriba dicen qué líneas pertenecen a cada HU. Los dos scripts van en ese commit porque las pruebas los cargan; sin ellos, ese commit no pasaría `npm test`.

---

## Cierre del Sprint 2. Estado de las 17 HU del alcance

HU-18 y HU-19 quedan fuera del alcance (Could, después del piloto). Comando de prueba: `npm test` (70 de 70 en verde).

| HU | Nombre | Sesión | Escenarios cubiertos | Antes del Sprint 2 | Pruebas |
|---|---|---|---|---|---|
| HU-01 | Registro y acceso | 1 | 3 de 3 | 1,5 | 19 a 23 |
| HU-02 | Consentimiento de datos personales | 1 | 3 de 3 | 0 | 17 y 18 |
| HU-03 | Quiz de estilo | 2 | 3 de 3 | 1,5 | 40 a 42 |
| HU-04 | (no incluida en los prompts del Sprint 2) | — | Sin cambios en este sprint | — | — |
| HU-05 | Catálogo | 2 | 2 de 2 | 0,5 | 28 a 30 |
| HU-06 | Motor de recomendación | 2 | 3 de 3 | 2,5 | 31 a 33 y 39 |
| HU-07 | Validación del estilista | 2 | 3 de 3 | 0 | 34 a 38 |
| HU-08 | Plan y pago recurrente | 3 | 3 de 3 | 0 | 43 a 47 |
| HU-09 | Despacho y seguimiento | 4 | 3 de 3 | 1,5 | 54 a 57 |
| HU-10 | Calificación de la caja | 1 | 3 de 3 | 2 | 24 y 25 |
| HU-11 | Reentrenamiento del motor | 5 | 2 de 2 | 0,5 | 66 a 68 |
| HU-12 | Pausar, cambiar plan o cancelar | 3 | 3 de 3 | Solo en el prototipo | 48 a 51 |
| HU-13 | Encuesta de salida | 1 | 3 de 3 | Solo en el prototipo | 26 y 27 |
| HU-14 | Cambio o devolución por talla | 4 | 3 de 3 | 0,5 | 58 a 61 |
| HU-15 | Facturación electrónica | 3 | 2 de 2 | 0 | 52 y 53 |
| HU-16 | Derechos del titular | 5 | 2 de 2 | 0,5 | 62 a 65 |
| HU-17 | Panel de KPIs | 5 | 2 de 2 | 0,5 | 69 y 70 |

**HU-04.** Ningún prompt del Sprint 2 la incluye y no aparece en el código ni en este documento. Su estado debe tomarse de Jira (Sprint 1); no se reporta un conteo para no inventarlo.

**Decisiones abiertas para el equipo** (detalle en cada sesión):
- **Legal.** Revisión del texto de la política de datos (HU-02) y de los plazos de conservación tras la supresión (HU-16).
- **Precios y costos.** Precio mayorista real por prenda, logística y margen (HU-05 y HU-06), y el tratamiento del IVA (HU-15).
- **Pagos y despacho.** Despacho durante los reintentos de cobro (HU-08) y de cajas aprobadas tras cancelar (HU-09).
- **Suscripción.** Saldo a favor y pausas de más de un mes (HU-12).
- **Devoluciones.** Festivos en el plazo y compensación de "solo devolver" (HU-14).
- **Motor.** Ejecución automática del reentrenamiento (HU-11).
- **Métricas.** Historizar los cambios de plan (HU-17).
- **Integración real.** Al conectar la pasarela de pagos, el proveedor de facturación DIAN, el operador logístico y el correo, cada adaptador debe recibir su proveedor real con la misma interfaz.

---

## Sesión de Alineación Final Jira vs. Código (12/11/2026)

**Rama de Integración:** `integration/jira-alignment`  
**Comando de prueba:** `npm test` (`node --test tests/`) · **136 de 136 pruebas en verde (0 fallos)**.  
**Comando de evaluación offline:** `npm run eval` (`node scripts/eval-recommender.js`) · **100 % de restricciones duras cumplidas** en 30 perfiles sintéticos.

### Cierre de Brechas por Flujo de Trabajo

1. **Base Técnica (F1 a F10):**
   - Migración al runner nativo `node:test` con puertos efímeros y aislamiento por archivo temporal.
   - Refactorización modular de rutas (`backend/routes/`) y repositorios (`backend/repos/`).
   - Adaptadores desacoplados tras interfaces unificadas (`backend/adapters/`).
   - Control de acceso por roles (`CLIENT`, `ADMIN`, `STYLIST`, `WAREHOUSE`).
   - Flujo CI en `.github/workflows/ci.yml` y configuración en `.env.example`.

2. **Stream A (HU-05 Catálogo e Inventario):**
   - Stock real por talla/color con movimientos de inventario (`DISPATCH_OUT`, `RETURN_IN`).
   - Importación CSV validada de hasta 2 MB.
   - Contrato de datos con marcas en `docs/data-contract-brands.md`.

3. **Stream B (HU-01, HU-02, HU-04, HU-16):**
   - Validación estricta de medidas antropométricas en servidor (422).
   - Tabla de equivalencias de tallas de marcas en seed JSON y panel admin.
   - Cifrado en reposo de medidas con AES-256-GCM.
   - Derechos ARCO: rectificación, exportación JSON (`/api/me/export`) y supresión con bloqueo por cobros pendientes.

4. **Stream C1 (HU-03 Quiz y HU-07 Estilistas):**
   - Banco de preguntas del quiz en seed JSON y reanudación de progreso (`PUT /api/quiz/progress`).
   - Protocolo de pruebas de usabilidad en `docs/usability-test-protocol.md`.
   - Cola de revisión de estilistas con reemplazo, aprobación con motivo y generación de ejemplos de corrección.

5. **Stream D1 y D2 (HU-08 Pasarela, HU-12/13 Suscripción, HU-15 Facturación):**
   - Tokenización en navegador (cero datos de tarjeta en servidor).
   - Webhook firmado criptográficamente con conciliación automática.
   - Oferta previa de retención con pausa al intentar cancelar y encuesta opcional.
   - Facturación electrónica con cola de reintentos (`PENDING_RETRY`) y alertas a operaciones.

6. **Stream C2 (HU-06 Recomendador y HU-11 Feedback):**
   - Cumplimiento del 100 % de restricciones duras en perfiles sintéticos.
   - Explicación de recomendaciones persistida en la caja.
   - Normalización de eventos en `feedbackEvents` y regla acotada de actualización de pesos.
   - Versionado de modelos de reglas (`modelVersions`, `reglas-v2`).

7. **Stream E1 (HU-09 Despacho, HU-10 Calificación, HU-14 Devoluciones):**
   - Guardas de despacho (409 si no está aprobada por estilista) e ingreso manual de transportadora/guía.
   - Checklist de empaque con bandera sostenible (`sustainablePackaging: true`).
   - Calificación entera separando ajuste y estilo; cálculo real de satisfacción sin default silencioso de 4.0.
   - Borrador de política de devoluciones en `docs/return-policy.md`.
   - Cálculo de días hábiles descontando festivos oficiales colombianos de 2026.
   - Generación de guía inversa imprimible (`GET /api/returns/:id/guide`) y métricas por marca.

8. **Stream E2 (HU-17 Tablero KPI y Prueba de Humo):**
   - Formulación matemática de métricas en `docs/kpi-definitions.md`.
   - Job de materialización periódica en `kpi_snapshots`.
   - Umbrales configurables en `settings` (churn 9 %, satisfacción 4.0, devoluciones 10 %) con alertas.
   - Aislamiento de datos demo (`isDemo: true`).
   - Prueba de humo integral (`tests/e2e.smoke.test.js`) cubriendo el ciclo de vida completo y 6 caminos negativos.

Consulte el informe detallado en `docs/alignment/report.md` y la propuesta de actualización en `docs/alignment/jira-update-proposal.md`.
