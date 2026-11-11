// Password and token hashing helpers built on Node's crypto module. Passwords are stored as
// "salt:scryptHash" and compared in constant time; single-use tokens are stored only as a
// SHA-256 digest so a leaked database does not expose working links.
const crypto = require('crypto');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, key] = stored.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// Random id with a collection prefix, for example newId('usr') -> "usr_1a2b3c4d5e6f".
function newId(prefix, bytes = 6) {
  return `${prefix}_${crypto.randomBytes(bytes).toString('hex')}`;
}

module.exports = { hashPassword, verifyPassword, sha256, newId };
