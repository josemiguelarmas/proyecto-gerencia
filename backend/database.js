const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const env = require('./config/env');

// Runtime data lives in DATA_DIR (default backend/data/runtime, git-ignored). On first boot
// the database and the catalog are created from the committed seeds in backend/data/seed/.
const DB_FILE = env.DB_FILE;
const CATALOG_FILE = env.CATALOG_FILE;
const { normalizeProduct } = require('./catalog');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, key] = stored.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

// Colecciones de la base. Las de Sprint 2 se crean vacías en bases existentes.
const COLLECTIONS = ['users', 'profiles', 'boxes', 'ratings', 'returns', 'consents', 'authTokens', 'subscriptions', 'cancellations', 'corrections', 'quizSessions', 'profileVersions', 'payments', 'invoices', 'alerts', 'inventoryMovements', 'dataRequests', 'settings'];

function emptyData() {
  return Object.fromEntries(COLLECTIONS.map(c => [c, []]));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

class Database {
  constructor() {
    this.catalog = [];
    this.data = emptyData();
    this.init();
  }

  init() {
    [DB_FILE, CATALOG_FILE].forEach(file => fs.mkdirSync(path.dirname(file), { recursive: true }));
    if (!fs.existsSync(CATALOG_FILE)) fs.copyFileSync(env.SEED_CATALOG_FILE, CATALOG_FILE);

    // Load catalog
    if (fs.existsSync(CATALOG_FILE)) {
      try {
        this.catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
        if (this.catalog.filter(normalizeProduct).length > 0) this.saveCatalog();
      } catch (err) {
        console.error('Error reading catalog:', err);
      }
    }

    // Load or create DB
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = Object.assign(emptyData(), JSON.parse(raw));
      } catch (e) {
        console.warn('Re-initializing database due to read error:', e.message);
        this.seedInitial();
      }
    } else {
      this.seedInitial();
    }

    // Ensure role property exists on all users
    let needsSave = false;
    this.data.users.forEach(u => {
      if (!u.role) {
        u.role = u.email === 'admin@theclothesbox.co' ? 'ADMIN' : 'CLIENT';
        needsSave = true;
      }
    });

    // Ensure Admin user exists
    const hasAdmin = this.data.users.some(u => u.email === 'admin@theclothesbox.co');
    if (!hasAdmin) {
      const adminSalt = crypto.randomBytes(16).toString('hex');
      const adminPasswordHash = hashPassword('admin123', adminSalt);
      this.data.users.push({
        id: 'usr_admin_01',
        name: 'Administrador de Operaciones',
        email: 'admin@theclothesbox.co',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        createdAt: '2026-08-01T08:00:00.000Z'
      });
      needsSave = true;
    }

    // HU-07: usuario estilista de demostración
    if (!this.data.users.some(u => u.email === 'estilista@theclothesbox.co')) {
      this.data.users.push({
        id: 'usr_stylist_01',
        name: 'Laura Estilista',
        email: 'estilista@theclothesbox.co',
        passwordHash: hashPassword('estilista123'),
        role: 'STYLIST',
        createdAt: '2026-11-01T08:00:00.000Z'
      });
      needsSave = true;
    }

    // HU-08: el cliente demo tiene una suscripción pagada con la tarjeta de prueba 4242
    const demo = this.data.users.find(u => u.email === 'demo@theclothesbox.co');
    if (demo && !this.data.subscriptions.some(s => s.userId === demo.id)) {
      const now = new Date();
      const next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      this.data.subscriptions.push({
        id: 'sub_demo_01',
        userId: demo.id,
        plan: (this.getProfile(demo.id) || {}).plan || 'esencial',
        status: 'ACTIVE',
        paymentToken: 'tok_sim_ok_visa_4242_demo0000000000',
        cardBrand: 'Visa',
        cardLast4: '4242',
        startedAt: now.toISOString(),
        nextChargeAt: next.toISOString(),
        dunning: null,
        createdAt: now.toISOString()
      });
      if (!demo.fiscal) {
        demo.fiscal = { docType: 'CC', docNumber: '1144000000', address: 'Calle 18 # 122-135, Pance', city: 'Cali' };
      }
      needsSave = true;
    }

    if (needsSave) {
      this.save();
    }
  }

  saveCatalog() {
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(this.catalog, null, 2) + '\n', 'utf8');
  }

  save() {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('Database write error:', err);
    }
  }

  seedInitial() {
    // The seed file has no passwords. Until Phase 1b seeds admin and stylist from env,
    // the demo client and the admin keep their historical demo passwords set here.
    const seed = JSON.parse(fs.readFileSync(env.SEED_DB_FILE, 'utf8'));
    const demoPasswords = { 'demo@theclothesbox.co': 'demo123', 'admin@theclothesbox.co': 'admin123' };
    seed.users.forEach(u => {
      if (demoPasswords[u.email]) u.passwordHash = hashPassword(demoPasswords[u.email]);
    });
    this.data = { ...emptyData(), ...seed };
    this.save();
  }

  // User helpers
  findUserByEmail(email) {
    if (!email) return null;
    return this.data.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
  }

  findUserById(id) {
    return this.data.users.find(u => u.id === id) || null;
  }

  createUser(name, email, password, role = 'CLIENT', extra = {}) {
    const id = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const user = {
      id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      role: role || 'CLIENT',
      ...extra,
      createdAt: new Date().toISOString()
    };
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(userId, updates) {
    const user = this.findUserById(userId);
    if (!user) return null;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  setPassword(userId, password) {
    return this.updateUser(userId, { passwordHash: hashPassword(password) });
  }

  // HU-02: registro de auditoría del consentimiento
  addConsent(userId, { accepted, policyVersion }) {
    const consent = {
      id: `cns_${crypto.randomBytes(6).toString('hex')}`,
      userId,
      accepted: accepted === true,
      policyVersion,
      acceptedAt: new Date().toISOString()
    };
    this.data.consents.push(consent);
    this.save();
    return consent;
  }

  getConsentsByUser(userId) {
    return this.data.consents.filter(c => c.userId === userId);
  }

  // HU-01: tokens de un solo uso (recuperación y verificación). Solo se guarda el hash.
  createAuthToken(userId, type, ttlMs) {
    const token = crypto.randomBytes(32).toString('hex');
    this.data.authTokens.push({
      id: `tok_${crypto.randomBytes(6).toString('hex')}`,
      userId,
      type,
      tokenHash: sha256(token),
      expiresAt: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null,
      usedAt: null,
      createdAt: new Date().toISOString()
    });
    this.save();
    return token;
  }

  // Devuelve el registro si el token es válido y lo marca como usado.
  consumeAuthToken(token, type) {
    if (!token) return null;
    const hash = sha256(token);
    const record = this.data.authTokens.find(t => t.tokenHash === hash && t.type === type);
    if (!record || record.usedAt) return null;
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) return null;
    record.usedAt = new Date().toISOString();
    this.save();
    return record;
  }

  // HU-08: la suscripción nace con el primer pago aprobado. Sin registro el estado es NONE.
  getSubscription(userId) {
    let sub = this.data.subscriptions.find(s => s.userId === userId);
    if (!sub) {
      const profile = this.getProfile(userId);
      sub = {
        userId,
        plan: (profile && profile.plan) || 'esencial',
        status: 'NONE'
      };
    }
    return sub;
  }

  getAllSubscriptions() {
    return this.data.subscriptions;
  }

  saveSubscription(userId, updates) {
    let sub = this.data.subscriptions.find(s => s.userId === userId);
    if (!sub) {
      sub = { id: `sub_${crypto.randomBytes(6).toString('hex')}`, ...this.getSubscription(userId), createdAt: new Date().toISOString() };
      this.data.subscriptions.push(sub);
    }
    Object.assign(sub, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return sub;
  }

  // HU-08: pagos con comisión de pasarela y estado de conciliación
  addPayment(data) {
    const payment = {
      id: `pay_${crypto.randomBytes(6).toString('hex')}`,
      reconciliation: { status: 'PENDING', at: null },
      invoiceId: null,
      createdAt: new Date().toISOString(),
      ...data
    };
    this.data.payments.push(payment);
    this.save();
    return payment;
  }

  findPayment(predicate) {
    return this.data.payments.find(predicate) || null;
  }

  getPayments(userId) {
    const list = userId ? this.data.payments.filter(p => p.userId === userId) : this.data.payments;
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // HU-15: facturas con consecutivo propio y alertas para el equipo
  addInvoice(data) {
    const consecutive = this.data.invoices.reduce((max, i) => Math.max(max, i.consecutive || 0), 0) + 1;
    const invoice = {
      id: `inv_${crypto.randomBytes(6).toString('hex')}`,
      consecutive,
      createdAt: new Date().toISOString(),
      ...data,
      number: `${data.prefix}-${consecutive}`
    };
    this.data.invoices.push(invoice);
    this.save();
    return invoice;
  }

  getInvoices(userId) {
    const list = userId ? this.data.invoices.filter(i => i.userId === userId) : this.data.invoices;
    return [...list].sort((a, b) => b.consecutive - a.consecutive);
  }

  addAlert(data) {
    const alert = { id: `alr_${crypto.randomBytes(6).toString('hex')}`, createdAt: new Date().toISOString(), resolvedAt: null, ...data };
    this.data.alerts.push(alert);
    this.save();
    return alert;
  }

  getAlerts() {
    return [...this.data.alerts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // HU-16: solicitudes del titular (consulta, rectificación, supresión) con su tiempo de respuesta
  addDataRequest(userId, type, { requestedAt, status = 'COMPLETED', detail = '' } = {}) {
    const resolvedAt = new Date();
    const request = {
      id: `dreq_${crypto.randomBytes(6).toString('hex')}`,
      userId,
      type,
      status,
      detail,
      requestedAt: (requestedAt || resolvedAt).toISOString(),
      resolvedAt: resolvedAt.toISOString(),
      responseMs: resolvedAt - (requestedAt || resolvedAt)
    };
    this.data.dataRequests.push(request);
    this.save();
    return request;
  }

  // HU-17: ajustes editables desde el panel
  getSetting(key, fallback) {
    const found = this.data.settings.find(s => s.key === key);
    return found ? found.value : fallback;
  }

  setSetting(key, value) {
    let found = this.data.settings.find(s => s.key === key);
    if (!found) {
      found = { key };
      this.data.settings.push(found);
    }
    Object.assign(found, { value, updatedAt: new Date().toISOString() });
    this.save();
    return found;
  }

  addCancellation(userId, { plan, reason, comment }) {
    const cancellation = {
      id: `cnl_${crypto.randomBytes(6).toString('hex')}`,
      userId,
      plan,
      reason: reason || null,
      comment: comment || '',
      createdAt: new Date().toISOString()
    };
    this.data.cancellations.push(cancellation);
    this.save();
    return cancellation;
  }

  getCancellationReasonCounts(reasonKeys) {
    const counts = Object.fromEntries(reasonKeys.map(k => [k, 0]));
    let unanswered = 0;
    this.data.cancellations.forEach(c => {
      if (c.reason && counts[c.reason] !== undefined) counts[c.reason]++;
      else unanswered++;
    });
    return { total: this.data.cancellations.length, counts, unanswered };
  }

  // HU-07: correcciones del estilista (ejemplos para el reentrenamiento de HU-11)
  addCorrection(data) {
    const correction = {
      id: `cor_${crypto.randomBytes(6).toString('hex')}`,
      ...data,
      createdAt: new Date().toISOString()
    };
    this.data.corrections.push(correction);
    this.save();
    return correction;
  }

  // HU-03: sesiones del quiz (progreso parcial y tiempo de completado)
  getOpenQuizSession(userId) {
    return this.data.quizSessions.find(q => q.userId === userId && q.status === 'IN_PROGRESS') || null;
  }

  saveQuizProgress(userId, { step, answers, repeat }) {
    let session = this.getOpenQuizSession(userId);
    if (!session) {
      session = {
        id: `quiz_${crypto.randomBytes(6).toString('hex')}`,
        userId,
        status: 'IN_PROGRESS',
        repeat: !!repeat,
        startedAt: new Date().toISOString()
      };
      this.data.quizSessions.push(session);
    }
    Object.assign(session, { step, answers, updatedAt: new Date().toISOString() });
    this.save();
    return session;
  }

  completeQuizSession(userId) {
    const session = this.getOpenQuizSession(userId);
    if (!session) return null;
    const completedAt = new Date();
    Object.assign(session, {
      status: 'COMPLETED',
      completedAt: completedAt.toISOString(),
      durationSec: Math.round((completedAt - new Date(session.startedAt)) / 1000)
    });
    this.save();
    return session;
  }

  getQuizStats() {
    const done = this.data.quizSessions.filter(q => q.status === 'COMPLETED' && Number.isFinite(q.durationSec));
    const avg = done.length ? Math.round(done.reduce((a, q) => a + q.durationSec, 0) / done.length) : null;
    return {
      completed: done.length,
      inProgress: this.data.quizSessions.filter(q => q.status === 'IN_PROGRESS').length,
      averageDurationSec: avg,
      recent: done.slice(-10).reverse().map(q => {
        const user = this.findUserById(q.userId);
        return { userName: user ? user.name : q.userId, durationSec: q.durationSec, completedAt: q.completedAt, repeat: q.repeat };
      })
    };
  }

  // HU-03: el perfil de estilo anterior se conserva como versión al repetir el quiz
  archiveProfileVersion(userId) {
    const profile = this.getProfile(userId);
    if (!profile || !profile.done) return null;
    const { userId: _u, ...snapshot } = profile;
    const version = {
      id: `pv_${crypto.randomBytes(6).toString('hex')}`,
      userId,
      version: profile.version || 1,
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      archivedAt: new Date().toISOString()
    };
    this.data.profileVersions.push(version);
    this.save();
    return version;
  }

  getProfileVersions(userId) {
    return this.data.profileVersions
      .filter(v => v.userId === userId)
      .sort((a, b) => b.version - a.version);
  }

  getAllUsers() {
    return this.data.users.map(u => {
      const profile = this.getProfile(u.id);
      const boxes = this.getUserBoxes(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role || 'CLIENT',
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        profile,
        boxesCount: boxes.length,
        currentBoxStatus: boxes[0] ? boxes[0].status : 'NO_BOX'
      };
    });
  }

  // Profile helpers
  getProfile(userId) {
    return this.data.profiles.find(p => p.userId === userId) || null;
  }

  saveProfile(userId, profileData) {
    let profile = this.getProfile(userId);
    if (!profile) {
      profile = { userId, ...profileData, updatedAt: new Date().toISOString() };
      this.data.profiles.push(profile);
    } else {
      Object.assign(profile, profileData, { updatedAt: new Date().toISOString() });
    }
    this.save();
    return profile;
  }

  // Box helpers
  getUserBoxes(userId) {
    return this.data.boxes
      .filter(b => b.userId === userId)
      .sort((a, b) => b.cycle - a.cycle);
  }

  getBoxById(boxId) {
    return this.data.boxes.find(b => b.id === boxId) || null;
  }

  getAllBoxes() {
    return this.data.boxes.map(box => {
      const user = this.findUserById(box.userId);
      const profile = this.getProfile(box.userId) || {};
      const items = (box.itemIds || []).map(id => {
        const prod = this.getProductById(id);
        return prod || { id, name: 'Prenda no catalogada' };
      });
      return {
        ...box,
        userName: user ? user.name : 'Usuario Desconocido',
        userEmail: user ? user.email : '',
        clientProfile: profile,
        items
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createBox(userId, boxData) {
    const box = {
      id: `box_${crypto.randomBytes(5).toString('hex')}`,
      userId,
      cycle: boxData.cycle || 1,
      status: boxData.status || 'PROPOSED',
      plan: boxData.plan || 'esencial',
      address: boxData.address || 'Cali, Colombia',
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      estimatedDelivery: boxData.estimatedDelivery || new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
      itemIds: boxData.itemIds || [],
      recommendations: boxData.recommendations || [],
      totalCostCOP: boxData.totalCostCOP ?? null,
      targetCostCOP: boxData.targetCostCOP ?? null,
      withinCap: boxData.withinCap ?? null,
      rulesVersion: boxData.rulesVersion || null,
      profileLearningRevision: boxData.profileLearningRevision ?? null,
      reviewLog: [],
      unboxed: false
    };
    this.data.boxes.push(box);
    this.save();
    return box;
  }

  updateBox(boxId, updates) {
    const box = this.getBoxById(boxId);
    if (!box) return null;
    Object.assign(box, updates);
    this.save();
    return box;
  }

  // Rating and Feedback helpers
  getRatingsByBox(boxId) {
    return this.data.ratings.filter(r => r.boxId === boxId);
  }

  getRatingsByUser(userId) {
    return this.data.ratings.filter(r => r.userId === userId);
  }

  getAllRatings() {
    return this.data.ratings.map(r => {
      const user = this.findUserById(r.userId);
      const product = this.getProductById(r.productId);
      const box = this.getBoxById(r.boxId);
      return {
        ...r,
        userName: user ? user.name : 'Usuario',
        userEmail: user ? user.email : '',
        productName: product ? product.name : r.productId,
        productBrand: product ? product.brandName : '',
        productImage: product ? product.imageUrl : '',
        boxCycle: box ? box.cycle : null
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  addRating(userId, boxId, productId, ratingData) {
    // Check if an existing rating for this product/box already exists
    let rating = this.data.ratings.find(r => r.userId === userId && r.boxId === boxId && r.productId === productId);
    if (rating) {
      Object.assign(rating, {
        score: ratingData.score !== undefined ? ratingData.score : rating.score,
        fitScore: ratingData.fitScore !== undefined ? ratingData.fitScore : (rating.fitScore ?? null),
        styleScore: ratingData.styleScore !== undefined ? ratingData.styleScore : (rating.styleScore ?? null),
        liked: ratingData.liked !== undefined ? ratingData.liked : rating.liked,
        styleFeedback: ratingData.styleFeedback !== undefined ? ratingData.styleFeedback : (ratingData.feedback || rating.styleFeedback),
        feedback: ratingData.feedback || rating.feedback,
        preferenceNotes: ratingData.preferenceNotes || rating.preferenceNotes || '',
        updatedAt: new Date().toISOString()
      });
    } else {
      const id = `rat_${crypto.randomBytes(6).toString('hex')}`;
      rating = {
        id,
        userId,
        boxId,
        productId,
        score: ratingData.score || 4,
        fitScore: ratingData.fitScore ?? null,
        styleScore: ratingData.styleScore ?? null,
        liked: ratingData.liked !== false,
        styleFeedback: ratingData.styleFeedback || ratingData.feedback || '',
        feedback: ratingData.feedback || '',
        preferenceNotes: ratingData.preferenceNotes || '',
        createdAt: new Date().toISOString()
      };
      this.data.ratings.push(rating);
    }
    this.save();
    return rating;
  }

  // Returns helpers
  getReturnsByUser(userId) {
    return this.data.returns.filter(r => r.userId === userId);
  }

  getAllReturns() {
    return this.data.returns.map(ret => {
      const user = this.findUserById(ret.userId);
      const product = this.getProductById(ret.productId);
      const box = this.getBoxById(ret.boxId);
      return {
        ...ret,
        userName: user ? user.name : 'Cliente',
        userEmail: user ? user.email : '',
        productName: product ? product.name : ret.productId,
        brand: product ? product.brandName : '',
        productImage: product ? product.imageUrl : '',
        boxCycle: box ? box.cycle : 1
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createReturn(userId, returnData) {
    const id = `ret_${crypto.randomBytes(6).toString('hex')}`;
    const ret = {
      id,
      userId,
      boxId: returnData.boxId,
      productId: returnData.productId,
      reason: returnData.reason,
      requestedSize: returnData.requestedSize,
      notes: returnData.notes || '',
      pickupAddress: returnData.pickupAddress || 'Cali, Colombia',
      scheduledPickupDate: returnData.scheduledPickupDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      status: 'PENDING_PICKUP',
      createdAt: new Date().toISOString()
    };
    this.data.returns.push(ret);
    this.save();
    return ret;
  }

  updateReturn(returnId, updates) {
    const ret = this.data.returns.find(r => r.id === returnId);
    if (!ret) return null;
    Object.assign(ret, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return ret;
  }

  // Product and Catalog helpers
  getProductById(id) {
    return this.catalog.find(p => p.id === id) || null;
  }

  saveProduct(productData) {
    let p = this.getProductById(productData.id);
    if (p) {
      Object.assign(p, productData);
    } else {
      const newId = productData.id || `prod_${String(this.catalog.length + 1).padStart(2, '0')}`;
      p = { ...productData, id: newId };
      this.catalog.push(p);
    }
    normalizeProduct(p);
    this.saveCatalog();
    return p;
  }

  // Admin Metrics
  getAdminMetrics() {
    const clients = this.data.users.filter(u => (u.role || 'CLIENT') === 'CLIENT');
    const totalBoxes = this.data.boxes.length;
    const deliveredBoxes = this.data.boxes.filter(b => b.status === 'DELIVERED' || b.status === 'RATED').length;
    const inTransitBoxes = this.data.boxes.filter(b => b.status === 'SHIPPED').length;
    const preparingBoxes = this.data.boxes.filter(b => b.status === 'PREPARING').length;
    const totalReturns = this.data.returns.length;
    const pendingReturns = this.data.returns.filter(r => r.status === 'PENDING_PICKUP' || r.status === 'PENDING').length;

    const allScores = this.data.ratings.map(r => r.score).filter(s => typeof s === 'number');
    const averageScore = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '4.8';

    const brands = [...new Set(this.catalog.map(p => p.brandName))];

    return {
      totalClients: clients.length,
      totalBoxes,
      deliveredBoxes,
      inTransitBoxes,
      preparingBoxes,
      totalReturns,
      pendingReturns,
      returnRate: deliveredBoxes > 0 ? ((totalReturns / deliveredBoxes) * 100).toFixed(1) : '0.0',
      averageSatisfaction: averageScore,
      totalProducts: this.catalog.length,
      brandsCount: brands.length,
      brandsList: brands
    };
  }
}

const db = new Database();

module.exports = {
  db,
  sha256,
  verifyPassword,
  hashPassword
};
