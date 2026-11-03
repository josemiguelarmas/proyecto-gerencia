const { db, verifyPassword } = require('./database');
const { signToken, authenticateRequest } = require('./auth');
const { calculateFit, curateBoxItems } = require('./engine');

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

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const { name, email, password } = await parseJsonBody(req);
      if (!name || !email || !password) {
        return sendJson(res, 400, { error: 'Nombre, correo y contraseña son obligatorios.' });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: 'La contraseña debe tener al menos 6 caracteres.' });
      }
      if (db.findUserByEmail(email)) {
        return sendJson(res, 400, { error: 'Ya existe una cuenta registrada con este correo electrónico.' });
      }
      const user = db.createUser(name, email, password, 'CLIENT');
      const token = signToken({ userId: user.id });
      return sendJson(res, 201, {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
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
        user: { id: user.id, name: user.name, email: user.email, role: user.role || 'CLIENT' },
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
      return sendJson(res, 200, { user: authUser, profile });
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

      const { productId, score, liked, styleFeedback, preferenceNotes } = await parseJsonBody(req);
      if (!productId || !box.itemIds.includes(productId)) {
        return sendJson(res, 400, { error: 'La prenda indicada no pertenece a esta caja.' });
      }

      const savedRating = db.addRating(authUser.id, boxId, productId, {
        score: Number(score) || 4,
        liked: liked !== false,
        styleFeedback: styleFeedback || '',
        feedback: preferenceNotes || styleFeedback || '',
        preferenceNotes: preferenceNotes || ''
      });

      // Recalibración inteligente del perfil
      const profile = db.getProfile(authUser.id);
      const prod = db.getProductById(productId);
      if (profile && prod) {
        if (score >= 4 && prod.styles && prod.styles[0]) {
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

    // Unmatched API endpoint
    return sendJson(res, 404, { error: `Endpoint ${req.method} ${pathname} no encontrado.` });

  } catch (error) {
    console.error('API Error:', error);
    return sendJson(res, 500, { error: error.message || 'Error interno del servidor.' });
  }
}

module.exports = {
  handleApiRequest
};
