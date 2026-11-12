// Test helper over backend/lib/clock.js. freezeAt() stops time at a date and returns the
// clock so the test can advance it; withClock() runs a function at a date and always restores.
const clock = require('../../backend/lib/clock');

function freezeAt(value) {
  clock.set(value);
  return clock;
}

async function withClock(value, fn) {
  clock.set(value);
  try {
    return await fn(clock);
  } finally {
    clock.reset();
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = { clock, freezeAt, withClock, DAY_MS };
