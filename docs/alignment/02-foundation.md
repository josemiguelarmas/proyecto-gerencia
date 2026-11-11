# 02 — Foundation (verbatim, section 5 of the orchestration brief)

## 5. Phase 1: foundation tasks (F1 to F10, sequential)

F1 Test runner. Replace `console.assert` with `node:test` + `node:assert/strict`. Run with `node --test` (files named `*.test.js` under `tests/`). Port the 15 existing tests, make test 14 unconditional by creating its own fixtures. Each test file boots the server on an ephemeral port with its own temp `DATA_DIR`. Add a clock injection helper for time-dependent tests. `npm test` must exit non-zero on failure.

F2 Config. `backend/config/index.js` reads env: `PORT`, `DATA_DIR` (default `backend/data/runtime`, git-ignored), `JWT_SECRET` and `DATA_ENCRYPTION_KEY` (required unless `NODE_ENV=test`, fail fast with a clear message), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGINS`, `PAYMENT_WEBHOOK_SECRET`, `POLICY_VERSION`. Provide `.env.example` and a README section for PowerShell (`$env:JWT_SECRET = "..."`). Seeds (catalog, quiz, rules, size equivalences) live in `backend/data/seed/` and are committed; runtime data never is.

F3 Data hygiene. `git rm --cached backend/data/db.json`, add `backend/data/runtime/` and `.env` to `.gitignore`, move `catalog.json` to `backend/data/seed/`. Note in the report that the git history still contains test personal data and the old admin credentials; recommend the team rotates them. Do not rewrite history.

F4 Structure (no behavior change, protected by the ported tests). Split `routes.js` into `backend/routes/<domain>.js` (auth, profile, catalog, boxes, stylist, ratings, returns, admin) behind a tiny router; split `database.js` into `backend/repos/<collection>.js` over a single store module with atomic writes (write temp file then rename). Goal: parallel workstreams touch different files.

F5 Security baseline. JWT HS256 implemented with `crypto` and `timingSafeEqual`, secret from config, expiry configurable (default 8h), `iss`/`aud` checked. Admin seeded from env only, only if absent. Remove every credential from `frontend/` and README. CORS allow-list. Body size limit (100 KB, 2 MB for CSV import). Central validator module (`backend/lib/validate.js`) and a whitelist for profile fields. In-memory login rate limit (5 failures per 15 min per email+IP). Security headers (`X-Content-Type-Options`, `Referrer-Policy`, a basic CSP for the SPA). Roles: CLIENT, STYLIST, ADMIN, WAREHOUSE with a `requireRole` middleware.

F6 Adapters with fakes: `backend/adapters/{payments,mailer,logistics,invoicing}/index.js` each exporting an interface plus an in-memory/fake implementation selected by config. Mailer writes JSON files to `DATA_DIR/outbox/` and keeps an in-memory list for tests. Fake payments accept tokens `tok_ok`, `tok_declined`, `tok_flaky` (fails first N charges). Fake invoicing has a switch to simulate provider downtime. Logistics is manual (admin/warehouse enters carrier and tracking number).

F7 Jobs. `backend/jobs/*.js`: each job is an exported pure-ish function `run({ now, store, adapters })`, started by `server.js` on intervals (disabled when `NODE_ENV=test`). Jobs: monthly box batch, rating reminder, payment retry, subscription auto-resume, invoice retry, KPI snapshot, payment reconciliation, feedback ingestion.

F8 Domain contracts, so streams agree: `backend/domain/boxStateMachine.js` (DRAFT -> PENDING_REVIEW -> APPROVED ("Lista para despacho") -> DISPATCHED -> IN_TRANSIT -> DELIVERED, plus REJECTED; guards for who may do each transition), `backend/domain/subscriptionStateMachine.js` (PENDING, ACTIVE, PAUSED, PAST_DUE, CANCELLED), `backend/domain/vocab.js` (style and occasion vocabulary, categories, sizes), `backend/config/business.js` (section 4 constants, `PLAN_CONFIG`). Pure functions with unit tests.

F9 CI. `.github/workflows/ci.yml` running `node --test` on Node 20 for ubuntu and windows. Add a `Dockerfile` and `docs/staging.md` (steps and required env vars; do not deploy anything, do not include credentials).

F10 Docs skeleton: `docs/integrations.md`, `docs/kpi-definitions.md` (stub), `docs/alignment/progress.md`.

Gate for Phase 1: suite green, deliberate-failure proof done, server boots with only env vars set, no secret or credential string remains in the repo (grep for the old admin password, the old JWT fallback, and the hardcoded demo credentials).
