// Recommendation and sizing engine (HU-05, HU-06, HU-11, SCRUM-44..48, SCRUM-76).
// Selects clothes matching size, fit, style preferences and target cost, scoring outfits as a whole.
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { stockInSize } = require('./catalog');

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const BRAND_RUNS = {
  norte: { runs: 0, runsText: 'talla estándar' },
  ceiba: { runs: 0.6, runsText: 'talla pequeño' },
  mono: { runs: -0.5, runsText: 'talla amplio' },
  true: { runs: -0.4, runsText: 'corte holgado' },
  'punto-blanco': { runs: 0, runsText: 'talla regular' },
  mattelsa: { runs: 0.2, runsText: 'talla ajustada' }
};

const BUILD_FACTOR = { delgada: -1, media: 0, robusta: 1 };
const EASE_TOP = { ajustado: 4, regular: 8, holgado: 14 };
const EASE_BOTTOM = { ajustado: 2, regular: 4, holgado: 8 };

const STYLE_RULES_FILE = path.join(__dirname, 'data', 'seed', 'style-rules.json');
const OUTFIT_RULES_FILE = path.join(__dirname, 'data', 'seed', 'outfit-rules.json');

function loadJsonSafe(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    // Graceful fallback if file unreadable
  }
  return fallback;
}

let cachedStyleRules = null;
let cachedOutfitRules = null;

function getStyleRules() {
  if (!cachedStyleRules) {
    cachedStyleRules = loadJsonSafe(STYLE_RULES_FILE, {
      status: 'pendiente de validación del estilista',
      version: '1.0.0',
      styles: {},
      occasions: {},
      cuts: {}
    });
  }
  return cachedStyleRules;
}

function getOutfitRules() {
  if (!cachedOutfitRules) {
    cachedOutfitRules = loadJsonSafe(OUTFIT_RULES_FILE, {
      status: 'pendiente de validación del estilista',
      version: '1.0.0',
      plans: {},
      compatibilityMatrix: {}
    });
  }
  return cachedOutfitRules;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x0, y0] = points[i - 1];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}

function calculateBodyIndex(m) {
  const h = Number(m.height) || 170;
  const w = Number(m.weight) || 68;
  const bmi = w / Math.pow(h / 100, 2);
  const fromBmi = lerp([[17, 0], [19.5, 1], [22.5, 2], [25.5, 3], [28.5, 4], [32, 5]], bmi);
  const est = clamp(fromBmi + ((h - 170) / 20) * 0.6 + (BUILD_FACTOR[m.build] || 0) * 0.35, 0, 5);

  const usualIdx = m.usual ? SIZES.indexOf(m.usual) : null;
  let refIdx = null;
  if (m.refBrand && m.refSize) {
    const bRun = BRAND_RUNS[m.refBrand] ? BRAND_RUNS[m.refBrand].runs : 0;
    refIdx = SIZES.indexOf(m.refSize) - bRun;
  }

  let finalIdx;
  if (refIdx != null && refIdx >= 0) {
    finalIdx = usualIdx != null && usualIdx >= 0
      ? 0.5 * refIdx + 0.3 * usualIdx + 0.2 * est
      : 0.7 * refIdx + 0.3 * est;
  } else if (usualIdx != null && usualIdx >= 0) {
    finalIdx = 0.6 * usualIdx + 0.4 * est;
  } else {
    finalIdx = est;
  }

  return { finalIdx, est, usualIdx, disagree: usualIdx != null && Math.abs(usualIdx - est) > 1.2 };
}

