# Integraciones externas

Todos los servicios externos están detrás de un adaptador con un proveedor `simulated` elegido por variable de entorno. Lo simulado se marca "SIMULADO" en pantalla y en los documentos. Este documento lista qué haría falta para conectar un proveedor real. No contiene llaves ni endpoints inventados: cada dato marcado "por definir" lo entrega el proveedor cuando el equipo firme el contrato.

| Servicio | Adaptador | Variable | Proveedor real |
|---|---|---|---|
| Pagos | `backend/adapters/payments/index.js` | `PAYMENT_PROVIDER` | por definir |
| Facturación electrónica DIAN | `backend/adapters/invoicing/index.js` | `INVOICING_PROVIDER` | por definir |
| Envíos | `backend/adapters/logistics/index.js` | `SHIPPING_PROVIDER` | por definir |
| Correo | `backend/adapters/mailer/index.js` | `MAIL_PROVIDER` | por definir |

Cada adaptador exporta `INTERFACE` (los métodos que todo proveedor debe implementar) y el proveedor elegido; `backend/adapters/select.js` falla al arrancar si la variable nombra un proveedor que no existe o que no implementa la interfaz. Para conectar uno real: implementar esos métodos y registrarlo en la tabla `PROVIDERS` del adaptador.

## Pagos

Interfaz del servidor: `describeToken(token)`, `charge({ token, amountCOP, idempotencyKey, description, recurring })`, `retrieveCharge(chargeId)` (consulta usada por el job de conciliación), `buildWebhook(charge, { eventId })` y `verifyWebhook(rawBody, signature)`. El adaptador exporta además `findCardData(body)`, que las rutas de suscripción usan para rechazar con 400 cualquier cuerpo con campos de tarjeta (`cardNumber`, `number`, `cvv`, `cvc`, ... o un valor de 13 a 19 dígitos; `docNumber` se excluye porque es el documento fiscal).

Tokenización: ocurre en el navegador. `frontend/js/simulatedGateway.js` hace el papel del SDK que sirve la pasarela: valida la tarjeta (Luhn, vencimiento, CVV) y devuelve `{ token, brand, last4 }`. Al backend solo llega el token; la suscripción guarda token, marca y últimos 4. Las pruebas usan el mismo archivo.

Proveedor simulado: acepta los tokens del SDK (tarjetas 4242 aprueba, 0002 rechaza, 0341 aprueba el primer cobro y falla los recurrentes), `tok_ok` (aprueba), `tok_declined` (rechaza) y `tok_flaky` (falla los primeros N cobros con un error temporal que no queda en la caché de idempotencia; N = `PAYMENT_FLAKY_FAILURES`, 2 por defecto). Su webhook se entrega en el acto por la misma verificación HMAC del endpoint. Solo para pruebas: `setFlakyFailures(n)` y `resetFake()`.

Webhook: `POST /api/webhooks/payments`, firma HMAC-SHA256 del cuerpo crudo en la cabecera `X-Signature` (hex), comparada con `crypto.timingSafeEqual`. Cada evento trae `id`; un id ya procesado responde 200 con `duplicate: true` y no se vuelve a aplicar. El cuerpo del webhook no se registra en el log. `PAYMENT_WEBHOOK_SECRET` es obligatorio cuando `PAYMENT_PROVIDER` no es `simulated` (el servidor no arranca sin él); con el simulado se usa un secreto de desarrollo si falta.

