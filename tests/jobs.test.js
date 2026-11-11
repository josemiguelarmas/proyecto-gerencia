// F7: scheduled jobs. Every job in backend/jobs/ exports run({ now }) and returns a summary;
// these tests call each one with an injected date. The scheduler does not start under
// NODE_ENV=test, and tick() respects the hourly, daily and monthly cadences.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');

let app;
let jobs;
let db;
let config;

before(async () => {
  app = await startServer();
  jobs = require('../backend/jobs');
  ({ db } = require('../backend/database'));
  config = require('../backend/config');
});

after(async () => {
  await app.close();
});

const at = iso => new Date(iso);

test('cada job exporta run({ now }) y el planificador no arranca con NODE_ENV=test', () => {
  const names = ['reviewReminder', 'recurringBilling', 'autoResume', 'invoiceRetry', 'feedback', 'boxBatch', 'kpiSnapshot', 'paymentReconciliation'];
  assert.deepEqual(Object.keys(jobs.jobs).sort(), [...names].sort());
  names.forEach(name => assert.equal(typeof jobs.jobs[name].run, 'function', name));
  assert.equal(jobs.startJobs(), false);
});

test('reviewReminder.run respeta los días desde la entrega según now', () => {
  const box = db.data.boxes.find(b => b.id === 'box_003');
  const delivered = new Date(box.deliveredAt).getTime();
  const early = jobs.jobs.reviewReminder.run({ now: new Date(delivered + 1 * 86400000) });
  assert.ok(!early.boxIds.includes('box_003'));
  const due = jobs.jobs.reviewReminder.run({ now: new Date(delivered + config.REVIEW_REMINDER_DAYS * 86400000) });
  assert.deepEqual(due.boxIds, ['box_003']);
  assert.equal(jobs.jobs.reviewReminder.run({ now: new Date(delivered + 10 * 86400000) }).sent, 0, 'una sola vez');
});

test('autoResume.run reanuda solo las pausas vencidas en la fecha dada', () => {
  const sub = db.data.subscriptions.find(s => s.userId === 'usr_demo_01');
  const original = { status: sub.status, pausedUntil: sub.pausedUntil };
  Object.assign(sub, { status: 'PAUSED', pausedUntil: '2026-12-01T00:00:00.000Z' });
  try {
    assert.equal(jobs.jobs.autoResume.run({ now: at('2026-11-30T12:00:00.000Z') }).resumed, 0);
    assert.equal(sub.status, 'PAUSED');
    const result = jobs.jobs.autoResume.run({ now: at('2026-12-01T08:00:00.000Z') });
    assert.deepEqual(result.subscriptionIds, [sub.id]);
    assert.equal(sub.status, 'ACTIVE');
    assert.equal(sub.resumedAt, '2026-12-01T08:00:00.000Z');
  } finally {
    Object.assign(sub, original);
  }
});

test('recurringBilling.run e invoiceRetry.run usan el now inyectado', () => {
  const sub = db.data.subscriptions.find(s => s.userId === 'usr_demo_01');
  const before = new Date(new Date(sub.nextChargeAt).getTime() - 86400000);
  const billing = jobs.jobs.recurringBilling.run({ now: before });
  assert.equal(billing.ranAt, before.toISOString());
  assert.equal(billing.approved, 0, 'antes de la fecha de cobro no cobra');
  const retries = jobs.jobs.invoiceRetry.run({ now: before });
  assert.deepEqual(Object.keys(retries).sort(), ['failed', 'issued', 'retried', 'stillPending']);
});

test('feedback.run es idempotente y marca la fecha inyectada', () => {
  const now = at('2026-11-15T10:00:00.000Z');
  const first = jobs.jobs.feedback.run({ now });
  assert.equal(first.ranAt, now.toISOString());
  assert.ok(db.data.ratings.every(r => r.learnedAt));
  const second = jobs.jobs.feedback.run({ now });
  assert.equal(second.ratingsProcessed, 0);
  assert.equal(second.correctionsProcessed, 0);
});