function calculateFit(profile, garment) {
  const m = profile.measures || {};
  const body = calculateBodyIndex(m);
  const brandInfo = BRAND_RUNS[garment.brandId] || { runs: 0, runsText: 'talla regular' };
  const userBrandAdj = (profile.brandAdj && profile.brandAdj[garment.brandId]) || 0;

  let fitPref = 0;
  if (profile.fit === 'holgado' && garment.fit === 'ajustado') fitPref = 0.3;
  if (profile.fit === 'ajustado' && garment.fit === 'holgado') fitPref = -0.3;

  const targetNeed = body.finalIdx + brandInfo.runs + userBrandAdj + fitPref;
  const chosenIdx = clamp(Math.round(targetNeed), 0, SIZES.length - 1);
  const fraction = Math.abs(targetNeed - chosenIdx);

  let matchPct = 98 - fraction * 24 - (body.disagree ? 6 : 0) - (brandInfo.runs !== 0 ? 3 : 0);
  matchPct = Math.round(clamp(matchPct, 72, 98));

  const level = matchPct >= 90 ? 'alto' : matchPct >= 80 ? 'medio' : 'bajo';
  const size = SIZES[chosenIdx];

  const isBottom = garment.category === 'bottom';
  const bodyEstCm = Math.round((isBottom ? 66 : 86) + body.finalIdx * 6);
  const ease = (isBottom ? EASE_BOTTOM : EASE_TOP)[garment.fit] || 6;
  const garmentCm = Math.round((isBottom ? 66 : 86) + chosenIdx * 6 + ease - brandInfo.runs * 5);
  const room = garmentCm - bodyEstCm;

  return {
    size,
    matchPct,
    level,
    levelText: level === 'alto' ? 'Ajuste seguro' : level === 'medio' ? 'Ajuste probable' : 'Revisa tu talla',
    measureType: isBottom ? 'cintura' : 'pecho',
    bodyCm: bodyEstCm,
    garmentCm,
    room,
    brandAlert: brandInfo.runs !== 0 ? `${garment.brandName} ${brandInfo.runsText}` : null
  };
}

const STYLE_NAMES = {
  urbano: 'urbano', minimal: 'minimal', retro: 'retro', clasico: 'clásico', deportivo: 'deportivo', artesanal: 'artesanal'
};
const OCCASION_NAMES = { clase: 'el día a día', fiesta: 'salidas', entrevista: 'entrevistas' };

// HU-11: factor aprendido de un atributo (estilo, ocasión o corte). 1 si no hay feedback.
function learnedFactor(profile, kind, value) {
  const factors = (profile.attributeWeights || {})[kind] || {};
  return Number.isFinite(factors[value]) ? factors[value] : 1;
}

// Puntaje de afinidad y sus motivos. styleWeights (HU-03, juego de estilos ocultos) suma un bono.
// HU-11: cada coincidencia se multiplica por el factor aprendido del feedback (attributeWeights).
function scoreProduct(profile, p) {
  let score = 0;
  const matchedStyles = [];
  let styleScore = 0;
  let feedbackSum = 0;
  let feedbackCount = 0;

  (profile.styles || []).forEach((st, idx) => {
    if (p.styles && p.styles.includes(st)) {
      const factor = learnedFactor(profile, 'style', st);
      const points = (3 - idx) * 3 * factor;
      styleScore += points;
      feedbackSum += factor;
      feedbackCount++;
      matchedStyles.push(st);
    }
  });
  score += styleScore;

  const weights = profile.styleWeights || {};
  const weightBonus = (p.styles || []).reduce((acc, st) => acc + (Number(weights[st]) || 0), 0) * 2;
  score += weightBonus;

  const matchedOccasions = (profile.occasions || []).filter(o => p.occasions && p.occasions.includes(o));
  const occasionScore = matchedOccasions.reduce((acc, o) => {
    const factor = learnedFactor(profile, 'occasion', o);
    feedbackSum += factor;
    feedbackCount++;
    return acc + 2.5 * factor;
  }, 0);
  score += occasionScore;

  const fitMatch = p.fit === profile.fit;
  let fitScore = 0;
  if (fitMatch) {
    const factor = learnedFactor(profile, 'cut', p.fit);
    fitScore = 1.5 * factor;
    feedbackSum += factor;
    feedbackCount++;
    score += fitScore;
  }

  const feedbackFactor = feedbackCount > 0 ? Math.round((feedbackSum / feedbackCount) * 100) / 100 : 1;

  return {
    score: Math.round(score * 10) / 10,
    reasons: {
      styles: matchedStyles,
      occasions: matchedOccasions,
      fitMatch,
      styleWeightBonus: Math.round(weightBonus * 10) / 10,
      styleScore: Math.round(styleScore * 10) / 10,
      occasionScore: Math.round(occasionScore * 10) / 10,
      fitScore: Math.round(fitScore * 10) / 10,
      feedbackFactor
    }
  };
}

