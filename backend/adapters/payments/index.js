// Adaptador de pagos. PAYMENT_PROVIDER=simulated (único disponible) imita una pasarela
// en modo de pruebas: cobra con llave de idempotencia, guarda su propio registro de cobros
// (retrieveCharge, para la conciliación) y firma webhooks con HMAC e id de evento.
// La tarjeta se tokeniza en el navegador (frontend/js/simulatedGateway.js), así que este
// servidor nunca recibe el número ni el CVV; findCardData() detecta si un cuerpo los trae.
// El simulado acepta los tokens del SDK y los fijos tok_ok (aprueba), tok_declined (rechaza)
// y tok_flaky (falla los primeros N cobros por fallo temporal, N = PAYMENT_FLAKY_FAILURES, 2 por defecto).
const crypto = require('crypto');
const config = require('../../config');
const { selectProvider } = require('../select');
// The browser-side SDK of the simulated gateway: cards are tokenized there, never on this server.
const gateway = require('../../../frontend/js/simulatedGateway');

// tokenize is not part of the server interface: a real gateway tokenizes in the browser.
const INTERFACE = ['describeToken', 'charge', 'retrieveCharge', 'buildWebhook', 'verifyWebhook'];

// Tokens fijos para pruebas y demos: comportamiento, marca y últimos 4 que se muestran.
const FIXED_TOKENS = {
  tok_ok: { behavior: 'ok', brand: 'Prueba', last4: '4242' },
  tok_declined: { behavior: 'decline', brand: 'Prueba', last4: '0002' },
  tok_flaky: { behavior: 'flaky', brand: 'Prueba', last4: '1111' }
};
const FLAKY_REASON = 'La pasarela no respondió (fallo temporal SIMULADO). Intenta de nuevo.';

function flakyDefault() {
  const n = Number(process.env.PAYMENT_FLAKY_FAILURES);
  return process.env.PAYMENT_FLAKY_FAILURES !== undefined && Number.isInteger(n) && n >= 0 ? n : 2;
}
let flakyFailuresLeft = flakyDefault();

function behaviorOf(token) {
  if (FIXED_TOKENS[token]) return FIXED_TOKENS[token].behavior;
  const match = /^tok_sim_(ok|decline|firstonly)_/.exec(token || '');
  return match ? match[1] : null;
}

const DECLINE_REASON = 'Fondos insuficientes';
const RECURRING_DECLINE_REASON = 'La tarjeta fue rechazada por el banco emisor';

