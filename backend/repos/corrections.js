// Stylist corrections repository (HU-07): every garment replacement or rejected proposal with
// its reason, kept as training examples for the engine retraining of HU-11.
const store = require('./store');
const { newId } = require('../lib/crypto');

// HU-07: correcciones del estilista (ejemplos para el reentrenamiento de HU-11)
function addCorrection(data) {
  const correction = {
    id: newId('cor'),
    ...data,
    createdAt: new Date().toISOString()
  };
  store.data.corrections.push(correction);
  store.save();
  return correction;
}

module.exports = { addCorrection };
