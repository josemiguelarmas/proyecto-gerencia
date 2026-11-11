// HU-05 catalog model and CSV import. Pure functions over product objects (no persistence:
// repos/products.js and repos/inventory.js save). Model: a Brand (brandId, brandName,
// brandCity) owns Products; a Product owns Variants { sku, size, color, stock, reserved,
// wholesalePrice, retailPrice }. stock and reserved are non-negative integers with
// reserved <= stock, and available = stock - reserved is what the engine, the stylist and
// exchanges may use. A soft-deleted product (deletedAt set) has no available units.
const config = require('./config');

// Tallas que ofrece una prenda: las de su tabla de medidas, o todas si no tiene.
function productSizes(product) {
  const table = product.measurements && Object.values(product.measurements)[0];
  return table ? Object.keys(table) : config.SIZES.slice();
}

// SKU generated when a brand does not send one: product id + size + color, e.g. PROD-01-M-NEGRO.
function skuFor(productId, size, color) {
  return `${productId}-${size}-${slug(color)}`.toUpperCase();
}

// Completa los campos del modelo en prendas guardadas antes de él (variants, sku, reserved, precios).
function normalizeProduct(product) {
  let changed = false;
  if (!Array.isArray(product.variants)) {
    product.variants = productSizes(product).map(size => ({
      size,
      color: product.colorName || product.color || 'Único',
      stock: config.INITIAL_VARIANT_STOCK
    }));
    changed = true;
  }
  if (!Number.isFinite(product.wholesalePriceCOP)) {
    product.wholesalePriceCOP = Math.round(product.priceCOP * config.WHOLESALE_RATIO_DEFAULT);
    product.wholesaleEstimated = true;
    changed = true;
  }
  if (!product.brandId && product.brandName) {
    product.brandId = slug(product.brandName);
    changed = true;
  }
  product.variants.forEach(v => {
    if (!v.sku) { v.sku = skuFor(product.id, v.size, v.color); changed = true; }
    if (!Number.isInteger(v.reserved)) { v.reserved = 0; changed = true; }
    if (!Number.isInteger(v.wholesalePrice)) { v.wholesalePrice = product.wholesalePriceCOP; changed = true; }
    if (!Number.isInteger(v.retailPrice)) { v.retailPrice = product.priceCOP; changed = true; }
  });
  return changed;
}

function isActive(product) {
  return !product.deletedAt;
}

function availableUnits(variant) {
  return Math.max(0, (Number(variant.stock) || 0) - (Number(variant.reserved) || 0));
}

// Unidades disponibles (stock - reservado) en una talla. Una prenda eliminada no tiene disponibles.
function stockInSize(product, size) {
  if (!isActive(product)) return 0;
  return (product.variants || [])
    .filter(v => v.size === size)
    .reduce((sum, v) => sum + availableUnits(v), 0);
}

// Brands are derived from the products that reference them (one brandId per allied brand).
function listBrands(catalog) {
  const brands = new Map();
  catalog.forEach(p => {
    const id = p.brandId || slug(p.brandName || '');
    if (!id) return;
    const brand = brands.get(id) || { id, name: p.brandName, city: p.brandCity || null, products: 0, activeProducts: 0 };
    brand.products++;
    if (isActive(p)) brand.activeProducts++;
    brands.set(id, brand);
  });
  return [...brands.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// ---------------------------------------------------------------
// CSV import (SCRUM-39): one row per variant, upsert by sku
// ---------------------------------------------------------------

// Parser CSV: comillas dobles con "" como escape y saltos de línea dentro de comillas. Devuelve
// los registros con la línea del archivo donde empieza cada uno, y la línea de una comilla sin cerrar.
function parseCsv(text, delimiter = ',') {
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let quoteLine = null;
  const src = String(text).replace(/^﻿/, '');
  const endRecord = () => {
    row.push(field);
    if (row.some(c => c.trim() !== '')) records.push({ line: recordLine, cells: row });
    row = []; field = '';
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === '"') { inQuotes = true; quoteLine = line; }
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRecord();
      line++;
      recordLine = line;
    } else field += ch;
  }
  if (inQuotes) return { records, unclosedQuoteLine: quoteLine };
  if (field !== '' || row.length) endRecord();
  return { records, unclosedQuoteLine: null };
}

