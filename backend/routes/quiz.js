// Style quiz routes (HU-03): serve question bank (SCRUM-26), read and save partial progress
// so the subscriber can resume where they left off (SCRUM-29). Completing the quiz is done
// by saving the profile with source "quiz" (see routes/profile.js).
const fs = require('fs');
const path = require('path');
const { db } = require('../database');
const { sendJson, parseJsonBody } = require('../lib/http');
const env = require('../config/env');
const { isStyle } = require('../domain/vocab');

const QUIET_SEED = path.join(env.SEED_DIR, 'quiz.json');

function getQuizBank({ res }) {
  try {
    const data = JSON.parse(fs.readFileSync(QUIET_SEED, 'utf8'));
    return sendJson(res, 200, data);
  } catch (err) {
    return sendJson(res, 500, { error: 'No se pudo cargar el cuestionario de estilo.' });
  }
}

function getProgress({ res, authUser }) {
  return sendJson(res, 200, { session: db.getOpenQuizSession(authUser.id) });
}

async function saveProgress({ req, res, authUser }) {
  const { step, answers, repeat } = await parseJsonBody(req);
  const stepNum = Number(step);
  // Allows per-question steps (1 to 8) so user can resume at question 5
  if (!Number.isInteger(stepNum) || stepNum < 1 || stepNum > 8) {
    return sendJson(res, 400, { error: 'El paso del quiz debe estar entre 1 y 8.' });
  }

  // Validate style weights if provided (SCRUM-27)
  if (answers && answers.styleWeights && typeof answers.styleWeights === 'object') {
    for (const [style, weight] of Object.entries(answers.styleWeights)) {
      if (!isStyle(style)) {
        return sendJson(res, 400, { error: `Estilo "${style}" no reconocido en el vocabulario.` });
      }
      const w = Number(weight);
      if (isNaN(w) || w < 0 || w > 1) {
        return sendJson(res, 400, { error: `El peso del estilo "${style}" debe estar entre 0 y 1.` });
      }
    }
  }

  const session = db.saveQuizProgress(authUser.id, { step: stepNum, answers: answers || {}, repeat });
  return sendJson(res, 200, { session });
}

module.exports = [
  { method: 'GET', path: '/api/quiz', public: true, handler: getQuizBank },
  { method: 'GET', path: '/api/quiz/progress', handler: getProgress },
  { method: 'PUT', path: '/api/quiz/progress', handler: saveProgress }
];
