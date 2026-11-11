// Style quiz routes (HU-03): read and save the partial progress of the open quiz session so
// the subscriber can resume where they left off. Completing the quiz is done by saving the
// profile with source "quiz" (see routes/profile.js).
const { db } = require('../database');
const { sendJson, parseJsonBody } = require('../lib/http');

function getProgress({ res, authUser }) {
  return sendJson(res, 200, { session: db.getOpenQuizSession(authUser.id) });
}

async function saveProgress({ req, res, authUser }) {
  const { step, answers, repeat } = await parseJsonBody(req);
  const stepNum = Number(step);
  if (!Number.isInteger(stepNum) || stepNum < 1 || stepNum > 4) {
    return sendJson(res, 400, { error: 'El paso del quiz debe estar entre 1 y 4.' });
  }
  const session = db.saveQuizProgress(authUser.id, { step: stepNum, answers: answers || {}, repeat });
  return sendJson(res, 200, { session });
}

module.exports = [
  { method: 'GET', path: '/api/quiz/progress', handler: getProgress },
  { method: 'PUT', path: '/api/quiz/progress', handler: saveProgress }
];
