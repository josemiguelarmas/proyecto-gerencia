// HU-05: migra la semilla backend/data/seed/catalog.json al modelo de variantes (talla, color, stock).
// Uso: node scripts/migrate-catalog-variants.js
const fs = require('fs');
const path = require('path');
const { normalizeProduct } = require('../backend/catalog');

const file = path.join(__dirname, '..', 'backend', 'data', 'seed', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
const changed = catalog.filter(normalizeProduct).length;
fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log(`Catálogo migrado: ${changed} de ${catalog.length} prendas actualizadas.`);
