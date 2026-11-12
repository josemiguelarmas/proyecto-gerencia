// Stylist review routes (HU-07), reachable by STYLIST and ADMIN through the /api/stylist/
// guard in routes/index.js: the queue of proposed boxes, in-stock alternatives for a garment,
// and the approve, replace and reject actions. Every action is written to the box review log,
// and corrections are stored so the engine can learn from them (HU-11, SCRUM-55).
const { db } = require('../database');
const { calculateFit, curateBox, explainProduct } = require('../engine');
const { stockInSize } = require('../catalog');
const { sendJson, parseJsonBody } = require('../lib/http');
const { assertTransition, BoxTransitionError } = require('../domain/boxStateMachine');

function logReview(box, user, action, reason, details = {}) {
  const entry = { action, by: user.id, byName: user.name, role: user.role, at: new Date().toISOString(), reason: reason || '', ...details };
  box.reviewLog = [...(box.reviewLog || []), entry];
  box.box_changes = box.reviewLog; // alias for Jira acceptance criteria SCRUM-53
  return entry;
}

// Vista de una caja para el estilista: perfil del suscriptor y prendas con su explicación.
function stylistBoxView(box) {
  const user = db.findUserById(box.userId);
  const profile = db.getProfile(box.userId) || {};
  return {
    id: box.id,
    cycle: box.cycle,
    status: box.status,
    plan: box.plan,
    createdAt: box.createdAt,
    totalCostCOP: box.totalCostCOP,
    targetCostCOP: box.targetCostCOP,
    withinCap: box.withinCap,
    reviewLog: box.reviewLog || [],
    subscriber: user ? { id: user.id, name: user.name, email: user.email } : null,
    profile: {
      styles: profile.styles || [],
      occasions: profile.occasions || [],
      fit: profile.fit,
      line: profile.line,
      plan: profile.plan,
      measures: profile.measures || {},
      styleWeights: profile.styleWeights || null
    },
    items: (box.itemIds || []).map(id => {
      const p = db.getProductById(id);
      if (!p) return null;
      const rec = (box.recommendations || []).find(x => x.productId === id) || explainProduct(profile, p);
      const fit = calculateFit(profile, p);
      return { ...p, cut: p.fit, fit, recommendation: rec, stockInSize: stockInSize(p, fit.size) };
    }).filter(Boolean)
  };
}

function getQueue({ req, res }) {
  const url = new URL(req.url, 'http://localhost');
  let status = url.searchParams.get('status') || 'PROPOSED';
  if (status === 'PENDING_REVIEW') status = 'PROPOSED';
  const boxes = db.data.boxes
    .filter(b => b.status === status)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(stylistBoxView);
  return sendJson(res, 200, { boxes });
}

// Alternativas para reemplazar una prenda: misma categoría, con stock en la talla del suscriptor.
function getAlternatives({ res, match }) {
  const box = db.getBoxById(match[1]);
  if (!box) return sendJson(res, 404, { error: 'Caja no encontrada.' });
  const profile = db.getProfile(box.userId) || {};
  const alternatives = db.catalog
    .filter(p => !box.itemIds.includes(p.id))
    .map(p => ({ ...explainProduct(profile, p), name: p.name, brandName: p.brandName, category: p.category, imageUrl: p.imageUrl, stockInSize: stockInSize(p, calculateFit(profile, p).size) }))
    .filter(a => a.stockInSize > 0)
    .sort((a, b) => b.score - a.score);
  return sendJson(res, 200, { alternatives });
}

