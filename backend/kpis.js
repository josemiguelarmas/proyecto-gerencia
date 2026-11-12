// KPI calculations and metrics engine (HU-17, SCRUM-106).
// Pure functional implementations over repository collections for easy fixture testing.
const config = require('./config');

function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Altas y bajas de una suscripción. Las suscripciones anteriores a HU-17 no tienen historial y
// se reconstruye con startedAt y cancelledAt.
function subscriptionEvents(sub) {
  if (Array.isArray(sub.history) && sub.history.length) return sub.history;
  const events = [];
  if (sub.startedAt) events.push({ type: 'START', plan: sub.plan, at: sub.startedAt });
  if (sub.cancelledAt) events.push({ type: 'CANCEL', plan: sub.plan, at: sub.cancelledAt });
  return events;
}

// Suscrito en la fecha: su último evento anterior a esa fecha es un alta.
function activeAt(events, date) {
  const before = events.filter(e => new Date(e.at) < date).sort((a, b) => new Date(a.at) - new Date(b.at));
  const last = before[before.length - 1];
  return last && last.type === 'START' ? last : null;
}

function computeKpis(data, {
  month,
  plan = 'all',
  threshold = config.CHURN_THRESHOLD_DEFAULT,
  churnThreshold = threshold,
  ratingThreshold = config.RATING_THRESHOLD_DEFAULT,
  returnsThreshold = config.RETURNS_THRESHOLD_DEFAULT,
  excludeDemo = false,
  now = new Date()
} = {}) {
  const { start, end } = monthRange(month);
  const cut = end < now ? end : now;
  const planOk = p => plan === 'all' || p === plan;
  const inMonth = iso => iso && new Date(iso) >= start && new Date(iso) < end;
  const demoFilter = item => !excludeDemo || (!item.isDemo && !item.seedDemo);

  const rawSubs = (data.subscriptions || []).filter(demoFilter);
  const subs = rawSubs.map(s => ({ sub: s, events: subscriptionEvents(s) }));
  const activeAtStart = subs.filter(({ events }) => { const e = activeAt(events, start); return e && planOk(e.plan); }).length;
  const activeNow = subs.filter(({ events }) => { const e = activeAt(events, new Date(cut.getTime() + 1)); return e && planOk(e.plan); }).length;
  const newSubs = subs.reduce((acc, { events }) => acc + events.filter(e => e.type === 'START' && inMonth(e.at) && planOk(e.plan)).length, 0);
  const cancelled = subs.reduce((acc, { events }) => acc + events.filter(e => e.type === 'CANCEL' && inMonth(e.at) && planOk(e.plan)).length, 0);
  const churnPct = activeAtStart > 0 ? Math.round((cancelled / activeAtStart) * 1000) / 10 : null;

  const rawBoxes = (data.boxes || []).filter(demoFilter);
  const boxPlan = Object.fromEntries(rawBoxes.map(b => [b.id, b.plan]));
  const rawRatings = (data.ratings || []).filter(demoFilter);
  const ratings = rawRatings.filter(r => inMonth(r.createdAt) && planOk(boxPlan[r.boxId]) && typeof r.score === 'number');
  const delivered = rawBoxes.filter(b => inMonth(b.deliveredAt) && planOk(b.plan));
  const deliveredItems = delivered.reduce((acc, b) => acc + (b.itemIds || []).length, 0);
  const rawReturns = (data.returns || []).filter(demoFilter);
  const returns = rawReturns.filter(r => inMonth(r.createdAt) && planOk(boxPlan[r.boxId]));

  const rawCancellations = (data.cancellations || []).filter(demoFilter);
  const cancellations = rawCancellations.filter(c => inMonth(c.createdAt) && planOk(c.plan));
  const reasonKeys = Object.keys(config.CANCELLATION_REASONS);
  const reasons = reasonKeys.map(key => ({
    key,
    label: config.CANCELLATION_REASONS[key],
    count: cancellations.filter(c => c.reason === key).length
  }));

  const avgRating = ratings.length
    ? Math.round((ratings.reduce((a, r) => a + r.score, 0) / ratings.length) * 10) / 10
    : null;

  const sizeReturnPct = deliveredItems
    ? Math.round((returns.length / deliveredItems) * 1000) / 10
    : null;

  return {
    month,
    plan,
    activeSubscribers: activeNow,
    activeAtStart,
    newSubscribers: newSubs,
    cancellations: cancelled,
    churnPct,
    averageRating: avgRating,
    ratingsCount: ratings.length,
    sizeReturnPct,
    sizeReturns: returns.length,
    deliveredItems,
    cancellationReasons: {
      reasons,
      unanswered: cancellations.filter(c => !c.reason).length,
      total: cancellations.length
    },
    churnAlert: {
      threshold: churnThreshold,
      active: churnPct !== null && churnPct > churnThreshold,
      message: churnPct !== null && churnPct > churnThreshold
        ? `El churn de ${month} es ${churnPct.toLocaleString('es-CO')} % y supera el umbral de ${churnThreshold} %.`
        : null
    },
    ratingAlert: {
      threshold: ratingThreshold,
      active: avgRating !== null && avgRating < ratingThreshold,
      message: avgRating !== null && avgRating < ratingThreshold
        ? `La satisfacción de ${month} (${avgRating}) está por debajo del umbral mínimo de ${ratingThreshold}.`
        : null
    },
    returnsAlert: {
      threshold: returnsThreshold,
      active: sizeReturnPct !== null && sizeReturnPct > returnsThreshold,
      message: sizeReturnPct !== null && sizeReturnPct > returnsThreshold
        ? `El porcentaje de devoluciones de ${month} (${sizeReturnPct} %) supera el umbral de ${returnsThreshold} %.`
        : null
    }
  };
}

// Meses con datos (los últimos 6 hasta hoy) para el filtro del panel.
function availableMonths(now = new Date(), count = 6) {
  return Array.from({ length: count }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}

module.exports = {
  computeKpis,
  availableMonths,
  monthKey,
  monthRange,
  subscriptionEvents
};
