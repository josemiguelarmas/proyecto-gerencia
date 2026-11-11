// HU-11: evaluación del reentrenamiento con perfiles sintéticos. No toca la base.
// Cada perfil declara estilos en el quiz, pero tiene un "gusto real" que no coincide del todo:
// uno de los estilos declarados no le gusta y le gusta otro que no declaró. La calificación
// simulada de una prenda sale de ese gusto real.
//
// Antes: la caja del mes siguiente con el perfil sin aprender.
// Después: la misma caja (sin repetir prendas) tras aprender del feedback del primer mes
// (calificaciones de estilo y una corrección del estilista por perfil).
//
// Uso: node scripts/evaluate-model.js [cantidad de perfiles]
const fs = require('fs');
const path = require('path');
const config = require('../backend/config');
const { curateBox } = require('../backend/engine');
const { normalizeProduct, stockInSize } = require('../backend/catalog');
const { calculateFit } = require('../backend/engine');
const { applyRating, applyCorrection } = require('../backend/learning');

const CATALOG_FILE = process.env.TCB_CATALOG_FILE || path.join(__dirname, '..', 'backend', 'data', 'catalog.json');

// Generador pseudoaleatorio con semilla para que el resultado sea reproducible.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pick(rand, list, n) {
  const copy = list.slice();
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

function syntheticProfiles(count, rand) {
  const sizes = [{ height: 160, weight: 55, usual: 'S' }, { height: 170, weight: 68, usual: 'M' }, { height: 178, weight: 80, usual: 'L' }, { height: 185, weight: 92, usual: 'XL' }];
  return Array.from({ length: count }, (_, i) => {
    const declared = pick(rand, config.STYLES, 3);
    const disliked = declared[1 + Math.floor(rand() * 2)];
    const hidden = pick(rand, config.STYLES.filter(s => !declared.includes(s)), 1)[0];
    const m = sizes[i % sizes.length];
    return {
      profile: {
        styles: declared,
        occasions: pick(rand, config.OCCASIONS, 2),
        fit: ['regular', 'holgado', 'ajustado'][i % 3],
        line: i % 2 ? 'm' : 'u',
        plan: i % 2 ? 'estilo' : 'esencial',
        measures: { ...m, build: 'media' }
      },
      taste: { liked: declared.filter(s => s !== disliked).concat(hidden), disliked }
    };
  });
}

// Calificación de estilo simulada (1 a 5) según el gusto real.
function simulatedRating(taste, product) {
  let r = 2.5;
  product.styles.forEach(s => {
    if (taste.liked.includes(s)) r += 1.25;
    if (s === taste.disliked) r -= 1.5;
  });
  return Math.max(1, Math.min(5, Math.round(r)));
}

function average(list) {
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
}

function evaluateModel({ count = 40, seed = 11, catalog } = {}) {
  const items = catalog || JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
  items.forEach(normalizeProduct);
  const byId = Object.fromEntries(items.map(p => [p.id, p]));
  const rand = rng(seed);
  const before = [];
  const after = [];

  syntheticProfiles(count, rand).forEach(({ profile, taste }) => {
    const first = curateBox(profile, items, []).itemIds;
    const baseline = curateBox(profile, items, first).itemIds;

    // Feedback del primer mes: calificación de estilo de cada prenda y una corrección del estilista
    // que cambia la peor prenda por la que más le gustaría en la misma categoría.
    const learned = JSON.parse(JSON.stringify(profile));
    first.forEach(id => applyRating(learned, byId[id], simulatedRating(taste, byId[id])));
    const worst = first.slice().sort((a, b) => simulatedRating(taste, byId[a]) - simulatedRating(taste, byId[b]))[0];
    if (worst) {
      const best = items
        .filter(p => p.category === byId[worst].category && !first.includes(p.id) && stockInSize(p, calculateFit(profile, p).size) > 0)
        .sort((a, b) => simulatedRating(taste, b) - simulatedRating(taste, a))[0];
      if (best) applyCorrection(learned, { removed: [byId[worst]], added: best });
    }
    const improved = curateBox(learned, items, first).itemIds;

    before.push(average(baseline.map(id => simulatedRating(taste, byId[id]))));
    after.push(average(improved.map(id => simulatedRating(taste, byId[id]))));
  });

  return {
    profiles: count,
    rulesVersion: config.RULES_VERSION,
    beforeAvg: Math.round(average(before) * 100) / 100,
    afterAvg: Math.round(average(after) * 100) / 100,
    improvedProfiles: after.filter((v, i) => v > before[i]).length,
    worsenedProfiles: after.filter((v, i) => v < before[i]).length
  };
}

if (require.main === module) {
  const result = evaluateModel({ count: Number(process.argv[2]) || 40 });
  console.log(`Evaluación del motor (${result.rulesVersion}) con ${result.profiles} perfiles sintéticos`);
  console.log(`  Calificación promedio simulada ANTES del reentrenamiento:   ${result.beforeAvg.toFixed(2)} / 5`);
  console.log(`  Calificación promedio simulada DESPUÉS del reentrenamiento: ${result.afterAvg.toFixed(2)} / 5`);
  console.log(`  Perfiles que mejoran: ${result.improvedProfiles} · empeoran: ${result.worsenedProfiles}`);
}

module.exports = { evaluateModel };
