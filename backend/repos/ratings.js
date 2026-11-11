// Ratings repository: garment ratings per box or per user, one rating per user, box and
// garment (a second rating updates the first), with separate fit and style scores (HU-10),
// and the admin list joined with subscriber, product and box cycle.
const store = require('./store');
const { newId } = require('../lib/crypto');
const users = require('./users');
const products = require('./products');
const boxes = require('./boxes');

function getRatingsByBox(boxId) {
  return store.data.ratings.filter(r => r.boxId === boxId);
}

function getRatingsByUser(userId) {
  return store.data.ratings.filter(r => r.userId === userId);
}

function getAllRatings() {
  return store.data.ratings.map(r => {
    const user = users.findUserById(r.userId);
    const product = products.getProductById(r.productId);
    const box = boxes.getBoxById(r.boxId);
    return {
      ...r,
      userName: user ? user.name : 'Usuario',
      userEmail: user ? user.email : '',
      productName: product ? product.name : r.productId,
      productBrand: product ? product.brandName : '',
      productImage: product ? product.imageUrl : '',
      boxCycle: box ? box.cycle : null
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function addRating(userId, boxId, productId, ratingData) {
  // Check if an existing rating for this product/box already exists
  let rating = store.data.ratings.find(r => r.userId === userId && r.boxId === boxId && r.productId === productId);
  if (rating) {
    Object.assign(rating, {
      score: ratingData.score !== undefined ? ratingData.score : rating.score,
      fitScore: ratingData.fitScore !== undefined ? ratingData.fitScore : (rating.fitScore ?? null),
      styleScore: ratingData.styleScore !== undefined ? ratingData.styleScore : (rating.styleScore ?? null),
      liked: ratingData.liked !== undefined ? ratingData.liked : rating.liked,
      styleFeedback: ratingData.styleFeedback !== undefined ? ratingData.styleFeedback : (ratingData.feedback || rating.styleFeedback),
      feedback: ratingData.feedback || rating.feedback,
      preferenceNotes: ratingData.preferenceNotes || rating.preferenceNotes || '',
      updatedAt: new Date().toISOString()
    });
  } else {
    rating = {
      id: newId('rat'),
      userId,
      boxId,
      productId,
      score: ratingData.score || 4,
      fitScore: ratingData.fitScore ?? null,
      styleScore: ratingData.styleScore ?? null,
      liked: ratingData.liked !== false,
      styleFeedback: ratingData.styleFeedback || ratingData.feedback || '',
      feedback: ratingData.feedback || '',
      preferenceNotes: ratingData.preferenceNotes || '',
      createdAt: new Date().toISOString()
    };
    store.data.ratings.push(rating);
  }
  store.save();
  return rating;
}

module.exports = { getRatingsByBox, getRatingsByUser, getAllRatings, addRating };
