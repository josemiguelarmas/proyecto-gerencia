// Offline evaluation of recommendation engine (HU-06, SCRUM-49).
// Asserts 100% of hard constraints are satisfied across 30 synthetic profiles.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { curateBox, calculateFit } = require('../backend/engine');
const { stockInSize } = require('../backend/catalog');
const config = require('../backend/config');

const PROFILES_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'synthetic-profiles.json');
const CATALOG_PATH = path.join(__dirname, '..', 'backend', 'data', 'seed', 'catalog.json');

function runRecommenderEvaluation() {
  const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

  assert.ok(Array.isArray(profiles) && profiles.length >= 30, 'Debe haber al menos 30 perfiles sintéticos');

  let passed = 0;
  let totalEvaluated = 0;
  const hardConstraintFailures = [];
  const recommendedProductIds = new Set();
  let totalScoreSum = 0;
  let totalOutfitScoreSum = 0;

  profiles.forEach(profile => {
    totalEvaluated++;
    const planKey = profile.plan || 'esencial';
    const plan = config.PLANS[planKey];
    const expectedCount = plan.items;
    const receivedIds = profile.receivedItemIds || [];

    const curated = curateBox(profile, catalog, receivedIds);

    // 1. Hard constraint: correct item count
    if (curated.itemIds.length !== expectedCount) {
      hardConstraintFailures.push(`${profile.id}: esperado ${expectedCount} prendas, obtenido ${curated.itemIds.length}`);
    }

    // 2. Hard constraint: target cost cap
    if (curated.totalCostCOP > plan.targetCostCOP) {
      hardConstraintFailures.push(`${profile.id}: costo ${curated.totalCostCOP} excede tope ${plan.targetCostCOP}`);
    }

    // 3. Hard constraints per recommended item
    curated.recommendations.forEach(rec => {
      recommendedProductIds.add(rec.productId);
      const product = catalog.find(p => p.id === rec.productId);
      if (!product) {
        hardConstraintFailures.push(`${profile.id}: producto ${rec.productId} no existe en catálogo`);
        return;
      }

      // Line matching
      if (profile.line === 'm' && product.line === 'f') {
        hardConstraintFailures.push(`${profile.id} (m): prenda ${product.id} es de línea femenina`);
      }
      if (profile.line === 'f' && product.line === 'm') {
        hardConstraintFailures.push(`${profile.id} (f): prenda ${product.id} es de línea masculina`);
      }

      // Size calculation and stock > 0
      const calculatedSize = calculateFit(profile, product).size;
      if (rec.size !== calculatedSize) {
        hardConstraintFailures.push(`${profile.id}: talla ${rec.size} difiere de la calculada ${calculatedSize}`);
      }
      const stock = stockInSize(product, rec.size);
      if (stock <= 0) {
        hardConstraintFailures.push(`${profile.id}: prenda ${product.id} en talla ${rec.size} sin stock`);
      }

      // Non-repetition (unless catalog exhausted)
      if (receivedIds.includes(product.id) && !rec.repeated) {
        hardConstraintFailures.push(`${profile.id}: prenda ${product.id} ya fue recibida y no se marcó como repetida`);
      }

      totalScoreSum += rec.score;
    });

    totalOutfitScoreSum += (curated.outfitScore || 85);
    if (hardConstraintFailures.length === 0) {
      passed++;
    }
  });

  const catalogDiversityPct = Math.round((recommendedProductIds.size / catalog.length) * 100);
  const avgItemScore = Math.round((totalScoreSum / (totalEvaluated * 3)) * 10) / 10;
  const avgOutfitScore = Math.round(totalOutfitScoreSum / totalEvaluated);

  const report = {
    totalProfiles: totalEvaluated,
    passedProfiles: passed,
    hardConstraintsSuccessRate: `${Math.round((passed / totalEvaluated) * 100)}%`,
    catalogCoverage: `${recommendedProductIds.size}/${catalog.length} (${catalogDiversityPct}%)`,
    avgItemScore,
    avgOutfitScore,
    failures: hardConstraintFailures
  };

  if (hardConstraintFailures.length > 0) {
    console.error('Fallas de restricciones duras en el evaluador:', hardConstraintFailures);
    throw new Error(`Evaluación fallida: ${hardConstraintFailures.length} restricciones duras violadas.`);
  }

  return report;
}

if (require.main === module) {
  try {
    const report = runRecommenderEvaluation();
    console.log('=== EVALUACIÓN OFFLINE DEL MOTOR DE RECOMENDACIÓN (HU-06) ===');
    console.log(`Perfiles evaluados: ${report.totalProfiles}`);
    console.log(`Cumplimiento de restricciones duras: ${report.hardConstraintsSuccessRate}`);
    console.log(`Cobertura de catálogo: ${report.catalogCoverage}`);
    console.log(`Puntaje promedio de afinidad: ${report.avgItemScore}`);
    console.log(`Puntaje promedio de outfit: ${report.avgOutfitScore}/100`);
    console.log('✓ 100% de restricciones duras cumplidas con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('Error en evaluación:', err.message);
    process.exit(1);
  }
}

module.exports = { runRecommenderEvaluation };
