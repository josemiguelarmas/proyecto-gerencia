// HU-08 (SCRUM-56..62): plan and recurring payment against the simulated gateway. Card data
// is tokenized in the browser SDK and the server refuses card-like fields; the subscription
// keeps only token, brand and last 4; the signed webhook is idempotent by event id; the
// reconciliation job asks the gateway for charges without an event; failed monthly charges
// are retried on the configured schedule and end in PAST_DUE; unverified e-mails cannot subscribe.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { startServer } = require('./helpers/server');

let app;
let db;
let config;
let billing;
let payments;
let gateway;
let jobs;

before(async () => {
  app = await startServer();
  ({ db } = require('../backend/database'));
  config = require('../backend/config');
  billing = require('../backend/billing');
  payments = require('../backend/adapters/payments');
  gateway = require('../frontend/js/simulatedGateway');
  jobs = require('../backend/jobs');
});

after(async () => {
  await app.close();
});

beforeEach(() => {
  payments.resetFake();
});

const FISCAL = { docType: 'CC', docNumber: '1144123456', address: 'Calle 5 # 38-20', city: 'Cali' };
let seq = 0;

async function newClient({ verified = true } = {}) {
  const email = `billing_${Date.now()}_${seq++}@example.test`;
  const reg = await app.post('/api/auth/register', {
    name: 'Cliente Pagos', email, password: 'clave-segura-1', birthDate: '2000-05-20', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  // E-mail verification belongs to stream B; here the flag is set as the verify link would.
  if (verified) db.updateUser(reg.body.user.id, { emailVerified: true });
  return { email, token: reg.body.token, userId: reg.body.user.id };
}

const subscribe = (client, body) => app.post('/api/subscription/subscribe', { plan: 'esencial', fiscal: FISCAL, ...body }, client.token);

function rawWebhook(rawBody, signature) {
  const url = new URL(app.baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: url.hostname, port: url.port, path: '/api/webhooks/payments', method: 'POST', agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rawBody), 'X-Signature': signature } }, res => {
      let text = '';
      res.on('data', c => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(rawBody);
  });
}

