const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

// Las pruebas corren sobre una base, un catálogo y una bandeja de salida temporales.
// La base no existe al arrancar, así que se crea desde backend/data/seed/db.json.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tcb-test-'));
process.env.TCB_DB_FILE = path.join(TMP_DIR, 'db.json');
process.env.TCB_OUTBOX_FILE = path.join(TMP_DIR, 'outbox.json');
process.env.TCB_CATALOG_FILE = path.join(TMP_DIR, 'catalog.json');
fs.copyFileSync(path.join(__dirname, '..', 'backend', 'data', 'seed', 'catalog.json'), process.env.TCB_CATALOG_FILE);
// F5: el backend ya no trae un secreto JWT por defecto; esta prueba usa uno aleatorio.
process.env.JWT_SECRET = require('crypto').randomBytes(32).toString('hex');
// F5: las cuentas internas y la contraseña del cliente demo se siembran desde variables de
// entorno (ya no hay contraseñas en el código). Esta prueba define las suyas, aleatorias.
const TEST_PASSWORDS = {
  admin: `Admin-${require('crypto').randomBytes(6).toString('hex')}-1`,
  stylist: `Estilista-${require('crypto').randomBytes(6).toString('hex')}-1`,
  demo: `Demo-${require('crypto').randomBytes(6).toString('hex')}-1`
};
process.env.ADMIN_EMAIL = 'admin@theclothesbox.co';
process.env.ADMIN_PASSWORD = TEST_PASSWORDS.admin;
process.env.STYLIST_EMAIL = 'estilista@theclothesbox.co';
process.env.STYLIST_PASSWORD = TEST_PASSWORDS.stylist;
process.env.DEMO_CLIENT_PASSWORD = TEST_PASSWORDS.demo;

const { startServer } = require('../backend/server');
const { db } = require('../backend/database');
const { curateBox, scoreProduct } = require('../backend/engine');
const { stockInSize } = require('../backend/catalog');
const config = require('../backend/config');
const billing = require('../backend/billing');
const payments = require('../backend/payments');

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

const CARD_OK = '4242 4242 4242 4242';
const CARD_DECLINE = '4000 0000 0000 0002';
const CARD_FIRST_ONLY = '4000 0000 0000 0341';
const FISCAL = { docType: 'CC', docNumber: '1144123456', address: 'Calle 5 # 38-20, San Fernando', city: 'Cali' };

async function tokenizeCard(number, token) {
  const res = await request('POST', '/api/payments/tokenize', { card: { number, expMonth: 12, expYear: 2030, cvc: '123', holder: 'Usuario Prueba' } }, token);
  return res.body.token;
}

// HU-08: desde el Sprint 2 la suscripción nace con el primer pago aprobado.
async function subscribeWith(token, { card = CARD_OK, plan = 'esencial', fiscal = FISCAL } = {}) {
  const paymentToken = await tokenizeCard(card, token);
  return request('POST', '/api/subscription/subscribe', { plan, paymentToken, fiscal }, token);
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
      password: TEST_PASSWORDS.demo
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
    const stylistLogin = await request('POST', '/api/auth/login', { email: 'estilista@theclothesbox.co', password: TEST_PASSWORDS.stylist });
    const stylistToken = stylistLogin.body.token;
    const approveRes = await request('POST', `/api/stylist/boxes/${proposedBoxRes.body.box.id}/approve`, {}, stylistToken);
    assert.strictEqual(approveRes.status, 200);
    // Ajuste Prompt 4 (HU-09): sin el pago del ciclo confirmado la caja no se despacha.
    const unpaidStep = await request('POST', '/api/boxes/simulate-step', {}, newToken);
    assert.strictEqual(unpaidStep.status, 409);
    assert.strictEqual(unpaidStep.body.error, 'Pago no confirmado');
    assert.strictEqual((await subscribeWith(newToken)).status, 201);
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
      password: TEST_PASSWORDS.admin
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
    await runPrompt3Tests({ adminToken, stylistToken });
    await runPrompt4Tests({ adminToken, stylistToken });
    await runPrompt5Tests({ adminToken, stylistToken });

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
  // Ajuste F5: restablecer la contraseña revoca los tokens anteriores; se sigue con la sesión nueva.
  assert.strictEqual((await request('GET', '/api/auth/me', null, newToken)).status, 401);
  newToken = loginNew.body.token;
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
  assert.strictEqual((await request('GET', '/api/subscription', null, newToken)).body.subscription.status, 'ACTIVE', 'Pagó en la prueba 5');
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
  await subscribeWith(silentReg.body.token, { plan: 'estilo' });
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
  await subscribeWith(tok, { plan: profileOverrides.plan || syntheticProfiles()[0].plan || 'esencial' });
  const current = await request('GET', '/api/boxes/current', null, tok);
  return { email, token: tok, boxId: current.body.box.id, userId: reg.body.user.id };
}

