// Rating and feedback routes: per-garment feedback with separate fit and style scores
// (HU-10), the batch rating that closes a delivered box, and the admin endpoints that list
// all ratings, send the rating reminder on demand and retrain the engine with pending
// feedback (HU-11). Positive style signals are folded back into the subscriber profile.
const { db } = require('../database');
const { runReviewReminders } = require('../jobs/reviewReminder');
const learning = require('../learning');
const { sendJson, parseJsonBody } = require('../lib/http');

// Un puntaje de 1 a 5, o undefined si no se envió. Lanza error si viene fuera de rango.
function parseScore(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    const err = new Error(`La calificación de ${label} debe ser un número entero de 1 a 5.`);
    err.status = 400;
    throw err;
  }
  return n;
}

// Individual Item Feedback POST (Requisito 4: Descubrimiento y valoración de prendas individuales)
async function itemFeedback({ req, res, authUser, match }) {
  const boxId = match[1];
  const box = db.getBoxById(boxId);
  if (!box || box.userId !== authUser.id) {
    return sendJson(res, 404, { error: 'Caja no encontrada.' });
  }
  if (box.status !== 'DELIVERED' && box.status !== 'RATED') {
    return sendJson(res, 403, { error: 'Solo puedes valorar prendas de una caja que ya ha sido entregada.' });
  }

  const body = await parseJsonBody(req);
  const { productId, liked, styleFeedback, preferenceNotes } = body;
  if (!productId || !box.itemIds.includes(productId)) {
    return sendJson(res, 400, { error: 'La prenda indicada no pertenece a esta caja.' });
  }

  // HU-10: ajuste y estilo se califican por separado (1 a 5). Se acepta calificar solo uno.
  // score sigue siendo el puntaje general que promedia el panel; si no llega, sale de los parciales.
  const fitScore = parseScore(body.fitScore, 'ajuste');
  const styleScore = parseScore(body.styleScore, 'estilo');
  const partials = [fitScore, styleScore].filter(v => v !== undefined);
  const score = parseScore(body.score, 'la prenda')
    ?? (partials.length ? Math.round(partials.reduce((a, b) => a + b, 0) / partials.length) : undefined);
  if (score === undefined) {
    return sendJson(res, 400, { error: 'Califica al menos el ajuste o el estilo de la prenda (1 a 5).' });
  }

  const savedRating = db.addRating(authUser.id, boxId, productId, {
    score,
    fitScore,
    styleScore,
    liked: liked !== false,
    styleFeedback: styleFeedback || '',
    feedback: preferenceNotes || styleFeedback || '',
    preferenceNotes: preferenceNotes || ''
  });

  // Recalibración inteligente del perfil
  const profile = db.getProfile(authUser.id);
  const prod = db.getProductById(productId);
  const styleSignal = styleScore ?? score;
  if (profile && prod) {
    if (styleSignal >= 4 && prod.styles && prod.styles[0]) {
      const mainStyle = prod.styles[0];
      if (!profile.styles.includes(mainStyle)) {
        profile.styles = [mainStyle, ...profile.styles].slice(0, 3);
      }
    }
    db.saveProfile(authUser.id, profile);
  }

  return sendJson(res, 200, {
    success: true,
    message: 'Valoración guardada. Tu feedback calibra tu perfil para futuras selecciones sin generar devolución.',
    rating: savedRating
  });
}

// Ratings POST (Batch)
async function rateBox({ req, res, authUser, match }) {
  const boxId = match[1];
  const box = db.getBoxById(boxId);
  if (!box || box.userId !== authUser.id) {
    return sendJson(res, 404, { error: 'Caja no encontrada.' });
  }

  if (box.status !== 'DELIVERED' && box.status !== 'RATED') {
    return sendJson(res, 403, { error: 'Solo puedes calificar prendas de una caja que ya hayas recibido.' });
  }

  const { ratings } = await parseJsonBody(req);
  if (!Array.isArray(ratings) || ratings.length === 0) {
    return sendJson(res, 400, { error: 'Debes enviar al menos una calificación.' });
  }

  const savedRatings = [];
  const profile = db.getProfile(authUser.id) || { brandAdj: {}, styles: [] };

  ratings.forEach(r => {
    if (!box.itemIds.includes(r.productId)) return;
    const fitScore = parseScore(r.fitScore, 'ajuste');
    const styleScore = parseScore(r.styleScore, 'estilo');
    const partials = [fitScore, styleScore].filter(v => v !== undefined);
    const score = parseScore(r.score, 'la prenda')
      ?? (partials.length ? Math.round(partials.reduce((a, b) => a + b, 0) / partials.length) : undefined);
    if (score === undefined) return;

    const saved = db.addRating(authUser.id, boxId, r.productId, {
      score,
      fitScore,
      styleScore,
      liked: r.liked !== false,
      styleFeedback: r.styleFeedback || '',
      feedback: r.feedback || r.styleFeedback || '',
      preferenceNotes: r.preferenceNotes || ''
    });
    savedRatings.push(saved);

      const prod = db.getProductById(r.productId);
      if (prod && score >= 4 && prod.styles && prod.styles[0]) {
        const style = prod.styles[0];
        if (!profile.styles.includes(style)) {
          profile.styles = [style, ...profile.styles].slice(0, 3);
        }
      }
  });

  db.updateBox(boxId, { status: 'RATED' });
  db.saveProfile(authUser.id, profile);

  return sendJson(res, 200, { success: true, count: savedRatings.length });
}

function listFeedback({ res }) {
  const ratings = db.getAllRatings();
  return sendJson(res, 200, { ratings });
}

// HU-10: ejecución manual del recordatorio de calificación
function sendReviewReminders({ res }) {
  return sendJson(res, 200, { success: true, ...runReviewReminders() });
}

// HU-11: reentrenamiento del motor con el feedback pendiente
function ingestFeedback({ res }) {
  return sendJson(res, 200, { success: true, ...learning.ingestFeedback() });
}

module.exports = [
  { method: 'POST', path: /^\/api\/boxes\/([^/]+)\/item-feedback$/, handler: itemFeedback },
  { method: 'POST', path: /^\/api\/boxes\/([^/]+)\/ratings$/, handler: rateBox },
  { method: 'GET', path: '/api/admin/feedback', handler: listFeedback },
  { method: 'POST', path: '/api/admin/jobs/review-reminders', handler: sendReviewReminders },
  { method: 'POST', path: '/api/admin/jobs/ingest-feedback', handler: ingestFeedback }
];
