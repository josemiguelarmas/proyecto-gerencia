// HU-15 (SCRUM-95..99): electronic invoice after each approved charge with the fiscal data
// captured at subscription, retry queue when the provider is down, and the team alert (log
// line plus e-mail to the ops address from OPS_ALERT_EMAIL). Provider down, then recovered.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const { startServer } = require('./helpers/server');

let app;
let db;
let config;
let billing;
let invoicing;
let mailer;
let jobs;

before(async () => {
  app = await startServer();
  ({ db } = require('../backend/database'));
  config = require('../backend/config');
  billing = require('../backend/billing');
  invoicing = require('../backend/adapters/invoicing');
  mailer = require('../backend/adapters/mailer');
  jobs = require('../backend/jobs');
});

after(async () => {
  invoicing.setDowntime(null);
  await app.close();
});

beforeEach(() => {
  invoicing.setDowntime(null);
});

const FISCAL = { docType: 'NIT', docNumber: '900123456-7', address: 'Carrera 100 # 11-60', city: 'Cali' };
let seq = 0;

async function subscribedClient() {
  const email = `inv_${Date.now()}_${seq++}@example.test`;
  const reg = await app.post('/api/auth/register', {
    name: 'Cliente Factura', email, password: 'clave-segura-1', birthDate: '2000-05-20', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  db.updateUser(reg.body.user.id, { emailVerified: true });
  const res = await app.post('/api/subscription/subscribe', { plan: 'esencial', paymentToken: 'tok_ok', fiscal: FISCAL }, reg.body.token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { email, token: reg.body.token, userId: reg.body.user.id };
}

const mailsTo = (to, type) => mailer.sentInMemory().filter(m => m.to === to && m.type === type);

test('SCRUM-97: los datos fiscales de la suscripción llegan al payload de la factura', async () => {
  const c = await subscribedClient();
  const invoice = db.getInvoices(c.userId)[0];
  assert.equal(invoice.status, 'ISSUED');
  assert.deepEqual(
    [invoice.buyer.docType, invoice.buyer.docNumber, invoice.buyer.address, invoice.buyer.city, invoice.buyer.email],
    [FISCAL.docType, FISCAL.docNumber, FISCAL.address, FISCAL.city, c.email]
  );
  assert.equal(invoice.subtotalCOP + invoice.ivaCOP, invoice.totalCOP);
  assert.equal(mailsTo(c.email, 'INVOICE').length, 1, 'la factura se envía al suscriptor');
});

test('SCRUM-98/99: proveedor caído → cola de reintentos con alerta (log y correo a operaciones) → se recupera y emite', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  invoicing.setDowntime(true);
  const c = await subscribedClient();
  const invoice = db.getInvoices(c.userId)[0];
  assert.equal(invoice.status, 'PENDING_RETRY');
  assert.equal(invoice.attempts, 1);
  assert.ok(invoice.nextRetryAt);
  assert.equal(db.getSubscription(c.userId).status, 'ACTIVE', 'el cobro no depende de la factura');

  const alertMails = mailsTo(config.TEAM_ALERT_EMAIL, 'INVOICE_ALERT').filter(m => m.body.includes(invoice.number));
  assert.equal(alertMails.length, 1, 'correo a la dirección de operaciones');
  const logged = warn.mock.calls.map(call => call.arguments.join(' ')).filter(line => line.includes(invoice.number));
  assert.equal(logged.length, 1, 'una línea de alerta en el log');
  assert.match(logged[0], /ALERTA/);
  assert.doesNotMatch(logged[0], new RegExp(FISCAL.docNumber), 'el log no lleva datos personales');
  assert.ok(db.getAlerts().some(a => a.refId === invoice.id && !a.resolvedAt));

  // Still down at the first retry: one more attempt, no duplicate alert mail.
  jobs.jobs.invoiceRetry.run({ now: new Date(new Date(invoice.nextRetryAt).getTime() + 1000) });
  assert.equal(invoice.status, 'PENDING_RETRY');
  assert.equal(invoice.attempts, 2);
  assert.equal(mailsTo(config.TEAM_ALERT_EMAIL, 'INVOICE_ALERT').filter(m => m.body.includes(invoice.number)).length, 1);

  invoicing.setDowntime(false);
  const recovered = jobs.jobs.invoiceRetry.run({ now: new Date(new Date(invoice.nextRetryAt).getTime() + 1000) });
  assert.equal(recovered.issued, 1);
  assert.equal(invoice.status, 'ISSUED');
  assert.equal(invoice.cufe.length, 96);
  assert.ok(db.getAlerts().find(a => a.refId === invoice.id).resolvedAt, 'la alerta se cierra');
  assert.equal(mailsTo(c.email, 'INVOICE').length, 1, 'la factura llega al suscriptor al recuperarse');
});

test('SCRUM-98: agotados los reintentos la factura queda FAILED con la alerta abierta', async t => {
  t.mock.method(console, 'warn', () => {});
  invoicing.setDowntime(true);
  const c = await subscribedClient();
  const invoice = db.getInvoices(c.userId)[0];
  for (let i = 0; i < config.INVOICE_RETRY_MINUTES.length; i++) {
    billing.runInvoiceRetries(new Date(new Date(invoice.nextRetryAt).getTime() + 1000));
  }
  assert.equal(invoice.status, 'FAILED');
  assert.equal(invoice.attempts, config.INVOICE_RETRY_MINUTES.length + 1);
  assert.ok(db.getAlerts().some(a => a.refId === invoice.id && !a.resolvedAt));
});

test('SCRUM-98: la dirección de operaciones se configura con OPS_ALERT_EMAIL', () => {
  const run = env => spawnSync(process.execPath, ['-e', "process.stdout.write(require('./backend/config').TEAM_ALERT_EMAIL)"], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, NODE_ENV: 'test', ...env }, encoding: 'utf8'
  });
  assert.equal(run({ OPS_ALERT_EMAIL: 'alertas@example.test' }).stdout, 'alertas@example.test');
  assert.equal(run({ OPS_ALERT_EMAIL: '' }).stdout, 'operaciones@theclothesbox.co');
});
