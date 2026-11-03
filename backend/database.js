const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = process.env.TCB_DB_FILE || path.join(__dirname, 'data', 'db.json');
const CATALOG_FILE = process.env.TCB_CATALOG_FILE || path.join(__dirname, 'data', 'catalog.json');
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
const COLLECTIONS = ['users', 'profiles', 'boxes', 'ratings', 'returns', 'consents', 'authTokens', 'subscriptions', 'cancellations', 'corrections', 'quizSessions', 'profileVersions'];

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
    const demoSalt = crypto.randomBytes(16).toString('hex');
    const demoPasswordHash = hashPassword('demo123', demoSalt);
    const demoUserId = 'usr_demo_01';

    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminPasswordHash = hashPassword('admin123', adminSalt);
    const adminUserId = 'usr_admin_01';

    this.data = {
      ...emptyData(),
      users: [
        {
          id: demoUserId,
          name: 'Jose Miguel Armas',
          email: 'demo@theclothesbox.co',
          passwordHash: demoPasswordHash,
          role: 'CLIENT',
          createdAt: '2026-08-01T10:00:00.000Z'
        },
        {
          id: adminUserId,
          name: 'Administrador de Operaciones',
          email: 'admin@theclothesbox.co',
          passwordHash: adminPasswordHash,
          role: 'ADMIN',
          createdAt: '2026-08-01T08:00:00.000Z'
        }
      ],
      profiles: [
        {
          userId: demoUserId,
          done: true,
          styles: ['urbano', 'retro', 'minimal'],
          occasions: ['clase', 'fiesta'],
          fit: 'regular',
          line: 'u',
          risk: 1,
          plan: 'esencial',
          measures: {
            height: 174,
            weight: 68,
            build: 'media',
            usual: 'M',
            refBrand: 'norte',
            refSize: 'M'
          },
          brandAdj: {
            ceiba: 0.5,
            mono: -0.5,
            norte: 0
          },
          updatedAt: '2026-08-01T10:05:00.000Z'
        }
      ],
      boxes: [
        {
          id: 'box_001',
          userId: demoUserId,
          cycle: 1,
          status: 'RATED',
          plan: 'esencial',
          address: 'Calle 18 # 122-135, Pance, Cali',
          createdAt: '2026-08-05T09:00:00.000Z',
          deliveredAt: '2026-08-10T15:30:00.000Z',
          estimatedDelivery: '2026-08-10',
          itemIds: ['prod-01', 'prod-08', 'prod-13'],
          unboxed: true
        },
        {
          id: 'box_002',
          userId: demoUserId,
          cycle: 2,
          status: 'RATED',
          plan: 'esencial',
          address: 'Calle 18 # 122-135, Pance, Cali',
          createdAt: '2026-09-05T09:00:00.000Z',
          deliveredAt: '2026-09-09T14:15:00.000Z',
          estimatedDelivery: '2026-09-09',
          itemIds: ['prod-02', 'prod-09', 'prod-16'],
          unboxed: true
        },
        {
          id: 'box_003',
          userId: demoUserId,
          cycle: 3,
          status: 'DELIVERED',
          plan: 'esencial',
          address: 'Calle 18 # 122-135, Pance, Cali',
          createdAt: '2026-10-01T08:00:00.000Z',
          deliveredAt: '2026-10-02T11:00:00.000Z',
          estimatedDelivery: '2026-10-02',
          itemIds: ['prod-04', 'prod-10', 'prod-14'],
          unboxed: false
        }
      ],
      ratings: [
        {
          id: 'rat_001',
          boxId: 'box_001',
          userId: demoUserId,
          productId: 'prod-01',
          score: 5,
          liked: true,
          styleFeedback: 'Me encantó el corte y la caída pesada de la tela.',
          feedback: 'El corte boxy y la textura pesada quedaron impecables.',
          createdAt: '2026-08-11T12:00:00.000Z'
        },
        {
          id: 'rat_002',
          boxId: 'box_001',
          userId: demoUserId,
          productId: 'prod-08',
          score: 4,
          liked: true,
          styleFeedback: 'Buen lavado vintage, combina con todo.',
          feedback: 'Muy buen denim, largo exacto.',
          createdAt: '2026-08-11T12:05:00.000Z'
        },
        {
          id: 'rat_003',
          boxId: 'box_001',
          userId: demoUserId,
          productId: 'prod-13',
          score: 5,
          liked: true,
          styleFeedback: 'La pana es cómoda y el color terracota muy original.',
          feedback: 'La pana es suave y abriga sin sofocar.',
          createdAt: '2026-08-11T12:10:00.000Z'
        },
        {
          id: 'rat_004',
          boxId: 'box_002',
          userId: demoUserId,
          productId: 'prod-02',
          score: 4,
          liked: true,
          styleFeedback: 'Lino de muy buena calidad para el clima de Cali.',
          feedback: 'Lino fresco para las tardes cálidas.',
          createdAt: '2026-09-10T16:00:00.000Z'
        },
        {
          id: 'rat_005',
          boxId: 'box_002',
          userId: demoUserId,
          productId: 'prod-09',
          score: 3,
          liked: false,
          styleFeedback: 'Corte un poco formal para mis gustos habituales.',
          feedback: 'Corte un poco formal para mis gustos habituales.',
          createdAt: '2026-09-10T16:05:00.000Z'
        },
        {
          id: 'rat_006',
          boxId: 'box_002',
          userId: demoUserId,
          productId: 'prod-16',
          score: 5,
          liked: true,
          styleFeedback: 'Chaqueta clásica de excelente calidad.',
          feedback: 'Chaqueta clásica de excelente calidad.',
          createdAt: '2026-09-10T16:10:00.000Z'
        }
      ],
      returns: [
        {
          id: 'ret_001',
          userId: demoUserId,
          boxId: 'box_002',
          productId: 'prod-09',
          reason: 'TOO_LARGE',
          requestedSize: 'S',
          notes: 'La pretina en talla M quedó unos 3 cm más amplia de lo esperado.',
          status: 'COMPLETED',
          pickupAddress: 'Calle 18 # 122-135, Pance, Cali',
          scheduledPickupDate: '2026-09-12',
          createdAt: '2026-09-11T10:00:00.000Z'
        }
      ]
    };
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

  // HU-13 (y base para HU-08/HU-12): suscripción mínima y cancelaciones
  getSubscription(userId) {
    let sub = this.data.subscriptions.find(s => s.userId === userId);
    if (!sub) {
      // TODO HU-08: la suscripción nace con el pago. Mientras tanto, un perfil completo cuenta como ACTIVE.
      const profile = this.getProfile(userId);
      sub = {
        userId,
        plan: (profile && profile.plan) || 'esencial',
        status: profile && profile.done ? 'ACTIVE' : 'NONE',
        createdAt: new Date().toISOString()
      };
    }
    return sub;
  }

  saveSubscription(userId, updates) {
    let sub = this.data.subscriptions.find(s => s.userId === userId);
    if (!sub) {
      sub = { ...this.getSubscription(userId) };
      this.data.subscriptions.push(sub);
    }
    Object.assign(sub, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return sub;
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
