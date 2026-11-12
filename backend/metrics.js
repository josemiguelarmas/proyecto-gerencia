// HU-17: indicadores del mes. Re-exporta la lógica pura de backend/kpis.js para compatibilidad.
const kpis = require('./kpis');

module.exports = {
  ...kpis
};
