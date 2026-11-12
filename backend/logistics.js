// HU-09 y HU-14: despacho con guía, seguimiento, stock por variante y cambios por talla.
const { db } = require('./database');
const config = require('./config');
const mail = require('./adapters/mailer');
const shipping = require('./adapters/logistics');
const { calculateFit, scoreProduct } = require('./engine');
const { stockInSize } = require('./catalog');

const UNAPPROVED_STATUSES = ['PROPOSED', 'REJECTED'];
const NOT_APPROVED_ERROR = 'La caja no ha sido aprobada';
const PAYMENT_NOT_CONFIRMED = 'Pago no confirmado';
const NOT_SHIPPED_STATUSES = ['PROPOSED', 'REJECTED', 'APPROVED', 'CREATED', 'PREPARING'];
const OUTBOUND_STATUSES = ['PREPARING', 'SHIPPED', 'DELIVERED'];

const STEP_LABELS = {
  PREPARING: 'Caja en preparación y empaque',
  SHIPPED: 'Guía generada y paquete recogido',
  DELIVERED: 'Entregada en la dirección del suscriptor'
};

function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---------------------------------------------------------------
// HU-09: pago del ciclo y bloqueo del despacho
// ---------------------------------------------------------------

// El ciclo está pago si la suscripción está activa, sin cobros en reintento y con el próximo cobro en el futuro.
function paymentStatus(userId, now = new Date()) {
  const sub = db.getSubscription(userId);
  if (sub.status === 'PAUSED') return { confirmed: false, paused: true, reason: 'Suscripción en pausa' };
  if (sub.status !== 'ACTIVE') return { confirmed: false, reason: sub.status === 'PAST_DUE' ? 'Pago pendiente' : 'Sin suscripción pagada' };
  if (sub.dunning) return { confirmed: false, reason: 'Cobro en reintento' };
  if (!sub.nextChargeAt || new Date(sub.nextChargeAt) <= now) return { confirmed: false, reason: 'Cobro del ciclo vencido' };
  return { confirmed: true, reason: null };
}

// Devuelve el error que impide sacar la caja de bodega, o null si puede avanzar.
function dispatchBlock(box, nextStatus, now = new Date()) {
  if (!OUTBOUND_STATUSES.includes(nextStatus) || !NOT_SHIPPED_STATUSES.includes(box.status)) return null;
  if (UNAPPROVED_STATUSES.includes(box.status)) return NOT_APPROVED_ERROR;
  const payment = paymentStatus(box.userId, now);
  if (payment.paused) return 'Tu suscripción está en pausa: esta caja no se despacha hasta que reanudes.';
  if (!payment.confirmed) return PAYMENT_NOT_CONFIRMED;
  return null;
}

// ---------------------------------------------------------------
// Inventario por variante con registro de movimientos
// ---------------------------------------------------------------
function pickVariant(product, size, color) {
  const inSize = (product.variants || []).filter(v => v.size === size);
  if (color) {
    const exact = inSize.find(v => v.color === color);
    if (exact) return exact;
  }
  return inSize.sort((a, b) => b.stock - a.stock)[0] || null;
}

