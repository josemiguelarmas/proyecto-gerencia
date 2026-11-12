// Authentication routes: sign-up with age and consent checks (HU-01, HU-02), login, password
// recovery and e-mail verification with single-use tokens, plus the authenticated "who am I"
// and "resend verification" endpoints. Token signing and verification live in backend/auth.js.
const { db, verifyPassword } = require('../database');
const { issueToken, revokeTokens } = require('../auth');
const config = require('../config');
const mail = require('../adapters/mailer');
const { sendJson, parseJsonBody } = require('../lib/http');
const { publicUser, sendVerificationEmail } = require('../lib/accounts');
const rateLimit = require('../lib/rateLimit');
const validate = require('../lib/validate');

// Edad cumplida a partir de una fecha YYYY-MM-DD. Devuelve null si la fecha no es válida.
function ageFromBirthDate(birthDate, now = new Date()) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const birth = new Date(Date.UTC(y, m - 1, d));
  if (birth.getUTCMonth() !== m - 1 || birth > now) return null;
  let age = now.getUTCFullYear() - y;
  const beforeBirthday = now.getUTCMonth() < m - 1 || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d);
  if (beforeBirthday) age--;
  return age;
}

async function register({ req, res }) {
  const { name, email, password, birthDate, acceptedPolicy, policyVersion } = await parseJsonBody(req);
  if (!name || !email || !password || !birthDate) {
    return sendJson(res, 400, { error: 'Nombre, correo, fecha de nacimiento y contraseña son obligatorios.' });
  }
  if (!validate.isEmail(email)) {
    return sendJson(res, 400, { error: 'Escribe un correo válido, por ejemplo nombre@correo.com.', code: 'INVALID_EMAIL' });
  }
  // HU-02: sin consentimiento explícito no se crea la cuenta
  if (acceptedPolicy !== true || !policyVersion) {
    return sendJson(res, 400, { error: 'El consentimiento es obligatorio', code: 'CONSENT_REQUIRED' });
  }
  if (policyVersion !== config.POLICY.version) {
    return sendJson(res, 400, { error: `La versión de la política aceptada (${policyVersion}) no es la vigente (${config.POLICY.version}). Recarga la página.`, code: 'POLICY_OUTDATED' });
  }
  const age = ageFromBirthDate(birthDate);
  if (age === null) {
    return sendJson(res, 400, { error: 'La fecha de nacimiento no es válida.' });
  }
  if (age < config.MIN_AGE) {
    return sendJson(res, 400, { error: `Debes ser mayor de ${config.MIN_AGE} años para crear una cuenta en The Clothes Box.`, code: 'UNDERAGE' });
  }
  const passProblem = validate.passwordProblem(password);
  if (passProblem) {
    return sendJson(res, 400, { error: passProblem, code: 'WEAK_PASSWORD' });
  }
  if (db.findUserByEmail(email)) {
    return sendJson(res, 409, { error: 'Este correo ya está registrado', code: 'EMAIL_EXISTS', offer: 'login_or_recovery' });
  }
  const user = db.createUser(name, email, password, 'CLIENT', { birthDate, emailVerified: false });
  db.addConsent(user.id, { accepted: true, policyVersion });
  sendVerificationEmail(user);
  const token = issueToken(user);
  return sendJson(res, 201, { token, user: publicUser(user) });
}

// HU-01: recuperación de contraseña. La respuesta es la misma exista o no el correo.
async function forgotPassword({ req, res }) {
  const { email } = await parseJsonBody(req);
  if (!email) {
    return sendJson(res, 400, { error: 'Escribe el correo de tu cuenta.' });
  }
  const user = db.findUserByEmail(email);
  if (user) {
    const token = db.createAuthToken(user.id, 'PASSWORD_RESET', config.PASSWORD_RESET_TTL_MS);
    mail.send({
      to: user.email,
      type: 'PASSWORD_RESET',
      subject: 'Recupera tu contraseña de The Clothes Box',
      body: `Hola ${user.name}, para crear una nueva contraseña abre este enlace (vence en 1 hora y sirve una sola vez): ${config.APP_BASE_URL}/#/restablecer?token=${token}`
    });
  }
  return sendJson(res, 200, {
    success: true,
    message: 'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña. Vence en 1 hora.'
  });
}

