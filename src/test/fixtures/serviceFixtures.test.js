import { describe, it, expect, vi } from 'vitest';
import { SERVICE_CATEGORIES } from '../../data/serviceCategories.js';
import {
  FORBIDDEN_FIELDS,
  SERVICE_SCHEMA_VERSION,
  validateCatalogue,
  validateServiceRecord,
} from '../../data/serviceContract.js';
import { CUSTOM_SERVICES_KEY, getAllServices } from '../../services/serviceCatalog.js';
import {
  DEFAULT_SEED,
  FIXTURE_ID_PREFIX,
  FIXTURE_STORAGE_KEY,
  baseService,
  buildCatalogue,
  createRng,
  getScenario,
  isSyntheticRecord,
  listScenarios,
  registerScenario,
  scenarioNames,
  unregisterScenario,
  writeFixtureCatalogue,
} from './serviceFixtures.js';

const errorFields = (record) => validateServiceRecord(record).map((e) => e.field).sort();
const valid = listScenarios().filter((s) => s.valid);
const invalid = listScenarios().filter((s) => !s.valid);

describe('createRng', () => {
  it('gives the same sequence for the same seed, and different ones for different seeds', () => {
    const run = (seed) => {
      const rng = createRng(seed);
      return Array.from({ length: 8 }, () => rng.next());
    };
    expect(run(1)).toEqual(run(1));
    expect(run(1)).not.toEqual(run(2));
    expect(run('abc')).toEqual(run('abc'));
    expect(run('abc')).not.toEqual(run('abd'));
  });

  it('stays in range', () => {
    const rng = createRng(5);
    for (let i = 0; i < 500; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      expect(['a', 'b']).toContain(rng.pick(['a', 'b']));
    }
  });
});

describe('determinism', () => {
  it('returns identical records for the same seed, scenario and index, on every call', () => {
    for (const { name } of listScenarios()) {
      expect(getScenario(name, { seed: 42 }), name).toEqual(getScenario(name, { seed: 42 }));
      expect(getScenario(name, { seed: 42, index: 3 }), name).toEqual(getScenario(name, { seed: 42, index: 3 }));
    }
  });

  it('returns a new object each time, so a test can change it freely', () => {
    const a = getScenario('complete');
    const b = getScenario('complete');
    expect(a).not.toBe(b);
    a.steps.push({ title: 'x', description: 'y' });
    a.contacts[0].label = 'changed';
    expect(getScenario('complete')).toEqual(b);
  });

  it('gives different records for different seeds', () => {
    const names = new Set(Array.from({ length: 30 }, (_, seed) => getScenario('minimal', { seed }).name));
    expect(names.size).toBeGreaterThan(5);
  });

  it('produces the same catalogue for the same seed and a different one for another', () => {
    expect(buildCatalogue({ seed: 9, count: 24 })).toEqual(buildCatalogue({ seed: 9, count: 24 }));
    expect(buildCatalogue({ seed: 9, count: 24 })).not.toEqual(buildCatalogue({ seed: 10, count: 24 }));
  });

  it('keeps a fixed record for the default seed (a change here changes every test that relies on it)', () => {
    expect(getScenario('minimal')).toEqual(getScenario('minimal', { seed: DEFAULT_SEED }));
    const snapshot = getScenario('complete');
    expect(Object.keys(snapshot).sort()).toEqual(
      [
        'category', 'contacts', 'department', 'difficulty', 'documents', 'eligibility', 'eligibilityRuleKey', 'feeType', 'fees', 'id', 'jurisdiction',
        'lastVerified', 'name', 'officialSources', 'popularityScore', 'processingTime', 'publicationState', 'shortDescription', 'speedDays', 'steps', 'type', 'warnings',
      ].sort(),
    );
    expect(snapshot.id).toMatch(/^sample-[a-z-]+-1$/);
  });
});

