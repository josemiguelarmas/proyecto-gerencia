// Returns repository (HU-14): a subscriber's return and exchange requests, creation with the
// pickup data, status updates from the admin panel, and the admin list joined with
// subscriber, product and box cycle. Window and stock rules live in backend/logistics.js.
const store = require('./store');
const { newId } = require('../lib/crypto');
const users = require('./users');
const products = require('./products');
const boxes = require('./boxes');

function getReturnsByUser(userId) {
  return store.data.returns.filter(r => r.userId === userId);
}

function getAllReturns() {
  return store.data.returns.map(ret => {
    const user = users.findUserById(ret.userId);
    const product = products.getProductById(ret.productId);
    const box = boxes.getBoxById(ret.boxId);
    return {
      ...ret,
      userName: user ? user.name : 'Cliente',
      userEmail: user ? user.email : '',
      productName: product ? product.name : ret.productId,
      brand: product ? product.brandName : '',
      productImage: product ? product.imageUrl : '',
      boxCycle: box ? box.cycle : 1
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function createReturn(userId, returnData) {
  const ret = {
    id: newId('ret'),
    userId,
    boxId: returnData.boxId,
    productId: returnData.productId,
    reason: returnData.reason,
    requestedSize: returnData.requestedSize,
    notes: returnData.notes || '',
    pickupAddress: returnData.pickupAddress || 'Cali, Colombia',
    scheduledPickupDate: returnData.scheduledPickupDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
    status: 'PENDING_PICKUP',
    createdAt: new Date().toISOString()
  };
  store.data.returns.push(ret);
  store.save();
  return ret;
}

function updateReturn(returnId, updates) {
  const ret = store.data.returns.find(r => r.id === returnId);
  if (!ret) return null;
  Object.assign(ret, updates, { updatedAt: new Date().toISOString() });
  store.save();
  return ret;
}

module.exports = { getReturnsByUser, getAllReturns, createReturn, updateReturn };
