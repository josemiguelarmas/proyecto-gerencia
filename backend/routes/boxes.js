// Subscriber box routes: the current box (garments stay hidden until delivery), the demo
// step that advances an approved box, the unboxing reveal, requesting the next box and the
// history of delivered boxes. Also the admin monthly batch (HU-06) that proposes a box for
// every active, paid-up subscriber. Shipping transitions are delegated to backend/logistics.js.
const { db } = require('../database');
const { calculateFit } = require('../engine');
const logistics = require('../logistics');
const { sendJson } = require('../lib/http');
const { UNAPPROVED_STATUSES, OPEN_BOX_STATUSES, NOT_APPROVED_ERROR, createCuratedBox } = require('../lib/boxes');

// Current Box GET (CRITICAL RULE: Hides products until DELIVERED or RATED)
function getCurrentBox({ res, authUser }) {
  const boxes = db.getUserBoxes(authUser.id);
  const profile = db.getProfile(authUser.id) || { plan: 'esencial', measures: {} };

  const currentBox = boxes[0] || null;
  if (!currentBox) {
    return sendJson(res, 200, { box: null });
  }

  const isDeliveredOrRated = currentBox.status === 'DELIVERED' || currentBox.status === 'RATED';
  const boxRatings = db.getRatingsByBox(currentBox.id);

  const responsePayload = {
    id: currentBox.id,
    cycle: currentBox.cycle,
    status: currentBox.status,
    trackingNumber: currentBox.trackingNumber || null,
    carrier: currentBox.carrier || null,
    shippedAt: currentBox.shippedAt || null,
    trackingEvents: currentBox.trackingEvents || [],
    plan: currentBox.plan,
    itemsCount: (currentBox.itemIds || []).length,
    address: currentBox.address,
    estimatedDelivery: currentBox.estimatedDelivery,
    deliveredAt: currentBox.deliveredAt,
    createdAt: currentBox.createdAt,
    unboxed: !!currentBox.unboxed,
    // BACKEND RULE: If preparing or shipped, NEVER send items to the client!
    items: isDeliveredOrRated
      ? currentBox.itemIds.map(id => {
          const p = db.getProductById(id);
          if (!p) return null;
          const fit = calculateFit(profile, p);
          const userRating = boxRatings.find(r => r.productId === p.id) || null;
          const recommendation = (currentBox.recommendations || []).find(x => x.productId === p.id) || null;
          return { ...p, fit, userRating, recommendation };
        }).filter(Boolean)
      : null,
    ratings: isDeliveredOrRated ? boxRatings : []
  };

  return sendJson(res, 200, { box: responsePayload });
}

// Simulate Step POST (PREPARING -> SHIPPED -> DELIVERED)
function simulateStep({ res, authUser }) {
  const boxes = db.getUserBoxes(authUser.id);
  const currentBox = boxes[0];
  if (!currentBox) {
    return sendJson(res, 404, { error: 'No tienes ninguna caja activa.' });
  }

  // HU-07: el despacho se bloquea mientras el estilista no apruebe la caja
  if (UNAPPROVED_STATUSES.includes(currentBox.status)) {
    return sendJson(res, 409, { error: NOT_APPROVED_ERROR });
  }

  const NEXT = { APPROVED: 'PREPARING', CREATED: 'SHIPPED', PREPARING: 'SHIPPED', SHIPPED: 'DELIVERED' };
  if (!NEXT[currentBox.status]) {
    return sendJson(res, 200, { message: 'La caja ya fue entregada.', box: currentBox });
  }

  // HU-09/HU-12: pausa y pago del ciclo se validan en logistics.advanceBox (409)
  const updated = logistics.advanceBox(currentBox, NEXT[currentBox.status]);
  return sendJson(res, 200, { success: true, status: updated.status, box: updated });
}

// Unbox POST ("Tu caja llegó" Surprise celebration)
function unbox({ res, authUser, match }) {
  const boxId = match[1];
  const box = db.getBoxById(boxId);
  if (!box || box.userId !== authUser.id) {
    return sendJson(res, 404, { error: 'Caja no encontrada.' });
  }
  if (box.status !== 'DELIVERED' && box.status !== 'RATED') {
    return sendJson(res, 403, { error: 'Aún no puedes abrir una caja que no ha sido entregada.' });
  }

  db.updateBox(boxId, { unboxed: true });
  const profile = db.getProfile(authUser.id) || {};
  const boxRatings = db.getRatingsByBox(boxId);
  const items = box.itemIds.map(id => {
    const p = db.getProductById(id);
    const userRating = boxRatings.find(r => r.productId === p.id) || null;
    const recommendation = (box.recommendations || []).find(x => x.productId === p.id) || null;
    return { ...p, fit: calculateFit(profile, p), userRating, recommendation };
  });

  return sendJson(res, 200, { success: true, items });
}