test('kpiSnapshot.run calcula los KPI del mes de now', () => {
  const snap = jobs.jobs.kpiSnapshot.run({ now: at('2026-10-15T12:00:00.000Z') });
  assert.equal(snap.month, '2026-10');
  assert.equal(snap.plan, 'all');
  assert.ok(snap.kpis && typeof snap.kpis === 'object');
});

test('paymentReconciliation.run lista los pagos sin conciliar después de 24 h', async () => {
  const reg = await app.post('/api/auth/register', {
    name: 'Cliente Jobs', email: `jobs_${Date.now()}@example.test`, password: 'clave-segura-1',
    birthDate: '2000-05-20', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  const fiscal = { docType: 'CC', docNumber: '1144123456', address: 'Calle 5 # 38-20', city: 'Cali' };
  db.updateUser(reg.body.user.id, { emailVerified: true }); // SCRUM-58: subscribing needs a verified e-mail
  assert.equal((await app.post('/api/subscription/subscribe', { plan: 'esencial', paymentToken: 'tok_ok', fiscal }, reg.body.token)).status, 201);
  const payment = db.getPayments().find(p => p.userId === reg.body.user.id);
  assert.equal(payment.reconciliation.status, 'OK', 'el webhook simulado concilia en el acto');

  const createdMs = new Date(payment.createdAt).getTime();
  assert.ok(!jobs.jobs.paymentReconciliation.run({ now: new Date(createdMs + 25 * 3600000) }).stalePendingIds.includes(payment.id));
  payment.reconciliation = { status: 'PENDING', at: null };
  assert.ok(!jobs.jobs.paymentReconciliation.run({ now: new Date(createdMs + 3600000) }).stalePendingIds.includes(payment.id));
  const late = jobs.jobs.paymentReconciliation.run({ now: new Date(createdMs + 25 * 3600000) });
  assert.ok(late.stalePendingIds.includes(payment.id));
  payment.reconciliation = { status: 'MISMATCH', at: null };
  assert.ok(jobs.jobs.paymentReconciliation.run({ now: new Date(createdMs) }).mismatchIds.includes(payment.id));
  payment.reconciliation = { status: 'OK', at: null };
});

test('boxBatch.run es idempotente dentro del mes de now', () => {
  const now = at('2026-11-20T15:00:00.000Z');
  const first = jobs.jobs.boxBatch.run({ now });
  assert.equal(first.month, '2026-11');
  assert.equal(first.generatedCount + first.skippedCount, db.data.users.filter(u => u.role === 'CLIENT').length);
  const second = jobs.jobs.boxBatch.run({ now });
  assert.equal(second.generatedCount, 0, 'la segunda corrida del mes no arma cajas nuevas');
});

test('tick(): los jobs horarios corren siempre, los diarios una vez por día y el lote solo el BOX_BATCH_DAY', () => {
  const offDay = new Date(2026, 10, config.BOX_BATCH_DAY === 20 ? 21 : 20, 9, 0, 0);
  const first = jobs.tick(offDay);
  ['reviewReminder', 'autoResume', 'recurringBilling', 'invoiceRetry', 'feedback', 'kpiSnapshot', 'paymentReconciliation'].forEach(name => assert.ok(name in first, name));
  assert.ok(!('boxBatch' in first), 'fuera del día del lote');

  const later = new Date(offDay.getTime() + 3600000);
  const second = jobs.tick(later);
  assert.ok('reviewReminder' in second);
  assert.ok(!('kpiSnapshot' in second), 'los diarios no se repiten el mismo día');

  const batchDay = new Date(2026, 11, config.BOX_BATCH_DAY, 6, 0, 0);
  assert.ok('boxBatch' in jobs.tick(batchDay));
});

test('el endpoint admin del lote sigue funcionando sobre el job', async () => {
  const admin = await app.loginAs('ADMIN');
  const res = await app.post('/api/admin/boxes/generate-batch', {}, admin);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.match(res.body.month, /^\d{4}-\d{2}$/);
  assert.ok(Array.isArray(res.body.generated) && Array.isArray(res.body.skipped));
});