Pasos para conectar una pasarela real (los nombres concretos de endpoints, llaves y formatos los entrega la pasarela elegida; no se inventan aquí):
1. Elegir una pasarela que opere en Colombia, liquide en COP y permita cobros recurrentes sobre un token guardado (cobro sin el titular presente). Confirmar su comisión real frente al 3,5 % configurado (`PAYMENT_FEE_RATE`).
2. Firmar el contrato de comercio y obtener las llaves de sandbox (pública para el navegador, privada para el servidor) y, al pasar a producción, las de producción. Guardarlas solo en variables de entorno (nombres por definir), nunca en el repositorio.
3. Reemplazar `frontend/js/simulatedGateway.js` por el SDK o formulario alojado de la pasarela, cargado desde su dominio, con la llave pública. Así el número y el CVV nunca tocan este servidor ni su log, y el alcance PCI DSS se reduce al cuestionario de autoevaluación que corresponda (confirmarlo con la pasarela).
4. Implementar un proveedor nuevo en `backend/adapters/payments/` con los métodos de `INTERFACE`, registrarlo en `PROVIDERS` y seleccionarlo con `PAYMENT_PROVIDER`. `describeToken` consulta la marca y los últimos 4 del medio de pago en la API de la pasarela; `charge` envía la llave de idempotencia que la pasarela soporte; `retrieveCharge` consulta el estado de un cobro.
5. Registrar la URL pública de `POST /api/webhooks/payments` en el panel de la pasarela, copiar su secreto de firma en `PAYMENT_WEBHOOK_SECRET` y ajustar `verifyWebhook` al esquema de firma que la pasarela documente (cabecera, algoritmo, sello de tiempo).
6. Revisar que los reintentos propios (días `PAYMENT_RETRY_DAYS`, por defecto 1, 3 y 5) no se crucen con reintentos automáticos de la pasarela; desactivar uno de los dos.
7. Probar en sandbox los escenarios de `tests/billing.test.js` (aprobado, rechazado, fallo recurrente con reintentos y PAST_DUE, webhook duplicado, firma inválida) antes de activar producción.

## Facturación electrónica DIAN

Interfaz actual: `issue(invoice)` devuelve CUFE, número y estado; puede fallar con `PROVIDER_UNAVAILABLE` (cola de reintentos) o `INVALID_BUYER`. `isDown()` dice si el proveedor está caído. En el simulado la caída se activa con `INVOICING_FAIL=1` o, en pruebas, con `setDowntime(true)` (`setDowntime(null)` vuelve a la variable).

Para un proveedor real hace falta:
- Habilitación como facturador electrónico ante la DIAN y un proveedor tecnológico autorizado.
- Resolución de numeración (prefijo y rango) vigente; hoy el prefijo `SETT` es simulado.
- Credenciales del proveedor tecnológico para ambiente de habilitación y de producción (por definir).
- Confirmar con el contador el tratamiento del IVA (hoy se asume 19 % incluido en el precio del plan).

## Envíos

Interfaz actual: `createShipment({ reference, address, recipient, sequence, now })` y `createReturnShipment(...)`, que devuelven número de guía, fecha estimada y eventos. Modo manual: `manualShipment({ reference, address, recipient, carrier, trackingNumber, now })` valida y arma la guía que bodega o administración registran a mano (error 400 con mensaje en español si falta la transportadora o el número no es válido). La ruta y la pantalla de bodega que lo usan son del stream E1.

Para un proveedor real hace falta:
- Contrato con un operador logístico con cobertura en Cali.
- Credenciales de su API o, si no tiene API, un flujo manual en el que bodega o administración registra transportadora y número de guía (es la opción prevista en el plan, tarea F6).
- Formato de las guías y de los eventos de seguimiento, y un webhook o consulta periódica para el estado de entrega.

## Correo

Interfaz actual: `send({ to, subject, body, type })` y `list()`. El proveedor simulado guarda los mensajes en `DATA_DIR/outbox.json` (el panel los muestra en "Bandeja de Salida") y también en memoria para las pruebas (`sentInMemory()`, `clearMemory()`).

Para un proveedor real hace falta:
- Cuenta en un servicio de correo transaccional y un dominio verificado (SPF, DKIM y DMARC).
- Llave de API del servicio (variable nueva, por definir).
- Dirección remitente aprobada por el equipo y plantillas revisadas.
