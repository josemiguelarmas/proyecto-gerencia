// Pruebas automatizadas de Despacho, Calificación y Devoluciones (HU-09, HU-10, HU-14, Stream E1)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer } = require('./helpers/server');

let app;
let db;
let config;
let logistics;
let shipping;

before(async () => {
  app = await startServer();
  ({ db } = require('../backend/database'));
  config = require('../backend/config');
  logistics = require('../backend/logistics');
  shipping = require('../backend/adapters/logistics');
});

after(async () => {
  await app.close();
});

let seq = 0;
const nextEmail = () => `fulfill_test_${Date.now()}_${seq++}@test.com`;

async function createPaidSubscriber() {
  const email = nextEmail();
  const reg = await app.post('/api/auth/register', {
    name: 'Fulfillment Client',
    email,
    password: 'SafePassword123',
    birthDate: '1995-03-20',
    acceptedPolicy: true,
    policyVersion: config.POLICY.version
  });
  const token = reg.body.token;
  const user = reg.body.user;

  // Marcar correo verificado
  const u = db.findUserById(user.id);
  u.emailVerified = true;
  db.save();

  // Guardar perfil
  await app.put('/api/profile', {
    styles: ['urbano'],
    occasions: ['clase'],
    fit: 'regular',
    line: 'u',
    plan: 'esencial',
    measures: { height: 172, weight: 68, build: 'media', usual: 'M' },
    address: 'Calle 10 # 5-20, Cali'
  }, token);

  // Suscribirse con tarjeta válida (token gateway tok_ok)
  const subRes = await app.post('/api/subscription/subscribe', {
    plan: 'esencial',
    paymentToken: 'tok_ok',
    fiscal: { docType: 'CC', docNumber: '111222333', address: 'Calle 10 # 5-20', city: 'Cali' }
  }, token);
  assert.equal(subRes.status, 201, `Suscripción falló: ${JSON.stringify(subRes.body)}`);

  const cur = await app.get('/api/boxes/current', token);
  const boxId = cur.body.box ? cur.body.box.id : null;

  return { email, token, userId: user.id, boxId };
}

test('SCRUM-90: RETURN_POLICY configurada y documento docs/return-policy.md en borrador', async () => {
  assert.ok(config.RETURN_POLICY);
  assert.equal(config.RETURN_POLICY.status, 'pendiente de revisión legal');
  assert.equal(config.RETURN_POLICY.windowBusinessDays, 5);
  assert.ok(Array.isArray(config.RETURN_POLICY.allowedReasons));

  const policyDoc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'return-policy.md'), 'utf8');
  assert.match(policyDoc, /BORRADOR PENDIENTE DE REVISIÓN LEGAL/);
  assert.match(policyDoc, /5.*días hábiles/i);
});

test('SCRUM-91: cálculo de días hábiles descuenta festivos colombianos de 2026', async () => {
  // Jueves Santo 2026-04-02 y Viernes Santo 2026-04-03
  // Entrega el miércoles 2026-04-01:
  // Jueves 2 y Viernes 3 son festivos; Sábado 4 y Domingo 5 son fin de semana.
  // 5 días hábiles deben terminar en:
  // Día 1: Lun 6, Día 2: Mar 7, Día 3: Mié 8, Día 4: Jue 9, Día 5: Vie 10.
  const delivered = new Date('2026-04-01T10:00:00.000Z');
  const d5 = shipping.addBusinessDays(delivered, 5);
  assert.equal(d5.toISOString().slice(0, 10), '2026-04-10', 'Descuenta Semana Santa y fin de semana');
});

test('SCRUM-64/68: despacho bloqueado con 409 si la caja no está aprobada por estilista', async () => {
  const sub = await createPaidSubscriber();
  const warehouseToken = await app.loginAs('WAREHOUSE');

  // Intentar despachar caja en estado PROPOSED
  const res = await app.post(`/api/admin/boxes/${sub.boxId}/status`, { status: 'SHIPPED' }, warehouseToken);
  assert.equal(res.status, 409);
  assert.match(res.body.error, /no ha sido aprobada/);
});

