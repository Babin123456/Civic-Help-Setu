/**
 * Versioned, repeatable migrations for the saved service catalogue.
 *
 * Scope: only the records the admin dashboard saved (`civicbridge_custom_services`). Nothing here reads or
 * writes profiles, the document vault, or any other key. The built-in guides live in code and are not touched.
 *
 * Rules:
 *  - Each migration is a pure function of one record (no clock, no randomness, no storage), so the same input
 *    always gives the same output, and running a migration on its own output changes nothing.
 *  - A dry run (`planMigration`) never writes. It reports changed / unchanged / invalid counts and, per record,
 *    what would change.
 *  - A record a migration cannot convert with certainty is reported as invalid and left exactly as it is. It is
 *    never dropped and never guessed.
 *  - Fields the migrations do not know are kept as they are and listed in the report.
 *  - `applyMigration` needs `confirm: true`, takes a snapshot of the stored catalogue first, writes once, and
 *    checks what it wrote. `rollbackToSnapshot` puts the stored catalogue back byte for byte.
 *  - Nothing runs automatically: every entry point is an explicit, permission-checked admin action.
 *
 * Kept separate from CSV/JSON import validation (serviceImportService). Docs: docs/CATALOGUE_MIGRATIONS.md
 */
import { requirePermission, actorLabel } from './accessControl';
import { CUSTOM_SERVICES_KEY } from './serviceCatalog';
import { addAuditLog } from './adminService';
import { INDIAN_STATES_AND_UTS } from '../data/jurisdictions';
import { normalizeJurisdiction } from './jurisdictionService';

export const CATALOGUE_KEY = CUSTOM_SERVICES_KEY;
export const SNAPSHOTS_KEY = 'civicbridge_catalogue_snapshots_v1';
export const MAX_SNAPSHOTS = 5;
export const SNAPSHOT_FORMAT = 'civicbridge-catalogue-snapshot';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

const without = (record, key) => Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

// Same JSON text whatever the key order, so two equal objects compare equal.
const stable = (value) => JSON.stringify(value, (_k, v) => (isObject(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));

class MigrationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MigrationError';
  }
}

// ---- the migrations -------------------------------------------------------------------------------

const stateByName = (name) => INDIAN_STATES_AND_UTS.find((s) => s.toLowerCase() === clean(name).toLowerCase());

/**
 * v1 jurisdiction-structured
 *   A plain-text `jurisdiction` becomes { level, states, districts, localBody }.
 *   - exactly a state or Union Territory name  -> { level: 'state', states: [that name] }
 *   - empty text                               -> the field is removed (not specified)
 *   - anything else, e.g. "India" or "Pune"    -> error: the scope cannot be known, so a maintainer decides
 *   An object is cleaned with the app's own normalizer; one with no valid level is an error.
 */
const jurisdictionStructured = (record) => {
  if (!('jurisdiction' in record)) return { record, notes: [] };
  const value = record.jurisdiction;
  if (value === null || value === undefined) {
    return { record: without(record, 'jurisdiction'), notes: ['jurisdiction: removed an empty value'] };
  }
  if (typeof value === 'string') {
    if (!clean(value)) {
      return { record: without(record, 'jurisdiction'), notes: ['jurisdiction: removed empty text (not specified)'] };
    }
    const state = stateByName(value);
    if (!state) {
      throw new MigrationError(`jurisdiction "${clean(value)}" is not a state or Union Territory name, so its scope cannot be set automatically`);
    }
    return { record: { ...record, jurisdiction: { level: 'state', states: [state], districts: [], localBody: '' } }, notes: [`jurisdiction: "${clean(value)}" became a state-level scope`] };
  }
  if (isObject(value)) {
    const normalized = normalizeJurisdiction(value);
    if (!normalized) throw new MigrationError('jurisdiction has no valid level (national, state, district or local)');
    // keys the app does not know are kept
    const extras = Object.fromEntries(Object.entries(value).filter(([k]) => !['level', 'states', 'districts', 'localBody'].includes(k)));
    const merged = { ...normalized, ...extras };
    if (stable(merged) === stable(value)) return { record, notes: [] };
    return { record: { ...record, jurisdiction: merged }, notes: ['jurisdiction: completed or cleaned the structured fields'] };
  }
  throw new MigrationError('jurisdiction must be text or an object');
};

/**
 * v2 requirement-lists
 *   `documents` and `eligibility` are lists of text. Text with one item per line becomes a list; list items are
 *   trimmed and empty ones removed. A list item that is not text is an error (it would have to be guessed).
 */
