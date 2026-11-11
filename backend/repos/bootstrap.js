// First-boot data for the store: the initial database built from backend/data/seed/db.json
// (the seed has no passwords, so the historical demo passwords are hashed here) and the base
// records every database must have (a role on every user, the admin and stylist demo users,
// and the paid demo subscription). Phase 1b replaces these demo credentials with env seeding.
const fs = require('fs');
const env = require('../config/env');
const store = require('./store');
const profiles = require('./profiles');
const { hashPassword } = require('../lib/crypto');

function initialData() {
  // The seed file has no passwords. Until Phase 1b seeds admin and stylist from env,
  // the demo client and the admin keep their historical demo passwords set here.
  const seed = JSON.parse(fs.readFileSync(env.SEED_DB_FILE, 'utf8'));
  const demoPasswords = { 'demo@theclothesbox.co': 'demo123', 'admin@theclothesbox.co': 'admin123' };
  seed.users.forEach(u => {
    if (demoPasswords[u.email]) u.passwordHash = hashPassword(demoPasswords[u.email]);
  });
  return seed;
}

// Adds whatever base record is missing and returns true when the store needs saving.
function ensureBaseRecords() {
  const { data } = store;
  let needsSave = false;

  data.users.forEach(u => {
    if (!u.role) {
      u.role = u.email === 'admin@theclothesbox.co' ? 'ADMIN' : 'CLIENT';
      needsSave = true;
    }
  });

  if (!data.users.some(u => u.email === 'admin@theclothesbox.co')) {
    data.users.push({
      id: 'usr_admin_01',
      name: 'Administrador de Operaciones',
      email: 'admin@theclothesbox.co',
      passwordHash: hashPassword('admin123'),
      role: 'ADMIN',
      createdAt: '2026-08-01T08:00:00.000Z'
    });
    needsSave = true;
  }

  // HU-07: usuario estilista de demostración
  if (!data.users.some(u => u.email === 'estilista@theclothesbox.co')) {
    data.users.push({
      id: 'usr_stylist_01',
      name: 'Laura Estilista',
      email: 'estilista@theclothesbox.co',
      passwordHash: hashPassword('estilista123'),
      role: 'STYLIST',
      createdAt: '2026-11-01T08:00:00.000Z'
    });
    needsSave = true;
  }

  // HU-08: el cliente demo tiene una suscripción pagada con la tarjeta de prueba 4242
  const demo = data.users.find(u => u.email === 'demo@theclothesbox.co');
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

module.exports = { initialData, ensureBaseRecords };
