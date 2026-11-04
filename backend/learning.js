// HU-11: reentrenamiento del motor con el feedback de los suscriptores y las correcciones del estilista.
// El "modelo" de cada perfil son factores por atributo (attributeWeights) que multiplican el puntaje
// de engine.scoreProduct, más el bono de styleWeights. Las funciones apply* son puras sobre el perfil.
const config = require('./config');

const L = config.LEARNING;

function clamp(value) {
  return Math.min(L.cap, Math.max(L.floor, Math.round(value * 1000) / 1000));
}

// Atributos de una prenda que el motor puntúa: sus estilos, ocasiones y su corte.
function attributesOf(product) {
  return [
    ...(product.styles || []).map(v => ['style', v]),
    ...(product.occasions || []).map(v => ['occasion', v]),
    ...(product.fit ? [['cut', product.fit]] : [])
  ];
}

function scaleAttributes(profile, attributes, factor) {
  profile.attributeWeights = profile.attributeWeights || { style: {}, occasion: {}, cut: {} };
  attributes.forEach(([kind, value]) => {
    const bucket = (profile.attributeWeights[kind] = profile.attributeWeights[kind] || {});
    bucket[value] = clamp((Number.isFinite(bucket[value]) ? bucket[value] : 1) * factor);
  });
}

const key = ([kind, value]) => `${kind}:${value}`;

// Una calificación de estilo de 2 o menos baja el peso de los atributos de la prenda (con piso).
function applyRating(profile, product, styleScore) {
  if (!Number.isFinite(styleScore) || styleScore > L.lowStyleScore) return false;
  scaleAttributes(profile, attributesOf(product), L.lowRatingFactor);
  return true;
}

// Corrección del estilista: lo que distingue a la prenda reemplazada penaliza y lo que distingue a la
// nueva suma (también como bono de estilo). Los atributos que comparten no cambian.
function applyCorrection(profile, { removed = [], added = null, rejected = false }) {
  const addedAttrs = added ? attributesOf(added) : [];
  const addedKeys = new Set(addedAttrs.map(key));
  const removedKeys = new Set();
  removed.forEach(p => {
    const own = attributesOf(p).filter(a => !addedKeys.has(key(a)) && !removedKeys.has(key(a)));
    own.forEach(a => removedKeys.add(key(a)));
    scaleAttributes(profile, own, rejected ? L.rejectedFactor : L.removedFactor);
  });
  if (added) {
    const removedAll = new Set(removed.flatMap(p => attributesOf(p).map(key)));
    const own = addedAttrs.filter(a => !removedAll.has(key(a)));
    scaleAttributes(profile, own, L.addedFactor);
    profile.styleWeights = profile.styleWeights || {};
    own.filter(([kind]) => kind === 'style').forEach(([, st]) => {
      profile.styleWeights[st] = Math.min(1, Math.round(((Number(profile.styleWeights[st]) || 0) + L.addedStyleBonus) * 100) / 100);
    });
  }
}

// Procesa el feedback aún no aprendido. Es idempotente: marca cada calificación y corrección como aprendida.
function ingestFeedback(now = new Date()) {
  const { db } = require('./database');
  const touched = new Set();
  let ratingsProcessed = 0;
  let lowRatings = 0;
  let correctionsProcessed = 0;

  db.data.ratings.filter(r => !r.learnedAt).forEach(r => {
    const profile = db.getProfile(r.userId);
    const product = db.getProductById(r.productId);
    r.learnedAt = now.toISOString();
    ratingsProcessed++;
    if (!profile || !product) return;
    if (applyRating(profile, product, Number(r.styleScore))) {
      lowRatings++;
      touched.add(r.userId);
    }
  });

  db.data.corrections.filter(c => !c.learnedAt).forEach(c => {
    const profile = db.getProfile(c.subscriberId);
    c.learnedAt = now.toISOString();
    correctionsProcessed++;
    if (!profile) return;
    const ids = c.type === 'REPLACE' ? [c.removedProductId] : c.removedProductIds || [];
    applyCorrection(profile, {
      removed: ids.map(id => db.getProductById(id)).filter(Boolean),
      added: c.addedProductId ? db.getProductById(c.addedProductId) : null,
      rejected: c.type === 'REJECT'
    });
    touched.add(c.subscriberId);
  });

  touched.forEach(userId => {
    const profile = db.getProfile(userId);
    if (!profile) return;
    profile.rulesVersion = config.RULES_VERSION;
    profile.learningRevision = (profile.learningRevision || 0) + 1;
    profile.learnedAt = now.toISOString();
  });
  db.save();

  return {
    rulesVersion: config.RULES_VERSION,
    ratingsProcessed,
    lowRatings,
    correctionsProcessed,
    profilesUpdated: touched.size,
    ranAt: now.toISOString()
  };
}

module.exports = { applyRating, applyCorrection, ingestFeedback, attributesOf };
