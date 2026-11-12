// Controlled vocabulary shared by catalog, quiz, engine and stylist tools. The single source
// is backend/config.js; this module only re-exports it so new code imports from domain/.
const config = require('../config');

const SIZES = config.SIZES;
const CATEGORIES = config.CATEGORIES;
const STYLES = config.STYLES;
const OCCASIONS = config.OCCASIONS;

function isSize(value) {
  return SIZES.includes(value);
}

function isCategory(value) {
  return CATEGORIES.includes(value);
}

function isStyle(value) {
  return STYLES.includes(value);
}

function isOccasion(value) {
  return OCCASIONS.includes(value);
}

module.exports = { SIZES, CATEGORIES, STYLES, OCCASIONS, isSize, isCategory, isStyle, isOccasion };
