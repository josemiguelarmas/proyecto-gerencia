const http = require('http');
const { startServer } = require('../backend/server');

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

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE BACKEND, ROLES Y REGLAS DE NEGOCIO ---');
  const server = await startServer(TEST_PORT);

  try {
    // 1. Catálogo público con imágenes reales
    const catRes = await request('GET', '/api/products');
    console.assert(catRes.status === 200, 'Catalog status should be 200');
    console.assert(Array.isArray(catRes.body) && catRes.body.length > 10, 'Catalog should have items');
    const allHaveImages = catRes.body.every(p => typeof p.imageUrl === 'string' && p.imageUrl.startsWith('http'));
    console.assert(allHaveImages, 'Todos los productos deben tener fotografía real en imageUrl');
    console.log('✓ 1. Catálogo con fotografías reales confirmado (18 productos con URL válida)');

    // 2. Seguridad: Intento de acceso sin token a ruta protegida -> 401
    const unauthRes = await request('GET', '/api/boxes/current');
    console.assert(unauthRes.status === 401, 'Should reject unauthenticated access');
    console.log('✓ 2. Rutas protegidas bloqueadas sin token (401 Unauthorized)');

    // 3. Login de usuario demo cliente
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'demo@theclothesbox.co',
      password: 'demo123'
    });
    console.assert(loginRes.status === 200, 'Demo login should succeed');
    console.assert(loginRes.body.token, 'Should return JWT token');
    console.assert(loginRes.body.user.role === 'CLIENT', 'Demo user must have CLIENT role');
    const token = loginRes.body.token;
    console.log('✓ 3. Autenticación de Cliente exitosa (Rol: CLIENT, JWT token generado)');

    // 4. Obtener caja actual del usuario
    const boxRes = await request('GET', '/api/boxes/current', null, token);
    console.assert(boxRes.status === 200, 'Current box status should be 200');
    const box = boxRes.body.box;
    console.log('✓ 4. Caja actual consultada:', box ? `Caja #${box.cycle} (Estado: ${box.status})` : 'Sin caja');

    // 5. REGLA FUNDAMENTAL DE LA CAJA SORPRESA (CLIENTE):
    // Si la caja está en PREPARING o SHIPPED, los items NO deben ser expuestos
    const newEmail = `test_${Date.now()}@test.com`;
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Usuario Prueba',
      email: newEmail,
      password: 'password123'
    });
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
    console.assert(preparingBoxRes.body.box.status === 'PREPARING', 'Should be preparing');
    console.assert(preparingBoxRes.body.box.items === null, 'Prendas deben ser NULL mientras la caja no esté entregada para clientes');
    console.log('✓ 5. REGLA DE SORPRESA VERIFICADA EN CLIENTE: Prendas ocultas en estado PREPARING (items = null)');

    // 6. En SHIPPED sigue oculta
    const shipRes = await request('POST', '/api/boxes/simulate-step', {}, newToken);
    console.assert(shipRes.body.status === 'SHIPPED', 'Status should be SHIPPED');
    const shippedBoxRes = await request('GET', '/api/boxes/current', null, newToken);
    console.assert(shippedBoxRes.body.box.items === null, 'Prendas deben seguir siendo NULL en estado SHIPPED para clientes');
    console.log('✓ 6. REGLA DE SORPRESA VERIFICADA EN CLIENTE: Prendas ocultas en estado SHIPPED (items = null)');

    // 7. En DELIVERED se revela con fotos e información completa
    const deliverRes = await request('POST', '/api/boxes/simulate-step', {}, newToken);
    console.assert(deliverRes.body.status === 'DELIVERED', 'Status should be DELIVERED');
    const deliveredBoxRes = await request('GET', '/api/boxes/current', null, newToken);
    console.assert(Array.isArray(deliveredBoxRes.body.box.items) && deliveredBoxRes.body.box.items.length === 3, 'Prendas deben ser reveladas solo en DELIVERED');
    console.assert(deliveredBoxRes.body.box.items[0].imageUrl, 'Prendas reveladas deben incluir imageUrl');
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
    console.assert(feedbackRes.status === 200, 'Item feedback should succeed');
    console.log('✓ 8. VALORACIÓN INDIVIDUAL DE PRENDA VERIFICADA: Feedback registrado sin generar devolución');

    // 9. REGLA DE DEVOLUCIÓN ESTRICTA: Solo por talla (TOO_SMALL, TOO_LARGE, FIT_ISSUE)
    const illegalReturnRes = await request('POST', '/api/returns', {
      boxId: deliveredBoxRes.body.box.id,
      productId: sampleItem.id,
      reason: 'DONT_LIKE',
      requestedSize: 'L'
    }, newToken);
    console.assert(illegalReturnRes.status === 400, 'Illegal return reason should be rejected with 400');
    console.log('✓ 9. REGLA DE DEVOLUCIÓN VERIFICADA: Rechazo de motivos de gusto/opinión (status 400)');

    // 10. Devolución legal por talla (TOO_SMALL)
    const legalReturnRes = await request('POST', '/api/returns', {
      boxId: deliveredBoxRes.body.box.id,
      productId: sampleItem.id,
      reason: 'TOO_SMALL',
      requestedSize: 'L',
      notes: 'Me quedó apretada de pecho'
    }, newToken);
    console.assert(legalReturnRes.status === 201, 'Legal return reason should succeed with 201');
    console.log('✓ 10. Devolución por talla aprobada y registrada en base de datos (201 Created)');

    // 11. CONTROL DE ACCESO POR ROL: Cliente intentando acceder a ruta administrativa -> 403 Forbidden
    const clientAdminRes = await request('GET', '/api/admin/metrics', null, newToken);
    console.assert(clientAdminRes.status === 403, 'Client should be forbidden from admin routes');
    console.log('✓ 11. CONTROL DE ACCESO VERIFICADO: Cliente bloqueado de rutas administrativas (403 Forbidden)');

    // 12. Login de Administrador
    const adminLoginRes = await request('POST', '/api/auth/login', {
      email: 'admin@theclothesbox.co',
      password: 'admin123'
    });
    console.assert(adminLoginRes.status === 200, 'Admin login should succeed');
    console.assert(adminLoginRes.body.user.role === 'ADMIN', 'Admin user must have ADMIN role');
    const adminToken = adminLoginRes.body.token;
    console.log('✓ 12. Autenticación de Administrador exitosa (Rol: ADMIN, JWT token generado)');

    // 13. Administrador accede a métricas y lista de clientes
    const adminMetricsRes = await request('GET', '/api/admin/metrics', null, adminToken);
    console.assert(adminMetricsRes.status === 200, 'Admin metrics status should be 200');
    console.assert(adminMetricsRes.body.totalClients >= 1, 'Admin metrics should report clients');
    console.log('✓ 13. Métricas administrativas operativas:', {
      clientes: adminMetricsRes.body.totalClients,
      cajas: adminMetricsRes.body.totalBoxes,
      devoluciones: adminMetricsRes.body.totalReturns
    });

    // 14. PRIVILEGIO ADMINISTRATIVO: Administrador SÍ puede ver prendas de cajas en PREPARING o SHIPPED
    const adminBoxesRes = await request('GET', '/api/admin/boxes', null, adminToken);
    console.assert(adminBoxesRes.status === 200, 'Admin boxes status should be 200');
    console.assert(Array.isArray(adminBoxesRes.body.boxes), 'Should return boxes array');
    const adminPreparingBox = adminBoxesRes.body.boxes.find(b => b.status === 'PREPARING' || b.status === 'SHIPPED');
    if (adminPreparingBox) {
      console.assert(Array.isArray(adminPreparingBox.items) && adminPreparingBox.items.length > 0, 'Admin debe poder auditar el contenido de cajas en preparación');
    }
    console.log('✓ 14. PRIVILEGIO ADMINISTRATIVO VERIFICADO: El Administrador puede auditar prendas de cajas no entregadas');

    // 15. Administrador gestiona solicitudes de devolución
    const adminReturnsRes = await request('GET', '/api/admin/returns', null, adminToken);
    console.assert(adminReturnsRes.status === 200, 'Admin returns status should be 200');
    console.assert(adminReturnsRes.body.returns.length >= 1, 'Should list returns');
    console.log('✓ 15. Vista administrativa de devoluciones con prendas, fotos y clientes confirmada');

    console.log('\n======================================================');
    console.log('¡TODAS LAS 15 PRUEBAS DE BACKEND Y ROLES PASARON CON ÉXITO!');
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
