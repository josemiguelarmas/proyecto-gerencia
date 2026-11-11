// Job: monthly box batch (HU-06). Proposes the month's box (status PROPOSED, for the stylist
// queue) for every active, paid-up subscriber with a finished profile. It is idempotent per
// month: subscribers with an open box or with this month's box already are skipped, as are
// paused, past-due and synthetic (seedDemo) subscribers. Admin trigger:
// POST /api/admin/boxes/generate-batch. The scheduler runs it on BOX_BATCH_DAY.
const { db } = require('../database');
const { OPEN_BOX_STATUSES, createCuratedBox } = require('../lib/boxes');
const clock = require('../lib/clock');

function skipReason(user, sub, profile, boxes, monthKey) {
  // HU-17: los suscriptores sintéticos de scripts/seed-demo.js no reciben cajas reales.
  if (user.seedDemo) return 'Dato de prueba';
  // HU-08/HU-12: solo suscripciones pagadas y al día; en pausa o en mora no reciben caja.
  if (sub.status !== 'ACTIVE' || !profile || !profile.done) {
    return sub.status === 'PAUSED' ? 'Suscripción en pausa' : sub.status === 'PAST_DUE' ? 'Pago pendiente' : 'Sin suscripción activa';
  }
  if (sub.dunning) return 'Cobro en reintento';
  const latest = boxes[0];
  if (latest && OPEN_BOX_STATUSES.includes(latest.status)) return `Tiene una caja en curso (${latest.status})`;
  if (latest && (latest.createdAt || '').slice(0, 7) === monthKey) return 'Ya tiene la caja de este mes';
  return null;
}

function run({ now = clock.now() } = {}) {
  const monthKey = now.toISOString().slice(0, 7);
  const generated = [];
  const skipped = [];
  db.data.users.filter(u => (u.role || 'CLIENT') === 'CLIENT').forEach(user => {
    const sub = db.getSubscription(user.id);
    const profile = db.getProfile(user.id);
    const boxes = db.getUserBoxes(user.id);
    const reason = skipReason(user, sub, profile, boxes, monthKey);
    if (reason) return skipped.push({ userId: user.id, reason });
    const latest = boxes[0];
    const { box, curated } = createCuratedBox(user.id, profile, {
      cycle: (latest ? latest.cycle : 0) + 1,
      address: (latest && latest.address) || profile.address || 'Cali, Colombia',
      receivedIds: boxes.flatMap(b => b.itemIds || [])
    });
    generated.push({ userId: user.id, boxId: box.id, withinCap: curated.withinCap, complete: curated.missingSlots.length === 0 });
  });
  const pct = fn => (generated.length ? Math.round((generated.filter(fn).length / generated.length) * 100) : null);
  return {
    month: monthKey,
    generatedCount: generated.length,
    skippedCount: skipped.length,
    withinCapPct: pct(g => g.withinCap),
    completePct: pct(g => g.complete),
    generated,
    skipped
  };
}

module.exports = { name: 'boxBatch', run };
