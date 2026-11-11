// Session tokens (JWT HS256) and role checks, built only on Node's crypto module. The secret
// comes from JWT_SECRET (backend/config/env.js); there is no fallback secret in code. Tokens
// carry iss/aud (both checked), iat/exp from the injectable clock (default life JWT_TTL_HOURS,
// 8 h) and the user's tokenVersion: logout and password reset bump that version, which
// revokes every token issued before. The signature is compared in constant time.
const crypto = require('crypto');
const env = require('./config/env');
const clock = require('./lib/clock');
const { db } = require('./database');

const ISSUER = 'the-clothes-box';
const AUDIENCE = 'the-clothes-box-spa';
const ROLES = Object.freeze({ CLIENT: 'CLIENT', STYLIST: 'STYLIST', ADMIN: 'ADMIN', WAREHOUSE: 'WAREHOUSE' });

// In test mode a missing JWT_SECRET gets a random per-process secret, never a fixed string.
let testSecret = null;

function secret() {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.IS_TEST) return testSecret || (testSecret = crypto.randomBytes(32).toString('hex'));
  const err = new Error('JWT_SECRET no está configurado. Defínelo antes de arrancar el servidor (ver .env.example).');
  err.code = 'CONFIG_MISSING';
  throw err;
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function hmac(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest();
}

// Low-level signer. Callers normally use issueToken(user), which adds the token version.
function signToken(payload, { ttlHours = env.JWT_TTL_HOURS } = {}) {
  const iat = Math.floor(clock.nowMs() / 1000);
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const body = base64url({ ...payload, iss: ISSUER, aud: AUDIENCE, iat, exp: iat + Math.round(ttlHours * 3600) });
  return `${header}.${body}.${hmac(`${header}.${body}`).toString('base64url')}`;
}

function issueToken(user) {
  return signToken({ userId: user.id, tv: user.tokenVersion || 0 });
}

function parseSegment(segment) {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

// Returns the payload of a valid token, or null when the format, signature, algorithm,
// issuer, audience or expiry is wrong.
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = hmac(`${header}.${body}`);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  const head = parseSegment(header);
  const payload = parseSegment(body);
  if (!head || head.alg !== 'HS256' || !payload) return null;
  if (payload.iss !== ISSUER || payload.aud !== AUDIENCE) return null;
  if (typeof payload.exp !== 'number' || Math.floor(clock.nowMs() / 1000) >= payload.exp) return null;
  return payload;
}

function authenticateRequest(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const payload = verifyToken(match[1]);
  if (!payload || !payload.userId) return null;
  const user = db.findUserById(payload.userId);
  if (!user || user.deletedAt) return null;
  if ((payload.tv || 0) !== (user.tokenVersion || 0)) return null; // revoked by logout or reset
  return { id: user.id, email: user.email, name: user.name, role: user.role || ROLES.CLIENT };
}

// Invalidates every token the user holds (logout, password reset).
function revokeTokens(userId) {
  const user = db.findUserById(userId);
  if (!user) return null;
  return db.updateUser(userId, { tokenVersion: (user.tokenVersion || 0) + 1 });
}

// requireRole('WAREHOUSE', 'ADMIN') returns a guard that throws a 403 error (answered by the
// router like any other error with a status) when the authenticated user lacks those roles.
function requireRole(...roles) {
  return function guard(authUser, message = 'Acceso denegado: no tienes permisos para esta sección.') {
    if (!authUser || !roles.includes(authUser.role)) {
      const err = new Error(message);
      err.status = 403;
      throw err;
    }
  };
}

module.exports = {
  ISSUER,
  AUDIENCE,
  ROLES,
  signToken,
  issueToken,
  verifyToken,
  authenticateRequest,
  revokeTokens,
  requireRole
};