describe('the scenarios', () => {
  it('cover complete, partial, archived, draft, region-specific, conditional and invalid records', () => {
    const names = scenarioNames();
    for (const wanted of ['complete', 'minimal', 'no-documents', 'archived', 'draft', 'state-specific', 'district-specific', 'local-body-specific', 'conditional-eligibility', 'invalid-category']) {
      expect(names, wanted).toContain(wanted);
    }
    expect(valid.length).toBeGreaterThanOrEqual(10);
    expect(invalid.length).toBeGreaterThanOrEqual(10);
  });

  it('have a description and a unique name each', () => {
    expect(new Set(scenarioNames()).size).toBe(scenarioNames().length);
    for (const s of listScenarios()) expect(s.description.length).toBeGreaterThan(5);
  });

  it.each(valid.map((s) => s.name))('"%s" satisfies the service contract', (name) => {
    for (const seed of [1, 2, 99, DEFAULT_SEED]) {
      expect(validateServiceRecord(getScenario(name, { seed })), `${name} seed ${seed}`).toEqual([]);
    }
  });

  it.each(invalid.map((s) => [s.name, s.expectedErrors]))('"%s" fails the contract on exactly %j', (name, expected) => {
    for (const seed of [1, 2, 99]) {
      expect(errorFields(getScenario(name, { seed })), `${name} seed ${seed}`).toEqual([...expected].sort());
    }
  });

  it('use every category and every region level somewhere', () => {
    const records = Array.from({ length: 200 }, (_, seed) => getScenario('minimal', { seed }));
    expect(new Set(records.map((r) => r.category))).toEqual(new Set(SERVICE_CATEGORIES));
    const levels = new Set(['state-specific', 'district-specific', 'local-body-specific', 'complete'].map((n) => getScenario(n).jurisdiction.level));
    expect(levels).toEqual(new Set(['state', 'district', 'local', 'national']));
  });

  it('set the publication state the scenario name says', () => {
    expect(getScenario('draft').publicationState).toBe('draft');
    expect(getScenario('archived').publicationState).toBe('archived');
    expect(getScenario('minimal').publicationState).toBeUndefined();
  });

  it('reach the edges of the number ranges and long text', () => {
    expect(getScenario('free-and-instant')).toMatchObject({ speedDays: 0, popularityScore: 0, feeType: 'free' });
    const long = getScenario('long-text');
    expect(long.name.length).toBeGreaterThan(80);
    expect(long.shortDescription.length).toBeGreaterThan(500);
    expect(long.steps).toHaveLength(12);
  });

  it('give the conditional scenario documents that depend on the applicant', () => {
    const record = getScenario('conditional-eligibility');
    expect(Object.values(record.documentRequirements).every((r) => r.type === 'conditional' && r.condition.length > 10)).toBe(true);
    for (const document of Object.keys(record.documentRequirements)) expect(record.documents).toContain(document);
  });

  it('refuse an unknown scenario with the list of known ones', () => {
    expect(() => getScenario('nope')).toThrow(/Unknown fixture scenario "nope"\. Known: complete/);
  });
});

describe('buildCatalogue', () => {
  it('returns the contract envelope with unique ids that validate', () => {
    const catalogue = buildCatalogue({ seed: 5, count: 40 });
    expect(catalogue.schemaVersion).toBe(SERVICE_SCHEMA_VERSION);
    expect(catalogue.services).toHaveLength(40);
    expect(new Set(catalogue.services.map((s) => s.id)).size).toBe(40);
    expect(validateCatalogue(catalogue)).toEqual({ valid: true, errors: [] });
  });

  it('cycles through the chosen scenarios', () => {
    const { services } = buildCatalogue({ count: 6, scenarios: ['draft', 'archived'] });
    expect(services.map((s) => s.publicationState)).toEqual(['draft', 'archived', 'draft', 'archived', 'draft', 'archived']);
  });

  it('adds one record of each invalid scenario on request, and the catalogue then fails validation', () => {
    const catalogue = buildCatalogue({ count: 5, includeInvalid: true });
    expect(catalogue.services).toHaveLength(5 + invalid.length);
    const result = validateCatalogue(catalogue);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(invalid.length);
  });

  it('handles zero, and refuses a bad count or an empty scenario list', () => {
    expect(buildCatalogue({ count: 0 }).services).toEqual([]);
    for (const count of [-1, 1.5, 1001, '5', NaN]) expect(() => buildCatalogue({ count })).toThrow(RangeError);
    expect(() => buildCatalogue({ scenarios: [] })).toThrow(/must not be empty/);
    expect(() => buildCatalogue({ scenarios: ['nope'] })).toThrow(/Unknown fixture scenario/);
  });
});

