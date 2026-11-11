// Quiz sessions repository (HU-03): the open session with its partial answers so the quiz can
// be resumed, its completion with the time it took, and the timing stats shown in the admin
// dashboard against the target duration.
const store = require('./store');
const { newId } = require('../lib/crypto');
const users = require('./users');

// HU-03: sesiones del quiz (progreso parcial y tiempo de completado)
function getOpenQuizSession(userId) {
  return store.data.quizSessions.find(q => q.userId === userId && q.status === 'IN_PROGRESS') || null;
}

function saveQuizProgress(userId, { step, answers, repeat }) {
  let session = getOpenQuizSession(userId);
  if (!session) {
    session = {
      id: newId('quiz'),
      userId,
      status: 'IN_PROGRESS',
      repeat: !!repeat,
      startedAt: new Date().toISOString()
    };
    store.data.quizSessions.push(session);
  }
  Object.assign(session, { step, answers, updatedAt: new Date().toISOString() });
  store.save();
  return session;
}

function completeQuizSession(userId) {
  const session = getOpenQuizSession(userId);
  if (!session) return null;
  const completedAt = new Date();
  Object.assign(session, {
    status: 'COMPLETED',
    completedAt: completedAt.toISOString(),
    durationSec: Math.round((completedAt - new Date(session.startedAt)) / 1000)
  });
  store.save();
  return session;
}

function getQuizStats() {
  const done = store.data.quizSessions.filter(q => q.status === 'COMPLETED' && Number.isFinite(q.durationSec));
  const avg = done.length ? Math.round(done.reduce((a, q) => a + q.durationSec, 0) / done.length) : null;
  return {
    completed: done.length,
    inProgress: store.data.quizSessions.filter(q => q.status === 'IN_PROGRESS').length,
    averageDurationSec: avg,
    recent: done.slice(-10).reverse().map(q => {
      const user = users.findUserById(q.userId);
      return { userName: user ? user.name : q.userId, durationSec: q.durationSec, completedAt: q.completedAt, repeat: q.repeat };
    })
  };
}

module.exports = { getOpenQuizSession, saveQuizProgress, completeQuizSession, getQuizStats };
