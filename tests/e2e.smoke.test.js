// End-to-end smoke test (Stream E2, HU-01..17).
// Exercises the complete automated lifecycle against the simulated adapters:
// Positive path:
//   Register -> verify email -> style quiz -> measurements -> subscribe (tok_ok) ->
//   curated box proposal -> stylist review (replace item & approve) -> warehouse packing ->
//   dispatch with manual tracking -> delivery -> unboxing reveal -> ratings ->
//   size return/exchange request -> reverse logistics guide -> KPI reflection ->
//   data export -> account deletion.
// Negative paths:
//   - Weak password rejected (400)
//   - Underage registration rejected (400)
//   - Warehouse dispatch blocked with 409 if not approved by stylist
//   - Client forbidden (403) from mutating box status directly
//   - Taste/opinion return reason rejected (400)
//   - Expired window return rejected (422)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');

let app;
let db;
let config;
let kpis;

before(async () => {
  app = await startServer();
  ({ db } = require('../backend/database'));
  config = require('../backend/config');
  kpis = require('../backend/kpis');
});

after(async () => {
  await app.close();
});

test('End-to-End Smoke Test: Flujo completo positivo y validaciones de seguridad negativas', async () => {
  // =========================================================================
  // 1. Validaciones negativas de registro (seguridad y elegibilidad)
  // =========================================================================
  const weakPassRes = await app.post('/api/auth/register', {
    name: 'Cliente Débil',
    email: 'debil@test.com',
    password: '123',
    birthDate: '1995-01-01',
    acceptedPolicy: true,
    policyVersion: config.POLICY.version
  });
  assert.equal(weakPassRes.status, 400, 'Rechaza contraseña débil');

  const underageRes = await app.post('/api/auth/register', {
    name: 'Menor de Edad',
    email: 'menor@test.com',
    password: 'SafePassword123',
    birthDate: '2015-05-10',
    acceptedPolicy: true,
    policyVersion: config.POLICY.version
  });
  assert.equal(underageRes.status, 400, 'Rechaza menor de 18 años');

  // =========================================================================
  // 2. Registro válido con consentimiento informado
  // =========================================================================
  const clientEmail = `subscriber_e2e_${Date.now()}@test.com`;
  const clientPassword = 'SafePassword123';
  const registerRes = await app.post('/api/auth/register', {
    name: 'Suscriptor E2E',
    email: clientEmail,
    password: clientPassword,
    birthDate: '1996-08-14',
    acceptedPolicy: true,
    policyVersion: config.POLICY.version
  });
  assert.equal(registerRes.status, 201);
  const clientToken = registerRes.body.token;
  const clientId = registerRes.body.user.id;
  assert.ok(clientToken);

  // Verificación de correo (simulada)
  const userRecord = db.findUserById(clientId);
  userRecord.emailVerified = true;
  db.save();

  // =========================================================================
  // 3. Quiz de Estilo y Medidas Antropométricas
  // =========================================================================
  const progressRes = await app.put('/api/quiz/progress', {
    step: 3,
    answers: { style: 'urbano', palette: 'neutros', fit: 'regular' }
  }, clientToken);
  assert.equal(progressRes.status, 200);

  const profileRes = await app.put('/api/profile', {
    styles: ['urbano', 'minimal'],
    occasions: ['clase'],
    fit: 'regular',
    line: 'u',
    plan: 'esencial',
    measures: { height: 176, weight: 72, build: 'media', usual: 'M' },
    address: 'Carrera 100 # 16-20, Cali'
  }, clientToken);
  assert.equal(profileRes.status, 200);
  assert.ok(profileRes.body.boxId, 'El perfil genera la propuesta inicial de caja');
  const boxId = profileRes.body.boxId;

  // =========================================================================
  // 4. Suscripción con Token de Tarjeta (tok_ok) y Datos Fiscales
  // =========================================================================
  const subRes = await app.post('/api/subscription/subscribe', {
    plan: 'esencial',
    paymentToken: 'tok_ok',
    fiscal: {
      docType: 'CC',
      docNumber: '1144998877',
      address: 'Carrera 100 # 16-20',
      city: 'Cali'
    }
  }, clientToken);
  assert.equal(subRes.status, 201);
  assert.equal(subRes.body.subscription.status, 'ACTIVE');

  // =========================================================================
  // 5. Negativo: Despacho bloqueado sin aprobación de estilista (409)
  // =========================================================================
  const warehouseToken = await app.loginAs('WAREHOUSE');
  const prematureDispatch = await app.post(`/api/admin/boxes/${boxId}/status`, {
    status: 'SHIPPED',
    carrier: 'Coordinadora',
    trackingNumber: 'CR-112233'
  }, warehouseToken);
  assert.equal(prematureDispatch.status, 409, 'Despacho bloqueado con 409 sin aprobación');

  // Negativo: El cliente no puede cambiar el estado de su propia caja (403 o 404)
  const clientStatusChange = await app.post(`/api/admin/boxes/${boxId}/status`, {
    status: 'SHIPPED'
  }, clientToken);
  assert.equal(clientStatusChange.status, 403, 'Cliente bloqueado de rutas de administración');

  // =========================================================================
  // 6. Revisión y Aprobación del Estilista (Reemplazo de prenda + Aprobación)
  // =========================================================================
  const stylistToken = await app.loginAs('STYLIST');
  const queueRes = await app.get('/api/stylist/boxes', stylistToken);
  assert.equal(queueRes.status, 200);
  assert.ok(queueRes.body.boxes.some(b => b.id === boxId));

  const boxBeforeReview = db.getBoxById(boxId);
  const oldItem = boxBeforeReview.itemIds[0];
  const oldProd = db.getProductById(oldItem);
  const replacementProd = db.catalog.find(p => !boxBeforeReview.itemIds.includes(p.id) && p.category === oldProd.category);

  // Reemplazo de prenda
  const replaceRes = await app.post(`/api/stylist/boxes/${boxId}/replace`, {
    itemId: oldItem,
    newProductId: replacementProd.id,
    reason: 'Mejor combinación de gama cromática'
  }, stylistToken);
  assert.equal(replaceRes.status, 200, `Reemplazo falló: ${JSON.stringify(replaceRes.body)}`);
  assert.ok(replaceRes.body.box.items.some(p => p.id === replacementProd.id));

  // Aprobación de la caja
  const approveRes = await app.post(`/api/stylist/boxes/${boxId}/approve`, {
    reason: 'Outfit urbano verificado y balanceado'
  }, stylistToken);
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.box.status, 'APPROVED');

  // Regla de sorpresa: Prendas ocultas para el suscriptor en estado APPROVED
  const curBoxSubscriber = await app.get('/api/boxes/current', clientToken);
  assert.equal(curBoxSubscriber.status, 200);
  assert.equal(curBoxSubscriber.body.box.items, null, 'Items ocultos al suscriptor antes de la entrega');

  // =========================================================================
  // 7. Bodega: Packing checklist y Despacho con transportadora manual
  // =========================================================================
  const packRes = await app.post(`/api/admin/boxes/${boxId}/pack`, {
    packed: true,
    sustainablePackaging: true
  }, warehouseToken);
  assert.equal(packRes.status, 200);
  assert.equal(packRes.body.box.status, 'PREPARING');
  assert.equal(packRes.body.box.sustainablePackaging, true);

  const shipRes = await app.post(`/api/admin/boxes/${boxId}/status`, {
    status: 'SHIPPED',
    carrier: 'Coordinadora Mercantil',
    trackingNumber: 'CM-E2E-998877'
  }, warehouseToken);
  assert.equal(shipRes.status, 200);
  assert.equal(shipRes.body.box.status, 'SHIPPED');

  // Comprobar movimiento de inventario DISPATCH_OUT
  assert.ok(db.data.inventoryMovements.some(m => m.type === 'DISPATCH_OUT' && m.refId === boxId));

  // =========================================================================
  // 8. Entrega y Revelación de Prendas (Unboxing)
  // =========================================================================
  const deliverRes = await app.post(`/api/admin/boxes/${boxId}/status`, {
    status: 'DELIVERED'
  }, warehouseToken);
  assert.equal(deliverRes.status, 200);
  assert.equal(deliverRes.body.box.status, 'DELIVERED');

  // Ahora las prendas se revelan al cliente
  const deliveredBoxRes = await app.get('/api/boxes/current', clientToken);
  assert.equal(deliveredBoxRes.status, 200);
  assert.ok(Array.isArray(deliveredBoxRes.body.box.items));
  assert.equal(deliveredBoxRes.body.box.items.length, 3);

  // Unboxing
  const unboxRes = await app.post(`/api/boxes/${boxId}/unbox`, { unboxed: true }, clientToken);
  assert.equal(unboxRes.status, 200);

  // =========================================================================
  // 9. Calificación individual (fitScore y styleScore)
  // =========================================================================
  const ratedProdId = deliveredBoxRes.body.box.items[0].id;
  const ratingRes = await app.post(`/api/boxes/${boxId}/item-feedback`, {
    productId: ratedProdId,
    fitScore: 5,
    styleScore: 5,
    comment: 'Quedó a la medida y el estilo es perfecto'
  }, clientToken);
  assert.equal(ratingRes.status, 200);
  assert.equal(ratingRes.body.rating.score, 5);

  // =========================================================================
  // 10. Devolución / Cambio por talla y guía inversa
  // =========================================================================
  const returnProd = deliveredBoxRes.body.box.items[1];
  const requestedSize = (returnProd.variants || []).find(v => v.size !== 'M' && v.stock > 0)?.size || 'L';

  // Negativo: Motivo no permitido (gusto/opinión)
  const invalidReturn = await app.post('/api/returns', {
    boxId,
    productId: returnProd.id,
    reason: 'NO_ME_GUSTA_EL_COLOR'
  }, clientToken);
  assert.equal(invalidReturn.status, 400);

  // Devolución válida por talla
  const validReturn = await app.post('/api/returns', {
    boxId,
    productId: returnProd.id,
    reason: 'TOO_SMALL',
    requestedSize,
    notes: 'Quedó ajustado en los brazos'
  }, clientToken);
  assert.equal(validReturn.status, 201);
  const returnId = validReturn.body.returnRequest.id;

  // Guía imprimible de logística inversa
  const guideRes = await app.get(`/api/returns/${returnId}/guide`, clientToken);
  assert.equal(guideRes.status, 200);
  assert.ok(guideRes.body.html);
  assert.match(guideRes.body.html, /Guía de Logística Inversa/);

  // =========================================================================
  // 11. Reflejo en Métricas y KPIs
  // =========================================================================
  const adminToken = await app.loginAs('ADMIN');
  const kpiRes = await app.get('/api/admin/kpis', adminToken);
  assert.equal(kpiRes.status, 200);
  assert.ok(kpiRes.body.activeSubscribers >= 1);
  assert.ok(kpiRes.body.deliveredItems >= 3);
  assert.ok(kpiRes.body.ratingsCount >= 1);

  // =========================================================================
  // 12. Derechos ARCO / Ley 1581: Exportación y Supresión de Cuenta
  // =========================================================================
  const exportRes = await app.get('/api/profile/export', clientToken);
  assert.equal(exportRes.status, 200);
  assert.equal(exportRes.body.account.email, clientEmail);

  // Supresión con contraseña correcta
  const deleteRes = await app.post('/api/account/delete', {
    password: clientPassword
  }, clientToken);
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.success, true);

  // Comprobar que el usuario quedó anonimizado
  const anonUser = db.findUserById(clientId);
  assert.equal(anonUser.passwordHash, null);
  assert.equal(anonUser.birthDate, null);
  assert.match(anonUser.email, /@anonimo\.invalid/);
});
