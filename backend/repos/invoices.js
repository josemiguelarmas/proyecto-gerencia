// Invoices and alerts repository (HU-15): electronic invoices with their own consecutive
// number per prefix, and the alerts raised for the team when invoicing keeps failing.
const store = require('./store');
const { newId } = require('../lib/crypto');

// HU-15: facturas con consecutivo propio y alertas para el equipo
function addInvoice(data) {
  const consecutive = store.data.invoices.reduce((max, i) => Math.max(max, i.consecutive || 0), 0) + 1;
  const invoice = {
    id: newId('inv'),
    consecutive,
    createdAt: new Date().toISOString(),
    ...data,
    number: `${data.prefix}-${consecutive}`
  };
  store.data.invoices.push(invoice);
  store.save();
  return invoice;
}

function getInvoices(userId) {
  const list = userId ? store.data.invoices.filter(i => i.userId === userId) : store.data.invoices;
  return [...list].sort((a, b) => b.consecutive - a.consecutive);
}

function addAlert(data) {
  const alert = { id: newId('alr'), createdAt: new Date().toISOString(), resolvedAt: null, ...data };
  store.data.alerts.push(alert);
  store.save();
  return alert;
}

function getAlerts() {
  return [...store.data.alerts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { addInvoice, getInvoices, addAlert, getAlerts };
