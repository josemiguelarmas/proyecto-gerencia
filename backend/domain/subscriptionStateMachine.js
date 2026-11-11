// Subscription lifecycle contract. The rules already live in backend/billing.js (HU-08/12/13)
// and are re-exported here unchanged so streams import them from domain/. billing.js loads the
// database on require, so this module does too; moving TRANSITIONS here is left to stream D1.
const billing = require('../billing');

const STATUSES = Object.freeze({
  NONE: 'NONE',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  PAST_DUE: 'PAST_DUE',
  CANCELLED: 'CANCELLED'
});

module.exports = {
  STATUSES,
  TRANSITIONS: billing.TRANSITIONS,
  canTransition: billing.canTransition,
  assertTransition: billing.assertTransition
};
