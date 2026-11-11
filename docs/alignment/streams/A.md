# Stream A (verbatim, section 6 of the orchestration brief)

Acceptance criteria below are condensed from Jira's Gherkin. Name tests after the scenarios.
Keys: HU-xx are stories; SCRUM-nn are subtasks. "Jira says" is the declared status; the work is to make the code match or exceed it.

### Stream A: HU-05 Catalog of allied brands (SCRUM-37)
Jira says: En curso. Subtasks 40, 41 Finalizado; 38, 39, 42 Por hacer.
Acceptance: (1) an authenticated admin uploads a CSV with garments, sizes, colors, wholesale price, stock; valid garments become available and the admin sees a report of rows with errors. (2) a garment with stock 0 is never selected by the engine.
- SCRUM-38 data model: Brand, Product, Variant (sku, size, color, stock, reserved, wholesalePrice, retailPrice). Migrate the 18 catalog items into it with sensible default stock. Stock is a non-negative integer. Available = stock - reserved. Reserve on box approval, decrement on dispatch, release on rejection (the decrement and release logic itself is delivered in E1/C1 through repo functions you define here: `reserve`, `release`, `consume`, `restock`, each writing an `inventory_movements` record with reason).
- SCRUM-39 CSV importer `POST /api/admin/catalog/import` (text/csv body): quoted fields, validation per row and field, upsert by sku, response `{imported, updated, errors:[{row, field, message}]}`; valid rows are imported even if others fail. Fixtures: good file, mixed file, malformed file.
- SCRUM-40 full CRUD including soft delete, and the admin UI wired to it (`api.admin.saveProduct` exists but is never called; the products tab is read-only today). Add the CSV upload UI and the error report view.
- SCRUM-41 style tagging per product through the admin UI using the controlled vocabulary from `domain/vocab.js`, validated server-side.
- SCRUM-42 (business task): write `docs/data-contract-brands.md` describing the CSV columns and rules brands must deliver. No code.


## Resultado de la re-auditoría (2026-11-10, main @ 2082654)

Trabaja SOLO las filas PARTIAL o MISSING del stream A en `docs/alignment/gap-analysis.md` (columna "Falta"). Las filas DONE no se tocan. Conserva los nombres y rutas actuales de Sprint 2 cuando cumplen la intención (por ejemplo, los estados de caja PROPOSED/APPROVED/PREPARING/SHIPPED/DELIVERED/RATED). Respeta el mapa de propiedad de archivos de `plan.md`.