const requirementLists = (record) => {
  let next = record;
  const notes = [];
  for (const field of ['documents', 'eligibility']) {
    if (!(field in record)) continue;
    const value = record[field];
    let list;
    if (typeof value === 'string') list = value.split(/\r?\n/);
    else if (Array.isArray(value)) list = value;
    else throw new MigrationError(`${field} must be text or a list`);
    if (list.some((item) => typeof item !== 'string')) throw new MigrationError(`${field} has an item that is not text`);
    const cleaned = list.map((item) => item.trim()).filter(Boolean);
    if (stable(cleaned) !== stable(value)) {
      next = { ...next, [field]: cleaned };
      notes.push(`${field}: ${typeof value === 'string' ? 'split text into a list' : 'trimmed items'} (${cleaned.length} item${cleaned.length === 1 ? '' : 's'})`);
    }
  }
  return { record: next, notes };
};

/**
 * v3 intake-window-notice
 *   In an intake window, the flat `noticeTitle` / `noticeUrl` move into `notice: { title, url }`. A window that
 *   already has `notice` keeps it; the flat fields are removed only when they are empty or copied into `notice`.
 */
const intakeWindowNotice = (record) => {
  if (!('intakeWindows' in record)) return { record, notes: [] };
  const windows = record.intakeWindows;
  if (!Array.isArray(windows)) throw new MigrationError('intakeWindows must be a list');
  let changed = 0;
  const next = windows.map((w, i) => {
    if (!isObject(w)) throw new MigrationError(`intakeWindows[${i}] must be an object`);
    if (!('noticeTitle' in w) && !('noticeUrl' in w)) return w;
    const { noticeTitle, noticeUrl, ...rest } = w;
    const title = clean(noticeTitle);
    const url = clean(noticeUrl);
    const existing = isObject(rest.notice) ? rest.notice : null;
    changed += 1;
    if (existing) {
      const merged = { ...existing };
      if (!clean(existing.title) && title) merged.title = title;
      if (!clean(existing.url) && url) merged.url = url;
      return { ...rest, notice: merged };
    }
    return { ...rest, notice: { title, url } };
  });
  if (changed === 0) return { record, notes: [] };
  return { record: { ...record, intakeWindows: next }, notes: [`intakeWindows: moved the notice into a nested field in ${changed} round${changed === 1 ? '' : 's'}`] };
};

/** Every migration, in the order it runs. A new one gets the next version and is appended, never inserted. */
export const MIGRATIONS = Object.freeze([
  { version: 1, id: 'jurisdiction-structured', title: 'Structured jurisdiction', run: jurisdictionStructured,
    description: 'Plain-text jurisdiction becomes { level, states, districts, localBody }. Only an exact state or Union Territory name is converted; other text is reported for a maintainer to decide.' },
  { version: 2, id: 'requirement-lists', title: 'Requirement lists', run: requirementLists,
    description: 'Documents and eligibility entered as one text block become lists, one item per line; items are trimmed and empty ones removed.' },
  { version: 3, id: 'intake-window-notice', title: 'Intake window notice', run: intakeWindowNotice,
    description: 'noticeTitle and noticeUrl on an intake window move into notice: { title, url }.' },
]);

export const CURRENT_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** Fields the catalogue contract documents. Anything else is kept as it is and reported. */
export const KNOWN_FIELDS = Object.freeze([
  'id', 'name', 'shortDescription', 'category', 'department', 'type', 'difficulty', 'feeType', 'speedDays', 'eligibility', 'documents',
  'fees', 'processingTime', 'lastVerified', 'steps', 'officialSources', 'warnings', 'popularityScore', 'eligibilityRuleKey', 'jurisdiction',
  'publicationState', 'contacts', 'intakeWindows', 'archived', 'archivedAt', 'archivedBy', 'archiveReason', 'rating', 'tags',
]);

// ---- one record -----------------------------------------------------------------------------------

const isUsable = (record) => isObject(record) && typeof record.id === 'string' && record.id.trim() !== '' && typeof record.name === 'string';

/**
 * Migrates one record. Never mutates the input and never throws.
 * @returns {{ status: 'changed'|'unchanged'|'invalid', record: object, changes: string[], errors: {migration:string, message:string}[], unknownFields: string[] }}
 *   For an invalid record, `record` is the input, untouched.
 */
