// F6: external services behind adapters with fakes. Checks the interface of each adapter,
// the fixed payment tokens (tok_ok, tok_declined, tok_flaky), the invoicing downtime switch,
// the mailer's outbox file plus in-memory list, and the manual shipment entry.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer } = require('./helpers/server');

let app;
let payments;
let invoicing;
let mailer;
let logistics;
let config;

before(async () => {
  app = await startServer();
  payments = require('../backend/adapters/payments');
  invoicing = require('../backend/adapters/invoicing');
  mailer = require('../backend/adapters/mailer');
  logistics = require('../backend/adapters/logistics');
  config = require('../backend/config');
});

after(async () => {
  await app.close();
});

beforeEach(() => {
  payments.resetFake();
  invoicing.setDowntime(null);
});

let n = 0;
const key = () => `test_${Date.now()}_${n++}`;
const charge = token => payments.charge({ token, amountCOP: 129900, idempotencyKey: key(), description: 'Prueba' });

test('cada adaptador expone su interfaz y el proveedor simulado la implementa', () => {
  for (const adapter of [payments, invoicing, mailer, logistics]) {
    assert.equal(adapter.name, 'simulated');
    assert.ok(Array.isArray(adapter.INTERFACE) && adapter.INTERFACE.length > 0);
    adapter.INTERFACE.forEach(method => assert.equal(typeof adapter[method], 'function', method));
  }
  assert.equal(typeof logistics.manualShipment, 'function');
  const { selectProvider } = require('../backend/adapters/select');
  assert.throws(() => selectProvider({ variable: 'TCB_NO_EXISTE_PROVIDER', providers: {}, methods: [] }), /desconocido/);
  assert.throws(() => selectProvider({ variable: 'TCB_NO_EXISTE_PROVIDER', providers: { simulated: {} }, methods: ['send'] }), /no implementa: send/);
});

test('las rutas viejas de los adaptadores ya no existen', () => {
  ['payments', 'mail', 'invoicing', 'shipping'].forEach(dir => {
    assert.equal(fs.existsSync(path.join(__dirname, '..', 'backend', dir)), false, `backend/${dir}`);
  });
});

test('tok_ok aprueba con comisión y tok_declined rechaza', () => {
  const ok = charge('tok_ok');
  assert.equal(ok.status, 'APPROVED');
  assert.equal(ok.feeCOP, Math.round(129900 * config.PAYMENT_FEE_RATE));
  const declined = charge('tok_declined');
  assert.equal(declined.status, 'DECLINED');
  assert.equal(declined.feeCOP, 0);
  assert.ok(declined.reason);
  assert.deepEqual(payments.describeToken('tok_ok'), { brand: 'Prueba', last4: '4242' });
  assert.equal(charge('tok_inventado').status, 'DECLINED');
});

test('tok_flaky falla los primeros N cobros (configurable) y luego aprueba', () => {
  assert.deepEqual([charge('tok_flaky'), charge('tok_flaky'), charge('tok_flaky')].map(c => c.status), ['DECLINED', 'DECLINED', 'APPROVED'], 'N = 2 por defecto');

  payments.setFlakyFailures(1);
  const idem = key();
  const first = payments.charge({ token: 'tok_flaky', amountCOP: 1000, idempotencyKey: idem, description: 'x' });
  assert.equal(first.status, 'DECLINED');
  const retry = payments.charge({ token: 'tok_flaky', amountCOP: 1000, idempotencyKey: idem, description: 'x' });
  assert.equal(retry.status, 'APPROVED', 'el fallo temporal no queda en la caché de idempotencia');
  assert.equal(payments.charge({ token: 'tok_flaky', amountCOP: 1000, idempotencyKey: idem, description: 'x' }).idempotentReplay, true);
});

