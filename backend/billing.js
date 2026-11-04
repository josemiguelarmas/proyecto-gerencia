// HU-08, HU-12 y HU-15: suscripción, cobros recurrentes, conciliación y facturación electrónica.
const { db } = require('./database');
const config = require('./config');
const mail = require('./mail');
const payments = require('./payments');
const invoicing = require('./invoicing');

const DAY_MS = 86400000;

function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

// Suma meses respetando el fin de mes (31 de enero + 1 mes = 28/29 de febrero).
function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

function formatCOP(value) {
  return `COP ${Number(value).toLocaleString('es-CO')}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------------------------------------------------------------
// HU-12: matriz de transiciones de la suscripción
// ---------------------------------------------------------------
const TRANSITIONS = {
  subscribe: { from: ['NONE', 'CANCELLED'], error: 'Ya tienes una suscripción. Usa "Cambiar plan" o "Actualizar medio de pago".' },
  pause: { from: ['ACTIVE'], error: 'Solo puedes pausar una suscripción activa.' },
  resume: { from: ['PAUSED'], error: 'Solo puedes reanudar una suscripción en pausa.' },
  changePlan: { from: ['ACTIVE', 'PAUSED'], error: 'No puedes cambiar de plan en este estado.' },
  cancel: { from: ['ACTIVE', 'PAUSED', 'PAST_DUE'], error: 'No tienes una suscripción activa para cancelar.' },
  updatePaymentMethod: { from: ['ACTIVE', 'PAUSED', 'PAST_DUE'], error: 'No tienes una suscripción para actualizar.' },
  chargeFailed: { from: ['ACTIVE'], error: 'Solo una suscripción activa puede quedar en mora.' }
};

const STATUS_LABELS = { NONE: 'sin suscripción', ACTIVE: 'activa', PAUSED: 'en pausa', CANCELLED: 'cancelada', PAST_DUE: 'con pago pendiente' };

function canTransition(status, action) {
  const rule = TRANSITIONS[action];
  return Boolean(rule && rule.from.includes(status));
}

function assertTransition(sub, action) {
  if (canTransition(sub.status, action)) return;
  if (action === 'cancel' && sub.status === 'CANCELLED') throw httpError(409, 'Tu suscripción ya está cancelada.');
  throw httpError(409, `${TRANSITIONS[action].error} Estado actual: ${STATUS_LABELS[sub.status] || sub.status}.`, { code: 'INVALID_TRANSITION' });
}

// Lo que el cliente ve de su suscripción (sin el token de pago).
function publicSubscription(sub) {
  const { paymentToken, ...rest } = sub;
  const plan = config.PLANS[sub.plan] || null;
  return {
    ...rest,
    hasPaymentMethod: Boolean(paymentToken),
    planName: plan ? plan.name : sub.plan,
    priceCOP: plan ? plan.priceCOP : null,
    pendingPlanName: sub.pendingPlan ? config.PLANS[sub.pendingPlan].name : null
  };
}

// ---------------------------------------------------------------
// HU-15: datos fiscales y facturas
// ---------------------------------------------------------------
function validateFiscal(fiscal) {
  if (!fiscal || typeof fiscal !== 'object') return 'Completa tus datos de facturación.';
  const { docType, docNumber, address, city } = fiscal;
  if (!config.FISCAL_DOC_TYPES[docType]) return 'Elige un tipo de documento válido.';
  if (!/^\d{5,15}(-\d)?$/.test(String(docNumber || '').trim())) return 'El número de documento debe tener entre 5 y 15 dígitos (NIT con dígito de verificación: 900123456-7).';
  if (!address || String(address).trim().length < 5) return 'Escribe la dirección de facturación.';
  if (!city || String(city).trim().length < 2) return 'Escribe la ciudad de facturación.';
  return null;
}

function cleanFiscal(fiscal) {
  return {
    docType: fiscal.docType,
    docNumber: String(fiscal.docNumber).trim(),
    address: String(fiscal.address).trim(),
    city: String(fiscal.city).trim()
  };
}

function buyerFor(user) {
  return { name: user.name, email: user.email, ...(user.fiscal || {}) };
}

function invoiceMailBody(invoice) {
  return [
    `Factura electrónica ${invoice.number} · SIMULADO (ambiente de habilitación DIAN, sin validez fiscal).`,
    `Emisor: ${config.ISSUER.name} · NIT ${config.ISSUER.nit}.`,
    `Adquiriente: ${invoice.buyer.name} · ${invoice.buyer.docType} ${invoice.buyer.docNumber} · ${invoice.buyer.address}, ${invoice.buyer.city}.`,
    `${invoice.lines[0].description}.`,
    `Subtotal ${formatCOP(invoice.subtotalCOP)} · IVA ${Math.round(invoice.ivaRate * 100)} % ${formatCOP(invoice.ivaCOP)} · Total ${formatCOP(invoice.totalCOP)}.`,
    `CUFE: ${invoice.cufe}`
  ].join(' ');
}

function alertTeam(invoice, error) {
  const message = `La factura ${invoice.number} (pago ${invoice.paymentId}) no se pudo emitir: ${error.message}`;
  const existing = db.data.alerts.find(a => a.refId === invoice.id && !a.resolvedAt);
  if (existing) {
    existing.message = message;
    existing.updatedAt = new Date().toISOString();
    db.save();
    return existing;
  }
  mail.send({ to: config.TEAM_ALERT_EMAIL, type: 'INVOICE_ALERT', subject: `Alerta: factura ${invoice.number} pendiente de reintento`, body: message });
  return db.addAlert({ type: 'INVOICING_FAILED', refId: invoice.id, message });
}

// Intenta emitir la factura con el proveedor. Si falla queda PENDING_RETRY (o FAILED al agotar reintentos).
function tryIssue(invoice, now = new Date()) {
  const user = db.findUserById(invoice.userId);
  invoice.buyer = buyerFor(user);
  invoice.attempts = (invoice.attempts || 0) + 1;
  invoice.issuedAt = now.toISOString();
  try {
    const result = invoicing.issue(invoice);
    Object.assign(invoice, { status: 'ISSUED', cufe: result.cufe, environment: result.environment, provider: result.provider, lastError: null, nextRetryAt: null });
    db.data.alerts.filter(a => a.refId === invoice.id && !a.resolvedAt).forEach(a => { a.resolvedAt = now.toISOString(); });
    db.save();
    mail.send({ to: user.email, type: 'INVOICE', subject: `Tu factura electrónica ${invoice.number}`, body: invoiceMailBody(invoice) });
  } catch (error) {
    const delays = config.INVOICE_RETRY_MINUTES;
    const exhausted = invoice.attempts > delays.length;
    Object.assign(invoice, {
      status: exhausted ? 'FAILED' : 'PENDING_RETRY',
      lastError: error.message,
      nextRetryAt: exhausted ? null : new Date(now.getTime() + delays[invoice.attempts - 1] * 60000).toISOString()
    });
    db.save();
    alertTeam(invoice, error);
  }
  return invoice;
}

// Factura de un pago aprobado. El precio del plan incluye IVA.
function invoiceForPayment(payment, now = new Date()) {
  const total = payment.amountCOP;
  const subtotal = Math.round(total / (1 + config.IVA_RATE));
  const plan = config.PLANS[payment.plan];
  const invoice = db.addInvoice({
    prefix: config.INVOICE_PREFIX,
    userId: payment.userId,
    paymentId: payment.id,
    issuer: config.ISSUER,
    buyer: buyerFor(db.findUserById(payment.userId)),
    lines: [{ description: `Suscripción The Clothes Box plan ${plan ? plan.name : payment.plan} · periodo ${payment.period}`, quantity: 1, totalCOP: total }],
    subtotalCOP: subtotal,
    ivaRate: config.IVA_RATE,
    ivaCOP: total - subtotal,
    totalCOP: total,
    status: 'PENDING_RETRY',
    attempts: 0,
    simulated: true
  });
  payment.invoiceId = invoice.id;
  db.save();
  return tryIssue(invoice, now);
}

function runInvoiceRetries(now = new Date()) {
  const due = db.data.invoices.filter(i => i.status === 'PENDING_RETRY' && i.nextRetryAt && new Date(i.nextRetryAt) <= now);
  due.forEach(i => tryIssue(i, now));
  return {
    retried: due.length,
    issued: due.filter(i => i.status === 'ISSUED').length,
    stillPending: due.filter(i => i.status === 'PENDING_RETRY').length,
    failed: due.filter(i => i.status === 'FAILED').length
  };
}

// ---------------------------------------------------------------
// HU-08: cobros, webhook y conciliación
// ---------------------------------------------------------------

// Procesa un evento de la pasarela. Devuelve { status, body } para la respuesta HTTP.
function processPaymentWebhook(rawBody, signature) {
  if (!payments.verifyWebhook(rawBody, signature)) {
    return { status: 401, body: { error: 'Firma del webhook inválida.' } };
  }
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return { status: 400, body: { error: 'El cuerpo del webhook no es JSON válido.' } };
  }
  const data = event.data || {};
  const payment = db.findPayment(p => p.providerChargeId === data.chargeId);
  if (!payment) return { status: 404, body: { error: 'Cobro no encontrado para conciliar.' } };

  const mismatches = [];
  if (data.status !== payment.status) mismatches.push(`estado ${data.status} ≠ ${payment.status}`);
  if (Number(data.amountCOP) !== payment.amountCOP) mismatches.push(`monto ${data.amountCOP} ≠ ${payment.amountCOP}`);
  payment.reconciliation = {
    status: mismatches.length ? 'MISMATCH' : 'OK',
    at: new Date().toISOString(),
    detail: mismatches.join(' · ') || null,
    event: event.type
  };
  db.save();
  return { status: 200, body: { received: true, paymentId: payment.id, reconciliation: payment.reconciliation } };
}

// El proveedor simulado entrega su webhook firmado en el acto, por la misma verificación que usa el endpoint.
function deliverSimulatedWebhook(charge) {
  if (payments.name !== 'simulated') return;
  const { rawBody, signature } = payments.buildWebhook(charge);
  processPaymentWebhook(rawBody, signature);
}

// Cobra a una suscripción y registra el pago (y su factura si se aprueba).
function chargeSubscription(sub, { kind, period, idempotencyKey, token = sub.paymentToken, now = new Date() }) {
  const plan = config.PLANS[sub.plan];
  const existing = db.findPayment(p => p.idempotencyKey === idempotencyKey);
  if (existing) return existing;

  const charge = payments.charge({
    token,
    amountCOP: plan.priceCOP,
    idempotencyKey,
    description: `The Clothes Box plan ${plan.name} · ${period}`,
    recurring: kind !== 'INITIAL'
  });
  const payment = db.addPayment({
    userId: sub.userId,
    subscriptionId: sub.id || null,
    plan: sub.plan,
    period,
    kind,
    amountCOP: plan.priceCOP,
    feeCOP: charge.feeCOP,
    netCOP: plan.priceCOP - charge.feeCOP,
    status: charge.status,
    reason: charge.reason,
    idempotencyKey,
    providerChargeId: charge.chargeId,
    provider: charge.provider,
    createdAt: now.toISOString()
  });
  deliverSimulatedWebhook(charge);
  if (payment.status === 'APPROVED') invoiceForPayment(payment, now);
  return db.findPayment(p => p.id === payment.id);
}

function periodKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function subscribe(user, { plan, paymentToken, fiscal }, now = new Date()) {
  if (!config.PLANS[plan]) throw httpError(400, 'Elige un plan válido: Esencial o Estilo.');
  const card = payments.describeToken(paymentToken);
  if (!card) throw httpError(400, 'Registra una tarjeta antes de pagar.');
  if (fiscal) {
    const fiscalError = validateFiscal(fiscal);
    if (fiscalError) throw httpError(400, fiscalError);
    db.updateUser(user.id, { fiscal: cleanFiscal(fiscal) });
  } else if (validateFiscal(user.fiscal)) {
    throw httpError(400, 'Completa tus datos de facturación para emitir la factura electrónica.');
  }

  const current = db.getSubscription(user.id);
  assertTransition(current, 'subscribe');

  const draft = { ...current, plan };
  const payment = chargeSubscription(draft, {
    kind: 'INITIAL',
    period: periodKey(now),
    idempotencyKey: `initial_${user.id}_${periodKey(now)}_${paymentToken}`,
    token: paymentToken,
    now
  });
  if (payment.status !== 'APPROVED') {
    throw httpError(402, `El pago fue rechazado: ${payment.reason}. Tu suscripción no se activó.`, { reason: payment.reason, paymentId: payment.id });
  }

  const sub = db.saveSubscription(user.id, {
    plan,
    status: 'ACTIVE',
    paymentToken,
    cardBrand: card.brand,
    cardLast4: card.last4,
    startedAt: now.toISOString(),
    nextChargeAt: addMonths(now, 1).toISOString(),
    pendingPlan: null,
    pendingPlanFrom: null,
    pausedUntil: null,
    dunning: null,
    cancelledAt: null,
    lastPaymentId: payment.id
  });
  payment.subscriptionId = sub.id;
  const profile = db.getProfile(user.id);
  if (profile) db.saveProfile(user.id, { ...profile, plan });
  db.save();

  const freshUser = db.findUserById(user.id);
  mail.send({
    to: freshUser.email,
    type: 'SUBSCRIPTION_CONFIRMED',
    subject: `Tu plan ${config.PLANS[plan].name} está activo`,
    body: `Hola ${freshUser.name}, recibimos tu pago de ${formatCOP(payment.amountCOP)} con ${card.brand} terminada en ${card.last4}. Tu próximo cobro será el ${formatDate(sub.nextChargeAt)}. Pago SIMULADO: no se movió dinero real.`
  });
  return { subscription: sub, payment, invoice: db.data.invoices.find(i => i.id === payment.invoiceId) || null };
}

function advanceAfterApproval(sub, payment, now) {
  Object.assign(sub, {
    status: 'ACTIVE',
    dunning: null,
    lastPaymentId: payment.id,
    nextChargeAt: addMonths(sub.nextChargeAt || now, 1).toISOString(),
    updatedAt: now.toISOString()
  });
  if (!payment.subscriptionId) payment.subscriptionId = sub.id;
}

function notifyFailure(sub, type, subject, body) {
  const user = db.findUserById(sub.userId);
  if (user) mail.send({ to: user.email, type, subject, body: `Hola ${user.name}, ${body}` });
}

// Un intento de cobro recurrente (o un reintento) para una suscripción que lo tiene vencido.
function billOne(sub, now) {
  const retryDays = config.PAYMENT_RETRY_DAYS;

  if (sub.dunning) {
    if (new Date(sub.dunning.nextRetryAt) > now) return null;
    const attempt = sub.dunning.attempts + 1;
    const payment = chargeSubscription(sub, { kind: 'RETRY', period: sub.dunning.period, idempotencyKey: `recurring_${sub.id}_${sub.dunning.period}_r${attempt}`, now });
    if (payment.status === 'APPROVED') {
      advanceAfterApproval(sub, payment, now);
      return { subscriptionId: sub.id, result: 'RETRY_APPROVED', attempt };
    }
    sub.dunning.attempts = attempt;
    sub.dunning.lastReason = payment.reason;
    if (attempt >= retryDays.length) {
      sub.status = 'PAST_DUE';
      sub.dunning.nextRetryAt = null;
      notifyFailure(sub, 'PAYMENT_PAST_DUE', 'Actualiza tu medio de pago',
        `no pudimos cobrar tu plan después de ${attempt + 1} intentos (${payment.reason}). Tu suscripción quedó con pago pendiente y no despacharemos cajas hasta que actualices tu medio de pago en ${config.APP_BASE_URL}/#/perfil. Mensaje SIMULADO.`);
      return { subscriptionId: sub.id, result: 'PAST_DUE', attempt };
    }
    sub.dunning.nextRetryAt = new Date(new Date(sub.dunning.firstFailedAt).getTime() + retryDays[attempt] * DAY_MS).toISOString();
    return { subscriptionId: sub.id, result: 'RETRY_FAILED', attempt };
  }

  if (!sub.nextChargeAt || new Date(sub.nextChargeAt) > now) return null;

  // HU-12: un cambio de plan programado aplica en el cobro desde el que rige.
  if (sub.pendingPlan && new Date(sub.pendingPlanFrom) <= new Date(sub.nextChargeAt)) {
    sub.plan = sub.pendingPlan;
    sub.pendingPlan = null;
    sub.pendingPlanFrom = null;
    const profile = db.getProfile(sub.userId);
    if (profile) profile.plan = sub.plan;
  }

  const period = periodKey(sub.nextChargeAt);
  const payment = chargeSubscription(sub, { kind: 'RECURRING', period, idempotencyKey: `recurring_${sub.id}_${period}`, now });
  if (payment.status === 'APPROVED') {
    advanceAfterApproval(sub, payment, now);
    return { subscriptionId: sub.id, result: 'APPROVED' };
  }
  if (retryDays.length === 0) {
    sub.status = 'PAST_DUE';
    sub.dunning = { period, firstFailedAt: now.toISOString(), attempts: 0, nextRetryAt: null, lastReason: payment.reason };
    return { subscriptionId: sub.id, result: 'PAST_DUE' };
  }
  sub.dunning = {
    period,
    firstFailedAt: now.toISOString(),
    attempts: 0,
    nextRetryAt: new Date(now.getTime() + retryDays[0] * DAY_MS).toISOString(),
    lastReason: payment.reason
  };
  notifyFailure(sub, 'PAYMENT_RETRY_SCHEDULED', 'No pudimos cobrar tu plan',
    `el cobro de tu plan fue rechazado (${payment.reason}). Lo reintentaremos en ${retryDays.join(', ')} días. Si quieres, actualiza tu medio de pago en ${config.APP_BASE_URL}/#/perfil. Mensaje SIMULADO.`);
  return { subscriptionId: sub.id, result: 'FAILED_RETRY_SCHEDULED' };
}

