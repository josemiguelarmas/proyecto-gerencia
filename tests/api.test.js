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
process.env.TCB_CATALOG_FILE = path.join(TMP_DIR, 'catalog.json');
fs.copyFileSync(path.join(__dirname, '..', 'backend', 'data', 'db.json'), process.env.TCB_DB_FILE);
fs.copyFileSync(path.join(__dirname, '..', 'backend', 'data', 'catalog.json'), process.env.TCB_CATALOG_FILE);

const { startServer } = require('../backend/server');
const { db } = require('../backend/database');
const { curateBox, scoreProduct } = require('../backend/engine');
const { stockInSize } = require('../backend/catalog');
const config = require('../backend/config');

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

    // Ajuste Sprint 2 (HU-07): la caja nace PROPOSED y pasa por el estilista antes de PREPARING.
    // La intención de la prueba se mantiene: las prendas siguen ocultas hasta la entrega.
    const proposedBoxRes = await request('GET', '/api/boxes/current', null, newToken);
    assert.strictEqual(proposedBoxRes.body.box.status, 'PROPOSED');
    assert.strictEqual(proposedBoxRes.body.box.items, null, 'Prendas ocultas también en PROPOSED');
    const stylistLogin = await request('POST', '/api/auth/login', { email: 'estilista@theclothesbox.co', password: 'estilista123' });
    const stylistToken = stylistLogin.body.token;
    const approveRes = await request('POST', `/api/stylist/boxes/${proposedBoxRes.body.box.id}/approve`, {}, stylistToken);
    assert.strictEqual(approveRes.status, 200);
    const prepStep = await request('POST', '/api/boxes/simulate-step', {}, newToken);
    assert.strictEqual(prepStep.body.status, 'PREPARING');
    const preparingBoxRes = await request('GET', '/api/boxes/current', null, newToken);
    assert.ok(preparingBoxRes.body.box.status === 'PREPARING', 'Should be preparing');
    assert.ok(preparingBoxRes.body.box.items === null, 'Prendas deben ser NULL mientras la caja no esté entregada para clientes');
    console.log('✓ 5. REGLA DE SORPRESA VERIFICADA EN CLIENTE: Prendas ocultas en PROPOSED y PREPARING (items = null)');

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
    await runPrompt2Tests({ token, adminToken, stylistToken, deliveredBox: deliveredBoxRes.body.box });

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

function syntheticProfiles() {
  const base = { line: 'u', risk: 1 };
  return [
    { ...base, styles: ['urbano', 'retro'], occasions: ['clase'], fit: 'holgado', plan: 'esencial', measures: { height: 175, weight: 70, build: 'media', usual: 'M' } },
    { ...base, styles: ['clasico', 'minimal'], occasions: ['entrevista', 'fiesta'], fit: 'regular', plan: 'estilo', measures: { height: 182, weight: 85, build: 'robusta', usual: 'L' } },
    { ...base, styles: ['minimal'], occasions: ['clase'], fit: 'ajustado', plan: 'esencial', line: 'f', measures: { height: 160, weight: 52, build: 'delgada', usual: 'S' } },
    { ...base, styles: ['deportivo', 'urbano'], occasions: ['clase', 'fiesta'], fit: 'holgado', plan: 'estilo', measures: { height: 170, weight: 95, build: 'robusta', usual: 'XL' } },
    { ...base, styles: ['artesanal', 'retro', 'clasico'], occasions: ['fiesta'], fit: 'regular', plan: 'esencial', measures: { height: 168, weight: 60, build: 'media', usual: 'M' } },
    { ...base, styles: ['retro'], occasions: ['entrevista'], fit: 'regular', plan: 'estilo', line: 'm', measures: { height: 190, weight: 100, build: 'robusta', usual: 'XXL' } }
  ];
}

async function newClient(profileOverrides = {}) {
  const email = `p2_${Date.now()}_${Math.random().toString(16).slice(2, 6)}@test.com`;
  const reg = await request('POST', '/api/auth/register', validRegistration(email));
  const tok = reg.body.token;
  await request('PUT', '/api/profile', { ...syntheticProfiles()[0], ...profileOverrides }, tok);
  const current = await request('GET', '/api/boxes/current', null, tok);
  return { email, token: tok, boxId: current.body.box.id, userId: reg.body.user.id };
}

