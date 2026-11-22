// Payments and invoicing routes: the signed gateway webhook (HU-08; cards are tokenized in the browser),
// the subscriber's fiscal data for electronic invoices (HU-15), and the admin views of
// payments, gateway fees and reconciliation, invoices with their retry queue and alerts, plus
// the on-demand recurring billing and invoice retry jobs. Card data is never stored here.
const { db } = require('../database');
const config = require('../config');
const billing = require('../billing');
const invoicing = require('../adapters/invoicing');
const { sendJson, readRawBody, parseJsonBody, parseNow } = require('../lib/http');

// HU-08: webhook de la pasarela, firmado con HMAC en la cabecera X-Signature
async function paymentWebhook({ req, res }) {
  const rawBody = await readRawBody(req);
  const result = billing.processPaymentWebhook(rawBody, req.headers['x-signature']);
  return sendJson(res, result.status, result.body);
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
    alertEmail: config.TEAM_ALERT_EMAIL,
    provider: { name: 'simulated', environment: 'HABILITACION', failMode: invoicing.isDown() }
  });
}

async function runInvoiceRetries({ req, res }) {
  const { now } = await parseJsonBody(req);
  return sendJson(res, 200, { success: true, ...billing.runInvoiceRetries(parseNow(now)) });
}

// HU-15 (SCRUM-99): Visualización y descarga de factura electrónica (formato imprimible / PDF)
function getInvoicePdf({ res, match, authUser }) {
  const invoiceId = match[1];
  const invoice = db.getInvoices().find(i => i.id === invoiceId);
  if (!invoice) return sendJson(res, 404, { error: 'Factura no encontrada.' });
  if (authUser.role !== 'ADMIN' && invoice.userId !== authUser.id) {
    return sendJson(res, 403, { error: 'Acceso no autorizado a esta factura.' });
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Factura Electrónica ${invoice.number}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 780px; margin: 30px auto; padding: 24px; border: 1px solid #cbd5e1; border-radius: 8px; color: #1e293b; line-height: 1.5; }
    .badge { display: inline-block; padding: 4px 10px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-weight: bold; font-size: 11px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
    .meta { font-size: 13px; color: #475569; }
    .cufe { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; font-family: monospace; font-size: 11px; word-break: break-all; margin: 20px 0; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    th { background: #f1f5f9; font-weight: 600; }
    .total-row { font-weight: bold; font-size: 15px; }
    .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0 0 4px 0;font-size:22px;color:#0f172a;">The Clothes Box S.A.S.</h1>
      <div class="meta">NIT: 901.876.543-2 · Cali, Colombia<br>Régimen Común · Responsable de IVA</div>
    </div>
    <div style="text-align:right">
      <span class="badge">[SIMULADO - FACTURA ELECTRÓNICA DE PRUEBA]</span>
      <h2 style="margin:8px 0 0 0;font-size:18px;color:#0f172a;">Factura ${invoice.number}</h2>
      <div class="meta">Fecha: ${new Date(invoice.issuedAt || invoice.createdAt).toLocaleString('es-CO')}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
    <div>
      <strong style="font-size:13px;text-transform:uppercase;color:#64748b;">Adquirente</strong><br>
      <span class="meta">
        ${invoice.buyer?.name || 'Suscriptor The Clothes Box'}<br>
        ${invoice.buyer?.docType || 'CC'}: ${invoice.buyer?.docNumber || 'N/A'}<br>
        ${invoice.buyer?.address || ''} · ${invoice.buyer?.city || 'Cali'}<br>
        ${invoice.buyer?.email || ''}
      </span>
    </div>
    <div>
      <strong style="font-size:13px;text-transform:uppercase;color:#64748b;">Información de Pago</strong><br>
      <span class="meta">
        Medio de Pago: Tarjeta terminada en ${invoice.payment?.cardLast4 || '****'}<br>
        Referencia Pago: ${invoice.paymentId || invoice.id}<br>
        Estado DIAN: <strong>${invoice.status}</strong>
      </span>
    </div>
  </div>

  <div class="cufe">
    <strong>CUFE (Código Único de Factura Electrónica):</strong><br>
    ${invoice.cufe || 'CUFE_PENDIENTE_DE_EMISION'}
  </div>

  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th style="text-align:right">Cant.</th>
        <th style="text-align:right">Subtotal</th>
        <th style="text-align:right">IVA (19%)</th>
        <th style="text-align:right">Total COP</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Suscripción Mensual The Clothes Box - Plan ${invoice.plan || 'Esencial'}</td>
        <td style="text-align:right">1</td>
        <td style="text-align:right">$${(invoice.subtotalCOP || Math.round((invoice.totalCOP || 129900) / 1.19)).toLocaleString('es-CO')}</td>
        <td style="text-align:right">$${(invoice.ivaCOP || Math.round((invoice.totalCOP || 129900) - ((invoice.totalCOP || 129900) / 1.19))).toLocaleString('es-CO')}</td>
        <td style="text-align:right">$${(invoice.totalCOP || 129900).toLocaleString('es-CO')}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="4" style="text-align:right">Total Facturado:</td>
        <td style="text-align:right">$${(invoice.totalCOP || 129900).toLocaleString('es-CO')}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    Documento emitido según Resolución DIAN en ambiente de pruebas de habilitación.<br>
    The Clothes Box · Suscripción personalizada de moda colombiana.
  </div>
</body>
</html>`;

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Disposition': `inline; filename="factura-${invoice.number}.html"`
  });
  return res.end(html);
}

module.exports = [
  { method: 'POST', path: '/api/webhooks/payments', public: true, handler: paymentWebhook },
  { method: 'PUT', path: '/api/profile/fiscal', handler: saveFiscal },
  { method: 'GET', path: '/api/admin/payments', handler: paymentsReport },
  { method: 'POST', path: '/api/admin/jobs/recurring-billing', handler: runRecurringBilling },
  { method: 'GET', path: '/api/admin/invoices', handler: invoicesReport },
  { method: 'POST', path: '/api/admin/jobs/invoice-retries', handler: runInvoiceRetries },
  { method: 'GET', path: /^\/api\/invoices\/([^/]+)\/pdf$/, handler: getInvoicePdf },
  { method: 'GET', path: /^\/api\/invoices\/([^/]+)$/, handler: getInvoicePdf }
];