// Cobro mensual. Se puede correr a diario: solo cobra lo vencido y una vez por periodo.
function runRecurringBilling(now = new Date()) {
  const results = [];
  db.data.subscriptions.forEach(sub => {
    // HU-12: la pausa termina sola al llegar su fecha y el cobro sigue en la misma corrida.
    if (sub.status === 'PAUSED' && sub.pausedUntil && new Date(sub.pausedUntil) <= now) {
      Object.assign(sub, { status: 'ACTIVE', pausedUntil: null, resumedAt: now.toISOString() });
      notifyFailure(sub, 'SUBSCRIPTION_RESUMED', 'Tu plan se reanudó', 'terminó tu mes de pausa y tu plan está activo otra vez. Mensaje SIMULADO.');
      results.push({ subscriptionId: sub.id, result: 'RESUMED' });
    }
    if (sub.status !== 'ACTIVE') return;
    const outcome = billOne(sub, now);
    if (outcome) results.push(outcome);
  });
  db.save();
  const count = r => results.filter(x => x.result === r).length;
  return {
    ranAt: now.toISOString(),
    approved: count('APPROVED') + count('RETRY_APPROVED'),
    failed: count('FAILED_RETRY_SCHEDULED') + count('RETRY_FAILED'),
    pastDue: count('PAST_DUE'),
    resumed: count('RESUMED'),
    results
  };
}

