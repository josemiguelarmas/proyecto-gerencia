// Pruebas automatizadas del motor de recomendación y aprendizaje (HU-06, HU-11, Stream C2)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer } = require('./helpers/server');

let app;
let db;
let config;
let engine;
let learning;
let modelVersions;
let evalRecommender;
let evalFeedback;

before(async () => {
  app = await startServer();
  ({ db } = require('../backend/database'));
  config = require('../backend/config');
  engine = require('../backend/engine');
  learning = require('../backend/learning');
  modelVersions = require('../backend/modelVersions');
  evalRecommender = require('../scripts/eval-recommender');
  evalFeedback = require('../scripts/eval-feedback');
});

after(async () => {
  await app.close();
});

test('SCRUM-44: style-rules.json existe, está marcado "pendiente de validación del estilista" y es consumido', async () => {
  const rules = engine.getStyleRules();
  assert.equal(rules.status, 'pendiente de validación del estilista');
  assert.ok(rules.styles && rules.styles.urbano, 'Define estilos con descripción y afinidades');
  assert.ok(rules.occasions && rules.occasions.clase, 'Define ocasiones de uso');
  assert.ok(rules.cuts && rules.cuts.regular, 'Define holguras de corte');
});

test('SCRUM-46: outfit-rules.json define slots, outfits y matriz de compatibilidad', async () => {
  const rules = engine.getOutfitRules();
  assert.equal(rules.status, 'pendiente de validación del estilista');
  assert.ok(rules.plans && rules.plans.esencial && rules.plans.estilo, 'Reglas por plan esencial y estilo');
  assert.equal(rules.plans.esencial.itemCount, 3);
  assert.equal(rules.plans.estilo.itemCount, 5);
  assert.ok(rules.compatibilityMatrix && rules.compatibilityMatrix.urbano, 'Matriz de compatibilidad entre estilos');
});

test('SCRUM-45: curateBox satisface restricciones duras (talla en stock, costo tope, línea y sin repetición)', async () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'data', 'seed', 'catalog.json'), 'utf8'));
  const profile = {
    id: 'usr_test_c2_01',
    plan: 'esencial',
    line: 'f',
    measures: { height: 165, weight: 55, build: 'delgada', usual: 'S' },
    fit: 'regular',
    styles: ['minimal', 'urbano'],
    occasions: ['clase']
  };

  const curated = engine.curateBox(profile, catalog, []);
  assert.equal(curated.itemIds.length, 3, 'Plan esencial debe tener 3 prendas');
  assert.ok(curated.totalCostCOP <= curated.targetCostCOP, 'Costo total dentro del tope objetivo');
  assert.equal(curated.withinCap, true);

  // Comprobar que no hay prendas masculinas
  curated.recommendations.forEach(rec => {
    const prod = catalog.find(p => p.id === rec.productId);
    assert.notEqual(prod.line, 'm', 'No debe incluir prendas de línea masculina para usuario femenino');
  });

  // Comprobar no repetición
  const firstItem = curated.itemIds[0];
  const curated2 = engine.curateBox(profile, catalog, [firstItem]);
  assert.ok(!curated2.itemIds.includes(firstItem) || curated2.recommendations.find(r => r.productId === firstItem).repeated, 'Prenda ya recibida se excluye o se marca como repetida');
});

test('SCRUM-46: la caja incluye outfits calculados y un puntaje global de compatibilidad', async () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'data', 'seed', 'catalog.json'), 'utf8'));
  const profile = {
    plan: 'esencial',
    line: 'u',
    measures: { height: 170, weight: 65, build: 'media', usual: 'M' },
    fit: 'regular',
    styles: ['urbano'],
    occasions: ['clase']
  };

  const curated = engine.curateBox(profile, catalog, []);
  assert.ok(Array.isArray(curated.outfits) && curated.outfits.length > 0, 'Genera outfits estructurados');
  assert.ok(typeof curated.outfitScore === 'number' && curated.outfitScore >= 0 && curated.outfitScore <= 100, 'Puntaje de outfit entre 0 y 100');
  curated.outfits.forEach(o => {
    assert.ok(o.id && o.name && o.title, 'Cada outfit tiene id, name y title');
  });
});

