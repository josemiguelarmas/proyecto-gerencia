// HU-05: modelo de variantes del catálogo e importación CSV.
const config = require('./config');

// Tallas que ofrece una prenda: las de su tabla de medidas, o todas si no tiene.
function productSizes(product) {
  const table = product.measurements && Object.values(product.measurements)[0];
  return table ? Object.keys(table) : config.SIZES.slice();
}

// Completa variants y wholesalePriceCOP en prendas creadas antes del modelo de variantes.
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
  return changed;
}

function stockInSize(product, size) {
  return (product.variants || [])
    .filter(v => v.size === size)
    .reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
}

// Parser CSV mínimo: separador coma, comillas dobles opcionales con "" como escape.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

function normalizeHeader(h) {
  return h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
}

function slug(text) {
  return normalizeHeader(text).replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
}

const REQUIRED_COLUMNS = ['marca', 'nombre', 'categoria', 'estilo', 'ocasion', 'talla', 'color', 'precio_mayorista', 'stock'];
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80';

function splitList(value) {
  return value.split(/[|;]/).map(v => normalizeHeader(v)).filter(Boolean);
}

// Valida fila por fila. Las válidas se aplican al catálogo; las inválidas se reportan con su motivo.
function importCatalogCsv(csvText, catalog) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { fatal: 'El archivo está vacío.' };
  }
  const headers = rows[0].map(normalizeHeader);
  const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
  if (missing.length) {
    return { fatal: `Faltan columnas obligatorias: ${missing.join(', ')}.` };
  }

  const errors = [];
  const seen = new Set();
  let imported = 0;
  const created = [];
  const updated = new Set();

  rows.slice(1).forEach((cells, idx) => {
    const rowNumber = idx + 2; // fila 1 es el encabezado
    const r = Object.fromEntries(headers.map((h, i) => [h, (cells[i] || '').trim()]));
    const fail = reason => errors.push({ row: rowNumber, reason });

    const empty = REQUIRED_COLUMNS.filter(c => !r[c]);
    if (empty.length) return fail(`Campos vacíos: ${empty.join(', ')}.`);
    const category = normalizeHeader(r.categoria);
    if (!config.CATEGORIES.includes(category)) return fail(`Categoría "${r.categoria}" no válida. Usa: ${config.CATEGORIES.join(', ')}.`);
    const size = r.talla.toUpperCase();
    if (!config.SIZES.includes(size)) return fail(`Talla "${r.talla}" no válida. Usa: ${config.SIZES.join(', ')}.`);
    const styles = splitList(r.estilo);
    const badStyles = styles.filter(s => !config.STYLES.includes(s));
    if (!styles.length || badStyles.length) return fail(`Estilo "${r.estilo}" no válido. Usa: ${config.STYLES.join(', ')} (separados por |).`);
    const occasions = splitList(r.ocasion);
    const badOcc = occasions.filter(o => !config.OCCASIONS.includes(o));
    if (!occasions.length || badOcc.length) return fail(`Ocasión "${r.ocasion}" no válida. Usa: ${config.OCCASIONS.join(', ')} (separadas por |).`);
    const wholesale = Number(r.precio_mayorista.replace(/[.\s$]/g, ''));
    if (!Number.isInteger(wholesale) || wholesale <= 0) return fail(`Precio mayorista "${r.precio_mayorista}" debe ser un entero positivo en COP.`);
    const stock = Number(r.stock);
    if (!Number.isInteger(stock) || stock < 0) return fail(`Stock "${r.stock}" debe ser un entero mayor o igual a 0.`);
    const salePrice = r.precio_venta ? Number(r.precio_venta.replace(/[.\s$]/g, '')) : null;
    if (r.precio_venta && (!Number.isInteger(salePrice) || salePrice <= 0)) return fail(`Precio de venta "${r.precio_venta}" no válido.`);

    const key = `${slug(r.marca)}|${slug(r.nombre)}|${size}|${slug(r.color)}`;
    if (seen.has(key)) return fail('Fila duplicada: la misma prenda, talla y color ya aparece antes en el archivo.');
    seen.add(key);

    let product = catalog.find(p => slug(p.brandName) === slug(r.marca) && slug(p.name) === slug(r.nombre));
    if (!product) {
      const nextNum = catalog.reduce((max, p) => Math.max(max, Number((p.id.match(/(\d+)$/) || [0, 0])[1])), 0) + 1;
      product = {
        id: `prod-${String(nextNum).padStart(2, '0')}`,
        name: r.nombre,
        brandId: slug(r.marca),
        brandName: r.marca,
        brandCity: r.ciudad || 'Colombia',
        category,
        type: r.tipo || category,
        color: r.color,
        colorName: r.color,
        fabric: r.tejido || 'Por confirmar',
        fit: ['ajustado', 'regular', 'holgado'].includes(normalizeHeader(r.corte || '')) ? normalizeHeader(r.corte) : 'regular',
        line: ['u', 'm', 'f'].includes((r.linea || '').toLowerCase()) ? r.linea.toLowerCase() : 'u',
        styles,
        occasions,
        priceCOP: salePrice || Math.round(wholesale / config.WHOLESALE_RATIO_DEFAULT),
        wholesalePriceCOP: wholesale,
        story: '',
        care: '',
        imageUrl: /^https?:\/\//.test(r.imagen_url || '') ? r.imagen_url : DEFAULT_IMAGE,
        variants: [],
        importedAt: new Date().toISOString()
      };
      catalog.push(product);
      created.push(product.id);
    } else {
      product.wholesalePriceCOP = wholesale;
      delete product.wholesaleEstimated;
      if (!created.includes(product.id)) updated.add(product.id);
    }

    const variant = product.variants.find(v => v.size === size && slug(v.color) === slug(r.color));
    if (variant) variant.stock = stock;
    else product.variants.push({ size, color: r.color, stock });
    imported++;
  });

  return {
    imported,
    rejected: errors.length,
    createdProducts: created,
    updatedProducts: [...updated],
    errors
  };
}

module.exports = { normalizeProduct, stockInSize, productSizes, parseCsv, importCatalogCsv };
