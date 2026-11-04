const { db, verifyPassword } = require('./database');
const { signToken, authenticateRequest } = require('./auth');
const { calculateFit, curateBox, explainProduct } = require('./engine');
const { importCatalogCsv, stockInSize } = require('./catalog');
const config = require('./config');
const mail = require('./mail');
const { runReviewReminders } = require('./jobs');
const billing = require('./billing');
const logistics = require('./logistics');
const payments = require('./payments');

// Edad cumplida a partir de una fecha YYYY-MM-DD. Devuelve null si la fecha no es válida.
function ageFromBirthDate(birthDate, now = new Date()) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const birth = new Date(Date.UTC(y, m - 1, d));
  if (birth.getUTCMonth() !== m - 1 || birth > now) return null;
  let age = now.getUTCFullYear() - y;
  const beforeBirthday = now.getUTCMonth() < m - 1 || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d);
  if (beforeBirthday) age--;
  return age;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'CLIENT',
    emailVerified: user.emailVerified,
    fiscal: user.fiscal || null
  };
}

function sendVerificationEmail(user) {
  const token = db.createAuthToken(user.id, 'EMAIL_VERIFY', null);
  mail.send({
    to: user.email,
    type: 'EMAIL_VERIFICATION',
    subject: 'Confirma tu correo en The Clothes Box',
    body: `Hola ${user.name}, confirma tu correo abriendo este enlace: ${config.APP_BASE_URL}/#/verificar?token=${token}`
  });
}

// Un puntaje de 1 a 5, o undefined si no se envió. Lanza error si viene fuera de rango.
function parseScore(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    const err = new Error(`La calificación de ${label} debe ser un número entero de 1 a 5.`);
    err.status = 400;
    throw err;
  }
  return n;
}

// HU-07: estados que significan que la caja ya pasó la revisión del estilista.
// Las cajas creadas antes de HU-07 (PREPARING, SHIPPED…) se consideran aprobadas.
const UNAPPROVED_STATUSES = ['PROPOSED', 'REJECTED'];
const OPEN_BOX_STATUSES = ['PROPOSED', 'APPROVED', 'PREPARING', 'SHIPPED', 'CREATED'];
const NOT_APPROVED_ERROR = 'La caja no ha sido aprobada';

function createCuratedBox(userId, profile, { cycle, address, receivedIds = [], excludeIds = [] }) {
  const curated = curateBox(profile, db.catalog, receivedIds, { excludeIds });
  const box = db.createBox(userId, {
    cycle,
    status: 'PROPOSED',
    plan: profile.plan || 'esencial',
    address,
    itemIds: curated.itemIds,
    recommendations: curated.recommendations,
    totalCostCOP: curated.totalCostCOP,
    targetCostCOP: curated.targetCostCOP,
    withinCap: curated.withinCap
  });
  return { box, curated };
}

function logReview(box, user, action, reason, details = {}) {
  const entry = { action, by: user.id, byName: user.name, role: user.role, at: new Date().toISOString(), reason: reason || '', ...details };
  box.reviewLog = [...(box.reviewLog || []), entry];
  return entry;
}