test('SCRUM-48: cada recomendación persiste matchedAttributes, scoreComponents, filtersApplied y modelVersion', async () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'data', 'seed', 'catalog.json'), 'utf8'));
  const profile = {
    plan: 'esencial',
    line: 'm',
    measures: { height: 180, weight: 75, build: 'media', usual: 'M' },
    fit: 'regular',
    styles: ['clasico'],
    occasions: ['entrevista']
  };

  const curated = engine.curateBox(profile, catalog, []);
  curated.recommendations.forEach(r => {
    assert.ok(r.matchedAttributes, 'Incluye matchedAttributes');
    assert.ok(r.scoreComponents, 'Incluye scoreComponents');
    assert.ok(Array.isArray(r.filtersApplied) && r.filtersApplied.length > 0, 'Incluye filtersApplied');
    assert.ok(r.modelVersion, 'Incluye modelVersion');
    assert.ok(r.explanation && r.explanation.length > 10, 'Incluye explicación detallada');
  });
});

test('SCRUM-49: evaluación offline con 30 perfiles sintéticos valida 100% de restricciones duras', async () => {
  const result = evalRecommender.runRecommenderEvaluation();
  assert.equal(result.totalProfiles, 30);
  assert.equal(result.passedProfiles, 30);
  assert.equal(result.hardConstraintsSuccessRate, '100%');
  assert.equal(result.failures.length, 0);
});

test('SCRUM-75/76: aprendizaje adapta pesos (baja con nota <= 2, sube con nota >= 5) y normaliza feedback_events', async () => {
  const profile = {
    id: 'usr_feedback_test',
    styles: ['urbano', 'minimal'],
    occasions: ['clase'],
    fit: 'regular',
    attributeWeights: { style: { urbano: 1.0, minimal: 1.0 } }
  };
  const prodLow = { id: 'p_low', styles: ['urbano'], occasions: ['clase'], fit: 'regular' };
  const prodHigh = { id: 'p_high', styles: ['minimal'], occasions: ['clase'], fit: 'regular' };

  // Baja con estilo <= 2
  learning.applyRating(profile, prodLow, 1);
  assert.ok(profile.attributeWeights.style.urbano < 1.0, 'Calificación baja reduce peso del estilo');

  // Sube con estilo 5
  learning.applyRating(profile, prodHigh, 5);
  assert.ok(profile.attributeWeights.style.minimal > 1.0, 'Calificación alta aumenta peso del estilo');

  // Ingesta crea feedbackEvents en la base de datos
  db.data.ratings.push({
    id: 'rat_test_01',
    userId: profile.id,
    productId: 'p_low',
    boxId: 'box_01',
    fitScore: 4,
    styleScore: 1,
    createdAt: new Date().toISOString()
  });

  const ingestResult = learning.ingestFeedback();
  assert.ok(ingestResult.feedbackEventsCreated >= 1, 'Crea eventos normalizados de feedback');
  assert.ok(db.data.feedbackEvents.some(e => e.type === 'RATING' && e.userId === profile.id));
});

test('SCRUM-77: evaluación de cohortes y endpoint admin GET /api/admin/model/eval-feedback', async () => {
  const adminToken = await app.loginAs('ADMIN');
  const res = await app.get('/api/admin/model/eval-feedback', adminToken);
  assert.equal(res.status, 200);
  assert.ok(res.body.cohorts, 'Devuelve cohortes de evaluación');
  assert.ok(res.body.cohorts.esencial, 'Incluye cohorte plan esencial');
  assert.ok(res.body.cohorts.estilo, 'Incluye cohorte plan estilo');
});

test('SCRUM-78: versionado de modelo con hash criptográfico y cambio de versión activa', async () => {
  const adminToken = await app.loginAs('ADMIN');
  const listRes = await app.get('/api/admin/model-versions', adminToken);
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body.versions));
  assert.ok(listRes.body.active && listRes.body.active.rulesetHash, 'Versión activa incluye rulesetHash');

  // Registrar nueva versión y activarla
  const newVer = modelVersions.registerVersion({
    id: 'rules-v2.1-test',
    name: 'Reglas V2.1 Test',
    description: 'Versión de prueba para cambio activo'
  });
  assert.equal(newVer.active, false);

  const switchRes = await app.post('/api/admin/model-versions/active', { versionId: newVer.id }, adminToken);
  assert.equal(switchRes.status, 200);
  assert.equal(switchRes.body.active.id, 'rules-v2.1-test');
  assert.equal(modelVersions.getActiveVersion().id, 'rules-v2.1-test');

  // Restaurar versión base
  modelVersions.setActiveVersion('reglas-v2');
});
