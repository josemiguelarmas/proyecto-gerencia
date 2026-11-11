// Products repository over the catalog file: lookup by id and create-or-update of a product,
// which normalizes its variants and stock before saving the catalog. Bulk CSV import lives in
// backend/catalog.js and writes through store.saveCatalog().
const store = require('./store');
const { normalizeProduct, listBrands: brandsOf } = require('../catalog');

function getProductById(id) {
  return store.catalog.find(p => p.id === id) || null;
}

function saveProduct(productData) {
  let p = getProductById(productData.id);
  if (p) {
    Object.assign(p, productData);
  } else {
    const newId = productData.id || `prod_${String(store.catalog.length + 1).padStart(2, '0')}`;
    p = { ...productData, id: newId };
    store.catalog.push(p);
  }
  normalizeProduct(p);
  store.saveCatalog();
  return p;
}

function listBrands() {
  return brandsOf(store.catalog);
}

module.exports = { getProductById, saveProduct, listBrands };
