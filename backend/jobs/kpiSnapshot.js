// Job: KPI snapshot (HU-17). Computes the month's KPIs with metrics.computeKpis and the
// churn threshold saved in settings, and returns them. Storing the snapshots over time (and
// showing their history) is stream E2's work; until then this job only computes.
const { db } = require('../database');
const config = require('../config');
const metrics = require('../metrics');
const clock = require('../lib/clock');

function run({ now = clock.now(), plan = 'all' } = {}) {
  const month = metrics.monthKey(now);
  const threshold = db.getSetting('churnThreshold', config.CHURN_THRESHOLD_DEFAULT);
  return { ranAt: now.toISOString(), month, plan, kpis: metrics.computeKpis(db.data, { month, plan, threshold, now }) };
}

module.exports = { name: 'kpiSnapshot', run };
