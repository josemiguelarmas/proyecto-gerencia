// Central input validators (F5). Small pure functions shared by route modules so every
// endpoint applies the same rules: e-mail format, password policy, integer ranges, enum
// membership and a whitelist pick that stops mass assignment from request bodies.
// Functions return booleans (or a Spanish problem message), never throw.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_MIN_LENGTH = 8;

function isEmail(value) {
  return typeof value === 'string' && value.trim().length <= 254 && EMAIL_RE.test(value.trim());
}

// Returns null when the password meets the policy, or the message to show the user.
function passwordProblem(value) {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(value) || !/\d/.test(value)) {
    return 'La contraseña debe combinar letras y números.';
  }
  return null;
}

function isIntInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isOneOf(value, allowed) {
  return allowed.includes(value);
}

// Copies only the listed keys that are present in `source` (undefined values are skipped).
function pick(source, allowedKeys) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  allowedKeys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) out[key] = source[key];
  });
  return out;
}

module.exports = { EMAIL_RE, PASSWORD_MIN_LENGTH, isEmail, passwordProblem, isIntInRange, isOneOf, pick };
