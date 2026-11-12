// Catalog routes (HU-05): the public product list used by the SPA (active products only),
// the admin product CRUD with soft delete and restore, the allied brand list, and the catalog
// CSV import. CSV parsing and validation live in backend/catalog.js; products and stock are
// persisted through repos/products.js and repos/inventory.js.
const { db } = require('../database');
const { importCatalogCsv, FITS } = require('../catalog');
const vocab = require('../domain/vocab');
const products = require('../repos/products');
const inventory = require('../repos/inventory');
const { newId } = require('../lib/crypto');
const { sendJson, parseJsonBody, readRawBody, CSV_IMPORT_MAX_BYTES } = require('../lib/http');

const PRODUCT_PATH = /^\/api\/admin\/products\/(prod-[a-z0-9-]+)$/;
const RESTORE_PATH = /^\/api\/admin\/products\/(prod-[a-z0-9-]+)\/restore$/;

// Maps a repository result to the HTTP answer.
function sendResult(res, result, okStatus = 200) {
  if (result.notFound) return sendJson(res, 404, { error: 'La prenda no existe.' });
  if (result.conflict) return sendJson(res, 409, { error: result.conflict });
  if (result.errors) {
    return sendJson(res, 400, { error: 'Revisa los datos de la prenda.', errors: result.errors });
  }
  return sendJson(res, okStatus, { success: true, product: result.product });
}

function listPublicProducts({ res }) {
  return sendJson(res, 200, products.listProducts());
}

function listProducts({ res }) {
  return sendJson(res, 200, { products: products.listProducts({ includeDeleted: true }) });
}

async function createProduct({ req, res, authUser }) {
  const body = await parseJsonBody(req);
  return sendResult(res, products.createProduct(body, { by: authUser.id }), 201);
}

async function updateProduct({ req, res, authUser, match }) {
  const body = await parseJsonBody(req);
  return sendResult(res, products.updateProduct(match[1], body, { by: authUser.id }));
}

function deleteProduct({ res, authUser, match }) {
  return sendResult(res, products.softDeleteProduct(match[1], { by: authUser.id }));
}

function restoreProduct({ res, authUser, match }) {
  return sendResult(res, products.restoreProduct(match[1], { by: authUser.id }));
}

function listBrands({ res }) {
  return sendJson(res, 200, { brands: products.listBrands() });
}

// Controlled vocabulary for the admin product form (domain/vocab.js) and the allowed cuts.
function catalogVocab({ res }) {
  return sendJson(res, 200, { sizes: vocab.SIZES, categories: vocab.CATEGORIES, styles: vocab.STYLES, occasions: vocab.OCCASIONS, fits: FITS });
}

// HU-05 (SCRUM-39): imports the CSV, saves the catalog and logs the stock changes. The
// answer is { imported, updated, errors: [{ row, field, message }] } plus counters for the UI.
function runImport(res, csv) {
  if (typeof csv !== 'string' || !csv.trim()) {
    return sendJson(res, 400, { error: 'Adjunta un archivo CSV con contenido.', imported: 0, updated: 0, errors: [] });
  }
  const { stockChanges, fatal, ...report } = importCatalogCsv(csv, db.catalog);
  if (fatal) return sendJson(res, 400, { error: fatal, imported: 0, updated: 0, errors: report.errors });
  if (report.imported + report.updated > 0) {
    db.saveCatalog();
    inventory.recordImport(stockChanges, { refId: newId('imp') });
  }
  return sendJson(res, 200, { success: true, ...report });
}

// Body JSON { csv } (older clients).
async function importProducts({ req, res }) {
  const { csv } = await parseJsonBody(req, { limit: CSV_IMPORT_MAX_BYTES });
  return runImport(res, csv);
}

// Body text/csv: the file as brands deliver it.
async function importCatalogFile({ req, res }) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!['text/csv', 'text/plain', 'application/vnd.ms-excel'].includes(type)) {
    return sendJson(res, 415, { error: 'Envía el archivo con Content-Type text/csv.', imported: 0, updated: 0, errors: [] });
  }
  return runImport(res, await readRawBody(req, { limit: CSV_IMPORT_MAX_BYTES }));
}

module.exports = [
  { method: 'GET', path: '/api/products', public: true, handler: listPublicProducts },
  { method: 'GET', path: '/api/admin/products', handler: listProducts },
  { method: 'POST', path: '/api/admin/products', handler: createProduct },
  { method: 'POST', path: '/api/admin/products/import', handler: importProducts },
  { method: 'POST', path: '/api/admin/catalog/import', handler: importCatalogFile },
  { method: 'GET', path: '/api/admin/brands', handler: listBrands },
  { method: 'GET', path: '/api/admin/catalog/vocab', handler: catalogVocab },
  { method: 'PUT', path: PRODUCT_PATH, handler: updateProduct },
  { method: 'DELETE', path: PRODUCT_PATH, handler: deleteProduct },
  { method: 'POST', path: RESTORE_PATH, handler: restoreProduct }
];
