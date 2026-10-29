import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { USER_DATA_STORES } from './privacyConsentService.js';
import {
  CLOUD_STORES,
  DEVICE_ONLY_STORES,
  MAX_RECORD_BYTES,
  SCHEMA_VERSION,
  CloudRecordError,
  fromCloudRecords,
  isCloudStore,
  recordId,
  storesInCollection,
  toCloudRecords,
} from './cloudRecords.js';

const rules = readFileSync(new URL('../../firebase/firestore.rules', import.meta.url), 'utf8');
const ownedCollections = [...rules.match(/function ownedCollections\(\) \{\s*return \[([^\]]*)\]/)[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);

const SAMPLES = {
  list: [
    { id: 'SRV-98234710', serviceName: 'Income Certificate', status: 'in_review', role: 'admin', nested: { a: [1, 2] } },
    { id: 'app/with/slashes', note: 'Hindi: जन्म' },
    { noId: true, text: 'x'.repeat(50) },
    'plain-string-bookmark',
    42,
  ],
  document: { 'income-certificate': { done: ['a', 'b'] }, role: 'admin', 'x/y': null },
};

describe('the store tables', () => {
  it('classify every key of the privacy registry exactly once', () => {
    const classified = [...CLOUD_STORES.map((s) => s.key), ...DEVICE_ONLY_STORES.map((s) => s.key)];
    expect(new Set(classified).size).toBe(classified.length);
    const registry = USER_DATA_STORES.map((s) => s.key);
    expect(registry.filter((key) => !classified.includes(key)), 'add new stores to cloudRecords.js').toEqual([]);
    expect(classified.filter((key) => !registry.includes(key)), 'stores that no longer exist').toEqual([]);
  });

  it('only use collections that firestore.rules lists as personal', () => {
    expect(ownedCollections.length).toBeGreaterThanOrEqual(10);
    for (const store of CLOUD_STORES) expect(ownedCollections, store.key).toContain(store.collection);
  });

  it('use every personal collection at least once', () => {
    for (const name of ownedCollections) expect(storesInCollection(name).length, name).toBeGreaterThan(0);
  });

  it('keep secrets and caches on the device', () => {
    expect(isCloudStore('civicbridge_vault_pin')).toBe(false);
    expect(isCloudStore('civicbridge_offline_cache')).toBe(false);
    expect(DEVICE_ONLY_STORES.find((s) => s.key === 'civicbridge_vault_pin').reason).toMatch(/secret/);
  });

  it('give every device-only store a reason and every cloud store a unique slug', () => {
    for (const store of DEVICE_ONLY_STORES) expect(store.reason.length).toBeGreaterThan(10);
    expect(new Set(CLOUD_STORES.map((s) => s.slug)).size).toBe(CLOUD_STORES.length);
    for (const store of CLOUD_STORES) expect(['list', 'document']).toContain(store.kind);
  });
});

describe('recordId', () => {
  const valid = (id) =>
    id.length > 0 && id.length <= 128 && !id.includes('/') && id !== '.' && id !== '..' && !/^__.*__$/.test(id) && new TextEncoder().encode(id).length <= 1500;

  it('is always a valid Firestore document id with the slug as prefix', () => {
    for (const suffix of ['SRV-1', 'a/b/c', '..', '.', '__x__', '', '   ', 'नमस्ते', 'x'.repeat(5000), 'a b\nc', '\u0000']) {
      const id = recordId('saved-guides', suffix);
      expect(valid(id), JSON.stringify(suffix)).toBe(true);
      expect(id.startsWith('saved-guides--')).toBe(true);
    }
  });

  it('keeps ordinary ids readable and the same ids equal', () => {
    expect(recordId('applications', 'SRV-98234710')).toBe('applications--SRV-98234710');
    expect(recordId('applications', 'SRV-98234710')).toBe(recordId('applications', 'SRV-98234710'));
  });
});

describe('toCloudRecords and fromCloudRecords', () => {
  it('round-trip every cloud store without losing or changing anything', () => {
    for (const store of CLOUD_STORES) {
      const value = store.kind === 'list' ? SAMPLES.list : SAMPLES.document;
      const records = toCloudRecords(store.key, value);
      expect(records.length, store.key).toBe(store.kind === 'list' ? value.length : 1);
      expect(fromCloudRecords(store.key, records), store.key).toEqual(value);
      // through JSON, as Firestore would store it
      expect(fromCloudRecords(store.key, JSON.parse(JSON.stringify(records))), store.key).toEqual(value);
    }
  });

  it('puts only `value` and `position` in the data, so the rules never see user field names', () => {
    for (const store of CLOUD_STORES) {
      const records = toCloudRecords(store.key, store.kind === 'list' ? SAMPLES.list : SAMPLES.document);
      for (const record of records) {
        expect(Object.keys(record.data).sort()).toEqual(store.kind === 'list' ? ['position', 'value'] : ['value']);
        expect(record.schemaVersion).toBe(SCHEMA_VERSION);
        expect(record.collection).toBe(store.collection);
        expect(Object.keys(record)).toEqual(['collection', 'id', 'data', 'schemaVersion']);
      }
    }
  });

  it('keeps privileged-looking fields inside `value`, not at the top level', () => {
    const [record] = toCloudRecords('civicbridge_applications', [{ id: 'a', role: 'admin', isAdmin: true, ownerId: 'x' }]);
    expect(record.data.role).toBeUndefined();
    expect(record.data.value.role).toBe('admin');
  });

  it('gives items unique ids, also when ids repeat or clean to the same value', () => {
    const records = toCloudRecords('civicbridge_applications', [{ id: 'a/b' }, { id: 'a-b' }, { id: 'a/b' }, 'a b', 'a-b']);
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length);
  });

  it('restores list order from `position` whatever order the records arrive in', () => {
    const list = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];
    const shuffled = toCloudRecords('civicbridge_reminders', list).reverse();
    expect(fromCloudRecords('civicbridge_reminders', shuffled)).toEqual(list);
  });

  it('handles empty, null and missing values', () => {
    expect(toCloudRecords('civicbridge_applications', [])).toEqual([]);
    expect(toCloudRecords('civicbridge_applications', null)).toEqual([]);
    expect(fromCloudRecords('civicbridge_applications', [])).toEqual([]);
    expect(fromCloudRecords('civicbridge_applications', undefined)).toEqual([]);
    expect(toCloudRecords('civicbridge_ai_context_consent', null)[0].data).toEqual({ value: null });
    expect(fromCloudRecords('civicbridge_ai_context_consent', [])).toBeNull();
    expect(fromCloudRecords('civicbridge_ai_context_consent', toCloudRecords('civicbridge_ai_context_consent', false))).toBe(false);
  });

  it('refuses keys it does not own and values of the wrong shape', () => {
    expect(() => toCloudRecords('civicbridge_vault_pin', '1234')).toThrow(CloudRecordError);
    expect(() => toCloudRecords('theme', 'dark')).toThrow(/not a cloud store/);
    expect(() => toCloudRecords('civicbridge_applications', { not: 'a list' })).toThrow(/hold a list/);
    expect(() => fromCloudRecords('civicbridge_vault_pin', [])).toThrow(CloudRecordError);
  });

  it('refuses a record that would not fit in one Firestore document', () => {
    const huge = 'x'.repeat(MAX_RECORD_BYTES + 10);
    for (const attempt of [() => toCloudRecords('civicbridge_checklists', { huge }), () => toCloudRecords('civicbridge_applications', [{ id: 'a', huge }])]) {
      try {
        attempt();
        throw new Error('should have thrown');
      } catch (error) {
        expect(error.code).toBe('record_too_large');
      }
    }
  });

  it('does not change its input', () => {
    const input = [{ id: 'a', list: [1] }];
    const copy = JSON.parse(JSON.stringify(input));
    toCloudRecords('civicbridge_applications', input);
    expect(input).toEqual(copy);
  });
});