// Vista de una caja para el estilista: perfil del suscriptor y prendas con su explicación.
function stylistBoxView(box) {
  const user = db.findUserById(box.userId);
  const profile = db.getProfile(box.userId) || {};
  return {
    id: box.id,
    cycle: box.cycle,
    status: box.status,
    plan: box.plan,
    createdAt: box.createdAt,
    totalCostCOP: box.totalCostCOP,
    targetCostCOP: box.targetCostCOP,
    withinCap: box.withinCap,
    reviewLog: box.reviewLog || [],
    subscriber: user ? { id: user.id, name: user.name, email: user.email } : null,
    profile: {
      styles: profile.styles || [],
      occasions: profile.occasions || [],
      fit: profile.fit,
      line: profile.line,
      plan: profile.plan,
      measures: profile.measures || {},
      styleWeights: profile.styleWeights || null
    },
    items: (box.itemIds || []).map(id => {
      const p = db.getProductById(id);
      if (!p) return null;
      const rec = (box.recommendations || []).find(x => x.productId === id) || explainProduct(profile, p);
      const fit = calculateFit(profile, p);
      return { ...p, cut: p.fit, fit, recommendation: rec, stockInSize: stockInSize(p, fit.size) };
    }).filter(Boolean)
  };
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// HU-08: el webhook se verifica con HMAC sobre el cuerpo exacto, sin reinterpretarlo.
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Fecha opcional para simular el paso del tiempo en los jobs del administrador.
function parseNow(value) {
  if (!value) return new Date();
  const d = new Date(value);
  if (isNaN(d)) {
    const err = new Error('La fecha de simulación no es válida (usa AAAA-MM-DD).');
    err.status = 400;
    throw err;
  }
  return d;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApiRequest(req, res, pathname) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    // ----------------------------------------------------
    // 1. PUBLIC ROUTES
    // ----------------------------------------------------
    if (pathname === '/api/products' && req.method === 'GET') {
      return sendJson(res, 200, db.catalog);
    }

    if (pathname === '/api/config' && req.method === 'GET') {
      return sendJson(res, 200, {
        minAge: config.MIN_AGE,
        cancellationReasons: config.CANCELLATION_REASONS,
        plans: Object.fromEntries(Object.entries(config.PLANS).map(([k, p]) => [k, { name: p.name, priceCOP: p.priceCOP, items: p.items }])),
        cutoffDay: config.SUBSCRIPTION_CUTOFF_DAY,
        fiscalDocTypes: config.FISCAL_DOC_TYPES,
        paymentProvider: payments.name,
        returnWindowBusinessDays: config.RETURN_WINDOW_BUSINESS_DAYS,
        returnConditions: config.RETURN_CONDITIONS,
        testCards: payments.name === 'simulated' ? payments.testCards : []
      });
    }

    // HU-08: webhook de la pasarela, firmado con HMAC en la cabecera X-Signature
    if (pathname === '/api/webhooks/payments' && req.method === 'POST') {
      const rawBody = await readRawBody(req);
      const result = billing.processPaymentWebhook(rawBody, req.headers['x-signature']);
      return sendJson(res, result.status, result.body);
    }

    if (pathname === '/api/policy' && req.method === 'GET') {
      return sendJson(res, 200, config.POLICY);
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const { name, email, password, birthDate, acceptedPolicy, policyVersion } = await parseJsonBody(req);
      if (!name || !email || !password || !birthDate) {
        return sendJson(res, 400, { error: 'Nombre, correo, fecha de nacimiento y contraseña son obligatorios.' });
      }
      // HU-02: sin consentimiento explícito no se crea la cuenta
      if (acceptedPolicy !== true || !policyVersion) {
        return sendJson(res, 400, { error: 'El consentimiento es obligatorio', code: 'CONSENT_REQUIRED' });
      }
      if (policyVersion !== config.POLICY.version) {
        return sendJson(res, 400, { error: `La versión de la política aceptada (${policyVersion}) no es la vigente (${config.POLICY.version}). Recarga la página.`, code: 'POLICY_OUTDATED' });
      }
      const age = ageFromBirthDate(birthDate);
      if (age === null) {
        return sendJson(res, 400, { error: 'La fecha de nacimiento no es válida.' });
      }
      if (age < config.MIN_AGE) {
        return sendJson(res, 400, { error: `Debes ser mayor de ${config.MIN_AGE} años para crear una cuenta en The Clothes Box.`, code: 'UNDERAGE' });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: 'La contraseña debe tener al menos 6 caracteres.' });
      }
      if (db.findUserByEmail(email)) {
        return sendJson(res, 409, { error: 'Este correo ya está registrado', code: 'EMAIL_EXISTS' });
      }
      const user = db.createUser(name, email, password, 'CLIENT', { birthDate, emailVerified: false });
      db.addConsent(user.id, { accepted: true, policyVersion });
      sendVerificationEmail(user);
      const token = signToken({ userId: user.id });
      return sendJson(res, 201, { token, user: publicUser(user) });
    }

    // HU-01: recuperación de contraseña. La respuesta es la misma exista o no el correo.
    if (pathname === '/api/auth/forgot' && req.method === 'POST') {
      const { email } = await parseJsonBody(req);
      if (!email) {
        return sendJson(res, 400, { error: 'Escribe el correo de tu cuenta.' });
      }
      const user = db.findUserByEmail(email);
      if (user) {
        const token = db.createAuthToken(user.id, 'PASSWORD_RESET', config.PASSWORD_RESET_TTL_MS);
        mail.send({
          to: user.email,
          type: 'PASSWORD_RESET',
          subject: 'Recupera tu contraseña de The Clothes Box',
          body: `Hola ${user.name}, para crear una nueva contraseña abre este enlace (vence en 1 hora y sirve una sola vez): ${config.APP_BASE_URL}/#/restablecer?token=${token}`
        });
      }
      return sendJson(res, 200, {
        success: true,
        message: 'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña. Vence en 1 hora.'
      });
    }

    if (pathname === '/api/auth/reset' && req.method === 'POST') {
      const { token, password } = await parseJsonBody(req);
      if (!password || password.length < 6) {
        return sendJson(res, 400, { error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      }
      const record = db.consumeAuthToken(token, 'PASSWORD_RESET');
      if (!record) {
        return sendJson(res, 400, { error: 'El enlace no es válido, ya se usó o venció. Solicita uno nuevo.' });
      }
      db.setPassword(record.userId, password);
      return sendJson(res, 200, { success: true, message: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' });
    }

    if (pathname === '/api/auth/verify-email' && req.method === 'POST') {
      const { token } = await parseJsonBody(req);
      const record = db.consumeAuthToken(token, 'EMAIL_VERIFY');
      if (!record) {
        return sendJson(res, 400, { error: 'El enlace de verificación no es válido o ya se usó.' });
      }
      db.updateUser(record.userId, { emailVerified: true, emailVerifiedAt: new Date().toISOString() });
      return sendJson(res, 200, { success: true, message: 'Tu correo quedó verificado.' });
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const { email, password } = await parseJsonBody(req);
      if (!email || !password) {
        return sendJson(res, 400, { error: 'Correo y contraseña requeridos.' });
      }
      const user = db.findUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
      }
      const token = signToken({ userId: user.id });
      const profile = db.getProfile(user.id);
      return sendJson(res, 200, {
        token,
        user: publicUser(user),
        profile
      });
    }

    // ----------------------------------------------------
    // 2. AUTHENTICATED COMMON ROUTES
    // ----------------------------------------------------
    const authUser = authenticateRequest(req);
    if (!authUser) {
      return sendJson(res, 401, { error: 'Acceso no autorizado. Inicia sesión para continuar.' });
    }

    // Auth Me
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const profile = db.getProfile(authUser.id);
      return sendJson(res, 200, { user: publicUser(db.findUserById(authUser.id)), profile });
    }

    if (pathname === '/api/auth/resend-verification' && req.method === 'POST') {
      const user = db.findUserById(authUser.id);
      if (user.emailVerified !== false) {
        return sendJson(res, 200, { success: true, message: 'Tu correo ya está verificado.' });
      }
      sendVerificationEmail(user);
      return sendJson(res, 200, { success: true, message: `Te enviamos un nuevo enlace a ${user.email}.` });
    }

    // ----------------------------------------------------
    // 3a. STYLIST ROUTES (Roles: STYLIST y ADMIN) — HU-07
    // ----------------------------------------------------
    if (pathname.startsWith('/api/stylist/')) {
      if (authUser.role !== 'STYLIST' && authUser.role !== 'ADMIN') {
        return sendJson(res, 403, { error: 'Acceso denegado: se requiere rol de Estilista.' });
      }

      if (pathname === '/api/stylist/queue' && req.method === 'GET') {
        const boxes = db.data.boxes
          .filter(b => b.status === 'PROPOSED')
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map(stylistBoxView);
        return sendJson(res, 200, { boxes });
      }

      // Alternativas para reemplazar una prenda: misma categoría, con stock en la talla del suscriptor.
      const altMatch = pathname.match(/^\/api\/stylist\/boxes\/([^/]+)\/alternatives$/);
      if (altMatch && req.method === 'GET') {
        const box = db.getBoxById(altMatch[1]);
        if (!box) return sendJson(res, 404, { error: 'Caja no encontrada.' });
        const profile = db.getProfile(box.userId) || {};
        const alternatives = db.catalog
          .filter(p => !box.itemIds.includes(p.id))
          .map(p => ({ ...explainProduct(profile, p), name: p.name, brandName: p.brandName, category: p.category, imageUrl: p.imageUrl, stockInSize: stockInSize(p, calculateFit(profile, p).size) }))
          .filter(a => a.stockInSize > 0)
          .sort((a, b) => b.score - a.score);
        return sendJson(res, 200, { alternatives });
      }

      const actionMatch = pathname.match(/^\/api\/stylist\/boxes\/([^/]+)\/(approve|replace|reject)$/);
      if (actionMatch && req.method === 'POST') {
        const [, boxId, action] = actionMatch;
        const box = db.getBoxById(boxId);
        if (!box) return sendJson(res, 404, { error: 'Caja no encontrada.' });
        if (box.status !== 'PROPOSED') {
          return sendJson(res, 409, { error: `Solo se pueden revisar cajas propuestas. Esta caja está en ${box.status}.` });
        }
        const body = await parseJsonBody(req);
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        const profile = db.getProfile(box.userId) || {};

        if (action === 'approve') {
          logReview(box, authUser, 'APPROVE', reason);
          const updated = db.updateBox(box.id, { status: 'APPROVED', approvedAt: new Date().toISOString(), approvedBy: authUser.id });
          return sendJson(res, 200, { success: true, message: 'Caja aprobada. Queda lista para despacho.', box: stylistBoxView(updated) });
        }

        if (!reason) {
          return sendJson(res, 400, { error: 'Escribe el motivo de la corrección.' });
        }

        if (action === 'replace') {
          const { itemId, newProductId } = body;
          if (!box.itemIds.includes(itemId)) {
            return sendJson(res, 400, { error: 'La prenda a reemplazar no está en esta caja.' });
          }
          const newProduct = db.getProductById(newProductId);
          if (!newProduct) return sendJson(res, 404, { error: 'La prenda nueva no existe en el catálogo.' });
          if (box.itemIds.includes(newProductId)) {
            return sendJson(res, 400, { error: 'La prenda nueva ya está en la caja.' });
          }
          const size = calculateFit(profile, newProduct).size;
          if (stockInSize(newProduct, size) <= 0) {
            return sendJson(res, 409, { error: `No hay stock de "${newProduct.name}" en talla ${size}, la talla del suscriptor.` });
          }
          const itemIds = box.itemIds.map(id => (id === itemId ? newProductId : id));
          const recommendations = (box.recommendations || []).filter(x => x.productId !== itemId)
            .concat({ ...explainProduct(profile, newProduct), chosenByStylist: true, explanation: `Elegida por tu estilista: ${reason}` });
          const totalCostCOP = itemIds.reduce((sum, id) => {
            const p = db.getProductById(id);
            return sum + (p ? p.wholesalePriceCOP || 0 : 0);
          }, 0);
          logReview(box, authUser, 'REPLACE', reason, { removedProductId: itemId, addedProductId: newProductId });
          db.addCorrection({ type: 'REPLACE', boxId: box.id, subscriberId: box.userId, stylistId: authUser.id, removedProductId: itemId, addedProductId: newProductId, reason });
          const updated = db.updateBox(box.id, { itemIds, recommendations, totalCostCOP, withinCap: box.targetCostCOP ? totalCostCOP <= box.targetCostCOP : null });
          return sendJson(res, 200, {
            success: true,
            message: updated.withinCap === false ? 'Prenda reemplazada. Atención: la caja ahora supera el costo objetivo.' : 'Prenda reemplazada.',
            box: stylistBoxView(updated)
          });
        }

        // reject: la propuesta se descarta y el motor arma una nueva sin esas prendas.
        const rejectedIds = box.itemIds.slice();
        logReview(box, authUser, 'REJECT', reason, { rejectedProductIds: rejectedIds });
        db.addCorrection({ type: 'REJECT', boxId: box.id, subscriberId: box.userId, stylistId: authUser.id, removedProductIds: rejectedIds, reason });
        const received = db.getUserBoxes(box.userId).filter(b => b.id !== box.id).flatMap(b => b.itemIds || []);
        const curated = curateBox(profile, db.catalog, received, { excludeIds: rejectedIds });
        const updated = db.updateBox(box.id, {
          itemIds: curated.itemIds,
          recommendations: curated.recommendations,
          totalCostCOP: curated.totalCostCOP,
          targetCostCOP: curated.targetCostCOP,
          withinCap: curated.withinCap,
          proposalVersion: (box.proposalVersion || 1) + 1
        });
        return sendJson(res, 200, {
          success: true,
          message: 'Propuesta rechazada. El motor armó una nueva propuesta sin esas prendas, que vuelve a la cola.',
          box: stylistBoxView(updated)
        });
      }

      return sendJson(res, 404, { error: `Endpoint de estilista no encontrado: ${req.method} ${pathname}` });
    }

    // ----------------------------------------------------
    // 3. ADMIN-ONLY ROUTES (Role: ADMIN)
    // ----------------------------------------------------
    if (pathname.startsWith('/api/admin/')) {
      if (authUser.role !== 'ADMIN') {
        return sendJson(res, 403, {
          error: 'Acceso denegado: se requiere rol de Administrador para gestionar esta sección.'
        });
      }

      // Admin Metrics
      if (pathname === '/api/admin/metrics' && req.method === 'GET') {
        const metrics = db.getAdminMetrics();
        return sendJson(res, 200, {
          ...metrics,
          quiz: { ...db.getQuizStats(), targetSec: config.QUIZ_TARGET_SECONDS },
          plans: config.PLANS
        });
      }

      // Admin Clients
      if (pathname === '/api/admin/clients' && req.method === 'GET') {
        const clients = db.getAllUsers();
        return sendJson(res, 200, { clients });
      }

      // Admin Products (List / Create / Update)
      if (pathname === '/api/admin/products' && req.method === 'GET') {
        return sendJson(res, 200, { products: db.catalog });
      }

      if (pathname === '/api/admin/products' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.name || !body.brandName || !body.category) {
          return sendJson(res, 400, { error: 'Nombre, marca y categoría son requeridos.' });
        }
        const saved = db.saveProduct(body);
        return sendJson(res, 201, { success: true, product: saved });
      }

      // HU-05: importación de catálogo por CSV (body JSON { csv })
      if (pathname === '/api/admin/products/import' && req.method === 'POST') {
        const { csv } = await parseJsonBody(req);
        if (typeof csv !== 'string' || !csv.trim()) {
          return sendJson(res, 400, { error: 'Adjunta un archivo CSV con contenido.' });
        }
        const report = importCatalogCsv(csv, db.catalog);
        if (report.fatal) return sendJson(res, 400, { error: report.fatal });
        if (report.imported > 0) db.saveCatalog();
        return sendJson(res, 200, { success: true, ...report });
      }

      // HU-06: genera la caja del mes para todos los suscriptores activos
      if (pathname === '/api/admin/boxes/generate-batch' && req.method === 'POST') {
        const now = new Date();
        const monthKey = now.toISOString().slice(0, 7);
        const generated = [];
        const skipped = [];
        db.data.users.filter(u => (u.role || 'CLIENT') === 'CLIENT').forEach(user => {
          // HU-08/HU-12: solo suscripciones pagadas y al día; en pausa o en mora no reciben caja.
          const sub = db.getSubscription(user.id);
          const profile = db.getProfile(user.id);
          if (sub.status !== 'ACTIVE' || !profile || !profile.done) {
            return skipped.push({ userId: user.id, reason: sub.status === 'PAUSED' ? 'Suscripción en pausa' : sub.status === 'PAST_DUE' ? 'Pago pendiente' : 'Sin suscripción activa' });
          }
          if (sub.dunning) {
            return skipped.push({ userId: user.id, reason: 'Cobro en reintento' });
          }
          const boxes = db.getUserBoxes(user.id);
          const latest = boxes[0];
          if (latest && OPEN_BOX_STATUSES.includes(latest.status)) {
            return skipped.push({ userId: user.id, reason: `Tiene una caja en curso (${latest.status})` });
          }
          if (latest && (latest.createdAt || '').slice(0, 7) === monthKey) {
            return skipped.push({ userId: user.id, reason: 'Ya tiene la caja de este mes' });
          }
          const { box, curated } = createCuratedBox(user.id, profile, {
            cycle: (latest ? latest.cycle : 0) + 1,
            address: (latest && latest.address) || profile.address || 'Cali, Colombia',
            receivedIds: boxes.flatMap(b => b.itemIds || [])
          });
          generated.push({ userId: user.id, boxId: box.id, withinCap: curated.withinCap, complete: curated.missingSlots.length === 0 });
        });
        const pct = fn => (generated.length ? Math.round((generated.filter(fn).length / generated.length) * 100) : null);
        return sendJson(res, 200, {
          success: true,
          month: monthKey,
          generatedCount: generated.length,
          skippedCount: skipped.length,
          withinCapPct: pct(g => g.withinCap),
          completePct: pct(g => g.complete),
          generated,
          skipped
        });
      }

      // HU-08: pagos, comisión de la pasarela, conciliación y suscripciones
      if (pathname === '/api/admin/payments' && req.method === 'GET') {
        const users = Object.fromEntries(db.data.users.map(u => [u.id, u]));
        const withUser = item => ({ ...item, userName: users[item.userId]?.name, userEmail: users[item.userId]?.email });
        return sendJson(res, 200, {
          report: billing.paymentsReport(),
          payments: db.getPayments().map(withUser),
          subscriptions: db.getAllSubscriptions().map(s => withUser(billing.publicSubscription(s)))
        });
      }

      if (pathname === '/api/admin/jobs/recurring-billing' && req.method === 'POST') {
        const { now } = await parseJsonBody(req);
        return sendJson(res, 200, { success: true, ...billing.runRecurringBilling(parseNow(now)) });
      }

      // HU-15: facturas, cola de reintentos y alertas para el equipo
      if (pathname === '/api/admin/invoices' && req.method === 'GET') {
        return sendJson(res, 200, {
          invoices: db.getInvoices(),
          alerts: db.getAlerts(),
          openAlerts: db.getAlerts().filter(a => !a.resolvedAt).length,
          provider: { name: 'simulated', environment: 'HABILITACION', failMode: process.env.INVOICING_FAIL === '1' }
        });
      }

      if (pathname === '/api/admin/jobs/invoice-retries' && req.method === 'POST') {
        const { now } = await parseJsonBody(req);
        return sendJson(res, 200, { success: true, ...billing.runInvoiceRetries(parseNow(now)) });
      }

      // Admin Boxes (Full visibility including items even in PREPARING or SHIPPED)
      if (pathname === '/api/admin/boxes' && req.method === 'GET') {
        const boxes = db.getAllBoxes();
        return sendJson(res, 200, { boxes });
      }

      const adminBoxStatusMatch = pathname.match(/^\/api\/admin\/boxes\/([^/]+)\/status$/);
      if (adminBoxStatusMatch && req.method === 'POST') {
        const boxId = adminBoxStatusMatch[1];
        const { status } = await parseJsonBody(req);
        if (status === 'APPROVED' || status === 'PROPOSED') {
          return sendJson(res, 400, { error: 'La aprobación se hace desde la cola del estilista para dejar registro de quién y por qué.' });
        }
        const validStatuses = ['CREATED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'RATED'];
        if (!validStatuses.includes(status)) {
          return sendJson(res, 400, { error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}` });
        }
        const target = db.getBoxById(boxId);
        if (!target) return sendJson(res, 404, { error: 'Caja no encontrada.' });
        if (UNAPPROVED_STATUSES.includes(target.status)) {
          return sendJson(res, 409, { error: NOT_APPROVED_ERROR });
        }
        // HU-09: despachar genera la guía, descuenta stock y avisa al suscriptor.
        const updated = logistics.advanceBox(target, status);
        return sendJson(res, 200, { success: true, box: updated });
      }

      // HU-09: cajas por despachar con lista de picking y empaque
      if (pathname === '/api/admin/dispatch' && req.method === 'GET') {
        return sendJson(res, 200, logistics.dispatchQueue());
      }

      // HU-09/HU-14: movimientos de inventario (despachos, cambios y reingresos)
      if (pathname === '/api/admin/inventory-movements' && req.method === 'GET') {
        return sendJson(res, 200, { movements: [...db.data.inventoryMovements].reverse().slice(0, 100) });
      }

      // Admin Returns (List & Update)
      if (pathname === '/api/admin/returns' && req.method === 'GET') {
        const returns = db.getAllReturns();
        return sendJson(res, 200, { returns });
      }

      const adminReturnMatch = pathname.match(/^\/api\/admin\/returns\/([^/]+)$/);
      if (adminReturnMatch && req.method === 'PUT') {
        const returnId = adminReturnMatch[1];
        const { status, notes } = await parseJsonBody(req);
        const updated = db.updateReturn(returnId, {
          ...(status ? { status } : {}),
          ...(notes ? { adminNotes: notes } : {})
        });
        if (!updated) {
          return sendJson(res, 404, { error: 'Solicitud de devolución no encontrada.' });
        }
        // HU-14: al recibir la prenda, su variante reingresa al inventario (una sola vez).
        if (status === 'RECEIVED' || status === 'COMPLETED') logistics.receiveReturn(updated);
        return sendJson(res, 200, { success: true, returnRequest: updated });
      }

      // Admin Feedback & Ratings List
      if (pathname === '/api/admin/feedback' && req.method === 'GET') {
        const ratings = db.getAllRatings();
        return sendJson(res, 200, { ratings });
      }

      // Bandeja de salida de correos simulados
      if (pathname === '/api/admin/outbox' && req.method === 'GET') {
        return sendJson(res, 200, { provider: mail.name, messages: mail.list() });
      }

      // HU-10: ejecución manual del recordatorio de calificación
      if (pathname === '/api/admin/jobs/review-reminders' && req.method === 'POST') {
        return sendJson(res, 200, { success: true, ...runReviewReminders() });
      }

      // HU-13: conteo agregado de motivos de cancelación (lo usa HU-17)
      if (pathname === '/api/admin/cancellation-reasons' && req.method === 'GET') {
        const keys = Object.keys(config.CANCELLATION_REASONS);
        const { total, counts, unanswered } = db.getCancellationReasonCounts(keys);
        return sendJson(res, 200, {
          total,
          unanswered,
          reasons: keys.map(key => ({ key, label: config.CANCELLATION_REASONS[key], count: counts[key] }))
        });
      }

      return sendJson(res, 404, { error: `Endpoint administrativo no encontrado: ${req.method} ${pathname}` });
    }

    // ----------------------------------------------------
    // 4. CLIENT / USER ROUTES
    // ----------------------------------------------------

    // Profile GET
    if (pathname === '/api/profile' && req.method === 'GET') {
      const profile = db.getProfile(authUser.id);
      return sendJson(res, 200, profile || {});
    }

    // Profile PUT
    if (pathname === '/api/profile' && req.method === 'PUT') {
      const { source, ...body } = await parseJsonBody(req);

      // HU-03: completar el quiz crea una nueva versión del perfil de estilo y cierra la sesión del quiz.
      let quizSession = null;
      if (source === 'quiz') {
        const previous = db.getProfile(authUser.id);
        const archived = db.archiveProfileVersion(authUser.id);
        body.version = archived ? archived.version + 1 : ((previous && previous.version) || 1);
        quizSession = db.completeQuizSession(authUser.id);
      }
      const profile = db.saveProfile(authUser.id, { ...body, done: true });

      // Si el usuario aún no tiene caja, el motor arma la primera y queda PROPOSED para el estilista (HU-07).
      let boxes = db.getUserBoxes(authUser.id);
      let activeBox = boxes.find(b => b.status !== 'RATED') || boxes[0];

      if (!activeBox) {
        activeBox = createCuratedBox(authUser.id, profile, {
          cycle: 1,
          address: body.address || 'Calle 18 # 122-135, Pance, Cali'
        }).box;
      }

      return sendJson(res, 200, { profile, boxId: activeBox.id, quizSession });
    }

    // HU-03: progreso parcial del quiz
    if (pathname === '/api/quiz/progress' && req.method === 'GET') {
      return sendJson(res, 200, { session: db.getOpenQuizSession(authUser.id) });
    }

    if (pathname === '/api/quiz/progress' && req.method === 'PUT') {
      const { step, answers, repeat } = await parseJsonBody(req);
      const stepNum = Number(step);
      if (!Number.isInteger(stepNum) || stepNum < 1 || stepNum > 4) {
        return sendJson(res, 400, { error: 'El paso del quiz debe estar entre 1 y 4.' });
      }
      const session = db.saveQuizProgress(authUser.id, { step: stepNum, answers: answers || {}, repeat });
      return sendJson(res, 200, { session });
    }

    // HU-03: historial de versiones del perfil de estilo
    if (pathname === '/api/profile/history' && req.method === 'GET') {
      const current = db.getProfile(authUser.id);
      return sendJson(res, 200, {
        currentVersion: current ? current.version || 1 : null,
        versions: db.getProfileVersions(authUser.id)
      });
    }

    // Current Box GET (CRITICAL RULE: Hides products until DELIVERED or RATED)
    if (pathname === '/api/boxes/current' && req.method === 'GET') {
      const boxes = db.getUserBoxes(authUser.id);
      const profile = db.getProfile(authUser.id) || { plan: 'esencial', measures: {} };

      const currentBox = boxes[0] || null;
      if (!currentBox) {
        return sendJson(res, 200, { box: null });
      }

      const isDeliveredOrRated = currentBox.status === 'DELIVERED' || currentBox.status === 'RATED';
      const boxRatings = db.getRatingsByBox(currentBox.id);

      const responsePayload = {
        id: currentBox.id,
        cycle: currentBox.cycle,
        status: currentBox.status,
        trackingNumber: currentBox.trackingNumber || null,
        carrier: currentBox.carrier || null,
        shippedAt: currentBox.shippedAt || null,
        trackingEvents: currentBox.trackingEvents || [],
        plan: currentBox.plan,
        itemsCount: (currentBox.itemIds || []).length,
        address: currentBox.address,
        estimatedDelivery: currentBox.estimatedDelivery,
        deliveredAt: currentBox.deliveredAt,
        createdAt: currentBox.createdAt,
        unboxed: !!currentBox.unboxed,
        // BACKEND RULE: If preparing or shipped, NEVER send items to the client!
        items: isDeliveredOrRated
          ? currentBox.itemIds.map(id => {
              const p = db.getProductById(id);
              if (!p) return null;
              const fit = calculateFit(profile, p);
              const userRating = boxRatings.find(r => r.productId === p.id) || null;
              const recommendation = (currentBox.recommendations || []).find(x => x.productId === p.id) || null;
              return { ...p, fit, userRating, recommendation };
            }).filter(Boolean)
          : null,
        ratings: isDeliveredOrRated ? boxRatings : []
      };

      return sendJson(res, 200, { box: responsePayload });
    }

    // Simulate Step POST (PREPARING -> SHIPPED -> DELIVERED)
    if (pathname === '/api/boxes/simulate-step' && req.method === 'POST') {
      const boxes = db.getUserBoxes(authUser.id);
      const currentBox = boxes[0];
      if (!currentBox) {
        return sendJson(res, 404, { error: 'No tienes ninguna caja activa.' });
      }

      // HU-07: el despacho se bloquea mientras el estilista no apruebe la caja
      if (UNAPPROVED_STATUSES.includes(currentBox.status)) {
        return sendJson(res, 409, { error: NOT_APPROVED_ERROR });
      }

      const NEXT = { APPROVED: 'PREPARING', CREATED: 'SHIPPED', PREPARING: 'SHIPPED', SHIPPED: 'DELIVERED' };
      if (!NEXT[currentBox.status]) {
        return sendJson(res, 200, { message: 'La caja ya fue entregada.', box: currentBox });
      }

      // HU-09/HU-12: pausa y pago del ciclo se validan en logistics.advanceBox (409)
      const updated = logistics.advanceBox(currentBox, NEXT[currentBox.status]);
      return sendJson(res, 200, { success: true, status: updated.status, box: updated });
    }

    // Unbox POST ("Tu caja llegó" Surprise celebration)
    const unboxMatch = pathname.match(/^\/api\/boxes\/([^/]+)\/unbox$/);
    if (unboxMatch && req.method === 'POST') {
      const boxId = unboxMatch[1];
      const box = db.getBoxById(boxId);
      if (!box || box.userId !== authUser.id) {
        return sendJson(res, 404, { error: 'Caja no encontrada.' });
      }
      if (box.status !== 'DELIVERED' && box.status !== 'RATED') {
        return sendJson(res, 403, { error: 'Aún no puedes abrir una caja que no ha sido entregada.' });
      }

      db.updateBox(boxId, { unboxed: true });
      const profile = db.getProfile(authUser.id) || {};
      const boxRatings = db.getRatingsByBox(boxId);
      const items = box.itemIds.map(id => {
        const p = db.getProductById(id);
        const userRating = boxRatings.find(r => r.productId === p.id) || null;
        const recommendation = (box.recommendations || []).find(x => x.productId === p.id) || null;
        return { ...p, fit: calculateFit(profile, p), userRating, recommendation };
      });

      return sendJson(res, 200, { success: true, items });
    }

    // Individual Item Feedback POST (Requisito 4: Descubrimiento y valoración de prendas individuales)
    const itemFeedbackMatch = pathname.match(/^\/api\/boxes\/([^/]+)\/item-feedback$/);
    if (itemFeedbackMatch && req.method === 'POST') {
      const boxId = itemFeedbackMatch[1];
      const box = db.getBoxById(boxId);
      if (!box || box.userId !== authUser.id) {
        return sendJson(res, 404, { error: 'Caja no encontrada.' });
      }
      if (box.status !== 'DELIVERED' && box.status !== 'RATED') {
        return sendJson(res, 403, { error: 'Solo puedes valorar prendas de una caja que ya ha sido entregada.' });
      }

      const body = await parseJsonBody(req);
      const { productId, liked, styleFeedback, preferenceNotes } = body;
      if (!productId || !box.itemIds.includes(productId)) {
        return sendJson(res, 400, { error: 'La prenda indicada no pertenece a esta caja.' });
      }

      // HU-10: ajuste y estilo se califican por separado (1 a 5). Se acepta calificar solo uno.
      // score sigue siendo el puntaje general que promedia el panel; si no llega, sale de los parciales.
      const fitScore = parseScore(body.fitScore, 'ajuste');
      const styleScore = parseScore(body.styleScore, 'estilo');
      const partials = [fitScore, styleScore].filter(v => v !== undefined);
      const score = parseScore(body.score, 'la prenda')
        ?? (partials.length ? Math.round(partials.reduce((a, b) => a + b, 0) / partials.length) : undefined);
      if (score === undefined) {
        return sendJson(res, 400, { error: 'Califica al menos el ajuste o el estilo de la prenda (1 a 5).' });
      }

      const savedRating = db.addRating(authUser.id, boxId, productId, {
        score,
        fitScore,
        styleScore,
        liked: liked !== false,
        styleFeedback: styleFeedback || '',
        feedback: preferenceNotes || styleFeedback || '',
        preferenceNotes: preferenceNotes || ''
      });

      // Recalibración inteligente del perfil
      const profile = db.getProfile(authUser.id);
      const prod = db.getProductById(productId);
      const styleSignal = styleScore ?? score;
      if (profile && prod) {
        if (styleSignal >= 4 && prod.styles && prod.styles[0]) {
          const mainStyle = prod.styles[0];
          if (!profile.styles.includes(mainStyle)) {
            profile.styles = [mainStyle, ...profile.styles].slice(0, 3);
          }
        }
        db.saveProfile(authUser.id, profile);
      }

      return sendJson(res, 200, {
        success: true,
        message: 'Valoración guardada. Tu feedback calibra tu perfil para futuras selecciones sin generar devolución.',
        rating: savedRating
      });
    }

    // Ratings POST (Batch)
    const ratingMatch = pathname.match(/^\/api\/boxes\/([^/]+)\/ratings$/);
    if (ratingMatch && req.method === 'POST') {
      const boxId = ratingMatch[1];
      const box = db.getBoxById(boxId);
      if (!box || box.userId !== authUser.id) {
        return sendJson(res, 404, { error: 'Caja no encontrada.' });
      }

      if (box.status !== 'DELIVERED' && box.status !== 'RATED') {
        return sendJson(res, 403, { error: 'Solo puedes calificar prendas de una caja que ya hayas recibido.' });
      }

      const { ratings } = await parseJsonBody(req);
      if (!Array.isArray(ratings) || ratings.length === 0) {
        return sendJson(res, 400, { error: 'Debes enviar al menos una calificación.' });
      }

      const savedRatings = [];
      const profile = db.getProfile(authUser.id) || { brandAdj: {}, styles: [] };

      ratings.forEach(r => {
        if (!box.itemIds.includes(r.productId)) return;
        const score = Number(r.score);
        if (score >= 1 && score <= 5) {
          const saved = db.addRating(authUser.id, boxId, r.productId, {
            score,
            liked: r.liked !== false,
            styleFeedback: r.styleFeedback || '',
            feedback: r.feedback || r.styleFeedback || '',
            preferenceNotes: r.preferenceNotes || ''
          });
          savedRatings.push(saved);

          const prod = db.getProductById(r.productId);
          if (prod && score >= 4 && prod.styles && prod.styles[0]) {
            const style = prod.styles[0];
            if (!profile.styles.includes(style)) {
              profile.styles = [style, ...profile.styles].slice(0, 3);
            }
          }
        }
      });

      db.updateBox(boxId, { status: 'RATED' });
      db.saveProfile(authUser.id, profile);

      return sendJson(res, 200, { success: true, count: savedRatings.length });
    }

    // Next Box POST
    if (pathname === '/api/boxes/next' && req.method === 'POST') {
      const boxes = db.getUserBoxes(authUser.id);
      const currentBox = boxes[0];
      if (currentBox && currentBox.status !== 'RATED' && currentBox.status !== 'DELIVERED') {
        return sendJson(res, 400, { error: 'Primero debes recibir y evaluar tu caja actual antes de solicitar la siguiente.' });
      }

      const profile = db.getProfile(authUser.id) || {};
      const { box: newBox } = createCuratedBox(authUser.id, profile, {
        cycle: (currentBox ? currentBox.cycle : 0) + 1,
        address: currentBox ? currentBox.address : 'Calle 18 # 122-135, Pance, Cali',
        receivedIds: boxes.flatMap(b => b.itemIds || [])
      });

      return sendJson(res, 201, {
        success: true,
        box: {
          id: newBox.id,
          cycle: newBox.cycle,
          status: newBox.status,
          plan: newBox.plan,
          itemsCount: newBox.itemIds.length,
          estimatedDelivery: newBox.estimatedDelivery
        }
      });
    }

    // Box History GET
    if (pathname === '/api/boxes/history' && req.method === 'GET') {
      const boxes = db.getUserBoxes(authUser.id);
      const profile = db.getProfile(authUser.id) || {};

      const deliveredBoxes = boxes
        .filter(b => b.status === 'DELIVERED' || b.status === 'RATED')
        .map(b => {
          const ratings = db.getRatingsByBox(b.id);
          const items = b.itemIds.map(id => {
            const p = db.getProductById(id);
            if (!p) return null;
            const userRating = ratings.find(r => r.productId === p.id) || null;
            return { ...p, cut: p.fit, fit: calculateFit(profile, p), userRating };
          }).filter(Boolean);

          return {
            id: b.id,
            cycle: b.cycle,
            status: b.status,
            plan: b.plan,
            deliveredAt: b.deliveredAt,
            items,
            ratings
          };
        });

      return sendJson(res, 200, { history: deliveredBoxes });
    }

    // Returns GET (User's return requests + Returnable garments)
    if (pathname === '/api/returns' && req.method === 'GET') {
      const userReturns = db.getReturnsByUser(authUser.id);
      const boxes = db.getUserBoxes(authUser.id);
      const profile = db.getProfile(authUser.id) || {};

      const deliveredBoxes = boxes.filter(b => b.status === 'DELIVERED' || b.status === 'RATED');
      const returnedProductIds = userReturns.map(r => r.productId);

      const returnableGarments = [];
      deliveredBoxes.forEach(box => {
        box.itemIds.forEach(id => {
          const prod = db.getProductById(id);
          if (prod) {
            const isReturned = returnedProductIds.includes(prod.id);
            // HU-09: la talla recibida es la que se despachó, no la que daría el perfil ya recalibrado.
            const shipped = (box.shippedVariants || []).find(v => v.productId === prod.id);
            const fit = shipped ? { ...calculateFit(profile, prod), size: shipped.size } : calculateFit(profile, prod);
            returnableGarments.push({
              ...prod,
              cut: prod.fit,
              boxId: box.id,
              cycle: box.cycle,
              deliveredAt: box.deliveredAt,
              fit,
              isReturned,
              // HU-14: plazo de cambio calculado en el backend
              returnDeadline: logistics.returnDeadline(box.deliveredAt),
              withinWindow: !box.deliveredAt || new Date() <= new Date(logistics.returnDeadline(box.deliveredAt))
            });
          }
        });
      });

      const garmentFor = r => returnableGarments.find(g => g.id === r.productId && g.boxId === r.boxId);
      return sendJson(res, 200, {
        returns: userReturns.map(r => ({
          ...r,
          productName: garmentFor(r)?.name,
          brand: garmentFor(r)?.brandName,
          currentSize: garmentFor(r)?.fit.size
        })),
        returnableGarments
      });
    }

    // Returns POST — HU-14: plazo, guía inversa, stock de la talla pedida y alternativa sin stock
    if (pathname === '/api/returns' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      let ret;
      try {
        ret = logistics.requestReturn(authUser.id, body);
      } catch (err) {
        if (err.code === 'RETURN_WINDOW_EXPIRED') {
          return sendJson(res, 422, { error: err.message, code: err.code, deadline: err.deadline, conditions: err.conditions });
        }
        if (err.code === 'NO_STOCK_IN_SIZE') {
          return sendJson(res, 409, { error: err.message, code: err.code, options: err.options });
        }
        throw err;
      }

      // Recalibración del perfil por ajuste
      const profile = db.getProfile(authUser.id);
      const prod = db.getProductById(ret.productId);
      if (profile && prod) {
        profile.brandAdj = profile.brandAdj || {};
        profile.brandAdj[prod.brandId] = (profile.brandAdj[prod.brandId] || 0) + (ret.reason === 'TOO_SMALL' ? 0.5 : -0.5);
        db.saveProfile(authUser.id, profile);
      }

      const messages = {
        EXCHANGE_SIZE: `Solicitud registrada. Recogeremos la prenda sin costo (guía ${ret.returnTrackingNumber}) y te enviaremos la talla ${ret.requestedSize}.`,
        EQUIVALENT: `Solicitud registrada. Recogeremos la prenda (guía ${ret.returnTrackingNumber}) y te enviaremos "${ret.replacementName}" en talla ${ret.requestedSize}.`,
        RETURN_ONLY: `Devolución registrada. Recogeremos la prenda sin costo (guía ${ret.returnTrackingNumber}).`
      };
      return sendJson(res, 201, { success: true, message: messages[ret.resolution], returnRequest: ret });
    }

    // HU-08/HU-12: suscripción actual con sus pagos y facturas
    if (pathname === '/api/subscription' && req.method === 'GET') {
      const sub = db.getSubscription(authUser.id);
      return sendJson(res, 200, {
        subscription: billing.publicSubscription(sub),
        planChange: sub.status === 'ACTIVE' || sub.status === 'PAUSED' ? billing.planChangeEffect(sub) : null,
        payments: db.getPayments(authUser.id).slice(0, 12),
        invoices: db.getInvoices(authUser.id).slice(0, 12)
      });
    }

    // HU-08: tokenización simulada. En una pasarela real la tarjeta va del navegador a la
    // pasarela; aquí el número y el CVV solo se validan y nunca se guardan ni se registran.
    if (pathname === '/api/payments/tokenize' && req.method === 'POST') {
      const { card } = await parseJsonBody(req);
      const result = payments.tokenize(card || {});
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/subscription/subscribe' && req.method === 'POST') {
      const { plan, paymentToken, fiscal } = await parseJsonBody(req);
      try {
        const result = billing.subscribe(db.findUserById(authUser.id), { plan, paymentToken, fiscal });
        return sendJson(res, 201, {
          success: true,
          message: `¡Listo! Tu plan ${config.PLANS[plan].name} está activo. Pago SIMULADO aprobado.`,
          subscription: billing.publicSubscription(result.subscription),
          payment: result.payment,
          invoice: result.invoice
        });
      } catch (err) {
        if (err.status === 402) return sendJson(res, 402, { error: err.message, reason: err.reason, paymentId: err.paymentId });
        throw err;
      }
    }

    if (pathname === '/api/subscription/payment-method' && req.method === 'POST') {
      const { paymentToken } = await parseJsonBody(req);
      try {
        const result = billing.updatePaymentMethod(authUser.id, paymentToken);
        return sendJson(res, 200, { success: true, message: result.message, subscription: billing.publicSubscription(result.subscription), payment: result.payment });
      } catch (err) {
        if (err.status === 402) return sendJson(res, 402, { error: err.message, reason: err.reason });
        throw err;
      }
    }

    // HU-12: pausar un mes, reanudar y cambiar de plan
    const subscriptionAction = pathname.match(/^\/api\/subscription\/(pause|resume|change-plan)$/);
    if (subscriptionAction && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const action = subscriptionAction[1];
      const result = action === 'pause' ? billing.pause(authUser.id)
        : action === 'resume' ? billing.resume(authUser.id)
          : billing.changePlan(authUser.id, body.plan);
      return sendJson(res, 200, { success: true, message: result.message, effect: result.effect, subscription: billing.publicSubscription(result.subscription) });
    }

    // HU-15: datos fiscales del suscriptor
    if (pathname === '/api/profile/fiscal' && req.method === 'PUT') {
      const fiscal = await parseJsonBody(req);
      const fiscalError = billing.validateFiscal(fiscal);
      if (fiscalError) return sendJson(res, 400, { error: fiscalError });
      const user = db.updateUser(authUser.id, { fiscal: billing.cleanFiscal(fiscal) });
      return sendJson(res, 200, { success: true, message: 'Datos de facturación guardados.', fiscal: user.fiscal });
    }

    // HU-13: cancelación con encuesta de salida opcional. La encuesta nunca bloquea la cancelación.
    if (pathname === '/api/subscription/cancel' && req.method === 'POST') {
      const { reason, comment } = await parseJsonBody(req);
      const sub = db.getSubscription(authUser.id);
      // HU-12: cancelar detiene los cobros futuros; vale desde activa, en pausa o en mora.
      billing.assertTransition(sub, 'cancel');
      const validReason = reason && config.CANCELLATION_REASONS[reason] ? reason : null;
      const cancellation = db.addCancellation(authUser.id, {
        plan: sub.plan,
        reason: validReason,
        comment: typeof comment === 'string' ? comment.trim().slice(0, 500) : ''
      });
      const updated = db.saveSubscription(authUser.id, {
        status: 'CANCELLED',
        cancelledAt: cancellation.createdAt,
        cancellationId: cancellation.id,
        nextChargeAt: null,
        pendingPlan: null,
        pendingPlanFrom: null,
        pausedUntil: null,
        dunning: null
      });
      return sendJson(res, 200, {
        success: true,
        message: 'Tu suscripción quedó cancelada. No se harán más cobros ni despachos.',
        subscription: billing.publicSubscription(updated),
        cancellation
      });
    }

    // Unmatched API endpoint
    return sendJson(res, 404, { error: `Endpoint ${req.method} ${pathname} no encontrado.` });

  } catch (error) {
    if (error.status) {
      return sendJson(res, error.status, { error: error.message });
    }
    console.error('API Error:', error);
    return sendJson(res, 500, { error: error.message || 'Error interno del servidor.' });
  }
}

module.exports = {
  handleApiRequest
};
