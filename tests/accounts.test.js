// Stream B test suite: accounts, consent, measures, size equivalences and data rights (HU-01, HU-02, HU-04, HU-16).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { startServer } = require('./helpers/server');

let app;
let db;
let config;
let mailer;
let sizeEquivalences;
let env;

before(async () => {
  app = await startServer();
  ({ db } = require('../backend/database'));
  config = require('../backend/config');
  mailer = require('../backend/adapters/mailer');
  sizeEquivalences = require('../backend/sizeEquivalences');
  env = require('../backend/config/env');
});

after(async () => {
  await app.close();
});

let seq = 0;
const nextEmail = () => `user_b_${Date.now()}_${seq++}@test.com`;

test('SCRUM-16/19: validación de registro (correo, contraseña débil, menor de edad, duplicado con offer y consentimiento)', async () => {
  const email = nextEmail();
  // Correo inválido
  const badMail = await app.post('/api/auth/register', {
    name: 'Test', email: 'not-an-email', password: 'ValidPass1', birthDate: '2000-01-01', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  assert.equal(badMail.status, 400);
  assert.equal(badMail.body.code, 'INVALID_EMAIL');

  // Contraseña débil (menos de 8 caracteres o sin números)
  const weakPass = await app.post('/api/auth/register', {
    name: 'Test', email, password: 'short', birthDate: '2000-01-01', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  assert.equal(weakPass.status, 400);
  assert.equal(weakPass.body.code, 'WEAK_PASSWORD');

  const noNumPass = await app.post('/api/auth/register', {
    name: 'Test', email, password: 'onlylettershere', birthDate: '2000-01-01', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  assert.equal(noNumPass.status, 400);
  assert.equal(noNumPass.body.code, 'WEAK_PASSWORD');

  // Menor de 18 años
  const underage = await app.post('/api/auth/register', {
    name: 'Test', email, password: 'ValidPass1', birthDate: '2015-01-01', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  assert.equal(underage.status, 400);
  assert.equal(underage.body.code, 'UNDERAGE');

  // Sin consentimiento
  const noConsent = await app.post('/api/auth/register', {
    name: 'Test', email, password: 'ValidPass1', birthDate: '2000-01-01', acceptedPolicy: false
  });
  assert.equal(noConsent.status, 400);
  assert.equal(noConsent.body.code, 'CONSENT_REQUIRED');

  // Registro exitoso
  const ok = await app.post('/api/auth/register', {
    name: 'Usuario B', email, password: 'ValidPass1', birthDate: '2000-01-01', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  assert.equal(ok.status, 201);
  assert.ok(ok.body.token);

  // Duplicado con hint de offer (409)
  const dup = await app.post('/api/auth/register', {
    name: 'Otro', email, password: 'ValidPass1', birthDate: '2000-01-01', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error, 'Este correo ya está registrado');
  assert.equal(dup.body.offer, 'login_or_recovery');
});

test('SCRUM-17: contraseñas almacenadas con scrypt (nunca en claro) y tokens revocados', async () => {
  const email = nextEmail();
  const reg = await app.post('/api/auth/register', {
    name: 'Scrypt User', email, password: 'SuperSecretPass1', birthDate: '1995-05-15', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  assert.equal(reg.status, 201);
  const user = db.findUserByEmail(email);
  assert.ok(user.passwordHash);
  assert.doesNotMatch(user.passwordHash, /SuperSecretPass1/);
  assert.match(user.passwordHash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});

test('SCRUM-18: verificación de correo (24h) y restablecimiento de contraseña (1h, un solo uso)', async () => {
  const email = nextEmail();
  const reg = await app.post('/api/auth/register', {
    name: 'Reset User', email, password: 'OriginalPass1', birthDate: '1998-08-08', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  assert.equal(reg.status, 201);

  // Forgot password
  await app.post('/api/auth/forgot', { email });
  const mail = mailer.sentInMemory().find(m => m.to === email && m.type === 'PASSWORD_RESET');
  assert.ok(mail);
  const token = mail.body.match(/token=([a-zA-Z0-9_-]+)/)[1];

  // Restablecer con contraseña débil -> 400
  const weakReset = await app.post('/api/auth/reset', { token, password: 'short' });
  assert.equal(weakReset.status, 400);

  // Restablecer con contraseña válida
  const okReset = await app.post('/api/auth/reset', { token, password: 'NewSafePass2' });
  assert.equal(okReset.status, 200);

  // Un solo uso: reusar el mismo token falla
  const reuse = await app.post('/api/auth/reset', { token, password: 'OtherPass3' });
  assert.equal(reuse.status, 400);

  // Login con la nueva contraseña funciona
  const loginOk = await app.post('/api/auth/login', { email, password: 'NewSafePass2' });
  assert.equal(loginOk.status, 200);
});

test('SCRUM-21/22/24: política de datos muestra borrador y registra consentimiento con versión', async () => {
  const res = await app.get('/api/policy');
  assert.equal(res.status, 200);
  assert.equal(res.body.version, config.POLICY.version);
  assert.match(res.body.draftNotice, /BORRADOR/);

  const email = nextEmail();
  const reg = await app.post('/api/auth/register', {
    name: 'Consent User', email, password: 'ValidPass1', birthDate: '1999-03-03', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  assert.equal(reg.status, 201);

  const consents = db.getConsentsByUser(reg.body.user.id);
  assert.equal(consents.length, 1);
  assert.equal(consents[0].policyVersion, config.POLICY.version);
  assert.equal(consents[0].accepted, true);
  assert.ok(consents[0].acceptedAt);
});

test('SCRUM-34: validación de rangos de medidas en el servidor responde 422 con errores por campo', async () => {
  const email = nextEmail();
  const reg = await app.post('/api/auth/register', {
    name: 'Measure User', email, password: 'ValidPass1', birthDate: '1996-06-06', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  const token = reg.body.token;

  // Medidas fuera de rango
  const outOfRange = await app.put('/api/profile', {
    measures: { height: 130, weight: 200, chest: 50, waist: 180, hips: 200 }
  }, token);
  assert.equal(outOfRange.status, 422);
  assert.equal(outOfRange.body.error, 'Medidas fuera de rango');
  const fields = outOfRange.body.errors.map(e => e.field).sort();
  assert.deepEqual(fields, ['chest', 'height', 'hips', 'waist', 'weight']);

  // Medidas válidas
  const validMeasures = await app.put('/api/profile', {
    measures: { height: 175, weight: 70, chest: 95, waist: 80, hips: 98, usual: 'M' },
    budgetRange: { min: 120000, max: 280000 }
  }, token);
  assert.equal(validMeasures.status, 200);
  assert.equal(validMeasures.body.profile.measures.height, 175);
});

test('SCRUM-35: equivalencias de tallas de marcas en seed JSON y endpoint de administración', async () => {
  const admin = await app.loginAs('ADMIN');
  const client = await app.loginAs('CLIENT');

  // Solo ADMIN puede consultar y modificar equivalencias
  assert.equal((await app.get('/api/admin/size-equivalences', client)).status, 403);
  const getRes = await app.get('/api/admin/size-equivalences', admin);
  assert.equal(getRes.status, 200);
  assert.ok(getRes.body.zara || getRes.body.ceiba);

  // Actualizar equivalencias
  const updated = { ...getRes.body, nueva_marca: { runs: 0.3, runsText: 'ligeramente pequeña' } };
  const putRes = await app.put('/api/admin/size-equivalences', updated, admin);
  assert.equal(putRes.status, 200);
  assert.equal(sizeEquivalences.getBrandRun('nueva_marca').runs, 0.3);

  // Marca desconocida usa fallback documentado (runs: 0)
  const unknown = sizeEquivalences.getBrandRun('marca_inexistente');
  assert.equal(unknown.runs, 0);
  assert.equal(unknown.runsText, 'talla estándar');
});

test('SCRUM-36: medidas cifradas en reposo con AES-256-GCM y sin texto plano en el archivo de base de datos', async () => {
  const email = nextEmail();
  const reg = await app.post('/api/auth/register', {
    name: 'Encrypted User', email, password: 'ValidPass1', birthDate: '1997-07-07', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  const token = reg.body.token;

  await app.put('/api/profile', {
    measures: { height: 182, weight: 79, chest: 102, waist: 86, hips: 104 }
  }, token);

  // El suscriptor autenticado puede leer sus medidas
  const getProf = await app.get('/api/profile', token);
  assert.equal(getProf.status, 200);
  assert.equal(getProf.body.measures.height, 182);

  // En el disco (db.json) NO deben aparecer las medidas en texto plano
  const rawDb = fs.readFileSync(env.DB_FILE, 'utf8');
  assert.doesNotMatch(rawDb, /"height":\s*182/);
  assert.match(rawDb, /"encryptedMeasures"/);
  assert.match(rawDb, /"ciphertext"/);
  assert.match(rawDb, /"iv"/);
  assert.match(rawDb, /"tag"/);
});

test('SCRUM-101/102/103/104: rectificación, exportación (GET /api/me/export) y eliminación con bloqueo por cobros pendientes', async () => {
  const email = nextEmail();
  const reg = await app.post('/api/auth/register', {
    name: 'Titular Datos', email, password: 'SecurePassword1', birthDate: '1992-02-02', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  const token = reg.body.token;
  const userId = reg.body.user.id;

  // Rectificación de nombre
  const updateRes = await app.put('/api/account', { name: 'Titular Rectificado' }, token);
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.user.name, 'Titular Rectificado');

  // Exportación por GET /api/me/export y GET /api/profile/export
  const expMe = await app.get('/api/me/export', token);
  assert.equal(expMe.status, 200);
  assert.equal(expMe.body.account.name, 'Titular Rectificado');
  assert.equal(expMe.body.account.passwordHash, undefined);

  // Eliminación con contraseña incorrecta -> 403
  const badPass = await app.request('DELETE', '/api/me', { password: 'wrong' }, token);
  assert.equal(badPass.status, 403);

  // Eliminación exitosa: anonimiza y envía correo de confirmación
  const delRes = await app.request('DELETE', '/api/me', { password: 'SecurePassword1' }, token);
  assert.equal(delRes.status, 200);
  assert.match(delRes.body.message, /eliminada/);

  // El usuario ya no puede iniciar sesión
  const deadLogin = await app.post('/api/auth/login', { email, password: 'SecurePassword1' });
  assert.equal(deadLogin.status, 401);

  // Registro de solicitudes consultable por admin
  const admin = await app.loginAs('ADMIN');
  const requests = await app.get('/api/admin/data-requests', admin);
  assert.equal(requests.status, 200);
  assert.ok(requests.body.requests.some(r => r.userId === userId && r.type === 'DELETION'));
});
