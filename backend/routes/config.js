// Public read-only configuration for the SPA: business rules the screens need (minimum age,
// plans, cancellation reasons, return window, fiscal document types) and the active payment
// provider with its test cards when it is the simulated one. The values come from
// backend/config.js and the payments adapter; this module only shapes the response.
const config = require('../config');
const payments = require('../adapters/payments');
const { sendJson } = require('../lib/http');

function getConfig({ res }) {
  return sendJson(res, 200, {
    minAge: config.MIN_AGE,
    cancellationReasons: config.CANCELLATION_REASONS,
    plans: Object.fromEntries(Object.entries(config.PLANS).map(([k, p]) => [k, { name: p.name, priceCOP: p.priceCOP, items: p.items }])),
    cutoffDay: config.SUBSCRIPTION_CUTOFF_DAY,
    fiscalDocTypes: config.FISCAL_DOC_TYPES,
    paymentProvider: payments.name,
    returnWindowBusinessDays: config.RETURN_WINDOW_BUSINESS_DAYS,
    returnConditions: config.RETURN_CONDITIONS,
    testCards: payments.name === 'simulated' ? payments.testCards : []
  });
}

module.exports = [
  { method: 'GET', path: '/api/config', public: true, handler: getConfig }
];
