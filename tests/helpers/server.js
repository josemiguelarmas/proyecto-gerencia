// Boots the real backend for one test file: ephemeral port (0), its own temporary data
// folder seeded from scratch, and NODE_ENV=test. node --test runs each file in its own
// process, so the backend singletons (db, mail) belong to that file only. Call startServer()
// before requiring any backend module that reads data paths, and only once per file.
//
// Privileged users: there are no passwords in the code, so the helper sets ADMIN_*,
// STYLIST_*, WAREHOUSE_* and DEMO_CLIENT_PASSWORD with random per-run passwords before the
// backend loads (pass { privileged: false } to boot without them). Use app.loginAs('ADMIN'),
// app.loginAs('STYLIST'), app.loginAs('WAREHOUSE') or app.loginAs('CLIENT') (the demo client)
// to get a token, or read the credentials from TEST_USERS.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createClient } = require('./http');

const RUN_PASSWORD = () => `Prueba-${crypto.randomBytes(6).toString('hex')}-1`;

const TEST_USERS = {
  ADMIN: { email: 'admin@test.theclothesbox.co', password: RUN_PASSWORD(), emailVar: 'ADMIN_EMAIL', passwordVar: 'ADMIN_PASSWORD' },
  STYLIST: { email: 'estilista@test.theclothesbox.co', password: RUN_PASSWORD(), emailVar: 'STYLIST_EMAIL', passwordVar: 'STYLIST_PASSWORD' },
  WAREHOUSE: { email: 'bodega@test.theclothesbox.co', password: RUN_PASSWORD(), emailVar: 'WAREHOUSE_EMAIL', passwordVar: 'WAREHOUSE_PASSWORD' },
  CLIENT: { email: 'demo@theclothesbox.co', password: RUN_PASSWORD(), passwordVar: 'DEMO_CLIENT_PASSWORD' }
};

let running = null;

async function startServer({ privileged = true } = {}) {
  if (running) return running;

  // An empty DATA_DIR makes the backend create db.json and catalog.json from backend/data/seed/.
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcb-node-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DATA_DIR = dataDir;
  ['TCB_DB_FILE', 'TCB_OUTBOX_FILE', 'TCB_CATALOG_FILE'].forEach(name => delete process.env[name]);
  Object.values(TEST_USERS).forEach(user => {
    if (user.emailVar) delete process.env[user.emailVar];
    delete process.env[user.passwordVar];
    if (!privileged) return;
    if (user.emailVar) process.env[user.emailVar] = user.email;
    process.env[user.passwordVar] = user.password;
  });

  const backend = require('../../backend/server');
  const server = await backend.startServer(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const client = createClient(baseUrl);

  async function loginAs(role) {
    const user = TEST_USERS[role];
    const res = await client.post('/api/auth/login', { email: user.email, password: user.password });
    if (res.status !== 200) throw new Error(`loginAs(${role}) falló: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.token;
  }

  async function close() {
    if (!running) return;
    running = null;
    server.closeAllConnections();
    await new Promise(resolve => server.close(() => resolve()));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  running = { port, baseUrl, dataDir, close, loginAs, ...client };
  return running;
}

module.exports = { startServer, TEST_USERS };
