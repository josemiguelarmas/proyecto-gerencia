// Tests for KPI calculations, materialized snapshots, alert thresholds, and data hygiene (HU-17, SCRUM-106..109)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer } = require('./helpers/server');

let app;
let db;
let config;
let kpis;
let kpiSnapshot;

before(async () => {
  app = await startServer();
  ({ db } = require('../backend/database'));
  config = require('../backend/config');
  kpis = require('../backend/kpis');
  kpiSnapshot = require('../backend/jobs/kpiSnapshot');
});

after(async () => {
  await app.close();
});

test('SCRUM-106: docs/kpi-definitions.md documenta fórmulas exactas y fuentes de datos', () => {
  const docPath = path.join(__dirname, '..', 'docs', 'kpi-definitions.md');
  assert.ok(fs.existsSync(docPath), 'Existe docs/kpi-definitions.md');
  const content = fs.readFileSync(docPath, 'utf8');
  assert.match(content, /Definición y Formulación de Métricas Operativas/);
  assert.match(content, /ActiveAtStart/);
  assert.match(content, /Churn/);
  assert.match(content, /isDemo/);
});

test('SCRUM-106: backend/kpis.js calcula churn, altas, calificación y devoluciones con exactitud matemática', () => {
  const fixture = {
    subscriptions: [
      { id: 's1', plan: 'esencial', history: [{ type: 'START', plan: 'esencial', at: '2026-09-10T00:00:00Z' }] },
      { id: 's2', plan: 'esencial', history: [{ type: 'START', plan: 'esencial', at: '2026-09-15T00:00:00Z' }, { type: 'CANCEL', plan: 'esencial', at: '2026-10-10T00:00:00Z' }] },
      { id: 's3', plan: 'estilo', history: [{ type: 'START', plan: 'estilo', at: '2026-10-05T00:00:00Z' }] },
      // Demo record
      { id: 's_demo', plan: 'esencial', isDemo: true, history: [{ type: 'START', plan: 'esencial', at: '2026-09-10T00:00:00Z' }, { type: 'CANCEL', plan: 'esencial', at: '2026-10-12T00:00:00Z' }] }
    ],
    boxes: [
      { id: 'b1', plan: 'esencial', itemIds: ['p1', 'p2', 'p3'], deliveredAt: '2026-10-12T00:00:00Z' },
      { id: 'b2', plan: 'estilo', itemIds: ['p4', 'p5', 'p6', 'p7', 'p8'], deliveredAt: '2026-10-15T00:00:00Z' }
    ],
    ratings: [
      { id: 'r1', boxId: 'b1', score: 5, createdAt: '2026-10-13T00:00:00Z' },
      { id: 'r2', boxId: 'b1', score: 3, createdAt: '2026-10-14T00:00:00Z' }
    ],
    returns: [
      { id: 'ret1', boxId: 'b1', reason: 'TOO_SMALL', createdAt: '2026-10-14T00:00:00Z' }
    ],
    cancellations: [
      { id: 'c1', plan: 'esencial', reason: 'precio', createdAt: '2026-10-10T00:00:00Z' },
      { id: 'c_demo', plan: 'esencial', reason: 'precio', isDemo: true, createdAt: '2026-10-12T00:00:00Z' }
    ]
  };

  // Sin aislar demo: al inicio hay 3 (s1, s2, s_demo), cancelan 2 (s2, s_demo) -> churn = 2/3 = 66.7%
  const withDemo = kpis.computeKpis(fixture, { month: '2026-10', now: new Date('2026-10-31T23:59:59Z'), excludeDemo: false });
  assert.equal(withDemo.activeAtStart, 3);
  assert.equal(withDemo.cancellations, 2);

  // Aislancia de datos de prueba: excludeDemo: true
  const clean = kpis.computeKpis(fixture, { month: '2026-10', now: new Date('2026-10-31T23:59:59Z'), excludeDemo: true });
  assert.equal(clean.activeAtStart, 2, 'Solo s1 y s2 estaban activos al inicio');
  assert.equal(clean.newSubscribers, 1, 'Solo s3 se dio de alta en octubre');
  assert.equal(clean.cancellations, 1, 'Solo s2 canceló en octubre');
  assert.equal(clean.churnPct, 50.0, 'Churn exacto: 1 cancel / 2 activos al inicio = 50.0%');
  assert.equal(clean.averageRating, 4.0, 'Promedio exacto: (5 + 3) / 2 = 4.0');
  assert.equal(clean.deliveredItems, 8, 'Prendas entregadas: 3 (b1) + 5 (b2) = 8');
  assert.equal(clean.sizeReturns, 1);
  assert.equal(clean.sizeReturnPct, 12.5, '1 devolución / 8 prendas = 12.5%');
});

