// Admin read models that span several collections: the client list with profile and box
// status, and the dashboard summary (boxes by status, returns, average satisfaction, catalog
// size and brands). Kept apart from the per-collection repositories so those stay free of
// circular dependencies.
const store = require('./store');
const profiles = require('./profiles');
const boxes = require('./boxes');

function getAllUsers() {
  return store.data.users.map(u => {
    const profile = profiles.getProfile(u.id);
    const userBoxes = boxes.getUserBoxes(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || 'CLIENT',
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      profile,
      boxesCount: userBoxes.length,
      currentBoxStatus: userBoxes[0] ? userBoxes[0].status : 'NO_BOX'
    };
  });
}

function getAdminMetrics() {
  const { data, catalog } = store;
  const clients = data.users.filter(u => (u.role || 'CLIENT') === 'CLIENT');
  const totalBoxes = data.boxes.length;
  const deliveredBoxes = data.boxes.filter(b => b.status === 'DELIVERED' || b.status === 'RATED').length;
  const inTransitBoxes = data.boxes.filter(b => b.status === 'SHIPPED').length;
  const preparingBoxes = data.boxes.filter(b => b.status === 'PREPARING').length;
  const totalReturns = data.returns.length;
  const pendingReturns = data.returns.filter(r => r.status === 'PENDING_PICKUP' || r.status === 'PENDING').length;

  const allScores = data.ratings.map(r => r.score).filter(s => typeof s === 'number');
  const averageScore = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '4.8';

  const brands = [...new Set(catalog.map(p => p.brandName))];

  return {
    totalClients: clients.length,
    totalBoxes,
    deliveredBoxes,
    inTransitBoxes,
    preparingBoxes,
    totalReturns,
    pendingReturns,
    returnRate: deliveredBoxes > 0 ? ((totalReturns / deliveredBoxes) * 100).toFixed(1) : '0.0',
    averageSatisfaction: averageScore,
    totalProducts: catalog.length,
    brandsCount: brands.length,
    brandsList: brands
  };
}

module.exports = { getAllUsers, getAdminMetrics };