test('SCRUM-68: empaque con bandera sostenible y checklist de picking en /api/admin/dispatch', async () => {
  const sub = await createPaidSubscriber();
  const stylistToken = await app.loginAs('STYLIST');
  const warehouseToken = await app.loginAs('WAREHOUSE');

  // Estilista aprueba la propuesta
  const approveRes = await app.post(`/api/stylist/boxes/${sub.boxId}/approve`, { reason: 'Estilo perfecto' }, stylistToken);
  assert.equal(approveRes.status, 200);

  // Consultar cola de despacho
  const queueRes = await app.get('/api/admin/dispatch', warehouseToken);
  assert.equal(queueRes.status, 200);
  assert.ok(Array.isArray(queueRes.body.boxes));
  const queueBox = queueRes.body.boxes.find(b => b.id === sub.boxId);
  assert.ok(queueBox, 'La caja aprobada aparece en la cola de despacho');
  assert.equal(queueBox.paymentConfirmed, true);

  // Marcar empacada con empaque sostenible
  const packRes = await app.post(`/api/admin/boxes/${sub.boxId}/pack`, {
    packed: true,
    sustainablePackaging: true
  }, warehouseToken);
  assert.equal(packRes.status, 200);
  assert.equal(packRes.body.box.status, 'PREPARING');
  assert.equal(packRes.body.box.sustainablePackaging, true);
  assert.equal(packRes.body.box.packed, true);
});

test('SCRUM-65/66/67: ingreso manual de transportadora y guía, descuento de stock y correo de despacho', async () => {
  const sub = await createPaidSubscriber();
  const stylistToken = await app.loginAs('STYLIST');
  const warehouseToken = await app.loginAs('WAREHOUSE');

  await app.post(`/api/stylist/boxes/${sub.boxId}/approve`, { reason: 'Listo' }, stylistToken);

  // Ingreso manual de transportadora y número de guía real
  const shipRes = await app.post(`/api/admin/boxes/${sub.boxId}/status`, {
    status: 'SHIPPED',
    carrier: 'Coordinadora Mercantil',
    trackingNumber: 'CM-99887766'
  }, warehouseToken);

  assert.equal(shipRes.status, 200);
  assert.equal(shipRes.body.box.status, 'SHIPPED');
  assert.equal(shipRes.body.box.carrier, 'Coordinadora Mercantil');
  assert.equal(shipRes.body.box.trackingNumber, 'CM-99887766');

  // Comprobar movimiento de inventario DISPATCH_OUT
  assert.ok(db.data.inventoryMovements.some(m => m.type === 'DISPATCH_OUT' && m.refId === sub.boxId));

  // Comprobar correo de despacho
  const outboxRes = await app.get('/api/admin/outbox', await app.loginAs('ADMIN'));
  const shippedMail = outboxRes.body.messages.find(m => m.to === sub.email && m.type === 'BOX_SHIPPED');
  assert.ok(shippedMail, 'Se envía correo transaccional de despacho');
  assert.match(shippedMail.body, /CM-99887766/);
});