test('SCRUM-107: job kpiSnapshot materializa snapshots en colección kpiSnapshots', async () => {
  const result = kpiSnapshot.run({ month: '2026-10', excludeDemo: true });
  assert.ok(result.snapshots.length >= 3, 'Genera snapshot para all, esencial y estilo');

  const inDb = db.data.kpiSnapshots.find(s => s.month === '2026-10' && s.plan === 'all');
  assert.ok(inDb, 'Snapshot materializado guardado en base de datos');
  assert.ok(inDb.kpis);
  assert.equal(inDb.month, '2026-10');

  // Consulta por endpoint
  const adminToken = await app.loginAs('ADMIN');
  const snapRes = await app.get('/api/admin/kpi-snapshots?month=2026-10', adminToken);
  assert.equal(snapRes.status, 200);
  assert.ok(Array.isArray(snapRes.body.snapshots));
  assert.ok(snapRes.body.snapshots.some(s => s.month === '2026-10'));

  // Disparo manual vía POST
  const runRes = await app.post('/api/admin/kpi-snapshots/run', { month: '2026-10', plan: 'esencial' }, adminToken);
  assert.equal(runRes.status, 200);
  assert.equal(runRes.body.success, true);
});

test('SCRUM-108: GET /api/admin/kpis responde con indicadores filtrados por mes y plan', async () => {
  const adminToken = await app.loginAs('ADMIN');
  const res = await app.get('/api/admin/kpis?plan=esencial', adminToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.plan, 'esencial');
  assert.ok(Array.isArray(res.body.months));
  assert.ok(res.body.churnAlert);
  assert.ok(res.body.ratingAlert);
  assert.ok(res.body.returnsAlert);
});

test('SCRUM-109: umbrales en colección settings editables por admin con validación y alertas', async () => {
  const adminToken = await app.loginAs('ADMIN');

  // Leer umbrales actuales
  const getRes = await app.get('/api/admin/settings/thresholds', adminToken);
  assert.equal(getRes.status, 200);
  assert.equal(typeof getRes.body.churnThreshold, 'number');
  assert.equal(typeof getRes.body.ratingThreshold, 'number');
  assert.equal(typeof getRes.body.returnsThreshold, 'number');

  // Rechazo de valores fuera de rango
  const invalid1 = await app.put('/api/admin/settings/thresholds', { churnThreshold: 150 }, adminToken);
  assert.equal(invalid1.status, 400);

  const invalid2 = await app.put('/api/admin/settings/thresholds', { ratingThreshold: 6.0 }, adminToken);
  assert.equal(invalid2.status, 400);

  // Guardar nuevos umbrales válidos
  const updateRes = await app.put('/api/admin/settings/thresholds', {
    churnThreshold: 8.5,
    ratingThreshold: 4.2,
    returnsThreshold: 9.0
  }, adminToken);
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.thresholds.churnThreshold, 8.5);
  assert.equal(updateRes.body.thresholds.ratingThreshold, 4.2);
  assert.equal(updateRes.body.thresholds.returnsThreshold, 9.0);

  // Verificar persistencia en base de datos
  assert.equal(db.getSetting('churnThreshold'), 8.5);
  assert.equal(db.getSetting('ratingThreshold'), 4.2);
  assert.equal(db.getSetting('returnsThreshold'), 9.0);

  // Restaurar umbrales por defecto
  await app.put('/api/admin/settings/thresholds', {
    churnThreshold: config.CHURN_THRESHOLD_DEFAULT,
    ratingThreshold: config.RATING_THRESHOLD_DEFAULT,
    returnsThreshold: config.RETURNS_THRESHOLD_DEFAULT
  }, adminToken);
});
