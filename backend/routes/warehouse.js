// Warehouse and dispatch routes for the admin panel (HU-09): every box with its items, the
// manual status change of an approved box (dispatching creates the shipping label, takes the
// stock and notifies the subscriber), the picking and packing queue, and the latest inventory
// movements. Approval itself stays in the stylist queue so the review log is never skipped.
const { db } = require('../database');
const logistics = require('../logistics');
const { sendJson, parseJsonBody } = require('../lib/http');
const { UNAPPROVED_STATUSES, NOT_APPROVED_ERROR } = require('../lib/boxes');

// Admin Boxes (Full visibility including items even in PREPARING or SHIPPED)
function listBoxes({ res }) {
  const boxes = db.getAllBoxes();
  return sendJson(res, 200, { boxes });
}

async function changeBoxStatus({ req, res, match }) {
  const boxId = match[1];
  const { status } = await parseJsonBody(req);
  if (status === 'APPROVED' || status === 'PROPOSED') {
    return sendJson(res, 400, { error: 'La aprobación se hace desde la cola del estilista para dejar registro de quién y por qué.' });
  }
  const validStatuses = ['CREATED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'RATED'];
  if (!validStatuses.includes(status)) {
    return sendJson(res, 400, { error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}` });
  }
  const target = db.getBoxById(boxId);
  if (!target) return sendJson(res, 404, { error: 'Caja no encontrada.' });
  if (UNAPPROVED_STATUSES.includes(target.status)) {
    return sendJson(res, 409, { error: NOT_APPROVED_ERROR });
  }
  // HU-09: despachar genera la guía, descuenta stock y avisa al suscriptor.
  const updated = logistics.advanceBox(target, status);
  return sendJson(res, 200, { success: true, box: updated });
}

// HU-09: cajas por despachar con lista de picking y empaque
function dispatchQueue({ res }) {
  return sendJson(res, 200, logistics.dispatchQueue());
}

// HU-09/HU-14: movimientos de inventario (despachos, cambios y reingresos)
function inventoryMovements({ res }) {
  return sendJson(res, 200, { movements: [...db.data.inventoryMovements].reverse().slice(0, 100) });
}

// F5: bodega (WAREHOUSE) y administración comparten las rutas de despacho.
const WAREHOUSE_ACCESS = {
  roles: ['WAREHOUSE', 'ADMIN'],
  forbidden: 'Acceso denegado: se requiere rol de Bodega o de Administrador.'
};

module.exports = [
  { method: 'GET', path: '/api/admin/boxes', handler: listBoxes },
  { method: 'POST', path: /^\/api\/admin\/boxes\/([^/]+)\/status$/, handler: changeBoxStatus },
  { method: 'GET', path: '/api/admin/dispatch', handler: dispatchQueue },
  { method: 'GET', path: '/api/admin/inventory-movements', handler: inventoryMovements }
].map(route => ({ ...route, ...WAREHOUSE_ACCESS }));
