// HU-17: genera unos 100 suscriptores sintéticos con altas, cancelaciones, cajas, calificaciones y
// devoluciones en los últimos 3 meses, para demostrar el panel de KPIs.
// Todo queda marcado con seedDemo: true y correos @seed.theclothesbox.test. No tienen contraseña
// (no pueden iniciar sesión), no tienen medio de pago y el cobro recurrente y el batch los ignoran.
//
// Uso:
//   node scripts/seed-demo.js            agrega los datos de prueba (reemplaza los de una corrida anterior)
//   node scripts/seed-demo.js --reset    solo borra los datos de prueba
// Escribe en backend/data/db.json, o en TCB_DB_FILE si está definida.
const crypto = require('crypto');

const SEED_DOMAIN = 'seed.theclothesbox.test';
const FIRST = ['Ana', 'Juan', 'Valentina', 'Santiago', 'Camila', 'Mateo', 'Laura', 'Sebastián', 'Isabella', 'Nicolás', 'Mariana', 'Daniel'];
const LAST = ['Gómez', 'Rodríguez', 'López', 'Martínez', 'Rojas', 'Castro', 'Vargas', 'Moreno', 'Ortiz', 'Ramírez'];
const REASONS = ['precio', 'precio', 'estilo', 'talla', 'tiempo', 'otro', null];
const STYLES = ['urbano', 'minimal', 'retro', 'clasico', 'deportivo', 'artesanal'];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function resetSeed(db) {
  const ids = new Set(db.data.users.filter(u => u.seedDemo).map(u => u.id));
  ['users'].forEach(c => { db.data[c] = db.data[c].filter(u => !ids.has(u.id)); });
  ['profiles', 'subscriptions', 'cancellations', 'boxes', 'ratings', 'returns'].forEach(c => {
    db.data[c] = db.data[c].filter(x => !ids.has(x.userId));
  });
  return ids.size;
}

function seedDemo(db, { count = 100, now = new Date(), seed = 2026 } = {}) {
  const removed = resetSeed(db);
  const rand = rng(seed);
  const id = prefix => `${prefix}_seed_${crypto.randomBytes(5).toString('hex')}`;
  const monthStart = offset => new Date(now.getFullYear(), now.getMonth() - offset, 1);
  // Fecha al azar dentro del mes (offset 0 = este mes, sin pasar de hoy).
  const dayIn = offset => {
    const start = monthStart(offset);
    const end = offset === 0 ? now : monthStart(offset - 1);
    return new Date(start.getTime() + rand() * (end - start - 3600000));
  };
  const totals = { users: 0, starts: 0, cancellations: 0, boxes: 0, ratings: 0, returns: 0 };

  for (let i = 0; i < count; i++) {
    const userId = id('usr');
    const plan = rand() < 0.6 ? 'esencial' : 'estilo';
    // 55 % ya estaban suscritos antes de la ventana de 3 meses; el resto entra en uno de los 3 meses.
    const startOffset = rand() < 0.55 ? 3 + Math.floor(rand() * 3) : Math.floor(rand() * 3);
    const startedAt = dayIn(startOffset);
    const cancelOffset = rand() < 0.22 ? Math.floor(rand() * Math.min(3, startOffset + 1)) : null;
    let cancelledAt = cancelOffset !== null ? dayIn(cancelOffset) : null;
    if (cancelledAt && cancelledAt <= startedAt) cancelledAt = new Date(startedAt.getTime() + 5 * 86400000);
    if (cancelledAt && cancelledAt > now) cancelledAt = null;

    const name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(rand() * LAST.length)]}`;
    db.data.users.push({
      id: userId, name, email: `demo_${String(i + 1).padStart(3, '0')}@${SEED_DOMAIN}`, passwordHash: null,
      role: 'CLIENT', createdAt: startedAt.toISOString(), emailVerified: true, seedDemo: true
    });
    db.data.profiles.push({
      userId, done: true, seedDemo: true, plan, styles: [STYLES[i % 6], STYLES[(i + 2) % 6]], occasions: ['clase'], fit: 'regular', line: 'u',
      measures: { height: 165 + (i % 20), weight: 58 + (i % 30), build: 'media', usual: 'M' }, address: 'Cali (dato de prueba)'
    });
    const history = [{ type: 'START', plan, at: startedAt.toISOString() }];
    if (cancelledAt) history.push({ type: 'CANCEL', plan, at: cancelledAt.toISOString() });
    db.data.subscriptions.push({
      id: id('sub'), userId, plan, status: cancelledAt ? 'CANCELLED' : 'ACTIVE', seedDemo: true,
      startedAt: startedAt.toISOString(), cancelledAt: cancelledAt ? cancelledAt.toISOString() : null,
      nextChargeAt: null, paymentToken: null, dunning: null, history, createdAt: startedAt.toISOString()
    });
    totals.users++;
    totals.starts++;
    if (cancelledAt) {
      db.data.cancellations.push({ id: id('cnl'), userId, plan, reason: REASONS[Math.floor(rand() * REASONS.length)], comment: '', seedDemo: true, createdAt: cancelledAt.toISOString() });
      totals.cancellations++;
    }

    // Una caja entregada por cada mes de la ventana en que estuvo suscrito, con calificaciones.
    for (let offset = 2; offset >= 0; offset--) {
      const deliveredAt = dayIn(offset);
      if (deliveredAt < startedAt || (cancelledAt && deliveredAt > cancelledAt)) continue;
      const items = Array.from({ length: plan === 'estilo' ? 5 : 3 }, () => db.catalog[Math.floor(rand() * db.catalog.length)].id);
      const boxId = id('box');
      db.data.boxes.push({
        id: boxId, userId, cycle: 3 - offset, status: 'RATED', plan, itemIds: items, address: 'Cali (dato de prueba)', seedDemo: true,
        createdAt: new Date(deliveredAt.getTime() - 5 * 86400000).toISOString(), deliveredAt: deliveredAt.toISOString()
      });
      totals.boxes++;
      items.forEach(productId => {
        const score = Math.max(1, Math.min(5, Math.round(3.4 + rand() * 2 - (rand() < 0.1 ? 2 : 0))));
        db.data.ratings.push({ id: id('rat'), userId, boxId, productId, score, styleScore: score, fitScore: score, liked: score >= 3, seedDemo: true, learnedAt: now.toISOString(), createdAt: new Date(deliveredAt.getTime() + 86400000).toISOString() });
        totals.ratings++;
        if (rand() < 0.07) {
          db.data.returns.push({ id: id('ret'), userId, boxId, productId, reason: rand() < 0.5 ? 'TOO_SMALL' : 'TOO_LARGE', requestedSize: 'L', status: 'COMPLETED', seedDemo: true, createdAt: new Date(deliveredAt.getTime() + 2 * 86400000).toISOString() });
          totals.returns++;
        }
      });
    }
  }
  db.save();
  return { removedPrevious: removed, ...totals };
}

if (require.main === module) {
  const { db } = require('../backend/database');
  if (process.argv.includes('--reset')) {
    const removed = resetSeed(db);
    db.save();
    console.log(`Datos de prueba eliminados: ${removed} usuarios sintéticos.`);
  } else {
    const result = seedDemo(db);
    console.log('Datos de prueba generados (marcados seedDemo: true):', result);
  }
}

module.exports = { seedDemo, resetSeed, SEED_DOMAIN };
