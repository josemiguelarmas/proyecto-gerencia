# 01 — Project context (verbatim, section 4 of the orchestration brief)

> **Actualizado 2026-11-10 (re-auditoría):** la base real es `main` @ `2082654`, que ya incluye Sprint 2 (HU-01 a HU-17, 70 pruebas con assert en verde). Los "Repo facts" de abajo describen la línea base vieja (`dev` @ `217752c`). El estado actual de cada defecto y subtarea está en `gap-analysis.md`.

## 4. Project context (what exists, what Jira claims)

Product
- Subscription box for people 18 to 30. Plans: Esencial (3 garments, COP 129.900 per month) and Estilo (5 garments, COP 199.900 per month). Hybrid curation: rule/AI engine proposes, a human stylist approves. No box ships without stylist approval and confirmed payment.
- Business constants (use as config in `backend/config/business.js`, not scattered literals): payment commission 3.5%; return/exchange window 5 business days after delivery; target average rating >= 4.0; quiz completion goal about 3 minutes; churn alert threshold 9% monthly; returns-by-size goal <= 10%; minimum age 18; password min 8 chars with letter and number.
- Unknown, assume and flag: target garment cost per plan (`PLAN_CONFIG[plan].targetCost`, default 40% of plan price), billing cutoff days before charge (default 5), payment retry schedule (default +1, +3, +5 days then PAST_DUE), pause length (1 month), business-day calendar (Mon to Fri plus a small config list of Colombian holidays).

Repo facts (from the audit of branch `dev` @ 217752c)
- Stack: Node 20, plain `http` module, no framework, no dependencies, vanilla JS SPA. Persistence is one JSON file (`backend/data/db.json`) via `backend/database.js`; routes in `backend/routes.js`; auth in `backend/auth.js`; recommendation in `backend/engine.js`; catalog in `backend/data/catalog.json` (18 items); frontend in `frontend/js/` (views such as `authView.js`, `onboardingView.js`, `boxView.js`, `profileView.js`, `returnsView.js`, `adminView.js`), API client `frontend/js/api.js`.
- Only 2 commits exist, both by one person on 2026-11-03. The code is an import of an earlier course prototype. No CI, no config files, no Dockerfile.
- There are TWO apps. The served one is `frontend/` + `backend/` (`npm start`, `backend/server.js`). The other, root `index.html` + `js/` (localStorage only, no backend), is NOT served. Several "done" Jira items exist only in that unserved prototype (quiz, subscription pause/cancel, exit survey).
- `npm test` is invalid: `tests/api.test.js` uses `console.assert` (never fails, exit 0) and test 14 is conditional. Test runs write into the committed `db.json`, which now holds 10 `test_*@test.com` users among 12.
- Known defects to fix (all in scope): hardcoded JWT secret fallback (`auth.js:4`), non-constant-time signature compare, 72h tokens without revocation; admin demo password (redacted) re-seeded on boot (`database.js:66-80`) and credentials hardcoded in `authView.js`, `adminView.js`, README; CORS `*`; no email format validation (register accepts `"not-an-email"`); profile endpoint spreads raw body into the record (`routes.js:207`, mass assignment); measures stored in plaintext in a git-tracked file and exposed to the admin clients endpoint; no server-side range validation for measures; rating score defaults silently to 4 when missing; hardcoded `'4.8'` KPI fallback; hardcoded tracking number `'TCB-CALI-7829-X'` in `boxView.js:145`; `POST /api/boxes/simulate-step` lets the client mark its own box delivered; admin status setter accepts any transition and returns 200 for unknown ids; the profile page shows default values (178 cm, "Zara") and writes fields the engine never reads (`heightCm` vs `measures.height`); boxes are generated on profile save instead of by a monthly batch; no stock/variant fields; budget is never captured; no stylist role.

## Dependencies between streams (from section 3)
- Foundation before everything.
- HU-05 stock model (A) before HU-06 filters, HU-09 stock decrement, HU-14 inventory re-entry.
- HU-08 subscriptions and payments (D1) before HU-09 payment-gated dispatch, HU-12, HU-15, HU-16 deletion rules, HU-17 churn.
- HU-07 box state machine (C1) before HU-09 and HU-14.
- HU-10 ratings model (E1) before HU-11.
