// Inventory repository (HU-05, SCRUM-38): the only place that changes a variant's stock or
// reserved units. Every change writes one record in store.data.inventoryMovements (the same
// collection GET /api/admin/inventory-movements lists) and saves catalog and database.
//
// API for other streams. Each function takes { sku } or { productId, size, color? } to locate
// the variant, plus qty (positive integer, default 1), reason (required text), refId (box,
// return or import id, optional) and now (Date, optional). It returns the movement and throws
// an error with status 404 (variant not found), 400 (bad qty/reason) or 409 (not enough units).
//   reserve  - box approved: reserved += qty; needs available (stock - reserved) >= qty.
//   release  - box rejected or cancelled: reserved -= qty; needs reserved >= qty.
//   consume  - box dispatched: stock -= qty and reserved -= qty; needs reserved >= qty
//              (reserve first, so the same unit is never promised twice).
//   restock  - return re-entry or new units: stock += qty.
//   setStock - admin correction to an absolute stock ({ stock } instead of qty); it cannot go
//              below the reserved units.
// Movement shape: { id, type: RESERVE|RELEASE|CONSUME|RESTOCK|ADJUST, productId, sku, size,
// color, qty, stockBefore, stockAfter, reservedBefore, reservedAfter, reason, refId, at }.
const store = require('./store');
const { httpError } = require('../lib/http');
const { newId } = require('../lib/crypto');
const { availableUnits } = require('../catalog');

function findVariant({ sku, productId, size, color }) {
  for (const product of store.catalog) {
    if (productId && product.id !== productId) continue;
    const variant = (product.variants || []).find(v =>
      sku ? v.sku === sku : v.size === size && (!color || v.color === color)
    );
    if (variant) return { product, variant };
  }
  return null;
}

function locate(target) {
  const found = findVariant(target);
  if (!found) {
    const label = target.sku || `${target.productId} talla ${target.size}${target.color ? ` color ${target.color}` : ''}`;
    throw httpError(404, `No existe la variante ${label} en el catálogo.`);
  }
  return found;
}

function checkQty(qty) {
  if (!Number.isInteger(qty) || qty <= 0) throw httpError(400, 'La cantidad debe ser un entero mayor que 0.');
}

function checkReason(reason) {
  if (typeof reason !== 'string' || !reason.trim()) throw httpError(400, 'Todo movimiento de inventario necesita un motivo.');
}

// Applies { stock, reserved } deltas to one variant and records the movement.
function move(type, target, { stockDelta = 0, reservedDelta = 0, qty }) {
  const { product, variant } = target.found;
  const movement = {
    id: newId('inv'),
    type,
    productId: product.id,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    qty,
    stockBefore: variant.stock,
    reservedBefore: variant.reserved,
    reason: target.reason.trim(),
    refId: target.refId || null,
    at: (target.now || new Date()).toISOString()
  };
  variant.stock += stockDelta;
  variant.reserved += reservedDelta;
  movement.stockAfter = variant.stock;
  movement.reservedAfter = variant.reserved;
  store.data.inventoryMovements.push(movement);
  store.saveCatalog();
  store.save();
  return movement;
}

function prepare(params) {
  const qty = params.qty === undefined ? 1 : params.qty;
  checkQty(qty);
  checkReason(params.reason);
  return { qty, target: { ...params, found: locate(params) } };
}

function reserve(params) {
  const { qty, target } = prepare(params);
  const available = availableUnits(target.found.variant);
  if (available < qty) throw httpError(409, `Sin unidades disponibles de ${target.found.variant.sku} (disponibles: ${available}).`);
  return move('RESERVE', target, { reservedDelta: qty, qty });
}

function release(params) {
  const { qty, target } = prepare(params);
  if (target.found.variant.reserved < qty) throw httpError(409, `No hay ${qty} unidades reservadas de ${target.found.variant.sku} para liberar.`);
  return move('RELEASE', target, { reservedDelta: -qty, qty });
}

function consume(params) {
  const { qty, target } = prepare(params);
  if (target.found.variant.reserved < qty) throw httpError(409, `Solo se despachan unidades reservadas: ${target.found.variant.sku} tiene ${target.found.variant.reserved}.`);
  return move('CONSUME', target, { stockDelta: -qty, reservedDelta: -qty, qty });
}

function restock(params) {
  const { qty, target } = prepare(params);
  return move('RESTOCK', target, { stockDelta: qty, qty });
}

function setStock(params) {
  checkReason(params.reason);
  if (!Number.isInteger(params.stock) || params.stock < 0) throw httpError(400, 'El stock debe ser un entero mayor o igual a 0.');
  const target = { ...params, found: locate(params) };
  const { variant } = target.found;
  if (params.stock < variant.reserved) throw httpError(409, `El stock de ${variant.sku} no puede quedar por debajo de las ${variant.reserved} unidades reservadas.`);
  return move('ADJUST', target, { stockDelta: params.stock - variant.stock, qty: params.stock - variant.stock });
}

function listMovements({ sku, productId } = {}) {
  return store.data.inventoryMovements.filter(m => (!sku || m.sku === sku) && (!productId || m.productId === productId));
}

module.exports = { findVariant, reserve, release, consume, restock, setStock, listMovements };
