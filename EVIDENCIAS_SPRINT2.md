# Evidencias Sprint 2. The Clothes Box

Comando de prueba. `npm test` (equivale a `node tests/api.test.js`). Resultado al cierre del Prompt 2: **42 de 42 en verde** (15 originales + 12 del Prompt 1 + 15 del Prompt 2).

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
- El batch usa la suscripción provisional de HU-13 (TODO en backend/routes.js L455). Cuando exista HU-08, debe usar las suscripciones pagadas.

### HU-07 Validación del estilista

Escenarios Gherkin cubiertos. **3 de 3** (antes 0).

| Escenario | Código | Prueba |
|---|---|---|
| El estilista aprueba la caja. Queda APPROVED ("Lista para despacho") con quién y cuándo | backend/routes.js L337 · frontend/js/views/stylistView.js | Prueba 38 |
| El estilista reemplaza una prenda con motivo, validando talla y stock del suscriptor. La corrección queda en `corrections` | backend/routes.js L347 · backend/database.js L442 (`addCorrection`) · alternativas en L312 | Prueba 36 |
| El despacho se bloquea si la caja no está aprobada (409 "La caja no ha sido aprobada") | backend/routes.js L691 (simulate-step) y L514 (cambio de estado del admin) | Prueba 35 |
| Rechazo de la propuesta (adicional) | backend/routes.js L378 | Prueba 37 |
| Rol STYLIST y permisos | backend/routes.js L298 (`/api/stylist/*` para STYLIST y ADMIN) · backend/database.js L92 (usuario estilista@theclothesbox.co / estilista123) | Prueba 34 |

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
