// HU-05 (SCRUM-37) catalog of allied brands: variant model and inventory repository
// (SCRUM-38), CSV import (SCRUM-39), product CRUD with soft delete (SCRUM-40) and style
// tagging with the controlled vocabulary (SCRUM-41). Test names follow the Gherkin scenarios.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer } = require('./helpers/server');

let app;
let admin;
let inventory;
let store;
let engine;

before(async () => {
  app = await startServer();
  admin = await app.loginAs('ADMIN');
  inventory = require('../backend/repos/inventory');
  store = require('../backend/repos/store');
  engine = require('../backend/engine');
});

after(() => app.close());

const PROFILE = { line: 'u', risk: 1, styles: ['urbano', 'retro'], occasions: ['clase'], fit: 'holgado', plan: 'esencial', measures: { height: 175, weight: 70, build: 'media', usual: 'M' } };

// ---------------------------------------------------------------- SCRUM-38 data model

test('SCRUM-38 modelo: cada variante del catálogo semilla tiene sku único, stock y reservado enteros no negativos y precios', () => {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'data', 'seed', 'catalog.json'), 'utf8'));
  assert.equal(seed.length, 18);
  const skus = new Set();
  seed.forEach(p => {
    assert.ok(p.brandId && p.brandName, `${p.id} sin marca`);
    p.variants.forEach(v => {
      assert.ok(v.sku && !skus.has(v.sku), `${p.id}: sku ausente o repetido ${v.sku}`);
      skus.add(v.sku);
      assert.ok(Number.isInteger(v.stock) && v.stock >= 0);
      assert.ok(Number.isInteger(v.reserved) && v.reserved >= 0 && v.reserved <= v.stock);
      assert.ok(Number.isInteger(v.wholesalePrice) && v.wholesalePrice > 0);
      assert.ok(Number.isInteger(v.retailPrice) && v.retailPrice > 0);
    });
  });
});

test('SCRUM-38 modelo: una variante guardada antes del modelo se completa al normalizar', () => {
  const { normalizeProduct } = require('../backend/catalog');
  const legacy = { id: 'prod-99', brandName: 'Marca Vieja', priceCOP: 100000, variants: [{ size: 'M', color: 'Azul noche', stock: 3 }] };
  assert.equal(normalizeProduct(legacy), true);
  assert.deepEqual(legacy.variants[0], { size: 'M', color: 'Azul noche', stock: 3, sku: 'PROD-99-M-AZUL-NOCHE', reserved: 0, wholesalePrice: 30000, retailPrice: 100000 });
  assert.equal(legacy.brandId, 'marca-vieja');
});

test('SCRUM-38 marcas: el administrador ve las marcas aliadas con su número de prendas', async () => {
  const res = await app.get('/api/admin/brands', admin);
  assert.equal(res.status, 200);
  const mono = res.body.brands.find(b => b.id === 'mono');
  assert.ok(mono && mono.name === 'Mono Textil' && mono.products > 0);
  assert.equal((await app.get('/api/admin/brands', await app.loginAs('CLIENT'))).status, 403);
});

test('SCRUM-38 inventario: reservar, liberar, consumir y reingresar registran un movimiento con motivo', () => {
  const sku = store.catalog[0].variants[0].sku;
  const variant = () => inventory.findVariant({ sku }).variant;
  const start = { ...variant() };

  const r = inventory.reserve({ sku, qty: 2, reason: 'Caja aprobada', refId: 'box_t1' });
  assert.equal(variant().reserved, start.reserved + 2);
  assert.equal(r.type, 'RESERVE');
  inventory.release({ sku, qty: 1, reason: 'Caja rechazada', refId: 'box_t1' });
  const c = inventory.consume({ sku, qty: 1, reason: 'Despacho', refId: 'box_t1' });
  assert.equal(variant().stock, start.stock - 1);
  assert.equal(variant().reserved, start.reserved);
  assert.equal(c.stockBefore - c.stockAfter, 1);
  inventory.restock({ productId: store.catalog[0].id, size: start.size, color: start.color, reason: 'Devolución', refId: 'ret_t1' });
  assert.equal(variant().stock, start.stock);

  const moves = inventory.listMovements({ sku }).map(m => [m.type, m.reason]);
  assert.deepEqual(moves.slice(-4), [['RESERVE', 'Caja aprobada'], ['RELEASE', 'Caja rechazada'], ['CONSUME', 'Despacho'], ['RESTOCK', 'Devolución']]);
  const saved = JSON.parse(fs.readFileSync(path.join(app.dataDir, 'catalog.json'), 'utf8'));
  assert.equal(saved[0].variants[0].stock, start.stock, 'el catálogo se persiste');
});

test('SCRUM-38 inventario: no se reserva más de lo disponible ni se consume sin reserva ni se acepta un movimiento sin motivo', () => {
  const v = store.catalog[1].variants[0];
  const available = v.stock - v.reserved;
  assert.throws(() => inventory.reserve({ sku: v.sku, qty: available + 1, reason: 'x' }), e => e.status === 409);
  assert.throws(() => inventory.consume({ sku: v.sku, qty: v.reserved + 1, reason: 'x' }), e => e.status === 409);
  assert.throws(() => inventory.release({ sku: v.sku, qty: v.reserved + 1, reason: 'x' }), e => e.status === 409);
  assert.throws(() => inventory.reserve({ sku: v.sku, qty: 1 }), e => e.status === 400);
  assert.throws(() => inventory.reserve({ sku: v.sku, qty: 1.5, reason: 'x' }), e => e.status === 400);
  assert.throws(() => inventory.restock({ sku: 'NO-EXISTE', reason: 'x' }), e => e.status === 404);
  assert.throws(() => inventory.setStock({ sku: v.sku, stock: -1, reason: 'x' }), e => e.status === 400);
  assert.equal(v.stock - v.reserved, available, 'los intentos fallidos no cambian el stock');
});

test('SCRUM-38 Escenario: una prenda sin unidades disponibles nunca es seleccionada por el motor', () => {
  const catalog = JSON.parse(JSON.stringify(store.catalog));
  const first = engine.curateBox(PROFILE, catalog).recommendations[0];
  const target = catalog.find(p => p.id === first.productId);
  // Stock positivo pero todo reservado: disponible 0.
  target.variants.forEach(v => { v.stock = 4; v.reserved = 4; });
  assert.ok(!engine.curateBox(PROFILE, catalog).itemIds.includes(target.id), 'una variante con disponible 0 no se elige');
  target.variants.forEach(v => { v.reserved = 0; });
  target.deletedAt = new Date().toISOString();
  assert.ok(!engine.curateBox(PROFILE, catalog).itemIds.includes(target.id), 'una prenda eliminada no se elige');
});
