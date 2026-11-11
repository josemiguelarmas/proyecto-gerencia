// Catalog routes: the public product list used by the SPA and the admin endpoints to list,
// create or update products and to import a catalog CSV (HU-05). CSV parsing and product
// normalization live in backend/catalog.js; persistence goes through the database facade.
const { db } = require('../database');
const { importCatalogCsv } = require('../catalog');
const products = require('../repos/products');
const inventory = require('../repos/inventory');
const { newId } = require('../lib/crypto');
const { sendJson, parseJsonBody, readRawBody, CSV_IMPORT_MAX_BYTES } = require('../lib/http');

function listPublicProducts({ res }) {
  return sendJson(res, 200, db.catalog);
}

function listProducts({ res }) {
  return sendJson(res, 200, { products: db.catalog });
}

async function saveProduct({ req, res }) {
  const body = await parseJsonBody(req);
  if (!body.name || !body.brandName || !body.category) {
    return sendJson(res, 400, { error: 'Nombre, marca y categoría son requeridos.' });
  }
  const saved = db.saveProduct(body);
  return sendJson(res, 201, { success: true, product: saved });
}

function listBrands({ res }) {
  return sendJson(res, 200, { brands: products.listBrands() });
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

// Body JSON { csv } (the admin UI and older clients).
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
  { method: 'POST', path: '/api/admin/products', handler: saveProduct },
  { method: 'POST', path: '/api/admin/products/import', handler: importProducts },
  { method: 'POST', path: '/api/admin/catalog/import', handler: importCatalogFile },
  { method: 'GET', path: '/api/admin/brands', handler: listBrands }
];
