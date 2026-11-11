Proyecto The Clothes Box. Suscripción mensual de cajas de ropa para jóvenes de 18 a 30 años en Cali. MVP académico, Sprint 2 de 2.

Stack real del repo.
- Backend en Node con el módulo http nativo, sin framework. Base de datos en archivos JSON (backend/database.js y backend/data/). Contraseñas con scrypt, sesión con JWT HS256 (backend/auth.js). Motor de recomendación por reglas en backend/engine.js. Rutas en backend/routes.js.
- Frontend SPA en JavaScript puro en frontend/js/views/*.js. Existe un prototipo viejo en js/ que usa localStorage (js/screens/plan.js, js/store.js, js/data.js). El prototipo sirve de referencia pero no es la app principal.
- Pruebas con node tests/api.test.js (hoy 15 de 15 en verde). La app corre en http://localhost:3000.

Reglas de trabajo.
- Respeta el estilo y la estructura actuales. No agregues dependencias nuevas salvo que sea imprescindible y lo justifiques en el commit.
- Cada HU se cierra solo cuando todos sus escenarios Gherkin funcionan en el código, tienen prueba automática en tests/api.test.js y la pantalla correspondiente se verificó a mano en localhost. Las 15 pruebas actuales deben seguir en verde, y si un cambio obliga a ajustar una prueba vieja, explica por qué.
- Servicios externos (pasarela de pagos, facturación electrónica DIAN, operador logístico, correo). No hay credenciales reales. Impleméntalos como adaptadores con un proveedor "simulated" elegido por variable de entorno (PAYMENT_PROVIDER, INVOICING_PROVIDER, SHIPPING_PROVIDER, MAIL_PROVIDER), con la misma interfaz que tendría uno real. Todo lo simulado debe verse marcado como "SIMULADO" en pantalla y en los documentos generados.
- Correo. Guarda los correos en una bandeja de salida en backend/data/outbox.json (destinatario, asunto, cuerpo, fecha, tipo) y muéstrala en el panel de administración. No se envía correo real.
- Datos de tarjeta. Nunca guardes número completo ni CVV. Solo token simulado, marca y últimos 4 dígitos.
- Hazlo mobile first, en español, con mensajes claros al usuario.
- Un commit por HU con el mensaje "HU-XX descripción corta".
- Al final de cada sesión crea o actualiza EVIDENCIAS_SPRINT2.md en la raíz. Por cada HU trabajada escribe los escenarios Gherkin cubiertos, los archivos y líneas implicados, el comando de prueba y lo que quedó pendiente con el motivo. Ese archivo se sube a Jira como evidencia.
- Si algo no cabe o depende de una decisión del equipo, no lo inventes en silencio. Déjalo documentado en EVIDENCIAS_SPRINT2.md como pendiente.

Notas técnicas (agregadas en Sprint 2, Prompt 1).
- Configuración de reglas de negocio en backend/config.js (política de datos, edad mínima, días del recordatorio, motivos de cancelación). El frontend lee lo que necesita de GET /api/config y GET /api/policy.
- Correo simulado en backend/mail/index.js (MAIL_PROVIDER=simulated). Bandeja visible en el panel admin, pestaña "Bandeja de Salida".
- Tareas programadas en backend/jobs.js (arrancan con el servidor y corren cada hora).
- Las pruebas corren sobre una copia temporal de la base (TCB_DB_FILE y TCB_OUTBOX_FILE), así que no modifican backend/data/db.json. Usan el módulo assert de Node y fallan con código 1.
