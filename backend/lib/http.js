// HTTP helpers shared by every route module: JSON responses with the CORS headers the SPA
// expects, request body readers (parsed JSON or the raw text needed for webhook signatures)
// and the optional simulated date that admin job endpoints accept. They depend only on
// Node's request and response objects, so route modules stay free of transport details.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const MAX_BODY_LENGTH = 1e6;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS_HEADERS
  });
  res.end(JSON.stringify(data));
}

function sendPreflight(res) {
  res.writeHead(204, CORS_HEADERS);
  res.end();
}

// HU-08: el webhook se verifica con HMAC sobre el cuerpo exacto, sin reinterpretarlo.
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY_LENGTH) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function parseJsonBody(req) {
  return readRawBody(req).then(body => {
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
  if (isNaN(d)) {
    const err = new Error('La fecha de simulación no es válida (usa AAAA-MM-DD).');
    err.status = 400;
    throw err;
  }
  return d;
}

module.exports = { sendJson, sendPreflight, readRawBody, parseJsonBody, parseNow };
