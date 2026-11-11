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
