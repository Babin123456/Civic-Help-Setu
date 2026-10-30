# Catalogue data migrations

As service records gain structured fields (jurisdiction, requirement lists, intake windows), older saved
records can be left in a mixed format. This utility brings them up to date in a way you can preview, back up
and undo. It lives in `src/services/catalogueMigration.js`; the admin screen is **Data Migrations**.

It is deliberately separate from CSV/JSON import (`serviceImportService`), which validates *new* records.

## Scope

- **Only** the guides the admin dashboard saved (`civicbridge_custom_services`). The built-in guides live in code and are
  not touched.
- It never reads or writes citizen data: profiles, the document vault, saved items and the rest are outside it. A test
  checks that only the catalogue and its backup key are used.
- **Nothing runs automatically.** Importing the module does nothing. Every entry point is an explicit action that needs the
  `catalogue.migrate` permission (admin), and applying or rolling back also needs `confirm: true` (the screen asks first).

## The migrations

Each has a version, an id and a documented transformation. They run in order. A new one gets the next version and is added
at the end; existing ones are never reordered or rewritten.

| Version | Id | Transformation |
|---|---|---|
| 1 | `jurisdiction-structured` | Plain-text `jurisdiction` becomes `{ level, states, districts, localBody }`. Only a text that is exactly a state or Union Territory name (ignoring case and spacing) is converted, to `{ level: 'state', states: [name] }`. Empty text removes the field ("not specified"). An object is completed and cleaned; unknown keys inside it are kept. |
| 2 | `requirement-lists` | `documents` and `eligibility` written as one text block become lists, one item per line. Items are trimmed and empty ones removed. |
| 3 | `intake-window-notice` | `noticeTitle` and `noticeUrl` on an intake window move into `notice: { title, url }`. An existing `notice` is kept. |

Text such as "India" or a district name is **not** converted. The app treats a missing or unclear scope as "unknown" and never
as nationwide, so guessing here would change who is told a service is available. Those records are reported for a maintainer
to fix by hand.

## Guarantees

- **Deterministic and idempotent.** Each migration is a pure function of one record. Running them on their own output
  changes nothing, so running twice never duplicates or further mutates a field. A second apply finds nothing to change, writes
  nothing and takes no backup.
- **Unknown fields are preserved.** Fields outside the documented contract (`KNOWN_FIELDS`) are kept as they are and listed
  in the report.
- **Invalid records are skipped and reported.** A record a migration cannot convert with certainty (unusable value, missing id
  or name, an entry that is not an object) is left exactly as it was and shown in the report with the reason. It is never
  dropped.
- **Dry run never writes.** It reports total, changed, unchanged and invalid counts, how many records each migration would
  touch, and what would change per record.
- **Backup before write.** Applying saves a snapshot of the stored catalogue first and stops if that fails. It then writes
  once and checks what it wrote; on a failed write it puts the original text back.
- **Rollback is exact.** Rolling back restores the stored catalogue byte for byte from a snapshot (after checking it is
  undamaged), and first snapshots the current state, so a rollback can itself be undone. The last 5 snapshots are kept
  (`civicbridge_catalogue_snapshots_v1`, listed in `DATA_RETENTION.md`).
- **Audit trail.** Applying and rolling back add `CATALOGUE_MIGRATED` and `CATALOGUE_ROLLED_BACK` entries.

## Running one

1. Admin, **Data Migrations**, **Download a copy of the catalogue** (optional extra copy).
2. **Run dry run**. Read the counts and the table of records that would change or be skipped.
3. **Apply migration…**, then **Confirm and apply**.
4. If something looks wrong, **Roll back…** on the backup listed under Backups.

## Adding a migration

1. Append `{ version: N, id, title, description, run }` to `MIGRATIONS`. `run(record)` returns `{ record, notes }` (a new object)
   or throws a `MigrationError` for a record it cannot convert.
2. Do not read the clock, random values or storage in `run`.
3. Add tests that prove it is idempotent and leaves unrelated fields alone, and a row to the table above.

## Limits

Storage is the browser's localStorage, so a migration applies to the catalogue saved in that browser only, and developer tools
can still edit it (see `ACCESS_CONTROL.md`). Snapshots share the browser's storage quota; if a backup cannot be saved, the
migration does not run.