// ---------------------------------------------------------------- SCRUM-57
test('SCRUM-57: el servidor rechaza con 400 cualquier cuerpo con datos de tarjeta', async () => {
  const c = await newClient();
  const card = gateway.tokenize({ number: '4242 4242 4242 4242', expMonth: 12, expYear: 2030, cvc: '123', holder: 'Ana' });
  const attempts = [
    { paymentToken: card.token, cardNumber: '4242424242424242' },
    { paymentToken: card.token, cvv: '123' },
    { paymentToken: card.token, card: { number: '4242 4242 4242 4242' } },
    { paymentToken: card.token, note: '4000-0000-0000-0002' }
  ];
  for (const body of attempts) {
    const res = await subscribe(c, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.match(res.body.error, /no recibimos datos de tarjeta/);
  }
  assert.equal((await app.post('/api/subscription/payment-method', { paymentToken: 'tok_ok', cvc: '123' }, c.token)).status, 400);
  assert.equal(db.getPayments(c.userId).length, 0, 'ningún cobro con un cuerpo rechazado');
  assert.equal((await app.post('/api/payments/tokenize', { card: { number: '4242424242424242' } }, c.token)).status, 404);

  const ok = await subscribe(c, { paymentToken: card.token, fiscal: { ...FISCAL, docNumber: '1144123456789' } });
  assert.equal(ok.status, 201, 'un documento de 13 dígitos no es una tarjeta');
  const stored = db.data.subscriptions.find(s => s.userId === c.userId);
  assert.deepEqual([stored.cardBrand, stored.cardLast4], ['Visa', '4242']);
  assert.equal(stored.paymentToken, card.token);
});

test('SCRUM-57: el SDK de la pasarela simulada tokeniza en el cliente sin exponer el número', () => {
  assert.throws(() => gateway.tokenize({ number: '4242 4242 4242 4241', expMonth: 12, expYear: 2030, cvc: '123', holder: 'X' }), /no es válido/);
  assert.throws(() => gateway.tokenize({ number: '4242 4242 4242 4242', expMonth: 12, expYear: 2030, cvc: '1', holder: 'X' }), /CVV/);
  const t = gateway.tokenize({ number: '4000 0000 0000 0002', expMonth: 12, expYear: 2030, cvc: '123', holder: 'X' });
  assert.doesNotMatch(t.token, /4000000000000002/);
  assert.deepEqual(payments.describeToken(t.token), { brand: 'Visa', last4: '0002' });
  assert.equal(payments.INTERFACE.includes('tokenize'), false, 'el servidor no tokeniza');
});

// ---------------------------------------------------------------- SCRUM-58
test('SCRUM-58: un correo sin verificar no puede suscribirse ni se le cobra', async () => {
  const c = await newClient({ verified: false });
  const res = await subscribe(c, { paymentToken: 'tok_ok' });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
  assert.match(res.body.error, /Verifica tu correo/);
  assert.equal(db.getPayments(c.userId).length, 0);
  assert.equal(db.getSubscription(c.userId).status, 'NONE');
  db.updateUser(c.userId, { emailVerified: true });
  assert.equal((await subscribe(c, { paymentToken: 'tok_ok' })).status, 201);
});

test('SCRUM-58: el ciclo se ancla al día de alta (31 de enero → 28 de febrero → 31 de marzo)', async () => {
  const c = await newClient();
  const anchor = new Date(2027, 0, 31, 12);
  const { subscription } = billing.subscribe(db.findUserById(c.userId), { plan: 'estilo', paymentToken: 'tok_ok', fiscal: FISCAL }, anchor);
  assert.equal(subscription.cycleAnchor, anchor.toISOString());
  assert.equal(new Date(subscription.nextChargeAt).getDate(), 28);
  billing.runRecurringBilling(new Date(2027, 1, 28, 13));
  const sub = db.getSubscription(c.userId);
  assert.equal(new Date(sub.nextChargeAt).getMonth(), 2);
  assert.equal(new Date(sub.nextChargeAt).getDate(), 31, 'no se corre al 28 para siempre');
  const pub = billing.publicSubscription(sub);
  assert.equal(pub.nextBillingAt, sub.nextChargeAt);
  assert.equal(pub.paymentToken, undefined, 'el token no sale al cliente');
  assert.deepEqual(Object.keys(sub).filter(k => /card|cvv|cvc|number/i.test(k)).sort(), ['cardBrand', 'cardLast4']);
});

test('SCRUM-58: PLAN_CONFIG trae precio, prendas y costo objetivo (40 % del precio por defecto)', () => {
  assert.deepEqual(Object.keys(config.PLAN_CONFIG), ['esencial', 'estilo']);
  assert.equal(config.PLAN_CONFIG.esencial.priceCOP, 129900);
  assert.equal(config.PLAN_CONFIG.estilo.items, 5);
  assert.equal(config.PLAN_CONFIG.esencial.targetCost, Math.round(129900 * 0.40));
  assert.equal(config.PLAN_CONFIG.estilo.billingCycleMonths, 1);
});

// ---------------------------------------------------------------- SCRUM-59
test('SCRUM-59: webhook con firma inválida 401 y webhook duplicado (mismo id de evento) no se reaplica', async () => {
  const c = await newClient();
  assert.equal((await subscribe(c, { paymentToken: 'tok_ok' })).status, 201);
  const payment = db.getPayments(c.userId)[0];
  const charge = { chargeId: payment.providerChargeId, status: 'APPROVED', amountCOP: payment.amountCOP, feeCOP: payment.feeCOP };

  const forged = payments.buildWebhook(charge, { eventId: 'evt_forged' });
  assert.equal((await rawWebhook(forged.rawBody, 'a'.repeat(64))).status, 401);
  assert.equal((await rawWebhook(forged.rawBody, 'no-hex')).status, 401);
  const tampered = forged.rawBody.replace(`"amountCOP":${payment.amountCOP}`, '"amountCOP":1');
  assert.equal((await rawWebhook(tampered, forged.signature)).status, 401, 'cuerpo alterado con la firma original');

  const wrong = payments.buildWebhook({ ...charge, amountCOP: 1 }, { eventId: 'evt_dup_1' });
  const first = await rawWebhook(wrong.rawBody, wrong.signature);
  assert.equal(first.status, 200);
  assert.equal(first.body.reconciliation.status, 'MISMATCH');
  assert.ok(db.getAlerts().some(a => a.type === 'PAYMENT_MISMATCH' && a.refId === payment.id && !a.resolvedAt), 'alerta al equipo');

  const again = await rawWebhook(wrong.rawBody, wrong.signature);
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(db.getAlerts().filter(a => a.type === 'PAYMENT_MISMATCH' && a.refId === payment.id).length, 1, 'el duplicado no crea otra alerta');

  const good = payments.buildWebhook(charge, { eventId: 'evt_dup_2' });
  assert.equal((await rawWebhook(good.rawBody, good.signature)).body.reconciliation.status, 'OK');
  assert.ok(db.getAlerts().find(a => a.type === 'PAYMENT_MISMATCH' && a.refId === payment.id).resolvedAt, 'la alerta se cierra');
  const replayOld = await rawWebhook(wrong.rawBody, wrong.signature);
  assert.equal(replayOld.body.duplicate, true, 'un evento viejo reenviado no vuelve a MISMATCH');
  assert.equal(db.getPayments(c.userId)[0].reconciliation.status, 'OK');
});

test('SCRUM-59: el evento aplica el resultado a un cobro que seguía PENDING (pasarela asíncrona)', async () => {
  const c = await newClient();
  db.updateUser(c.userId, { fiscal: FISCAL });
  const charge = payments.charge({ token: 'tok_ok', amountCOP: 129900, idempotencyKey: `async_${c.userId}`, description: 'x' });
  const payment = db.addPayment({ userId: c.userId, plan: 'esencial', period: '2027-01-10', kind: 'RECURRING', amountCOP: 129900, feeCOP: 0, netCOP: 129900,
    status: 'PENDING', reason: null, idempotencyKey: `async_${c.userId}`, providerChargeId: charge.chargeId, provider: 'simulated' });
  const event = payments.buildWebhook(charge);
  const res = await rawWebhook(event.rawBody, event.signature);
  assert.equal(res.status, 200);
  const stored = db.findPayment(p => p.id === payment.id);
  assert.equal(stored.status, 'APPROVED');
  assert.equal(stored.feeCOP, Math.round(129900 * config.PAYMENT_FEE_RATE));
  assert.equal(stored.netCOP, 129900 - stored.feeCOP);
  assert.equal(stored.reconciliation.status, 'OK');
  assert.ok(stored.invoiceId, 'un cobro confirmado por el evento se factura');
});

test('SCRUM-59: el job de conciliación consulta a la pasarela los cobros sin evento', () => {
  const charge = payments.charge({ token: 'tok_ok', amountCOP: 129900, idempotencyKey: `recon_${Date.now()}`, description: 'x' });
  const base = { userId: 'usr_recon', plan: 'esencial', period: '2027-01-10', kind: 'RECURRING', amountCOP: 129900, feeCOP: charge.feeCOP, netCOP: 129900 - charge.feeCOP, status: 'APPROVED', provider: 'simulated' };
  const old = new Date(Date.now() - 2 * 86400000).toISOString();
  const matching = db.addPayment({ ...base, providerChargeId: charge.chargeId, idempotencyKey: 'r1', createdAt: old });
  const wrongAmount = db.addPayment({ ...base, amountCOP: 199900, netCOP: 199900 - charge.feeCOP, providerChargeId: charge.chargeId, idempotencyKey: 'r2', createdAt: old });
  const unknown = db.addPayment({ ...base, providerChargeId: 'ch_sim_noexiste', idempotencyKey: 'r3', createdAt: old });
  const fresh = db.addPayment({ ...base, providerChargeId: charge.chargeId, idempotencyKey: 'r4' });

  const result = jobs.jobs.paymentReconciliation.run({ now: new Date() });
  [matching, wrongAmount, unknown].forEach(p => assert.ok(result.stalePendingIds.includes(p.id)));
  assert.equal(result.stalePendingIds.includes(fresh.id), false);
  assert.equal(db.findPayment(p => p.id === matching.id).reconciliation.status, 'OK');
  assert.equal(db.findPayment(p => p.id === matching.id).reconciliation.source, 'job');
  assert.equal(db.findPayment(p => p.id === wrongAmount.id).reconciliation.status, 'MISMATCH');
  assert.equal(db.findPayment(p => p.id === unknown.id).reconciliation.status, 'MISSING');
  assert.ok(result.mismatchIds.includes(wrongAmount.id));
  assert.ok(result.missingIds.includes(unknown.id));
  assert.equal(db.findPayment(p => p.id === fresh.id).reconciliation.status, 'PENDING', 'espera 24 h al webhook');
});

test('SCRUM-59: PAYMENT_WEBHOOK_SECRET es obligatorio si el proveedor no es simulated', () => {
  assert.throws(() => config.resolveWebhookSecret({ provider: 'pasarela_real', secret: '' }), /PAYMENT_WEBHOOK_SECRET/);
  assert.equal(config.resolveWebhookSecret({ provider: 'pasarela_real', secret: 's3cret' }), 's3cret');
  assert.ok(config.resolveWebhookSecret({ provider: 'simulated', secret: '' }).length > 0, 'el simulado tiene secreto de desarrollo');
});

// ---------------------------------------------------------------- SCRUM-62 (sandbox)
const mailsTo = (email, type) => require('../backend/adapters/mailer').sentInMemory().filter(m => m.to === email && m.type === type);

test('SCRUM-62: cobro aprobado activa la suscripción, guarda la comisión en COP enteros y envía la confirmación', async () => {
  const c = await newClient();
  const res = await subscribe(c, { plan: 'estilo', paymentToken: 'tok_ok' });
  assert.equal(res.status, 201);
  assert.equal(res.body.subscription.status, 'ACTIVE');
  const p = res.body.payment;
  assert.equal(p.amountCOP, 199900);
  assert.ok(Number.isInteger(p.feeCOP) && Number.isInteger(p.netCOP));
  assert.equal(p.feeCOP, Math.round(199900 * 0.035));
  assert.equal(p.netCOP, 199900 - p.feeCOP);
  assert.equal(mailsTo(c.email, 'SUBSCRIPTION_CONFIRMED').length, 1);
  const admin = await app.loginAs('ADMIN');
  const report = (await app.get('/api/admin/payments', admin)).body.report;
  assert.equal(report.feeRate, 0.035);
  assert.equal(report.grossCOP - report.feeCOP, report.netCOP);
  assert.equal((await app.get('/api/admin/payments', c.token)).status, 403);
});

test('SCRUM-62: cobro rechazado muestra el motivo y no activa la suscripción', async () => {
  const c = await newClient();
  const res = await subscribe(c, { paymentToken: 'tok_declined' });
  assert.equal(res.status, 402);
  assert.equal(res.body.reason, 'Fondos insuficientes');
  assert.match(res.body.error, /no se activó/);
  assert.equal(db.getSubscription(c.userId).status, 'NONE');
  assert.equal(mailsTo(c.email, 'SUBSCRIPTION_CONFIRMED').length, 0);
});

test('SCRUM-62: el cobro mensual fallido se reintenta a +1, +3 y +5 días, avisa y termina en PAST_DUE', async () => {
  const c = await newClient();
  const card = gateway.tokenize({ number: '4000 0000 0000 0341', expMonth: 12, expYear: 2030, cvc: '123', holder: 'Ana' });
  assert.equal((await subscribe(c, { paymentToken: card.token })).status, 201);
  const sub = () => db.getSubscription(c.userId);
  const t0 = new Date(new Date(sub().nextChargeAt).getTime() + 3600000);
  const at = days => new Date(t0.getTime() + days * 86400000);
  assert.deepEqual(config.PAYMENT_RETRY_DAYS, [1, 3, 5]);

  billing.runRecurringBilling(t0);
  assert.equal(sub().status, 'ACTIVE');
  assert.equal(mailsTo(c.email, 'PAYMENT_RETRY_SCHEDULED').length, 1, 'aviso para actualizar el medio de pago');
  billing.runRecurringBilling(at(1));
  billing.runRecurringBilling(at(3));
  assert.equal(sub().status, 'ACTIVE');
  billing.runRecurringBilling(at(5));
  assert.equal(sub().status, 'PAST_DUE');
  assert.equal(mailsTo(c.email, 'PAYMENT_PAST_DUE').length, 1);
  billing.runRecurringBilling(at(9));
  assert.deepEqual(db.getPayments(c.userId).map(p => p.kind).reverse(), ['INITIAL', 'RECURRING', 'RETRY', 'RETRY', 'RETRY']);
});

// ---------------------------------------------------------------- HU-16 / HU-09 interfaces
test('hasPendingCharge: verdadero con cobro en reintento, PAST_DUE o pago PENDING', async () => {
  const c = await newClient();
  assert.equal(billing.hasPendingCharge(c.userId), false, 'sin suscripción');
  assert.equal((await subscribe(c, { paymentToken: 'tok_ok' })).status, 201);
  assert.equal(billing.hasPendingCharge(c.userId), false, 'al día');
  db.saveSubscription(c.userId, { dunning: { period: '2027-01-10', attempts: 1, nextRetryAt: new Date().toISOString() } });
  assert.equal(billing.hasPendingCharge(c.userId), true, 'cobro fallido en reintento');
  db.saveSubscription(c.userId, { dunning: null, status: 'PAST_DUE' });
  assert.equal(billing.hasPendingCharge(c.userId), true, 'PAST_DUE');
  db.saveSubscription(c.userId, { status: 'ACTIVE' });
  const pending = db.addPayment({ userId: c.userId, plan: 'esencial', period: '2027-01-10', kind: 'RECURRING', amountCOP: 129900, feeCOP: 0, netCOP: 129900, status: 'PENDING', idempotencyKey: `pend_${c.userId}` });
  assert.equal(billing.hasPendingCharge(c.userId), true, 'pago PENDING en la pasarela');
  pending.status = 'DECLINED';
  assert.equal(billing.hasPendingCharge(c.userId), false);
});

test('isCyclePaid: el ciclo AAAA-MM está pago si hay un cobro aprobado con vencimiento en ese mes', async () => {
  const c = await newClient();
  billing.subscribe(db.findUserById(c.userId), { plan: 'esencial', paymentToken: 'tok_ok', fiscal: FISCAL }, new Date(2027, 2, 10, 12));
  const sub = db.getSubscription(c.userId);
  assert.equal(billing.isCyclePaid(c.userId, '2027-03'), true);
  assert.equal(billing.isCyclePaid(sub.id, '2027-03'), true, 'acepta el id de la suscripción');
  assert.equal(billing.isCyclePaid(c.userId, '2027-04'), false, 'abril aún no se cobra');
  billing.runRecurringBilling(new Date(2027, 3, 10, 13));
  assert.equal(billing.isCyclePaid(c.userId, '2027-04'), true);
  assert.equal(billing.isCyclePaid('usr_no_existe', '2027-04'), false);
  assert.throws(() => billing.isCyclePaid(c.userId, '2027-4'), /AAAA-MM/);
});
