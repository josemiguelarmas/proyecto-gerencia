const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, 'data', 'db.json');
const CATALOG_FILE = path.join(__dirname, 'data', 'catalog.json');

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

class Database {
  constructor() {
    this.catalog = [];
    this.data = {
      users: [],
      profiles: [],
      boxes: [],
      ratings: [],
      returns: []
    };
    this.init();
  }

  init() {
    // Load catalog
    if (fs.existsSync(CATALOG_FILE)) {
      try {
        this.catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
      } catch (err) {
        console.error('Error reading catalog:', err);
      }
    }

    // Load or create DB
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = Object.assign({ users: [], profiles: [], boxes: [], ratings: [], returns: [] }, JSON.parse(raw));
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

    if (needsSave) {
      this.save();
    }
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

  createUser(name, email, password, role = 'CLIENT') {
    const id = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const user = {
      id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      role: role || 'CLIENT',
      createdAt: new Date().toISOString()
    };
    this.data.users.push(user);
    this.save();
    return user;
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
      id: `box_${String(Date.now()).slice(-6)}`,
      userId,
      cycle: boxData.cycle || 1,
      status: boxData.status || 'PREPARING',
      plan: boxData.plan || 'esencial',
      address: boxData.address || 'Cali, Colombia',
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      estimatedDelivery: boxData.estimatedDelivery || new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
      itemIds: boxData.itemIds || [],
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
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(this.catalog, null, 2), 'utf8');
    return p;
  }

  // Admin Metrics
  getAdminMetrics() {
    const clients = this.data.users.filter(u => u.role !== 'ADMIN');
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
  verifyPassword,
  hashPassword
};
