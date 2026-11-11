// Catalog routes: the public product list used by the SPA and the admin endpoints to list,
// create or update products and to import a catalog CSV (HU-05). CSV parsing and product
// normalization live in backend/catalog.js; persistence goes through the database facade.
const { db } = require('../database');
const { importCatalogCsv } = require('../catalog');
const { sendJson, parseJsonBody } = require('../lib/http');

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

// HU-05: importación de catálogo por CSV (body JSON { csv })
async function importProducts({ req, res }) {
  const { csv } = await parseJsonBody(req);
  if (typeof csv !== 'string' || !csv.trim()) {
    return sendJson(res, 400, { error: 'Adjunta un archivo CSV con contenido.' });
  }
  const report = importCatalogCsv(csv, db.catalog);
  if (report.fatal) return sendJson(res, 400, { error: report.fatal });
  if (report.imported > 0) db.saveCatalog();
  return sendJson(res, 200, { success: true, ...report });
}

module.exports = [
  { method: 'GET', path: '/api/products', public: true, handler: listPublicProducts },
  { method: 'GET', path: '/api/admin/products', handler: listProducts },
  { method: 'POST', path: '/api/admin/products', handler: saveProduct },
  { method: 'POST', path: '/api/admin/products/import', handler: importProducts }
];