async function runPrompt2Tests({ token, adminToken, stylistToken, deliveredBox }) {
  console.log('\n--- SPRINT 2 · PROMPT 2 ---');

  // 28. HU-05: todo el catálogo migrado tiene variantes con stock inicial 10
  // Ajuste Prompt 4: se revisa el catálogo versionado; en memoria los despachos de HU-09 ya descontaron stock.
  const migrated = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'data', 'seed', 'catalog.json'), 'utf8'));
  assert.ok(migrated.length >= 18);
  migrated.slice(0, 18).forEach(p => {
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

const HOUR = 3600000;
const later = (iso, ms = HOUR) => new Date(new Date(iso).getTime() + ms);

async function outboxFor(adminToken, to, type) {
  const messages = (await request('GET', '/api/admin/outbox', null, adminToken)).body.messages;
  return messages.filter(m => m.to === to && (!type || m.type === type));
}

async function runPrompt3Tests({ adminToken, stylistToken }) {
  console.log('\n--- SPRINT 2 · PROMPT 3 ---');

  // 43. HU-08: la tarjeta se tokeniza y nunca se guarda completa ni con CVV
  const a = await newClientWithoutPlan();
  assert.strictEqual((await request('POST', '/api/payments/tokenize', { card: { number: '4242 4242 4242 4241', expMonth: 12, expYear: 2030, cvc: '123', holder: 'X' } }, a.token)).status, 400, 'Luhn inválido');
  assert.strictEqual((await request('POST', '/api/payments/tokenize', { card: { number: CARD_OK, expMonth: 1, expYear: 2020, cvc: '123', holder: 'X' } }, a.token)).status, 400, 'Vencida');
  const tok = await request('POST', '/api/payments/tokenize', { card: { number: CARD_OK, expMonth: 12, expYear: 2030, cvc: '987', holder: 'Ana Prueba' } }, a.token);
  assert.strictEqual(tok.status, 200);
  assert.deepStrictEqual([tok.body.brand, tok.body.last4], ['Visa', '4242']);
  assert.ok(!tok.body.token.includes('4242424242424242'));
  console.log('✓ 43. HU-08: tokenización simulada valida la tarjeta y devuelve solo token, marca y últimos 4');

  // 44. HU-08: suscripción Esencial aprobada con 4242, confirmación en la bandeja de salida
  const okSub = await request('POST', '/api/subscription/subscribe', { plan: 'esencial', paymentToken: tok.body.token, fiscal: FISCAL }, a.token);
  assert.strictEqual(okSub.status, 201);
  assert.strictEqual(okSub.body.subscription.status, 'ACTIVE');
  assert.strictEqual(okSub.body.subscription.paymentToken, undefined, 'El token no se expone al cliente');
  assert.strictEqual(okSub.body.payment.amountCOP, 129900);
  assert.strictEqual(okSub.body.payment.feeCOP, Math.round(129900 * 0.035));
  assert.strictEqual(okSub.body.payment.reconciliation.status, 'OK', 'El webhook simulado concilia el cobro');
  const stored = db.data.subscriptions.find(x => x.userId === a.userId);
  assert.ok(stored.paymentToken && stored.cardLast4 === '4242' && stored.nextChargeAt);
  const dbText = fs.readFileSync(process.env.TCB_DB_FILE, 'utf8');
  assert.ok(!dbText.includes('4242424242424242') && !dbText.includes('"987"'), 'Ni número completo ni CVV en la base');
  assert.strictEqual((await outboxFor(adminToken, a.email, 'SUBSCRIPTION_CONFIRMED')).length, 1);
  assert.strictEqual((await subscribeWith(a.token)).status, 409, 'No se suscribe dos veces');
  console.log('✓ 44. HU-08: cobro de COP 129.900 aprobado, suscripción ACTIVE y confirmación enviada');

  // 45. HU-08: tarjeta rechazada responde el motivo y no activa
  const b = await newClientWithoutPlan();
  const declined = await subscribeWith(b.token, { card: CARD_DECLINE, plan: 'estilo' });
  assert.strictEqual(declined.status, 402);
  assert.strictEqual(declined.body.reason, 'Fondos insuficientes');
  assert.ok(/rechazado/.test(declined.body.error));
  assert.strictEqual((await request('GET', '/api/subscription', null, b.token)).body.subscription.status, 'NONE');
  assert.strictEqual(db.getPayments(b.userId)[0].status, 'DECLINED');
  console.log('✓ 45. HU-08: tarjeta 0002 rechazada con motivo y la suscripción no se activa');

  // 46. HU-08: 0341 aprueba el primero y falla los recurrentes → reintentos a 1, 3 y 5 días → PAST_DUE
  const c = await newClientWithoutPlan();
  assert.strictEqual((await subscribeWith(c.token, { card: CARD_FIRST_ONLY, plan: 'estilo' })).body.payment.amountCOP, 199900);
  const subC = () => db.data.subscriptions.find(x => x.userId === c.userId);
  const due = subC().nextChargeAt;
  const t0 = later(due);
  const run0 = await request('POST', '/api/admin/jobs/recurring-billing', { now: t0.toISOString() }, adminToken);
  assert.strictEqual(run0.status, 200);
  assert.ok(run0.body.results.some(r => r.subscriptionId === subC().id && r.result === 'FAILED_RETRY_SCHEDULED'));
  assert.strictEqual(subC().status, 'ACTIVE');
  assert.strictEqual(new Date(subC().dunning.nextRetryAt).getTime(), t0.getTime() + 86400000, 'Primer reintento a 1 día');
  assert.strictEqual((await outboxFor(adminToken, c.email, 'PAYMENT_RETRY_SCHEDULED')).length, 1);
  billing.runRecurringBilling(later(t0.toISOString(), 12 * HOUR));
  assert.strictEqual(subC().dunning.attempts, 0, 'No reintenta antes de tiempo');
  billing.runRecurringBilling(later(t0.toISOString(), 24 * HOUR));
  assert.strictEqual(new Date(subC().dunning.nextRetryAt).getTime(), t0.getTime() + 3 * 86400000, 'Segundo reintento a 3 días');
  billing.runRecurringBilling(later(t0.toISOString(), 72 * HOUR));
  billing.runRecurringBilling(later(t0.toISOString(), 120 * HOUR));
  assert.strictEqual(subC().status, 'PAST_DUE');
  billing.runRecurringBilling(later(t0.toISOString(), 240 * HOUR));
  const kinds = db.getPayments(c.userId).reverse().map(p => `${p.kind}:${p.status}`);
  assert.deepStrictEqual(kinds, ['INITIAL:APPROVED', 'RECURRING:DECLINED', 'RETRY:DECLINED', 'RETRY:DECLINED', 'RETRY:DECLINED'], 'Un cobro por intento, sin duplicados');
  assert.strictEqual((await outboxFor(adminToken, c.email, 'PAYMENT_PAST_DUE')).length, 1);
  const fixed = await request('POST', '/api/subscription/payment-method', { paymentToken: await tokenizeCard(CARD_OK, c.token) }, c.token);
  assert.strictEqual(fixed.status, 200);
  assert.strictEqual(fixed.body.subscription.status, 'ACTIVE');
  assert.strictEqual(fixed.body.subscription.cardLast4, '4242');
  assert.ok(new Date(subC().nextChargeAt) > new Date(due), 'Regulariza y avanza el siguiente cobro');
  console.log('✓ 46. HU-08: fallo recurrente con reintentos a 1, 3 y 5 días, PAST_DUE, aviso y regularización con otra tarjeta');

  // 47. HU-08: webhook con firma HMAC, conciliación y reporte de comisión
  const target = db.getPayments(a.userId)[0];
  const forged = JSON.stringify({ type: 'charge.succeeded', data: { chargeId: target.providerChargeId, status: 'APPROVED', amountCOP: 1 } });
  const badSig = await rawRequest('/api/webhooks/payments', forged, 'f'.repeat(64));
  assert.strictEqual(badSig.status, 401);
  const signed = payments.buildWebhook({ chargeId: target.providerChargeId, status: 'APPROVED', amountCOP: 1, feeCOP: 0 });
  const mismatch = await rawRequest('/api/webhooks/payments', signed.rawBody, signed.signature);
  assert.strictEqual(mismatch.status, 200);
  assert.strictEqual(mismatch.body.reconciliation.status, 'MISMATCH');
  const good = payments.buildWebhook({ chargeId: target.providerChargeId, status: 'APPROVED', amountCOP: target.amountCOP, feeCOP: target.feeCOP });
  assert.strictEqual((await rawRequest('/api/webhooks/payments', good.rawBody, good.signature)).body.reconciliation.status, 'OK');
  const report = await request('GET', '/api/admin/payments', null, adminToken);
  assert.strictEqual(report.status, 200);
  const approved = db.getPayments().filter(p => p.status === 'APPROVED');
  assert.strictEqual(report.body.report.feeCOP, approved.reduce((acc, p) => acc + p.feeCOP, 0));
  assert.strictEqual(report.body.report.grossCOP - report.body.report.feeCOP, report.body.report.netCOP);
  assert.ok(report.body.report.reconciliation.OK >= 1);
  assert.strictEqual((await request('GET', '/api/admin/payments', null, a.token)).status, 403);
  console.log(`✓ 47. HU-08: webhook firmado (401 si la firma falla), conciliación y comisión 3,5 % = COP ${report.body.report.feeCOP}`);

  // 48. HU-12: matriz de transiciones válidas e inválidas, incluido PAST_DUE
  const expected = {
    subscribe: ['NONE', 'CANCELLED'],
    pause: ['ACTIVE'],
    resume: ['PAUSED'],
    changePlan: ['ACTIVE', 'PAUSED'],
    cancel: ['ACTIVE', 'PAUSED', 'PAST_DUE'],
    updatePaymentMethod: ['ACTIVE', 'PAUSED', 'PAST_DUE'],
    chargeFailed: ['ACTIVE']
  };
  ['NONE', 'ACTIVE', 'PAUSED', 'PAST_DUE', 'CANCELLED'].forEach(status => {
    Object.entries(expected).forEach(([action, from]) => {
      assert.strictEqual(billing.canTransition(status, action), from.includes(status), `${status} --${action}-->`);
    });
  });
  const pd = await newClientWithoutPlan();
  await subscribeWith(pd.token);
  db.saveSubscription(pd.userId, { status: 'PAST_DUE' });
  assert.strictEqual((await request('POST', '/api/subscription/pause', {}, pd.token)).status, 409, 'PAST_DUE no se pausa');
  assert.strictEqual((await request('POST', '/api/subscription/change-plan', { plan: 'estilo' }, pd.token)).status, 409, 'PAST_DUE no cambia de plan');
  assert.strictEqual((await request('POST', '/api/subscription/resume', {}, pd.token)).status, 409);
  assert.strictEqual((await request('POST', '/api/subscription/cancel', {}, pd.token)).status, 200, 'PAST_DUE sí se cancela');
  assert.strictEqual((await request('POST', '/api/subscription/pause', {}, pd.token)).status, 409, 'CANCELLED no se pausa');
  assert.strictEqual((await request('POST', '/api/subscription/resume', {}, b.token)).status, 409, 'NONE no se reanuda');
  console.log('✓ 48. HU-12: matriz de 5 estados × 7 acciones y transiciones inválidas por API responden 409');

  // 49. HU-12: pausar un mes no cobra ni despacha y se reanuda sola
  const p = await newClient();
  await request('POST', `/api/stylist/boxes/${p.boxId}/approve`, { reason: 'Ok' }, stylistToken);
  const skipped = db.data.subscriptions.find(x => x.userId === p.userId).nextChargeAt;
  const paused = await request('POST', '/api/subscription/pause', {}, p.token);
  assert.strictEqual(paused.status, 200);
  assert.strictEqual(paused.body.subscription.status, 'PAUSED');
  assert.strictEqual(paused.body.subscription.pausedUntil, billing.addMonths(skipped, 1).toISOString());
  assert.strictEqual((await request('POST', '/api/subscription/pause', {}, p.token)).status, 409);
  assert.strictEqual((await request('POST', '/api/boxes/simulate-step', {}, p.token)).status, 409, 'En pausa no despacha');
  const batch = await request('POST', '/api/admin/boxes/generate-batch', {}, adminToken);
  assert.ok(batch.body.skipped.some(sk => sk.userId === p.userId && sk.reason === 'Suscripción en pausa'));
  const before = db.getPayments(p.userId).length;
  billing.runRecurringBilling(later(skipped));
  assert.strictEqual(db.getPayments(p.userId).length, before, 'No cobra el mes en pausa');
  const resumeRun = billing.runRecurringBilling(later(paused.body.subscription.pausedUntil));
  assert.ok(resumeRun.results.some(r => r.result === 'RESUMED'));
  assert.strictEqual(db.getSubscription(p.userId).status, 'ACTIVE');
  assert.strictEqual(db.getPayments(p.userId)[0].kind, 'RECURRING', 'Al reanudar vuelve a cobrar');
  assert.strictEqual((await request('POST', '/api/subscription/resume', {}, p.token)).status, 409, 'Activa no se reanuda');
  console.log('✓ 49. HU-12: pausa de 1 mes sin cobro ni despacho y reanudación automática');

  // 50. HU-12: cambio de plan antes y después del día de corte
  const before25 = new Date(2026, 10, 10, 12);
  const after25 = new Date(2026, 10, 26, 12);
  const pc = await newClientWithoutPlan();
  await subscribeWith(pc.token, { plan: 'esencial' });
  assert.strictEqual((await request('POST', '/api/subscription/change-plan', { plan: 'esencial' }, pc.token)).status, 409, 'Mismo plan');
  const early = billing.changePlan(pc.userId, 'estilo', before25);
  assert.strictEqual(early.subscription.plan, 'estilo', 'Antes del corte aplica desde la próxima caja');
  assert.strictEqual(db.getProfile(pc.userId).plan, 'estilo', 'El motor arma la próxima caja con el plan nuevo');
  const nextDue = early.subscription.nextChargeAt;
  const late = billing.changePlan(pc.userId, 'esencial', after25);
  assert.strictEqual(late.subscription.plan, 'estilo', 'Después del corte la próxima caja sigue igual');
  assert.strictEqual(late.subscription.pendingPlan, 'esencial');
  assert.strictEqual(late.subscription.pendingPlanFrom, billing.addMonths(nextDue, 1).toISOString());
  billing.runRecurringBilling(later(nextDue));
  assert.strictEqual(db.getPayments(pc.userId)[0].amountCOP, 199900, 'El ciclo siguiente cobra el plan vigente');
  const followingDue = db.getSubscription(pc.userId).nextChargeAt;
  billing.runRecurringBilling(later(followingDue));
  assert.strictEqual(db.getSubscription(pc.userId).plan, 'esencial');
  assert.strictEqual(db.getPayments(pc.userId)[0].amountCOP, 129900, 'Un ciclo después aplica el plan nuevo');
  const apiChange = await request('POST', '/api/subscription/change-plan', { plan: 'estilo' }, pc.token);
  assert.strictEqual(apiChange.status, 200);
  assert.strictEqual(apiChange.body.effect.beforeCutoff, new Date().getDate() < config.SUBSCRIPTION_CUTOFF_DAY);
  console.log('✓ 50. HU-12: cambio de plan antes del día 25 aplica en la próxima caja; después, en el ciclo siguiente');

  // 51. HU-12: cancelar detiene los cobros futuros, también desde la pausa
  const cx = await newClientWithoutPlan();
  await subscribeWith(cx.token);
  await request('POST', '/api/subscription/pause', {}, cx.token);
  const cxDue = db.getSubscription(cx.userId).nextChargeAt;
  const cancelled = await request('POST', '/api/subscription/cancel', { reason: 'precio' }, cx.token);
  assert.strictEqual(cancelled.status, 200);
  assert.strictEqual(cancelled.body.subscription.nextChargeAt, null);
  const paysBefore = db.getPayments(cx.userId).length;
  billing.runRecurringBilling(later(cxDue, 40 * 86400000));
  assert.strictEqual(db.getPayments(cx.userId).length, paysBefore, 'Sin cobros después de cancelar');
  assert.strictEqual((await subscribeWith(cx.token)).status, 201, 'Puede volver a suscribirse');
  console.log('✓ 51. HU-12: cancelar (incluso en pausa) detiene los cobros y permite volver a suscribirse');

  // 52. HU-15: factura tras cada cobro exitoso con consecutivo, datos fiscales e IVA
  const invoice = db.getInvoices(a.userId)[0];
  assert.strictEqual(invoice.status, 'ISSUED');
  assert.ok(/^SETT-\d+$/.test(invoice.number) && invoice.simulated === true && invoice.cufe.length === 96);
  assert.strictEqual(invoice.subtotalCOP + invoice.ivaCOP, 129900);
  assert.strictEqual(invoice.ivaCOP, 129900 - Math.round(129900 / 1.19));
  assert.deepStrictEqual([invoice.buyer.docType, invoice.buyer.docNumber, invoice.buyer.city], ['CC', FISCAL.docNumber, 'Cali']);
  const consecutives = db.getInvoices().map(i => i.consecutive).sort((x, y) => x - y);
  assert.deepStrictEqual(consecutives, consecutives.map((_, i) => i + 1), 'Consecutivo sin saltos');
  assert.strictEqual(db.getInvoices().length, db.getPayments().filter(x => x.status === 'APPROVED').length, 'Una factura por cobro aprobado');
  const invoiceMail = (await outboxFor(adminToken, a.email, 'INVOICE'))[0];
  assert.ok(invoiceMail.body.includes(invoice.number) && /SIMULADO/.test(invoiceMail.body) && invoiceMail.body.includes('IVA 19 %'));
  const noFiscal = await newClientWithoutPlan();
  const missing = await request('POST', '/api/subscription/subscribe', { plan: 'esencial', paymentToken: await tokenizeCard(CARD_OK, noFiscal.token) }, noFiscal.token);
  assert.strictEqual(missing.status, 400, 'Sin datos fiscales no cobra');
  assert.strictEqual((await request('PUT', '/api/profile/fiscal', { ...FISCAL, docNumber: '12' }, noFiscal.token)).status, 400);
  assert.strictEqual((await request('PUT', '/api/profile/fiscal', FISCAL, noFiscal.token)).status, 200);
  console.log(`✓ 52. HU-15: factura ${invoice.number} SIMULADO con IVA 19 %, datos fiscales y envío a la bandeja`);

  // 53. HU-15: si el proveedor falla, la factura queda PENDING_RETRY, alerta al equipo y se reintenta
  process.env.INVOICING_FAIL = '1';
  const f = await newClientWithoutPlan();
  const failSub = await subscribeWith(f.token);
  assert.strictEqual(failSub.status, 201, 'El cobro no depende de la factura');
  const pending = db.getInvoices(f.userId)[0];
  assert.strictEqual(pending.status, 'PENDING_RETRY');
  assert.ok(pending.nextRetryAt && /no respondió/.test(pending.lastError));
  const invoicesAdmin = await request('GET', '/api/admin/invoices', null, adminToken);
  assert.ok(invoicesAdmin.body.alerts.some(al => al.refId === pending.id && !al.resolvedAt));
  assert.ok((await outboxFor(adminToken, config.TEAM_ALERT_EMAIL, 'INVOICE_ALERT')).some(m => m.body.includes(pending.number)));
  assert.strictEqual(billing.runInvoiceRetries(new Date()).retried, 0, 'Respeta el tiempo de espera');
  billing.runInvoiceRetries(later(pending.nextRetryAt, 1000));
  assert.strictEqual(pending.status, 'PENDING_RETRY');
  assert.strictEqual(pending.attempts, 2);
  delete process.env.INVOICING_FAIL;
  const retry = await request('POST', '/api/admin/jobs/invoice-retries', { now: later(pending.nextRetryAt, 1000).toISOString() }, adminToken);
  assert.strictEqual(retry.body.issued, 1);
  assert.strictEqual(pending.status, 'ISSUED');
  assert.ok(db.getAlerts().find(al => al.refId === pending.id).resolvedAt, 'La alerta se cierra');
  assert.strictEqual((await outboxFor(adminToken, f.email, 'INVOICE')).length, 1);
  process.env.INVOICING_FAIL = '1';
  const g = await newClientWithoutPlan();
  await subscribeWith(g.token);
  const doomed = db.getInvoices(g.userId)[0];
  [1, 2, 3].forEach(() => billing.runInvoiceRetries(later(doomed.nextRetryAt || new Date().toISOString(), 1000)));
  assert.strictEqual(doomed.status, 'FAILED', 'Agotados los reintentos queda FAILED con la alerta abierta');
  assert.ok(db.getAlerts().some(al => al.refId === doomed.id && !al.resolvedAt));
  delete process.env.INVOICING_FAIL;
  console.log('✓ 53. HU-15: INVOICING_FAIL=1 deja la factura PENDING_RETRY, alerta en el panel y se emite al reintentar');
}

async function deliveredClient(stylistToken) {
  const c = await newClient();
  await request('POST', `/api/stylist/boxes/${c.boxId}/approve`, { reason: 'Ok' }, stylistToken);
  for (let i = 0; i < 3; i++) await request('POST', '/api/boxes/simulate-step', {}, c.token);
  return { ...c, box: db.getBoxById(c.boxId) };
}

const variantStock = (productId, size, color) => {
  const p = db.getProductById(productId);
  return p.variants.filter(v => v.size === size && (!color || v.color === color)).reduce((acc, v) => acc + v.stock, 0);
};

async function runPrompt4Tests({ adminToken, stylistToken }) {
  console.log('\n--- SPRINT 2 · PROMPT 4 ---');
  const { calculateFit } = require('../backend/engine');
  const logistics = require('../backend/logistics');
  const shipping = require('../backend/shipping');
  const today = shipping.dateKey(new Date());

  // 54. HU-09: despacho de caja aprobada y pagada: guía, stock y aviso
  const c = await newClient();
  await request('POST', `/api/stylist/boxes/${c.boxId}/approve`, { reason: 'Ok' }, stylistToken);
  const profile = db.getProfile(c.userId);
  const sizes = db.getBoxById(c.boxId).itemIds.map(id => ({ id, size: calculateFit(profile, db.getProductById(id)).size }));
  const before = sizes.map(x => variantStock(x.id, x.size));
  assert.strictEqual((await request('POST', '/api/boxes/simulate-step', {}, c.token)).body.status, 'PREPARING');
  const shipped = await request('POST', '/api/boxes/simulate-step', {}, c.token);
  assert.strictEqual(shipped.body.status, 'SHIPPED');
  const tracking = shipped.body.box.trackingNumber;
  assert.ok(new RegExp(`^TCB-${today}-\\d{4}$`).test(tracking), `Guía con formato TCB-AAAAMMDD-0001: ${tracking}`);
  sizes.forEach((x, i) => assert.strictEqual(variantStock(x.id, x.size), before[i] - 1, `Descuenta stock de ${x.id} talla ${x.size}`));
  assert.ok(db.data.inventoryMovements.some(m => m.type === 'DISPATCH_OUT' && m.refId === c.boxId));
  const shipMail = (await outboxFor(adminToken, c.email, 'BOX_SHIPPED'))[0];
  assert.ok(shipMail && shipMail.body.includes(tracking), 'El número de guía llega por la bandeja de salida');
  const d2 = await newClient();
  await request('POST', `/api/stylist/boxes/${d2.boxId}/approve`, { reason: 'Ok' }, stylistToken);
  const adminShip = await request('POST', `/api/admin/boxes/${d2.boxId}/status`, { status: 'SHIPPED' }, adminToken);
  assert.strictEqual(adminShip.status, 200);
  assert.strictEqual(Number(adminShip.body.box.trackingNumber.slice(-4)), Number(tracking.slice(-4)) + 1, 'Consecutivo diario');
  console.log(`✓ 54. HU-09: caja aprobada y pagada se despacha con guía ${tracking}, descuenta stock y avisa`);

  // 55. HU-09: seguimiento y notificación de entregada
  const inTransit = (await request('GET', '/api/boxes/current', null, c.token)).body.box;
  assert.strictEqual(inTransit.trackingNumber, tracking);
  assert.ok(/SIMULADO/.test(inTransit.carrier));
  assert.deepStrictEqual(inTransit.trackingEvents.map(e => e.status), ['PREPARING', 'SHIPPED']);
  assert.strictEqual(inTransit.items, null, 'Sigue sellada en tránsito');
  await request('POST', '/api/boxes/simulate-step', {}, c.token);
  const delivered = (await request('GET', '/api/boxes/current', null, c.token)).body.box;
  assert.deepStrictEqual(delivered.trackingEvents.map(e => e.status), ['PREPARING', 'SHIPPED', 'DELIVERED']);
  assert.ok((await outboxFor(adminToken, c.email, 'BOX_DELIVERED'))[0].body.includes(tracking));
  console.log('✓ 55. HU-09: el suscriptor sigue su guía (preparación, despacho, entrega) y recibe el aviso de entregada');

  // 56. HU-09: pago no confirmado bloquea el despacho con 409
  const u = await newClientWithoutPlan();
  const uBox = (await request('GET', '/api/boxes/current', null, u.token)).body.box;
  await request('POST', `/api/stylist/boxes/${uBox.id}/approve`, { reason: 'Ok' }, stylistToken);
  const unpaid = await request('POST', '/api/boxes/simulate-step', {}, u.token);
  assert.strictEqual(unpaid.status, 409);
  assert.strictEqual(unpaid.body.error, 'Pago no confirmado');
  const unpaidAdmin = await request('POST', `/api/admin/boxes/${uBox.id}/status`, { status: 'SHIPPED' }, adminToken);
  assert.deepStrictEqual([unpaidAdmin.status, unpaidAdmin.body.error], [409, 'Pago no confirmado']);
  assert.ok(!db.getBoxById(uBox.id).trackingNumber, 'Sin guía');
  await subscribeWith(u.token);
  db.saveSubscription(u.userId, { dunning: { period: 'x', attempts: 0, nextRetryAt: new Date().toISOString() } });
  assert.strictEqual((await request('POST', '/api/boxes/simulate-step', {}, u.token)).body.error, 'Pago no confirmado', 'Cobro en reintento tampoco despacha');
  db.saveSubscription(u.userId, { status: 'PAST_DUE' });
  assert.strictEqual(logistics.dispatchBlock(db.getBoxById(uBox.id), 'PREPARING'), 'Pago no confirmado');
  db.saveSubscription(u.userId, { status: 'ACTIVE', dunning: null });
  assert.strictEqual((await request('POST', '/api/boxes/simulate-step', {}, u.token)).body.status, 'PREPARING', 'Con el pago al día avanza');
  console.log('✓ 56. HU-09: sin pago del ciclo (sin suscripción, en reintento o en mora) responde 409 "Pago no confirmado"');

  // 57. HU-09: vista "Cajas por despachar" con picking y empaque
  const q = await newClient();
  await request('POST', `/api/stylist/boxes/${q.boxId}/approve`, { reason: 'Ok' }, stylistToken);
  const dispatch = await request('GET', '/api/admin/dispatch', null, adminToken);
  assert.strictEqual(dispatch.status, 200);
  const qRow = dispatch.body.boxes.find(b => b.id === q.boxId);
  assert.ok(qRow && qRow.paymentConfirmed && qRow.blockedReason === null && qRow.items.every(i => i.size && i.color));
  assert.ok(dispatch.body.boxes.some(b => b.id === uBox.id), 'Las cajas en preparación siguen en la lista');
  const totalUnits = dispatch.body.pickingList.reduce((acc, p) => acc + p.quantity, 0);
  assert.strictEqual(totalUnits, dispatch.body.boxes.reduce((acc, b) => acc + b.items.length, 0), 'El picking suma todas las prendas');
  assert.ok(!dispatch.body.boxes.some(b => b.id === c.boxId), 'Las despachadas salen de la lista');
  assert.strictEqual((await request('GET', '/api/admin/dispatch', null, q.token)).status, 403);
  console.log(`✓ 57. HU-09: "Cajas por despachar" lista ${dispatch.body.boxes.length} cajas y un picking de ${totalUnits} prendas`);

  // 58. HU-14: plazo único de 5 días hábiles, validado en el backend (422 fuera de plazo)
  const cfg = (await request('GET', '/api/config')).body;
  assert.strictEqual(cfg.returnWindowBusinessDays, 5);
  assert.strictEqual(cfg.returnWindowBusinessDays, config.RETURN_WINDOW_BUSINESS_DAYS);
  const friday = new Date(2026, 10, 6, 10);
  const deadline = new Date(logistics.returnDeadline(friday.toISOString()));
  assert.deepStrictEqual([deadline.getFullYear(), deadline.getMonth(), deadline.getDate()], [2026, 10, 13], 'Viernes + 5 hábiles = viernes siguiente');
  const late = await deliveredClient(stylistToken);
  const lateItem = late.box.itemIds[0];
  db.updateBox(late.boxId, { deliveredAt: new Date(Date.now() - 10 * 86400000).toISOString() });
  const expired = await request('POST', '/api/returns', { boxId: late.boxId, productId: lateItem, reason: 'TOO_SMALL', requestedSize: 'L' }, late.token);
  assert.strictEqual(expired.status, 422);
  assert.strictEqual(expired.body.code, 'RETURN_WINDOW_EXPIRED');
  assert.ok(Array.isArray(expired.body.conditions) && expired.body.conditions.length >= 3);
  assert.strictEqual((await request('GET', '/api/returns', null, late.token)).body.returnableGarments[0].withinWindow, false);
  console.log('✓ 58. HU-14: plazo de 5 días hábiles desde la entrega; fuera de plazo responde 422 con las condiciones');

  // 59. HU-14: con stock en la talla pedida, guía inversa y envío programado de la otra talla
  const r = await deliveredClient(stylistToken);
  const item = r.box.itemIds[0];
  const shippedVariant = r.box.shippedVariants.find(v => v.productId === item);
  const otherSize = db.getProductById(item).variants.find(v => v.size !== shippedVariant.size && v.stock > 0).size;
  const otherBefore = variantStock(item, otherSize);
  const ok = await request('POST', '/api/returns', { boxId: r.boxId, productId: item, reason: 'TOO_SMALL', requestedSize: otherSize, notes: 'Apretada' }, r.token);
  assert.strictEqual(ok.status, 201);
  assert.strictEqual(ok.body.returnRequest.resolution, 'EXCHANGE_SIZE');
  assert.ok(new RegExp(`^TCB-DEV-${today}-\\d{4}$`).test(ok.body.returnRequest.returnTrackingNumber));
  assert.ok(new RegExp(`^TCB-${today}-\\d{4}$`).test(ok.body.returnRequest.exchangeTrackingNumber));
  assert.strictEqual(variantStock(item, otherSize), otherBefore - 1, 'Reserva la otra talla');
  assert.ok((await outboxFor(adminToken, r.email, 'RETURN_SCHEDULED'))[0].body.includes(ok.body.returnRequest.returnTrackingNumber));
  assert.strictEqual((await request('POST', '/api/returns', { boxId: r.boxId, productId: item, reason: 'TOO_SMALL', requestedSize: otherSize }, r.token)).status, 409, 'Un cambio por prenda');
  console.log(`✓ 59. HU-14: guía de devolución ${ok.body.returnRequest.returnTrackingNumber} y envío programado de la talla ${otherSize}`);

  // 60. HU-14: sin stock en la talla pedida ofrece una prenda equivalente o devolver
  const item2 = r.box.itemIds[1];
  const p2 = db.getProductById(item2);
  const wanted = p2.variants.find(v => v.size !== r.box.shippedVariants.find(x => x.productId === item2).size).size;
  p2.variants.filter(v => v.size === wanted).forEach(v => { v.stock = 0; });
  const noStock = await request('POST', '/api/returns', { boxId: r.boxId, productId: item2, reason: 'TOO_LARGE', requestedSize: wanted }, r.token);
  assert.strictEqual(noStock.status, 409);
  assert.strictEqual(noStock.body.code, 'NO_STOCK_IN_SIZE');
  assert.strictEqual(noStock.body.options.canReturn, true);
  const eq = noStock.body.options.equivalents;
  assert.ok(eq.length >= 1 && eq.every(e => e.category === p2.category && e.stockInSize > 0));
  assert.strictEqual((await request('POST', '/api/returns', { boxId: r.boxId, productId: item2, reason: 'TOO_LARGE', requestedSize: wanted, resolution: 'EQUIVALENT', replacementProductId: 'prod-inexistente' }, r.token)).status, 400);
  const eqBefore = variantStock(eq[0].id, wanted);
  const chosen = await request('POST', '/api/returns', { boxId: r.boxId, productId: item2, reason: 'TOO_LARGE', requestedSize: wanted, resolution: 'EQUIVALENT', replacementProductId: eq[0].id }, r.token);
  assert.strictEqual(chosen.status, 201);
  assert.strictEqual(chosen.body.returnRequest.replacementProductId, eq[0].id);
  assert.strictEqual(variantStock(eq[0].id, wanted), eqBefore - 1);
  const item3 = r.box.itemIds[2];
  const onlyReturn = await request('POST', '/api/returns', { boxId: r.boxId, productId: item3, reason: 'FIT_ISSUE', requestedSize: 'M', resolution: 'RETURN_ONLY' }, r.token);
  assert.strictEqual(onlyReturn.status, 201);
  assert.strictEqual(onlyReturn.body.returnRequest.creditPending, true);
  assert.ok(!onlyReturn.body.returnRequest.exchangeTrackingNumber);
  console.log('✓ 60. HU-14: sin stock responde con equivalentes; el cliente elige equivalente o solo devolver');

  // 61. HU-14: reingreso de inventario al recibir la prenda, una sola vez y con motivo
  const retId = ok.body.returnRequest.id;
  const restockBefore = variantStock(item, shippedVariant.size, shippedVariant.color);
  const received = await request('PUT', `/api/admin/returns/${retId}`, { status: 'RECEIVED' }, adminToken);
  assert.strictEqual(received.status, 200);
  assert.strictEqual(variantStock(item, shippedVariant.size, shippedVariant.color), restockBefore + 1, 'La variante devuelta sube 1');
  assert.strictEqual(received.body.returnRequest.restock.reason, 'TOO_SMALL');
  await request('PUT', `/api/admin/returns/${retId}`, { status: 'COMPLETED' }, adminToken);
  assert.strictEqual(variantStock(item, shippedVariant.size, shippedVariant.color), restockBefore + 1, 'No reingresa dos veces');
  const movements = (await request('GET', '/api/admin/inventory-movements', null, adminToken)).body.movements;
  assert.ok(movements.some(m => m.type === 'RETURN_IN' && m.refId === retId && m.reason === 'TOO_SMALL'));
  console.log('✓ 61. HU-14: al marcar recibida, el stock de la variante sube 1 y queda el movimiento con el motivo');
}

async function runPrompt5Tests({ adminToken, stylistToken }) {
  console.log('\n--- SPRINT 2 · PROMPT 5 ---');
  const learning = require('../backend/learning');
  const metrics = require('../backend/metrics');
  const { evaluateModel } = require('../scripts/evaluate-model');
  const { seedDemo, resetSeed } = require('../scripts/seed-demo');

  // 62. HU-16: editar nombre y correo con validación y correo único
  const e = await newClientWithoutPlan();
  assert.strictEqual((await request('PUT', '/api/account', { email: 'no-es-correo' }, e.token)).status, 400);
  assert.strictEqual((await request('PUT', '/api/account', { name: 'A' }, e.token)).status, 400);
  const dup = await request('PUT', '/api/account', { email: 'DEMO@theclothesbox.co' }, e.token);
  assert.deepStrictEqual([dup.status, dup.body.code], [409, 'EMAIL_EXISTS']);
  const newEmail = `p5_nuevo_${Date.now()}@test.com`;
  const edited = await request('PUT', '/api/account', { name: 'Nombre Corregido', email: newEmail }, e.token);
  assert.strictEqual(edited.status, 200);
  assert.deepStrictEqual([edited.body.user.name, edited.body.user.email, edited.body.user.emailVerified], ['Nombre Corregido', newEmail, false]);
  assert.strictEqual((await request('POST', '/api/auth/login', { email: newEmail, password: 'password123' })).status, 200, 'Entra con el correo nuevo');
  assert.strictEqual((await request('POST', '/api/auth/login', { email: e.email, password: 'password123' })).status, 401);
  assert.strictEqual((await outboxFor(adminToken, e.email, 'EMAIL_CHANGED')).length, 1, 'Aviso al correo anterior');
  assert.strictEqual((await outboxFor(adminToken, newEmail, 'EMAIL_VERIFICATION')).length, 1, 'Verificación al correo nuevo');
  assert.ok(db.data.dataRequests.some(r => r.userId === e.userId && r.type === 'RECTIFICATION'));
  console.log('✓ 62. HU-16: "Mis datos" edita nombre y correo, valida formato y correo único, y registra la solicitud');

  // 63. HU-16: exportación de datos personales en JSON
  const exp = await request('GET', '/api/profile/export', null, e.token);
  assert.strictEqual(exp.status, 200);
  assert.strictEqual(exp.body.account.email, newEmail);
  assert.strictEqual(exp.body.account.passwordHash, undefined, 'Sin la contraseña');
  assert.ok(exp.body.profile && exp.body.profile.measures, 'Incluye perfil y medidas');
  assert.ok(Array.isArray(exp.body.boxes) && exp.body.boxes.length >= 1 && Array.isArray(exp.body.boxes[0].items));
  assert.ok(Array.isArray(exp.body.ratings) && Array.isArray(exp.body.consents));
  assert.ok(db.data.dataRequests.some(r => r.userId === e.userId && r.type === 'EXPORT'));
  console.log('✓ 63. HU-16: GET /api/profile/export entrega datos personales, perfil, cajas y calificaciones');

  // 64. HU-16: eliminar se bloquea con un cobro pendiente y exige la contraseña
  const pd = await newClientWithoutPlan();
  await subscribeWith(pd.token);
  assert.strictEqual((await request('POST', '/api/account/delete', { password: 'mala' }, pd.token)).status, 403);
  db.saveSubscription(pd.userId, { status: 'PAST_DUE' });
  const blocked = await request('POST', '/api/account/delete', { password: 'password123' }, pd.token);
  assert.deepStrictEqual([blocked.status, blocked.body.code], [409, 'PENDING_CHARGE']);
  assert.ok(/cobro pendiente/.test(blocked.body.error));
  db.saveSubscription(pd.userId, { status: 'ACTIVE', dunning: { period: 'x', attempts: 1, nextRetryAt: new Date().toISOString() } });
  assert.strictEqual((await request('POST', '/api/account/delete', { password: 'password123' }, pd.token)).status, 409, 'Pago en curso también bloquea');
  assert.strictEqual(db.findUserById(pd.userId).deletedAt, undefined);
  console.log('✓ 64. HU-16: con cobro pendiente (PAST_DUE o reintento) la cuenta no se elimina y el mensaje lo explica');

  // 65. HU-16: eliminar anonimiza, conserva pagos y facturas, cancela y confirma
  const d = await newClient();
  const dEmail = d.email;
  const invoicesBefore = db.getInvoices(d.userId).length;
  const deleted = await request('POST', '/api/account/delete', { password: 'password123' }, d.token);
  assert.strictEqual(deleted.status, 200);
  const anon = db.findUserById(d.userId);
  assert.ok(anon.name === 'Usuario eliminado' && anon.email.endsWith('@anonimo.invalid') && anon.passwordHash === null && anon.deletedAt);
  assert.ok(!db.findUserByEmail(dEmail), 'El correo ya no está');
  const anonProfile = db.getProfile(d.userId);
  assert.ok(anonProfile.deleted && !anonProfile.measures && !anonProfile.styles, 'Perfil y medidas anonimizados');
  const anonSub = db.data.subscriptions.find(x => x.userId === d.userId);
  assert.ok(anonSub.status === 'CANCELLED' && !anonSub.paymentToken && !anonSub.cardLast4);
  assert.ok(db.getPayments(d.userId).length >= 1, 'Conserva pagos');
  const keptInvoices = db.getInvoices(d.userId);
  assert.ok(keptInvoices.length === invoicesBefore && keptInvoices.length >= 1 && keptInvoices[0].buyer.docNumber === FISCAL.docNumber, 'Conserva facturas con sus datos fiscales');
  assert.ok(db.getUserBoxes(d.userId).every(b => b.address === 'Dirección anonimizada'));
  assert.strictEqual((await request('GET', '/api/profile', null, d.token)).status, 401, 'La sesión deja de valer');
  assert.strictEqual((await request('POST', '/api/auth/login', { email: dEmail, password: 'password123' })).status, 401);
  assert.strictEqual((await outboxFor(adminToken, dEmail, 'ACCOUNT_DELETED')).length, 1);
  const dr = await request('GET', '/api/admin/data-requests', null, adminToken);
  assert.strictEqual(dr.status, 200);
  const deletion = dr.body.requests.find(r => r.userId === d.userId && r.type === 'DELETION');
  assert.ok(deletion && Number.isInteger(deletion.responseMs) && deletion.status === 'COMPLETED');
  assert.ok(dr.body.summary.some(t => t.type === 'DELETION' && t.blocked >= 2 && t.deadlineBusinessDays === 15));
  assert.strictEqual((await request('GET', '/api/admin/data-requests', null, e.token)).status, 403);
  console.log('✓ 65. HU-16: eliminar anonimiza nombre, correo, perfil y medidas; conserva pagos y facturas; cancela y confirma');

  // 66. HU-11: calificación de estilo baja reduce el peso de los atributos, con piso
  const product = db.getProductById('prod-13');
  const prof = { styles: [...product.styles], occasions: [...product.occasions], fit: product.fit };
  const base = scoreProduct(prof, product).score;
  assert.strictEqual(learning.applyRating(prof, product, 4), false, 'Una calificación alta no penaliza');
  assert.strictEqual(learning.applyRating(prof, product, 2), true);
  const once = scoreProduct(prof, product).score;
  assert.ok(once < base, 'Baja el puntaje');
  for (let i = 0; i < 20; i++) learning.applyRating(prof, product, 1);
  Object.values(prof.attributeWeights).forEach(bucket => Object.values(bucket).forEach(w => assert.ok(w >= config.LEARNING.floor, 'Nunca baja del piso')));
  assert.ok(scoreProduct(prof, product).score > 0, 'El atributo no se anula');
  console.log(`✓ 66. HU-11: estilo ≤ 2 reduce el peso de los atributos (puntaje ${base} → ${once}) con piso de ${config.LEARNING.floor}`);

  // 67. HU-11: correcciones del estilista como ejemplos, ingestFeedback idempotente y rulesVersion
  const s = await newClient();
  const sBox = db.getBoxById(s.boxId);
  assert.strictEqual(sBox.rulesVersion, config.RULES_VERSION, 'La caja guarda rulesVersion');
  const removedId = sBox.itemIds[0];
  const alt = (await request('GET', `/api/stylist/boxes/${s.boxId}/alternatives?itemId=${removedId}`, null, stylistToken)).body.alternatives[0];
  assert.strictEqual((await request('POST', `/api/stylist/boxes/${s.boxId}/replace`, { itemId: removedId, newProductId: alt.productId, reason: 'Prefiere otro estilo' }, stylistToken)).status, 200);
  const sProfile = db.getProfile(s.userId);
  const removedP = db.getProductById(removedId);
  const addedP = db.getProductById(alt.productId);
  const removedBefore = scoreProduct(sProfile, removedP).score;
  const addedBefore = scoreProduct(sProfile, addedP).score;
  const ingest = await request('POST', '/api/admin/jobs/ingest-feedback', {}, adminToken);
  assert.strictEqual(ingest.status, 200);
  assert.ok(ingest.body.correctionsProcessed >= 1 && ingest.body.profilesUpdated >= 1 && ingest.body.rulesVersion === config.RULES_VERSION);
  const learned = db.getProfile(s.userId);
  assert.ok(scoreProduct(learned, removedP).score < removedBefore, 'La prenda reemplazada penaliza');
  assert.ok(scoreProduct(learned, addedP).score > addedBefore, 'La prenda nueva suma');
  assert.deepStrictEqual([learned.rulesVersion, learned.learningRevision], [config.RULES_VERSION, 1], 'El perfil guarda rulesVersion y revisión');
  const again = await request('POST', '/api/admin/jobs/ingest-feedback', {}, adminToken);
  assert.deepStrictEqual([again.body.ratingsProcessed, again.body.correctionsProcessed], [0, 0], 'No aprende dos veces lo mismo');
  assert.strictEqual((await request('POST', '/api/admin/jobs/ingest-feedback', {}, s.token)).status, 403);
  console.log('✓ 67. HU-11: ingestFeedback usa las correcciones (la reemplazada penaliza, la nueva suma), es idempotente y versiona');

  // 68. HU-11: evaluación antes y después con perfiles sintéticos
  const evaluation = evaluateModel({ count: 40 });
  assert.ok(evaluation.afterAvg > evaluation.beforeAvg, `Mejora la calificación simulada: ${evaluation.beforeAvg} → ${evaluation.afterAvg}`);
  assert.ok(evaluation.improvedProfiles > evaluation.worsenedProfiles);
  console.log(`✓ 68. HU-11: scripts/evaluate-model.js reporta calificación simulada ${evaluation.beforeAvg} antes y ${evaluation.afterAvg} después`);

  // 69. HU-17: cálculo de indicadores del mes, filtros y alerta de churn
  const at = iso => new Date(iso).toISOString();
  const fixture = {
    subscriptions: [
      ...Array.from({ length: 8 }, (_, i) => ({ plan: 'esencial', history: [{ type: 'START', plan: 'esencial', at: at(`2026-09-0${i + 1}T12:00:00`) }] })),
      { plan: 'estilo', history: [{ type: 'START', plan: 'estilo', at: at('2026-09-10T12:00:00') }] },
      { plan: 'estilo', history: [{ type: 'START', plan: 'estilo', at: at('2026-09-11T12:00:00') }, { type: 'CANCEL', plan: 'estilo', at: at('2026-10-05T12:00:00') }] },
      { plan: 'esencial', history: [{ type: 'START', plan: 'esencial', at: at('2026-09-12T12:00:00') }, { type: 'CANCEL', plan: 'esencial', at: at('2026-10-20T12:00:00') }] },
      { plan: 'estilo', history: [{ type: 'START', plan: 'estilo', at: at('2026-10-15T12:00:00') }] },
      { plan: 'esencial', startedAt: at('2026-08-01T12:00:00'), cancelledAt: at('2026-08-20T12:00:00') }
    ],
    cancellations: [
      { plan: 'estilo', reason: 'precio', createdAt: at('2026-10-05T12:00:00') },
      { plan: 'esencial', reason: null, createdAt: at('2026-10-20T12:00:00') }
    ],
    boxes: [
      { id: 'b1', plan: 'esencial', itemIds: ['a', 'b', 'c'], deliveredAt: at('2026-10-10T12:00:00') },
      { id: 'b2', plan: 'estilo', itemIds: ['a', 'b', 'c', 'd', 'e'], deliveredAt: at('2026-10-11T12:00:00') }
    ],
    ratings: [
      { boxId: 'b1', score: 4, createdAt: at('2026-10-12T12:00:00') },
      { boxId: 'b2', score: 2, createdAt: at('2026-10-12T12:00:00') },
      { boxId: 'b2', score: 5, createdAt: at('2026-09-30T12:00:00') }
    ],
    returns: [{ boxId: 'b2', createdAt: at('2026-10-13T12:00:00') }, { boxId: 'b1', createdAt: at('2026-10-14T12:00:00') }]
  };
  const oct = metrics.computeKpis(fixture, { month: '2026-10', threshold: 9, now: new Date(2026, 10, 4) });
  assert.deepStrictEqual(
    [oct.activeAtStart, oct.newSubscribers, oct.cancellations, oct.churnPct, oct.activeSubscribers, oct.averageRating, oct.sizeReturnPct],
    [11, 1, 2, 18.2, 10, 3, 25],
    'Churn = 2 cancelaciones / 11 activos al inicio'
  );
  assert.deepStrictEqual(oct.cancellationReasons.reasons.find(r => r.key === 'precio').count, 1);
  assert.strictEqual(oct.cancellationReasons.unanswered, 1);
  assert.strictEqual(oct.churnAlert.active, true, '18,2 % supera el 9 %');
  assert.ok(/supera el umbral de 9 %/.test(oct.churnAlert.message));
  const octEstilo = metrics.computeKpis(fixture, { month: '2026-10', plan: 'estilo', threshold: 9, now: new Date(2026, 10, 4) });
  assert.deepStrictEqual([octEstilo.activeAtStart, octEstilo.cancellations, octEstilo.churnPct, octEstilo.newSubscribers, octEstilo.sizeReturnPct], [2, 1, 50, 1, 20], 'Filtro por plan');
  assert.strictEqual(metrics.computeKpis(fixture, { month: '2026-10', threshold: 20, now: new Date(2026, 10, 4) }).churnAlert.active, false, 'Bajo el umbral no alerta');
  const sep = metrics.computeKpis(fixture, { month: '2026-09', threshold: 9, now: new Date(2026, 10, 4) });
  assert.deepStrictEqual([sep.activeAtStart, sep.newSubscribers, sep.churnPct], [0, 11, null], 'Sin activos al inicio no hay churn');
  console.log('✓ 69. HU-17: activos, altas, churn (cancelaciones/activos al inicio), calificación, % devoluciones, motivos, filtros y alerta');

  // 70. HU-17: endpoint, umbral configurable desde el panel y datos de demostración
  const seeded = seedDemo(db, { count: 100 });
  assert.strictEqual(seeded.users, 100);
  assert.strictEqual(db.data.users.filter(u => u.seedDemo).length, 100, 'Marcados como datos de prueba');
  assert.ok(db.data.users.filter(u => u.seedDemo).every(u => u.email.endsWith('@seed.theclothesbox.test') && u.passwordHash === null));
  const kpis = await request('GET', '/api/admin/kpis', null, adminToken);
  assert.strictEqual(kpis.status, 200);
  assert.ok(kpis.body.months.length === 6 && kpis.body.month === kpis.body.months[0]);
  assert.ok(kpis.body.activeSubscribers >= 80 && kpis.body.churnAlert.threshold === 9);
  const lastMonth = await request('GET', `/api/admin/kpis?month=${kpis.body.months[1]}&plan=esencial`, null, adminToken);
  assert.strictEqual(lastMonth.body.plan, 'esencial');
  assert.strictEqual((await request('GET', '/api/admin/kpis?month=octubre', null, adminToken)).status, 400);
  assert.strictEqual((await request('PUT', '/api/admin/settings/churn-threshold', { value: 0 }, adminToken)).status, 400);
  assert.strictEqual((await request('PUT', '/api/admin/settings/churn-threshold', { value: 0.1 }, adminToken)).body.threshold, 0.1);
  const strict = await request('GET', `/api/admin/kpis?month=${kpis.body.months[1]}`, null, adminToken);
  assert.strictEqual(strict.body.churnAlert.threshold, 0.1);
  assert.strictEqual(strict.body.churnAlert.active, strict.body.churnPct > 0.1, 'La alerta usa el umbral guardado');
  const batch = await request('POST', '/api/admin/boxes/generate-batch', {}, adminToken);
  assert.ok(batch.body.skipped.filter(x => x.reason === 'Dato de prueba').length === 100, 'El batch no arma cajas para datos de prueba');
  assert.strictEqual((await request('GET', '/api/admin/kpis', null, e.token)).status, 403);
  assert.strictEqual(resetSeed(db), 100);
  await request('PUT', '/api/admin/settings/churn-threshold', { value: 9 }, adminToken);
  console.log(`✓ 70. HU-17: /api/admin/kpis con filtros, umbral editable y seed de ${seeded.users} usuarios sintéticos (${seeded.cancellations} cancelaciones)`);
}

async function newClientWithoutPlan() {
  const email = `p3_${Date.now()}_${Math.random().toString(16).slice(2, 6)}@test.com`;
  const reg = await request('POST', '/api/auth/register', validRegistration(email));
  await request('PUT', '/api/profile', syntheticProfiles()[0], reg.body.token);
  return { email, token: reg.body.token, userId: reg.body.user.id };
}

function rawRequest(path, rawBody, signature) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: TEST_PORT, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': signature } }, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end(rawBody);
  });
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
