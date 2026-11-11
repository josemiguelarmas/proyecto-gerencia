// Boots the real backend for one test file: ephemeral port (0), its own temporary data
// folder seeded from scratch, and NODE_ENV=test. node --test runs each file in its own
// process, so the backend singletons (db, mail) belong to that file only. Call startServer()
// before requiring any backend module that reads data paths, and only once per file.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createClient } = require('./http');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CATALOG_SOURCE = path.join(REPO_ROOT, 'backend', 'data', 'catalog.json');

let running = null;

async function startServer() {
  if (running) return running;

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcb-node-test-'));
  process.env.NODE_ENV = 'test';
  process.env.TCB_DB_FILE = path.join(dataDir, 'db.json');
  process.env.TCB_OUTBOX_FILE = path.join(dataDir, 'outbox.json');
  process.env.TCB_CATALOG_FILE = path.join(dataDir, 'catalog.json');
  fs.copyFileSync(CATALOG_SOURCE, process.env.TCB_CATALOG_FILE);

  const backend = require('../../backend/server');
  const server = await backend.startServer(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function close() {
    if (!running) return;
    running = null;
    server.closeAllConnections();
    await new Promise(resolve => server.close(() => resolve()));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  running = { port, baseUrl, dataDir, close, ...createClient(baseUrl) };
  return running;
}

module.exports = { startServer };