// SCRUM-57: tokenize() vive en el SDK del navegador (frontend/js/simulatedGateway.js).
test('las tarjetas de prueba de tokenize() siguen funcionando', () => {
  const gateway = require('../frontend/js/simulatedGateway');
  const t = gateway.tokenize({ number: '4000 0000 0000 0002', expMonth: 12, expYear: 2030, cvc: '123', holder: 'Prueba' });
  assert.equal(charge(t.token).status, 'DECLINED');
  const ok = gateway.tokenize({ number: '4242 4242 4242 4242', expMonth: 12, expYear: 2030, cvc: '123', holder: 'Prueba' });
  assert.equal(charge(ok.token).status, 'APPROVED');
  assert.equal(ok.last4, '4242');
  assert.doesNotMatch(ok.token, /4242424242424242/, 'el token no lleva el número completo');
});

test('suscribirse con tok_declined da 402 y con tok_ok activa la suscripción', async () => {
  const email = `pay_${Date.now()}@example.test`;
  const reg = await app.post('/api/auth/register', {
    name: 'Cliente Pagos', email, password: 'clave-segura-1', birthDate: '2000-05-20', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  const token = reg.body.token;
  require('../backend/database').db.updateUser(reg.body.user.id, { emailVerified: true }); // SCRUM-58
  const fiscal = { docType: 'CC', docNumber: '1144123456', address: 'Calle 5 # 38-20', city: 'Cali' };
  const declined = await app.post('/api/subscription/subscribe', { plan: 'esencial', paymentToken: 'tok_declined', fiscal }, token);
  assert.equal(declined.status, 402);
  const ok = await app.post('/api/subscription/subscribe', { plan: 'esencial', paymentToken: 'tok_ok', fiscal }, token);
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.subscription.status, 'ACTIVE');
});

test('el interruptor de caída de facturación hace fallar issue() y se refleja en el panel', async () => {
  const invoice = { number: 'SETT-1', issuedAt: new Date().toISOString(), totalCOP: 129900, buyer: { docType: 'CC', docNumber: '1', address: 'x', city: 'Cali' } };
  assert.equal(invoicing.issue(invoice).status, 'ACCEPTED');
  invoicing.setDowntime(true);
  assert.equal(invoicing.isDown(), true);
  assert.throws(() => invoicing.issue(invoice), err => err.code === 'PROVIDER_UNAVAILABLE' && /SIMULADO/.test(err.message));
  const admin = await app.loginAs('ADMIN');
  assert.equal((await app.get('/api/admin/invoices', admin)).body.provider.failMode, true);
  invoicing.setDowntime(false);
  assert.equal(invoicing.issue(invoice).status, 'ACCEPTED');
  assert.equal((await app.get('/api/admin/invoices', admin)).body.provider.failMode, false);
});

test('el correo simulado va a la bandeja de salida (archivo y panel) y a la lista en memoria', async () => {
  mailer.clearMemory();
  const msg = mailer.send({ to: 'x@example.test', subject: 'Hola', body: 'Cuerpo', type: 'TEST' });
  assert.equal(msg.subject, '[SIMULADO] Hola');
  assert.deepEqual(mailer.sentInMemory().map(m => m.id), [msg.id]);
  const file = JSON.parse(fs.readFileSync(path.join(app.dataDir, 'outbox.json'), 'utf8'));
  assert.ok(file.some(m => m.id === msg.id), 'queda en DATA_DIR/outbox.json');
  const admin = await app.loginAs('ADMIN');
  const panel = await app.get('/api/admin/outbox', admin);
  assert.ok(panel.body.messages.some(m => m.id === msg.id));
  mailer.clearMemory();
  assert.equal(mailer.sentInMemory().length, 0);
});

test('modo manual de logística: valida transportadora y guía', () => {
  const shipment = logistics.manualShipment({ reference: 'box_1', carrier: 'Servientrega', trackingNumber: 'abc-123456' });
  assert.equal(shipment.trackingNumber, 'ABC-123456');
  assert.equal(shipment.manual, true);
  assert.equal(shipment.simulated, false);
  assert.throws(() => logistics.manualShipment({ carrier: '', trackingNumber: 'ABC123' }), err => err.status === 400 && /transportadora/.test(err.message));
  assert.throws(() => logistics.manualShipment({ carrier: 'Envia', trackingNumber: '1' }), err => err.status === 400);
});
