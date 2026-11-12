// Offline and API feedback evaluation (HU-11, SCRUM-77).
// Computes average ratings before vs after learning per subscriber cohort.
const { db } = require('../backend/database');

function evaluateFeedback(customDb = db) {
  const storeData = customDb.data;
  const ratings = storeData.ratings || [];
  const profiles = storeData.profiles || [];
  const users = storeData.users || [];

  const cohorts = {
    esencial: { name: 'Plan Esencial', totalRatings: 0, sumBefore: 0, countBefore: 0, sumAfter: 0, countAfter: 0 },
    estilo: { name: 'Plan Estilo', totalRatings: 0, sumBefore: 0, countBefore: 0, sumAfter: 0, countAfter: 0 },
    general: { name: 'Todos los Suscriptores', totalRatings: 0, sumBefore: 0, countBefore: 0, sumAfter: 0, countAfter: 0 }
  };

  ratings.forEach(r => {
    const profile = profiles.find(p => p.id === r.userId) || {};
    const plan = profile.plan || 'esencial';
    const score = Number(r.styleScore) || Number(r.score) || 0;
    if (score <= 0) return;

    const cohort = cohorts[plan] || cohorts.esencial;
    const isLearned = Boolean(r.learnedAt);

    cohort.totalRatings++;
    cohorts.general.totalRatings++;

    if (!isLearned) {
      cohort.sumBefore += score;
      cohort.countBefore++;
      cohorts.general.sumBefore += score;
      cohorts.general.countBefore++;
    } else {
      cohort.sumAfter += score;
      cohort.countAfter++;
      cohorts.general.sumAfter += score;
      cohorts.general.countAfter++;
    }
  });

  const summary = {};
  for (const [key, c] of Object.entries(cohorts)) {
    const avgBefore = c.countBefore > 0 ? Math.round((c.sumBefore / c.countBefore) * 10) / 10 : null;
    const avgAfter = c.countAfter > 0 ? Math.round((c.sumAfter / c.countAfter) * 10) / 10 : null;
    const delta = (avgBefore !== null && avgAfter !== null) ? Math.round((avgAfter - avgBefore) * 10) / 10 : 0;

    summary[key] = {
      name: c.name,
      totalRatings: c.totalRatings,
      avgBefore: avgBefore !== null ? avgBefore : 'sin datos',
      avgAfter: avgAfter !== null ? avgAfter : 'sin datos',
      delta
    };
  }

  return {
    evaluatedAt: new Date().toISOString(),
    cohorts: summary,
    totalRatings: ratings.length,
    profilesWithLearnedWeights: profiles.filter(p => p.learningRevision && p.learningRevision > 0).length
  };
}

if (require.main === module) {
  const result = evaluateFeedback();
  console.log('=== EVALUACIÓN DE FEEDBACK Y APRENDIZAJE (HU-11) ===');
  console.log(`Evaluado: ${result.evaluatedAt}`);
  console.log(`Total calificaciones: ${result.totalRatings}`);
  console.log(`Perfiles con aprendizaje: ${result.profilesWithLearnedWeights}\n`);
  for (const [k, c] of Object.entries(result.cohorts)) {
    console.log(`- ${c.name}: Antes=${c.avgBefore} | Después=${c.avgAfter} | Delta=${c.delta}`);
  }
}

module.exports = { evaluateFeedback };
