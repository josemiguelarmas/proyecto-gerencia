// Style profiles repository: the current profile of each subscriber (quiz answers, measures,
// learned weights) and its archived versions (HU-03), kept when the quiz is repeated so the
// subscriber can see how their profile changed over time.
const store = require('./store');
const { newId } = require('../lib/crypto');

function getProfile(userId) {
  return store.data.profiles.find(p => p.userId === userId) || null;
}

function saveProfile(userId, profileData) {
  let profile = getProfile(userId);
  if (!profile) {
    profile = { userId, ...profileData, updatedAt: new Date().toISOString() };
    store.data.profiles.push(profile);
  } else {
    Object.assign(profile, profileData, { updatedAt: new Date().toISOString() });
  }
  store.save();
  return profile;
}

// HU-03: el perfil de estilo anterior se conserva como versión al repetir el quiz
function archiveProfileVersion(userId) {
  const profile = getProfile(userId);
  if (!profile || !profile.done) return null;
  const { userId: _u, ...snapshot } = profile;
  const version = {
    id: newId('pv'),
    userId,
    version: profile.version || 1,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    archivedAt: new Date().toISOString()
  };
  store.data.profileVersions.push(version);
  store.save();
  return version;
}

function getProfileVersions(userId) {
  return store.data.profileVersions
    .filter(v => v.userId === userId)
    .sort((a, b) => b.version - a.version);
}

module.exports = { getProfile, saveProfile, archiveProfileVersion, getProfileVersions };
