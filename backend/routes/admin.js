// General admin panel routes that do not belong to one business domain: dashboard metrics
// with quiz timing, the client list, the monthly KPIs with month and plan filters and the
// churn alert threshold (HU-17), and the simulated e-mail outbox. Domain-specific admin
// endpoints live next to their domain (catalog, warehouse, payments, returns, ratings...).
const { db } = require('../database');
const config = require('../config');
const mail = require('../adapters/mailer');
const metrics = require('../metrics');
const { sendJson, parseJsonBody } = require('../lib/http');
const modelVersions = require('../modelVersions');
const { evaluateFeedback } = require('../../scripts/eval-feedback');

function dashboardMetrics({ res }) {
  const summary = db.getAdminMetrics();
  return sendJson(res, 200, {
    ...summary,
    quiz: { ...db.getQuizStats(), targetSec: config.QUIZ_TARGET_SECONDS },
    plans: config.PLANS
  });
}

function listClients({ res }) {
  const clients = db.getAllUsers();
  return sendJson(res, 200, { clients });
}

// HU-17: indicadores del mes con filtros por mes y plan
function monthlyKpis({ req, res }) {
  const query = new URL(req.url, 'http://localhost').searchParams;
  const months = metrics.availableMonths();
  const month = query.get('month') || months[0];
  const plan = query.get('plan') || 'all';
  if (!/^\d{4}-\d{2}$/.test(month)) return sendJson(res, 400, { error: 'El mes debe tener el formato AAAA-MM.' });
  if (plan !== 'all' && !config.PLANS[plan]) return sendJson(res, 400, { error: 'El plan debe ser all, esencial o estilo.' });
  const threshold = db.getSetting('churnThreshold', config.CHURN_THRESHOLD_DEFAULT);
  return sendJson(res, 200, { ...metrics.computeKpis(db.data, { month, plan, threshold }), months });
}

async function setChurnThreshold({ req, res }) {
  const { value } = await parseJsonBody(req);
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 100) {
    return sendJson(res, 400, { error: 'El umbral de churn debe ser un porcentaje mayor que 0 y hasta 100.' });
  }
  const saved = db.setSetting('churnThreshold', Math.round(n * 10) / 10);
  return sendJson(res, 200, { success: true, threshold: saved.value });
}

// Bandeja de salida de correos simulados
function outbox({ res }) {
  return sendJson(res, 200, { provider: mail.name, messages: mail.list() });
}

// HU-06/HU-11 (SCRUM-78): Gestión de versiones de reglas del motor
function listModelVersions({ res }) {
  return sendJson(res, 200, {
    active: modelVersions.getActiveVersion(),
    versions: modelVersions.listVersions()
  });
}

async function setActiveModelVersion({ req, res }) {
  const { versionId } = await parseJsonBody(req);
  if (!versionId) return sendJson(res, 400, { error: 'Falta versionId' });
  try {
    const updated = modelVersions.setActiveVersion(versionId);
    return sendJson(res, 200, { success: true, active: updated });
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }
}

// HU-11 (SCRUM-77): Evaluación de cohortes antes y después del aprendizaje
function getFeedbackEvaluation({ res }) {
  const result = evaluateFeedback(db);
  return sendJson(res, 200, result);
}

// HU-11 (SCRUM-75): Consulta de eventos normalizados de feedback
function getFeedbackEvents({ res }) {
  return sendJson(res, 200, {
    events: db.data.feedbackEvents || []
  });
}

module.exports = [
  { method: 'GET', path: '/api/admin/metrics', handler: dashboardMetrics },
  { method: 'GET', path: '/api/admin/clients', handler: listClients },
  { method: 'GET', path: '/api/admin/kpis', handler: monthlyKpis },
  { method: 'PUT', path: '/api/admin/settings/churn-threshold', handler: setChurnThreshold },
  { method: 'GET', path: '/api/admin/outbox', handler: outbox },
  { method: 'GET', path: '/api/admin/model-versions', roles: ['ADMIN'], handler: listModelVersions },
  { method: 'POST', path: '/api/admin/model-versions/active', roles: ['ADMIN'], handler: setActiveModelVersion },
  { method: 'GET', path: '/api/admin/model/eval-feedback', roles: ['ADMIN'], handler: getFeedbackEvaluation },
  { method: 'GET', path: '/api/admin/feedback-events', roles: ['ADMIN'], handler: getFeedbackEvents }
];