function updatePaymentMethod(userId, paymentToken, now = new Date()) {
  const sub = db.getSubscription(userId);
  assertTransition(sub, 'updatePaymentMethod');
  const card = payments.describeToken(paymentToken);
  if (!card) throw httpError(400, 'Registra una tarjeta válida.');

  // Con pago pendiente, el nuevo medio se cobra en el acto para regularizar.
  if (sub.status === 'PAST_DUE' || sub.dunning) {
    const period = sub.dunning ? sub.dunning.period : periodKey(now);
    const payment = chargeSubscription(sub, { kind: 'RETRY', period, idempotencyKey: `recurring_${sub.id}_${period}_update_${paymentToken}`, token: paymentToken, now });
    if (payment.status !== 'APPROVED') {
      throw httpError(402, `El pago fue rechazado: ${payment.reason}. Prueba con otra tarjeta.`, { reason: payment.reason });
    }
    Object.assign(sub, { paymentToken, cardBrand: card.brand, cardLast4: card.last4 });
    advanceAfterApproval(sub, payment, now);
    db.save();
    return { subscription: sub, payment, message: `Pago aprobado con ${card.brand} terminada en ${card.last4}. Tu suscripción está activa otra vez.` };
  }

  const updated = db.saveSubscription(userId, { paymentToken, cardBrand: card.brand, cardLast4: card.last4 });
  return { subscription: updated, payment: null, message: `Medio de pago actualizado: ${card.brand} terminada en ${card.last4}.` };
}