async function runPrompt2Tests({ token, adminToken, stylistToken, deliveredBox }) {
  console.log('\n--- SPRINT 2 · PROMPT 2 ---');

  // 28. HU-05: todo el catálogo migrado tiene variantes con stock inicial 10
  assert.ok(db.catalog.length >= 18);
  db.catalog.slice(0, 18).forEach(p => {
    assert.ok(Array.isArray(p.variants) && p.variants.length > 0, `${p.id} sin variantes`);
    p.variants.forEach(v => assert.ok(v.size && v.color && v.stock === 10, `${p.id} variante inválida`));
  });
  console.log('✓ 28. HU-05: 18 prendas migradas a variantes (talla, color, stock 10)');

  // 29. HU-05: importación CSV con filas válidas y una inválida
  const csv = [
    'marca,nombre,categoria,estilo,ocasion,talla,color,precio_mayorista,stock',
    'Ceiba Estudio,Camisa Prueba CSV,top,minimal|clasico,clase,M,Blanco,35000,4',
    'Ceiba Estudio,Camisa Prueba CSV,top,minimal|clasico,clase,L,Blanco,35000,2',
    'Mono Textil,Camiseta Boxy Heavyweight 260g,top,urbano,clase,M,Ladrillo lavado,24000,7',
    'Mono Textil,Pantalón Fantasma,bottom,urbano,clase,XXXL,Negro,40000,3',
    'Mono Textil,Pantalón Fantasma,falda,urbano,clase,M,Negro,40000,3'
  ].join('\n');
  const importRes = await request('POST', '/api/admin/products/import', { csv }, adminToken);
  assert.strictEqual(importRes.status, 200);
  assert.strictEqual(importRes.body.imported, 3);
  assert.strictEqual(importRes.body.rejected, 2);
  assert.deepStrictEqual(importRes.body.errors.map(e => e.row), [5, 6]);
  assert.ok(/Talla/.test(importRes.body.errors[0].reason) && /Categoría/.test(importRes.body.errors[1].reason));
  assert.strictEqual(importRes.body.createdProducts.length, 1);
  const imported = db.catalog.find(p => p.name === 'Camisa Prueba CSV');
  assert.deepStrictEqual(imported.variants.map(v => [v.size, v.stock]), [['M', 4], ['L', 2]]);
  const boxy = db.getProductById('prod-01');
  assert.strictEqual(boxy.variants.find(v => v.size === 'M').stock, 7, 'La prenda existente actualiza su variante');
  assert.strictEqual(boxy.wholesalePriceCOP, 24000);
  const clientImport = await request('POST', '/api/admin/products/import', { csv }, token);
  assert.strictEqual(clientImport.status, 403);
  const exampleCsv = fs.readFileSync(path.join(__dirname, '..', 'docs', 'ejemplo_catalogo.csv'), 'utf8');
  const exampleRes = await request('POST', '/api/admin/products/import', { csv: exampleCsv }, adminToken);
  assert.strictEqual(exampleRes.status, 200);
  assert.ok(exampleRes.body.imported > 0);
  console.log(`✓ 29. HU-05: CSV importado fila por fila (3 importadas, 2 rechazadas con motivo); docs/ejemplo_catalogo.csv: ${exampleRes.body.imported} filas, ${exampleRes.body.rejected} rechazadas`);

  // 30. HU-05: una prenda sin stock en la talla del usuario nunca se selecciona
  const profile = syntheticProfiles()[0];
  const catalogCopy = JSON.parse(JSON.stringify(db.catalog));
  const firstPick = curateBox(profile, catalogCopy).recommendations[0];
  const target = catalogCopy.find(p => p.id === firstPick.productId);
  target.variants.filter(v => v.size === firstPick.size).forEach(v => { v.stock = 0; });
  const afterZero = curateBox(profile, catalogCopy);
  assert.ok(!afterZero.itemIds.includes(target.id), 'Prenda sin stock en la talla no debe elegirse');
  catalogCopy.forEach(p => p.variants.forEach(v => { v.stock = 0; }));
  const emptyCatalog = curateBox(profile, catalogCopy);
  assert.strictEqual(emptyCatalog.itemIds.length, 0, 'Sin stock no se elige nada');
  assert.deepStrictEqual(emptyCatalog.missingSlots, ['top', 'bottom', 'capa']);
  console.log('✓ 30. HU-05: el motor descarta prendas con stock 0 en la talla del usuario');

  // 31. HU-06: costo objetivo por plan y reemplazo de la prenda más cara
  assert.strictEqual(config.PLANS.esencial.targetCostCOP, 100364);
  assert.strictEqual(config.PLANS.estilo.targetCostCOP, 160914);
  const loose = curateBox(profile, db.catalog, [], { plans: { esencial: { ...config.PLANS.esencial, targetCostCOP: 10000000 } } });
  const cap = loose.totalCostCOP - 1; // la mejor combinación supera este tope por 1 peso
  const tight = curateBox(profile, db.catalog, [], { plans: { esencial: { ...config.PLANS.esencial, targetCostCOP: cap } } });
  assert.ok(tight.withinCap && tight.totalCostCOP <= cap, 'Con tope ajustado la caja queda dentro');
  assert.ok(tight.recommendations.some(r => r.replacedForCost), 'Se reemplazó al menos una prenda por costo');
  const mostExpensive = loose.recommendations.slice().sort((a, b) => b.costCOP - a.costCOP)[0];
  assert.ok(!tight.itemIds.includes(mostExpensive.productId), 'La prenda más cara fue la reemplazada');
  console.log('✓ 31. HU-06: costo objetivo respetado reemplazando la prenda más cara (Esencial 100.364 / Estilo 160.914 COP)');

  // 32. HU-06: perfiles sintéticos dentro del tope y con talla disponible
  const results = syntheticProfiles().map(pr => {
    const box = curateBox(pr, db.catalog);
    const sizeOk = box.recommendations.every(r => stockInSize(db.getProductById(r.productId), r.size) > 0);
    const complete = box.itemIds.length === config.PLANS[pr.plan].items;
    return { withinCap: box.withinCap, sizeOk, complete };
  });
  const pct = key => Math.round((results.filter(r => r[key]).length / results.length) * 100);
  console.log(`   Perfiles sintéticos: ${results.length} · dentro del tope ${pct('withinCap')} % · talla disponible ${pct('sizeOk')} % · caja completa ${pct('complete')} %`);
  assert.strictEqual(pct('withinCap'), 100);
  assert.strictEqual(pct('sizeOk'), 100);
  assert.strictEqual(pct('complete'), 100);
  console.log('✓ 32. HU-06: 6 perfiles sintéticos, 100 % dentro del tope y con talla disponible');

  // 33. HU-06: explicación guardada por prenda y visible en la caja entregada
  const delivered = await request('GET', '/api/boxes/current', null, (await request('POST', '/api/auth/login', { email: db.findUserById(db.getBoxById(deliveredBox.id).userId).email, password: 'nuevaClave456' })).body.token);
  assert.ok(delivered.body.box.items.every(i => i.recommendation && typeof i.recommendation.explanation === 'string'), 'Cada prenda entregada muestra su motivo');
  assert.ok(delivered.body.box.items[0].recommendation.reasons, 'Incluye estilo, ocasión, ajuste y puntaje');
  console.log('✓ 33. HU-06: motivo de cada prenda (estilo, ocasión, ajuste, puntaje) guardado y visible al cliente');

  // 34. HU-07: roles y permisos del estilista
  const stylistMe = await request('GET', '/api/auth/me', null, stylistToken);
  assert.strictEqual(stylistMe.body.user.role, 'STYLIST');
  assert.strictEqual((await request('GET', '/api/stylist/queue', null, stylistToken)).status, 200);
  assert.strictEqual((await request('GET', '/api/stylist/queue', null, adminToken)).status, 200, 'El admin también accede');
  assert.strictEqual((await request('GET', '/api/stylist/queue', null, token)).status, 403, 'El cliente no accede');
  assert.strictEqual((await request('GET', '/api/admin/metrics', null, stylistToken)).status, 403, 'El estilista no accede al admin');
  console.log('✓ 34. HU-07: rol STYLIST con cola propia; ADMIN accede a todo; CLIENT bloqueado');

  // 35. HU-07: despacho bloqueado si la caja no está aprobada
  const c1 = await newClient();
  const blockedStep = await request('POST', '/api/boxes/simulate-step', {}, c1.token);
  assert.strictEqual(blockedStep.status, 409);
  assert.strictEqual(blockedStep.body.error, 'La caja no ha sido aprobada');
  const blockedAdmin = await request('POST', `/api/admin/boxes/${c1.boxId}/status`, { status: 'SHIPPED' }, adminToken);
  assert.strictEqual(blockedAdmin.status, 409);
  assert.strictEqual(blockedAdmin.body.error, 'La caja no ha sido aprobada');
  console.log('✓ 35. HU-07: simulate-step y rutas de admin bloqueadas con 409 "La caja no ha sido aprobada"');

  // 36. HU-07: reemplazo de prenda con motivo, validando talla y stock
  const queue = (await request('GET', '/api/stylist/queue', null, stylistToken)).body.boxes;
  const queued = queue.find(b => b.id === c1.boxId);
  assert.ok(queued && queued.subscriber && queued.profile && queued.items.length === 3, 'La cola muestra perfil y prendas propuestas');
  assert.ok(queued.items.every(i => i.recommendation.explanation), 'El estilista ve el motivo de cada prenda');
  const oldItem = queued.items[0];
  const alts = (await request('GET', `/api/stylist/boxes/${c1.boxId}/alternatives`, null, stylistToken)).body.alternatives;
  const alt = alts.find(a => a.category === oldItem.category);
  assert.strictEqual((await request('POST', `/api/stylist/boxes/${c1.boxId}/replace`, { itemId: oldItem.id, newProductId: alt.productId }, stylistToken)).status, 400, 'Sin motivo se rechaza');
  const noStock = db.catalog.find(p => p.id !== alt.productId && !queued.items.some(i => i.id === p.id));
  const savedVariants = JSON.parse(JSON.stringify(noStock.variants));
  noStock.variants.forEach(v => { v.stock = 0; });
  const noStockRes = await request('POST', `/api/stylist/boxes/${c1.boxId}/replace`, { itemId: oldItem.id, newProductId: noStock.id, reason: 'Probar' }, stylistToken);
  assert.strictEqual(noStockRes.status, 409);
  noStock.variants = savedVariants;
  const replaceRes = await request('POST', `/api/stylist/boxes/${c1.boxId}/replace`, { itemId: oldItem.id, newProductId: alt.productId, reason: 'Prefiere colores neutros' }, stylistToken);
  assert.strictEqual(replaceRes.status, 200);
  assert.ok(replaceRes.body.box.items.some(i => i.id === alt.productId) && !replaceRes.body.box.items.some(i => i.id === oldItem.id));
  const correction = db.data.corrections.find(c => c.boxId === c1.boxId && c.type === 'REPLACE');
  assert.ok(correction && correction.stylistId === 'usr_stylist_01' && correction.reason === 'Prefiere colores neutros' && correction.createdAt);
  assert.strictEqual(correction.removedProductId, oldItem.id);
  assert.strictEqual(correction.addedProductId, alt.productId);
  console.log('✓ 36. HU-07: reemplazo con motivo, valida stock en la talla del suscriptor y deja la corrección (quién, cuándo, por qué)');

  // 37. HU-07: rechazo de la propuesta y nueva propuesta sin esas prendas
  const beforeReject = db.getBoxById(c1.boxId).itemIds.slice();
  const rejectRes = await request('POST', `/api/stylist/boxes/${c1.boxId}/reject`, { reason: 'No refleja su estilo' }, stylistToken);
  assert.strictEqual(rejectRes.status, 200);
  assert.strictEqual(rejectRes.body.box.status, 'PROPOSED');
  assert.ok(beforeReject.every(id => !rejectRes.body.box.items.some(i => i.id === id)), 'La nueva propuesta no repite prendas rechazadas');
  assert.deepStrictEqual(rejectRes.body.box.reviewLog.map(l => l.action), ['REPLACE', 'REJECT']);
  console.log('✓ 37. HU-07: rechazo con motivo genera una nueva propuesta y queda auditado');

  // 38. HU-07: aprobación ("Lista para despacho") y luego el despacho avanza
  const approveRes = await request('POST', `/api/stylist/boxes/${c1.boxId}/approve`, { reason: 'Revisada' }, stylistToken);
  assert.strictEqual(approveRes.status, 200);
  assert.strictEqual(approveRes.body.box.status, 'APPROVED');
  assert.strictEqual(db.getBoxById(c1.boxId).approvedBy, 'usr_stylist_01');
  assert.strictEqual((await request('POST', `/api/stylist/boxes/${c1.boxId}/approve`, {}, stylistToken)).status, 409, 'No se aprueba dos veces');
  const shipNow = await request('POST', '/api/boxes/simulate-step', {}, c1.token);
  assert.strictEqual(shipNow.body.status, 'PREPARING');
  console.log('✓ 38. HU-07: caja aprobada pasa a "Lista para despacho" y el despacho se desbloquea');

  // 39. HU-06: servicio batch de la caja del mes
  const batchRes = await request('POST', '/api/admin/boxes/generate-batch', {}, adminToken);
  assert.strictEqual(batchRes.status, 200);
  assert.ok(batchRes.body.generatedCount >= 1, 'Genera para suscriptores sin caja en curso');
  batchRes.body.generated.forEach(g => assert.strictEqual(db.getBoxById(g.boxId).status, 'PROPOSED'));
  assert.ok(batchRes.body.skipped.some(sk => sk.userId === c1.userId), 'Salta a quien tiene caja en curso');
  const batchAgain = await request('POST', '/api/admin/boxes/generate-batch', {}, adminToken);
  assert.strictEqual(batchAgain.body.generatedCount, 0, 'No duplica cajas');
  assert.strictEqual((await request('POST', '/api/admin/boxes/generate-batch', {}, stylistToken)).status, 403);
  console.log(`✓ 39. HU-06: batch generó ${batchRes.body.generatedCount} cajas PROPOSED (${batchRes.body.withinCapPct} % dentro del tope) y no duplica`);

  // 40. HU-03: guardar progreso parcial y retomarlo al volver a iniciar sesión
  const q = await newClient();
  const answers = { styles: ['retro', 'minimal'], styleWeights: { retro: 1, minimal: 0.5 } };
  assert.strictEqual((await request('PUT', '/api/quiz/progress', { step: 9 }, q.token)).status, 400);
  const save1 = await request('PUT', '/api/quiz/progress', { step: 2, answers, repeat: true }, q.token);
  assert.strictEqual(save1.status, 200);
  const startedAt = save1.body.session.startedAt;
  await request('PUT', '/api/quiz/progress', { step: 3, answers }, q.token);
  const relogin = await request('POST', '/api/auth/login', { email: q.email, password: 'password123' });
  const resumed = await request('GET', '/api/quiz/progress', null, relogin.body.token);
  assert.strictEqual(resumed.body.session.step, 3, 'Retoma desde la pregunta donde quedó');
  assert.deepStrictEqual(resumed.body.session.answers, answers);
  assert.strictEqual(resumed.body.session.startedAt, startedAt, 'Conserva la hora de inicio');
  console.log('✓ 40. HU-03: progreso parcial guardado en backend y retomado tras iniciar sesión (paso 3)');

  // 41. HU-03: repetir el quiz crea nueva versión, conserva la anterior y mide el tiempo
  const firstProfile = db.getProfile(q.userId);
  assert.ok(!firstProfile.version || firstProfile.version === 1);
  const done = await request('PUT', '/api/profile', { ...syntheticProfiles()[0], styles: ['retro', 'minimal'], styleWeights: answers.styleWeights, source: 'quiz' }, relogin.body.token);
  assert.strictEqual(done.status, 200);
  assert.strictEqual(done.body.profile.version, 2);
  assert.ok(Number.isInteger(done.body.quizSession.durationSec), 'Mide inicio y fin');
  const history = await request('GET', '/api/profile/history', null, relogin.body.token);
  assert.strictEqual(history.body.currentVersion, 2);
  assert.strictEqual(history.body.versions.length, 1);
  assert.deepStrictEqual(history.body.versions[0].snapshot.styles, ['urbano', 'retro'], 'La versión anterior se conserva');
  assert.ok(!isNaN(Date.parse(history.body.versions[0].archivedAt)));
  assert.strictEqual((await request('GET', '/api/quiz/progress', null, relogin.body.token)).body.session, null, 'La sesión queda cerrada');
  assert.deepStrictEqual(db.getProfile(q.userId).styleWeights, answers.styleWeights, 'El juego de estilos guarda pesos');
  const metrics = (await request('GET', '/api/admin/metrics', null, adminToken)).body;
  assert.ok(metrics.quiz.completed >= 1 && Number.isInteger(metrics.quiz.averageDurationSec) && metrics.quiz.targetSec === 180);
  console.log('✓ 41. HU-03: nueva versión del perfil con historial fechado y tiempo de completado en el panel');

  // 42. HU-03: los pesos del juego de estilos influyen en el puntaje del motor
  const retroProduct = db.getProductById('prod-13');
  const plain = scoreProduct({ styles: ['minimal'], occasions: [], fit: 'x' }, retroProduct).score;
  const weighted = scoreProduct({ styles: ['minimal'], occasions: [], fit: 'x', styleWeights: { retro: 1 } }, retroProduct).score;
  assert.ok(weighted > plain);
  console.log('✓ 42. HU-03: los pesos del juego de estilos ocultos suben el puntaje de prendas afines');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
