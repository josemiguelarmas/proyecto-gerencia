// First-boot data for the store: the initial database built from backend/data/seed/db.json
// (the seed has no passwords) and the base records every database must have: a role on every
// user, the privileged accounts and the paid demo subscription. Privileged accounts (ADMIN,
// STYLIST, WAREHOUSE) are created only from env (ADMIN_EMAIL/ADMIN_PASSWORD, ...) and only
// when no user with that e-mail exists; nothing here ever overwrites an existing account.
// There are no passwords in code: without the env variables those accounts simply do not exist.
const fs = require('fs');
const env = require('../config/env');
const store = require('./store');
const profiles = require('./profiles');
const { hashPassword, newId } = require('../lib/crypto');

const DEMO_CLIENT_EMAIL = 'demo@theclothesbox.co';

const PRIVILEGED_ACCOUNTS = [
  { role: 'ADMIN', emailVar: 'ADMIN_EMAIL', passwordVar: 'ADMIN_PASSWORD', id: 'usr_admin_01', name: 'Administrador de Operaciones' },
  { role: 'STYLIST', emailVar: 'STYLIST_EMAIL', passwordVar: 'STYLIST_PASSWORD', id: 'usr_stylist_01', name: 'Laura Estilista' },
  { role: 'WAREHOUSE', emailVar: 'WAREHOUSE_EMAIL', passwordVar: 'WAREHOUSE_PASSWORD', id: 'usr_warehouse_01', name: 'Equipo de Bodega' }
];

function initialData() {
  return JSON.parse(fs.readFileSync(env.SEED_DB_FILE, 'utf8'));
}

// Creates each privileged account whose e-mail and password are set in `source` and whose
// e-mail is not registered yet. Returns the created users (pure over `data`, no saving).
function seedPrivilegedUsers(data, source = env) {
  const created = [];
  PRIVILEGED_ACCOUNTS.forEach(account => {
    const email = (source[account.emailVar] || '').trim().toLowerCase();
    const password = source[account.passwordVar] || '';
    if (!email || !password) return;
    if (data.users.some(u => u.email.toLowerCase() === email)) return;
    const user = {
      id: data.users.some(u => u.id === account.id) ? newId('usr') : account.id,
      name: account.name,
      email,
      passwordHash: hashPassword(password),
      role: account.role,
      createdAt: new Date().toISOString()
    };
    data.users.push(user);
    created.push(user);
  });
  return created;
}

// Adds whatever base record is missing and returns true when the store needs saving.
function ensureBaseRecords() {
  const { data } = store;
  let needsSave = false;

  data.users.forEach(u => {
    if (!u.role) {
      u.role = 'CLIENT';
      needsSave = true;
    }
  });

  if (seedPrivilegedUsers(data).length > 0) needsSave = true;

  // The seeded demo client gets a password only when DEMO_CLIENT_PASSWORD is set.
  const demo = data.users.find(u => u.email === DEMO_CLIENT_EMAIL);
  if (demo && !demo.passwordHash && env.DEMO_CLIENT_PASSWORD) {
    demo.passwordHash = hashPassword(env.DEMO_CLIENT_PASSWORD);
    needsSave = true;
  }

  // HU-08: el cliente demo tiene una suscripción pagada con la tarjeta de prueba 4242
  if (demo && !data.subscriptions.some(s => s.userId === demo.id)) {
    const now = new Date();
    const next = new Date(now);
    next.setMonth(next.getMonth() + 1);
    data.subscriptions.push({
      id: 'sub_demo_01',
      userId: demo.id,
      plan: (profiles.getProfile(demo.id) || {}).plan || 'esencial',
      status: 'ACTIVE',
      paymentToken: 'tok_sim_ok_visa_4242_demo0000000000',
      cardBrand: 'Visa',
      cardLast4: '4242',
      startedAt: now.toISOString(),
      nextChargeAt: next.toISOString(),
      dunning: null,
      createdAt: now.toISOString()
    });
    if (!demo.fiscal) {
      demo.fiscal = { docType: 'CC', docNumber: '1144000000', address: 'Calle 18 # 122-135, Pance', city: 'Cali' };
    }
    needsSave = true;
  }

  return needsSave;
}

module.exports = { initialData, ensureBaseRecords, seedPrivilegedUsers, PRIVILEGED_ACCOUNTS };
