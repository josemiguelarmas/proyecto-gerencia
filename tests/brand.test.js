// HU-19: Panel de inventario para marcas aliadas (SCRUM-114..118).
// Pruebas automatizadas de autenticación de marca, aislamiento de datos,
// actualización de stock, importación CSV acotada, reporte de ventas/devoluciones y alertas de stock bajo.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');

let app;
let db;
let config;

before(async () => {
  app = await startServer();
  ({ db } = require('../backend/database'));
  config = require('../backend/config');
});

after(async () => {
  await app.close();
});

test('SCRUM-115: autenticación de marca y aislamiento de datos (rol BRAND ve solo sus productos)', async () => {
  // 1. Cliente normal recibe 403 en endpoints de marca
  const client = await app.loginAs('CLIENT');
  const forbiddenRes = await app.get('/api/brand/products', client);
  assert.equal(forbiddenRes.status, 403);
  assert.match(forbiddenRes.body.error, /Marca Aliada/);

  // 2. Login con rol BRAND (Marca Mono Textil, brandId: 'mono')
  const brandMono = await app.loginAs('BRAND');
  assert.ok(brandMono);

  // 3. Consultar productos: solo debe devolver prendas de 'mono'
  const res = await app.get('/api/brand/products', brandMono);
  assert.equal(res.status, 200);
  assert.equal(res.body.brandId, 'mono');
  assert.ok(res.body.products.length > 0);
  assert.ok(res.body.products.every(p => (p.brandId || p.brandName.toLowerCase().includes('mono')) === 'mono'));
});

test('SCRUM-116: actualización de stock por variante y rechazo al intentar editar otra marca', async () => {
  const brandMono = await app.loginAs('BRAND');

  // Obtener producto de Mono Textil
  const listRes = await app.get('/api/brand/products', brandMono);
  const monoProduct = listRes.body.products[0];
  assert.ok(monoProduct);

  // Actualizar stock de talla M a 25 unidades
  const updateRes = await app.put(`/api/brand/products/${monoProduct.id}/stock`, {
    size: 'M',
    stock: 25
  }, brandMono);
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.success, true);
  const updatedVariant = updateRes.body.product.variants.find(v => v.size === 'M');
  assert.equal(updatedVariant.stock, 25);

  // Verificar movimiento registrado en auditoría de inventario
  const lastMov = db.data.inventoryMovements.find(m => m.productId === monoProduct.id && m.newStock === 25);
  assert.ok(lastMov);
  assert.equal(lastMov.type, 'BRAND_STOCK_UPDATE');

  // Intentar modificar una prenda que pertenece a otra marca (ej. Ceiba Estudio)
  const otherProduct = db.catalog.find(p => p.brandId !== 'mono' && !p.deleted);
  assert.ok(otherProduct);

  const hackRes = await app.put(`/api/brand/products/${otherProduct.id}/stock`, {
    size: 'S',
    stock: 50
  }, brandMono);
  assert.equal(hackRes.status, 403);
  assert.match(hackRes.body.error, /otra marca/);
});

test('SCRUM-116: importación masiva CSV acotada a la marca y rechazo de marcas ajenas', async () => {
  const brandMono = await app.loginAs('BRAND');

  // CSV con filas de Mono Textil (válido)
  const validCsv = `marca,nombre,categoria,estilo,ocasion,talla,color,precio_mayorista,stock
Mono Textil,Camiseta Festival,top,urbano,fiesta,S,Blanco,25000,12
Mono Textil,Camiseta Festival,top,urbano,fiesta,M,Blanco,25000,18`;

  const importRes = await app.post('/api/brand/products/import', { csv: validCsv }, brandMono);
  assert.equal(importRes.status, 200);
  assert.equal(importRes.body.success, true);
  assert.ok(importRes.body.imported >= 1 || importRes.body.updated >= 1);

  // CSV fraudulento con filas de Ceiba Estudio intentado por Mono Textil -> 403
  const fraudCsv = `marca,nombre,categoria,estilo,ocasion,talla,color,precio_mayorista,stock
Ceiba Estudio,Pantalón Lino,bottom,minimal,clase,M,Beige,40000,10`;

  const fraudRes = await app.post('/api/brand/products/import', { csv: fraudCsv }, brandMono);
  assert.equal(fraudRes.status, 403);
  assert.match(fraudRes.body.error, /otra marca/);
});

test('SCRUM-117: reporte de ventas y devoluciones por marca', async () => {
  const brandMono = await app.loginAs('BRAND');

  const reportRes = await app.get('/api/brand/reports/sales-returns', brandMono);
  assert.equal(reportRes.status, 200);
  assert.equal(reportRes.body.brandId, 'mono');
  assert.ok(reportRes.body.sales);
  assert.ok(Number.isInteger(reportRes.body.sales.deliveredItems));
  assert.ok(Number.isFinite(reportRes.body.sales.retailSalesCOP));
  assert.ok(Number.isFinite(reportRes.body.sales.wholesaleRevenueCOP));
  assert.ok(reportRes.body.returns);
  assert.ok(Number.isInteger(reportRes.body.returns.returnedItems));
  assert.ok(Number.isFinite(reportRes.body.returns.returnRatePct));
  assert.ok(reportRes.body.ratings);
});

test('SCRUM-118: alertas de stock bajo y agotado por marca', async () => {
  const brandMono = await app.loginAs('BRAND');

  // Ponemos una variante en stock 2 (bajo umbral de 3)
  const listRes = await app.get('/api/brand/products', brandMono);
  const monoProduct = listRes.body.products[0];

  await app.put(`/api/brand/products/${monoProduct.id}/stock`, {
    size: 'XL',
    stock: 2
  }, brandMono);

  const alertsRes = await app.get('/api/brand/alerts/low-stock?threshold=3', brandMono);
  assert.equal(alertsRes.status, 200);
  assert.equal(alertsRes.body.brandId, 'mono');
  assert.ok(alertsRes.body.lowStockCount >= 1);
  const alert = alertsRes.body.alerts.find(a => a.productId === monoProduct.id && a.size === 'XL');
  assert.ok(alert);
  assert.equal(alert.currentStock, 2);
  assert.equal(alert.status, 'LOW_STOCK');
});
