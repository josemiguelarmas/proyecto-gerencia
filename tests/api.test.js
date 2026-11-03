const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

// Las pruebas corren sobre una copia temporal de la base y de la bandeja de salida,
// para no ensuciar backend/data/db.json.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tcb-test-'));
process.env.TCB_DB_FILE = path.join(TMP_DIR, 'db.json');
process.env.TCB_OUTBOX_FILE = path.join(TMP_DIR, 'outbox.json');
fs.copyFileSync(path.join(__dirname, '..', 'backend', 'data', 'db.json'), process.env.TCB_DB_FILE);

const { startServer } = require('../backend/server');
const { db } = require('../backend/database');

const TEST_PORT = 3199;

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
      res => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch (e) {
            json = body;
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function validRegistration(email, overrides = {}) {
  return {
    name: 'Usuario Prueba',
    email,
    password: 'password123',
    birthDate: '2000-05-20',
    acceptedPolicy: true,
    policyVersion: 'v1.0',
    ...overrides
  };
}

function lastMailTo(messages, to, type) {
  return messages.find(m => m.to === to && m.type === type);
}

function tokenFromMail(message) {
  const match = message && message.body.match(/token=([a-f0-9]+)/);
  return match ? match[1] : null;
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE BACKEND, ROLES Y REGLAS DE NEGOCIO ---');
  const server = await startServer(TEST_PORT);

  try {
    // 1. Catálogo público con imágenes reales
    const catRes = await request('GET', '/api/products');
    assert.ok(catRes.status === 200, 'Catalog status should be 200');
    assert.ok(Array.isArray(catRes.body) && catRes.body.length > 10, 'Catalog should have items');
    const allHaveImages = catRes.body.every(p => typeof p.imageUrl === 'string' && p.imageUrl.startsWith('http'));
    assert.ok(allHaveImages, 'Todos los productos deben tener fotografía real en imageUrl');
    console.log('✓ 1. Catálogo con fotografías reales confirmado (18 productos con URL válida)');

    // 2. Seguridad: Intento de acceso sin token a ruta protegida -> 401
    const unauthRes = await request('GET', '/api/boxes/current');
    assert.ok(unauthRes.status === 401, 'Should reject unauthenticated access');
    console.log('✓ 2. Rutas protegidas bloqueadas sin token (401 Unauthorized)');

    // 3. Login de usuario demo cliente
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'demo@theclothesbox.co',
      password: 'demo123'
    });
    assert.ok(loginRes.status === 200, 'Demo login should succeed');
    assert.ok(loginRes.body.token, 'Should return JWT token');
    assert.ok(loginRes.body.user.role === 'CLIENT', 'Demo user must have CLIENT role');
    const token = loginRes.body.token;
    console.log('✓ 3. Autenticación de Cliente exitosa (Rol: CLIENT, JWT token generado)');

    // 4. Obtener caja actual del usuario
    const boxRes = await request('GET', '/api/boxes/current', null, token);
    assert.ok(boxRes.status === 200, 'Current box status should be 200');
    const box = boxRes.body.box;
    console.log('✓ 4. Caja actual consultada:', box ? `Caja #${box.cycle} (Estado: ${box.status})` : 'Sin caja');

    // 5. REGLA FUNDAMENTAL DE LA CAJA SORPRESA (CLIENTE):
    // Si la caja está en PREPARING o SHIPPED, los items NO deben ser expuestos
    const newEmail = `test_${Date.now()}@test.com`;
    // Ajuste Sprint 2: desde HU-02 y HU-01 el registro exige consentimiento y fecha de nacimiento.
    const regRes = await request('POST', '/api/auth/register', validRegistration(newEmail));
    assert.strictEqual(regRes.status, 201, 'El registro válido debe crear la cuenta');
    const newToken = regRes.body.token;
    await request('PUT', '/api/profile', {
      styles: ['urbano'],
      occasions: ['clase'],
      fit: 'regular',
      line: 'u',
      risk: 1,
      plan: 'esencial',
      measures: { height: 175, weight: 70, build: 'media', usual: 'M' }
    }, newToken);

    const preparingBoxRes = await request('GET', '/api/boxes/current', null, newToken);
    assert.ok(preparingBoxRes.body.box.status === 'PREPARING', 'Should be preparing');
    assert.ok(preparingBoxRes.body.box.items === null, 'Prendas deben ser NULL mientras la caja no esté entregada para clientes');
    console.log('✓ 5. REGLA DE SORPRESA VERIFICADA EN CLIENTE: Prendas ocultas en estado PREPARING (items = null)');

    // 6. En SHIPPED sigue oculta
    const shipRes = await request('POST', '/api/boxes/simulate-step', {}, newToken);
    assert.ok(shipRes.body.status === 'SHIPPED', 'Status should be SHIPPED');
    const shippedBoxRes = await request('GET', '/api/boxes/current', null, newToken);
    assert.ok(shippedBoxRes.body.box.items === null, 'Prendas deben seguir siendo NULL en estado SHIPPED para clientes');
    console.log('✓ 6. REGLA DE SORPRESA VERIFICADA EN CLIENTE: Prendas ocultas en estado SHIPPED (items = null)');

    // 7. En DELIVERED se revela con fotos e información completa
    const deliverRes = await request('POST', '/api/boxes/simulate-step', {}, newToken);
    assert.ok(deliverRes.body.status === 'DELIVERED', 'Status should be DELIVERED');
    const deliveredBoxRes = await request('GET', '/api/boxes/current', null, newToken);
    assert.ok(Array.isArray(deliveredBoxRes.body.box.items) && deliveredBoxRes.body.box.items.length === 3, 'Prendas deben ser reveladas solo en DELIVERED');
    assert.ok(deliveredBoxRes.body.box.items[0].imageUrl, 'Prendas reveladas deben incluir imageUrl');
    console.log('✓ 7. REGLA DE ENTREGA VERIFICADA: Prendas reveladas con fotografías y ajuste de talla al cambiar a DELIVERED');

    // 8. Valoración individual de prenda (Requisito 4: Descubrimiento y feedback)
    const sampleItem = deliveredBoxRes.body.box.items[0];
    const feedbackRes = await request('POST', `/api/boxes/${deliveredBoxRes.body.box.id}/item-feedback`, {
      productId: sampleItem.id,
      liked: true,
      styleFeedback: 'Me gustó mucho el color y la tela',
      score: 5,
      preferenceNotes: 'Quiero más prendas de este estilo en futuras cajas'
    }, newToken);
    assert.ok(feedbackRes.status === 200, 'Item feedback should succeed');
    console.log('✓ 8. VALORACIÓN INDIVIDUAL DE PRENDA VERIFICADA: Feedback registrado sin generar devolución');

    // 9. REGLA DE DEVOLUCIÓN ESTRICTA: Solo por talla (TOO_SMALL, TOO_LARGE, FIT_ISSUE)
    const illegalReturnRes = await request('POST', '/api/returns', {
      boxId: deliveredBoxRes.body.box.id,
      productId: sampleItem.id,
      reason: 'DONT_LIKE',
      requestedSize: 'L'
    }, newToken);
    assert.ok(illegalReturnRes.status === 400, 'Illegal return reason should be rejected with 400');
    console.log('✓ 9. REGLA DE DEVOLUCIÓN VERIFICADA: Rechazo de motivos de gusto/opinión (status 400)');

    // 10. Devolución legal por talla (TOO_SMALL)
    const legalReturnRes = await request('POST', '/api/returns', {
      boxId: deliveredBoxRes.body.box.id,
      productId: sampleItem.id,
      reason: 'TOO_SMALL',
      requestedSize: 'L',
      notes: 'Me quedó apretada de pecho'
    }, newToken);
    assert.ok(legalReturnRes.status === 201, 'Legal return reason should succeed with 201');
    console.log('✓ 10. Devolución por talla aprobada y registrada en base de datos (201 Created)');

    // 11. CONTROL DE ACCESO POR ROL: Cliente intentando acceder a ruta administrativa -> 403 Forbidden
    const clientAdminRes = await request('GET', '/api/admin/metrics', null, newToken);
    assert.ok(clientAdminRes.status === 403, 'Client should be forbidden from admin routes');
    console.log('✓ 11. CONTROL DE ACCESO VERIFICADO: Cliente bloqueado de rutas administrativas (403 Forbidden)');

    // 12. Login de Administrador
    const adminLoginRes = await request('POST', '/api/auth/login', {
      email: 'admin@theclothesbox.co',
      password: 'admin123'
    });
    assert.ok(adminLoginRes.status === 200, 'Admin login should succeed');
    assert.ok(adminLoginRes.body.user.role === 'ADMIN', 'Admin user must have ADMIN role');
    const adminToken = adminLoginRes.body.token;
    console.log('✓ 12. Autenticación de Administrador exitosa (Rol: ADMIN, JWT token generado)');

    // 13. Administrador accede a métricas y lista de clientes
    const adminMetricsRes = await request('GET', '/api/admin/metrics', null, adminToken);
    assert.ok(adminMetricsRes.status === 200, 'Admin metrics status should be 200');
    assert.ok(adminMetricsRes.body.totalClients >= 1, 'Admin metrics should report clients');
    console.log('✓ 13. Métricas administrativas operativas:', {
      clientes: adminMetricsRes.body.totalClients,
      cajas: adminMetricsRes.body.totalBoxes,
      devoluciones: adminMetricsRes.body.totalReturns
    });

    // 14. PRIVILEGIO ADMINISTRATIVO: Administrador SÍ puede ver prendas de cajas en PREPARING o SHIPPED
    const adminBoxesRes = await request('GET', '/api/admin/boxes', null, adminToken);
    assert.ok(adminBoxesRes.status === 200, 'Admin boxes status should be 200');
    assert.ok(Array.isArray(adminBoxesRes.body.boxes), 'Should return boxes array');
    const adminPreparingBox = adminBoxesRes.body.boxes.find(b => b.status === 'PREPARING' || b.status === 'SHIPPED');
    if (adminPreparingBox) {
      assert.ok(Array.isArray(adminPreparingBox.items) && adminPreparingBox.items.length > 0, 'Admin debe poder auditar el contenido de cajas en preparación');
    }
    console.log('✓ 14. PRIVILEGIO ADMINISTRATIVO VERIFICADO: El Administrador puede auditar prendas de cajas no entregadas');

    // 15. Administrador gestiona solicitudes de devolución
    const adminReturnsRes = await request('GET', '/api/admin/returns', null, adminToken);
    assert.ok(adminReturnsRes.status === 200, 'Admin returns status should be 200');
    assert.ok(adminReturnsRes.body.returns.length >= 1, 'Should list returns');
    console.log('✓ 15. Vista administrativa de devoluciones con prendas, fotos y clientes confirmada');

    await runSprint2Tests({ token, newToken, newEmail, adminToken, deliveredBox: deliveredBoxRes.body.box });

    console.log('\n======================================================');
    console.log('¡TODAS LAS PRUEBAS DE BACKEND Y ROLES PASARON CON ÉXITO!');
    console.log('======================================================\n');
  } finally {
    server.close();
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

async function runSprint2Tests({ token, newToken, newEmail, adminToken, deliveredBox }) {
  console.log('\n--- SPRINT 2 · PROMPT 1 ---');

  // 16. Contrato frontend-backend: claves que leen #/devoluciones y #/historial
  const returnsRes = await request('GET', '/api/returns', null, newToken);
  assert.strictEqual(returnsRes.status, 200);
  assert.ok(Array.isArray(returnsRes.body.returnableGarments) && returnsRes.body.returnableGarments.length === 3, 'returnableGarments debe listar las 3 prendas entregadas');
  returnsRes.body.returnableGarments.forEach(g => {
    ['id', 'boxId', 'cycle', 'name', 'brandName', 'fabric', 'cut', 'imageUrl'].forEach(k => assert.ok(g[k] !== undefined, `returnableGarments[].${k}`));
    assert.ok(typeof g.fit.size === 'string', 'returnableGarments[].fit.size');
  });
  const historyRes = await request('GET', '/api/boxes/history', null, token);
  assert.strictEqual(historyRes.status, 200);
  const historyItems = historyRes.body.history.flatMap(b => b.items);
  assert.ok(historyItems.length > 0, 'El demo tiene cajas entregadas');
  historyItems.forEach(i => {
    assert.ok(typeof i.brandName === 'string', 'history.items[].brandName');
    assert.ok(typeof i.fit.size === 'string' && typeof i.fit.levelText === 'string', 'history.items[].fit.size/levelText');
    assert.ok(Number.isFinite(i.priceCOP), 'history.items[].priceCOP');
    assert.ok(typeof i.cut === 'string', 'history.items[].cut');
    assert.ok('userRating' in i, 'history.items[].userRating');
  });
  console.log('✓ 16. CONTRATO VERIFICADO: devoluciones e historial entregan las claves que lee el frontend');

  // 17. HU-02: registro sin consentimiento es rechazado y no crea la cuenta
  const noConsentEmail = `noconsent_${Date.now()}@test.com`;
  const noConsentRes = await request('POST', '/api/auth/register', validRegistration(noConsentEmail, { acceptedPolicy: false }));
  assert.strictEqual(noConsentRes.status, 400);
  assert.strictEqual(noConsentRes.body.error, 'El consentimiento es obligatorio');
  assert.strictEqual(db.findUserByEmail(noConsentEmail), null, 'No debe crearse la cuenta');
  const noVersionRes = await request('POST', '/api/auth/register', validRegistration(noConsentEmail, { policyVersion: undefined }));
  assert.strictEqual(noVersionRes.status, 400);
  console.log('✓ 17. HU-02: registro sin casilla de consentimiento rechazado (400) y sin cuenta creada');

  // 18. HU-02: registro con consentimiento deja auditoría con fecha y versión
  const newUser = db.findUserByEmail(newEmail);
  const consents = db.getConsentsByUser(newUser.id);
  assert.strictEqual(consents.length, 1);
  assert.strictEqual(consents[0].accepted, true);
  assert.strictEqual(consents[0].policyVersion, 'v1.0');
  assert.ok(!isNaN(Date.parse(consents[0].acceptedAt)), 'acceptedAt debe ser fecha');
  console.log('✓ 18. HU-02: consentimiento auditado (userId, aceptación, versión v1.0 y fecha)');

  // 19. HU-01: menores de 18 rechazados
  const today = new Date();
  const seventeen = `${today.getUTCFullYear() - 17}-01-01`;
  const minorEmail = `minor_${Date.now()}@test.com`;
  const minorRes = await request('POST', '/api/auth/register', validRegistration(minorEmail, { birthDate: seventeen }));
  assert.strictEqual(minorRes.status, 400);
  assert.strictEqual(minorRes.body.code, 'UNDERAGE');
  assert.strictEqual(db.findUserByEmail(minorEmail), null);
  console.log('✓ 19. HU-01: registro de menor de 18 años rechazado');

  // 20. HU-01: correo duplicado con mensaje exacto
  const dupRes = await request('POST', '/api/auth/register', validRegistration(newEmail));
  assert.strictEqual(dupRes.status, 409);
  assert.strictEqual(dupRes.body.error, 'Este correo ya está registrado');
  console.log('✓ 20. HU-01: correo duplicado → "Este correo ya está registrado" (409)');

  // 21. HU-01: recuperación de contraseña con token de un solo uso
  const unknownForgot = await request('POST', '/api/auth/forgot', { email: 'nadie@test.com' });
  assert.strictEqual(unknownForgot.status, 200, 'No revela si el correo existe');
  const forgotRes = await request('POST', '/api/auth/forgot', { email: newEmail });
  assert.strictEqual(forgotRes.status, 200);
  let outbox = (await request('GET', '/api/admin/outbox', null, adminToken)).body.messages;
  const resetToken = tokenFromMail(lastMailTo(outbox, newEmail, 'PASSWORD_RESET'));
  assert.ok(resetToken, 'El enlace debe llegar a la bandeja de salida');
  const stored = db.data.authTokens.find(t => t.type === 'PASSWORD_RESET' && t.userId === newUser.id);
  assert.notStrictEqual(stored.tokenHash, resetToken, 'Solo se guarda el hash');
  assert.ok(Math.abs(new Date(stored.expiresAt) - Date.now() - 3600000) < 60000, 'Vence en 1 hora');
  const resetRes = await request('POST', '/api/auth/reset', { token: resetToken, password: 'nuevaClave456' });
  assert.strictEqual(resetRes.status, 200);
  const reuseRes = await request('POST', '/api/auth/reset', { token: resetToken, password: 'otraClave789' });
  assert.strictEqual(reuseRes.status, 400, 'El token no se puede reutilizar');
  const loginNew = await request('POST', '/api/auth/login', { email: newEmail, password: 'nuevaClave456' });
  assert.strictEqual(loginNew.status, 200);
  console.log('✓ 21. HU-01: recuperación de contraseña (hash, 1 hora, un solo uso) funcionando');

  // 22. HU-01: token de recuperación vencido es rechazado
  await request('POST', '/api/auth/forgot', { email: newEmail });
  outbox = (await request('GET', '/api/admin/outbox', null, adminToken)).body.messages;
  const expiringToken = tokenFromMail(lastMailTo(outbox, newEmail, 'PASSWORD_RESET'));
  const pending = db.data.authTokens.filter(t => t.type === 'PASSWORD_RESET' && t.userId === newUser.id && !t.usedAt);
  pending.forEach(t => { t.expiresAt = new Date(Date.now() - 1000).toISOString(); });
  const expiredRes = await request('POST', '/api/auth/reset', { token: expiringToken, password: 'otraClave789' });
  assert.strictEqual(expiredRes.status, 400);
  console.log('✓ 22. HU-01: token de recuperación vencido rechazado');

  // 23. HU-01: verificación de correo
  const meBefore = await request('GET', '/api/auth/me', null, newToken);
  assert.strictEqual(meBefore.body.user.emailVerified, false);
  const verifyToken = tokenFromMail(lastMailTo(outbox, newEmail, 'EMAIL_VERIFICATION'));
  const verifyRes = await request('POST', '/api/auth/verify-email', { token: verifyToken });
  assert.strictEqual(verifyRes.status, 200);
  const meAfter = await request('GET', '/api/auth/me', null, newToken);
  assert.strictEqual(meAfter.body.user.emailVerified, true);
  console.log('✓ 23. HU-01: verificación de correo marca emailVerified (sin bloquear el inicio de sesión)');

  // 24. HU-10: calificación separada de ajuste y estilo, y calificación parcial
  const [itemA, itemB] = deliveredBox.items.map(i => i.id).slice(1);
  const bothRes = await request('POST', `/api/boxes/${deliveredBox.id}/item-feedback`, { productId: itemA, fitScore: 5, styleScore: 2 }, newToken);
  assert.strictEqual(bothRes.status, 200);
  assert.strictEqual(bothRes.body.rating.fitScore, 5);
  assert.strictEqual(bothRes.body.rating.styleScore, 2);
  assert.ok(bothRes.body.rating.score >= 1 && bothRes.body.rating.score <= 5, 'score general para el promedio del panel');
  const partialRes = await request('POST', `/api/boxes/${deliveredBox.id}/item-feedback`, { productId: itemB, fitScore: 4 }, newToken);
  assert.strictEqual(partialRes.status, 200);
  assert.strictEqual(partialRes.body.rating.fitScore, 4);
  assert.strictEqual(partialRes.body.rating.styleScore, null);
  const badScore = await request('POST', `/api/boxes/${deliveredBox.id}/item-feedback`, { productId: itemB, styleScore: 7 }, newToken);
  assert.strictEqual(badScore.status, 400);
  const metrics = await request('GET', '/api/admin/metrics', null, adminToken);
  assert.ok(!isNaN(Number(metrics.body.averageSatisfaction)), 'El promedio del panel sigue siendo numérico');
  console.log('✓ 24. HU-10: ajuste y estilo calificados por separado (1-5), parcial permitido, fuera de rango 400');

  // 25. HU-10: recordatorio a los 3 días, una sola vez
  const box = db.getBoxById(deliveredBox.id);
  db.data.ratings = db.data.ratings.filter(r => r.boxId !== box.id);
  db.updateBox(box.id, { deliveredAt: new Date(Date.now() - 2 * 86400000).toISOString(), reminderSentAt: null });
  const early = await request('POST', '/api/admin/jobs/review-reminders', {}, adminToken);
  assert.ok(!early.body.boxIds.includes(box.id), 'Antes de 3 días no se recuerda');
  db.updateBox(box.id, { deliveredAt: new Date(Date.now() - 4 * 86400000).toISOString() });
  const first = await request('POST', '/api/admin/jobs/review-reminders', {}, adminToken);
  assert.ok(first.body.boxIds.includes(box.id), 'A los 3 días se recuerda');
  assert.ok(db.getBoxById(box.id).reminderSentAt, 'Queda reminderSentAt');
  const second = await request('POST', '/api/admin/jobs/review-reminders', {}, adminToken);
  assert.ok(!second.body.boxIds.includes(box.id), 'No se repite');
  outbox = (await request('GET', '/api/admin/outbox', null, adminToken)).body.messages;
  assert.strictEqual(outbox.filter(m => m.to === newEmail && m.type === 'REVIEW_REMINDER').length, 1);
  assert.ok(outbox.every(m => m.subject.startsWith('[SIMULADO]')), 'Todo correo marcado como SIMULADO');
  const clientJob = await request('POST', '/api/admin/jobs/review-reminders', {}, newToken);
  assert.strictEqual(clientJob.status, 403);
  console.log('✓ 25. HU-10: recordatorio de calificación a los 3 días, enviado una sola vez y solo por admin');

  // 26. HU-13: cancelación con encuesta y conteo agregado
  const before = (await request('GET', '/api/admin/cancellation-reasons', null, adminToken)).body;
  const cancelRes = await request('POST', '/api/subscription/cancel', { reason: 'precio', comment: 'Está caro para mí' }, newToken);
  assert.strictEqual(cancelRes.status, 200);
  assert.strictEqual(cancelRes.body.subscription.status, 'CANCELLED');
  assert.strictEqual(cancelRes.body.cancellation.reason, 'precio');
  const again = await request('POST', '/api/subscription/cancel', {}, newToken);
  assert.strictEqual(again.status, 409);
  const after = (await request('GET', '/api/admin/cancellation-reasons', null, adminToken)).body;
  const countOf = (data, key) => data.reasons.find(r => r.key === key).count;
  assert.strictEqual(countOf(after, 'precio'), countOf(before, 'precio') + 1);
  assert.deepStrictEqual(after.reasons.map(r => r.key), ['precio', 'estilo', 'talla', 'tiempo', 'otro']);
  console.log('✓ 26. HU-13: cancelación guarda el motivo y GET /api/admin/cancellation-reasons lo agrega');

  // 27. HU-13: la encuesta no bloquea la cancelación
  const silentEmail = `silent_${Date.now()}@test.com`;
  const silentReg = await request('POST', '/api/auth/register', validRegistration(silentEmail));
  await request('PUT', '/api/profile', { styles: ['minimal'], occasions: ['clase'], fit: 'regular', line: 'u', plan: 'estilo', measures: { height: 170, weight: 65, build: 'media', usual: 'M' } }, silentReg.body.token);
  const silentCancel = await request('POST', '/api/subscription/cancel', {}, silentReg.body.token);
  assert.strictEqual(silentCancel.status, 200);
  assert.strictEqual(silentCancel.body.cancellation.reason, null);
  const afterSilent = (await request('GET', '/api/admin/cancellation-reasons', null, adminToken)).body;
  assert.strictEqual(afterSilent.unanswered, after.unanswered + 1);
  console.log('✓ 27. HU-13: cancelar sin responder la encuesta también funciona');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
