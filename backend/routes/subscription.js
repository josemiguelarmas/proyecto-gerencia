// Subscription lifecycle routes: current subscription with recent payments and invoices,
// subscribing with a tokenized card (HU-08), replacing the payment method, pausing, resuming
// and changing plan (HU-12), and cancelling with the optional exit survey (HU-13) plus the
// admin count of cancellation reasons. Billing rules live in backend/billing.js.
const { db } = require('../database');
const config = require('../config');
const billing = require('../billing');
const payments = require('../adapters/payments');
const { sendJson, parseJsonBody, httpError } = require('../lib/http');

// SCRUM-57: card data never reaches this server (the browser tokenizes it with the gateway).
// A body with a card-like field is refused before anything else reads it, and it is not logged.
async function readPaymentBody(req) {
  const body = await parseJsonBody(req);
  const field = payments.findCardData(body);
  if (field) {
    throw httpError(400, `Por seguridad no recibimos datos de tarjeta (campo "${field}"). Registra la tarjeta con la pasarela y envía solo su token.`);
  }
  return body;
}

// HU-08/HU-12: suscripción actual con sus pagos y facturas
function getSubscription({ res, authUser }) {
  const sub = db.getSubscription(authUser.id);
  return sendJson(res, 200, {
    subscription: billing.publicSubscription(sub),
    planChange: sub.status === 'ACTIVE' || sub.status === 'PAUSED' ? billing.planChangeEffect(sub) : null,
    payments: db.getPayments(authUser.id).slice(0, 12),
    invoices: db.getInvoices(authUser.id).slice(0, 12)
  });
}

async function subscribe({ req, res, authUser }) {
  const { plan, paymentToken, fiscal } = await readPaymentBody(req);
  try {
    const result = billing.subscribe(db.findUserById(authUser.id), { plan, paymentToken, fiscal });
    return sendJson(res, 201, {
      success: true,
      message: `¡Listo! Tu plan ${config.PLANS[plan].name} está activo. Pago SIMULADO aprobado.`,
      subscription: billing.publicSubscription(result.subscription),
      payment: result.payment,
      invoice: result.invoice
    });
  } catch (err) {
    if (err.status === 402) return sendJson(res, 402, { error: err.message, reason: err.reason, paymentId: err.paymentId });
    throw err;
  }
}

async function updatePaymentMethod({ req, res, authUser }) {
  const { paymentToken } = await readPaymentBody(req);
  try {
    const result = billing.updatePaymentMethod(authUser.id, paymentToken);
    return sendJson(res, 200, { success: true, message: result.message, subscription: billing.publicSubscription(result.subscription), payment: result.payment });
  } catch (err) {
    if (err.status === 402) return sendJson(res, 402, { error: err.message, reason: err.reason });
    throw err;
  }
}

// HU-12: pausar un mes, reanudar y cambiar de plan
async function changeState({ req, res, authUser, match }) {
  const body = await parseJsonBody(req);
  const action = match[1];
  const result = action === 'pause' ? billing.pause(authUser.id)
    : action === 'resume' ? billing.resume(authUser.id)
      : billing.changePlan(authUser.id, body.plan);
  return sendJson(res, 200, { success: true, message: result.message, effect: result.effect, subscription: billing.publicSubscription(result.subscription) });
}

// HU-13: cancelación con encuesta de salida opcional. La encuesta nunca bloquea la cancelación.
async function cancel({ req, res, authUser }) {
  const { reason, comment } = await parseJsonBody(req);
  const sub = db.getSubscription(authUser.id);
  // HU-12: cancelar detiene los cobros futuros; vale desde activa, en pausa o en mora.
  billing.assertTransition(sub, 'cancel');
  const validReason = reason && config.CANCELLATION_REASONS[reason] ? reason : null;
  const cancellation = db.addCancellation(authUser.id, {
    plan: sub.plan,
    reason: validReason,
    comment: typeof comment === 'string' ? comment.trim().slice(0, 500) : ''
  });
  const updated = db.saveSubscription(authUser.id, {
    status: 'CANCELLED',
    cancelledAt: cancellation.createdAt,
    cancellationId: cancellation.id,
    history: [...(sub.history || []), { type: 'CANCEL', plan: sub.plan, at: cancellation.createdAt }],
    nextChargeAt: null,
    pendingPlan: null,
    pendingPlanFrom: null,
    pausedUntil: null,
    dunning: null
  });
  return sendJson(res, 200, {
    success: true,
    message: 'Tu suscripción quedó cancelada. No se harán más cobros ni despachos.',
    subscription: billing.publicSubscription(updated),
    cancellation
  });
}

// HU-13: conteo agregado de motivos de cancelación (lo usa HU-17)
function cancellationReasons({ res }) {
  const keys = Object.keys(config.CANCELLATION_REASONS);
  const { total, counts, unanswered } = db.getCancellationReasonCounts(keys);
  return sendJson(res, 200, {
    total,
    unanswered,
    reasons: keys.map(key => ({ key, label: config.CANCELLATION_REASONS[key], count: counts[key] }))
  });
}

module.exports = [
  { method: 'GET', path: '/api/subscription', handler: getSubscription },
  { method: 'POST', path: '/api/subscription/subscribe', handler: subscribe },
  { method: 'POST', path: '/api/subscription/payment-method', handler: updatePaymentMethod },
  { method: 'POST', path: /^\/api\/subscription\/(pause|resume|change-plan)$/, handler: changeState },
  { method: 'POST', path: '/api/subscription/cancel', handler: cancel },
  { method: 'GET', path: '/api/admin/cancellation-reasons', handler: cancellationReasons }
];
