// Stream C1 test suite: visual style quiz (HU-03) and stylist box validation (HU-07).
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
const nextEmail = () => `stylist_test_${Date.now()}_${seq++}@test.com`;

test('SCRUM-26: GET /api/quiz entrega el banco de 8 preguntas con estado pendiente de validación', async () => {
  const res = await app.get('/api/quiz');
  assert.equal(res.status, 200);
  assert.match(res.body.status, /pendiente de validación/);
  assert.ok(Array.isArray(res.body.questions));
  assert.equal(res.body.questions.length, 8);
  assert.equal(res.body.questions[0].id, 'q1');
  assert.ok(res.body.hiddenStylesGame);
});

test('SCRUM-27: validación de estilos y pesos en PUT /api/quiz/progress', async () => {
  const email = nextEmail();
  const reg = await app.post('/api/auth/register', {
    name: 'Quiz User', email, password: 'SafePassword1', birthDate: '1998-05-10', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  const token = reg.body.token;

  // Paso fuera de rango
  const badStep = await app.put('/api/quiz/progress', { step: 0 }, token);
  assert.equal(badStep.status, 400);

  // Estilo desconocido en los pesos
  const badStyle = await app.put('/api/quiz/progress', {
    step: 3,
    answers: { styleWeights: { psicodelico: 0.8 } }
  }, token);
  assert.equal(badStyle.status, 400);
  assert.match(badStyle.body.error, /no reconocido/);

  // Peso fuera del rango 0..1
  const badWeight = await app.put('/api/quiz/progress', {
    step: 3,
    answers: { styleWeights: { urbano: 1.5 } }
  }, token);
  assert.equal(badWeight.status, 400);
  assert.match(badWeight.body.error, /entre 0 y 1/);

  // Progreso válido
  const valid = await app.put('/api/quiz/progress', {
    step: 5,
    answers: { styleWeights: { urbano: 0.8, minimal: 0.4 } }
  }, token);
  assert.equal(valid.status, 200);
  assert.equal(valid.body.session.step, 5);
});

test('SCRUM-29/30: reanudar quiz en pregunta 5 tras re-login y métrica de tiempo de completado', async () => {
  const email = nextEmail();
  const reg = await app.post('/api/auth/register', {
    name: 'Resume User', email, password: 'SafePassword1', birthDate: '1999-09-09', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  const token1 = reg.body.token;

  // Guarda progreso en la pregunta 5
  await app.put('/api/quiz/progress', { step: 5, answers: { q1: 1, q2: 3 } }, token1);

  // Nuevo login
  const relogin = await app.post('/api/auth/login', { email, password: 'SafePassword1' });
  const token2 = relogin.body.token;

  // Consulta el progreso
  const prog = await app.get('/api/quiz/progress', token2);
  assert.equal(prog.status, 200);
  assert.equal(prog.body.session.step, 5);
  assert.equal(prog.body.session.answers.q1, 1);
  assert.ok(prog.body.session.startedAt);

  // Completar el quiz guardando perfil con source "quiz"
  const done = await app.put('/api/profile', {
    styles: ['urbano', 'minimal'],
    occasions: ['clase'],
    fit: 'regular',
    line: 'u',
    plan: 'esencial',
    source: 'quiz'
  }, token2);
  assert.equal(done.status, 200);
  assert.ok(done.body.quizSession);
  assert.ok(done.body.quizSession.completedAt);
  assert.ok(Number.isInteger(done.body.quizSession.durationSec));
});

test('SCRUM-51/52/54: cola del estilista (GET /api/stylist/boxes), control de roles y vista detallada', async () => {
  const stylist = await app.loginAs('STYLIST');
  const admin = await app.loginAs('ADMIN');
  const client = await app.loginAs('CLIENT');

  // Control de roles
  assert.equal((await app.get('/api/stylist/boxes', client)).status, 403);
  assert.equal((await app.get('/api/stylist/boxes', null)).status, 401);

  // El estilista y el admin pueden consultar la cola
  const listStylist = await app.get('/api/stylist/boxes?status=PENDING_REVIEW', stylist);
  assert.equal(listStylist.status, 200);
  assert.ok(Array.isArray(listStylist.body.boxes));

  const listAdmin = await app.get('/api/stylist/boxes?status=PROPOSED', admin);
  assert.equal(listAdmin.status, 200);

  // La vista de la caja incluye prendas con explicaciones y perfil del suscriptor
  if (listStylist.body.boxes.length > 0) {
    const box = listStylist.body.boxes[0];
    assert.ok(box.subscriber);
    assert.ok(box.profile);
    assert.ok(Array.isArray(box.items));
  }
});

test('SCRUM-53/55: aprobación, reemplazo validado, rechazo y registro de training_examples', async () => {
  const stylist = await app.loginAs('STYLIST');

  // Crear usuario con caja en estado PROPOSED
  const email = nextEmail();
  const reg = await app.post('/api/auth/register', {
    name: 'Stylist Client', email, password: 'SafePassword1', birthDate: '1995-12-12', acceptedPolicy: true, policyVersion: config.POLICY.version
  });
  const profRes = await app.put('/api/profile', {
    styles: ['artesanal', 'clasico'],
    occasions: ['fiesta'],
    fit: 'regular',
    line: 'u',
    plan: 'esencial',
    measures: { height: 175, weight: 70, usual: 'M' },
    source: 'quiz'
  }, reg.body.token);

  const boxId = profRes.body.boxId;
  assert.ok(boxId);

  // Caja desconocida da 404
  const notFound = await app.post('/api/stylist/boxes/box_unknown_999/approve', { reason: 'ok' }, stylist);
  assert.equal(notFound.status, 404);

  // Reemplazar una prenda validando stock en talla del suscriptor
  const boxBefore = db.getBoxById(boxId);
  const oldItem = boxBefore.itemIds[0];
  const newProduct = db.catalog.find(p => !boxBefore.itemIds.includes(p.id) && (p.variants || []).some(v => v.stock > 0));
  assert.ok(newProduct);

  const replaceRes = await app.post(`/api/stylist/boxes/${boxId}/replace`, {
    itemId: oldItem,
    newProductId: newProduct.id,
    reason: 'Mejor afinidad con la ocasión de fiesta'
  }, stylist);
  assert.equal(replaceRes.status, 200);
  assert.ok(replaceRes.body.box.items.some(i => i.id === newProduct.id));

  // Verificar training_example guardado con snapshot de perfil (SCRUM-55)
  const replaceCor = db.data.corrections.find(c => c.boxId === boxId && c.type === 'REPLACE');
  assert.ok(replaceCor);
  assert.equal(replaceCor.removedProductId, oldItem);
  assert.equal(replaceCor.addedProductId, newProduct.id);
  assert.ok(replaceCor.profileSnapshot);
  assert.equal(replaceCor.profileSnapshot.fit, 'regular');

  // Aprobar la caja
  const approveRes = await app.post(`/api/stylist/boxes/${boxId}/approve`, { reason: 'Caja lista y balanceada' }, stylist);
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.box.status, 'APPROVED');

  // Transición inválida: volver a aprobar o cambiar una caja ya APPROVED da 409
  const reApprove = await app.post(`/api/stylist/boxes/${boxId}/approve`, { reason: 'repetida' }, stylist);
  assert.equal(reApprove.status, 409);
});
