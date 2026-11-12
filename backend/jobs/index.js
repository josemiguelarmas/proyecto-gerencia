// Scheduled jobs. Each job is a module in this folder exporting run({ now }) that returns a
// summary object; it works on the shared store (backend/database.js) and adapters, and takes
// "now" from the caller (default: the injectable clock), so tests call run() with any date.
// startJobs() runs the hourly jobs once at boot and then on intervals; daily jobs run at most
// once per day and the monthly box batch only on BOX_BATCH_DAY. Nothing is scheduled when
// NODE_ENV=test: tests call run() directly or use the admin job endpoints.
const env = require('../config/env');
const config = require('../config');
const clock = require('../lib/clock');

const jobs = {
  reviewReminder: require('./reviewReminder'),
  recurringBilling: require('./recurringBilling'),
  autoResume: require('./autoResume'),
  invoiceRetry: require('./invoiceRetry'),
  feedback: require('./feedback'),
  boxBatch: require('./boxBatch'),
  kpiSnapshot: require('./kpiSnapshot'),
  paymentReconciliation: require('./paymentReconciliation')
};

// cadence: 'hourly' runs every tick; 'daily' once per calendar day; 'monthly' on BOX_BATCH_DAY.
const SCHEDULE = [
  { job: 'reviewReminder', cadence: 'hourly' },
  { job: 'autoResume', cadence: 'hourly' },
  { job: 'recurringBilling', cadence: 'hourly' },
  { job: 'invoiceRetry', cadence: 'hourly' },
  { job: 'feedback', cadence: 'daily' },
  { job: 'kpiSnapshot', cadence: 'daily' },
  { job: 'paymentReconciliation', cadence: 'daily' },
  { job: 'boxBatch', cadence: 'monthly' }
];

const lastRunDay = {};

// Calendar day in the server's local time zone (Cali), e.g. "2026-11-01".
function dayKey(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isDue(entry, now) {
  if (entry.cadence === 'hourly') return true;
  if (lastRunDay[entry.job] === dayKey(now)) return false;
  if (entry.cadence === 'monthly' && now.getDate() !== config.BOX_BATCH_DAY) return false;
  return true;
}

// One scheduler pass. A failing job is logged and does not stop the others.
function tick(now = clock.now()) {
  const summaries = {};
  SCHEDULE.forEach(entry => {
    if (!isDue(entry, now)) return;
    try {
      summaries[entry.job] = jobs[entry.job].run({ now });
      lastRunDay[entry.job] = dayKey(now);
    } catch (err) {
      console.error(`[jobs] ${entry.job} falló:`, err.message);
    }
  });
  return summaries;
}

let timer = null;

function startJobs() {
  if (env.IS_TEST || timer) return false;
  tick();
  timer = setInterval(() => tick(), config.JOBS_INTERVAL_MS);
  timer.unref();
  return true;
}

function stopJobs() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  jobs,
  SCHEDULE,
  tick,
  startJobs,
  stopJobs,
  // Kept for existing callers (tests/foundation.test.js and the admin reminder endpoint).
  runReviewReminders: jobs.reviewReminder.runReviewReminders
};
