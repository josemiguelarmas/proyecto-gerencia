# Interfaces after Phase 1 (read before starting a stream)

Base for wave 1: `integration/jira-alignment` @ the commit that adds this file. Suite: `npm test` (node --test tests/), 62/62 green.

## Layout
- Routes: `backend/routes/<domain>.js` (auth, config, catalog, profile, quiz, privacy, stylist, boxes, ratings, returns, warehouse, subscription, payments, admin) registered in `backend/routes/index.js`. Order: OPTIONS preflight, public routes, authentication, prefix role guard (`/api/stylist/` STYLIST+ADMIN, `/api/admin/` ADMIN), handler. A route entry may set `roles: [...]` and `forbidden: '<mensaje>'` to override the prefix guard. First match wins: do not add overlapping paths.
- Data: `backend/repos/<collection>.js` over `backend/repos/store.js` (atomic writes). Always read `store.data.<collection>` at call time; never cache the array. `backend/database.js` is a facade with the old API. First-boot seed in `backend/repos/bootstrap.js`; seeds in `backend/data/seed/`.
- Helpers: `backend/lib/http.js` (`sendJson`, `httpError(status,msg)`, `parseJsonBody(req,{limit})`, `readRawBody(req,{limit})`, `MAX_BODY_BYTES`, `CSV_IMPORT_MAX_BYTES`, `parseNow`), `backend/lib/validate.js` (`isEmail`, `passwordProblem`, `isIntInRange`, `isOneOf`, `pick`), `backend/lib/crypto.js` (password/token hashing, `newId`; stream B extends it), `backend/lib/clock.js` (injectable now), `backend/lib/rateLimit.js`, `backend/lib/accounts.js`, `backend/lib/boxes.js`.
- Auth: `backend/auth.js` exports `ROLES` (CLIENT, STYLIST, ADMIN, WAREHOUSE), `requireRole(...roles)`, `issueToken`, `verifyToken`, `authenticateRequest`, `revokeTokens(userId)`.
- Domain: `backend/domain/boxStateMachine.js` (current statuses PROPOSED, REJECTED, APPROVED, PREPARING, SHIPPED, DELIVERED, RATED; `canTransition`, `checkTransition`, `assertTransition` throws code INVALID_TRANSITION status 409), `backend/domain/subscriptionStateMachine.js` (re-exports billing.js), `backend/domain/vocab.js` (SIZES, CATEGORIES, STYLES, OCCASIONS).
- Config: `backend/config/env.js` (env, fail-fast secrets), `backend/config.js` (business rules). Business constants may be added to `backend/config.js`; keep additions in a clearly separated block per stream to ease merges.
- Adapters: `backend/adapters/{payments,mailer,logistics,invoicing}/index.js`. Payments: `tokenize`, `describeToken`, `charge`, `buildWebhook`, `verifyWebhook`; tokens `tok_ok`, `tok_declined`, `tok_flaky`. Invoicing: `issue`, `isDown`, `setDowntime`. Mailer: `send`, `list`, `sentInMemory()`, `clearMemory()`. Logistics: `createShipment`, `createReturnShipment`, `manualShipment({...})`, `addBusinessDays`.
- Jobs: `backend/jobs/<name>.js` each `{ name, run({ now }) }`; `backend/jobs/index.js` scheduler (off under NODE_ENV=test). Names: reviewReminder, recurringBilling, autoResume, invoiceRetry, feedback, boxBatch, kpiSnapshot (computes, not persisted), paymentReconciliation.
- Tests: `tests/helpers/server.js` `startServer({ privileged })` boots on an ephemeral port with a temp DATA_DIR; `await app.loginAs('ADMIN'|'STYLIST'|'WAREHOUSE'|'CLIENT')`. Clock helper in `tests/helpers/clock.js`. New tests go in `tests/<domain>.test.js`. `tests/api.test.js` is legacy: change it only when a behavior change forces it, and explain why in the commit body.
- Frontend: SPA scripts loaded by `frontend/index.html`; routing in `frontend/js/app.js`; API client `frontend/js/api.js`; admin tabs in `frontend/js/views/admin/<tab>.js` registered through `TCB.adminTabs` (`common.js`), shell `adminView.js`.

## Shared files (append-only, orchestrator resolves conflicts)
`backend/routes/index.js` (registration list), `backend/config.js`, `frontend/index.html` (script tags), `frontend/js/app.js` (routes), `frontend/js/api.js` (client methods), `frontend/js/views/adminView.js` (tab list), `README.md`, `.env.example`, `docs/integrations.md`, `docs/alignment/progress.md`. Only add lines; do not reorder or reformat existing ones.

## Known leftovers handed to streams
- Register/reset still use a 6-char password rule: stream B adopts `validate.passwordProblem`.
- Profile whitelist keeps `heightCm`, `weightKg`, etc.: stream B unifies on `profile.measures`.
- `PAYMENT_WEBHOOK_SECRET` has a dev fallback in `backend/config.js`: stream D1 makes it required when the provider is not simulated.
- `'4.8'` rating fallback in `backend/repos/adminReports.js` and admin summary card; made-up default measures in the admin clients tab: E1 (SCRUM-73) and B (SCRUM-101/36).
- `POST /api/boxes/simulate-step` still exists: E1 (SCRUM-64).
- Manual logistics route and warehouse UI: E1. KPI snapshot persistence: E2. Real reconciliation: D1.
