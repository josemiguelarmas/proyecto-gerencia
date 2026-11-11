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
