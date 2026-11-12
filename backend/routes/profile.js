// Style profile routes: read and save the subscriber profile and list its archived versions
// (HU-03). Saving the profile from the quiz archives the previous version, closes the quiz
// session and, when the subscriber has no box yet, asks the engine for the first proposal.
const { db } = require('../database');
const { sendJson, parseJsonBody } = require('../lib/http');
const { createCuratedBox } = require('../lib/boxes');
const { pick, validateMeasures } = require('../lib/validate');
const sizeEquivalences = require('../sizeEquivalences');

// F5 & HU-04: campos que el suscriptor puede escribir.
const PROFILE_FIELDS = [
  'styles', 'occasions', 'fit', 'line', 'risk', 'plan', 'measures', 'budgetRange', 'address', 'styleWeights',
  'heightCm', 'weightKg', 'bodyBuild', 'fitPreference', 'usualSizeTop', 'usualSizeBottom', 'referenceGarment'
];

function getProfile({ res, authUser }) {
  const profile = db.getProfile(authUser.id);
  return sendJson(res, 200, profile || {});
}

async function saveProfile({ req, res, authUser }) {
  const raw = await parseJsonBody(req);
  const source = raw.source;
  const body = pick(raw, PROFILE_FIELDS);

  // HU-04 (SCRUM-34): Server-side range validation for measures
  if (body.measures) {
    const { valid, errors } = validateMeasures(body.measures);
    if (!valid) {
      return sendJson(res, 422, { error: 'Medidas fuera de rango', errors });
    }
  }

  // HU-04: Budget range validation
  if (body.budgetRange) {
    const { min, max } = body.budgetRange;
    if (min !== undefined && max !== undefined && Number(min) > Number(max)) {
      return sendJson(res, 422, { error: 'El presupuesto mínimo no puede ser mayor que el máximo.' });
    }
  }

  // HU-03: completar el quiz crea una nueva versión del perfil de estilo y cierra la sesión del quiz.
  let quizSession = null;
  if (source === 'quiz') {
    const previous = db.getProfile(authUser.id);
    const archived = db.archiveProfileVersion(authUser.id);
    body.version = archived ? archived.version + 1 : ((previous && previous.version) || 1);
    quizSession = db.completeQuizSession(authUser.id);
  }
  const profile = db.saveProfile(authUser.id, { ...body, done: true });

  // Si el usuario aún no tiene caja, el motor arma la primera y queda PROPOSED para el estilista (HU-07).
  let boxes = db.getUserBoxes(authUser.id);
  let activeBox = boxes.find(b => b.status !== 'RATED') || boxes[0];

  if (!activeBox) {
    activeBox = createCuratedBox(authUser.id, profile, {
      cycle: 1,
      address: body.address || 'Calle 18 # 122-135, Pance, Cali'
    }).box;
  }

  return sendJson(res, 200, { profile, boxId: activeBox.id, quizSession });
}

// HU-03: historial de versiones del perfil de estilo
function getProfileHistory({ res, authUser }) {
  const current = db.getProfile(authUser.id);
  return sendJson(res, 200, {
    currentVersion: current ? current.version || 1 : null,
    versions: db.getProfileVersions(authUser.id)
  });
}

// HU-04 (SCRUM-35): Admin size equivalences management
function getSizeEquivalences({ res }) {
  return sendJson(res, 200, sizeEquivalences.getSizeEquivalences());
}

async function updateSizeEquivalences({ req, res }) {
  const body = await parseJsonBody(req);
  try {
    const updated = sizeEquivalences.saveSizeEquivalences(body);
    return sendJson(res, 200, { success: true, sizeEquivalences: updated });
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }
}

module.exports = [
  { method: 'GET', path: '/api/profile', handler: getProfile },
  { method: 'PUT', path: '/api/profile', handler: saveProfile },
  { method: 'GET', path: '/api/profile/history', handler: getProfileHistory },
  { method: 'GET', path: '/api/admin/size-equivalences', roles: ['ADMIN'], handler: getSizeEquivalences },
  { method: 'PUT', path: '/api/admin/size-equivalences', roles: ['ADMIN'], handler: updateSizeEquivalences }
];