async function reviewBox({ req, res, authUser, match }) {
  const [, boxId, action] = match;
  const box = db.getBoxById(boxId);
  if (!box) return sendJson(res, 404, { error: 'Caja no encontrada.' });

  // SCRUM-53: state machine validation
  if (box.status !== 'PROPOSED') {
    return sendJson(res, 409, { error: `Solo se pueden revisar cajas propuestas. Esta caja está en ${box.status}.` });
  }

  const body = await parseJsonBody(req);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const profile = db.getProfile(box.userId) || {};

  if (action === 'approve') {
    try {
      assertTransition(box.status, 'APPROVED', authUser.role);
    } catch (err) {
      if (err instanceof BoxTransitionError) {
        return sendJson(res, err.status, { error: err.message, code: err.code });
      }
      throw err;
    }

    logReview(box, authUser, 'APPROVE', reason);
    const updated = db.updateBox(box.id, { status: 'APPROVED', approvedAt: new Date().toISOString(), approvedBy: authUser.id });
    return sendJson(res, 200, { success: true, message: 'Caja aprobada. Queda lista para despacho.', box: stylistBoxView(updated) });
  }

  if (!reason) {
    return sendJson(res, 400, { error: 'Escribe el motivo de la corrección.' });
  }

  if (action === 'replace') {
    const itemId = body.itemId || body.removedProductId;
    const newProductId = body.newProductId || body.variantId;
    if (!box.itemIds.includes(itemId)) {
      return sendJson(res, 400, { error: 'La prenda a reemplazar no está en esta caja.' });
    }
    const newProduct = db.getProductById(newProductId);
    if (!newProduct) return sendJson(res, 404, { error: 'La prenda nueva no existe en el catálogo.' });
    if (box.itemIds.includes(newProductId)) {
      return sendJson(res, 400, { error: 'La prenda nueva ya está en la caja.' });
    }
    const size = calculateFit(profile, newProduct).size;
    if (stockInSize(newProduct, size) <= 0) {
      return sendJson(res, 409, { error: `No hay stock de "${newProduct.name}" en talla ${size}, la talla del suscriptor.` });
    }
    const itemIds = box.itemIds.map(id => (id === itemId ? newProductId : id));
    const recommendations = (box.recommendations || []).filter(x => x.productId !== itemId)
      .concat({ ...explainProduct(profile, newProduct), chosenByStylist: true, explanation: `Elegida por tu estilista: ${reason}` });
    const totalCostCOP = itemIds.reduce((sum, id) => {
      const p = db.getProductById(id);
      return sum + (p ? p.wholesalePriceCOP || 0 : 0);
    }, 0);
    logReview(box, authUser, 'REPLACE', reason, { removedProductId: itemId, addedProductId: newProductId });

    // SCRUM-55: Training example for HU-11 with profile snapshot
    db.addCorrection({
      type: 'REPLACE',
      boxId: box.id,
      subscriberId: box.userId,
      stylistId: authUser.id,
      removedProductId: itemId,
      addedProductId: newProductId,
      reason,
      profileSnapshot: JSON.parse(JSON.stringify(profile))
    });

    const updated = db.updateBox(box.id, { itemIds, recommendations, totalCostCOP, withinCap: box.targetCostCOP ? totalCostCOP <= box.targetCostCOP : null });
    return sendJson(res, 200, {
      success: true,
      message: updated.withinCap === false ? 'Prenda reemplazada. Atención: la caja ahora supera el costo objetivo.' : 'Prenda reemplazada.',
      box: stylistBoxView(updated)
    });
  }

  // reject: la propuesta se descarta y el motor arma una nueva sin esas prendas.
  try {
    assertTransition(box.status, 'REJECTED', authUser.role);
  } catch (err) {
    if (err instanceof BoxTransitionError) {
      return sendJson(res, err.status, { error: err.message, code: err.code });
    }
    throw err;
  }

  const rejectedIds = box.itemIds.slice();
  logReview(box, authUser, 'REJECT', reason, { rejectedProductIds: rejectedIds });

  // SCRUM-55: Training example for HU-11 with profile snapshot
  db.addCorrection({
    type: 'REJECT',
    boxId: box.id,
    subscriberId: box.userId,
    stylistId: authUser.id,
    removedProductIds: rejectedIds,
    reason,
    profileSnapshot: JSON.parse(JSON.stringify(profile))
  });

  const received = db.getUserBoxes(box.userId).filter(b => b.id !== box.id).flatMap(b => b.itemIds || []);
  const curated = curateBox(profile, db.catalog, received, { excludeIds: rejectedIds });
  const updated = db.updateBox(box.id, {
    itemIds: curated.itemIds,
    recommendations: curated.recommendations,
    totalCostCOP: curated.totalCostCOP,
    targetCostCOP: curated.targetCostCOP,
    withinCap: curated.withinCap,
    proposalVersion: (box.proposalVersion || 1) + 1
  });
  return sendJson(res, 200, {
    success: true,
    message: 'Propuesta rechazada. El motor armó una nueva propuesta sin esas prendas, que vuelve a la cola.',
    box: stylistBoxView(updated)
  });
}

module.exports = [
  { method: 'GET', path: '/api/stylist/queue', handler: getQueue },
  { method: 'GET', path: '/api/stylist/boxes', handler: getQueue },
  { method: 'GET', path: /^\/api\/stylist\/boxes\/([^/]+)\/alternatives$/, handler: getAlternatives },
  { method: 'POST', path: /^\/api\/stylist\/boxes\/([^/]+)\/(approve|replace|reject)$/, handler: reviewBox }
];
