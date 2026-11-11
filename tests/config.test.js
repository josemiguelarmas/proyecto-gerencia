// F2/F3: environment configuration and data hygiene. Checks the defaults of backend/config/env.js,
// the fail-fast rule for secrets, that `node server.js` boots only with them, and that the
// committed seed carries no passwords.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const env = require('../backend/config/env');

const ROOT = path.join(__dirname, '..');

test('sin variables, DATA_DIR apunta a backend/data/runtime y los archivos viven ahí', () => {
  const cfg = env.load({});
  assert.equal(cfg.DATA_DIR, path.join(ROOT, 'backend', 'data', 'runtime'));
  assert.equal(cfg.DB_FILE, path.join(cfg.DATA_DIR, 'db.json'));
  assert.equal(cfg.CATALOG_FILE, path.join(cfg.DATA_DIR, 'catalog.json'));
  assert.equal(cfg.OUTBOX_FILE, path.join(cfg.DATA_DIR, 'outbox.json'));
  assert.equal(cfg.SEED_CATALOG_FILE, path.join(ROOT, 'backend', 'data', 'seed', 'catalog.json'));
  assert.equal(cfg.PORT, 3000);
  assert.equal(cfg.POLICY_VERSION, 'v1.0');
  assert.deepEqual(cfg.PROVIDERS, { payment: 'simulated', invoicing: 'simulated', shipping: 'simulated', mail: 'simulated' });
});

test('las variables TCB_* y *_PROVIDER siguen funcionando', () => {
  const cfg = env.load({ DATA_DIR: 'x', TCB_DB_FILE: '/tmp/a.json', TCB_OUTBOX_FILE: '/tmp/o.json', MAIL_PROVIDER: 'otro', CORS_ORIGINS: 'http://a.co, http://b.co' });
  assert.equal(cfg.DB_FILE, '/tmp/a.json');
  assert.equal(cfg.OUTBOX_FILE, '/tmp/o.json');
  assert.equal(cfg.CATALOG_FILE, path.join(path.resolve('x'), 'catalog.json'));
  assert.equal(cfg.PROVIDERS.mail, 'otro');
  assert.deepEqual(cfg.CORS_ORIGINS, ['http://a.co', 'http://b.co']);
});

test('JWT_SECRET y DATA_ENCRYPTION_KEY son obligatorios salvo con NODE_ENV=test', () => {
  assert.deepEqual(env.missingRequired(env.load({})), ['JWT_SECRET', 'DATA_ENCRYPTION_KEY']);
  assert.deepEqual(env.missingRequired(env.load({ JWT_SECRET: 's' })), ['DATA_ENCRYPTION_KEY']);
  assert.deepEqual(env.missingRequired(env.load({ NODE_ENV: 'test' })), []);
  assert.throws(() => env.assertValid(env.load({ NODE_ENV: 'production' })), err => {
    assert.equal(err.code, 'CONFIG_MISSING');
    assert.match(err.message, /Faltan variables de entorno obligatorias/);
    assert.match(err.message, /\$env:JWT_SECRET/);
    return true;
  });
  assert.doesNotThrow(() => env.assertValid(env.load({ JWT_SECRET: 'a', DATA_ENCRYPTION_KEY: 'b' })));
});

function freePort() {
  return new Promise(resolve => {
    const srv = net.createServer().listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Runs `node server.js` with the given variables and resolves on exit or once it is listening.
function runRootServer(vars) {
  const childEnv = { ...process.env, ...vars };
  delete childEnv.NODE_ENV;
  ['JWT_SECRET', 'DATA_ENCRYPTION_KEY', 'TCB_DB_FILE', 'TCB_OUTBOX_FILE', 'TCB_CATALOG_FILE'].forEach(name => {
    if (!(name in vars)) delete childEnv[name];
  });
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: childEnv });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`sin respuesta: ${output}`)); }, 15000);
    const onData = chunk => {
      output += chunk;
      if (/corriendo en http:\/\/localhost:\d+/.test(output)) {
        clearTimeout(timer);
        child.kill();
        resolve({ listening: true, output });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', code => {
      clearTimeout(timer);
      resolve({ listening: false, code, output });
    });
  });
}

test('node server.js se detiene con código 1 y mensaje claro si faltan los secretos', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcb-boot-'));
  const result = await runRootServer({ DATA_DIR: dataDir, PORT: String(await freePort()) });
  assert.equal(result.listening, false);
  assert.equal(result.code, 1);
  assert.match(result.output, /JWT_SECRET, DATA_ENCRYPTION_KEY/);
  assert.equal(fs.readdirSync(dataDir).length, 0, 'no toca los datos antes de validar');
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('node server.js arranca solo con variables de entorno y crea DATA_DIR desde seed/', async () => {
  const dataDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tcb-boot-')), 'runtime');
  const port = await freePort();
  const result = await runRootServer({ DATA_DIR: dataDir, PORT: String(port), JWT_SECRET: 'secreto-de-prueba', DATA_ENCRYPTION_KEY: 'clave-de-prueba' });
  assert.equal(result.listening, true, result.output);
  assert.match(result.output, new RegExp(`localhost:${port}`));
  assert.ok(fs.existsSync(path.join(dataDir, 'db.json')));
  assert.ok(fs.existsSync(path.join(dataDir, 'catalog.json')));
  fs.rmSync(path.dirname(dataDir), { recursive: true, force: true });
});

test('la semilla versionada no trae contraseñas ni datos de usuarios de prueba', () => {
  const seed = JSON.parse(fs.readFileSync(env.SEED_DB_FILE, 'utf8'));
  assert.ok(seed.users.length > 0);
  seed.users.forEach(u => assert.equal(u.passwordHash, undefined, `${u.email} trae contraseña`));
  assert.ok(seed.users.every(u => !/^test_/.test(u.email)));
  assert.ok(!('subscriptions' in seed) || seed.subscriptions.every(s => !s.paymentToken));
});

test('.gitignore deja fuera los datos de ejecución y .env', () => {
  const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/);
  ['backend/data/runtime/', 'backend/data/db.json', '.env'].forEach(entry => assert.ok(ignore.includes(entry), `falta ${entry}`));
});
