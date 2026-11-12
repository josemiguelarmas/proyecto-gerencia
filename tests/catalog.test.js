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

// ---------------------------------------------------------------- SCRUM-39 CSV import

const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

// The CSV goes as the raw request body, the way a brand's file is uploaded.
async function postCsv(csv, token = admin, contentType = 'text/csv; charset=utf-8') {
  const res = await fetch(`${app.baseUrl}/api/admin/catalog/import`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, Authorization: `Bearer ${token}` },
    body: csv
  });
  return { status: res.status, body: await res.json() };
}

test('SCRUM-39 Escenario: un administrador autenticado sube un CSV válido y las prendas quedan disponibles', async () => {
  const res = await postCsv(fixture('catalog-good.csv'));
  assert.equal(res.status, 200);
  assert.equal(res.body.imported, 3);
  assert.equal(res.body.updated, 1);
  assert.deepEqual(res.body.errors, []);

  const sobre = store.catalog.find(p => p.name === 'Sobrecamisa Dril Prueba');
  assert.equal(sobre.fabric, 'Dril 100% algodón, prelavado', 'campo entre comillas con coma');
  assert.deepEqual(sobre.variants.map(v => [v.sku, v.size, v.stock, v.reserved, v.wholesalePrice, v.retailPrice]),
    [['TALLER-SOBRE-S', 'S', 4, 0, 52000, 149000], ['TALLER-SOBRE-M', 'M', 6, 0, 52000, 149000]]);
  const recto = store.catalog.find(p => p.name === 'Pantalón Recto Prueba');
  assert.equal(recto.variants[0].color, 'Gris "carbón"', 'comillas dobles escapadas');
  assert.equal(recto.variants[0].wholesalePrice, 61000);
  assert.match(recto.variants[0].sku, /^PROD-\d+-L-GRIS-CARBON$/, 'sku generado cuando la marca no lo envía');
  assert.equal(inventory.findVariant({ sku: 'PROD-01-M-LADRILLO-LAVADO' }).variant.stock, 12, 'upsert por sku');

  const publicList = await app.get('/api/products');
  assert.ok(publicList.body.some(p => p.id === sobre.id), 'la prenda importada está en el catálogo público');
  assert.ok(inventory.listMovements({ sku: 'TALLER-SOBRE-M' }).some(m => m.type === 'IMPORT' && m.stockAfter === 6), 'el stock importado queda en movimientos');
});

test('SCRUM-39 upsert: volver a subir el mismo archivo actualiza por sku y no duplica variantes', async () => {
  const before = store.catalog.length;
  const res = await postCsv(fixture('catalog-good.csv'));
  assert.equal(res.status, 200);
  assert.equal(res.body.imported, 0);
  assert.equal(res.body.updated, 4);
  assert.equal(store.catalog.length, before);
  assert.equal(store.catalog.find(p => p.name === 'Sobrecamisa Dril Prueba').variants.length, 2);
});

test('SCRUM-39 Escenario: el CSV tiene filas con errores y el administrador ve el reporte por fila y campo', async () => {
  const res = await postCsv(fixture('catalog-mixed.csv'));
  assert.equal(res.status, 200);
  assert.equal(res.body.imported, 2, 'las filas válidas se importan aunque otras fallen');
  assert.equal(res.body.updated, 0);
  assert.deepEqual(res.body.errors.map(e => [e.row, e.field]), [[3, 'talla'], [4, 'estilo'], [4, 'stock'], [5, 'sku'], [7, 'sku']]);
  res.body.errors.forEach(e => assert.ok(typeof e.message === 'string' && e.message.length > 10));
  assert.match(res.body.errors[3].message, /ya pertenece/);
  const mixed = store.catalog.find(p => p.name === 'Camisa Mixta Prueba');
  assert.deepEqual(mixed.variants.map(v => [v.sku, v.stock]), [['MIX-CAMISA-M', 5], ['MIX-CAMISA-S', 2]]);
  assert.equal(inventory.findVariant({ sku: 'PROD-02-M-ARENA-NATURAL' }).product.id, 'prod-02', 'el sku ajeno no se toca');
});

