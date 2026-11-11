// Box lifecycle contract. Lists the box statuses that exist today in routes.js and
// logistics.js, the allowed transitions between them, and which roles may perform each one.
// Pure functions, no I/O: routes and jobs will call assertTransition() before changing a box
// (wiring is Phase 1b). Today the admin status setter and POST /api/boxes/simulate-step do
// not consult this graph yet; see docs/alignment/progress.md.

const STATUSES = Object.freeze({
  PROPOSED: 'PROPOSED', // armada por el motor, en la cola del estilista
  REJECTED: 'REJECTED', // propuesta descartada por el estilista (hoy la ruta regenera en PROPOSED)
  APPROVED: 'APPROVED', // aprobada por el estilista, lista para despacho
  CREATED: 'CREATED', // estado heredado anterior a HU-07, se trata como aprobada
  PREPARING: 'PREPARING', // en preparación y empaque en bodega
  SHIPPED: 'SHIPPED', // guía generada y paquete recogido
  DELIVERED: 'DELIVERED', // entregada al suscriptor
  RATED: 'RATED' // el suscriptor calificó las prendas
});

const ROLES = Object.freeze({
  CLIENT: 'CLIENT',
  STYLIST: 'STYLIST',
  ADMIN: 'ADMIN',
  WAREHOUSE: 'WAREHOUSE',
  SYSTEM: 'SYSTEM' // engine, scheduled jobs, carrier webhooks
});

const { PROPOSED, REJECTED, APPROVED, CREATED, PREPARING, SHIPPED, DELIVERED, RATED } = STATUSES;
const { CLIENT, STYLIST, ADMIN, WAREHOUSE, SYSTEM } = ROLES;

// from -> to -> roles allowed. Anything not listed is an invalid transition.
const TRANSITIONS = Object.freeze({
  [PROPOSED]: { [APPROVED]: [STYLIST, ADMIN], [REJECTED]: [STYLIST, ADMIN] },
  [REJECTED]: { [PROPOSED]: [SYSTEM] },
  [APPROVED]: { [PREPARING]: [ADMIN, WAREHOUSE], [SHIPPED]: [ADMIN, WAREHOUSE] },
  [CREATED]: { [PREPARING]: [ADMIN, WAREHOUSE], [SHIPPED]: [ADMIN, WAREHOUSE] },
  [PREPARING]: { [SHIPPED]: [ADMIN, WAREHOUSE] },
  [SHIPPED]: { [DELIVERED]: [ADMIN, WAREHOUSE, SYSTEM] },
  [DELIVERED]: { [RATED]: [CLIENT, SYSTEM] },
  [RATED]: {}
});

// A new box always starts as PROPOSED, created by the engine.
const INITIAL_STATUS = PROPOSED;

// Statuses where the box already passed stylist review (UNAPPROVED_STATUSES in routes.js).
const UNAPPROVED_STATUSES = Object.freeze([PROPOSED, REJECTED]);
const TERMINAL_STATUSES = Object.freeze([RATED]);

class BoxTransitionError extends Error {
  constructor(message, { from, to, role, reason }) {
    super(message);
    this.name = 'BoxTransitionError';
    this.code = 'INVALID_TRANSITION';
    this.status = 409;
    this.from = from;
    this.to = to;
    this.role = role;
    this.reason = reason; // UNKNOWN_STATUS | NOT_ALLOWED | ROLE_FORBIDDEN
  }
}

function isStatus(value) {
  return Object.prototype.hasOwnProperty.call(TRANSITIONS, value);
}

function nextStatuses(from) {
  return isStatus(from) ? Object.keys(TRANSITIONS[from]) : [];
}

function rolesFor(from, to) {
  return (isStatus(from) && TRANSITIONS[from][to]) || [];
}

// Explains why a transition is refused, or returns null when it is allowed.
// Without a role only the graph is checked.
function checkTransition(from, to, role) {
  if (!isStatus(from) || !isStatus(to)) return 'UNKNOWN_STATUS';
  const roles = TRANSITIONS[from][to];
  if (!roles) return 'NOT_ALLOWED';
  if (role !== undefined && !roles.includes(role)) return 'ROLE_FORBIDDEN';
  return null;
}

function canTransition(from, to, role) {
  return checkTransition(from, to, role) === null;
}

const MESSAGES = {
  UNKNOWN_STATUS: (from, to) => `Estado de caja desconocido (${from} → ${to}).`,
  NOT_ALLOWED: (from, to) => `La caja no puede pasar de ${from} a ${to}.`,
  ROLE_FORBIDDEN: (from, to, role) => `El rol ${role} no puede pasar una caja de ${from} a ${to}.`
};

function assertTransition(from, to, role) {
  const reason = checkTransition(from, to, role);
  if (reason) throw new BoxTransitionError(MESSAGES[reason](from, to, role), { from, to, role, reason });
}

module.exports = {
  STATUSES,
  ROLES,
  TRANSITIONS,
  INITIAL_STATUS,
  UNAPPROVED_STATUSES,
  TERMINAL_STATUSES,
  BoxTransitionError,
  isStatus,
  nextStatuses,
  rolesFor,
  checkTransition,
  canTransition,
  assertTransition
};
