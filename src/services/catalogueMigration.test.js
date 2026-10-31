import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CATALOGUE_KEY,
  CURRENT_VERSION,
  MAX_SNAPSHOTS,
  MIGRATIONS,
  MigrationError,
  SNAPSHOTS_KEY,
  applyMigration,
  checksum,
  exportCatalogue,
  listSnapshots,
  migrateRecord,
  planMigration,
  rollbackToSnapshot,
} from './catalogueMigration';
import { getAuditLogs } from './adminService';
import { setCurrentActor, PermissionDeniedError } from './accessControl';

const makeStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((k) => (data.has(k) ? data.get(k) : null)),
    setItem: vi.fn((k, v) => data.set(k, String(v))),
    removeItem: vi.fn((k) => data.delete(k)),
    data,
  };
  return storage;
};

const legacy = {
  id: 'legacy-guide',
  name: 'Legacy guide',
  category: 'Certificates',
  jurisdiction: 'Karnataka',
  documents: 'Proof of address\nPhoto\n\n  ID card  ',
  eligibility: ['Resident', '  ', 'Adult'],
  intakeWindows: [{ label: 'Round 1', startDate: '2026-01-01', noticeTitle: 'Circular 4', noticeUrl: 'https://example.gov.in/c4' }],
  customNote: 'kept as it is',
};
const modern = {
  id: 'modern-guide',
  name: 'Modern guide',
  jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
  documents: ['Proof of address'],
  eligibility: ['Adult'],
};
const unmappable = { id: 'india-text', name: 'Text scope', jurisdiction: 'India' };

const seed = (records) => makeStorage({ [CATALOGUE_KEY]: JSON.stringify(records) });
const stored = (storage) => JSON.parse(storage.data.get(CATALOGUE_KEY));

