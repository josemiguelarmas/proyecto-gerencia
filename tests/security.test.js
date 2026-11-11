// F5: security baseline. Session tokens (signature, expiry, issuer/audience, revocation),
// privileged users seeded only from env, CORS allow-list, body limits, login rate limit,
// security headers, central validators and role guards.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Known secret so the tests can craft tokens with a wrong issuer or audience.
const JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = JWT_SECRET;

const { startServer } = require('./helpers/server');
const { clock } = require('./helpers/clock');

let app;
let config;

before(async () => {
  app = await startServer();
  config = require('../backend/config');
});

after(async () => {
  clock.reset();
  await app.close();
});

function registration(email, overrides = {}) {
  return {
    name: 'Cliente Seguridad',
    email,
    password: 'clave-segura-1',
    birthDate: '2000-05-20',
    acceptedPolicy: true,
    policyVersion: config.POLICY.version,
    ...overrides
  };
}

let counter = 0;
async function newClient() {
  const email = `sec_${Date.now()}_${counter++}@example.test`;
  const res = await app.post('/api/auth/register', registration(email));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { email, token: res.body.token, userId: res.body.user.id };
}

function craftToken(payload, secret = JWT_SECRET) {
  const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = enc({ alg: 'HS256', typ: 'JWT' });
  const body = enc(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function claims(userId, overrides = {}) {
  const iat = Math.floor(Date.now() / 1000);
  return { userId, tv: 0, iss: 'the-clothes-box', aud: 'the-clothes-box-spa', iat, exp: iat + 3600, ...overrides };
}

function outbox() {
  const file = path.join(app.dataDir, 'outbox.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

// ---------- JWT ----------

test('un token con la firma alterada o firmado con otro secreto se rechaza', async () => {
  const c = await newClient();
  assert.equal((await app.get('/api/auth/me', c.token)).status, 200);

  const [header, body, sig] = c.token.split('.');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  const tamperedBody = Buffer.from(JSON.stringify({ ...payload, userId: 'usr_otro' })).toString('base64url');
  assert.equal((await app.get('/api/auth/me', `${header}.${tamperedBody}.${sig}`)).status, 401);

  const flipped = sig.slice(0, -2) + (sig.slice(-2) === 'AA' ? 'BB' : 'AA');
  assert.equal((await app.get('/api/auth/me', `${header}.${body}.${flipped}`)).status, 401);

  const otherSecret = craftToken(claims(c.userId), 'otro-secreto');
  assert.equal((await app.get('/api/auth/me', otherSecret)).status, 401);

  const noneAlg = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${body}.`;
  assert.equal((await app.get('/api/auth/me', noneAlg)).status, 401);
});

test('el token vence a las 8 horas según el reloj inyectado', async () => {
  clock.set(Date.now());
  try {
    const c = await newClient();
    const payload = JSON.parse(Buffer.from(c.token.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(payload.exp - payload.iat, 8 * 3600);
    clock.advance(8 * 3600 * 1000 - 5000);
    assert.equal((await app.get('/api/auth/me', c.token)).status, 200);
    clock.advance(10000);
    assert.equal((await app.get('/api/auth/me', c.token)).status, 401);
  } finally {
    clock.reset();
  }
});

test('un token con emisor o audiencia equivocados se rechaza', async () => {
  const c = await newClient();
  assert.equal((await app.get('/api/auth/me', craftToken(claims(c.userId)))).status, 200, 'control: token bien formado');
  assert.equal((await app.get('/api/auth/me', craftToken(claims(c.userId, { aud: 'otra-app' })))).status, 401);
  assert.equal((await app.get('/api/auth/me', craftToken(claims(c.userId, { iss: 'otro-emisor' })))).status, 401);
  const { exp, ...noExp } = claims(c.userId);
  assert.equal((await app.get('/api/auth/me', craftToken(noExp))).status, 401, 'sin exp no hay token válido');
});

test('restablecer la contraseña revoca los tokens emitidos antes', async () => {
  const c = await newClient();
  assert.equal((await app.post('/api/auth/forgot', { email: c.email })).status, 200);
  const mail = outbox().filter(m => m.to === c.email && m.type === 'PASSWORD_RESET').pop();
  const resetToken = mail.body.match(/token=([a-f0-9]+)/)[1];
  assert.equal((await app.post('/api/auth/reset', { token: resetToken, password: 'nueva-clave-2' })).status, 200);

  assert.equal((await app.get('/api/auth/me', c.token)).status, 401, 'el token viejo ya no sirve');
  const login = await app.post('/api/auth/login', { email: c.email, password: 'nueva-clave-2' });
  assert.equal(login.status, 200);
  assert.equal((await app.get('/api/auth/me', login.body.token)).status, 200);
});

test('cerrar sesión revoca el token en el servidor', async () => {
  const c = await newClient();
  assert.equal((await app.post('/api/auth/logout', {}, c.token)).status, 200);
  assert.equal((await app.get('/api/auth/me', c.token)).status, 401);
});

// ---------- Privileged users from env ----------

test('sin variables de entorno no se siembra ningún administrador ni estilista', () => {
  const { seedPrivilegedUsers } = require('../backend/repos/bootstrap');
  const data = { users: [{ id: 'usr_demo_01', email: 'demo@theclothesbox.co', role: 'CLIENT' }] };
  assert.deepEqual(seedPrivilegedUsers(data, {}), []);
  assert.deepEqual(seedPrivilegedUsers(data, { ADMIN_EMAIL: 'a@b.co' }), [], 'sin contraseña tampoco');
  assert.equal(data.users.length, 1);
  assert.ok(!data.users.some(u => u.role === 'ADMIN' || u.role === 'STYLIST'));
});

test('con variables de entorno se siembran ADMIN, STYLIST y WAREHOUSE solo si no existen', () => {
  const { seedPrivilegedUsers } = require('../backend/repos/bootstrap');
  const { verifyPassword } = require('../backend/lib/crypto');
  const existing = { id: 'usr_x', email: 'jefa@tcb.co', role: 'CLIENT', passwordHash: 'sal:hash' };
  const data = { users: [existing] };
  const source = {
    ADMIN_EMAIL: 'Jefa@tcb.co', ADMIN_PASSWORD: 'otra-clave-1',
    STYLIST_EMAIL: 'est@tcb.co', STYLIST_PASSWORD: 'clave-est-1',
    WAREHOUSE_EMAIL: 'bod@tcb.co', WAREHOUSE_PASSWORD: 'clave-bod-1'
  };
  const created = seedPrivilegedUsers(data, source);
  assert.deepEqual(created.map(u => u.role), ['STYLIST', 'WAREHOUSE']);
  assert.equal(existing.role, 'CLIENT', 'una cuenta existente nunca se escala ni se sobrescribe');
  assert.equal(existing.passwordHash, 'sal:hash');
  assert.ok(verifyPassword('clave-est-1', created[0].passwordHash));
  assert.deepEqual(seedPrivilegedUsers(data, source), [], 'la segunda vez no crea nada');
});

test('el servidor de prueba entra con las cuentas sembradas por el helper', async () => {
  for (const role of ['ADMIN', 'STYLIST', 'WAREHOUSE', 'CLIENT']) {
    const token = await app.loginAs(role);
    const me = await app.get('/api/auth/me', token);
    assert.equal(me.body.user.role, role);
  }
});

// ---------- CORS, body size, headers ----------

test('CORS: un origen no permitido no recibe Access-Control-Allow-Origin y nunca hay comodín', async () => {
  const evil = await app.request('GET', '/api/products', null, null, { Origin: 'http://evil.example' });
  assert.equal(evil.status, 200);
  assert.equal(evil.headers['access-control-allow-origin'], undefined);

  const preflight = await app.request('OPTIONS', '/api/auth/login', null, null, { Origin: 'http://evil.example', 'Access-Control-Request-Method': 'POST' });
  assert.equal(preflight.headers['access-control-allow-origin'], undefined);

  const allowed = await app.request('GET', '/api/products', null, null, { Origin: 'http://localhost:3000' });
  assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:3000');
  const sameOrigin = await app.request('GET', '/api/config', null, null, { Origin: app.baseUrl });
  assert.equal(sameOrigin.headers['access-control-allow-origin'], app.baseUrl);
  assert.notEqual(allowed.headers['access-control-allow-origin'], '*');
});

test('un cuerpo de más de 100 KB recibe 413 con mensaje en español', async () => {
  const big = { email: 'x@example.test', password: 'a'.repeat(150 * 1024) };
  const res = await app.post('/api/auth/login', big);
  assert.equal(res.status, 413);
  assert.match(res.body.error, /demasiado grande/);
  assert.equal((await app.get('/api/config')).status, 200, 'el servidor sigue atendiendo');
});

test('la importación CSV acepta hasta 2 MB y rechaza más con 413', async () => {
  const admin = await app.loginAs('ADMIN');
  const header = 'sku,name\n';
  const medium = await app.post('/api/admin/products/import', { csv: header + 'x'.repeat(500 * 1024) }, admin);
  assert.notEqual(medium.status, 413, 'medio mega pasa el límite de la importación');
  const huge = await app.post('/api/admin/products/import', { csv: header + 'x'.repeat(2.5 * 1024 * 1024) }, admin);
  assert.equal(huge.status, 413);
});

test('las cabeceras de seguridad están en la API y en la SPA', async () => {
  for (const res of [await app.get('/api/config'), await app.get('/')]) {
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.ok(res.headers['referrer-policy']);
    const csp = res.headers['content-security-policy'];
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'(;|$)/, 'sin scripts en línea');
    assert.match(csp, /frame-ancestors 'none'/);
  }
});

test('la SPA no usa manejadores de eventos en línea que la CSP bloquearía', () => {
  const dir = path.join(__dirname, '..', 'frontend');
  const files = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(js|html)$/.test(e.name)) files.push(full);
    });
  })(dir);
  files.forEach(file => {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /\son(error|click|load|submit|change|input)\s*=\s*["']/, file);
    if (file.endsWith('.html')) assert.doesNotMatch(text, /<script>(?!<\/script>)/, `${file}: script en línea`);
  });
});

// ---------- Login rate limit ----------

test('el 6.º intento fallido en 15 minutos da 429 y el bloqueo se levanta pasado ese tiempo', async () => {
  const c = await newClient();
  clock.set(Date.now());
  try {
    for (let i = 1; i <= 5; i++) {
      const res = await app.post('/api/auth/login', { email: c.email, password: `mala-${i}` });
      assert.equal(res.status, 401, `intento ${i}`);
    }
    const blocked = await app.post('/api/auth/login', { email: c.email, password: 'clave-segura-1' });
    assert.equal(blocked.status, 429, 'bloqueado aunque ahora la clave sea correcta');
    assert.match(blocked.body.error, /Demasiados intentos/);

    const other = await newClient();
    assert.equal((await app.post('/api/auth/login', { email: other.email, password: 'clave-segura-1' })).status, 200, 'otro correo no se bloquea');

    clock.advance(15 * 60 * 1000 + 1000);
    const after15 = await app.post('/api/auth/login', { email: c.email, password: 'clave-segura-1' });
    assert.equal(after15.status, 200);
  } finally {
    clock.reset();
  }
});

test('un inicio de sesión correcto limpia el contador de fallos', async () => {
  const c = await newClient();
  for (let i = 0; i < 4; i++) await app.post('/api/auth/login', { email: c.email, password: 'mala' });
  assert.equal((await app.post('/api/auth/login', { email: c.email, password: 'clave-segura-1' })).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await app.post('/api/auth/login', { email: c.email, password: 'mala' })).status, 401);
});

// ---------- Roles ----------

test('requireRole lanza 403 cuando el rol no está en la lista', () => {
  const { requireRole, ROLES } = require('../backend/auth');
  assert.deepEqual(Object.keys(ROLES).sort(), ['ADMIN', 'CLIENT', 'STYLIST', 'WAREHOUSE']);
  const guard = requireRole('WAREHOUSE', 'ADMIN');
  assert.doesNotThrow(() => guard({ role: 'WAREHOUSE' }));
  assert.doesNotThrow(() => guard({ role: 'ADMIN' }));
  assert.throws(() => guard({ role: 'CLIENT' }), err => err.status === 403);
  assert.throws(() => guard(null), err => err.status === 403);
});

test('un CLIENT recibe 403 en rutas de administración y de bodega', async () => {
  const c = await newClient();
  for (const url of ['/api/admin/metrics', '/api/admin/outbox', '/api/admin/dispatch', '/api/admin/boxes', '/api/admin/inventory-movements', '/api/stylist/queue']) {
    assert.equal((await app.get(url, c.token)).status, 403, url);
  }
  assert.equal((await app.post('/api/admin/boxes/box_003/status', { status: 'DELIVERED' }, c.token)).status, 403);
});

test('WAREHOUSE entra a despacho pero no al resto del panel; STYLIST no entra a despacho', async () => {
  const warehouse = await app.loginAs('WAREHOUSE');
  for (const url of ['/api/admin/dispatch', '/api/admin/boxes', '/api/admin/inventory-movements']) {
    assert.equal((await app.get(url, warehouse)).status, 200, url);
  }
  for (const url of ['/api/admin/metrics', '/api/admin/clients', '/api/admin/payments', '/api/stylist/queue']) {
    assert.equal((await app.get(url, warehouse)).status, 403, url);
  }
  const stylist = await app.loginAs('STYLIST');
  assert.equal((await app.get('/api/admin/dispatch', stylist)).status, 403);
  const admin = await app.loginAs('ADMIN');
  assert.equal((await app.get('/api/admin/dispatch', admin)).status, 200);
});
