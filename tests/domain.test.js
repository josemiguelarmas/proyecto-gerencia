// F8: domain contracts. Unit tests for the box state machine, the shared vocabulary and the
// subscription machine re-exported from billing.js. No server is started.
const fs = require('fs');
const os = require('os');
const path = require('path');

// billing.js loads the database on require: point it at a throwaway folder.
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tcb-domain-'));
['TCB_DB_FILE', 'TCB_OUTBOX_FILE', 'TCB_CATALOG_FILE'].forEach(name => delete process.env[name]);

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const box = require('../backend/domain/boxStateMachine');
const vocab = require('../backend/domain/vocab');
const subscription = require('../backend/domain/subscriptionStateMachine');
const config = require('../backend/config');
const billing = require('../backend/billing');

after(() => fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }));

const { STATUSES: S, ROLES: R } = box;

test('caja: los estados son los que usa el código hoy', () => {
  assert.deepEqual(Object.keys(S).sort(), ['APPROVED', 'CREATED', 'DELIVERED', 'PREPARING', 'PROPOSED', 'RATED', 'REJECTED', 'SHIPPED']);
  assert.equal(box.INITIAL_STATUS, 'PROPOSED');
  assert.deepEqual([...box.UNAPPROVED_STATUSES], ['PROPOSED', 'REJECTED']);
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'data', 'seed', 'db.json'), 'utf8'));
  seed.boxes.forEach(b => assert.ok(box.isStatus(b.status), `${b.id}: ${b.status}`));
});

test('caja: el camino feliz PROPOSED → RATED con el rol correcto en cada paso', () => {
  const path = [
    [S.PROPOSED, S.APPROVED, R.STYLIST],
    [S.APPROVED, S.PREPARING, R.WAREHOUSE],
    [S.PREPARING, S.SHIPPED, R.WAREHOUSE],
    [S.SHIPPED, S.DELIVERED, R.SYSTEM],
    [S.DELIVERED, S.RATED, R.CLIENT]
  ];
  path.forEach(([from, to, role]) => {
    assert.equal(box.canTransition(from, to, role), true, `${from} → ${to} (${role})`);
    assert.doesNotThrow(() => box.assertTransition(from, to, role));
  });
});

test('caja: el admin puede despachar directo desde APPROVED y desde el estado heredado CREATED', () => {
  assert.ok(box.canTransition(S.APPROVED, S.SHIPPED, R.ADMIN));
  assert.ok(box.canTransition(S.CREATED, S.PREPARING, R.ADMIN));
  assert.ok(box.canTransition(S.CREATED, S.SHIPPED, R.WAREHOUSE));
});

test('caja: saltos y retrocesos son INVALID_TRANSITION', () => {
  const invalid = [
    [S.PROPOSED, S.SHIPPED], // sin aprobación del estilista
    [S.PROPOSED, S.DELIVERED],
    [S.APPROVED, S.DELIVERED], // sin guía
    [S.SHIPPED, S.PREPARING], // retroceso
    [S.DELIVERED, S.SHIPPED],
    [S.RATED, S.DELIVERED], // estado final
    [S.APPROVED, S.PROPOSED]
  ];
  invalid.forEach(([from, to]) => {
    assert.equal(box.canTransition(from, to), false, `${from} → ${to}`);
    assert.throws(() => box.assertTransition(from, to, R.ADMIN), err => {
      assert.ok(err instanceof box.BoxTransitionError);
      assert.equal(err.code, 'INVALID_TRANSITION');
      assert.equal(err.reason, 'NOT_ALLOWED');
      assert.equal(err.status, 409);
      assert.equal(err.from, from);
      assert.equal(err.to, to);
      return true;
    });
  });
  assert.deepEqual(box.nextStatuses(S.RATED), []);
});

test('caja: cada transición la hace solo el rol autorizado', () => {
  assert.equal(box.checkTransition(S.PROPOSED, S.APPROVED, R.CLIENT), 'ROLE_FORBIDDEN');
  assert.equal(box.checkTransition(S.PROPOSED, S.APPROVED, R.WAREHOUSE), 'ROLE_FORBIDDEN');
  assert.equal(box.checkTransition(S.APPROVED, S.PREPARING, R.CLIENT), 'ROLE_FORBIDDEN', 'el cliente no mueve su caja en bodega');
  assert.equal(box.checkTransition(S.APPROVED, S.PREPARING, R.STYLIST), 'ROLE_FORBIDDEN');
  assert.equal(box.checkTransition(S.SHIPPED, S.DELIVERED, R.CLIENT), 'ROLE_FORBIDDEN');
  assert.equal(box.checkTransition(S.DELIVERED, S.RATED, R.ADMIN), 'ROLE_FORBIDDEN', 'solo el suscriptor califica');
  assert.equal(box.checkTransition(S.REJECTED, S.PROPOSED, R.STYLIST), 'ROLE_FORBIDDEN', 'la nueva propuesta la arma el motor');
  assert.throws(() => box.assertTransition(S.PROPOSED, S.APPROVED, R.CLIENT), { code: 'INVALID_TRANSITION', reason: 'ROLE_FORBIDDEN' });
  assert.deepEqual(box.rolesFor(S.PROPOSED, S.APPROVED), ['STYLIST', 'ADMIN']);
});

test('caja: estados desconocidos se rechazan con mensaje en español', () => {
  assert.equal(box.checkTransition('IN_TRANSIT', S.DELIVERED), 'UNKNOWN_STATUS');
  assert.equal(box.checkTransition(S.SHIPPED, 'LOST'), 'UNKNOWN_STATUS');
  assert.throws(() => box.assertTransition(S.SHIPPED, 'LOST', R.ADMIN), /Estado de caja desconocido/);
  assert.equal(box.isStatus('toString'), false);
});

test('caja: el grafo está congelado', () => {
  assert.ok(Object.isFrozen(box.TRANSITIONS) && Object.isFrozen(S) && Object.isFrozen(R));
});

test('vocabulario: una sola fuente en config.js', () => {
  assert.equal(vocab.SIZES, config.SIZES);
  assert.equal(vocab.CATEGORIES, config.CATEGORIES);
  assert.equal(vocab.STYLES, config.STYLES);
  assert.equal(vocab.OCCASIONS, config.OCCASIONS);
  assert.ok(vocab.isSize('M') && !vocab.isSize('m'));
  assert.ok(vocab.isCategory('capa') && !vocab.isCategory('zapatos'));
  assert.ok(vocab.isStyle('urbano') && !vocab.isStyle('gótico'));
  assert.ok(vocab.isOccasion('entrevista') && !vocab.isOccasion('boda'));
});

test('suscripción: reexporta las reglas de billing.js sin copiarlas', () => {
  assert.equal(subscription.TRANSITIONS, billing.TRANSITIONS);
  assert.equal(subscription.canTransition, billing.canTransition);
  assert.ok(subscription.canTransition('ACTIVE', 'pause'));
  assert.ok(!subscription.canTransition('CANCELLED', 'pause'));
  assert.ok(subscription.canTransition('PAST_DUE', 'cancel'));
  assert.throws(() => subscription.assertTransition({ status: 'PAUSED' }, 'pause'), { code: 'INVALID_TRANSITION' });
  const used = new Set(Object.values(billing.TRANSITIONS).flatMap(t => t.from));
  used.forEach(status => assert.ok(subscription.STATUSES[status], `estado ${status} sin declarar`));
});
