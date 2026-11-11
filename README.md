# The Clothes Box — Prototipo Web Full-Stack Funcional (v2.1)

**Proyecto de Innovación y Emprendimiento II (2026)**  
**Universidad Icesi — Séptimo Semestre**  
**Equipo:** *Cangrejos* (Andrés Felipe López, Jaime Muñoz, Jose Miguel Armas, Sebastián Castillo)

---

## 1. Resumen Ejecutivo y Propósito

**The Clothes Box** es una plataforma de suscripción mensual de moda independiente colombiana que resuelve la incertidumbre de la talla *antes de pagar*, entregando selecciones sorpresa curadas a domicilio en Cali.

### El Problema Validado en Investigación:
* **Falsa disyuntiva:** Los jóvenes de 18 a 30 años en Colombia oscilan entre el *Fast Fashion* (genérico, masivo, mala calidad textil) y las *marcas de diseñador* (precios prohibitivos).
* **Barrera de la talla:** Aunque el comercio electrónico de moda crece aceleradamente en Colombia, el miedo a perder tiempo y dinero con devoluciones engorrosas detiene la compra.
* **Garantía real:** *"El problema no es la talla: es el costo de equivocarse"*. Con The Clothes Box, las medidas en centímetros se cruzan algorítmicamente antes del empaque, y cualquier prenda que no ajuste se cambia sin costo.

---

## 2. Novedades y Mejoras Clave (v2.1)

1. **Fotografía Real de Prendas de Marcas Colombianas:**
   * Se eliminaron por completo las siluetas vectoriales SVG, iconos genéricos o placeholders para prendas de ropa.
   * Cada una de las 18 piezas del catálogo oficial cuenta con fotografía real en alta resolución que refleja fielmente su corte, textura textil, color y silueta.
   * Marcas representadas: **Ceiba Estudio (Cali)**, **Taller Norte (Bogotá)**, **Mono Textil (Cali)**, **True (Medellín)**, **Punto Blanco** y **Mattelsa**.

2. **Corrección de la Experiencia "Mi Caja" (Descubrimiento Real):**
   * **En preparación o despacho (`PREPARING` / `SHIPPED`):** El usuario experimenta la expectativa con su caja sellada, guía de rastreo y cronograma de despacho. El backend no expone las prendas (`items: null`).
   * **Entregada (`DELIVERED`):** Tras el ritual de desempaque (*unboxing*), el usuario accede inmediatamente a la **visualización individual de cada prenda recibida**, con fotografía real, talla calibrada, porcentaje de ajuste, tabla de medidas en cm, tejido y precio de referencia.
   * **Outfits como complemento:** Las ideas de combinación se presentan como una sección adicional de estilismo, sin ocultar ni reemplazar la visualización de las prendas reales recibidas.

3. **Descubrimiento y Valoración Individual de Prendas:**
   * Cada prenda recibida cuenta con su propio modal de valoración:
     * Botones de afinidad: `[ 👍 Me gustó ]` o `[ 👎 No es mi estilo ]`.
     * Calificación de 1 a 5 estrellas.
     * Preferencias para futuras entregas (colores, formalidad, cortes).
     * Notas directas al estilista.
   * **Separación de conceptos:** Se notifica claramente que decir *"no me gustó"* o *"prefiero otro color"* afina el algoritmo para futuros ciclos pero **no genera devolución**. Los cambios están reservados estrictamente a problemas de talla o ajuste dimensional.

4. **Doble Rol con Control de Acceso Estricto (CLIENT y ADMIN):**
   * **Cliente (`CLIENT`):** Acceso a landing, onboarding antropométrico, estado de su caja actual, descubrimiento de prendas entregadas, valoración individual, historial personal y módulo de cambio de talla.
   * **Administrador (`ADMIN`):** Panel propio de gestión y operaciones (`#/admin`):
     * **Métricas Operativas:** Total clientes, cajas en taller y reparto, cajas entregadas, tasa de devoluciones por talla, satisfacción promedio (★ 4.8) y marcas activas.
     * **Auditoría de Cajas:** El administrador **sí puede consultar y auditar las prendas** asignadas a cualquier caja, incluso cuando están en preparación o en camino. Control manual para cambiar estados (`PREPARING` ➔ `SHIPPED` ➔ `DELIVERED`).
     * **Clientes & Perfiles:** Consulta de medidas corporales (estatura, peso, contextura, talla habitual) y direcciones de entrega en Cali.
     * **Catálogo Visual:** Galería de productos con fotografías oficiales, detalles técnicos y precios.
     * **Devoluciones por Talla:** Gestión de solicitudes con foto de la prenda, talla solicitada, dirección y cambio de estado (`Agendar Mensajero`, `En Taller`, `Completado`).
     * **Feedback de Estilo:** Monitoreo en tiempo real de valoraciones y comentarios de clientes.
   * **Validación en Backend:** Cualquier intento de un cliente de acceder a endpoints `/api/admin/*` es rechazado con **HTTP 403 Forbidden**.

