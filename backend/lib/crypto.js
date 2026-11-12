// Password and token hashing helpers built on Node's crypto module. Passwords are stored as
// "salt:scryptHash" and compared in constant time; single-use tokens are stored only as a
// SHA-256 digest so a leaked database does not expose working links.
// Measures encryption at rest using AES-256-GCM (HU-04, SCRUM-36).
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

// AES-256-GCM encryption helpers for sensitive data at rest (measures).
function getEncryptionKeyBuffer(keyString) {
  const key = keyString || process.env.DATA_ENCRYPTION_KEY || 'test-default-key-32-bytes-secure';
  return crypto.createHash('sha256').update(String(key)).digest();
}

function encryptJson(data, keyString) {
  if (data === null || data === undefined) return null;
  const keyBuffer = getEncryptionKeyBuffer(keyString);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const jsonStr = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('hex')
  };
}

function decryptJson(payload, keyString) {
  if (!payload || typeof payload !== 'object' || !payload.ciphertext) return null;
  const keyBuffer = getEncryptionKeyBuffer(keyString);
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'hex')),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = {
  hashPassword,
  verifyPassword,
  sha256,
  newId,
  encryptJson,
  decryptJson
};
