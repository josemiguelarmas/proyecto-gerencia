// Returns and exchanges routes (HU-14): the subscriber's return requests with the garments
// still returnable and their deadline, a new request (window, reverse label, stock in the
// requested size or an equivalent garment), and the admin list and status update. Receiving
// the garment puts its variant back in stock through backend/logistics.js.
const { db } = require('../database');
const { calculateFit } = require('../engine');
const logistics = require('../logistics');
const { sendJson, parseJsonBody } = require('../lib/http');

// Returns GET (User's return requests + Returnable garments)
function listMyReturns({ res, authUser }) {
  const userReturns = db.getReturnsByUser(authUser.id);
  const boxes = db.getUserBoxes(authUser.id);
  const profile = db.getProfile(authUser.id) || {};

  const deliveredBoxes = boxes.filter(b => b.status === 'DELIVERED' || b.status === 'RATED');
  const returnedProductIds = userReturns.map(r => r.productId);

  const returnableGarments = [];
  deliveredBoxes.forEach(box => {
    box.itemIds.forEach(id => {
      const prod = db.getProductById(id);
      if (prod) {
        const isReturned = returnedProductIds.includes(prod.id);
        // HU-09: la talla recibida es la que se despachó, no la que daría el perfil ya recalibrado.
        const shipped = (box.shippedVariants || []).find(v => v.productId === prod.id);
        const fit = shipped ? { ...calculateFit(profile, prod), size: shipped.size } : calculateFit(profile, prod);
        returnableGarments.push({
          ...prod,
          cut: prod.fit,
          boxId: box.id,
          cycle: box.cycle,
          deliveredAt: box.deliveredAt,
          fit,
          isReturned,
          // HU-14: plazo de cambio calculado en el backend
          returnDeadline: logistics.returnDeadline(box.deliveredAt),
          withinWindow: !box.deliveredAt || new Date() <= new Date(logistics.returnDeadline(box.deliveredAt))
        });
      }
    });
  });

  const garmentFor = r => returnableGarments.find(g => g.id === r.productId && g.boxId === r.boxId);
  return sendJson(res, 200, {
    returns: userReturns.map(r => ({
      ...r,
      productName: garmentFor(r)?.name,
      brand: garmentFor(r)?.brandName,
      currentSize: garmentFor(r)?.fit.size
    })),
    returnableGarments
  });
}

// Returns POST — HU-14: plazo, guía inversa, stock de la talla pedida y alternativa sin stock
async function requestReturn({ req, res, authUser }) {
  const body = await parseJsonBody(req);
  let ret;
  try {
    ret = logistics.requestReturn(authUser.id, body);
  } catch (err) {
    if (err.code === 'RETURN_WINDOW_EXPIRED') {
      return sendJson(res, 422, { error: err.message, code: err.code, deadline: err.deadline, conditions: err.conditions });
    }
    if (err.code === 'NO_STOCK_IN_SIZE') {
      return sendJson(res, 409, { error: err.message, code: err.code, options: err.options });
    }
    throw err;
  }

  // Recalibración del perfil por ajuste
  const profile = db.getProfile(authUser.id);
  const prod = db.getProductById(ret.productId);
  if (profile && prod) {
    profile.brandAdj = profile.brandAdj || {};
    profile.brandAdj[prod.brandId] = (profile.brandAdj[prod.brandId] || 0) + (ret.reason === 'TOO_SMALL' ? 0.5 : -0.5);
    db.saveProfile(authUser.id, profile);
  }

  const messages = {
    EXCHANGE_SIZE: `Solicitud registrada. Recogeremos la prenda sin costo (guía ${ret.returnTrackingNumber}) y te enviaremos la talla ${ret.requestedSize}.`,
    EQUIVALENT: `Solicitud registrada. Recogeremos la prenda (guía ${ret.returnTrackingNumber}) y te enviaremos "${ret.replacementName}" en talla ${ret.requestedSize}.`,
    RETURN_ONLY: `Devolución registrada. Recogeremos la prenda sin costo (guía ${ret.returnTrackingNumber}).`
  };
  return sendJson(res, 201, { success: true, message: messages[ret.resolution], returnRequest: ret });
}

function listAllReturns({ res }) {
  const returns = db.getAllReturns();
  return sendJson(res, 200, { returns });
}

async function updateReturn({ req, res, match }) {
  const returnId = match[1];
  const { status, notes } = await parseJsonBody(req);
  const updated = db.updateReturn(returnId, {
    ...(status ? { status } : {}),
    ...(notes ? { adminNotes: notes } : {})
  });
  if (!updated) {
    return sendJson(res, 404, { error: 'Solicitud de devolución no encontrada.' });
  }
  // HU-14: al recibir la prenda, su variante reingresa al inventario (una sola vez).
  if (status === 'RECEIVED' || status === 'COMPLETED') logistics.receiveReturn(updated);
  return sendJson(res, 200, { success: true, returnRequest: updated });
}

module.exports = [
  { method: 'GET', path: '/api/returns', handler: listMyReturns },
  { method: 'POST', path: '/api/returns', handler: requestReturn },
  { method: 'GET', path: '/api/admin/returns', handler: listAllReturns },
  { method: 'PUT', path: /^\/api\/admin\/returns\/([^/]+)$/, handler: updateReturn }
];
