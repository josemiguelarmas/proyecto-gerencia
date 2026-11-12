// Job: e-invoice retries (HU-15). Wraps billing.runInvoiceRetries, which re-sends invoices
// left in PENDING_RETRY when the invoicing provider was down and marks them FAILED (with an
// admin alert) after the last attempt. Admin trigger: POST /api/admin/jobs/invoice-retries.
const billing = require('../billing');
const clock = require('../lib/clock');

function run({ now = clock.now() } = {}) {
  return billing.runInvoiceRetries(now);
}

module.exports = { name: 'invoiceRetry', run };