---

## 3. Credenciales de Acceso para Demostración

| Rol | Correo Electrónico | Contraseña | Destino Inicial | Acceso Rápido |
| :--- | :--- | :--- | :--- | :--- |
| **Cliente** | `demo@theclothesbox.co` | `demo123` | `#/caja` | Botón *"Entrar Cliente"* en login |
| **Administrador** | `admin@theclothesbox.co` | `admin123` | `#/admin` | Botón *"Entrar Admin"* en login |
| **Estilista** (Sprint 2) | `estilista@theclothesbox.co` | `estilista123` | `#/estilista` | Botón *"Cuenta Estilista"* en login |

El cliente demo tiene una suscripción activa pagada con la tarjeta de prueba 4242 (SIMULADO).

---

## 4. Estructura del Proyecto

Todo el desarrollo se encuentra confinado dentro de la carpeta `prototipo-web/`. La carpeta superior `Innovacion2` no ha sido modificada.

```text
prototipo-web/
├── backend/
│   ├── server.js          # Servidor HTTP nativo Node.js (API REST y estáticos)
│   ├── routes/            # Rutas por dominio (auth, catalog, boxes, admin...) y enrutador en index.js
│   ├── lib/               # Utilidades compartidas (http, accounts, boxes, clock)
│   ├── auth.js            # Autenticación JWT y validación de roles (CLIENT/ADMIN)
│   ├── database.js        # Fachada de la base de datos JSON (API histórica db)
│   ├── repos/             # Repositorios por colección sobre store.js (escritura atómica)
│   ├── engine.js          # Motor algorítmico de tallaje antropométrico
│   └── data/
│       ├── seed/          # Semillas versionadas: catalog.json (18 prendas) y db.json (sin contraseñas)
│       └── runtime/       # Datos de ejecución (DATA_DIR por defecto, fuera de git)
│
├── frontend/
│   ├── index.html         # Shell SPA accesible con fuentes Fraunces/Inter
│   ├── css/
│   │   ├── tokens.css     # Paleta de papel, tintas y espaciado
│   │   ├── base.css       # Resets y tipografía base
│   │   ├── components.css # Botones, tarjetas, modales y barra de navegación
│   │   ├── landing.css    # Storytelling inspirado en Apple.com
│   │   └── screens.css    # Vistas de caja, descubrimiento, admin y devoluciones
│   └── js/
│       ├── api.js         # Cliente HTTP con soporte para endpoints de cliente y admin
│       ├── brand.js       # Renderizado de fotografías reales y logo vectorial
│       ├── state.js       # Store reactivo, modales y notificaciones
│       ├── app.js         # Enrutador SPA con barra de navegación adaptada por rol
│       └── views/
│           ├── landingView.js     # Presentación y storytelling
│           ├── authView.js        # Modales de acceso dual (Cliente y Admin)
│           ├── onboardingView.js  # 3 pasos antropométricos hacia el backend
│           ├── boxView.js         # Caja sellada, desempaque y descubrimiento individual
│           ├── adminView.js       # Consola profesional de operaciones y auditoría
│           ├── returnsView.js     # Módulo especializado de cambio por talla
│           ├── historyView.js     # Historial de cajas y prendas entregadas
│           └── profileView.js     # Perfil antropométrico y marcas locales
│
├── tests/
│   └── api.test.js        # Suite de 70 pruebas automatizadas (Sprint 1 y Sprint 2)
├── package.json           # Scripts de arranque (`npm start`, `npm test`)
├── server.js              # Punto de entrada de la aplicación
└── README.md              # Documentación técnica completa
```

---

## 5. Instrucciones de Ejecución y Pruebas