describe('no real data', () => {
  const everything = () => [...listScenarios().map((s) => getScenario(s.name)), ...buildCatalogue({ count: 60, includeInvalid: true }).services];

  it('uses fictional names, ids and links only', () => {
    for (const record of everything()) {
      if (typeof record.id === 'string' && record.id) expect(record.id.startsWith(FIXTURE_ID_PREFIX), record.id).toBe(true);
      expect(isSyntheticRecord(record), JSON.stringify(record).slice(0, 80)).toBe(true);
    }
  });

  it('contains no e-mail address except the reserved example.org one, and no real-looking phone or ID number', () => {
    for (const record of everything()) {
      const text = JSON.stringify(record);
      for (const email of text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? []) expect(email).toMatch(/@example\.org$/);
      expect(text).not.toMatch(/\b[6-9]\d{9}\b/); // a mobile number
      expect(text).not.toMatch(/\b\d{4}\s?\d{4}\s?\d{4}\b/); // an Aadhaar-shaped number
      expect(text).not.toMatch(/\b[A-Z]{5}\d{4}[A-Z]\b/); // a PAN-shaped value
    }
  });

  it('puts personal-data fields only in the one scenario made to show that they are refused', () => {
    for (const record of listScenarios().filter((s) => s.name !== 'invalid-personal-data').map((s) => getScenario(s.name))) {
      for (const field of FORBIDDEN_FIELDS) expect(field in record, `${field}`).toBe(false);
    }
  });

  it('recognises real-looking records as not synthetic', () => {
    expect(isSyntheticRecord({ id: 'birth-certificate' })).toBe(false);
    expect(isSyntheticRecord({ id: 'sample-x', officialSources: [{ url: 'https://services.india.gov.in' }] })).toBe(false);
    expect(isSyntheticRecord({ id: 'sample-x', officialSources: [{ url: 'https://example.org.evil.in/x' }] })).toBe(false);
    expect(isSyntheticRecord({ id: 'sample-x', officialSources: [{ url: 'https://sub.example.com/x' }] })).toBe(true);
    for (const value of [null, undefined, 5, 'x']) expect(isSyntheticRecord(value)).toBe(false);
  });
});