async function resetPassword({ req, res }) {
  const { token, password } = await parseJsonBody(req);
  if (!password) {
    return sendJson(res, 400, { error: 'La contraseña es obligatoria.' });
  }
  const passProblem = validate.passwordProblem(password);
  if (passProblem) {
    return sendJson(res, 400, { error: passProblem, code: 'WEAK_PASSWORD' });
  }
  const record = db.consumeAuthToken(token, 'PASSWORD_RESET');
  if (!record) {
    return sendJson(res, 400, { error: 'El enlace no es válido, ya se usó o venció. Solicita uno nuevo.' });
  }
  db.setPassword(record.userId, password);
  revokeTokens(record.userId); // las sesiones abiertas con la contraseña anterior dejan de servir
  return sendJson(res, 200, { success: true, message: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' });
}

async function verifyEmail({ req, res }) {
  const { token } = await parseJsonBody(req);
  const record = db.consumeAuthToken(token, 'EMAIL_VERIFY');
  if (!record) {
    return sendJson(res, 400, { error: 'El enlace de verificación no es válido o ya se usó.' });
  }
  db.updateUser(record.userId, { emailVerified: true, emailVerifiedAt: new Date().toISOString() });
  return sendJson(res, 200, { success: true, message: 'Tu correo quedó verificado.' });
}

async function login({ req, res }) {
  const { email, password } = await parseJsonBody(req);
  if (!email || !password) {
    return sendJson(res, 400, { error: 'Correo y contraseña requeridos.' });
  }
  // F5: 5 intentos fallidos en 15 minutos por correo e IP bloquean el inicio de sesión.
  const ip = req.socket.remoteAddress;
  const waitSec = rateLimit.loginBlockedFor(email, ip);
  if (waitSec !== null) {
    return sendJson(res, 429, {
      error: `Demasiados intentos fallidos. Espera ${Math.ceil(waitSec / 60)} minutos antes de volver a intentarlo o recupera tu contraseña.`,
      code: 'TOO_MANY_ATTEMPTS',
      retryAfterSec: waitSec
    });
  }

  const user = db.findUserByEmail(email);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    rateLimit.recordLoginFailure(email, ip);
    return sendJson(res, 401, { error: 'Credenciales inválidas' });
  }
  rateLimit.clearLoginFailures(email, ip);

  const token = issueToken(user);
  return sendJson(res, 200, { token, user: publicUser(user) });
}

function getMe({ res, authUser }) {
  return sendJson(res, 200, { user: publicUser(authUser) });
}

function resendVerification({ res, authUser }) {
  if (authUser.emailVerified) {
    return sendJson(res, 200, { success: true, message: 'Tu correo ya está verificado.' });
  }
  sendVerificationEmail(authUser);
  return sendJson(res, 200, { success: true, message: `Enviamos un nuevo enlace a ${authUser.email}. Vence en 24 horas.` });
}

function logout({ res, authUser }) {
  revokeTokens(authUser.id);
  return sendJson(res, 200, { success: true });
}

module.exports = [
  { method: 'POST', path: '/api/auth/register', public: true, handler: register },
  { method: 'POST', path: '/api/auth/login', public: true, handler: login },
  { method: 'POST', path: '/api/auth/forgot', public: true, handler: forgotPassword },
  { method: 'POST', path: '/api/auth/reset', public: true, handler: resetPassword },
  { method: 'POST', path: '/api/auth/verify', public: true, handler: verifyEmail },
  { method: 'POST', path: '/api/auth/verify-email', public: true, handler: verifyEmail },
  { method: 'GET', path: '/api/auth/me', handler: getMe },
  { method: 'POST', path: '/api/auth/resend-verification', handler: resendVerification },
  { method: 'POST', path: '/api/auth/logout', handler: logout }
];