test('SCRUM-39 archivo malformado: comillas sin cerrar o columnas faltantes se rechazan sin cambiar el catálogo', async () => {
  const snapshot = JSON.stringify(store.catalog);
  const bad = await postCsv(fixture('catalog-malformed.csv'));
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /comillas sin cerrar/);
  assert.deepEqual(bad.body.errors.map(e => [e.row, e.field]), [[3, null]]);
  const noColumns = await postCsv('marca,nombre\nX,Y\n');
  assert.equal(noColumns.status, 400);
  assert.ok(noColumns.body.errors.some(e => e.field === 'precio_mayorista'));
  assert.equal((await postCsv('')).status, 400);
  assert.equal(JSON.stringify(store.catalog), snapshot);
});

test('SCRUM-39 seguridad: solo el administrador importa y el cuerpo debe ser text/csv', async () => {
  assert.equal((await postCsv(fixture('catalog-good.csv'), await app.loginAs('CLIENT'))).status, 403);
  assert.equal((await postCsv(fixture('catalog-good.csv'), admin, 'application/json')).status, 415);
});

test('SCRUM-39 CSV de Excel en español separado por punto y coma', async () => {
  const csv = 'sku;marca;nombre;categoria;estilo;ocasion;talla;color;precio_mayorista;stock\nPYC-01;Taller Prueba;Falda Punto y Coma;bottom;retro|clasico;fiesta;S;Vino;40.000;3\n';
  const res = await postCsv(csv);
  assert.equal(res.status, 200);
  assert.equal(res.body.imported, 1);
  assert.deepEqual(inventory.findVariant({ sku: 'PYC-01' }).product.styles, ['retro', 'clasico']);
});

// ---------------------------------------------------------------- SCRUM-40 CRUD with soft delete

const NEW_PRODUCT = {
  name: 'Chaqueta Prueba CRUD',
  brandName: 'Taller Prueba',
  brandCity: 'Cali',
  category: 'capa',
  fit: 'regular',
  styles: ['minimal'],
  occasions: ['clase'],
  priceCOP: 189000,
  wholesalePriceCOP: 70000,
  imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800',
  variants: [{ size: 'M', color: 'Negro', stock: 5 }, { sku: 'CRUD-CHAQ-L', size: 'L', color: 'Negro', stock: 0 }]
};

test('SCRUM-40 Escenario: el administrador crea una prenda desde el formulario y queda en el catálogo con sus variantes', async () => {
  const res = await app.post('/api/admin/products', NEW_PRODUCT, admin);
  assert.equal(res.status, 201);
  const p = res.body.product;
  assert.match(p.id, /^prod-\d+$/);
  assert.equal(p.brandId, 'taller-prueba');
  assert.deepEqual(p.variants.map(v => [v.sku, v.stock, v.reserved, v.wholesalePrice, v.retailPrice]),
    [[`${p.id.toUpperCase()}-M-NEGRO`, 5, 0, 70000, 189000], ['CRUD-CHAQ-L', 0, 0, 70000, 189000]]);
  assert.ok(inventory.listMovements({ productId: p.id }).some(m => m.type === 'RESTOCK' && m.qty === 5));
  assert.ok((await app.get('/api/products')).body.some(x => x.id === p.id));
});

test('SCRUM-40 validación: el POST rechaza datos incompletos o fuera del vocabulario con errores por campo y sin asignación masiva', async () => {
  const bad = await app.post('/api/admin/products', { ...NEW_PRODUCT, name: '', category: 'falda', priceCOP: -1, variants: [{ size: 'XXXL', color: 'Rojo', stock: 1 }] }, admin);
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body.errors.map(e => e.field).sort(), ['category', 'name', 'priceCOP', 'variants[0].size']);
  const noVariants = await app.post('/api/admin/products', { ...NEW_PRODUCT, variants: [] }, admin);
  assert.ok(noVariants.body.errors.some(e => e.field === 'variants'));
  const dupSku = await app.post('/api/admin/products', { ...NEW_PRODUCT, variants: [{ sku: 'CRUD-CHAQ-L', size: 'S', color: 'Azul', stock: 1 }] }, admin);
  assert.ok(dupSku.body.errors.some(e => e.field === 'variants[0].sku' && /ya existe/.test(e.message)));
  const sneaky = await app.post('/api/admin/products', { ...NEW_PRODUCT, name: 'Prenda Sin Colarse', id: 'prod-01', deletedAt: null, isAdmin: true, variants: [{ size: 'S', color: 'Gris', stock: 1, reserved: 99 }] }, admin);
  assert.equal(sneaky.status, 201);
  assert.notEqual(sneaky.body.product.id, 'prod-01');
  assert.equal(sneaky.body.product.isAdmin, undefined);
  assert.equal(sneaky.body.product.variants[0].reserved, 0);
  assert.equal((await app.post('/api/admin/products', NEW_PRODUCT, await app.loginAs('CLIENT'))).status, 403);
});

