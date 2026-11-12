# Stream B (verbatim, section 6 of the orchestration brief)

Acceptance criteria below are condensed from Jira's Gherkin. Name tests after the scenarios.
Keys: HU-xx are stories; SCRUM-nn are subtasks. "Jira says" is the declared status; the work is to make the code match or exceed it.

### Stream B: HU-01, HU-02, HU-04, HU-16 (accounts, consent, measures, data rights)
HU-01 Registro e inicio de sesión (SCRUM-14, Jira Finalizado). Acceptance: successful register creates the account and redirects to the style quiz; existing email shows "Este correo ya está registrado" and offers login or recovery; birth date under 18 is rejected with a clear message.
- SCRUM-15 UI: password recovery and email verification screens, birth date field, consent checkbox (see HU-02).
- SCRUM-16 register validation: email format, password policy, birth date >= 18, duplicate email with exact message and an `offer` hint (409), consent required.
- SCRUM-17 verify scrypt hashing kept; JWT per F5; add tests proving no plaintext password in the store and forged or expired tokens are rejected.
- SCRUM-18 email verification (random 32-byte token, stored hashed, expires in 24h) and password reset (1h, single use) through the mailer adapter; verified email is required before subscribing (HU-08), login stays allowed.
- SCRUM-19 tests: register (success, duplicate, underage, invalid email, weak password), login, verification, reset, rate limit.
HU-02 Consentimiento (SCRUM-20, Jira En revisión). Acceptance: the register form has an unchecked-by-default checkbox linking to the data policy; on acceptance the date, policy version and acceptance are stored; without consent registration fails with a message saying consent is mandatory.
- SCRUM-22 checkbox plus a `/politica-datos` page.
- SCRUM-23 `consents` collection (userId, policyVersion, acceptedAt) append-only.
- SCRUM-24 tests: blocked without consent, stored with version and timestamp.
- SCRUM-21 policy text: draft page labeled "BORRADOR pendiente de revisión legal", version from config. Not final legal text.
HU-04 Medidas y presupuesto (SCRUM-32, Jira Finalizado). Acceptance: after the quiz the user enters measures and usual sizes, saved and used to filter available garments; out-of-range values show a validation message and block continuing; the user selects plan and budget range, saved and used in curation.
- SCRUM-33 measuring guide in step 3 (text steps plus a simple inline SVG), no external images.
- SCRUM-34 server-side range validation with a shared range table (height 140 to 220 cm, weight 38 to 180 kg, reconcile the contradicting client limits), 422 with per-field messages, same ranges in the UI.
- SCRUM-35 move `BRAND_RUNS` to `backend/data/seed/size-equivalences.json`, add an admin endpoint to edit it, define and test the behavior for an unknown brand (documented fallback).
- SCRUM-36 secure storage: encrypt `measures` at rest with AES-256-GCM using `DATA_ENCRYPTION_KEY` (random IV per record, auth tag checked). Only STYLIST and ADMIN roles can read other users' measures. Test that the stored file does not contain plaintext measures.
- Missing item found by the audit: capture `budgetRange` (min, max COP) in onboarding and profile. Unify the field names so there is a single source of truth (`profile.measures`) read by the engine, onboarding and the profile page.
HU-16 Derechos del titular (SCRUM-100, Jira En curso). Acceptance: "Mis datos" shows personal, style and measures data and lets the user edit it; a signed-in user without pending charges can request account deletion and confirm, after which data is deleted or anonymized and a confirmation email is sent.
- SCRUM-101 "Mis datos": show real stored values (no defaults like 178 or "Zara"), edit through the same validated endpoints, save the name on the user, edit the fields the engine really reads.
- SCRUM-102 deletion: `DELETE /api/me` with password confirmation; blocked if there is a pending charge (uses the subscription state from D1, wire it in wave 2); anonymize user and profile, keep fiscal records (charges, invoices) as required for tax obligations, keep ratings anonymized; send confirmation email.
- SCRUM-103 export: `GET /api/me/export` returns all the user's data as JSON.
- SCRUM-104 `data_requests` log (type, requestedAt, resolvedAt, response time) and an admin list.


## Resultado de la re-auditoría (2026-11-10, main @ 2082654)

Trabaja SOLO las filas PARTIAL o MISSING del stream B en `docs/alignment/gap-analysis.md` (columna "Falta"). Las filas DONE no se tocan. Conserva los nombres y rutas actuales de Sprint 2 cuando cumplen la intención (por ejemplo, los estados de caja PROPOSED/APPROVED/PREPARING/SHIPPED/DELIVERED/RATED). Respeta el mapa de propiedad de archivos de `plan.md`.
