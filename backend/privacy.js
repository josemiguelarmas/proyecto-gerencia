// HU-16: derechos del titular (Ley 1581 de 2012): rectificar, consultar (exportar) y suprimir.
// Cada solicitud queda en dataRequests con su tiempo de respuesta.
const { db, verifyPassword } = require('./database');
const config = require('./config');
const mail = require('./mail');
const billing = require('./billing');

const { EMAIL_RE } = require('./lib/validate');

function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

// Rectificación de nombre y correo. Un correo nuevo debe ser único y queda sin verificar.
function updateAccount(userId, { name, email }) {
  const requestedAt = new Date();
  const user = db.findUserById(userId);
  const updates = {};
  if (name !== undefined) {
    const clean = String(name).trim();
    if (clean.length < 2 || clean.length > 80) throw httpError(400, 'El nombre debe tener entre 2 y 80 caracteres.');
    if (clean !== user.name) updates.name = clean;
  }
  let emailChanged = false;
  if (email !== undefined) {
    const clean = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) throw httpError(400, 'Escribe un correo válido, por ejemplo nombre@correo.com.');
    if (clean !== user.email.toLowerCase()) {
      const owner = db.findUserByEmail(clean);
      if (owner && owner.id !== userId) throw httpError(409, 'Este correo ya está registrado', { code: 'EMAIL_EXISTS' });
      updates.email = clean;
      updates.emailVerified = false;
      emailChanged = true;
    }
  }
  if (Object.keys(updates).length === 0) return { user, changed: [], emailChanged: false };

  const previous = { name: user.name, email: user.email };
  db.updateUser(userId, updates);
  const changed = Object.keys(updates).filter(k => k !== 'emailVerified');
  const labels = { name: 'nombre', email: 'correo' };
  db.addDataRequest(userId, 'RECTIFICATION', { requestedAt, detail: `Actualizó ${changed.map(k => labels[k]).join(' y ')}` });
  if (emailChanged) {
    mail.send({
      to: previous.email,
      type: 'EMAIL_CHANGED',
      subject: 'Cambiaste el correo de tu cuenta',
      body: `Hola ${user.name}, el correo de tu cuenta en The Clothes Box cambió a ${updates.email}. Si no fuiste tú, escríbenos a datos@theclothesbox.co.`
    });
  }
  return { user: db.findUserById(userId), changed, emailChanged };
}

// Consulta: todos los datos personales del titular en un JSON.
function exportData(userId) {
  const requestedAt = new Date();
  const user = db.findUserById(userId);
  const { passwordHash, ...account } = user;
  const product = id => db.getProductById(id);
  const data = {
    generatedAt: new Date().toISOString(),
    policyVersion: config.POLICY.version,
    account,
    consents: db.getConsentsByUser(userId),
    profile: db.getProfile(userId),
    profileVersions: db.getProfileVersions(userId),
    subscription: billing.publicSubscription(db.getSubscription(userId)),
    payments: db.getPayments(userId),
    invoices: db.getInvoices(userId),
    boxes: db.getUserBoxes(userId).map(b => ({
      id: b.id,
      cycle: b.cycle,
      status: b.status,
      plan: b.plan,
      address: b.address,
      createdAt: b.createdAt,
      deliveredAt: b.deliveredAt || null,
      trackingNumber: b.trackingNumber || null,
      items: (b.itemIds || []).map(id => ({ id, name: product(id) ? product(id).name : id }))
    })),
    ratings: db.getRatingsByUser(userId),
    returns: db.getReturnsByUser(userId)
  };
  db.addDataRequest(userId, 'EXPORT', { requestedAt, detail: 'Exportación JSON de datos personales' });
  return data;
}

