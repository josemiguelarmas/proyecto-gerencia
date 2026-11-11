// Account helpers used by more than one route module: the public shape of a user returned
// to the SPA (never the password hash) and the e-mail verification message sent after
// sign-up or after an e-mail change. Kept here so auth and privacy routes share one copy.
const { db } = require('../database');
const config = require('../config');
const mail = require('../mail');

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'CLIENT',
    emailVerified: user.emailVerified,
    fiscal: user.fiscal || null
  };
}

function sendVerificationEmail(user) {
  const token = db.createAuthToken(user.id, 'EMAIL_VERIFY', null);
  mail.send({
    to: user.email,
    type: 'EMAIL_VERIFICATION',
    subject: 'Confirma tu correo en The Clothes Box',
    body: `Hola ${user.name}, confirma tu correo abriendo este enlace: ${config.APP_BASE_URL}/#/verificar?token=${token}`
  });
}

module.exports = { publicUser, sendVerificationEmail };
