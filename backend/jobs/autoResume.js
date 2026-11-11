// Job: subscription auto-resume (HU-12). Reactivates paused subscriptions whose pausedUntil
// date has passed and notifies the subscriber. recurringBilling also does this before
// charging; this job lets the resume happen even when no charge is due in that run.
const billing = require('../billing');
const { db } = require('../database');
const clock = require('../lib/clock');

function run({ now = clock.now() } = {}) {
  const results = billing.resumeDuePauses(now);
  if (results.length > 0) db.save();
  return { ranAt: now.toISOString(), resumed: results.length, subscriptionIds: results.map(r => r.subscriptionId) };
}

module.exports = { name: 'autoResume', run };