describe('storage', () => {
  const memory = () => {
    const data = new Map();
    return { getItem: (k) => data.get(k) ?? null, setItem: vi.fn((k, v) => data.set(k, v)), data };
  };

  it('writes nothing unless a storage is passed in', () => {
    const before = globalThis.localStorage;
    buildCatalogue({ count: 10 });
    getScenario('complete');
    expect(globalThis.localStorage).toBe(before);
    expect(() => writeFixtureCatalogue(undefined, buildCatalogue({ count: 1 }))).toThrow(/Pass the storage/);
  });

  it('writes synthetic records to its own key and never to the real catalogue key', () => {
    const storage = memory();
    const key = writeFixtureCatalogue(storage, buildCatalogue({ count: 3 }));
    expect(key).toBe(FIXTURE_STORAGE_KEY);
    expect(JSON.parse(storage.data.get(FIXTURE_STORAGE_KEY))).toHaveLength(3);
    expect(() => writeFixtureCatalogue(storage, buildCatalogue({ count: 1 }), { key: CUSTOM_SERVICES_KEY })).toThrow(/real catalogue/);
    expect(storage.data.has(CUSTOM_SERVICES_KEY)).toBe(false);
  });

  it('refuses a record that does not look synthetic', () => {
    const storage = memory();
    expect(() => writeFixtureCatalogue(storage, { services: [{ id: 'birth-certificate', name: 'Birth Certificate' }] })).toThrow(/do not look synthetic/);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('reuse in other tests', () => {
  it('catalogue tests: fixtures stored as the admin catalogue appear in the merged list', () => {
    const records = buildCatalogue({ count: 3, scenarios: ['complete', 'draft', 'archived'] }).services;
    const data = new Map([[CUSTOM_SERVICES_KEY, JSON.stringify(records)]]);
    vi.stubGlobal('localStorage', { getItem: (k) => data.get(k) ?? null, setItem: () => {}, removeItem: () => {} });
    try {
      const merged = getAllServices();
      for (const record of records) expect(merged.some((s) => s.id === record.id)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('admin tests: a record can be edited without touching the fixture it came from', () => {
    const original = getScenario('complete');
    const edited = { ...original, name: 'Edited name', steps: [...original.steps, { title: 'New step', description: 'Added.' }] };
    expect(validateServiceRecord(edited)).toEqual([]);
    expect(getScenario('complete')).toEqual(original);
  });

  it('eligibility tests: records carry a rule key and conditional criteria', () => {
    expect(getScenario('conditional-eligibility').eligibilityRuleKey).toBe('sample-conditional-rule');
    expect(getScenario('conditional-eligibility').eligibility.length).toBeGreaterThan(1);
  });
});

describe('adding a scenario', () => {
  it('registers a valid one, which then appears in the lists and validates', () => {
    registerScenario('test-only-extra', {
      description: 'Added by the test to prove registration works.',
      valid: true,
      build: (rng, index) => ({ ...baseService(rng, index), warnings: ['Extra scenario.'] }),
    });
    try {
      expect(scenarioNames()).toContain('test-only-extra');
      expect(validateServiceRecord(getScenario('test-only-extra'))).toEqual([]);
    } finally {
      unregisterScenario('test-only-extra');
    }
    expect(scenarioNames()).not.toContain('test-only-extra');
  });

  it('refuses a bad name, a duplicate, a missing builder, and an invalid scenario with no expected errors', () => {
    const ok = { description: 'text here', valid: true, build: () => ({}) };
    expect(() => registerScenario('Bad Name', ok)).toThrow(/lower-case words/);
    expect(() => registerScenario('complete', ok)).toThrow(/already registered/);
    expect(() => registerScenario('another-one', { description: 'x', valid: true })).toThrow(/needs a description/);
    expect(() => registerScenario('another-two', { ...ok, valid: false })).toThrow(/must list the contract error fields/);
  });
});

describe('the documentation and the app', () => {
  it('lists every scenario with its validity, description and expected errors', async () => {
    const { readFileSync } = await import('node:fs');
    const doc = readFileSync(new URL('../../../docs/TEST_FIXTURES.md', import.meta.url), 'utf8');
    for (const s of listScenarios()) {
      const errors = s.expectedErrors.length ? '`' + s.expectedErrors.join('`, `') + '`' : '';
      const row = '| `' + s.name + '` | ' + (s.valid ? 'valid' : 'invalid') + ' | ' + s.description + ' | ' + errors + ' |';
      expect(doc, s.name).toContain(row);
    }
  });

  it('is not imported by the app, only by tests', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const offenders = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          if (full.split('\\').join('/').endsWith('/src/test')) continue;
          walk(full);
        } else if (/\.(js|jsx)$/.test(name) && !/\.test\./.test(name) && /test\/fixtures/.test(readFileSync(full, 'utf8'))) {
          offenders.push(full);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
