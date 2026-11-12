// Personal data routes: the public data policy (HU-02) and the data subject rights of HU-16,
// namely rectifying name and e-mail, exporting personal data as JSON, deleting the account
// after a password check, and the admin report of those requests with response times.
// The business logic lives in backend/privacy.js.
const config = require('../config');
const privacy = require('../privacy');
const { sendJson, parseJsonBody } = require('../lib/http');
const { publicUser, sendVerificationEmail } = require('../lib/accounts');

function getPolicy({ res }) {
  return sendJson(res, 200, {
    ...config.POLICY,
    draftNotice: 'BORRADOR pendiente de revisión legal'
  });
}

// HU-16: rectificación de nombre y correo
async function updateAccount({ req, res, authUser }) {
  const body = await parseJsonBody(req);
  const result = privacy.updateAccount(authUser.id, body);
  const message = result.changed.length === 0 ? 'No hubo cambios en tus datos.'
    : result.emailChanged ? `Datos actualizados. Te enviamos un enlace para verificar ${result.user.email}.`
      : 'Datos actualizados.';
  if (result.emailChanged) sendVerificationEmail(result.user);
  return sendJson(res, 200, { success: true, message, user: publicUser(result.user) });
}

// HU-16: exportación de los datos personales en JSON
function exportData({ res, authUser }) {
  return sendJson(res, 200, privacy.exportData(authUser.id));
}

// HU-16: supresión de la cuenta con confirmación por contraseña
async function deleteAccount({ req, res, authUser }) {
  const { password } = await parseJsonBody(req);
  try {
    return sendJson(res, 200, { success: true, ...privacy.deleteAccount(authUser.id, password) });
  } catch (err) {
    if (err.code) return sendJson(res, err.status, { error: err.message, code: err.code });
    throw err;
  }
}

// HU-16: solicitudes de los titulares con su tiempo de respuesta
function dataRequestsReport({ res }) {
  return sendJson(res, 200, privacy.dataRequestsReport());
}

module.exports = [
  { method: 'GET', path: '/api/policy', public: true, handler: getPolicy },
  { method: 'PUT', path: '/api/account', handler: updateAccount },
  { method: 'GET', path: '/api/profile/export', handler: exportData },
  { method: 'GET', path: '/api/me/export', handler: exportData },
  { method: 'POST', path: '/api/account/delete', handler: deleteAccount },
  { method: 'DELETE', path: '/api/me', handler: deleteAccount },
  { method: 'GET', path: '/api/admin/data-requests', roles: ['ADMIN'], handler: dataRequestsReport }
];
