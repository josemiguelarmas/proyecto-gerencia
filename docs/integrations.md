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

Interfaz actual: `tokenize(card)`, `describeToken(token)`, `charge({ token, amountCOP, idempotencyKey, description, recurring })`, `buildWebhook(charge)`, `verifyWebhook(rawBody, signature)`.

Proveedor simulado: además de los tokens de `tokenize()` (tarjetas 4242, 0002 y 0341), acepta `tok_ok` (aprueba), `tok_declined` (rechaza) y `tok_flaky` (falla los primeros N cobros con un error temporal que no queda en la caché de idempotencia; N = `PAYMENT_FLAKY_FAILURES`, 2 por defecto). Solo para pruebas: `setFlakyFailures(n)` y `resetFake()`.

Para un proveedor real hace falta:
- Cuenta de comercio en una pasarela que opere en Colombia y soporte cobros recurrentes con token.
- Llaves pública y privada de sandbox y de producción (variables nuevas, por definir con el proveedor).
- Tokenización en el navegador con el SDK o formulario alojado del proveedor, para que el número de tarjeta y el CVV nunca lleguen al servidor (hoy el servidor simulado los recibe y los descarta).
- URL del webhook registrada en el proveedor y su secreto en `PAYMENT_WEBHOOK_SECRET`.
- Confirmar el manejo de idempotencia y de reintentos del proveedor frente a los reintentos propios (días 1, 3 y 5).

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
