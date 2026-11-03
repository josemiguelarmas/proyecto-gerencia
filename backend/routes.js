const { db, verifyPassword } = require('./database');
const { signToken, authenticateRequest } = require('./auth');
const { calculateFit, curateBoxItems } = require('./engine');
const config = require('./config');
const mail = require('./mail');
const { runReviewReminders } = require('./jobs');

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
    emailVerified: user.emailVerified
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

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
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
        cancellationReasons: config.CANCELLATION_REASONS
      });
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
        return sendJson(res, 200, metrics);
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

      // Admin Boxes (Full visibility including items even in PREPARING or SHIPPED)
      if (pathname === '/api/admin/boxes' && req.method === 'GET') {
        const boxes = db.getAllBoxes();
        return sendJson(res, 200, { boxes });
      }

      const adminBoxStatusMatch = pathname.match(/^\/api\/admin\/boxes\/([^/]+)\/status$/);
      if (adminBoxStatusMatch && req.method === 'POST') {
        const boxId = adminBoxStatusMatch[1];
        const { status } = await parseJsonBody(req);
        const validStatuses = ['CREATED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'RATED'];
        if (!validStatuses.includes(status)) {
          return sendJson(res, 400, { error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}` });
        }
        const updates = { status };
        if (status === 'DELIVERED') {
          updates.deliveredAt = new Date().toISOString();
        }
        const updated = db.updateBox(boxId, updates);
        return sendJson(res, 200, { success: true, box: updated });
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
      const body = await parseJsonBody(req);
      const profile = db.saveProfile(authUser.id, { ...body, done: true });

      // If user has no box yet, auto-curate their first box in PREPARING status
      let boxes = db.getUserBoxes(authUser.id);
      let activeBox = boxes.find(b => b.status !== 'RATED') || boxes[0];

      if (!activeBox) {
        const itemIds = curateBoxItems(profile, db.catalog, []);
        activeBox = db.createBox(authUser.id, {
          cycle: 1,
          status: 'PREPARING',
          plan: profile.plan || 'esencial',
          address: body.address || 'Calle 18 # 122-135, Pance, Cali',
          itemIds
        });
      }

      return sendJson(res, 200, { profile, boxId: activeBox.id });
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
              return { ...p, fit, userRating };
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

      let nextStatus = currentBox.status;
      let deliveredAt = currentBox.deliveredAt;

      if (currentBox.status === 'CREATED' || currentBox.status === 'PREPARING') {
        nextStatus = 'SHIPPED';
      } else if (currentBox.status === 'SHIPPED') {
        nextStatus = 'DELIVERED';
        deliveredAt = new Date().toISOString();
      } else if (currentBox.status === 'DELIVERED') {
        return sendJson(res, 200, { message: 'La caja ya fue entregada.', box: currentBox });
      }

      const updated = db.updateBox(currentBox.id, { status: nextStatus, deliveredAt });
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
        return { ...p, fit: calculateFit(profile, p), userRating };
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
      const receivedIds = boxes.flatMap(b => b.itemIds || []);
      const newItemIds = curateBoxItems(profile, db.catalog, receivedIds);

      const nextCycle = (currentBox ? currentBox.cycle : 0) + 1;
      const newBox = db.createBox(authUser.id, {
        cycle: nextCycle,
        status: 'PREPARING',
        plan: profile.plan || 'esencial',
        address: currentBox ? currentBox.address : 'Calle 18 # 122-135, Pance, Cali',
        itemIds: newItemIds
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
            const fit = calculateFit(profile, prod);
            returnableGarments.push({
              ...prod,
              cut: prod.fit,
              boxId: box.id,
              cycle: box.cycle,
              deliveredAt: box.deliveredAt,
              fit,
              isReturned
            });
          }
        });
      });

      return sendJson(res, 200, {
        returns: userReturns,
        returnableGarments
      });
    }

    // Returns POST
    if (pathname === '/api/returns' && req.method === 'POST') {
      const { boxId, productId, reason, requestedSize, notes, pickupAddress, scheduledPickupDate } = await parseJsonBody(req);

      // 1. REGLA ESTRICTA DE NEGOCIO: Motivo exclusivamente de TALLA / AJUSTE (Requisitos 15 y 16)
      const ALLOWED_REASONS = ['TOO_SMALL', 'TOO_LARGE', 'FIT_ISSUE'];
      if (!ALLOWED_REASONS.includes(reason)) {
        return sendJson(res, 400, {
          error: 'Motivo de devolución no permitido. En The Clothes Box los cambios gratuitos están reservados exclusivamente a problemas de talla o ajuste (TOO_SMALL, TOO_LARGE, FIT_ISSUE).'
        });
      }

      if (!requestedSize) {
        return sendJson(res, 400, { error: 'Debes seleccionar la talla de reemplazo solicitada.' });
      }

      // 2. Verificar que la prenda pertenezca a una caja entregada del usuario
      const box = db.getBoxById(boxId);
      if (!box || box.userId !== authUser.id) {
        return sendJson(res, 404, { error: 'Caja no encontrada.' });
      }
      if (box.status !== 'DELIVERED' && box.status !== 'RATED') {
        return sendJson(res, 403, { error: 'No puedes solicitar devolución de una prenda que aún no ha sido entregada.' });
      }
      if (!box.itemIds.includes(productId)) {
        return sendJson(res, 400, { error: 'La prenda seleccionada no corresponde a esta caja.' });
      }

      // 3. Crear solicitud
      const ret = db.createReturn(authUser.id, {
        boxId,
        productId,
        reason,
        requestedSize,
        notes,
        pickupAddress,
        scheduledPickupDate
      });

      // Recalibración del perfil por ajuste
      const profile = db.getProfile(authUser.id);
      const prod = db.getProductById(productId);
      if (profile && prod) {
        profile.brandAdj = profile.brandAdj || {};
        profile.brandAdj[prod.brandId] = (profile.brandAdj[prod.brandId] || 0) + (reason === 'TOO_SMALL' ? 0.5 : -0.5);
        db.saveProfile(authUser.id, profile);
      }

      return sendJson(res, 201, {
        success: true,
        message: 'Solicitud de cambio de talla registrada con éxito. Recogeremos la prenda sin costo en tu dirección en Cali.',
        returnRequest: ret
      });
    }

    // Suscripción actual (mínima; HU-08/HU-12 la amplían)
    if (pathname === '/api/subscription' && req.method === 'GET') {
      return sendJson(res, 200, { subscription: db.getSubscription(authUser.id) });
    }

    // HU-13: cancelación con encuesta de salida opcional. La encuesta nunca bloquea la cancelación.
    if (pathname === '/api/subscription/cancel' && req.method === 'POST') {
      const { reason, comment } = await parseJsonBody(req);
      const sub = db.getSubscription(authUser.id);
      if (sub.status === 'CANCELLED') {
        return sendJson(res, 409, { error: 'Tu suscripción ya está cancelada.' });
      }
      if (sub.status === 'NONE') {
        return sendJson(res, 409, { error: 'No tienes una suscripción activa para cancelar.' });
      }
      const validReason = reason && config.CANCELLATION_REASONS[reason] ? reason : null;
      const cancellation = db.addCancellation(authUser.id, {
        plan: sub.plan,
        reason: validReason,
        comment: typeof comment === 'string' ? comment.trim().slice(0, 500) : ''
      });
      const updated = db.saveSubscription(authUser.id, {
        status: 'CANCELLED',
        cancelledAt: cancellation.createdAt,
        cancellationId: cancellation.id
      });
      return sendJson(res, 200, {
        success: true,
        message: 'Tu suscripción quedó cancelada. No se harán más cobros ni despachos.',
        subscription: updated,
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