function moveStock({ product, size, color, qty, type, reason, refId, now = new Date() }) {
  const variant = pickVariant(product, size, color);
  const before = variant ? variant.stock : 0;
  if (variant) variant.stock = Math.max(0, variant.stock + qty);
  const movement = {
    id: `inv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    type,
    productId: product.id,
    size,
    color: variant ? variant.color : color || null,
    qty,
    stockBefore: before,
    stockAfter: variant ? variant.stock : 0,
    missingVariant: !variant,
    reason: reason || null,
    refId,
    at: now.toISOString()
  };
  db.data.inventoryMovements.push(movement);
  return movement;
}

// Consecutivo diario de guías: cuenta las guías del día ya guardadas con ese prefijo.
function nextSequence(prefix) {
  const numbers = [
    ...db.data.boxes.map(b => b.trackingNumber),
    ...db.data.returns.flatMap(r => [r.returnTrackingNumber, r.exchangeTrackingNumber])
  ].filter(n => typeof n === 'string' && n.startsWith(prefix));
  return numbers.reduce((max, n) => Math.max(max, Number(n.slice(prefix.length)) || 0), 0) + 1;
}

// ---------------------------------------------------------------
// HU-09: despacho, guía y notificaciones
// ---------------------------------------------------------------
function shipBox(box, now, options = {}) {
  const user = db.findUserById(box.userId);
  const profile = db.getProfile(box.userId) || {};

  let shipment;
  if (options.carrier && options.trackingNumber) {
    shipment = shipping.manualShipment({
      reference: box.id,
      address: box.address,
      recipient: user ? user.name : box.userId,
      carrier: options.carrier,
      trackingNumber: options.trackingNumber,
      now
    });
  } else {
    shipment = shipping.createShipment({
      reference: box.id,
      address: box.address,
      recipient: user ? user.name : box.userId,
      sequence: nextSequence(`TCB-${shipping.dateKey(now)}-`),
      now
    });
  }

  box.shippedVariants = (box.itemIds || []).map(id => {
    const product = db.getProductById(id);
    if (!product) return null;
    const size = calculateFit(profile, product).size;
    const movement = moveStock({ product, size, qty: -1, type: 'DISPATCH_OUT', reason: `Despacho caja ${box.id}`, refId: box.id, now });
    return { productId: id, size, color: movement.color };
  }).filter(Boolean);
  db.saveCatalog();

  Object.assign(box, {
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    shippedAt: now.toISOString(),
    estimatedDelivery: shipment.estimatedDelivery,
    trackingEvents: [...(box.trackingEvents || []), ...shipment.events]
  });

  if (options.sustainablePackaging !== undefined) {
    box.sustainablePackaging = Boolean(options.sustainablePackaging);
  }

  if (user) {
    mail.send({
      to: user.email,
      type: 'BOX_SHIPPED',
      subject: `Tu caja #${box.cycle} va en camino`,
      body: `Hola ${user.name}, despachamos tu caja #${box.cycle}. Número de guía: ${shipment.trackingNumber} (${shipment.carrier}). Entrega estimada: ${formatDate(shipment.estimatedDelivery || now)}, en ${box.address}. Sigue el envío en ${config.APP_BASE_URL}/#/caja.`
    });
  }
}

// Avanza la caja a nextStatus con sus efectos: guía y stock al despachar, avisos al despachar y entregar.
function advanceBox(box, nextStatus, now = new Date(), options = {}) {
  const blocked = dispatchBlock(box, nextStatus, now);
  if (blocked) throw httpError(409, blocked);

  const wasShipped = !NOT_SHIPPED_STATUSES.includes(box.status) || Boolean(box.shippedAt);
  if (!wasShipped && (nextStatus === 'SHIPPED' || nextStatus === 'DELIVERED')) shipBox(box, now, options);

  if (nextStatus === 'PREPARING') {
    box.trackingEvents = [...(box.trackingEvents || []), { status: 'PREPARING', label: STEP_LABELS.PREPARING, at: now.toISOString() }];
    if (options.sustainablePackaging !== undefined) {
      box.sustainablePackaging = Boolean(options.sustainablePackaging);
    }
    if (options.packed) {
      box.packed = true;
      box.packedAt = now.toISOString();
    }
  }
  if (nextStatus === 'IN_TRANSIT') {
    box.trackingEvents = [...(box.trackingEvents || []), { status: 'IN_TRANSIT', label: 'En tránsito con la transportadora', at: now.toISOString() }];
    const user = db.findUserById(box.userId);
    if (user) {
      mail.send({
        to: user.email,
        type: 'BOX_IN_TRANSIT',
        subject: `Tu caja #${box.cycle} está en tránsito`,
        body: `Hola ${user.name}, tu caja #${box.cycle} ya se encuentra en tránsito con ${box.carrier || 'la transportadora'} (guía ${box.trackingNumber || 'sin guía'}) hacia tu dirección.`
      });
    }
  }
  if (nextStatus === 'DELIVERED' && box.status !== 'DELIVERED') {
    box.deliveredAt = now.toISOString();
    box.trackingEvents = [...(box.trackingEvents || []), { status: 'DELIVERED', label: STEP_LABELS.DELIVERED, at: now.toISOString() }];
    const user = db.findUserById(box.userId);
    if (user) {
      mail.send({
        to: user.email,
        type: 'BOX_DELIVERED',
        subject: `Tu caja #${box.cycle} fue entregada`,
        body: `Hola ${user.name}, tu caja #${box.cycle} (guía ${box.trackingNumber || 'sin guía'}) fue entregada. Ábrela y califica cada prenda en ${config.APP_BASE_URL}/#/caja. Si alguna talla no te quedó, tienes ${config.RETURN_WINDOW_BUSINESS_DAYS} días hábiles para pedir el cambio.`
      });
    }
  }
  box.status = nextStatus;
  return db.updateBox(box.id, {});
}