// ---------------------------------------------------------------
// HU-12: pausar, reanudar y cambiar de plan
// ---------------------------------------------------------------
function pause(userId, now = new Date()) {
  const sub = db.getSubscription(userId);
  assertTransition(sub, 'pause');
  if (sub.dunning) throw httpError(409, 'Tienes un cobro pendiente. Actualiza tu medio de pago antes de pausar.');
  // Se salta el próximo cobro (y su caja): la pausa dura hasta ese cobro + 1 mes.
  const skipped = sub.nextChargeAt || now.toISOString();
  const pausedUntil = addMonths(skipped, config.PAUSE_MONTHS).toISOString();
  const updated = db.saveSubscription(userId, { status: 'PAUSED', pausedAt: now.toISOString(), skippedChargeAt: skipped, pausedUntil, nextChargeAt: pausedUntil });
  return { subscription: updated, message: `Pausamos tu plan. No te cobramos ni despachamos el próximo mes. Se reanuda solo el ${formatDate(pausedUntil)}.` };
}

function resume(userId, now = new Date()) {
  const sub = db.getSubscription(userId);
  assertTransition(sub, 'resume');
  // Reanudar antes de tiempo recupera el cobro saltado si aún no ha pasado.
  const next = sub.skippedChargeAt && new Date(sub.skippedChargeAt) > now ? sub.skippedChargeAt : now.toISOString();
  const updated = db.saveSubscription(userId, { status: 'ACTIVE', pausedUntil: null, skippedChargeAt: null, resumedAt: now.toISOString(), nextChargeAt: next });
  return { subscription: updated, message: `Tu plan está activo otra vez. Próximo cobro: ${formatDate(next)}.` };
}

