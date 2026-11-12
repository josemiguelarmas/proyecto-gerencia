// Model version management (HU-06/HU-11, SCRUM-78).
// Tracks active and historical recommendation rule versions with cryptographic ruleset hashes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db } = require('./database');

const STYLE_RULES_PATH = path.join(__dirname, 'data', 'seed', 'style-rules.json');
const OUTFIT_RULES_PATH = path.join(__dirname, 'data', 'seed', 'outfit-rules.json');

function computeRulesetHash() {
  const h = crypto.createHash('sha256');
  if (fs.existsSync(STYLE_RULES_PATH)) {
    h.update(fs.readFileSync(STYLE_RULES_PATH, 'utf8'));
  }
  if (fs.existsSync(OUTFIT_RULES_PATH)) {
    h.update(fs.readFileSync(OUTFIT_RULES_PATH, 'utf8'));
  }
  return h.digest('hex').slice(0, 16);
}

function ensureVersions() {
  if (!db.data.modelVersions) {
    db.data.modelVersions = [];
  }
  if (db.data.modelVersions.length === 0) {
    const defaultHash = computeRulesetHash();
    db.data.modelVersions.push({
      id: 'reglas-v2',
      name: 'Reglas Base V2 (Estilo y Outfits)',
      rulesetHash: defaultHash,
      active: true,
      createdAt: '2026-11-10T00:00:00.000Z',
      description: 'Reglas iniciales de estilo y composición de outfits (pendiente de validación del estilista)'
    });
    db.save();
  }
  return db.data.modelVersions;
}

function getActiveVersion() {
  const versions = ensureVersions();
  const active = versions.find(v => v.active);
  return active || versions[0];
}

function listVersions() {
  return ensureVersions();
}

function setActiveVersion(id) {
  const versions = ensureVersions();
  const target = versions.find(v => v.id === id);
  if (!target) {
    throw new Error(`Versión de modelo no encontrada: ${id}`);
  }
  versions.forEach(v => { v.active = (v.id === id); });
  db.save();
  return target;
}

function registerVersion({ id, name, description, rulesetHash }) {
  const versions = ensureVersions();
  if (versions.some(v => v.id === id)) {
    throw new Error(`La versión ${id} ya existe`);
  }
  const entry = {
    id,
    name: name || id,
    rulesetHash: rulesetHash || computeRulesetHash(),
    active: false,
    createdAt: new Date().toISOString(),
    description: description || 'Versión registrada del motor'
  };
  versions.push(entry);
  db.save();
  return entry;
}

module.exports = {
  computeRulesetHash,
  getActiveVersion,
  listVersions,
  setActiveVersion,
  registerVersion
};
