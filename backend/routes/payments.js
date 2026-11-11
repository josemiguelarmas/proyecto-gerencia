// Payments and invoicing routes: the signed gateway webhook and card tokenization (HU-08),
// the subscriber's fiscal data for electronic invoices (HU-15), and the admin views of
// payments, gateway fees and reconciliation, invoices with their retry queue and alerts, plus
// the on-demand recurring billing and invoice retry jobs. Card data is never stored here.
const { db } = require('../database');
const billing = require('../billing');
const payments = require('../adapters/payments');
const invoicing = require('../adapters/invoicing');
const { sendJson, readRawBody, parseJsonBody, parseNow } = require('../lib/http');

// HU-08: webhook de la pasarela, firmado con HMAC en la cabecera X-Signature
async function paymentWebhook({ req, res }) {
  const rawBody = await readRawBody(req);
  const result = billing.processPaymentWebhook(rawBody, req.headers['x-signature']);
  return sendJson(res, result.status, result.body);
}

// HU-08: tokenización simulada. En una pasarela real la tarjeta va del navegador a la
// pasarela; aquí el número y el CVV solo se validan y nunca se guardan ni se registran.
async function tokenize({ req, res }) {
  const { card } = await parseJsonBody(req);
  const result = payments.tokenize(card || {});
  return sendJson(res, 200, result);
}

// HU-15: datos fiscales del suscriptor
async function saveFiscal({ req, res, authUser }) {
  const fiscal = await parseJsonBody(req);
  const fiscalError = billing.validateFiscal(fiscal);
  if (fiscalError) return sendJson(res, 400, { error: fiscalError });
  const user = db.updateUser(authUser.id, { fiscal: billing.cleanFiscal(fiscal) });
  return sendJson(res, 200, { success: true, message: 'Datos de facturación guardados.', fiscal: user.fiscal });
}

// HU-08: pagos, comisión de la pasarela, conciliación y suscripciones
function paymentsReport({ res }) {
  const users = Object.fromEntries(db.data.users.map(u => [u.id, u]));
  const withUser = item => ({ ...item, userName: users[item.userId]?.name, userEmail: users[item.userId]?.email });
  return sendJson(res, 200, {
    report: billing.paymentsReport(),
    payments: db.getPayments().map(withUser),
    subscriptions: db.getAllSubscriptions().map(s => withUser(billing.publicSubscription(s)))
  });
}

async function runRecurringBilling({ req, res }) {
  const { now } = await parseJsonBody(req);
  return sendJson(res, 200, { success: true, ...billing.runRecurringBilling(parseNow(now)) });
}

// HU-15: facturas, cola de reintentos y alertas para el equipo
function invoicesReport({ res }) {
  return sendJson(res, 200, {
    invoices: db.getInvoices(),
    alerts: db.getAlerts(),
    openAlerts: db.getAlerts().filter(a => !a.resolvedAt).length,
    provider: { name: 'simulated', environment: 'HABILITACION', failMode: invoicing.isDown() }
  });
}

async function runInvoiceRetries({ req, res }) {
  const { now } = await parseJsonBody(req);
  return sendJson(res, 200, { success: true, ...billing.runInvoiceRetries(parseNow(now)) });
}

module.exports = [
  { method: 'POST', path: '/api/webhooks/payments', public: true, handler: paymentWebhook },
  { method: 'POST', path: '/api/payments/tokenize', handler: tokenize },
  { method: 'PUT', path: '/api/profile/fiscal', handler: saveFiscal },
  { method: 'GET', path: '/api/admin/payments', handler: paymentsReport },
  { method: 'POST', path: '/api/admin/jobs/recurring-billing', handler: runRecurringBilling },
  { method: 'GET', path: '/api/admin/invoices', handler: invoicesReport },
  { method: 'POST', path: '/api/admin/jobs/invoice-retries', handler: runInvoiceRetries }
];
