// Consents repository (HU-02): an append-only audit trail of which policy version each user
// accepted and when. Records are never edited, only added.
const store = require('./store');
const { newId } = require('../lib/crypto');

// HU-02: registro de auditoría del consentimiento
function addConsent(userId, { accepted, policyVersion }) {
  const consent = {
    id: newId('cns'),
    userId,
    accepted: accepted === true,
    policyVersion,
    acceptedAt: new Date().toISOString()
  };
  store.data.consents.push(consent);
  store.save();
  return consent;
}

function getConsentsByUser(userId) {
  return store.data.consents.filter(c => c.userId === userId);
}

module.exports = { addConsent, getConsentsByUser };
