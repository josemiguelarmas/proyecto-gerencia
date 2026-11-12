// In-memory login rate limit (F5): at most LOGIN_MAX_FAILURES failed logins per e-mail + IP
// within LOGIN_WINDOW_MS. Further attempts are refused until the oldest failure leaves the
// window; a successful login clears the counter. Time comes from the injectable clock, and the
// state lives in this process only (it resets when the server restarts).
const clock = require('./clock');

const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const failures = new Map(); // key -> array of failure timestamps (ms)

function keyFor(email, ip) {
  return `${String(email || '').trim().toLowerCase()}|${ip || 'unknown'}`;
}

function recent(key) {
  const cutoff = clock.nowMs() - LOGIN_WINDOW_MS;
  const list = (failures.get(key) || []).filter(ts => ts > cutoff);
  if (list.length > 0) failures.set(key, list);
  else failures.delete(key);
  return list;
}

// Returns null when the attempt may proceed, or the seconds until the next allowed attempt.
function loginBlockedFor(email, ip) {
  const list = recent(keyFor(email, ip));
  if (list.length < LOGIN_MAX_FAILURES) return null;
  return Math.max(1, Math.ceil((list[0] + LOGIN_WINDOW_MS - clock.nowMs()) / 1000));
}

function recordLoginFailure(email, ip) {
  const key = keyFor(email, ip);
  failures.set(key, [...recent(key), clock.nowMs()]);
}

function clearLoginFailures(email, ip) {
  failures.delete(keyFor(email, ip));
}

function reset() {
  failures.clear();
}

module.exports = { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, loginBlockedFor, recordLoginFailure, clearLoginFailures, reset };
