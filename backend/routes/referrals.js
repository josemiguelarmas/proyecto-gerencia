// Referral program routes (HU-18, SCRUM-110..113): unique codes and links (SCRUM-111),
// anti-fraud validation (SCRUM-112), and conversion reporting (SCRUM-113).
const { db } = require('../database');
const { sendJson, parseJsonBody } = require('../lib/http');

function getMyReferral({ res, authUser }) {
  const summary = db.getReferralSummary(authUser.id);
  return sendJson(res, 200, summary);
}

async function validateCode({ req, res }) {
  const { referralCode } = await parseJsonBody(req);
  const result = db.validateReferralCode(referralCode);
  if (!result.valid) {
    return sendJson(res, 400, { valid: false, error: result.error });
  }
  return sendJson(res, 200, {
    valid: true,
    code: result.referrer.code,
    referrerName: result.referrer.name,
    discountCOP: result.discountCOP
  });
}

function adminReferralsReport({ res }) {
  const report = db.getAdminReferralsReport();
  return sendJson(res, 200, report);
}

module.exports = [
  { method: 'GET', path: '/api/me/referral', handler: getMyReferral },
  { method: 'POST', path: '/api/referrals/validate', public: true, handler: validateCode },
  { method: 'GET', path: '/api/admin/referrals', roles: ['ADMIN'], handler: adminReferralsReport }
];