function explain(reasons, size, cut) {
  const parts = [];
  if (reasons.styles && reasons.styles.length) parts.push(`Coincide con tu estilo ${reasons.styles.map(s => STYLE_NAMES[s] || s).join(' y ')}`);
  if (reasons.occasions && reasons.occasions.length) parts.push(`sirve para ${reasons.occasions.map(o => OCCASION_NAMES[o] || o).join(' y ')}`);
  if (reasons.fitMatch) parts.push(`corte ${cut} como prefieres`);
  if (reasons.styleWeightBonus > 0) parts.push('afín a lo que elegiste en el juego de estilos');
  parts.push(`talla ${size} disponible`);
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function costOf(p) {
  return Number.isFinite(p.wholesalePriceCOP) ? p.wholesalePriceCOP : Math.round(p.priceCOP * 0.3);
}

// SCRUM-46: evalúa la compatibilidad global entre prendas de la caja
function calculateOutfitCompatibility(items) {
  const rules = getOutfitRules();
  const matrix = rules.compatibilityMatrix || {};
  let totalScore = 0;
  let pairs = 0;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const p1 = items[i];
      const p2 = items[j];
      const s1 = (p1.styles && p1.styles[0]) || 'urbano';
      const s2 = (p2.styles && p2.styles[0]) || 'urbano';
      const score = (matrix[s1] && matrix[s1][s2]) || 0.7;
      totalScore += score;
      pairs++;
    }
  }

  return pairs > 0 ? Math.round((totalScore / pairs) * 100) : 85;
}

// SCRUM-46: genera las combinaciones de outfits a partir de las prendas elegidas
function buildOutfitsForPlan(planKey, items) {
  const rules = getOutfitRules();
  const planRules = (rules.plans && rules.plans[planKey]) || (rules.plans && rules.plans.esencial);
  const outfitTemplates = (planRules && planRules.outfits) || [];

  return outfitTemplates.map(tpl => {
    const includedItems = (tpl.slotIndices || [])
      .map(idx => items[idx])
      .filter(Boolean);

    const title = includedItems.map(it => it.name).join(' + ');

    return {
      id: tpl.id,
      name: tpl.name,
      title: title || 'Outfit coordinado',
      itemIds: includedItems.map(it => it.id),
      itemNames: includedItems.map(it => it.name),
      description: tpl.description || 'Combinación de prendas afines para tu estilo.'
    };
  });
}

function getActiveModelVersionId() {
  try {
    const modelVersions = require('./modelVersions');
    return modelVersions.getActiveVersion().id;
  } catch (err) {
    return config.RULES_VERSION || 'reglas-v2';
  }
}

