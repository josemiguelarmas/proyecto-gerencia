// Job: feedback ingestion (HU-11). Wraps learning.ingestFeedback, which applies the ratings
// and stylist corrections not learned yet to each profile's weights. It is idempotent: every
// processed rating and correction is marked learnedAt. Admin trigger:
// POST /api/admin/jobs/ingest-feedback.
const learning = require('../learning');
const clock = require('../lib/clock');

function run({ now = clock.now() } = {}) {
  return learning.ingestFeedback(now);
}

module.exports = { name: 'feedback', run };
