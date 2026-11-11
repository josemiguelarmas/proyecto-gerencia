// HTTP helpers shared by every route module: JSON responses, the CORS allow-list, request body
// readers with a size limit (parsed JSON, or the raw text needed for webhook signatures) and
// the optional simulated date that admin job endpoints accept. They depend only on Node's
// request and response objects, so route modules stay free of transport details.
const env = require('../config/env');

// F5: 100 KB for ordinary JSON bodies; the CSV catalog import asks for CSV_IMPORT_MAX_BYTES.
const MAX_BODY_BYTES = 100 * 1024;
const CSV_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

const CORS_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization';

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Origins allowed to call the API from a browser: CORS_ORIGINS, or localhost:PORT by default.
// The page's own origin (same host) is always allowed. There is no wildcard.
function allowedOrigins() {
  if (env.CORS_ORIGINS.length > 0) return env.CORS_ORIGINS;
  return [`http://localhost:${env.PORT}`, `http://127.0.0.1:${env.PORT}`];
}

function isAllowedOrigin(req, origin) {
  if (!origin) return false;
  if (req.headers.host && origin === `http://${req.headers.host}`) return true;
  return allowedOrigins().includes(origin);
}

// Sets the CORS headers on the response when the request's Origin is allowed. A disallowed
// origin gets no Access-Control-Allow-Origin, so the browser blocks the read.
function applyCors(req, res) {
  res.setHeader('Vary', 'Origin');
  const origin = req.headers.origin;
  if (!isAllowedOrigin(req, origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', CORS_METHODS);
  res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
  return true;
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendPreflight(res) {
  res.writeHead(204);
  res.end();
}

// HU-08: el webhook se verifica con HMAC sobre el cuerpo exacto, sin reinterpretarlo.
// A body above `limit` is drained and rejected with 413 (the socket is cut only if the
// client keeps sending far beyond the limit).
function readRawBody(req, { limit = MAX_BODY_BYTES } = {}) {
  const tooLarge = () => httpError(413, `El contenido enviado es demasiado grande (máximo ${Math.round(limit / 1024)} KB).`);
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    let received = 0;
    let overflow = Number.isFinite(declared) && declared > limit;
    const chunks = [];
    req.on('data', chunk => {
      received += chunk.length;
      if (received > limit) overflow = true;
      if (overflow) {
        chunks.length = 0;
        if (received > limit * 4) req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => (overflow ? reject(tooLarge()) : resolve(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', reject);
  });
}

function parseJsonBody(req, options) {
  return readRawBody(req, options).then(body => {
    if (!body) return {};
    try {
      return JSON.parse(body);
    } catch (err) {
      throw new Error('Invalid JSON format');
    }
  });
}

// Fecha opcional para simular el paso del tiempo en los jobs del administrador.
function parseNow(value) {
  if (!value) return new Date();
  const d = new Date(value);
  if (isNaN(d)) throw httpError(400, 'La fecha de simulación no es válida (usa AAAA-MM-DD).');
  return d;
}

module.exports = {
  MAX_BODY_BYTES,
  CSV_IMPORT_MAX_BYTES,
  httpError,
  applyCors,
  isAllowedOrigin,
  sendJson,
  sendPreflight,
  readRawBody,
  parseJsonBody,
  parseNow
};