test('SCRUM-40 Escenario: el administrador edita precio y stock de una variante y el cambio queda registrado', async () => {
  const p = store.catalog.find(x => x.name === 'Chaqueta Prueba CRUD');
  const res = await app.put(`/api/admin/products/${p.id}`, { priceCOP: 179000, variants: [{ sku: 'CRUD-CHAQ-L', stock: 3, retailPrice: 179000 }, { size: 'S', color: 'Negro', stock: 2 }] }, admin);
  assert.equal(res.status, 200);
  assert.equal(res.body.product.priceCOP, 179000);
  assert.equal(res.body.product.name, 'Chaqueta Prueba CRUD', 'los campos no enviados se conservan');
  const l = res.body.product.variants.find(v => v.sku === 'CRUD-CHAQ-L');
  assert.deepEqual([l.stock, l.retailPrice], [3, 179000]);
  assert.equal(res.body.product.variants.length, 3);
  assert.ok(inventory.listMovements({ sku: 'CRUD-CHAQ-L' }).some(m => m.type === 'ADJUST' && m.stockBefore === 0 && m.stockAfter === 3));

  inventory.reserve({ sku: 'CRUD-CHAQ-L', qty: 2, reason: 'Caja aprobada', refId: 'box_crud' });
  const below = await app.put(`/api/admin/products/${p.id}`, { variants: [{ sku: 'CRUD-CHAQ-L', stock: 1 }] }, admin);
  assert.equal(below.status, 400);
  assert.match(below.body.errors[0].message, /reservadas/);
  assert.equal((await app.put('/api/admin/products/prod-999', { priceCOP: 1 }, admin)).status, 404);
  assert.equal((await app.put(`/api/admin/products/${p.id}`, { styles: ['gotico'] }, admin)).status, 400);
});

test('SCRUM-40 Escenario: borrar una prenda es lógico, sale del catálogo público y del motor, y se puede restaurar', async () => {
  const p = store.catalog.find(x => x.name === 'Chaqueta Prueba CRUD');
  const blocked = await app.del(`/api/admin/products/${p.id}`, admin);
  assert.equal(blocked.status, 409, 'no se borra con unidades reservadas');
  inventory.release({ sku: 'CRUD-CHAQ-L', qty: 2, reason: 'Caja rechazada', refId: 'box_crud' });

  const del = await app.del(`/api/admin/products/${p.id}`, admin);
  assert.equal(del.status, 200);
  assert.ok(del.body.product.deletedAt);
  assert.ok(store.catalog.some(x => x.id === p.id), 'sigue en el archivo para el historial');
  assert.ok(!(await app.get('/api/products')).body.some(x => x.id === p.id));
  assert.ok((await app.get('/api/admin/products', admin)).body.products.some(x => x.id === p.id && x.deletedAt));
  const { stockInSize } = require('../backend/catalog');
  assert.equal(stockInSize(p, 'M'), 0);
  assert.equal((await app.put(`/api/admin/products/${p.id}`, { priceCOP: 1000 }, admin)).status, 409);

  const restored = await app.post(`/api/admin/products/${p.id}/restore`, null, admin);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.product.deletedAt, undefined);
  assert.ok(stockInSize(p, 'M') > 0);
});

test('SCRUM-40 formulario: el panel recibe el vocabulario controlado para tallas, categorías, estilos y ocasiones', async () => {
  const vocab = require('../backend/domain/vocab');
  const res = await app.get('/api/admin/catalog/vocab', admin);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.styles, vocab.STYLES);
  assert.deepEqual(res.body.occasions, vocab.OCCASIONS);
  assert.deepEqual(res.body.sizes, vocab.SIZES);
  assert.deepEqual(res.body.categories, vocab.CATEGORIES);
});
