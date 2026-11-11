// F1: checks the shared test helpers. The server boots on an ephemeral port with its own
// temporary data, and backend code that reads backend/lib/clock.js follows the injected time.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { startServer } = require('./helpers/server');
const { clock, withClock, DAY_MS } = require('./helpers/clock');

let app;

before(async () => {
  // Frozen one day after the seed box_003 was delivered, so the boot-time reminder job skips it.
  clock.set('2026-10-03T12:00:00.000Z');
  app = await startServer();
});

after(async () => {
  clock.reset();
  await app.close();
});

test('el servidor de prueba usa un puerto efímero y una carpeta de datos temporal', async () => {
  assert.ok(app.port > 0 && app.port !== 3000 && app.port !== 3199);
  const repoData = path.join(__dirname, '..', 'backend', 'data');
  assert.ok(!path.resolve(process.env.TCB_DB_FILE).startsWith(repoData), 'la base de prueba no vive en el repo');
  const res = await app.get('/api/config');
  assert.equal(res.status, 200);
  assert.ok(res.body && typeof res.body === 'object');
});

test('el cliente HTTP devuelve el estado y el cuerpo JSON de errores', async () => {
  const res = await app.get('/api/profile');
  assert.equal(res.status, 401);
});

test('el reloj inyectado controla el recordatorio de calificación', async () => {
  const jobs = require('../backend/jobs');
  const { db } = require('../backend/database');
  const box = db.data.boxes.find(b => b.id === 'box_003');
  assert.equal(box.status, 'DELIVERED');
  assert.equal(box.reminderSentAt, undefined, 'al arrancar el reloj marcaba 1 día después de la entrega');

  assert.equal(jobs.runReviewReminders().sent, 0);
  clock.advance(3 * DAY_MS);
  const result = jobs.runReviewReminders();
  assert.deepEqual(result.boxIds, ['box_003']);
  assert.equal(box.reminderSentAt, '2026-10-06T12:00:00.000Z');
});

test('withClock restaura el reloj real al terminar', async () => {
  clock.reset();
  await withClock('2030-01-01T00:00:00.000Z', c => {
    assert.equal(c.now().toISOString(), '2030-01-01T00:00:00.000Z');
  });
  assert.equal(clock.isFrozen(), false);
  assert.ok(Math.abs(clock.nowMs() - Date.now()) < 1000);
});
