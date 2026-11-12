// Job: KPI snapshot (HU-17, SCRUM-107). Materializes monthly KPIs into kpiSnapshots
// collection (the JSON-store equivalent of materialized views).
const { db } = require('../database');
const config = require('../config');
const kpis = require('../kpis');
const clock = require('../lib/clock');
const { newId } = require('../lib/crypto');

function computeAndSave({ now = clock.now(), month, plan = 'all', excludeDemo = false } = {}) {
  const m = month || kpis.monthKey(now);
  const churnThreshold = db.getSetting('churnThreshold', config.CHURN_THRESHOLD_DEFAULT);
  const ratingThreshold = db.getSetting('ratingThreshold', config.RATING_THRESHOLD_DEFAULT);
  const returnsThreshold = db.getSetting('returnsThreshold', config.RETURNS_THRESHOLD_DEFAULT);

  const calculated = kpis.computeKpis(db.data, {
    month: m,
    plan,
    churnThreshold,
    ratingThreshold,
    returnsThreshold,
    excludeDemo,
    now
  });

  db.data.kpiSnapshots = db.data.kpiSnapshots || [];
  let snapshot = db.data.kpiSnapshots.find(s => s.month === m && s.plan === plan && Boolean(s.excludeDemo) === Boolean(excludeDemo));
  if (!snapshot) {
    snapshot = {
      id: newId('snap'),
      month: m,
      plan,
      excludeDemo: Boolean(excludeDemo)
    };
    db.data.kpiSnapshots.push(snapshot);
  }

  snapshot.kpis = calculated;
  snapshot.ranAt = now.toISOString();
  db.save();

  return snapshot;
}

function run({ now = clock.now(), month, plan = 'all', plans = null, excludeDemo = false } = {}) {
  const m = month || kpis.monthKey(now);
  const targetPlans = plans || (plan === 'all' ? ['all', 'esencial', 'estilo'] : [plan]);
  const snapshots = targetPlans.map(p => computeAndSave({ now, month: m, plan: p, excludeDemo }));
  return {
    ranAt: now.toISOString(),
    month: m,
    plan,
    snapshots,
    kpis: snapshots.find(s => s.plan === plan)?.kpis || snapshots[0]?.kpis
  };
}

module.exports = { name: 'kpiSnapshot', run, computeAndSave };
