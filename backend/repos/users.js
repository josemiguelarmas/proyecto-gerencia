// Users repository: lookup by id or e-mail (case-insensitive), sign-up with a scrypt
// password hash, partial updates and password changes. Roles are CLIENT, STYLIST, ADMIN and WAREHOUSE (backend/auth.js ROLES).
const store = require('./store');
const { hashPassword, newId } = require('../lib/crypto');

function findUserByEmail(email) {
  if (!email) return null;
  return store.data.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
}

function findUserById(id) {
  return store.data.users.find(u => u.id === id) || null;
}

function createUser(name, email, password, role = 'CLIENT', extra = {}) {
  const user = {
    id: newId('usr'),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    role: role || 'CLIENT',
    ...extra,
    createdAt: new Date().toISOString()
  };
  store.data.users.push(user);
  store.save();
  return user;
}

function updateUser(userId, updates) {
  const user = findUserById(userId);
  if (!user) return null;
  Object.assign(user, updates);
  store.save();
  return user;
}

function setPassword(userId, password) {
  return updateUser(userId, { passwordHash: hashPassword(password) });
}

module.exports = { findUserByEmail, findUserById, createUser, updateUser, setPassword };
