// Size equivalences and brand run adjustments (HU-04, SCRUM-35).
// Moves hardcoded BRAND_RUNS out of engine.js into seed and admin-editable config.
const fs = require('fs');
const path = require('path');
const env = require('./config/env');

const SEED_FILE = path.join(env.SEED_DIR, 'size-equivalences.json');
const RUNTIME_FILE = path.join(env.DATA_DIR, 'size-equivalences.json');

const DEFAULT_RUN = { runs: 0, runsText: 'talla estándar' };

function loadFile() {
  if (fs.existsSync(RUNTIME_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(RUNTIME_FILE, 'utf8'));
    } catch {
      // fallback to seed
    }
  }
  if (fs.existsSync(SEED_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    } catch {
      // fallback
    }
  }
  return {};
}

let cached = null;

function getSizeEquivalences() {
  if (!cached) cached = loadFile();
  return cached;
}

function saveSizeEquivalences(data) {
  if (!data || typeof data !== 'object') throw new Error('Datos de equivalencias no válidos.');
  fs.mkdirSync(path.dirname(RUNTIME_FILE), { recursive: true });
  fs.writeFileSync(RUNTIME_FILE, JSON.stringify(data, null, 2), 'utf8');
  cached = data;
  return cached;
}

function getBrandRun(brandId) {
  if (!brandId) return DEFAULT_RUN;
  const key = String(brandId).trim().toLowerCase();
  const eq = getSizeEquivalences();
  return eq[key] || DEFAULT_RUN;
}

module.exports = { getSizeEquivalences, saveSizeEquivalences, getBrandRun, DEFAULT_RUN };
