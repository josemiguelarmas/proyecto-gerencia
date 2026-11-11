// Subscriptions repository (HU-08, HU-12): one subscription per user. Without a stored record
// the user is reported with status NONE and the plan from their profile; the record is created
// on the first save, which happens with the first approved payment.
const store = require('./store');
const { newId } = require('../lib/crypto');
const profiles = require('./profiles');

// HU-08: la suscripción nace con el primer pago aprobado. Sin registro el estado es NONE.
function getSubscription(userId) {
  let sub = store.data.subscriptions.find(s => s.userId === userId);
  if (!sub) {
    const profile = profiles.getProfile(userId);
    sub = {
      userId,
      plan: (profile && profile.plan) || 'esencial',
      status: 'NONE'
    };
  }
  return sub;
}

function getAllSubscriptions() {
  return store.data.subscriptions;
}

function saveSubscription(userId, updates) {
  let sub = store.data.subscriptions.find(s => s.userId === userId);
  if (!sub) {
    sub = { id: newId('sub'), ...getSubscription(userId), createdAt: new Date().toISOString() };
    store.data.subscriptions.push(sub);
  }
  Object.assign(sub, updates, { updatedAt: new Date().toISOString() });
  store.save();
  return sub;
}

module.exports = { getSubscription, getAllSubscriptions, saveSubscription };
