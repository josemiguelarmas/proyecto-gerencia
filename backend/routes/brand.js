// Brand partner portal routes (HU-19, SCRUM-114..118):
// SCRUM-115: Brand authentication and data isolation (a brand sees only its own data)
// SCRUM-116: Brand stock management and scoped CSV bulk upload
// SCRUM-117: Sales and returns report per brand
// SCRUM-118: Low-stock alerts
const { db } = require('../database');
const catalog = require('../catalog');
const config = require('../config');
const { sendJson, parseJsonBody, httpError } = require('../lib/http');
const { newId } = require('../lib/crypto');
const inventory = require('../repos/inventory');

const CSV_IMPORT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function resolveBrandId(authUser, query) {
  if (authUser.role === 'ADMIN' && query?.brandId) {
    return query.brandId.trim().toLowerCase();
  }
  if (!authUser.brandId) {
    throw httpError(403, 'Tu usuario no tiene una marca aliada asignada.');
  }
  return authUser.brandId.trim().toLowerCase();
}

function getBrandProducts({ res, authUser, query }) {
  const brandId = resolveBrandId(authUser, query);
  const products = (db.catalog || []).filter(p => !p.deleted && (p.brandId || catalog.slug(p.brandName || '')) === brandId);
  return sendJson(res, 200, {
    brandId,
    brandName: products[0]?.brandName || brandId,
    count: products.length,
    products
  });
}

async function updateVariantStock({ req, res, authUser, query, match }) {
  const brandId = resolveBrandId(authUser, query);
  const productId = match[1];
  const product = (db.catalog || []).find(p => p.id === productId && !p.deleted);
  if (!product) {
    return sendJson(res, 404, { error: 'Prenda no encontrada.' });
  }

  const prodBrandId = product.brandId || catalog.slug(product.brandName || '');
  if (prodBrandId !== brandId) {
    return sendJson(res, 403, { error: 'No tienes permiso para modificar productos de otra marca.' });
  }

  const body = await parseJsonBody(req);
  const { size, color, stock } = body;
  const newStock = Number(stock);
  if (!Number.isInteger(newStock) || newStock < 0) {
    return sendJson(res, 400, { error: 'El stock debe ser un número entero mayor o igual a cero.' });
  }

  product.variants = product.variants || [];
  let variant = product.variants.find(v => v.size === size && (!color || catalog.slug(v.color) === catalog.slug(color)));
  if (!variant && size) {
    variant = product.variants.find(v => v.size === size);
  }
  if (!variant) {
    return sendJson(res, 404, { error: `No se encontró la variante para la talla ${size}.` });
  }

  const previousStock = variant.stock || 0;
  variant.stock = newStock;
  db.saveCatalog();

  db.data.inventoryMovements = db.data.inventoryMovements || [];
  db.data.inventoryMovements.push({
    id: newId('mov'),
    productId: product.id,
    sku: variant.sku || `${product.id}-${variant.size}`,
    type: 'BRAND_STOCK_UPDATE',
    quantity: newStock - previousStock,
    previousStock,
    newStock,
    reason: 'Ajuste manual de stock por marca aliada',
    by: authUser.email,
    at: new Date().toISOString()
  });
  db.save();

  return sendJson(res, 200, { success: true, product });
}

function matchesBrand(rowBrand, authUser, brandId) {
  if (!rowBrand) return false;
  const s = catalog.slug(rowBrand);
  if (s === brandId) return true;
  if (authUser.brandName && catalog.slug(authUser.brandName) === s) return true;
  if (s.startsWith(brandId) || brandId.startsWith(s)) return true;
  return false;
}