### Iniciar la Aplicación Full-Stack
El servidor no arranca sin `JWT_SECRET` y `DATA_ENCRYPTION_KEY` (ver sección 7). En PowerShell:
```powershell
$env:JWT_SECRET = "pon-aqui-un-secreto-largo-y-aleatorio"
$env:DATA_ENCRYPTION_KEY = "pon-aqui-otra-clave-larga-y-aleatoria"
npm start
```
Abre en tu navegador:
```text
http://localhost:3000
```

### Ejecutar las Pruebas Automatizadas del Backend (70 al cierre del Sprint 2)
```powershell
npm test                               # node --test tests/ (todos los archivos *.test.js)
node tests/api.test.js                 # solo la suite histórica de 70 pruebas
node --test tests/foundation.test.js   # un solo archivo
```

`npm test` usa el runner nativo `node:test`: cada archivo `tests/*.test.js` corre en su propio proceso y, si alguno falla, el comando termina con código distinto de 0. `tests/api.test.js` (70 pruebas con `assert`) se conserva y levanta el servidor en el puerto 3199 sobre copias temporales de la base, el catálogo y la bandeja de salida, así que no modifica `backend/data/`. Las pruebas nuevas usan `tests/helpers/`: `server.js` (servidor en un puerto efímero con su propia carpeta de datos temporal), `http.js` (cliente JSON) y `clock.js` (reloj inyectable sobre `backend/lib/clock.js`). El detalle de cada prueba por HU está en `EVIDENCIAS_SPRINT2.md`.

Salida de las 15 pruebas originales del Sprint 1:
```text
--- INICIANDO PRUEBAS DE BACKEND, ROLES Y REGLAS DE NEGOCIO ---
✓ 1. Catálogo con fotografías reales confirmado (18 productos con URL válida)
✓ 2. Rutas protegidas bloqueadas sin token (401 Unauthorized)
✓ 3. Autenticación de Cliente exitosa (Rol: CLIENT, JWT token generado)
✓ 4. Caja actual consultada: Caja #3 (Estado: DELIVERED)
✓ 5. REGLA DE SORPRESA VERIFICADA EN CLIENTE: Prendas ocultas en estado PREPARING (items = null)
✓ 6. REGLA DE SORPRESA VERIFICADA EN CLIENTE: Prendas ocultas en estado SHIPPED (items = null)
✓ 7. REGLA DE ENTREGA VERIFICADA: Prendas reveladas con fotografías y ajuste de talla al cambiar a DELIVERED
✓ 8. VALORACIÓN INDIVIDUAL DE PRENDA VERIFICADA: Feedback registrado sin generar devolución
✓ 9. REGLA DE DEVOLUCIÓN VERIFICADA: Rechazo de motivos de gusto/opinión (status 400)
✓ 10. Devolución por talla aprobada y registrada en base de datos (201 Created)
✓ 11. CONTROL DE ACCESO VERIFICADO: Cliente bloqueado de rutas administrativas (403 Forbidden)
✓ 12. Autenticación de Administrador exitosa (Rol: ADMIN, JWT token generado)
✓ 13. Métricas administrativas operativas (Clientes, Cajas, Devoluciones)
✓ 14. PRIVILEGIO ADMINISTRATIVO VERIFICADO: El Administrador puede auditar prendas de cajas no entregadas
✓ 15. Vista administrativa de devoluciones con prendas, fotos y clientes confirmada
```

---

## 6. Matriz de Endpoints de la API REST

