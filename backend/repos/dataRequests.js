// Data subject requests repository (HU-16): each export, rectification or deletion request
// with when it was requested and resolved, so the admin report can show response times
// against the legal deadlines.
const store = require('./store');
const { newId } = require('../lib/crypto');

// HU-16: solicitudes del titular (consulta, rectificación, supresión) con su tiempo de respuesta
function addDataRequest(userId, type, { requestedAt, status = 'COMPLETED', detail = '' } = {}) {
  const resolvedAt = new Date();
  const request = {
    id: newId('dreq'),
    userId,
    type,
    status,
    detail,
    requestedAt: (requestedAt || resolvedAt).toISOString(),
    resolvedAt: resolvedAt.toISOString(),
    responseMs: resolvedAt - (requestedAt || resolvedAt)
  };
  store.data.dataRequests.push(request);
  store.save();
  return request;
}

module.exports = { addDataRequest };