// Vista "Cajas por despachar": cajas aprobadas o en preparación con su lista de picking.
function dispatchQueue(now = new Date()) {
  const boxes = db.data.boxes.filter(b => ['APPROVED', 'CREATED', 'PREPARING'].includes(b.status) && !b.shippedAt);
  const picking = {};
  const list = boxes.map(box => {
    const user = db.findUserById(box.userId);
    const profile = db.getProfile(box.userId) || {};
    const payment = paymentStatus(box.userId, now);
    const items = (box.itemIds || []).map(id => {
      const p = db.getProductById(id);
      if (!p) return null;
      const size = calculateFit(profile, p).size;
      const variant = pickVariant(p, size);
      const color = variant ? variant.color : p.colorName || '—';
      const key = `${p.id}|${size}|${color}`;
      picking[key] = picking[key] || { productId: p.id, name: p.name, brandName: p.brandName, category: p.category, size, color, quantity: 0, stock: variant ? variant.stock : 0 };
      picking[key].quantity++;
      return { productId: p.id, name: p.name, brandName: p.brandName, category: p.category, imageUrl: p.imageUrl, size, color, stock: variant ? variant.stock : 0 };
    }).filter(Boolean);
    return {
      id: box.id,
      cycle: box.cycle,
      status: box.status,
      plan: box.plan,
      address: box.address,
      approvedAt: box.approvedAt || null,
      subscriber: user ? { id: user.id, name: user.name, email: user.email } : null,
      paymentConfirmed: payment.confirmed,
      blockedReason: dispatchBlock(box, 'SHIPPED', now),
      items
    };
  });
  const pickingList = Object.values(picking).sort((a, b) => a.brandName.localeCompare(b.brandName) || a.name.localeCompare(b.name));
  pickingList.forEach(p => { p.shortage = p.quantity > p.stock; });
  return { boxes: list, pickingList, readyCount: list.filter(b => !b.blockedReason).length };
}

// ---------------------------------------------------------------
// HU-14: cambio o devolución por talla
// ---------------------------------------------------------------
const RETURN_REASONS = ['TOO_SMALL', 'TOO_LARGE', 'FIT_ISSUE'];

