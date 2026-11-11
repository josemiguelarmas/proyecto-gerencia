// Job: payment reconciliation check (HU-08). Every charge is reconciled when the gateway's
// signed webhook arrives (billing.processPaymentWebhook sets OK or MISMATCH). This job lists
// the payments still PENDING after STALE_AFTER_MS and those in MISMATCH, so the team can
// follow them up. Asking a real gateway for the missing events is stream D1's work.
const { db } = require('../database');
const clock = require('../lib/clock');

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function run({ now = clock.now() } = {}) {
  const payments = db.getPayments();
  const status = p => (p.reconciliation && p.reconciliation.status) || 'PENDING';
  const stale = payments.filter(p => status(p) === 'PENDING' && now - new Date(p.createdAt) >= STALE_AFTER_MS);
  const mismatched = payments.filter(p => status(p) === 'MISMATCH');
  return {
    ranAt: now.toISOString(),
    checked: payments.length,
    stalePendingIds: stale.map(p => p.id),
    mismatchIds: mismatched.map(p => p.id)
  };
}

module.exports = { name: 'paymentReconciliation', run, STALE_AFTER_MS };
