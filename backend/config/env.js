// Runtime configuration read from environment variables (secrets, paths, providers).
// Business rules stay in backend/config.js; this module only says where data lives and
// which secrets and providers to use. JWT_SECRET and DATA_ENCRYPTION_KEY are required
// unless NODE_ENV=test; the root server.js calls assertValid() and stops if they are missing.
// Note: require('./config') still resolves backend/config.js (a file wins over a folder),
// so this folder must never get an index.js.
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..');
const SEED_DIR = path.join(BACKEND_DIR, 'data', 'seed');
const DEFAULT_DATA_DIR = path.join(BACKEND_DIR, 'data', 'runtime');

const REQUIRED = ['JWT_SECRET', 'DATA_ENCRYPTION_KEY'];

function list(value) {
  return (value || '').split(',').map(s => s.trim()).filter(Boolean);
}

function load(source = process.env) {
  const nodeEnv = source.NODE_ENV || 'development';
  const dataDir = path.resolve(source.DATA_DIR || DEFAULT_DATA_DIR);
  return {
    NODE_ENV: nodeEnv,
    IS_TEST: nodeEnv === 'test',
    PORT: Number(source.PORT) || 3000,
    DATA_DIR: dataDir,
    SEED_DIR,
    // TCB_* override a single file (used by tests/api.test.js and the scripts).
    DB_FILE: source.TCB_DB_FILE || path.join(dataDir, 'db.json'),
    CATALOG_FILE: source.TCB_CATALOG_FILE || path.join(dataDir, 'catalog.json'),
    OUTBOX_FILE: source.TCB_OUTBOX_FILE || path.join(dataDir, 'outbox.json'),
    SEED_DB_FILE: path.join(SEED_DIR, 'db.json'),
    SEED_CATALOG_FILE: path.join(SEED_DIR, 'catalog.json'),
    JWT_SECRET: source.JWT_SECRET || '',
    // Session token life in hours (default 8).
    JWT_TTL_HOURS: Number(source.JWT_TTL_HOURS) > 0 ? Number(source.JWT_TTL_HOURS) : 8,
    DATA_ENCRYPTION_KEY: source.DATA_ENCRYPTION_KEY || '',
    ADMIN_EMAIL: source.ADMIN_EMAIL || '',
    ADMIN_PASSWORD: source.ADMIN_PASSWORD || '',
    STYLIST_EMAIL: source.STYLIST_EMAIL || '',
    STYLIST_PASSWORD: source.STYLIST_PASSWORD || '',
    WAREHOUSE_EMAIL: source.WAREHOUSE_EMAIL || '',
    WAREHOUSE_PASSWORD: source.WAREHOUSE_PASSWORD || '',
    // Optional password for the seeded demo client (no password means it cannot log in).
    DEMO_CLIENT_PASSWORD: source.DEMO_CLIENT_PASSWORD || '',
    CORS_ORIGINS: list(source.CORS_ORIGINS),
    PAYMENT_WEBHOOK_SECRET: source.PAYMENT_WEBHOOK_SECRET || '',
    POLICY_VERSION: source.POLICY_VERSION || 'v1.0',
    PROVIDERS: {
      payment: source.PAYMENT_PROVIDER || 'simulated',
      invoicing: source.INVOICING_PROVIDER || 'simulated',
      shipping: source.SHIPPING_PROVIDER || 'simulated',
      mail: source.MAIL_PROVIDER || 'simulated'
    }
  };
}

// Returns the names of the required variables that are missing (none in test mode).
function missingRequired(env) {
  if (env.IS_TEST) return [];
  return REQUIRED.filter(name => !env[name]);
}

function assertValid(env = module.exports) {
  const missing = missingRequired(env);
  if (missing.length === 0) return;
  const err = new Error(
    `Faltan variables de entorno obligatorias / Missing required environment variables: ${missing.join(', ')}.\n` +
    'Defínelas antes de arrancar (ver .env.example). En PowerShell:\n' +
    missing.map(name => `  $env:${name} = "<valor-secreto>"`).join('\n') +
    '\nPara las pruebas automáticas usa NODE_ENV=test.'
  );
  err.code = 'CONFIG_MISSING';
  err.missing = missing;
  throw err;
}

module.exports = { ...load(), load, missingRequired, assertValid, REQUIRED };