// Último momento para pedir el cambio: fin del quinto día hábil después de la entrega.
function returnDeadline(deliveredAt) {
  if (!deliveredAt) return null;
  const d = shipping.addBusinessDays(deliveredAt, config.RETURN_WINDOW_BUSINESS_DAYS);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function equivalentsFor(profile, product, size, excludeIds) {
  return db.catalog
    .filter(p => p.id !== product.id && p.category === product.category && !excludeIds.includes(p.id) && stockInSize(p, size) > 0)
    .map(p => ({ id: p.id, name: p.name, brandName: p.brandName, category: p.category, imageUrl: p.imageUrl, priceCOP: p.priceCOP, stockInSize: stockInSize(p, size), score: scoreProduct(profile, p).score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function requestReturn(userId, body, now = new Date()) {
  const { boxId, productId, reason, requestedSize, notes, pickupAddress, scheduledPickupDate, resolution, replacementProductId } = body;

  if (!RETURN_REASONS.includes(reason)) {
    throw httpError(400, 'Motivo de devolución no permitido. En The Clothes Box los cambios gratuitos están reservados exclusivamente a problemas de talla o ajuste (TOO_SMALL, TOO_LARGE, FIT_ISSUE).');
  }
  if (!requestedSize) throw httpError(400, 'Debes seleccionar la talla de reemplazo solicitada.');

  const box = db.getBoxById(boxId);
  if (!box || box.userId !== userId) throw httpError(404, 'Caja no encontrada.');
  if (box.status !== 'DELIVERED' && box.status !== 'RATED') {
    throw httpError(403, 'No puedes solicitar devolución de una prenda que aún no ha sido entregada.');
  }
  if (!box.itemIds.includes(productId)) throw httpError(400, 'La prenda seleccionada no corresponde a esta caja.');
  if (db.data.returns.some(r => r.userId === userId && r.boxId === boxId && r.productId === productId)) {
    throw httpError(409, 'Ya pediste un cambio para esta prenda.');
  }

  // Plazo desde la fecha de entrega, en días hábiles.
  const deadline = returnDeadline(box.deliveredAt);
  if (deadline && now > new Date(deadline)) {
    throw httpError(422, `El plazo para pedir el cambio venció el ${formatDate(deadline)}. Los cambios se piden dentro de ${config.RETURN_WINDOW_BUSINESS_DAYS} días hábiles desde la entrega.`, {
      code: 'RETURN_WINDOW_EXPIRED',
      deadline,
      conditions: config.RETURN_CONDITIONS
    });
  }

  const product = db.getProductById(productId);
  const profile = db.getProfile(userId) || {};
  const user = db.findUserById(userId);
  const received = db.getUserBoxes(userId).flatMap(b => b.itemIds || []);

  // Qué se envía a cambio: la misma prenda en otra talla, una equivalente o nada (solo devolución).
  let replacement = null;
  let kind;
  if (resolution === 'RETURN_ONLY') {
    kind = 'RETURN_ONLY';
  } else if (resolution === 'EQUIVALENT') {
    const options = equivalentsFor(profile, product, requestedSize, received);
    replacement = options.find(o => o.id === replacementProductId);
    if (!replacement) throw httpError(400, 'Elige una de las prendas equivalentes disponibles en tu talla.');
    kind = 'EQUIVALENT';
  } else if (stockInSize(product, requestedSize) > 0) {
    replacement = { id: product.id, name: product.name };
    kind = 'EXCHANGE_SIZE';
  } else {
    throw httpError(409, `No tenemos "${product.name}" en talla ${requestedSize}. Puedes cambiarla por una prenda equivalente o devolverla.`, {
      code: 'NO_STOCK_IN_SIZE',
      options: { equivalents: equivalentsFor(profile, product, requestedSize, received), canReturn: true }
    });
  }

  const pickupDate = scheduledPickupDate || shipping.addBusinessDays(now, 1).toISOString().slice(0, 10);
  const address = pickupAddress || box.address || 'Cali, Colombia';
  const reverse = shipping.createReturnShipment({
    reference: `${box.id}/${productId}`,
    address,
    recipient: user.name,
    sequence: nextSequence(`TCB-DEV-${shipping.dateKey(now)}-`),
    pickupDate,
    now
  });

  const ret = db.createReturn(userId, { boxId, productId, reason, requestedSize, notes, pickupAddress: address, scheduledPickupDate: pickupDate });
  Object.assign(ret, {
    resolution: kind,
    returnTrackingNumber: reverse.trackingNumber,
    carrier: reverse.carrier,
    deadline,
    creditPending: kind === 'RETURN_ONLY'
  });

  // Con stock, la otra talla (o la equivalente) se reserva y su envío queda programado tras la recogida.
  if (replacement) {
    const replacementProduct = db.getProductById(replacement.id);
    moveStock({ product: replacementProduct, size: requestedSize, qty: -1, type: 'EXCHANGE_OUT', reason: `Cambio por talla ${ret.id}`, refId: ret.id, now });
    db.saveCatalog();
    const outbound = shipping.createShipment({
      reference: ret.id,
      address,
      recipient: user.name,
      sequence: nextSequence(`TCB-${shipping.dateKey(now)}-`),
      now
    });
    Object.assign(ret, {
      replacementProductId: replacement.id,
      replacementName: replacement.name,
      exchangeTrackingNumber: outbound.trackingNumber,
      exchangeScheduledFor: pickupDate
    });
  }
  db.save();

  const what = kind === 'EXCHANGE_SIZE' ? `Te enviaremos "${product.name}" en talla ${requestedSize} (guía ${ret.exchangeTrackingNumber}).`
    : kind === 'EQUIVALENT' ? `Te enviaremos "${ret.replacementName}" en talla ${requestedSize} (guía ${ret.exchangeTrackingNumber}).`
      : 'No enviaremos una prenda de reemplazo.';
  mail.send({
    to: user.email,
    type: 'RETURN_SCHEDULED',
    subject: `Cambio por talla ${ret.id}: recogida agendada`,
    body: `Hola ${user.name}, recogeremos "${product.name}" el ${pickupDate} en ${address}. Guía de devolución: ${ret.returnTrackingNumber} (${reverse.carrier}). ${what}`
  });
  return ret;
}

// El administrador marca la prenda recibida: la variante devuelta sube 1 en stock con el motivo.
function receiveReturn(ret, now = new Date()) {
  if (ret.restockedAt) return ret;
  const product = db.getProductById(ret.productId);
  if (!product) return ret;
  const box = db.getBoxById(ret.boxId);
  const shipped = box && (box.shippedVariants || []).find(v => v.productId === ret.productId);
  const size = shipped ? shipped.size : calculateFit(db.getProfile(ret.userId) || {}, product).size;
  const movement = moveStock({ product, size, color: shipped ? shipped.color : null, qty: 1, type: 'RETURN_IN', reason: ret.reason, refId: ret.id, now });
  db.saveCatalog();
  Object.assign(ret, { restockedAt: now.toISOString(), restock: { size, color: movement.color, reason: ret.reason, movementId: movement.id } });
  db.save();
  return ret;
}

module.exports = {
  PAYMENT_NOT_CONFIRMED,
  paymentStatus,
  dispatchBlock,
  advanceBox,
  dispatchQueue,
  returnDeadline,
  equivalentsFor,
  requestReturn,
  receiveReturn
};