beforeEach(() => {
  setCurrentActor({ role: 'admin', username: 'Test Admin' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('the migrations', () => {
  it('each has a version, an id, a title and a documented transformation, in order', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual([1, 2, 3]);
    expect(CURRENT_VERSION).toBe(3);
    for (const m of MIGRATIONS) {
      expect(m.id).toMatch(/^[a-z-]+$/);
      expect(m.title).toBeTruthy();
      expect(m.description.length).toBeGreaterThan(20);
      expect(typeof m.run).toBe('function');
    }
  });
});

describe('migrateRecord', () => {
  it('converts every legacy field and reports each change', () => {
    const result = migrateRecord(legacy);
    expect(result.status).toBe('changed');
    expect(result.record.jurisdiction).toEqual({ level: 'state', states: ['Karnataka'], districts: [], localBody: '' });
    expect(result.record.documents).toEqual(['Proof of address', 'Photo', 'ID card']);
    expect(result.record.eligibility).toEqual(['Resident', 'Adult']);
    expect(result.record.intakeWindows[0]).toEqual({ label: 'Round 1', startDate: '2026-01-01', notice: { title: 'Circular 4', url: 'https://example.gov.in/c4' } });
    expect(result.changes).toHaveLength(4);
    expect(result.changes.map((c) => c.slice(0, 2))).toEqual(['v1', 'v2', 'v2', 'v3']);
  });

  it('never changes the record it was given', () => {
    const before = JSON.stringify(legacy);
    migrateRecord(legacy);
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it('leaves an already migrated record unchanged', () => {
    const result = migrateRecord(modern);
    expect(result.status).toBe('unchanged');
    expect(result.record).toBe(modern);
    expect(result.changes).toEqual([]);
  });

  it('is idempotent: migrating the output changes nothing', () => {
    for (const record of [legacy, modern, { id: 'x', name: 'X', jurisdiction: '  ', documents: 'a\nb' }, { id: 'y', name: 'Y', jurisdiction: { level: 'national' } }]) {
      const once = migrateRecord(record);
      const twice = migrateRecord(once.record);
      expect(twice.status, record.id).toBe('unchanged');
      expect(JSON.stringify(twice.record), record.id).toBe(JSON.stringify(once.record));
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(migrateRecord(legacy))).toBe(JSON.stringify(migrateRecord(structuredClone(legacy))));
  });

  it('keeps fields it does not know, and lists them', () => {
    const result = migrateRecord(legacy);
    expect(result.record.customNote).toBe('kept as it is');
    expect(result.unknownFields).toEqual(['customNote']);
  });

  it('keeps unknown keys inside a jurisdiction object', () => {
    const result = migrateRecord({ id: 'z', name: 'Z', jurisdiction: { level: 'National ', states: [], note: 'keep me' } });
    expect(result.record.jurisdiction).toMatchObject({ level: 'national', note: 'keep me', states: [], districts: [], localBody: '' });
  });

  it('treats empty jurisdiction text as "not specified"', () => {
    const result = migrateRecord({ id: 'z', name: 'Z', jurisdiction: '   ' });
    expect(result.status).toBe('changed');
    expect('jurisdiction' in result.record).toBe(false);
  });

  it('does not guess the scope of text that is not a state name', () => {
    for (const text of ['India', 'All India', 'Pune', 'Karnataka and Kerala']) {
      const result = migrateRecord({ id: 'z', name: 'Z', jurisdiction: text });
      expect(result.status, text).toBe('invalid');
      expect(result.errors[0].migration).toBe('jurisdiction-structured');
      expect(result.record.jurisdiction).toBe(text);
    }
  });

  it('matches a state name ignoring case and spacing', () => {
    expect(migrateRecord({ id: 'z', name: 'Z', jurisdiction: ' tamil  NADU ' }).record.jurisdiction.states).toEqual(['Tamil Nadu']);
  });

  it('reports a record that is not a service record, and bad shapes, without throwing', () => {
    expect(migrateRecord(null).status).toBe('invalid');
    expect(migrateRecord('text').status).toBe('invalid');
    expect(migrateRecord({ name: 'No id' }).status).toBe('invalid');
    expect(migrateRecord({ id: 'z', name: 'Z', documents: 5 }).status).toBe('invalid');
    expect(migrateRecord({ id: 'z', name: 'Z', documents: ['ok', 3] }).errors[0].message).toMatch(/not text/);
    expect(migrateRecord({ id: 'z', name: 'Z', intakeWindows: 'soon' }).status).toBe('invalid');
    expect(migrateRecord({ id: 'z', name: 'Z', jurisdiction: { level: 'galaxy' } }).status).toBe('invalid');
  });

  it('reports every failing migration, and leaves the input untouched when any fails', () => {
    const input = { id: 'z', name: 'Z', jurisdiction: 'India', documents: 7 };
    const result = migrateRecord(input);
    expect(result.status).toBe('invalid');
    expect(result.errors.map((e) => e.migration)).toEqual(['jurisdiction-structured', 'requirement-lists']);
    expect(result.record).toBe(input);
  });

  it('keeps an intake window notice that already exists', () => {
    const result = migrateRecord({ id: 'z', name: 'Z', intakeWindows: [{ label: 'R', noticeTitle: 'Old', notice: { title: 'New', url: '' } }] });
    expect(result.record.intakeWindows[0].notice).toEqual({ title: 'New', url: '' });
    expect(result.record.intakeWindows[0].noticeTitle).toBeUndefined();
  });
});

describe('dry run', () => {
  it('counts changed, unchanged and invalid records and writes nothing', () => {
    const storage = seed([legacy, modern, unmappable, 'junk']);
    const report = planMigration({ storage });
    expect(report).toMatchObject({ toVersion: 3, total: 4, changed: 1, unchanged: 1, invalid: 2 });
    expect(report.perMigration).toEqual({ 'jurisdiction-structured': 1, 'requirement-lists': 1, 'intake-window-notice': 1 });
    expect(report.unknownFieldNames).toEqual(['customNote']);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('reports each record with its id, status, changes and errors', () => {
    const report = planMigration({ storage: seed([legacy, unmappable, 'junk']) });
    expect(report.records.map((r) => [r.id, r.status])).toEqual([
      ['legacy-guide', 'changed'],
      ['india-text', 'invalid'],
      ['(entry 3)', 'invalid'],
    ]);
    expect(report.records[1].errors[0].message).toMatch(/not a state or Union Territory/);
    expect(JSON.stringify(report)).not.toContain('_entries');
  });

  it('handles an empty or missing catalogue', () => {
    expect(planMigration({ storage: makeStorage() })).toMatchObject({ total: 0, changed: 0, invalid: 0 });
  });

  it('stops on a catalogue it cannot read, and changes nothing', () => {
    const broken = makeStorage({ [CATALOGUE_KEY]: '{not json' });
    expect(() => planMigration({ storage: broken })).toThrow(MigrationError);
    const notList = makeStorage({ [CATALOGUE_KEY]: '{"a":1}' });
    expect(() => planMigration({ storage: notList })).toThrow(/not a list/);
    expect(broken.setItem).not.toHaveBeenCalled();
  });
});

describe('applying', () => {
  it('needs an explicit confirmation', () => {
    const storage = seed([legacy]);
    expect(() => applyMigration({ storage })).toThrow(/explicit confirmation/);
    expect(() => applyMigration({ storage, confirm: 'yes' })).toThrow(/explicit confirmation/);
    expect(stored(storage)[0].jurisdiction).toBe('Karnataka');
  });

  it('takes a backup first, then migrates the valid records and keeps invalid ones as they were', () => {
    const storage = seed([legacy, modern, unmappable]);
    const original = storage.data.get(CATALOGUE_KEY);
    const result = applyMigration({ storage, confirm: true });
    expect(result).toMatchObject({ applied: true, changed: 1, unchanged: 1, invalid: 1 });

    const records = stored(storage);
    expect(records).toHaveLength(3);
    expect(records[0].jurisdiction.level).toBe('state');
    expect(records[1]).toEqual(modern);
    expect(records[2]).toEqual(unmappable);

    const snapshots = listSnapshots({ storage });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ id: result.snapshotId, count: 3, reason: 'before migration to v3' });
    expect(snapshots[0].raw).toBeUndefined();
    expect(JSON.parse(storage.data.get(SNAPSHOTS_KEY))[0].raw).toBe(original);
  });

  it('writes the snapshot before the catalogue', () => {
    const storage = seed([legacy]);
    applyMigration({ storage, confirm: true });
    const order = storage.setItem.mock.calls.map(([k]) => k);
    expect(order.indexOf(SNAPSHOTS_KEY)).toBeLessThan(order.indexOf(CATALOGUE_KEY));
  });

  it('is idempotent: a second run changes nothing and takes no backup', () => {
    const storage = seed([legacy, modern]);
    applyMigration({ storage, confirm: true });
    const afterFirst = storage.data.get(CATALOGUE_KEY);
    storage.setItem.mockClear();
    const second = applyMigration({ storage, confirm: true });
    expect(second).toMatchObject({ applied: false, snapshotId: null, changed: 0 });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.data.get(CATALOGUE_KEY)).toBe(afterFirst);
    expect(listSnapshots({ storage })).toHaveLength(1);
  });

  it('does nothing, and takes no backup, when there is nothing to change', () => {
    const storage = seed([modern]);
    expect(applyMigration({ storage, confirm: true })).toMatchObject({ applied: false });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('stops before touching the catalogue when the backup cannot be saved', () => {
    const storage = seed([legacy]);
    const original = storage.data.get(CATALOGUE_KEY);
    storage.setItem.mockImplementation((k, v) => {
      if (k === SNAPSHOTS_KEY) throw new Error('quota');
      storage.data.set(k, String(v));
    });
    expect(() => applyMigration({ storage, confirm: true })).toThrow(/backup/);
    expect(storage.data.get(CATALOGUE_KEY)).toBe(original);
  });

  it('restores the original when the catalogue write fails', () => {
    const storage = seed([legacy]);
    const original = storage.data.get(CATALOGUE_KEY);
    let failNext = true;
    storage.setItem.mockImplementation((k, v) => {
      if (k === CATALOGUE_KEY && failNext) {
        failNext = false;
        throw new Error('quota');
      }
      storage.data.set(k, String(v));
    });
    expect(() => applyMigration({ storage, confirm: true })).toThrow(/original was restored/);
    expect(storage.data.get(CATALOGUE_KEY)).toBe(original);
  });

  it('adds an audit entry', () => {
    applyMigration({ storage: seed([legacy]), confirm: true });
    const entry = getAuditLogs().find((l) => l.action === 'CATALOGUE_MIGRATED');
    expect(entry.details).toMatch(/Migrated 1 record/);
  });

  it('keeps only the most recent backups', () => {
    const storage = seed([legacy]);
    applyMigration({ storage, confirm: true });
    for (let i = 0; i < MAX_SNAPSHOTS + 2; i += 1) {
      storage.data.set(CATALOGUE_KEY, JSON.stringify([{ ...legacy, id: `legacy-${i}` }]));
      applyMigration({ storage, confirm: true });
    }
    expect(listSnapshots({ storage })).toHaveLength(MAX_SNAPSHOTS);
  });
});

describe('rollback', () => {
  it('restores the catalogue exactly as it was before the migration', () => {
    const storage = seed([legacy, modern, unmappable]);
    const original = storage.data.get(CATALOGUE_KEY);
    const { snapshotId } = applyMigration({ storage, confirm: true });
    expect(storage.data.get(CATALOGUE_KEY)).not.toBe(original);

    const result = rollbackToSnapshot(snapshotId, { storage, confirm: true });
    expect(storage.data.get(CATALOGUE_KEY)).toBe(original);
    expect(result).toMatchObject({ restored: 3, snapshotId });
  });

  it('can itself be undone, because the state before it is backed up', () => {
    const storage = seed([legacy]);
    const { snapshotId } = applyMigration({ storage, confirm: true });
    const migrated = storage.data.get(CATALOGUE_KEY);
    const { previousSnapshotId } = rollbackToSnapshot(snapshotId, { storage, confirm: true });
    rollbackToSnapshot(previousSnapshotId, { storage, confirm: true });
    expect(storage.data.get(CATALOGUE_KEY)).toBe(migrated);
  });

  it('migrating again after a rollback gives the same result', () => {
    const storage = seed([legacy]);
    const { snapshotId } = applyMigration({ storage, confirm: true });
    const migrated = storage.data.get(CATALOGUE_KEY);
    rollbackToSnapshot(snapshotId, { storage, confirm: true });
    applyMigration({ storage, confirm: true });
    expect(storage.data.get(CATALOGUE_KEY)).toBe(migrated);
  });

  it('restores an absent catalogue by removing the key', () => {
    const storage = makeStorage();
    // a snapshot of "nothing saved yet"
    storage.data.set(SNAPSHOTS_KEY, JSON.stringify([{ id: 'snap-empty', createdAt: new Date().toISOString(), reason: 'test', actor: 'x', count: 0, checksum: checksum(''), raw: null }]));
    storage.data.set(CATALOGUE_KEY, JSON.stringify([modern]));
    rollbackToSnapshot('snap-empty', { storage, confirm: true });
    expect(storage.data.has(CATALOGUE_KEY)).toBe(false);
  });

  it('needs confirmation, an existing backup, and an undamaged one', () => {
    const storage = seed([legacy]);
    const { snapshotId } = applyMigration({ storage, confirm: true });
    expect(() => rollbackToSnapshot(snapshotId, { storage })).toThrow(/explicit confirmation/);
    expect(() => rollbackToSnapshot('snap-nope', { storage, confirm: true })).toThrow(/no longer exists/);
    const list = JSON.parse(storage.data.get(SNAPSHOTS_KEY));
    list[0].raw = '[]';
    storage.data.set(SNAPSHOTS_KEY, JSON.stringify(list));
    expect(() => rollbackToSnapshot(snapshotId, { storage, confirm: true })).toThrow(/damaged/);
  });

  it('adds an audit entry', () => {
    const storage = seed([legacy]);
    const { snapshotId } = applyMigration({ storage, confirm: true });
    rollbackToSnapshot(snapshotId, { storage, confirm: true });
    expect(getAuditLogs().some((l) => l.action === 'CATALOGUE_ROLLED_BACK')).toBe(true);
  });
});

describe('export', () => {
  it('exports the current catalogue or a backup as JSON with the records', () => {
    const storage = seed([legacy]);
    const { snapshotId } = applyMigration({ storage, confirm: true });
    const current = JSON.parse(exportCatalogue({ storage }));
    const backup = JSON.parse(exportCatalogue({ storage, snapshotId }));
    expect(current).toMatchObject({ format: 'civicbridge-catalogue-snapshot', key: CATALOGUE_KEY, count: 1 });
    expect(current.records[0].jurisdiction.level).toBe('state');
    expect(backup.records[0].jurisdiction).toBe('Karnataka');
    expect(backup.snapshotId).toBe(snapshotId);
    expect(() => exportCatalogue({ storage, snapshotId: 'snap-nope' })).toThrow(/no longer exists/);
  });
});

describe('scope and access', () => {
  it('reads and writes only the catalogue and snapshot keys', () => {
    const storage = seed([legacy]);
    storage.data.set('civicbridge_vault_docs', '[{"secret":1}]');
    storage.data.set('civicbridge_applicant_profiles_v1', '[{"name":"someone"}]');
    applyMigration({ storage, confirm: true });
    const touched = new Set([...storage.getItem.mock.calls, ...storage.setItem.mock.calls].map(([k]) => k));
    expect([...touched].sort()).toEqual([CATALOGUE_KEY, SNAPSHOTS_KEY].sort());
    expect(storage.data.get('civicbridge_vault_docs')).toBe('[{"secret":1}]');
    expect(storage.data.get('civicbridge_applicant_profiles_v1')).toBe('[{"name":"someone"}]');
  });

  it('refuses a citizen and a missing user for every entry point', () => {
    const storage = seed([legacy]);
    for (const actor of [{ role: 'citizen', username: 'Someone' }, null]) {
      setCurrentActor(actor);
      expect(() => planMigration({ storage })).toThrow(PermissionDeniedError);
      expect(() => applyMigration({ storage, confirm: true })).toThrow(PermissionDeniedError);
      expect(() => rollbackToSnapshot('snap-x', { storage, confirm: true })).toThrow(PermissionDeniedError);
      expect(() => listSnapshots({ storage })).toThrow(PermissionDeniedError);
      expect(() => exportCatalogue({ storage })).toThrow(PermissionDeniedError);
    }
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('runs nothing when the module is imported', () => {
    const storage = seed([legacy]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(stored(storage)[0].jurisdiction).toBe('Karnataka');
  });
});