function paymentError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function sign(rawBody) {
  return crypto.createHmac('sha256', config.PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
}

// Cobros ya procesados por llave de idempotencia y registro de todos los cobros por id
// (la pasarela real los guarda de su lado y los entrega en su API de consulta).
const chargesByKey = new Map();
const chargesById = new Map();

// Keys that only card data uses, and values that look like a card number (13 to 19 digits,
// spaces or dashes allowed). docNumber (fiscal ID, up to 15 digits) is not card data.
const CARD_KEYS = /^(card_?number|cardnum|pan|number|cvv2?|cvc2?|csc|security_?code|exp_?(month|year)|expiry)$/i;
const CARD_VALUE = /^\d(?:[ -]?\d){12,18}$/;
const NOT_CARD_KEYS = new Set(['docNumber']);

// Returns the path of the first card-like field in a parsed body, or null.
function findCardData(value, pathSoFar = '') {
  if (typeof value === 'string' || typeof value === 'number') {
    return CARD_VALUE.test(String(value).trim()) ? pathSoFar || '(body)' : null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    const here = pathSoFar ? `${pathSoFar}.${key}` : key;
    if (NOT_CARD_KEYS.has(key)) continue;
    if (CARD_KEYS.test(key) && child !== null && child !== undefined && child !== '') return here;
    const found = findCardData(child, here);
    if (found) return found;
  }
  return null;
}

const simulatedProvider = {
  name: 'simulated',
  // Test cards the browser SDK (frontend/js/simulatedGateway.js) knows; shown by GET /api/config.
  testCards: gateway.testCards,

  // Marca y últimos 4 de un token, como la consulta de un medio de pago en la pasarela.
  describeToken(token) {
    if (FIXED_TOKENS[token]) return { brand: FIXED_TOKENS[token].brand, last4: FIXED_TOKENS[token].last4 };
    const match = /^tok_sim_(ok|decline|firstonly)_([a-z]+)_(\d{4})_[a-f0-9]+$/.exec(token || '');
    if (!match) return null;
    return { brand: match[2].charAt(0).toUpperCase() + match[2].slice(1), last4: match[3] };
  },

  // recurring: true para los cobros mensuales (la tarjeta 0341 solo falla en esos).
  charge({ token, amountCOP, idempotencyKey, description, recurring = false }) {
    if (!idempotencyKey) throw paymentError('Falta la llave de idempotencia.');
    if (chargesByKey.has(idempotencyKey)) return { ...chargesByKey.get(idempotencyKey), idempotentReplay: true };

    const behavior = behaviorOf(token);
    let status = 'APPROVED';
    let reason = null;
    if (!behavior) {
      status = 'DECLINED';
      reason = 'Medio de pago no reconocido';
    } else if (behavior === 'decline') {
      status = 'DECLINED';
      reason = DECLINE_REASON;
    } else if (behavior === 'firstonly' && recurring) {
      status = 'DECLINED';
      reason = RECURRING_DECLINE_REASON;
    } else if (behavior === 'flaky' && flakyFailuresLeft > 0) {
      flakyFailuresLeft--;
      status = 'DECLINED';
      reason = FLAKY_REASON;
    }

    const result = {
      chargeId: `ch_sim_${crypto.randomBytes(8).toString('hex')}`,
      status,
      reason,
      amountCOP,
      feeCOP: status === 'APPROVED' ? Math.round(amountCOP * config.PAYMENT_FEE_RATE) : 0,
      description,
      provider: 'simulated',
      createdAt: new Date().toISOString()
    };
    // Un fallo temporal (tok_flaky) no queda guardado: reintentar con la misma llave vuelve a cobrar,
    // como en una pasarela real cuando la respuesta fue un error de disponibilidad.
    if (reason !== FLAKY_REASON) chargesByKey.set(idempotencyKey, result);
    chargesById.set(result.chargeId, result);
    return result;
  },

  // Consulta de un cobro en la pasarela (la usa el job de conciliación). null si no existe.
  retrieveCharge(chargeId) {
    const charge = chargesById.get(chargeId);
    return charge ? { chargeId: charge.chargeId, status: charge.status, amountCOP: charge.amountCOP, feeCOP: charge.feeCOP } : null;
  },

  // Evento que la pasarela enviaría a POST /api/webhooks/payments, con su firma HMAC.
  // Cada evento lleva un id único; la pasarela real reenvía el mismo id si no recibe un 2xx.
  buildWebhook(charge, { eventId = `evt_sim_${crypto.randomBytes(8).toString('hex')}` } = {}) {
    const rawBody = JSON.stringify({
      id: eventId,
      type: charge.status === 'APPROVED' ? 'charge.succeeded' : 'charge.failed',
      data: { chargeId: charge.chargeId, status: charge.status, amountCOP: charge.amountCOP, feeCOP: charge.feeCOP }
    });
    return { rawBody, signature: sign(rawBody) };
  },

  verifyWebhook(rawBody, signature) {
    if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;
    return crypto.timingSafeEqual(Buffer.from(sign(rawBody), 'hex'), Buffer.from(signature, 'hex'));
  },

  // Solo para pruebas: cuántos cobros con tok_flaky fallan antes de aprobar, y reinicio del
  // estado en memoria (contador de tok_flaky y cobros guardados por llave de idempotencia).
  setFlakyFailures(n) {
    flakyFailuresLeft = n;
  },
  resetFake() {
    flakyFailuresLeft = flakyDefault();
    chargesByKey.clear();
    chargesById.clear();
  }
};

const PROVIDERS = { simulated: simulatedProvider };

module.exports = Object.assign(selectProvider({ variable: 'PAYMENT_PROVIDER', providers: PROVIDERS, methods: INTERFACE }), { INTERFACE, findCardData });
