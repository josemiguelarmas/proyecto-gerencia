// Adaptador de pagos. PAYMENT_PROVIDER=simulated (único disponible) imita una pasarela
// en modo de pruebas: tokeniza la tarjeta, cobra con llave de idempotencia y firma webhooks.
// Nunca guarda el número completo ni el CVV: el token solo lleva marca, últimos 4 y el
// comportamiento de la tarjeta de prueba.
const crypto = require('crypto');
const config = require('../config');

// Tarjetas de prueba. Cualquier otra tarjeta válida (Luhn) se aprueba.
const TEST_CARDS = {
  '4242424242424242': { behavior: 'ok', label: 'Aprueba siempre' },
  '4000000000000002': { behavior: 'decline', label: 'Rechaza: fondos insuficientes' },
  '4000000000000341': { behavior: 'firstonly', label: 'Aprueba el primer cobro y falla los recurrentes' }
};
const DECLINE_REASON = 'Fondos insuficientes';
const RECURRING_DECLINE_REASON = 'La tarjeta fue rechazada por el banco emisor';

function luhnValid(number) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let d = Number(number[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function cardBrand(number) {
  if (/^4/.test(number)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'Amex';
  return 'Tarjeta';
}

function paymentError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function sign(rawBody) {
  return crypto.createHmac('sha256', config.PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
}

// Cobros ya procesados por llave de idempotencia (la pasarela real los guarda de su lado).
const chargesByKey = new Map();

const simulatedProvider = {
  name: 'simulated',
  testCards: Object.entries(TEST_CARDS).map(([number, c]) => ({ number: number.replace(/(\d{4})(?=\d)/g, '$1 '), label: c.label })),

  tokenize({ number, expMonth, expYear, cvc, holder } = {}) {
    const digits = String(number || '').replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(digits) || !luhnValid(digits)) throw paymentError('El número de tarjeta no es válido.');
    const month = Number(expMonth);
    let year = Number(expYear);
    if (year < 100) year += 2000;
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
      throw paymentError('La fecha de vencimiento no es válida.');
    }
    const now = new Date();
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
      throw paymentError('La tarjeta está vencida.');
    }
    if (!/^\d{3,4}$/.test(String(cvc || ''))) throw paymentError('El código de seguridad (CVV) no es válido.');
    if (!holder || !String(holder).trim()) throw paymentError('Escribe el nombre que aparece en la tarjeta.');

    const behavior = (TEST_CARDS[digits] || { behavior: 'ok' }).behavior;
    const brand = cardBrand(digits);
    return {
      token: `tok_sim_${behavior}_${brand.toLowerCase()}_${digits.slice(-4)}_${crypto.randomBytes(8).toString('hex')}`,
      brand,
      last4: digits.slice(-4),
      provider: 'simulated'
    };
  },

  // Marca y últimos 4 de un token, como la consulta de un medio de pago en la pasarela.
  describeToken(token) {
    const match = /^tok_sim_(ok|decline|firstonly)_([a-z]+)_(\d{4})_[a-f0-9]+$/.exec(token || '');
    if (!match) return null;
    return { brand: match[2].charAt(0).toUpperCase() + match[2].slice(1), last4: match[3] };
  },

  // recurring: true para los cobros mensuales (la tarjeta 0341 solo falla en esos).
  charge({ token, amountCOP, idempotencyKey, description, recurring = false }) {
    if (!idempotencyKey) throw paymentError('Falta la llave de idempotencia.');
    if (chargesByKey.has(idempotencyKey)) return { ...chargesByKey.get(idempotencyKey), idempotentReplay: true };

    const match = /^tok_sim_(ok|decline|firstonly)_/.exec(token || '');
    let status = 'APPROVED';
    let reason = null;
    if (!match) {
      status = 'DECLINED';
      reason = 'Medio de pago no reconocido';
    } else if (match[1] === 'decline') {
      status = 'DECLINED';
      reason = DECLINE_REASON;
    } else if (match[1] === 'firstonly' && recurring) {
      status = 'DECLINED';
      reason = RECURRING_DECLINE_REASON;
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
    chargesByKey.set(idempotencyKey, result);
    return result;
  },

  // Evento que la pasarela enviaría a POST /api/webhooks/payments, con su firma HMAC.
  buildWebhook(charge) {
    const rawBody = JSON.stringify({
      type: charge.status === 'APPROVED' ? 'charge.succeeded' : 'charge.failed',
      data: { chargeId: charge.chargeId, status: charge.status, amountCOP: charge.amountCOP, feeCOP: charge.feeCOP }
    });
    return { rawBody, signature: sign(rawBody) };
  },

  verifyWebhook(rawBody, signature) {
    if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;
    return crypto.timingSafeEqual(Buffer.from(sign(rawBody), 'hex'), Buffer.from(signature, 'hex'));
  }
};

const PROVIDERS = { simulated: simulatedProvider };
const providerName = process.env.PAYMENT_PROVIDER || 'simulated';
if (!PROVIDERS[providerName]) {
  throw new Error(`PAYMENT_PROVIDER desconocido: ${providerName}. Disponibles: ${Object.keys(PROVIDERS).join(', ')}`);
}

module.exports = PROVIDERS[providerName];
