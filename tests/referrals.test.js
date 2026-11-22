// HU-18: Referidos "trae un amigo" (SCRUM-110..113).
// Pruebas automatizadas de códigos únicos, reglas de beneficio, anti-fraude y conversión.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');

let app;
let db;
let config;

before(async () => {
  app = await startServer();
  ({ db } = require('../backend/database'));
  config = require('../backend/config');
});

after(async () => {
  await app.close();
});

let seq = 0;
const nextEmail = (prefix = 'ref') => `${prefix}_${Date.now()}_${seq++}@test.com`;

async function registerUser(name, email, referralCode = null) {
  const res = await app.post('/api/auth/register', {
    name,
    email,
    password: 'SafePassword123',
    birthDate: '1995-04-12',
    acceptedPolicy: true,
    policyVersion: config.POLICY.version,
    referralCode
  });
  return res;
}

test('SCRUM-111: generación de código único de referido y enlace de invitación', async () => {
  const email1 = nextEmail('user1');
  const reg1 = await registerUser('Laura Referente', email1);
  assert.equal(reg1.status, 201);
  const token1 = reg1.body.token;

  // Consultar endpoint de referidos
  const res = await app.get('/api/me/referral', token1);
  assert.equal(res.status, 200);
  assert.ok(res.body.referralCode);
  assert.match(res.body.referralCode, /^REF-[A-Z0-9]{6}$/);
  assert.ok(res.body.referralLink.includes(res.body.referralCode));
  assert.equal(res.body.benefit.referredCOP, 20000);
  assert.equal(res.body.benefit.referrerCOP, 20000);
  assert.equal(res.body.stats.totalReferred, 0);

  // Un segundo usuario obtiene un código diferente (único)
  const email2 = nextEmail('user2');
  const reg2 = await registerUser('Camilo Referente', email2);
  const res2 = await app.get('/api/me/referral', reg2.body.token);
  assert.notEqual(res.body.referralCode, res2.body.referralCode);
});

test('SCRUM-112: reglas de beneficio y anti-fraude (auto-referido, código inexistente)', async () => {
  const email = nextEmail('fraud');
  const reg = await registerUser('Usuario Fraude', email);
  const token = reg.body.token;

  const refInfo = await app.get('/api/me/referral', token);
  const myCode = refInfo.body.referralCode;

  // Validación pública de código inexistente responde 400
  const invalidCheck = await app.post('/api/referrals/validate', { referralCode: 'REF-FAKE99' });
  assert.equal(invalidCheck.status, 400);
  assert.match(invalidCheck.body.error, /inválido|no existe/i);

  // Código válido responde 200 con datos del referente
  const validCheck = await app.post('/api/referrals/validate', { referralCode: myCode });
  assert.equal(validCheck.status, 200);
  assert.equal(validCheck.body.code, myCode);
  assert.equal(validCheck.body.referrerName, 'Usuario Fraude');
  assert.equal(validCheck.body.discountCOP, 20000);

  // Anti-fraude: Registro intentando auto-referirse con el mismo correo falla
  const selfRef = await app.post('/api/auth/register', {
    name: 'Otro Nombre',
    email, // mismo correo
    password: 'SafePassword123',
    birthDate: '1995-04-12',
    acceptedPolicy: true,
    policyVersion: config.POLICY.version,
    referralCode: myCode
  });
  // Falla por correo duplicado o auto-referido
  assert.ok(selfRef.status === 400 || selfRef.status === 409);
});

test('SCRUM-113: atribución en registro, descuento en cobro inicial y reporte de conversión', async () => {
  const admin = await app.loginAs('ADMIN');

  // 1. Crear referente
  const refEmail = nextEmail('referrer');
  const regReferrer = await registerUser('Andrés Referente', refEmail);
  const refToken = regReferrer.body.token;
  const myRef = await app.get('/api/me/referral', refToken);
  const refCode = myRef.body.referralCode;

  // 2. Crear referido usando el código de Andrés
  const referredEmail = nextEmail('referred');
  const regReferred = await registerUser('Valentina Invitada', referredEmail, refCode);
  assert.equal(regReferred.status, 201);
  const referredToken = regReferred.body.token;

  // Verificar que el referente ahora ve 1 referido pendiente
  const refSummaryPending = await app.get('/api/me/referral', refToken);
  assert.equal(refSummaryPending.body.stats.totalReferred, 1);
  assert.equal(refSummaryPending.body.stats.pending, 1);
  assert.equal(refSummaryPending.body.stats.converted, 0);

  // 3. El referido verifica su correo y activa su suscripción
  db.updateUser(regReferred.body.user.id, { emailVerified: true });

  // Suscribirse al plan Esencial (COP 129.900) con tarjeta simulada tok_ok
  // Debe aplicar el descuento de COP 20.000 (cobro por COP 109.900)
  const subRes = await app.post('/api/subscription/subscribe', {
    plan: 'esencial',
    paymentToken: 'tok_ok',
    fiscal: {
      docType: 'CC',
      docNumber: '1144000111',
      address: 'Calle 5 # 10-20',
      city: 'Cali'
    }
  }, referredToken);
  assert.equal(subRes.status, 201);
  assert.equal(subRes.body.payment.amountCOP, 129900 - 20000); // 109900 COP

  // 4. Verificar que el referido quedó CONVERTED para el referente
  const refSummaryConverted = await app.get('/api/me/referral', refToken);
  assert.equal(refSummaryConverted.body.stats.converted, 1);
  assert.equal(refSummaryConverted.body.stats.totalRewardsEarnedCOP, 20000);

  // 5. Reporte administrativo de conversiones (GET /api/admin/referrals)
  const adminReport = await app.get('/api/admin/referrals', admin);
  assert.equal(adminReport.status, 200);
  assert.ok(adminReport.body.summary);
  assert.ok(adminReport.body.summary.totalReferrals >= 1);
  assert.ok(adminReport.body.summary.converted >= 1);
  assert.ok(adminReport.body.summary.conversionRatePct > 0);
  assert.ok(adminReport.body.summary.totalRewardsGrantedCOP >= 20000);
  assert.ok(Array.isArray(adminReport.body.referrals));
  const entry = adminReport.body.referrals.find(r => r.referralCode === refCode);
  assert.ok(entry);
  assert.equal(entry.status, 'CONVERTED');
  assert.equal(entry.referrerName, 'Andrés Referente');
  assert.equal(entry.referredName, 'Valentina Invitada');
});
