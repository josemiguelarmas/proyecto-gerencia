// Injectable clock. Backend code that needs "now" calls clock.now() instead of new Date(),
// so tests can freeze or move time without waiting. In production it is the system clock.
// Existing Sprint 2 code still uses Date directly; new code should use this module.

let fixedMs = null;

function now() {
  return fixedMs === null ? new Date() : new Date(fixedMs);
}

function nowMs() {
  return now().getTime();
}

// Freezes the clock at a date, an ISO string or epoch milliseconds.
function set(value) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(ms)) throw new Error(`clock.set: fecha inválida (${value})`);
  fixedMs = ms;
}

// Moves a frozen clock forward (or back with a negative value).
function advance(ms) {
  if (fixedMs === null) throw new Error('clock.advance: primero congela el reloj con clock.set()');
  fixedMs += ms;
}

function reset() {
  fixedMs = null;
}

function isFrozen() {
  return fixedMs !== null;
}

module.exports = { now, nowMs, set, advance, reset, isFrozen };
