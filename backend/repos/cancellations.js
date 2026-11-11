// Cancellations repository (HU-13): one record per cancellation with the plan, the optional
// exit survey reason and comment, and the aggregated reason counts used by the KPIs.
const store = require('./store');
const { newId } = require('../lib/crypto');

function addCancellation(userId, { plan, reason, comment }) {
  const cancellation = {
    id: newId('cnl'),
    userId,
    plan,
    reason: reason || null,
    comment: comment || '',
    createdAt: new Date().toISOString()
  };
  store.data.cancellations.push(cancellation);
  store.save();
  return cancellation;
}

function getCancellationReasonCounts(reasonKeys) {
  const counts = Object.fromEntries(reasonKeys.map(k => [k, 0]));
  let unanswered = 0;
  store.data.cancellations.forEach(c => {
    if (c.reason && counts[c.reason] !== undefined) counts[c.reason]++;
    else unanswered++;
  });
  return { total: store.data.cancellations.length, counts, unanswered };
}

module.exports = { addCancellation, getCancellationReasonCounts };
