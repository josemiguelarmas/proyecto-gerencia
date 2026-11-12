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

function generateGuideHtml(ret, user, box, product) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Guía de Devolución ${ret.returnTrackingNumber || ret.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1a1a1a; line-height: 1.5; }
    .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 24px; font-weight: 800; text-transform: uppercase; }
    .badge { background: #f0f0f0; border: 1px solid #ccc; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 600; }
    .tracking { font-size: 28px; font-family: monospace; font-weight: 700; letter-spacing: 2px; margin: 16px 0; background: #fafafa; border: 1px dashed #999; padding: 12px; text-align: center; }
    .section { margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .label { font-size: 12px; text-transform: uppercase; color: #666; font-weight: 700; margin-bottom: 4px; }
    .val { font-size: 15px; font-weight: 500; }
    .instructions { background: #f9f9f9; border-left: 4px solid #1a1a1a; padding: 16px; margin-top: 24px; font-size: 13px; }
    .instructions ol { margin: 8px 0 0 16px; padding: 0; }
    @media print { body { margin: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">The Clothes Box · Guía de Logística Inversa</div>
      <div style="font-size:13px;color:#666">Servicio de Cambio y Devolución por Talla</div>
    </div>
    <div class="badge">${ret.carrier || 'Operador Logístico'}</div>
  </div>

  <div class="tracking">${ret.returnTrackingNumber || 'TCB-DEV-PENDIENTE'}</div>

  <div class="section grid">
    <div>
      <div class="label">Remitente (Suscriptor)</div>
      <div class="val">${user ? user.name : 'Suscriptor'}</div>
      <div class="val">${user ? user.email : ''}</div>
      <div class="val" style="margin-top:6px">${ret.pickupAddress || (box ? box.address : 'Cali, Colombia')}</div>
    </div>
    <div>
      <div class="label">Destinatario</div>
      <div class="val">The Clothes Box S.A.S. — Centro de Operaciones</div>
      <div class="val">Bodega Central de Logística Inversa</div>
      <div class="val">Cali, Valle del Cauca, Colombia</div>
    </div>
  </div>

  <div class="section grid">
    <div>
      <div class="label">Detalle de la Prenda</div>
      <div class="val">${product ? product.name : 'Prenda en devolución'} (${product ? product.brandName : 'Marca'})</div>
      <div class="val">Motivo: ${ret.reason === 'TOO_SMALL' ? 'Talla muy pequeña' : ret.reason === 'TOO_LARGE' ? 'Talla muy grande' : 'Problema de ajuste'}</div>
      <div class="val">Talla solicitada a cambio: <strong>${ret.requestedSize || 'N/A'}</strong></div>
    </div>
    <div>
      <div class="label">Programación de Recogida</div>
      <div class="val">Fecha estimada: <strong>${ret.scheduledPickupDate || 'Próximo día hábil'}</strong></div>
      <div class="val">Caja origen: #${box ? box.cycle : '1'} (ID: ${ret.boxId})</div>
      <div class="val">Resolución: ${ret.resolution || 'EXCHANGE_SIZE'}</div>
    </div>
  </div>

  <div class="instructions">
    <strong>Instrucciones para el suscriptor:</strong>
    <ol>
      <li>Empaca la prenda en la misma caja biodegradable o en una bolsa limpia debidamente sellada.</li>
      <li>Verifica que la prenda no tenga signos de uso, conserve sus etiquetas originales y esté limpia.</li>
      <li>Imprime esta guía o muestra el número <strong>${ret.returnTrackingNumber || ret.id}</strong> al recolector cuando pase por tu domicilio.</li>
      <li>Una vez recibida la prenda en nuestra bodega, despacharemos inmediatamente tu prenda de cambio.</li>
    </ol>
  </div>
</body>
</html>`;
}

// HU-14 (SCRUM-92): Guía de devolución en HTML imprimible
function getReturnGuide({ req, res, match, authUser }) {
  const returnId = match[1];
  const ret = db.data.returns.find(r => r.id === returnId);
  if (!ret) return sendJson(res, 404, { error: 'Solicitud de devolución no encontrada' });
  if (ret.userId !== authUser.id && authUser.role !== 'ADMIN' && authUser.role !== 'WAREHOUSE') {
    return sendJson(res, 403, { error: 'No tienes permiso para ver esta guía' });
  }

  const user = db.findUserById(ret.userId);
  const box = db.getBoxById(ret.boxId);
  const product = db.getProductById(ret.productId);
  const html = generateGuideHtml(ret, user, box, product);

  const url = new URL(req.url, 'http://localhost');
  if (url.searchParams.get('format') === 'html' || (req.headers.accept && req.headers.accept.includes('text/html'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  return sendJson(res, 200, {
    success: true,
    returnId: ret.id,
    trackingNumber: ret.returnTrackingNumber,
    carrier: ret.carrier,
    scheduledPickupDate: ret.scheduledPickupDate,
    pickupAddress: ret.pickupAddress,
    html
  });
}

// HU-14 (SCRUM-94): Métricas de devoluciones por talla y marca
function getReturnMetrics({ res }) {
  const allReturns = db.getAllReturns();
  const allBoxes = db.getAllBoxes().filter(b => b.status === 'DELIVERED' || b.status === 'RATED');

  let totalDeliveredGarments = 0;
  const deliveredBySize = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
  const deliveredByBrand = {};

  allBoxes.forEach(b => {
    (b.itemIds || []).forEach(id => {
      totalDeliveredGarments++;
      const prod = db.getProductById(id);
      if (prod) {
        deliveredByBrand[prod.brandName] = (deliveredByBrand[prod.brandName] || 0) + 1;
        const shipped = (b.shippedVariants || []).find(v => v.productId === id);
        const size = shipped ? shipped.size : 'M';
        if (deliveredBySize[size] !== undefined) deliveredBySize[size]++;
      }
    });
  });

  const sizeReturns = allReturns.filter(r => ['TOO_SMALL', 'TOO_LARGE', 'FIT_ISSUE'].includes(r.reason));
  const returnedBySize = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
  const returnedByBrand = {};

  sizeReturns.forEach(r => {
    const prod = db.getProductById(r.productId);
    const size = r.requestedSize || 'M';
    if (returnedBySize[size] !== undefined) returnedBySize[size]++;
    if (prod) {
      returnedByBrand[prod.brandName] = (returnedByBrand[prod.brandName] || 0) + 1;
    }
  });

  const overallRate = totalDeliveredGarments > 0 ? (sizeReturns.length / totalDeliveredGarments) * 100 : 0;
  const bySize = {};
  for (const size of Object.keys(deliveredBySize)) {
    const del = deliveredBySize[size];
    const ret = returnedBySize[size] || 0;
    bySize[size] = {
      delivered: del,
      returned: ret,
      ratePct: del > 0 ? Math.round((ret / del) * 1000) / 10 : 0
    };
  }

  const byBrand = {};
  for (const brand of Object.keys(deliveredByBrand)) {
    const del = deliveredByBrand[brand];
    const ret = returnedByBrand[brand] || 0;
    byBrand[brand] = {
      delivered: del,
      returned: ret,
      ratePct: del > 0 ? Math.round((ret / del) * 1000) / 10 : 0
    };
  }

  return sendJson(res, 200, {
    totalDeliveredGarments,
    totalSizeReturns: sizeReturns.length,
    overallReturnRatePct: Math.round(overallRate * 10) / 10,
    goalPct: 10,
    alert: overallRate > 10,
    bySize,
    byBrand
  });
}

module.exports = [
  { method: 'GET', path: '/api/returns', handler: listMyReturns },
  { method: 'POST', path: '/api/returns', handler: requestReturn },
  { method: 'GET', path: /^\/api\/returns\/([^/]+)\/guide$/, handler: getReturnGuide },
  { method: 'GET', path: '/api/admin/returns', roles: ['ADMIN', 'WAREHOUSE'], handler: listAllReturns },
  { method: 'GET', path: '/api/admin/returns/metrics', roles: ['ADMIN', 'WAREHOUSE'], handler: getReturnMetrics },
  { method: 'PUT', path: /^\/api\/admin\/returns\/([^/]+)$/, roles: ['ADMIN', 'WAREHOUSE'], handler: updateReturn }
];
