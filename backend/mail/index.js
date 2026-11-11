// Adaptador de correo. MAIL_PROVIDER=simulated (único disponible) guarda cada
// mensaje en DATA_DIR/outbox.json (TCB_OUTBOX_FILE) en lugar de enviarlo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUTBOX_FILE = require('../config/env').OUTBOX_FILE;

function readOutbox() {
  if (!fs.existsSync(OUTBOX_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

const simulatedProvider = {
  name: 'simulated',
  send({ to, subject, body, type }) {
    const outbox = readOutbox();
    const message = {
      id: `mail_${crypto.randomBytes(6).toString('hex')}`,
      to,
      subject: `[SIMULADO] ${subject}`,
      body,
      type,
      provider: 'simulated',
      createdAt: new Date().toISOString()
    };
    outbox.push(message);
    fs.mkdirSync(path.dirname(OUTBOX_FILE), { recursive: true });
    fs.writeFileSync(OUTBOX_FILE, JSON.stringify(outbox, null, 2), 'utf8');
    return message;
  },
  list() {
    return readOutbox().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
};

const PROVIDERS = { simulated: simulatedProvider };
const providerName = process.env.MAIL_PROVIDER || 'simulated';
if (!PROVIDERS[providerName]) {
  throw new Error(`MAIL_PROVIDER desconocido: ${providerName}. Disponibles: ${Object.keys(PROVIDERS).join(', ')}`);
}

module.exports = PROVIDERS[providerName];
