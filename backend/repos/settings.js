// Settings repository (HU-17): key/value business settings editable from the admin panel,
// such as the churn alert threshold. Reading a missing key returns the given fallback.
const store = require('./store');

// HU-17: ajustes editables desde el panel
function getSetting(key, fallback) {
  const found = store.data.settings.find(s => s.key === key);
  return found ? found.value : fallback;
}

function setSetting(key, value) {
  let found = store.data.settings.find(s => s.key === key);
  if (!found) {
    found = { key };
    store.data.settings.push(found);
  }
  Object.assign(found, { value, updatedAt: new Date().toISOString() });
  store.save();
  return found;
}

module.exports = { getSetting, setSetting };
