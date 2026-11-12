// HU-12 / HU-13 (SCRUM-79..88): subscription lifecycle on the served backend. Covers the
// retention flow (cancel first answers a pause offer and only cancels on explicit
// confirmation), the optional exit survey linked to the cancellation, and the aggregated
// reasons report that HU-17 reads.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');

let app;
let db;
let config;
let billing;

before(async () => {
  app = await startServer();
  ({ db } = require('../backend/database'));
  config = require('../backend/config');
  billing = require('../backend/billing');
});

after(async () => {
  await app.close();
});

const FISCAL = { docType: 'CC', docNumber: '1144123456', address: 'Calle 5 # 38-20', city: 'Cali' };
let seq = 0;

async function subscribedClient(plan = 'esencial') {
  const email = `sub_${Date.now()}_${seq++}@example.test`;
  const reg = await app.post('/api/auth/register', {
    name: 'Cliente Suscripción', email, password: 'clave-segura-1', birthDate: '2000-05-20', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  db.updateUser(reg.body.user.id, { emailVerified: true });
  const res = await app.post('/api/subscription/subscribe', { plan, paymentToken: 'tok_ok', fiscal: FISCAL }, reg.body.token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { email, token: reg.body.token, userId: reg.body.user.id };
}

const cancel = (c, body = {}) => app.post('/api/subscription/cancel', body, c.token);

// ---------------------------------------------------------------- SCRUM-83
test('SCRUM-83: cancelar primero devuelve la oferta de pausa y no cambia nada', async () => {
  const c = await subscribedClient();
  const before = db.getSubscription(c.userId);
  const res = await cancel(c, { reason: 'precio' });
  assert.equal(res.status, 200);
  assert.equal(res.body.step, 'RETENTION_OFFER');
  assert.equal(res.body.requiresConfirmation, true);
  assert.equal(res.body.offer.type, 'PAUSE');
  assert.equal(res.body.offer.months, config.PAUSE_MONTHS);
  assert.equal(res.body.offer.resumesOn, billing.addMonths(before.nextChargeAt, config.PAUSE_MONTHS).toISOString());
  const after = db.getSubscription(c.userId);
  assert.equal(after.status, 'ACTIVE');
  assert.equal(after.nextChargeAt, before.nextChargeAt);
  assert.equal(db.data.cancellations.filter(x => x.userId === c.userId).length, 0, 'sin confirmación no hay cancelación');

  const accepted = await app.post('/api/subscription/pause', {}, c.token);
  assert.equal(accepted.status, 200, 'aceptar la oferta pausa el plan');
  assert.equal(accepted.body.subscription.status, 'PAUSED');
});

test('SCRUM-83: la cancelación se completa solo con confirm: true y detiene los cobros', async () => {
  const c = await subscribedClient();
  for (const confirm of [undefined, false, 'true', 1]) {
    const res = await cancel(c, { confirm });
    assert.equal(res.body.step, 'RETENTION_OFFER', `confirm=${confirm}`);
  }
  const res = await cancel(c, { confirm: true, reason: 'estilo', comment: '  No era mi estilo  ' });
  assert.equal(res.status, 200);
  assert.equal(res.body.step, 'CANCELLED');
  assert.equal(res.body.subscription.status, 'CANCELLED');
  assert.equal(res.body.subscription.nextChargeAt, null);
  const sub = db.getSubscription(c.userId);
  const record = db.data.cancellations.find(x => x.id === sub.cancellationId);
  assert.deepEqual([record.reason, record.comment, record.userId], ['estilo', 'No era mi estilo', c.userId], 'encuesta enlazada a la cancelación');
  const paymentsBefore = db.getPayments(c.userId).length;
  billing.runRecurringBilling(new Date(Date.now() + 90 * 86400000));
  assert.equal(db.getPayments(c.userId).length, paymentsBefore);
  assert.equal((await cancel(c, { confirm: true })).status, 409, 'ya cancelada');
});

test('SCRUM-83: en pausa o con pago pendiente no se ofrece pausa, pero igual se pide confirmar', async () => {
  const paused = await subscribedClient();
  await app.post('/api/subscription/pause', {}, paused.token);
  const offerPaused = await cancel(paused);
  assert.equal(offerPaused.body.step, 'RETENTION_OFFER');
  assert.equal(offerPaused.body.offer, null);
  assert.equal(db.getSubscription(paused.userId).status, 'PAUSED');

  const pastDue = await subscribedClient();
  db.saveSubscription(pastDue.userId, { status: 'PAST_DUE' });
  assert.equal((await cancel(pastDue)).body.offer, null);
  assert.equal((await cancel(pastDue, { confirm: true })).body.subscription.status, 'CANCELLED');

  const none = await app.post('/api/auth/register', {
    name: 'Sin plan', email: `none_${Date.now()}@example.test`, password: 'clave-segura-1', birthDate: '2000-05-20', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  assert.equal((await app.post('/api/subscription/cancel', {}, none.body.token)).status, 409);
});

// ---------------------------------------------------------------- SCRUM-86..88
test('SCRUM-87: la encuesta es opcional y un motivo desconocido se guarda como sin respuesta', async () => {
  const admin = await app.loginAs('ADMIN');
  const before = (await app.get('/api/admin/cancellation-reasons', admin)).body;
  const a = await subscribedClient();
  assert.equal((await cancel(a, { confirm: true })).body.cancellation.reason, null);
  const b = await subscribedClient();
  assert.equal((await cancel(b, { confirm: true, reason: 'inventado' })).body.cancellation.reason, null);
  const c = await subscribedClient('estilo');
  assert.equal((await cancel(c, { confirm: true, reason: 'talla' })).body.cancellation.reason, 'talla');
  const after = (await app.get('/api/admin/cancellation-reasons', admin)).body;
  assert.deepEqual(after.reasons.map(r => r.key), Object.keys(config.CANCELLATION_REASONS));
  assert.deepEqual(Object.keys(config.CANCELLATION_REASONS), ['precio', 'estilo', 'talla', 'tiempo', 'otro']);
  assert.equal(after.unanswered, before.unanswered + 2);
  assert.equal(after.reasons.find(r => r.key === 'talla').count, before.reasons.find(r => r.key === 'talla').count + 1);
  assert.equal(after.total, before.total + 3);
  assert.equal((await app.get('/api/admin/cancellation-reasons', a.token)).status, 403);
});
