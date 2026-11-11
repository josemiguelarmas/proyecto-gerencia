# Integraciones externas

Todos los servicios externos están detrás de un adaptador con un proveedor `simulated` elegido por variable de entorno. Lo simulado se marca "SIMULADO" en pantalla y en los documentos. Este documento lista qué haría falta para conectar un proveedor real. No contiene llaves ni endpoints inventados: cada dato marcado "por definir" lo entrega el proveedor cuando el equipo firme el contrato.

| Servicio | Adaptador | Variable | Proveedor real |
|---|---|---|---|
| Pagos | `backend/payments/index.js` | `PAYMENT_PROVIDER` | por definir |
| Facturación electrónica DIAN | `backend/invoicing/index.js` | `INVOICING_PROVIDER` | por definir |
| Envíos | `backend/shipping/index.js` | `SHIPPING_PROVIDER` | por definir |
| Correo | `backend/mail/index.js` | `MAIL_PROVIDER` | por definir |

(La Fase 1b, tarea F6, puede mover los adaptadores a `backend/adapters/<servicio>/`; esta tabla se actualiza entonces.)

## Pagos

Interfaz actual: `tokenize(card)`, `describeToken(token)`, `charge({ token, amountCOP, idempotencyKey, description, recurring })`, `buildWebhook(charge)`, `verifyWebhook(rawBody, signature)`.

Para un proveedor real hace falta:
- Cuenta de comercio en una pasarela que opere en Colombia y soporte cobros recurrentes con token.
- Llaves pública y privada de sandbox y de producción (variables nuevas, por definir con el proveedor).
- Tokenización en el navegador con el SDK o formulario alojado del proveedor, para que el número de tarjeta y el CVV nunca lleguen al servidor (hoy el servidor simulado los recibe y los descarta).
- URL del webhook registrada en el proveedor y su secreto en `PAYMENT_WEBHOOK_SECRET`.
- Confirmar el manejo de idempotencia y de reintentos del proveedor frente a los reintentos propios (días 1, 3 y 5).

## Facturación electrónica DIAN

Interfaz actual: `issue(invoice)` devuelve CUFE, número y estado; puede fallar con `PROVIDER_UNAVAILABLE` (cola de reintentos) o `INVALID_BUYER`.

Para un proveedor real hace falta:
- Habilitación como facturador electrónico ante la DIAN y un proveedor tecnológico autorizado.
- Resolución de numeración (prefijo y rango) vigente; hoy el prefijo `SETT` es simulado.
- Credenciales del proveedor tecnológico para ambiente de habilitación y de producción (por definir).
- Confirmar con el contador el tratamiento del IVA (hoy se asume 19 % incluido en el precio del plan).

## Envíos

Interfaz actual: `createShipment({ reference, address, recipient, sequence, now })` y `createReturnShipment(...)`, que devuelven número de guía, fecha estimada y eventos.

Para un proveedor real hace falta:
- Contrato con un operador logístico con cobertura en Cali.
- Credenciales de su API o, si no tiene API, un flujo manual en el que bodega o administración registra transportadora y número de guía (es la opción prevista en el plan, tarea F6).
- Formato de las guías y de los eventos de seguimiento, y un webhook o consulta periódica para el estado de entrega.

## Correo

Interfaz actual: `send({ to, subject, body, type })` y `list()`. El proveedor simulado guarda los mensajes en `DATA_DIR/outbox.json` y el panel los muestra en "Bandeja de Salida".

Para un proveedor real hace falta:
- Cuenta en un servicio de correo transaccional y un dominio verificado (SPF, DKIM y DMARC).
- Llave de API del servicio (variable nueva, por definir).
- Dirección remitente aprobada por el equipo y plantillas revisadas.
