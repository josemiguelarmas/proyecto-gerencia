// Boxes repository: a subscriber's boxes (newest cycle first), lookup by id, creation of a
// proposed box with its recommendations and cost, partial updates, and the admin list that
// joins each box with its subscriber, profile and catalog items.
const store = require('./store');
const { newId } = require('../lib/crypto');
const users = require('./users');
const profiles = require('./profiles');
const products = require('./products');

function getUserBoxes(userId) {
  return store.data.boxes
    .filter(b => b.userId === userId)
    .sort((a, b) => b.cycle - a.cycle);
}

function getBoxById(boxId) {
  return store.data.boxes.find(b => b.id === boxId) || null;
}

function getAllBoxes() {
  return store.data.boxes.map(box => {
    const user = users.findUserById(box.userId);
    const profile = profiles.getProfile(box.userId) || {};
    const items = (box.itemIds || []).map(id => {
      const prod = products.getProductById(id);
      return prod || { id, name: 'Prenda no catalogada' };
    });
    return {
      ...box,
      userName: user ? user.name : 'Usuario Desconocido',
      userEmail: user ? user.email : '',
      clientProfile: profile,
      items
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function createBox(userId, boxData) {
  const box = {
    id: newId('box', 5),
    userId,
    cycle: boxData.cycle || 1,
    status: boxData.status || 'PROPOSED',
    plan: boxData.plan || 'esencial',
    address: boxData.address || 'Cali, Colombia',
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    estimatedDelivery: boxData.estimatedDelivery || new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
    itemIds: boxData.itemIds || [],
    recommendations: boxData.recommendations || [],
    totalCostCOP: boxData.totalCostCOP ?? null,
    targetCostCOP: boxData.targetCostCOP ?? null,
    withinCap: boxData.withinCap ?? null,
    rulesVersion: boxData.rulesVersion || null,
    profileLearningRevision: boxData.profileLearningRevision ?? null,
    reviewLog: [],
    unboxed: false
  };
  store.data.boxes.push(box);
  store.save();
  return box;
}

function updateBox(boxId, updates) {
  const box = getBoxById(boxId);
  if (!box) return null;
  Object.assign(box, updates);
  store.save();
  return box;
}

module.exports = { getUserBoxes, getBoxById, getAllBoxes, createBox, updateBox };