async function importBrandCsv({ req, res, authUser, query }) {
  const brandId = resolveBrandId(authUser, query);
  let csv = '';
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) {
    const body = await parseJsonBody(req, { limit: CSV_IMPORT_MAX_BYTES });
    csv = body.csv || '';
  } else {
    // raw csv string
    csv = await new Promise((resolve, reject) => {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', chunk => {
        data += chunk;
        if (Buffer.byteLength(data, 'utf8') > CSV_IMPORT_MAX_BYTES) {
          reject(httpError(413, 'El archivo CSV supera el límite permitido de 2 MB.'));
        }
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }

  if (!csv || !csv.trim()) {
    return sendJson(res, 400, { error: 'Adjunta un archivo CSV con contenido.', imported: 0, updated: 0, errors: [] });
  }

  // SCRUM-116: Scoped import anti-tampering validation: all rows must belong to this brand
  const delimiter = catalog.detectDelimiter ? catalog.detectDelimiter(csv) : ',';
  const { records } = catalog.parseCsv(csv, delimiter);
  if (records.length < 2) {
    return sendJson(res, 400, { error: 'El archivo CSV debe tener encabezado y al menos una fila de datos.' });
  }

  const header = records[0].cells.map(c => c.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_'));
  const brandIdx = header.indexOf('marca');
  if (brandIdx === -1) {
    return sendJson(res, 400, { error: 'El archivo CSV debe incluir la columna "marca".' });
  }

  for (let i = 1; i < records.length; i++) {
    const rowBrand = records[i].cells[brandIdx] || '';
    if (rowBrand && !matchesBrand(rowBrand, authUser, brandId)) {
      return sendJson(res, 403, {
        error: `No puedes cargar productos de otra marca (se encontró "${rowBrand}" en la fila ${records[i].line}).`,
        forbiddenBrand: rowBrand
      });
    }
  }

  const { stockChanges, fatal, ...report } = catalog.importCatalogCsv(csv, db.catalog);
  if (fatal) {
    return sendJson(res, 400, { error: fatal, imported: 0, updated: 0, errors: report.errors });
  }

  if (report.imported + report.updated > 0) {
    db.saveCatalog();
    inventory.recordImport(stockChanges, { refId: newId('imp_brand') });
  }

  return sendJson(res, 200, { success: true, brandId, ...report });
}

function getBrandReports({ res, authUser, query }) {
  const brandId = resolveBrandId(authUser, query);
  const catalogMap = new Map((db.catalog || []).map(p => [p.id, p]));

  // Delivered boxes
  let deliveredItems = 0;
  let retailSalesCOP = 0;
  let wholesaleRevenueCOP = 0;

  (db.data.boxes || []).filter(b => b.status === 'DELIVERED').forEach(box => {
    (box.itemIds || []).forEach(itemId => {
      const product = catalogMap.get(itemId);
      if (product && (product.brandId || catalog.slug(product.brandName || '')) === brandId) {
        deliveredItems++;
        retailSalesCOP += product.priceCOP || 0;
        const wholesale = product.wholesalePriceCOP || Math.round((product.priceCOP || 0) * (config.WHOLESALE_RATIO_DEFAULT || 0.30));
        wholesaleRevenueCOP += wholesale;
      }
    });
  });

  // Returns for this brand
  const byReason = {};
  const bySize = {};
  let returnedItems = 0;

  (db.data.returns || []).forEach(r => {
    const product = catalogMap.get(r.productId);
    if (product && (product.brandId || catalog.slug(product.brandName || '')) === brandId) {
      returnedItems++;
      byReason[r.reason] = (byReason[r.reason] || 0) + 1;
      const size = r.size || 'M';
      bySize[size] = (bySize[size] || 0) + 1;
    }
  });

  const returnRatePct = deliveredItems > 0 ? Math.round((returnedItems / deliveredItems) * 1000) / 10 : 0;

  // Customer ratings for this brand's garments
  let fitSum = 0;
  let styleSum = 0;
  let ratingsCount = 0;

  (db.data.ratings || []).forEach(rt => {
    const product = catalogMap.get(rt.productId);
    if (product && (product.brandId || catalog.slug(product.brandName || '')) === brandId) {
      if (Number.isFinite(rt.fitScore)) {
        fitSum += rt.fitScore;
      }
      if (Number.isFinite(rt.styleScore)) {
        styleSum += rt.styleScore;
      }
      ratingsCount++;
    }
  });

  return sendJson(res, 200, {
    brandId,
    sales: {
      deliveredItems,
      retailSalesCOP,
      wholesaleRevenueCOP
    },
    returns: {
      returnedItems,
      returnRatePct,
      byReason,
      bySize
    },
    ratings: {
      averageFitScore: ratingsCount > 0 ? Math.round((fitSum / ratingsCount) * 10) / 10 : null,
      averageStyleScore: ratingsCount > 0 ? Math.round((styleSum / ratingsCount) * 10) / 10 : null,
      totalRatings: ratingsCount
    }
  });
}

function getLowStockAlerts({ res, authUser, query }) {
  const brandId = resolveBrandId(authUser, query);
  const threshold = Number.isInteger(Number(query?.threshold)) ? Number(query.threshold) : (config.BRAND?.LOW_STOCK_THRESHOLD || 3);

  const brandProducts = (db.catalog || []).filter(p => !p.deleted && (p.brandId || catalog.slug(p.brandName || '')) === brandId);
  const alerts = [];

  brandProducts.forEach(product => {
    (product.variants || []).forEach(variant => {
      if (variant.stock <= threshold) {
        alerts.push({
          productId: product.id,
          productName: product.name,
          category: product.category,
          sku: variant.sku || `${product.id}-${variant.size}`,
          size: variant.size,
          color: variant.color,
          currentStock: variant.stock,
          status: variant.stock === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
        });
      }
    });
  });

  return sendJson(res, 200, {
    brandId,
    threshold,
    lowStockCount: alerts.length,
    alerts
  });
}

module.exports = [
  { method: 'GET', path: '/api/brand/products', roles: ['BRAND', 'ADMIN'], handler: getBrandProducts },
  { method: 'PUT', path: /^\/api\/brand\/products\/([^/]+)\/stock$/, roles: ['BRAND', 'ADMIN'], handler: updateVariantStock },
  { method: 'POST', path: '/api/brand/products/import', roles: ['BRAND', 'ADMIN'], handler: importBrandCsv },
  { method: 'GET', path: '/api/brand/reports/sales-returns', roles: ['BRAND', 'ADMIN'], handler: getBrandReports },
  { method: 'GET', path: '/api/brand/alerts/low-stock', roles: ['BRAND', 'ADMIN'], handler: getLowStockAlerts }
];
