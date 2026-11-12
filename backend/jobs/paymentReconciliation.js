// Job: payment reconciliation (HU-08, SCRUM-59). Every charge is reconciled when the gateway's
// signed webhook arrives (billing.processPaymentWebhook sets OK or MISMATCH). Charges still
// PENDING after STALE_AFTER_MS are looked up in the gateway with retrieveCharge and marked OK,
// MISMATCH (with an alert for the team) or MISSING. The job returns the ids it looked up and
// the ones that still need a person to follow them up.
const billing = require('../billing');
const { db } = require('../database');
const clock = require('../lib/clock');

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function run({ now = clock.now() } = {}) {
  const stalePendingIds = billing.reconcilePendingCharges(now, STALE_AFTER_MS);
  const payments = db.getPayments();
  const idsWith = status => payments.filter(p => p.reconciliation && p.reconciliation.status === status).map(p => p.id);
  return {
    ranAt: now.toISOString(),
    checked: payments.length,
    stalePendingIds,
    mismatchIds: idsWith('MISMATCH'),
    missingIds: idsWith('MISSING')
  };
}

module.exports = { name: 'paymentReconciliation', run, STALE_AFTER_MS };