// Excel en español guarda CSV con punto y coma: se usa ';' si el encabezado no tiene comas.
function detectDelimiter(text) {
  const header = String(text).split(/\r?\n/, 1)[0];
  return header.includes(';') && !header.includes(',') ? ';' : ',';
}

function normalizeHeader(h) {
  return h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
}

function slug(text) {
  return normalizeHeader(text).replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
}

const REQUIRED_COLUMNS = ['marca', 'nombre', 'categoria', 'estilo', 'ocasion', 'talla', 'color', 'precio_mayorista', 'stock'];
const OPTIONAL_COLUMNS = ['sku', 'precio_venta', 'ciudad', 'tipo', 'corte', 'tejido', 'linea', 'imagen_url'];
const FITS = ['ajustado', 'regular', 'holgado'];
const LINES = ['u', 'm', 'f'];
const SKU_RE = /^[A-Z0-9][A-Z0-9-]{1,39}$/;
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80';

function splitList(value) {
  return value.split(/[|;]/).map(v => normalizeHeader(v)).filter(Boolean);
}

// Precios en COP: se aceptan "35000", "35.000" y "$35.000".
function parsePrice(text) {
  return Number(text.replace(/[.\s$]/g, ''));
}

// Valida una fila y devuelve sus valores ya normalizados, o la lista de errores por campo.
function validateRow(r) {
  const errors = [];
  const fail = (field, message) => errors.push({ field, message });
  REQUIRED_COLUMNS.filter(c => !r[c]).forEach(c => fail(c, 'Campo obligatorio vacío.'));

  const value = {
    sku: r.sku ? r.sku.toUpperCase() : null,
    brandName: r.marca,
    name: r.nombre,
    category: normalizeHeader(r.categoria || ''),
    size: (r.talla || '').toUpperCase(),
    color: r.color,
    styles: splitList(r.estilo || ''),
    occasions: splitList(r.ocasion || ''),
    wholesale: parsePrice(r.precio_mayorista || ''),
    stock: Number(r.stock),
    retail: r.precio_venta ? parsePrice(r.precio_venta) : null,
    fit: r.corte ? normalizeHeader(r.corte) : 'regular',
    line: r.linea ? r.linea.toLowerCase() : 'u'
  };

  if (value.sku && !SKU_RE.test(value.sku)) fail('sku', `SKU "${r.sku}" no válido: usa de 2 a 40 letras, números o guiones.`);
  if (r.categoria && !config.CATEGORIES.includes(value.category)) fail('categoria', `Categoría "${r.categoria}" no válida. Usa: ${config.CATEGORIES.join(', ')}.`);
  if (r.talla && !config.SIZES.includes(value.size)) fail('talla', `Talla "${r.talla}" no válida. Usa: ${config.SIZES.join(', ')}.`);
  if (r.estilo && value.styles.some(s => !config.STYLES.includes(s))) fail('estilo', `Estilo "${r.estilo}" no válido. Usa: ${config.STYLES.join(', ')} (separados por |).`);
  if (r.ocasion && value.occasions.some(o => !config.OCCASIONS.includes(o))) fail('ocasion', `Ocasión "${r.ocasion}" no válida. Usa: ${config.OCCASIONS.join(', ')} (separadas por |).`);
  if (r.precio_mayorista && (!Number.isInteger(value.wholesale) || value.wholesale <= 0)) fail('precio_mayorista', `Precio mayorista "${r.precio_mayorista}" debe ser un entero positivo en COP.`);
  if (r.stock && (!/^\d+$/.test(r.stock) || !Number.isInteger(value.stock))) fail('stock', `Stock "${r.stock}" debe ser un entero mayor o igual a 0.`);
  if (r.precio_venta && (!Number.isInteger(value.retail) || value.retail <= 0)) fail('precio_venta', `Precio de venta "${r.precio_venta}" debe ser un entero positivo en COP.`);
  if (!FITS.includes(value.fit)) fail('corte', `Corte "${r.corte}" no válido. Usa: ${FITS.join(', ')}.`);
  if (!LINES.includes(value.line)) fail('linea', `Línea "${r.linea}" no válida. Usa: u (unisex), m o f.`);
  if (r.imagen_url && !/^https?:\/\//.test(r.imagen_url)) fail('imagen_url', 'La imagen debe ser una URL que empiece por http:// o https://.');
  return { errors, value };
}

function nextProductId(catalog) {
  const max = catalog.reduce((m, p) => Math.max(m, Number((String(p.id).match(/(\d+)$/) || [0, 0])[1])), 0);
  return `prod-${String(max + 1).padStart(2, '0')}`;
}

function newProductFromRow(v, r, catalog) {
  return {
    id: nextProductId(catalog),
    name: v.name,
    brandId: slug(v.brandName),
    brandName: v.brandName,
    brandCity: r.ciudad || 'Colombia',
    category: v.category,
    type: r.tipo || v.category,
    color: v.color,
    colorName: v.color,
    fabric: r.tejido || 'Por confirmar',
    fit: v.fit,
    line: v.line,
    styles: v.styles,
    occasions: v.occasions,
    priceCOP: v.retail || Math.round(v.wholesale / config.WHOLESALE_RATIO_DEFAULT),
    ...(v.retail ? {} : { priceEstimated: true }),
    wholesalePriceCOP: v.wholesale,
    story: '',
    care: '',
    imageUrl: r.imagen_url || DEFAULT_IMAGE,
    variants: [],
    importedAt: new Date().toISOString()
  };
}

function findBySku(catalog, sku) {
  for (const product of catalog) {
    const variant = (product.variants || []).find(x => x.sku === sku);
    if (variant) return { product, variant };
  }
  return null;
}

// Aplica una fila válida: actualiza la variante con ese sku (o con esa prenda, talla y color) o la crea.
// Devuelve { error } si la fila choca con el catálogo, o { created, stockChange }.
function upsertRow(v, r, catalog) {
  const sameProduct = p => slug(p.brandName) === slug(v.brandName) && slug(p.name) === slug(v.name);
  let product;
  let variant;
  const bySku = v.sku && findBySku(catalog, v.sku);
  if (bySku) {
    ({ product, variant } = bySku);
    if (!sameProduct(product)) return { error: { field: 'sku', message: `El SKU ${v.sku} ya pertenece a "${product.name}" de ${product.brandName}.` } };
    if (variant.size !== v.size || slug(variant.color) !== slug(v.color)) {
      return { error: { field: 'sku', message: `El SKU ${v.sku} corresponde a talla ${variant.size}, color ${variant.color}.` } };
    }
  } else {
    product = catalog.find(sameProduct);
    variant = product && product.variants.find(x => x.size === v.size && slug(x.color) === slug(v.color));
    if (variant && v.sku) return { error: { field: 'sku', message: `Esta prenda ya tiene la talla ${v.size} color ${v.color} con el SKU ${variant.sku}.` } };
  }
  if (product && product.deletedAt) return { error: { field: 'nombre', message: `La prenda "${product.name}" fue eliminada del catálogo; restáurala antes de importarla.` } };
  if (variant && v.stock < variant.reserved) return { error: { field: 'stock', message: `El stock no puede ser menor que las ${variant.reserved} unidades reservadas para cajas aprobadas.` } };
  const newSku = !variant && (v.sku || skuFor(product ? product.id : nextProductId(catalog), v.size, v.color));
  if (newSku && findBySku(catalog, newSku)) return { error: { field: 'sku', message: `El SKU ${newSku} ya existe en el catálogo.` } };

  let createdProduct = false;
  if (!product) {
    product = newProductFromRow(v, r, catalog);
    catalog.push(product);
    createdProduct = true;
  }
  product.wholesalePriceCOP = v.wholesale;
  delete product.wholesaleEstimated;
  const retailPrice = v.retail || (variant && variant.retailPrice) || product.priceCOP;
  if (variant) {
    const before = variant.stock;
    Object.assign(variant, { stock: v.stock, wholesalePrice: v.wholesale, retailPrice });
    return { product, createdProduct, created: false, stockChange: before === v.stock ? null : { product, variant, before } };
  }
  variant = { sku: newSku, size: v.size, color: v.color, stock: v.stock, reserved: 0, wholesalePrice: v.wholesale, retailPrice };
  product.variants.push(variant);
  return { product, createdProduct, created: true, stockChange: { product, variant, before: 0 } };
}

// Valida fila por fila. Las válidas se aplican al catálogo aunque otras fallen; las inválidas se
// reportan como { row, field, message } (field es null cuando el error es de la fila completa).
// Un archivo que no se puede leer devuelve { fatal, errors } y no cambia nada.
function importCatalogCsv(csvText, catalog) {
  const { records, unclosedQuoteLine } = parseCsv(csvText, detectDelimiter(csvText));
  if (unclosedQuoteLine) {
    const message = `Hay comillas sin cerrar desde la línea ${unclosedQuoteLine}: revisa el archivo.`;
    return { fatal: message, errors: [{ row: unclosedQuoteLine, field: null, message }] };
  }
  if (records.length === 0) return { fatal: 'El archivo está vacío.', errors: [] };
  const headers = records[0].cells.map(normalizeHeader);
  const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
  if (missing.length) {
    return { fatal: `Faltan columnas obligatorias: ${missing.join(', ')}.`, errors: missing.map(c => ({ row: records[0].line, field: c, message: 'Columna obligatoria ausente en el encabezado.' })) };
  }
  const unknown = headers.filter(h => h && !REQUIRED_COLUMNS.includes(h) && !OPTIONAL_COLUMNS.includes(h));

  const errors = [];
  const seen = new Set();
  const created = new Set();
  const updated = new Set();
  const stockChanges = [];
  let imported = 0;
  let updatedRows = 0;

  records.slice(1).forEach(({ line, cells }) => {
    if (cells.length > headers.length && cells.slice(headers.length).some(c => c.trim())) {
      errors.push({ row: line, field: null, message: `La fila tiene ${cells.length} columnas y el encabezado ${headers.length}: revisa comas o comillas.` });
      return;
    }
    const r = Object.fromEntries(headers.map((h, i) => [h, (cells[i] || '').trim()]));
    const { errors: rowErrors, value } = validateRow(r);
    if (rowErrors.length) {
      rowErrors.forEach(e => errors.push({ row: line, ...e }));
      return;
    }
    const key = value.sku || `${slug(value.brandName)}|${slug(value.name)}|${value.size}|${slug(value.color)}`;
    if (seen.has(key)) {
      errors.push({ row: line, field: value.sku ? 'sku' : null, message: 'Fila duplicada: la misma variante ya aparece antes en el archivo.' });
      return;
    }
    seen.add(key);

    const result = upsertRow(value, r, catalog);
    if (result.error) {
      errors.push({ row: line, ...result.error });
      return;
    }
    if (result.createdProduct) created.add(result.product.id);
    else if (!created.has(result.product.id)) updated.add(result.product.id);
    if (result.stockChange) stockChanges.push(result.stockChange);
    normalizeProduct(result.product);
    if (result.created) imported++;
    else updatedRows++;
  });

  return {
    imported,
    updated: updatedRows,
    rejected: errors.length ? new Set(errors.map(e => e.row)).size : 0,
    errors,
    createdProducts: [...created],
    updatedProducts: [...updated],
    ignoredColumns: unknown,
    stockChanges
  };
}

module.exports = { normalizeProduct, stockInSize, availableUnits, isActive, skuFor, listBrands, productSizes, parseCsv, importCatalogCsv };
