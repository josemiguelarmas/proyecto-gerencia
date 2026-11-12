// Job: monthly charge and payment retries (HU-08). Wraps billing.runRecurringBilling, which
// charges the subscriptions that are due once per period and retries failed charges on the
// PAYMENT_RETRY_DAYS schedule (then PAST_DUE). It also resumes due pauses first, so a
// resumed plan is charged in the same run. Admin trigger: POST /api/admin/jobs/recurring-billing.
const billing = require('../billing');
const clock = require('../lib/clock');

function run({ now = clock.now() } = {}) {
  return billing.runRecurringBilling(now);
}

module.exports = { name: 'recurringBilling', run };