// Antes del día de corte el cambio alcanza la próxima caja; desde el corte aplica un ciclo después.
function planChangeEffect(sub, now = new Date()) {
  const beforeCutoff = now.getDate() < config.SUBSCRIPTION_CUTOFF_DAY;
  const nextCharge = sub.nextChargeAt || now.toISOString();
  return {
    beforeCutoff,
    cutoffDay: config.SUBSCRIPTION_CUTOFF_DAY,
    effectiveFrom: beforeCutoff ? nextCharge : addMonths(nextCharge, 1).toISOString()
  };
}

function changePlan(userId, plan, now = new Date()) {
  if (!config.PLANS[plan]) throw httpError(400, 'Elige un plan válido: Esencial o Estilo.');
  const sub = db.getSubscription(userId);
  assertTransition(sub, 'changePlan');
  if (sub.plan === plan && !sub.pendingPlan) throw httpError(409, `Ya estás en el plan ${config.PLANS[plan].name}.`);

  // Volver al plan actual deshace un cambio programado.
  if (sub.plan === plan) {
    const updated = db.saveSubscription(userId, { pendingPlan: null, pendingPlanFrom: null });
    return { subscription: updated, effect: null, message: `Listo, sigues en el plan ${config.PLANS[plan].name}.` };
  }

  const effect = planChangeEffect(sub, now);
  const name = config.PLANS[plan].name;
  let updated;
  if (effect.beforeCutoff) {
    updated = db.saveSubscription(userId, { plan, pendingPlan: null, pendingPlanFrom: null, planChangedAt: now.toISOString() });
    const profile = db.getProfile(userId);
    if (profile) db.saveProfile(userId, { ...profile, plan });
  } else {
    updated = db.saveSubscription(userId, { pendingPlan: plan, pendingPlanFrom: effect.effectiveFrom, planChangedAt: now.toISOString() });
  }
  const message = effect.beforeCutoff
    ? `Cambiaste al plan ${name}. Aplica desde tu próxima caja (cobro del ${formatDate(effect.effectiveFrom)}).`
    : `Ya pasó el día de corte (${effect.cutoffDay}). Tu próxima caja sigue en el plan actual y el plan ${name} aplica desde el cobro del ${formatDate(effect.effectiveFrom)}.`;
  return { subscription: updated, effect, message };
}