export function migrateRecord(input) {
  if (!isUsable(input)) {
    return { status: 'invalid', record: input, changes: [], errors: [{ migration: '-', message: 'not a service record (needs a text id and name)' }], unknownFields: [] };
  }
  const unknownFields = Object.keys(input).filter((k) => !KNOWN_FIELDS.includes(k));
  let current = structuredClone(input);
  const changes = [];
  const errors = [];
  for (const migration of MIGRATIONS) {
    try {
      const result = migration.run(current);
      current = result.record;
      for (const note of result.notes) changes.push(`v${migration.version} ${migration.id}: ${note}`);
    } catch (error) {
      errors.push({ migration: migration.id, message: error.message });
    }
  }
  if (errors.length) return { status: 'invalid', record: input, changes: [], errors, unknownFields };
  return { status: changes.length ? 'changed' : 'unchanged', record: changes.length ? current : input, changes, errors: [], unknownFields };
}

// ---- reading and planning ---------------------------------------------------------------------------

const getStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readCatalogue = (storage) => {
  if (!storage) throw new MigrationError('Browser storage is not available.');
  const raw = storage.getItem(CATALOGUE_KEY);
  if (raw === null) return { raw: null, records: [] };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MigrationError('The saved catalogue is not valid JSON, so nothing was changed. Export it from the browser and repair it first.');
  }
  if (!Array.isArray(parsed)) throw new MigrationError('The saved catalogue is not a list of records, so nothing was changed.');
  return { raw, records: parsed };
};

/**
 * Dry run. Reads the saved catalogue and reports what the migrations would do. Writes nothing, ever.
 * @returns {{ toVersion, total, changed, unchanged, invalid, perMigration, records, unknownFieldNames }}
 */
export function planMigration({ storage = getStorage() } = {}) {
  requirePermission('catalogue.migrate');
  const { records } = readCatalogue(storage);
  const entries = records.map((original, index) => {
    const result = migrateRecord(original);
    return { index, id: isObject(original) && typeof original.id === 'string' ? original.id : `(entry ${index + 1})`, original, ...result };
  });
  const count = (status) => entries.filter((e) => e.status === status).length;
  const perMigration = Object.fromEntries(MIGRATIONS.map((m) => [m.id, entries.filter((e) => e.changes.some((c) => c.startsWith(`v${m.version} `))).length]));
  const report = {
    toVersion: CURRENT_VERSION,
    total: entries.length,
    changed: count('changed'),
    unchanged: count('unchanged'),
    invalid: count('invalid'),
    perMigration,
    unknownFieldNames: [...new Set(entries.flatMap((e) => e.unknownFields))].sort(),
    records: entries.map(({ index, id, status, changes, errors, unknownFields }) => ({ index, id, status, changes, errors, unknownFields })),
  };
  // the migrated records themselves, for applyMigration; kept out of the printable report
  Object.defineProperty(report, '_entries', { value: entries, enumerable: false });
  return report;
}

// ---- snapshots ------------------------------------------------------------------------------------