// Supresión: anonimiza los datos personales y conserva pagos y facturas por obligación tributaria.
function deleteAccount(userId, password) {
  const requestedAt = new Date();
  const user = db.findUserById(userId);
  if (!password || !verifyPassword(password, user.passwordHash)) {
    throw httpError(403, 'La contraseña no es correcta. Escríbela para confirmar que quieres eliminar tu cuenta.');
  }
  const sub = db.getSubscription(userId);
  if (sub.status === 'PAST_DUE' || sub.dunning) {
    db.addDataRequest(userId, 'DELETION', { requestedAt, status: 'BLOCKED', detail: 'Cobro pendiente' });
    throw httpError(409, 'No podemos eliminar tu cuenta mientras tengas un cobro pendiente. Actualiza tu medio de pago o espera a que se resuelva el cobro en curso y vuelve a intentarlo.', { code: 'PENDING_CHARGE' });
  }

  const original = { name: user.name, email: user.email };
  const now = new Date().toISOString();

  // 1. Cancelar la suscripción: no habrá más cobros ni despachos.
  if (['ACTIVE', 'PAUSED'].includes(sub.status)) {
    const cancellation = db.addCancellation(userId, { plan: sub.plan, reason: null, comment: 'Cuenta eliminada por el titular' });
    db.saveSubscription(userId, {
      status: 'CANCELLED', cancelledAt: now, cancellationId: cancellation.id, nextChargeAt: null, pendingPlan: null, pendingPlanFrom: null, pausedUntil: null,
      history: [...(sub.history || []), { type: 'CANCEL', plan: sub.plan, at: now }]
    });
  }
  const stored = db.data.subscriptions.find(s => s.userId === userId);
  if (stored) Object.assign(stored, { paymentToken: null, cardBrand: null, cardLast4: null });

  // 2. Confirmación al correo original, antes de anonimizarlo.
  mail.send({
    to: original.email,
    type: 'ACCOUNT_DELETED',
    subject: 'Eliminamos tu cuenta',
    body: `Hola ${original.name}, eliminamos tu cuenta de The Clothes Box y anonimizamos tus datos personales (nombre, correo, perfil y medidas). Conservamos tus pagos y facturas porque la ley tributaria nos obliga a guardarlos. No haremos más cobros.`
  });

  // 3. Anonimizar cuenta, perfil y medidas. Las facturas guardan su propia copia de los datos fiscales.
  db.updateUser(userId, {
    name: 'Usuario eliminado',
    email: `eliminado_${userId}@anonimo.invalid`,
    passwordHash: null,
    birthDate: null,
    fiscal: null,
    emailVerified: null,
    deletedAt: now
  });
  db.data.profiles = db.data.profiles.filter(p => p.userId !== userId);
  db.data.profiles.push({ userId, deleted: true, done: false, updatedAt: now });
  db.data.profileVersions = db.data.profileVersions.filter(v => v.userId !== userId);
  db.data.quizSessions = db.data.quizSessions.filter(q => q.userId !== userId);
  db.data.authTokens = db.data.authTokens.filter(t => t.userId !== userId);
  db.data.boxes.filter(b => b.userId === userId).forEach(b => { b.address = 'Dirección anonimizada'; });
  db.data.returns.filter(r => r.userId === userId).forEach(r => { r.pickupAddress = 'Dirección anonimizada'; r.notes = ''; });
  db.data.ratings.filter(r => r.userId === userId).forEach(r => { r.styleFeedback = ''; r.feedback = ''; r.preferenceNotes = ''; });
  db.save();

  db.addDataRequest(userId, 'DELETION', { requestedAt, detail: 'Cuenta anonimizada; pagos y facturas conservados' });
  return { message: 'Tu cuenta fue eliminada y tus datos personales quedaron anonimizados. Te enviamos la confirmación a tu correo.' };
}

function dataRequestsReport() {
  const users = Object.fromEntries(db.data.users.map(u => [u.id, u]));
  const requests = [...db.data.dataRequests].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  const byType = {};
  requests.forEach(r => {
    byType[r.type] = byType[r.type] || { type: r.type, count: 0, blocked: 0, avgResponseMs: 0, deadlineBusinessDays: config.DATA_REQUEST_DEADLINES[r.type] };
    byType[r.type].count++;
    if (r.status === 'BLOCKED') byType[r.type].blocked++;
    byType[r.type].avgResponseMs += r.responseMs;
  });
  Object.values(byType).forEach(t => { t.avgResponseMs = Math.round(t.avgResponseMs / t.count); });
  return {
    summary: Object.values(byType),
    requests: requests.slice(0, 100).map(r => ({ ...r, userName: users[r.userId] ? users[r.userId].name : r.userId }))
  };
}

module.exports = { updateAccount, exportData, deleteAccount, dataRequestsReport };
