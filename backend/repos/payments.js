// Payments repository (HU-08): every charge attempt with its gateway fee, card brand and last
// four digits only, and its reconciliation status. Lists are returned newest first.
const store = require('./store');
const { newId } = require('../lib/crypto');

// HU-08: pagos con comisión de pasarela y estado de conciliación
function addPayment(data) {
  const payment = {
    id: newId('pay'),
    reconciliation: { status: 'PENDING', at: null },
    invoiceId: null,
    createdAt: new Date().toISOString(),
    ...data
  };
  store.data.payments.push(payment);
  store.save();
  return payment;
}

function findPayment(predicate) {
  return store.data.payments.find(predicate) || null;
}

function getPayments(userId) {
  const list = userId ? store.data.payments.filter(p => p.userId === userId) : store.data.payments;
  return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { addPayment, findPayment, getPayments };