function requestNextBox({ res, authUser }) {
  const boxes = db.getUserBoxes(authUser.id);
  const currentBox = boxes[0];
  if (currentBox && currentBox.status !== 'RATED' && currentBox.status !== 'DELIVERED') {
    return sendJson(res, 400, { error: 'Primero debes recibir y evaluar tu caja actual antes de solicitar la siguiente.' });
  }

  const profile = db.getProfile(authUser.id) || {};
  const { box: newBox } = createCuratedBox(authUser.id, profile, {
    cycle: (currentBox ? currentBox.cycle : 0) + 1,
    address: currentBox ? currentBox.address : 'Calle 18 # 122-135, Pance, Cali',
    receivedIds: boxes.flatMap(b => b.itemIds || [])
  });

  return sendJson(res, 201, {
    success: true,
    box: {
      id: newBox.id,
      cycle: newBox.cycle,
      status: newBox.status,
      plan: newBox.plan,
      itemsCount: newBox.itemIds.length,
      estimatedDelivery: newBox.estimatedDelivery
    }
  });
}

function getHistory({ res, authUser }) {
  const boxes = db.getUserBoxes(authUser.id);
  const profile = db.getProfile(authUser.id) || {};

  const deliveredBoxes = boxes
    .filter(b => b.status === 'DELIVERED' || b.status === 'RATED')
    .map(b => {
      const ratings = db.getRatingsByBox(b.id);
      const items = b.itemIds.map(id => {
        const p = db.getProductById(id);
        if (!p) return null;
        const userRating = ratings.find(r => r.productId === p.id) || null;
        return { ...p, cut: p.fit, fit: calculateFit(profile, p), userRating };
      }).filter(Boolean);

      return {
        id: b.id,
        cycle: b.cycle,
        status: b.status,
        plan: b.plan,
        deliveredAt: b.deliveredAt,
        items,
        ratings
      };
    });

  return sendJson(res, 200, { history: deliveredBoxes });
}

// HU-06: genera la caja del mes para todos los suscriptores activos
function generateBatch({ res }) {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const generated = [];
  const skipped = [];
  db.data.users.filter(u => (u.role || 'CLIENT') === 'CLIENT').forEach(user => {
    // HU-17: los suscriptores sintéticos de scripts/seed-demo.js no reciben cajas reales.
    if (user.seedDemo) return skipped.push({ userId: user.id, reason: 'Dato de prueba' });
    // HU-08/HU-12: solo suscripciones pagadas y al día; en pausa o en mora no reciben caja.
    const sub = db.getSubscription(user.id);
    const profile = db.getProfile(user.id);
    if (sub.status !== 'ACTIVE' || !profile || !profile.done) {
      return skipped.push({ userId: user.id, reason: sub.status === 'PAUSED' ? 'Suscripción en pausa' : sub.status === 'PAST_DUE' ? 'Pago pendiente' : 'Sin suscripción activa' });
    }
    if (sub.dunning) {
      return skipped.push({ userId: user.id, reason: 'Cobro en reintento' });
    }
    const boxes = db.getUserBoxes(user.id);
    const latest = boxes[0];
    if (latest && OPEN_BOX_STATUSES.includes(latest.status)) {
      return skipped.push({ userId: user.id, reason: `Tiene una caja en curso (${latest.status})` });
    }
    if (latest && (latest.createdAt || '').slice(0, 7) === monthKey) {
      return skipped.push({ userId: user.id, reason: 'Ya tiene la caja de este mes' });
    }
    const { box, curated } = createCuratedBox(user.id, profile, {
      cycle: (latest ? latest.cycle : 0) + 1,
      address: (latest && latest.address) || profile.address || 'Cali, Colombia',
      receivedIds: boxes.flatMap(b => b.itemIds || [])
    });
    generated.push({ userId: user.id, boxId: box.id, withinCap: curated.withinCap, complete: curated.missingSlots.length === 0 });
  });
  const pct = fn => (generated.length ? Math.round((generated.filter(fn).length / generated.length) * 100) : null);
  return sendJson(res, 200, {
    success: true,
    month: monthKey,
    generatedCount: generated.length,
    skippedCount: skipped.length,
    withinCapPct: pct(g => g.withinCap),
    completePct: pct(g => g.complete),
    generated,
    skipped
  });
}

module.exports = [
  { method: 'GET', path: '/api/boxes/current', handler: getCurrentBox },
  { method: 'POST', path: '/api/boxes/simulate-step', handler: simulateStep },
  { method: 'POST', path: /^\/api\/boxes\/([^/]+)\/unbox$/, handler: unbox },
  { method: 'POST', path: '/api/boxes/next', handler: requestNextBox },
  { method: 'GET', path: '/api/boxes/history', handler: getHistory },
  { method: 'POST', path: '/api/admin/boxes/generate-batch', handler: generateBatch }
];
