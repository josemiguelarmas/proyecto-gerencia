// Single JSON store behind every repository. It owns the in-memory state (`data`, one array
// per collection, and `catalog`), loads it from DATA_DIR on boot (creating the files from the
// committed seeds on first run) and persists it with atomic writes: the JSON goes to a temp
// file in the same folder and is then renamed over the target, so a crash never leaves a
// half-written database. Repositories always read `store.data.<collection>` at call time,
// because some callers replace a collection array (for example when deleting an account).
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { normalizeProduct } = require('../catalog');

const DB_FILE = env.DB_FILE;
const CATALOG_FILE = env.CATALOG_FILE;

// Colecciones de la base. Las de Sprint 2 se crean vacías en bases existentes.
const COLLECTIONS = ['users', 'profiles', 'boxes', 'ratings', 'returns', 'consents', 'authTokens', 'subscriptions', 'cancellations', 'corrections', 'quizSessions', 'profileVersions', 'payments', 'invoices', 'alerts', 'inventoryMovements', 'dataRequests', 'settings', 'feedbackEvents', 'modelVersions', 'kpiSnapshots'];

function emptyData() {
  return Object.fromEntries(COLLECTIONS.map(c => [c, []]));
}

function writeFileAtomic(file, content) {
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  try {
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

const store = {
  data: emptyData(),
  catalog: [],

  // createInitialData() builds the first database when db.json is missing or unreadable.
  load(createInitialData) {
    [DB_FILE, CATALOG_FILE].forEach(file => fs.mkdirSync(path.dirname(file), { recursive: true }));
    if (!fs.existsSync(CATALOG_FILE)) fs.copyFileSync(env.SEED_CATALOG_FILE, CATALOG_FILE);

    if (fs.existsSync(CATALOG_FILE)) {
      try {
        store.catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
        if (store.catalog.filter(normalizeProduct).length > 0) store.saveCatalog();
      } catch (err) {
        console.error('Error reading catalog:', err);
      }
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        store.data = Object.assign(emptyData(), JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
        return;
      } catch (e) {
        console.warn('Re-initializing database due to read error:', e.message);
      }
    }
    store.data = { ...emptyData(), ...createInitialData() };
    store.save();
  },

  save() {
    try {
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      // Encrypt measures at rest (HU-04, SCRUM-36): ensure serialized file does not carry plaintext measures
      const serialized = JSON.stringify(store.data, (key, value) => {
        if (key === 'measures' && value && typeof value === 'object') {
          return undefined;
        }
        return value;
      }, 2);
      writeFileAtomic(DB_FILE, serialized);
    } catch (err) {
      console.error('Database write error:', err);
    }
  },

  saveCatalog() {
    writeFileAtomic(CATALOG_FILE, JSON.stringify(store.catalog, null, 2) + '\n');
  }
};

module.exports = store;
