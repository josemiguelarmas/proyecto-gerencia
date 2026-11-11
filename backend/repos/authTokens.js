// Single-use auth tokens repository (HU-01): password reset and e-mail verification links.
// Only the SHA-256 of each token is stored; consuming a token marks it as used, and expired
// or already used tokens are rejected.
const crypto = require('crypto');
const store = require('./store');
const { sha256, newId } = require('../lib/crypto');

// HU-01: tokens de un solo uso (recuperación y verificación). Solo se guarda el hash.
function createAuthToken(userId, type, ttlMs) {
  const token = crypto.randomBytes(32).toString('hex');
  store.data.authTokens.push({
    id: newId('tok'),
    userId,
    type,
    tokenHash: sha256(token),
    expiresAt: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null,
    usedAt: null,
    createdAt: new Date().toISOString()
  });
  store.save();
  return token;
}

// Devuelve el registro si el token es válido y lo marca como usado.
function consumeAuthToken(token, type) {
  if (!token) return null;
  const hash = sha256(token);
  const record = store.data.authTokens.find(t => t.tokenHash === hash && t.type === type);
  if (!record || record.usedAt) return null;
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) return null;
  record.usedAt = new Date().toISOString();
  store.save();
  return record;
}

module.exports = { createAuthToken, consumeAuthToken };
