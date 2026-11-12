// Products repository over the catalog file (HU-05): lookup, list, create, update, soft
// delete and restore of products, plus the brand list derived from them. Input is validated
// and whitelisted by catalog.validateProductInput; stock changes go through repos/inventory.js
// so each one leaves an inventory movement. Results are { product } on success, { errors }
// (field-level, for a 400), { notFound: true } or { conflict: '<mensaje>' } (for a 409).
// Bulk CSV import lives in backend/catalog.js and writes through store.saveCatalog().
const store = require('./store');
const inventory = require('./inventory');
const { normalizeProduct, listBrands: brandsOf, validateProductInput, nextProductId, skuFor, slug } = require('../catalog');

function getProductById(id) {
  return store.catalog.find(p => p.id === id) || null;
}

function listProducts({ includeDeleted = false } = {}) {
  return includeDeleted ? store.catalog : store.catalog.filter(p => !p.deletedAt);
}

function listBrands() {
  return brandsOf(store.catalog);
}

// Applies validated variants: new ones start at 0 and get their stock as a RESTOCK movement,
// known skus get prices and, when it changed, an ADJUST movement.
function applyVariants(product, variants, by) {
  variants.filter(v => !v.isNew).forEach(v => {
    const own = product.variants.find(x => x.sku === v.sku);
    if (v.wholesalePrice !== undefined) own.wholesalePrice = v.wholesalePrice;
    if (v.retailPrice !== undefined) own.retailPrice = v.retailPrice;
    if (own.stock !== v.stock) inventory.setStock({ sku: v.sku, stock: v.stock, reason: `Ajuste manual desde el panel (${by})`, refId: product.id });
  });
  const added = variants.filter(v => v.isNew).map(v => ({
    sku: v.sku || skuFor(product.id, v.size, v.color),
    size: v.size,
    color: v.color,
    stock: 0,
    reserved: 0,
    wholesalePrice: v.wholesalePrice,
    retailPrice: v.retailPrice,
    initialStock: v.stock
  }));
  added.forEach(({ initialStock, ...variant }) => product.variants.push(variant));
  normalizeProduct(product);
  store.saveCatalog();
  added.filter(v => v.initialStock > 0).forEach(v => {
    inventory.restock({ sku: v.sku, qty: v.initialStock, reason: `Alta de variante desde el panel (${by})`, refId: product.id });
  });
}

function createProduct(input, { by = 'admin', now = new Date() } = {}) {
  const { errors, fields, variants } = validateProductInput(input, store.catalog);
  if (errors.length) return { errors };
  const id = nextProductId(store.catalog);
  const product = {
    id,
    brandId: slug(fields.brandName),
    brandCity: null,
    type: fields.category,
    colorName: variants[0].color,
    fabric: '',
    story: '',
    care: '',
    ...fields,
    variants: [],
    createdAt: now.toISOString(),
    createdBy: by
  };
  product.color = product.colorName;
  store.catalog.push(product);
  applyVariants(product, variants, by);
  return { product };
}

function updateProduct(id, input, { by = 'admin', now = new Date() } = {}) {
  const product = getProductById(id);
  if (!product) return { notFound: true };
  if (product.deletedAt) return { conflict: 'La prenda está eliminada: restáurala antes de editarla.' };
  const { errors, fields, variants } = validateProductInput(input, store.catalog, product);
  if (errors.length) return { errors };
  Object.assign(product, fields, { updatedAt: now.toISOString(), updatedBy: by });
  if (fields.brandName) product.brandId = slug(fields.brandName);
  if (fields.wholesalePriceCOP) delete product.wholesaleEstimated;
  applyVariants(product, variants, by);
  return { product };
}

// Soft delete: the product stays in the file (boxes and history still reference it) but has no
// available units, so the engine, the stylist and the public catalog no longer offer it.
function softDeleteProduct(id, { by = 'admin', now = new Date() } = {}) {
  const product = getProductById(id);
  if (!product) return { notFound: true };
  const reserved = product.variants.reduce((sum, v) => sum + v.reserved, 0);
  if (reserved > 0) return { conflict: `La prenda tiene ${reserved} unidades reservadas para cajas aprobadas; no se puede eliminar todavía.` };
  if (!product.deletedAt) {
    Object.assign(product, { deletedAt: now.toISOString(), deletedBy: by });
    store.saveCatalog();
  }
  return { product };
}

function restoreProduct(id, { by = 'admin', now = new Date() } = {}) {
  const product = getProductById(id);
  if (!product) return { notFound: true };
  if (product.deletedAt) {
    delete product.deletedAt;
    delete product.deletedBy;
    Object.assign(product, { updatedAt: now.toISOString(), updatedBy: by });
    store.saveCatalog();
  }
  return { product };
}

module.exports = { getProductById, listProducts, listBrands, createProduct, updateProduct, softDeleteProduct, restoreProduct };