| Método | Endpoint | Rol Mínimo | Descripción |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | Público | Registra cliente con rol `CLIENT` |
| `POST` | `/api/auth/login` | Público | Autentica y retorna token JWT y rol |
| `GET` | `/api/products` | Público | Catálogo con fotos reales y medidas en cm |
| `GET` | `/api/auth/me` | Autenticado | Datos del usuario y perfil en sesión |
| `GET` | `/api/profile` | `CLIENT` | Medidas antropométricas del cliente |
| `PUT` | `/api/profile` | `CLIENT` | Actualiza medidas corporales y dirección |
| `GET` | `/api/boxes/current` | `CLIENT` | Caja activa (**`items: null` si está en camino**) |
| `POST` | `/api/boxes/simulate-step` | `CLIENT` | Avanza simulación: `PREPARING` ➔ `SHIPPED` ➔ `DELIVERED` |
| `POST` | `/api/boxes/:id/unbox` | `CLIENT` | Desempaca caja entregada |
| `POST` | `/api/boxes/:id/item-feedback` | `CLIENT` | **Valoración y feedback de prenda individual** |
| `POST` | `/api/boxes/:id/ratings` | `CLIENT` | Calificaciones completas del ciclo |
| `GET` | `/api/boxes/history` | `CLIENT` | Cajas pasadas desempacadas con fotos |
| `POST` | `/api/boxes/next` | `CLIENT` | Solicita siguiente ciclo |
| `GET` | `/api/returns` | `CLIENT` | Historial de devoluciones y prendas elegibles |
| `POST` | `/api/returns` | `CLIENT` | Solicita cambio (**rechaza motivos ajenos a talla**) |
| `GET` | `/api/admin/metrics` | `ADMIN` | **KPIs y métricas de la plataforma** |
| `GET` | `/api/admin/clients` | `ADMIN` | **Lista de clientes y medidas antropométricas** |
| `GET` | `/api/admin/products` | `ADMIN` | **Catálogo completo de productos** |
| `POST` | `/api/admin/products` | `ADMIN` | **Crear o editar prenda en catálogo** |
| `GET` | `/api/admin/boxes` | `ADMIN` | **Auditoría de cajas (prendas visibles siempre)** |
| `POST` | `/api/admin/boxes/:id/status` | `ADMIN` | **Modificar estado de despacho de caja** |
| `GET` | `/api/admin/returns` | `ADMIN` | **Gestión de solicitudes de cambio de talla** |
| `PUT` | `/api/admin/returns/:id` | `ADMIN` | **Actualizar estado de recolección/taller** |
| `GET` | `/api/admin/feedback` | `ADMIN` | **Monitoreo de valoraciones de estilo** |


---

## 7. Sprint 2: servicios simulados, variables de entorno y scripts

### Servicios externos simulados
No hay credenciales reales. Cada servicio es un adaptador con la misma interfaz que tendría un proveedor real y un proveedor `simulated` elegido por variable de entorno. Todo lo que generan dice **SIMULADO** en pantalla y en los documentos.

| Servicio | Adaptador | Qué hace en modo simulado |
| :--- | :--- | :--- |
| Correo | `backend/mail/index.js` | Guarda cada correo en `backend/data/outbox.json`. Se ve en Panel → Bandeja de Salida. |
| Pasarela de pagos | `backend/payments/index.js` | Tokeniza la tarjeta (nunca guarda el número completo ni el CVV), cobra con llave de idempotencia y firma webhooks con HMAC. Tarjetas de prueba: `4242 4242 4242 4242` aprueba, `4000 0000 0000 0002` rechaza, `4000 0000 0000 0341` aprueba el primer cobro y falla los recurrentes. |
| Facturación electrónica | `backend/invoicing/index.js` | Imita el ambiente de habilitación de la DIAN: factura `SETT-n` con IVA y CUFE simulado. |
| Operador logístico | `backend/shipping/index.js` | Guías de despacho `TCB-AAAAMMDD-0001` y de devolución `TCB-DEV-AAAAMMDD-0001`. |

### Variables de entorno
Se leen en `backend/config/env.js` (las reglas de negocio siguen en `backend/config.js`). La lista completa con comentarios está en `.env.example`. Node no lee `.env` solo: define las variables en la terminal. `JWT_SECRET` y `DATA_ENCRYPTION_KEY` son obligatorias salvo con `NODE_ENV=test`; sin ellas `npm start` termina con código 1 y dice cuáles faltan. Las demás son opcionales.

```powershell
$env:JWT_SECRET = "pon-aqui-un-secreto-largo-y-aleatorio"
$env:DATA_ENCRYPTION_KEY = "pon-aqui-otra-clave-larga-y-aleatoria"
$env:DATA_DIR = "C:/tcb-datos"          # opcional, por defecto backend/data/runtime
$env:PORT = "3000"                       # opcional
npm start
# Para volver a los valores por defecto en la misma terminal:
Remove-Item Env:DATA_DIR
```

**Datos.** Lo versionado son las semillas de `backend/data/seed/` (`catalog.json` y `db.json`, esta última sin contraseñas). Los datos de ejecución (base, catálogo con stock descontado y bandeja de salida) viven en `DATA_DIR`, que se crea al arrancar y está en `.gitignore`. Si `DATA_DIR` está vacío, la base y el catálogo se crean desde las semillas. Un `backend/data/db.json` local de una versión anterior ya no se usa ni se versiona; se puede borrar.