function paymentsReport() {
  const all = db.getPayments();
  const approved = all.filter(p => p.status === 'APPROVED');
  const sum = (list, key) => list.reduce((acc, p) => acc + (p[key] || 0), 0);
  const byMonth = {};
  approved.forEach(p => {
    const month = p.createdAt.slice(0, 7);
    byMonth[month] = byMonth[month] || { month, count: 0, grossCOP: 0, feeCOP: 0, netCOP: 0 };
    byMonth[month].count++;
    byMonth[month].grossCOP += p.amountCOP;
    byMonth[month].feeCOP += p.feeCOP;
    byMonth[month].netCOP += p.netCOP;
  });
  const reconciliation = { OK: 0, PENDING: 0, MISMATCH: 0 };
  all.forEach(p => { reconciliation[p.reconciliation.status] = (reconciliation[p.reconciliation.status] || 0) + 1; });
  return {
    feeRate: config.PAYMENT_FEE_RATE,
    approvedCount: approved.length,
    declinedCount: all.length - approved.length,
    grossCOP: sum(approved, 'amountCOP'),
    feeCOP: sum(approved, 'feeCOP'),
    netCOP: sum(approved, 'netCOP'),
    byMonth: Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month)),
    reconciliation
  };
}

module.exports = {
  TRANSITIONS,
  canTransition,
  addMonths,
  publicSubscription,
  validateFiscal,
  cleanFiscal,
  subscribe,
  updatePaymentMethod,
  runRecurringBilling,
  runInvoiceRetries,
  processPaymentWebhook,
  pause,
  resume,
  changePlan,
  planChangeEffect,
  assertTransition,
  paymentsReport
};
