# 00 — Hard constraints (verbatim, section 2 of the orchestration brief)

Parameters in force: `BASE_BRANCH: dev`, `INTEGRATION_BRANCH: integration/jira-alignment`, `PUSH: false`, `MAX_PARALLEL_AGENTS: 4`.

## 2. Hard constraints

Repo and process
- You have no Jira access. Do not try to reach Jira, and never use smart-commit syntax like `#done` or `#transition`.
- Work only on branches. Create `INTEGRATION_BRANCH` from `BASE_BRANCH`. Each workstream uses its own branch `feat/<stream>` in its own git worktree (sibling folder `..\wt-<stream>`). Never commit to `main`, and never commit directly to `BASE_BRANCH`.
- Never push, force-push, rewrite history, or run `git reset --hard` / `git clean -fdx` on shared work, unless `PUSH: true` is set (push still only to feature or integration branches).
- Do not set or modify git user config. Commits use whoever is configured.
- Conventional Commits, English, one commit per Jira subtask whenever possible. Format: `type(scope): subject` plus a body line `Refs: SCRUM-38` (use the subtask key, or the HU key for HU-level work). Types: feat, fix, test, refactor, docs, chore, ci, build. Scope is the domain (catalog, auth, consent, quiz, box, stylist, recsys, subscription, payments, fulfillment, ratings, returns, kpi, privacy, infra).
- Do not delete files that exist today without reporting it. In particular, do NOT delete the unserved prototype (`index.html` and `js/`). Port what is needed from it into `frontend/` + `backend/`, then add a note in the README that it is legacy and unserved. The team decides later whether to delete it.
- Do not install anything globally. Keep the project at zero runtime dependencies (Node 20 built-ins only: `http`, `crypto`, `fs`, `node:test`, `node:assert`). If a dependency is truly unavoidable, stop and ask first.
- Target environment: Windows + PowerShell. Use cross-platform Node scripts, no bash-only syntax, no symlinks. When you show commands, use PowerShell.

Code quality
- Readable for a small student team: small modules, descriptive names, short comments only where the why is not obvious, a one-paragraph header comment per module. English identifiers and comments. UI strings stay in Spanish.
- Keep the existing look and feel of the frontend (vanilla JS SPA, mobile first). No frameworks.
- Do not rewrite what works. Refactor only as specified in section 5.
- Do not leave dead code, commented-out blocks, hardcoded fallbacks that fabricate data (for example a fake average rating or a fake tracking number), or endpoints that let the client fake business events.

Data and security
- Never commit secrets, real credentials, real personal data, or real payment data. Never store or log card numbers. Never log request bodies of auth, payment or profile endpoints.
- External services (payment gateway, email, logistics carrier, e-invoicing provider) are implemented behind adapters with a fake/in-memory implementation. Do not invent real API keys or endpoints. Document in `docs/integrations.md` what real credentials and endpoints are needed.
- Legal and business content (privacy policy text, return policy text, brand agreements, stylist-validated rules) is NOT yours to invent as final. Provide clearly labeled drafts/placeholders ("BORRADOR pendiente de revisión legal" / "pendiente de validación del estilista") and make them configurable.
- Unknown business numbers: use the documented defaults in section 4 and list every assumption in the final report under "Assumptions to confirm".

Honesty
- A test that cannot fail is not evidence. A feature that works only with seed data or a simulate button is PARTIAL at best.
- If a task is blocked by another, say so, do what is possible behind an interface, and mark it BLOCKED-BY in the report.

## Definition of done (section 7 of the brief, included for workers)

Per subtask
1. A test derived from the acceptance scenario exists and fails first when feasible.
2. Implementation is in the served app (`frontend/` + `backend/`), not only in the legacy prototype.
3. The test passes and `node --test` passes in full.
4. One Conventional Commit with `Refs: SCRUM-nn`.
5. One line appended to `docs/alignment/progress.md` (format: `| SCRUM-nn | STATUS | <commit hash> | <test file> :: <test name> | note |`).

Per merge: full suite green on `INTEGRATION_BRANCH`. No new `console.assert`. No secrets (search the diff). No file in git that belongs to runtime data.