| Variable | Por defecto | Uso |
| :--- | :--- | :--- |
| `JWT_SECRET` | obligatoria | Secreto de firma de los JWT. |
| `DATA_ENCRYPTION_KEY` | obligatoria | Clave de cifrado de datos sensibles (se usa a partir de Fase 1b). |
| `NODE_ENV` | `development` | Con `test` no se exigen los secretos. |
| `PORT` | `3000` | Puerto del servidor. |
| `DATA_DIR` | `backend/data/runtime` | Carpeta de datos de ejecución. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STYLIST_EMAIL`, `STYLIST_PASSWORD` | sin definir | Cuentas internas; se siembran desde aquí en Fase 1b. |
| `CORS_ORIGINS` | sin definir | Orígenes permitidos, separados por coma (Fase 1b). |
| `POLICY_VERSION` | `v1.0` | Versión vigente de la política de datos. |
| `APP_BASE_URL` | `http://localhost:3000` | Enlaces dentro de los correos. |
| `MAIL_PROVIDER` | `simulated` | Proveedor de correo. |
| `PAYMENT_PROVIDER` | `simulated` | Pasarela de pagos. |
| `PAYMENT_WEBHOOK_SECRET` | `whsec_simulado_desarrollo` | Secreto HMAC del webhook `POST /api/webhooks/payments` (cabecera `X-Signature`). |
| `PAYMENT_RETRY_DAYS` | `1,3,5` | Días de reintento del cobro recurrente fallido. |
| `INVOICING_PROVIDER` | `simulated` | Proveedor de facturación electrónica. |
| `INVOICING_FAIL` | sin definir | Con `1`, el proveedor de facturación falla y las facturas quedan en cola de reintento con alerta en el panel. |
| `SHIPPING_PROVIDER` | `simulated` | Operador logístico. |
| `SUBSCRIPTION_CUTOFF_DAY` | `25` | Día de corte para que un cambio de plan alcance la próxima caja. |
| `RETURN_WINDOW_BUSINESS_DAYS` | `5` | Plazo del cambio por talla en días hábiles desde la entrega. |
| `REVIEW_REMINDER_DAYS` | `3` | Días desde la entrega para recordar la calificación. |
| `TCB_DB_FILE` | `DATA_DIR/db.json` | Archivo de la base. Las pruebas y los scripts lo usan para trabajar sobre una copia. |
| `TCB_CATALOG_FILE` | `DATA_DIR/catalog.json` (copiado de `backend/data/seed/catalog.json`) | Archivo del catálogo. |
| `TCB_OUTBOX_FILE` | `DATA_DIR/outbox.json` | Bandeja de salida de correos. |

El umbral de alerta de churn (9 % por defecto) se cambia desde Panel → KPIs del mes y queda guardado en la base.

### Scripts
```bash
node scripts/seed-demo.js            # 100 suscriptores sintéticos con altas y cancelaciones en 3 meses (seedDemo: true)
node scripts/seed-demo.js --reset    # borra solo esos datos de prueba
node scripts/evaluate-model.js       # calificación simulada del motor antes y después del reentrenamiento
node scripts/migrate-catalog-variants.js   # migración del catálogo a variantes (ya aplicada)
```

Los usuarios del seed usan correos `@seed.theclothesbox.test`, no tienen contraseña ni medio de pago, y el cobro recurrente y la generación de cajas los ignoran. Para no tocar la base real, el seed se puede correr sobre una copia:
```powershell
$env:TCB_DB_FILE = "C:/ruta/copia-db.json"; node scripts/seed-demo.js
```

### Pantallas nuevas del Sprint 2
- **Cliente:** elegir plan y pagar (`#/suscripcion`), Mi suscripción (pausar, cambiar plan, cambiar tarjeta, cancelar), datos de facturación, "Mis datos" (editar nombre y correo, descargar mis datos, eliminar cuenta), seguimiento de la guía en "Mi Caja" y cambios por talla con plazo y guías.
- **Estilista:** cola de curaduría (`#/estilista`) para aprobar, reemplazar o rechazar cajas.
- **Administrador:** KPIs del mes, solicitudes de datos, cajas por despachar, pagos, facturación, motivos de cancelación, bandeja de salida, importación CSV del catálogo, generación de cajas del mes y reentrenamiento del motor.

La evidencia por HU (escenarios, archivos y líneas, pruebas y pendientes) está en `EVIDENCIAS_SPRINT2.md`.