// HU-05 + HU-06: arma la caja con prendas en stock en la talla del usuario y respeta el costo objetivo.
// Si la mejor combinación supera el tope, reemplaza la prenda más cara por la mejor alternativa más barata
// de la misma categoría, hasta quedar dentro del tope o agotar alternativas.
function curateBox(profile, catalog, receivedItemIds = [], { plans = null, excludeIds = [] } = {}) {
  const plan = (plans || config.PLANS)[profile.plan] || (plans || config.PLANS).esencial;
  const modelVersion = getActiveModelVersionId();

  function matchesLine(p) {
    if (profile.line === 'm') return p.line !== 'f';
    if (profile.line === 'f') return p.line !== 'm';
    return true;
  }

  // Candidatos por categoría, ordenados: primero prendas no recibidas, luego por puntaje.
  const candidatesBySlot = {};
  plan.slots.forEach(cat => {
    if (candidatesBySlot[cat]) return;
    candidatesBySlot[cat] = catalog
      .filter(p => p.category === cat && matchesLine(p) && !excludeIds.includes(p.id))
      .map(p => {
        const size = calculateFit(profile, p).size;
        const { score, reasons } = scoreProduct(profile, p);
        return { p, size, score, reasons, cost: costOf(p), isFresh: !receivedItemIds.includes(p.id) };
      })
      .filter(c => stockInSize(c.p, c.size) > 0)
      .sort((a, b) => {
        if (a.isFresh !== b.isFresh) return a.isFresh ? -1 : 1;
        return b.score - a.score;
      });
  });

  const chosen = [];
  const missingSlots = [];
  plan.slots.forEach((cat, slotIndex) => {
    const pick = candidatesBySlot[cat].find(c => !chosen.some(x => x.p.id === c.p.id));
    if (pick) chosen.push({ ...pick, slotIndex, replacedForCost: false });
    else missingSlots.push(cat);
  });

  const total = () => chosen.reduce((sum, c) => sum + c.cost, 0);
  let guard = 0;
  while (total() > plan.targetCostCOP && guard++ < 50) {
    const byCost = chosen.map((c, i) => ({ c, i })).sort((a, b) => b.c.cost - a.c.cost);
    let replaced = false;
    for (const { c, i } of byCost) {
      const alt = candidatesBySlot[c.p.category].find(x =>
        x.cost < c.cost && !chosen.some(y => y.p.id === x.p.id)
      );
      if (alt) {
        chosen[i] = { ...alt, slotIndex: c.slotIndex, replacedForCost: true, replacedProductId: c.p.id };
        replaced = true;
        break;
      }
    }
    if (!replaced) break;
  }

  const totalCostCOP = total();
  const rawItems = chosen.map(c => c.p);
  const outfitScore = calculateOutfitCompatibility(rawItems);
  const outfits = buildOutfitsForPlan(profile.plan || 'esencial', rawItems);

  const recommendations = chosen.map(c => {
    const isRepeated = !c.isFresh;
    let baseExp = explain(c.reasons, c.size, c.p.fit);
    if (c.replacedForCost) baseExp += ' · elegida para respetar el costo objetivo del plan';
    if (isRepeated) baseExp += ' · prenda repetida por catálogo agotado';

    return {
      productId: c.p.id,
      size: c.size,
      score: c.score,
      costCOP: c.cost,
      reasons: c.reasons,
      matchedAttributes: {
        styles: c.reasons.styles,
        occasions: c.reasons.occasions,
        fit: c.p.fit
      },
      scoreComponents: {
        styleScore: c.reasons.styleScore || 0,
        occasionScore: c.reasons.occasionScore || 0,
        fitScore: c.reasons.fitScore || 0,
        styleWeightBonus: c.reasons.styleWeightBonus || 0,
        feedbackFactor: c.reasons.feedbackFactor || 1
      },
      filtersApplied: [
        'line_match',
        'size_available',
        'stock_in_size',
        'target_cost',
        'freshness_checked'
      ],
      modelVersion,
      repeated: isRepeated,
      replacedForCost: c.replacedForCost,
      replacedProductId: c.replacedProductId || null,
      explanation: baseExp
    };
  });

  return {
    itemIds: chosen.map(c => c.p.id),
    recommendations,
    totalCostCOP,
    targetCostCOP: plan.targetCostCOP,
    withinCap: totalCostCOP <= plan.targetCostCOP,
    missingSlots,
    outfitScore,
    outfits,
    modelVersion
  };
}

function curateBoxItems(profile, catalog, receivedItemIds = []) {
  return curateBox(profile, catalog, receivedItemIds).itemIds;
}

// Explicación de una prenda elegida a mano (reemplazo del estilista).
function explainProduct(profile, product) {
  const size = calculateFit(profile, product).size;
  const { score, reasons } = scoreProduct(profile, product);
  const modelVersion = getActiveModelVersionId();

  return {
    productId: product.id,
    size,
    score,
    costCOP: costOf(product),
    reasons,
    matchedAttributes: {
      styles: reasons.styles,
      occasions: reasons.occasions,
      fit: product.fit
    },
    scoreComponents: {
      styleScore: reasons.styleScore || 0,
      occasionScore: reasons.occasionScore || 0,
      fitScore: reasons.fitScore || 0,
      styleWeightBonus: reasons.styleWeightBonus || 0,
      feedbackFactor: reasons.feedbackFactor || 1
    },
    filtersApplied: ['line_match', 'size_available', 'stock_in_size'],
    modelVersion,
    replacedForCost: false,
    replacedProductId: null,
    explanation: explain(reasons, size, product.fit)
  };
}

module.exports = {
  SIZES,
  calculateFit,
  curateBox,
  curateBoxItems,
  explainProduct,
  scoreProduct,
  calculateOutfitCompatibility,
  getStyleRules,
  getOutfitRules
};