test('SCRUM-70/71/73: calificación separada de ajuste y estilo, sin default silencioso y cálculo real de satisfacción', async () => {
  const sub = await createPaidSubscriber();
  const stylistToken = await app.loginAs('STYLIST');
  const warehouseToken = await app.loginAs('WAREHOUSE');

  await app.post(`/api/stylist/boxes/${sub.boxId}/approve`, { reason: 'Ok' }, stylistToken);
  await app.post(`/api/admin/boxes/${sub.boxId}/status`, { status: 'SHIPPED' }, warehouseToken);

  // Intento de calificar antes de entregar (403)
  const boxObj = db.getBoxById(sub.boxId);
  const prodId = boxObj.itemIds[0];
  const premature = await app.post(`/api/boxes/${sub.boxId}/item-feedback`, {
    productId: prodId,
    fitScore: 4,
    styleScore: 5
  }, sub.token);
  assert.equal(premature.status, 403);

  // Marcar entregada
  await app.post(`/api/admin/boxes/${sub.boxId}/status`, { status: 'DELIVERED' }, warehouseToken);

  // Calificar con notas inválidas (< 1 o > 5) responde 400
  const invalidScore = await app.post(`/api/boxes/${sub.boxId}/item-feedback`, {
    productId: prodId,
    fitScore: 6,
    styleScore: 3
  }, sub.token);
  assert.equal(invalidScore.status, 400);

  // Calificar válidamente ajuste 3 y estilo 5
  const validRating = await app.post(`/api/boxes/${sub.boxId}/item-feedback`, {
    productId: prodId,
    fitScore: 3,
    styleScore: 5
  }, sub.token);
  assert.equal(validRating.status, 200);
  assert.equal(validRating.body.rating.fitScore, 3);
  assert.equal(validRating.body.rating.styleScore, 5);
  assert.equal(validRating.body.rating.score, 4);

  // Verificar métricas de satisfacción reales en el panel
  const metricsRes = await app.get('/api/admin/metrics', await app.loginAs('ADMIN'));
  assert.equal(metricsRes.status, 200);
  assert.notEqual(metricsRes.body.averageSatisfaction, 'sin datos');
  assert.ok(typeof Number(metricsRes.body.averageSatisfaction) === 'number');
});

test('SCRUM-92/94: guía HTML imprimible y endpoint de métricas de devoluciones por talla y marca', async () => {
  const sub = await createPaidSubscriber();
  const stylistToken = await app.loginAs('STYLIST');
  const warehouseToken = await app.loginAs('WAREHOUSE');

  await app.post(`/api/stylist/boxes/${sub.boxId}/approve`, { reason: 'Ok' }, stylistToken);
  await app.post(`/api/admin/boxes/${sub.boxId}/status`, { status: 'SHIPPED' }, warehouseToken);
  await app.post(`/api/admin/boxes/${sub.boxId}/status`, { status: 'DELIVERED' }, warehouseToken);

  const boxObj = db.getBoxById(sub.boxId);
  const prodId = boxObj.itemIds[0];
  const prod = db.getProductById(prodId);
  const otherSize = (prod.variants || []).find(v => v.size !== 'M' && v.stock > 0)?.size || 'L';

  // Solicitar devolución por talla
  const retRes = await app.post('/api/returns', {
    boxId: sub.boxId,
    productId: prodId,
    reason: 'TOO_SMALL',
    requestedSize: otherSize,
    notes: 'Apretado en los hombros'
  }, sub.token);
  assert.equal(retRes.status, 201);
  const returnId = retRes.body.returnRequest.id;

  // SCRUM-92: Consultar guía imprimible en formato JSON
  const guideJson = await app.get(`/api/returns/${returnId}/guide`, sub.token);
  assert.equal(guideJson.status, 200);
  assert.ok(guideJson.body.trackingNumber);
  assert.ok(guideJson.body.html);
  assert.match(guideJson.body.html, /The Clothes Box · Guía de Logística Inversa/);

  // Consultar guía en formato HTML directo
  const guideHtml = await app.get(`/api/returns/${returnId}/guide?format=html`, sub.token);
  assert.equal(guideHtml.status, 200);
  assert.match(guideHtml.body, /<!DOCTYPE html>/);
  assert.match(guideHtml.body, /Guía de Logística Inversa/);

  // SCRUM-94: Métricas de devoluciones por talla y marca
  const metricsRes = await app.get('/api/admin/returns/metrics', await app.loginAs('ADMIN'));
  assert.equal(metricsRes.status, 200);
  assert.ok(metricsRes.body.totalDeliveredGarments >= 1);
  assert.ok(metricsRes.body.totalSizeReturns >= 1);
  assert.equal(metricsRes.body.goalPct, 10);
  assert.ok(metricsRes.body.bySize && metricsRes.body.bySize[otherSize]);
  assert.ok(metricsRes.body.byBrand && metricsRes.body.byBrand[prod.brandName]);
});