/** A short stable fingerprint of a text, used to notice a damaged snapshot. */
export const checksum = (text) => {
  let h = 5381;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(16)}`;
};

const readSnapshots = (storage) => {
  try {
    const parsed = JSON.parse(storage.getItem(SNAPSHOTS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((s) => isObject(s) && typeof s.id === 'string') : [];
  } catch {
    return [];
  }
};

const writeSnapshots = (storage, list) => {
  try {
    storage.setItem(SNAPSHOTS_KEY, JSON.stringify(list));
  } catch {
    throw new MigrationError('Could not save the backup (browser storage is full or blocked), so nothing was changed.');
  }
};

let snapshotSequence = 0;

const takeSnapshot = (storage, raw, reason, actor) => {
  const list = readSnapshots(storage);
  const createdAt = new Date().toISOString();
  const snapshot = {
    id: `snap-${createdAt.replace(/[^0-9]/g, '').slice(0, 14)}-${Date.now().toString(36)}${(snapshotSequence += 1)}`,
    createdAt,
    reason,
    actor,
    count: raw === null ? 0 : (() => { try { return JSON.parse(raw).length; } catch { return 0; } })(),
    checksum: checksum(raw ?? ''),
    raw,
  };
  writeSnapshots(storage, [...list, snapshot].slice(-MAX_SNAPSHOTS));
  return snapshot;
};

/** Stored backups, newest first, without the bulky record text. */
export function listSnapshots({ storage = getStorage() } = {}) {
  requirePermission('catalogue.migrate');
  if (!storage) return [];
  return readSnapshots(storage)
    .map((snap) => without(snap, 'raw'))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** A downloadable copy of the catalogue as it is now (or of a stored snapshot), as JSON text. */
export function exportCatalogue({ snapshotId = null, storage = getStorage() } = {}) {
  requirePermission('catalogue.migrate');
  let raw;
  let meta = { reason: 'export of the current catalogue', createdAt: new Date().toISOString() };
  if (snapshotId) {
    const snap = readSnapshots(storage).find((s) => s.id === snapshotId);
    if (!snap) throw new MigrationError('That backup no longer exists.');
    raw = snap.raw;
    meta = { reason: snap.reason, createdAt: snap.createdAt, snapshotId };
  } else {
    raw = readCatalogue(storage).raw;
  }
  const records = raw === null ? [] : JSON.parse(raw);
  return JSON.stringify({ format: SNAPSHOT_FORMAT, key: CATALOGUE_KEY, ...meta, count: records.length, records }, null, 2);
}

// ---- applying and rolling back ------------------------------------------------------------------------

/**
 * Applies the migrations to the saved catalogue. Needs `confirm: true`. Takes a snapshot first (and stops if it
 * cannot), writes the catalogue once, and checks what was written. Invalid records stay exactly as they were.
 * Running it again changes nothing and takes no snapshot.
 * @returns {{ applied: boolean, snapshotId: string|null, changed: number, unchanged: number, invalid: number }}
 */
export function applyMigration({ confirm = false, storage = getStorage() } = {}) {
  requirePermission('catalogue.migrate');
  if (confirm !== true) throw new MigrationError('A migration only runs after an explicit confirmation.');
  const actor = actorLabel('Admin');
  const plan = planMigration({ storage });
  const summary = { changed: plan.changed, unchanged: plan.unchanged, invalid: plan.invalid };
  if (plan.changed === 0) return { applied: false, snapshotId: null, ...summary };

  const { raw } = readCatalogue(storage);
  const snapshot = takeSnapshot(storage, raw, `before migration to v${CURRENT_VERSION}`, actor);

  const next = plan._entries.map((e) => (e.status === 'changed' ? e.record : e.original));
  const text = JSON.stringify(next);
  try {
    storage.setItem(CATALOGUE_KEY, text);
    if (storage.getItem(CATALOGUE_KEY) !== text) throw new Error('read-back differs');
  } catch {
    // put the original text back so a half-write cannot stay
    try {
      if (raw === null) storage.removeItem(CATALOGUE_KEY);
      else storage.setItem(CATALOGUE_KEY, raw);
    } catch {
      /* nothing more can be done; the snapshot still holds the original */
    }
    throw new MigrationError(`Could not write the migrated catalogue. The original was restored; backup ${snapshot.id} is available.`);
  }
  addAuditLog({
    action: 'CATALOGUE_MIGRATED',
    actor,
    target: `catalogue v${CURRENT_VERSION}`,
    details: `Migrated ${plan.changed} record(s), ${plan.unchanged} unchanged, ${plan.invalid} skipped as invalid. Backup: ${snapshot.id}.`,
  });
  return { applied: true, snapshotId: snapshot.id, ...summary };
}

/**
 * Puts the saved catalogue back exactly as a snapshot held it. Needs `confirm: true`. The current catalogue is
 * snapshotted first, so a rollback can itself be undone.
 */
export function rollbackToSnapshot(snapshotId, { confirm = false, storage = getStorage() } = {}) {
  requirePermission('catalogue.migrate');
  if (confirm !== true) throw new MigrationError('A rollback only runs after an explicit confirmation.');
  if (!storage) throw new MigrationError('Browser storage is not available.');
  const snap = readSnapshots(storage).find((s) => s.id === snapshotId);
  if (!snap) throw new MigrationError('That backup no longer exists.');
  if (checksum(snap.raw ?? '') !== snap.checksum) throw new MigrationError('That backup is damaged, so it was not restored.');

  const actor = actorLabel('Admin');
  const current = storage.getItem(CATALOGUE_KEY);
  const before = takeSnapshot(storage, current, `before rollback to ${snap.id}`, actor);
  try {
    if (snap.raw === null) storage.removeItem(CATALOGUE_KEY);
    else storage.setItem(CATALOGUE_KEY, snap.raw);
  } catch {
    throw new MigrationError('Could not restore the catalogue (browser storage is full or blocked). Nothing was changed.');
  }
  addAuditLog({
    action: 'CATALOGUE_ROLLED_BACK',
    actor,
    target: `catalogue ${snap.id}`,
    details: `Restored ${snap.count} record(s) from backup ${snap.id}. Previous state saved as ${before.id}.`,
  });
  return { restored: snap.count, snapshotId: snap.id, previousSnapshotId: before.id };
}

export { MigrationError };
