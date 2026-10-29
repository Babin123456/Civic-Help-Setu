/**
 * Synthetic service records for tests, demos and local development.
 *
 * Everything here is invented: names, departments, phone numbers, e-mail addresses and links use
 * clearly fictional values ("Sample ...", 000 numbers, the reserved example.org domain), nothing is
 * copied from the real catalogue, and there is no citizen data. The generator is deterministic: the
 * same seed always gives the same records, so a test can ask for a scenario by name and get the same
 * record on every run.
 *
 *   getScenario('archived')                     one record, default seed
 *   getScenario('partial-missing-department', { seed: 7 })
 *   buildCatalogue({ seed: 3, count: 20 })      { schemaVersion, services } with a mix of scenarios
 *   listScenarios()                             names, descriptions and what each should fail on
 *
 * Nothing is written anywhere by default. writeFixtureCatalogue() needs an explicit storage and
 * refuses the key the real catalogue uses. To add a scenario see docs/TEST_FIXTURES.md.
 */
import { SERVICE_CATEGORIES } from '../../data/serviceCategories.js';
import { SERVICE_SCHEMA_VERSION } from '../../data/serviceContract.js';
import { CUSTOM_SERVICES_KEY } from '../../services/serviceCatalog.js';

export const DEFAULT_SEED = 20260101;
export const FIXTURE_ID_PREFIX = 'sample-';
export const FIXTURE_STORAGE_KEY = 'civicbridge_TEST_fixture_services';

// ---- seeded random numbers (mulberry32): small, fast, and the same everywhere -------------------

export function createRng(seed = DEFAULT_SEED) {
  let state = Number.isInteger(seed) ? seed >>> 0 : hashString(String(seed));
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (probability) => next() < probability,
  };
}

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---- fictional vocabulary ----------------------------------------------------------------------

const SUBJECTS = ['Garden', 'Lantern', 'River', 'Harvest', 'Library', 'Bridge', 'Orchard', 'Market', 'Meadow', 'Harbour', 'Workshop', 'Courtyard'];
const DOCUMENT_KINDS = ['Permit', 'Licence', 'Certificate', 'Registration', 'Subsidy', 'Support Card'];
const DEPARTMENTS = ['Department of Sample Affairs', 'Sample Municipal Office', 'Office of Example Services', 'Sample Welfare Board', 'Example Transport Authority'];
const STATES = ['Goa', 'Kerala', 'Sikkim'];
const DISTRICTS = ['North Sample District', 'Example Valley District', 'Test Coast District'];
const LOCAL_BODIES = ['Sample Town Council', 'Example Village Panchayat'];
const FICTIONAL_DATES = ['2025-03-14', '2025-08-02', '2025-11-21', '2026-01-09', '2026-04-27', '2026-07-15'];

// ---- the base record ---------------------------------------------------------------------------

/**
 * A valid, complete record. Call with a generator from createRng(); `index` makes ids unique inside
 * one catalogue. Fields not in the service contract (like `documentRequirements`) are optional.
 */
export function baseService(rng, index = 1) {
  const subject = rng.pick(SUBJECTS);
  const kind = rng.pick(DOCUMENT_KINDS);
  const slug = `${subject}-${kind}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const id = `${FIXTURE_ID_PREFIX}${slug}-${index}`;
  const free = rng.chance(0.4);
  const days = rng.int(1, 45);
  return {
    id,
    name: `Sample ${subject} ${kind}`,
    shortDescription: `A fictional ${kind.toLowerCase()} for the ${subject.toLowerCase()}, used only in tests.`,
    category: rng.pick(SERVICE_CATEGORIES),
    department: rng.pick(DEPARTMENTS),
    type: rng.pick(['Online', 'Offline', 'Online / Offline']),
    difficulty: rng.pick(['Easy', 'Medium', 'Hard']),
    feeType: free ? 'free' : 'paid',
    speedDays: days,
    popularityScore: rng.int(0, 100),
    eligibility: ['Resident of Sampleland', 'Aged 18 or over'],
    documents: ['Sample identity proof', 'Sample address proof'],
    steps: [
      { title: 'Fill the sample form', description: 'Enter the sample details on the example portal.' },
      { title: 'Pay the sample fee', description: free ? 'There is nothing to pay.' : 'Pay the sample fee online.' },
    ],
    fees: free ? 'Free' : `Sample fee of ${rng.int(10, 500)} units`,
    processingTime: `${days} days`,
    officialSources: [{ name: 'Example Sample Portal', url: `https://example.org/sample/${slug}`, verified: true }],
    lastVerified: rng.pick(FICTIONAL_DATES),
  };
}

const cloneWith = (record, changes) => ({ ...structuredClone(record), ...changes });
const without = (record, ...fields) => {
  const copy = structuredClone(record);
  for (const field of fields) delete copy[field];
  return copy;
};

// ---- scenarios ---------------------------------------------------------------------------------

/**
 * Each scenario: description, `valid` (does it satisfy the service contract?), `expectedErrors` (the
 * contract error fields an invalid one must produce, exactly), and build(rng, index) -> record.
 */
const SCENARIOS = new Map();

export function registerScenario(name, definition) {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) throw new Error(`Scenario name "${name}" must be lower-case words joined with "-".`);
  if (SCENARIOS.has(name)) throw new Error(`Scenario "${name}" is already registered.`);
  if (typeof definition?.build !== 'function' || typeof definition.description !== 'string' || typeof definition.valid !== 'boolean') {
    throw new Error(`Scenario "${name}" needs a description, a valid flag and a build function.`);
  }
  if (definition.valid === false && !(Array.isArray(definition.expectedErrors) && definition.expectedErrors.length)) {
    throw new Error(`Invalid scenario "${name}" must list the contract error fields it produces in expectedErrors.`);
  }
  SCENARIOS.set(name, { expectedErrors: [], ...definition });
}

/** Removes a scenario again; for tests that register a temporary one. */
export const unregisterScenario = (name) => SCENARIOS.delete(name);

// valid
registerScenario('complete', { description: 'Every required and optional field present.', valid: true, build: (rng, i) => ({
  ...baseService(rng, i),
  jurisdiction: { level: 'national', states: [], districts: [], localBody: '' },
  publicationState: 'published',
  warnings: ['This is a fictional record for tests.'],
  contacts: [{ label: 'Sample Helpline', phone: '000-000-0000', email: 'help@example.org', url: 'https://example.org/contact' }],
  eligibilityRuleKey: 'sample-rule',
}) });
registerScenario('minimal', { description: 'Only the required fields; every optional field absent.', valid: true, build: (rng, i) => baseService(rng, i) });
registerScenario('draft', { description: 'A draft record that is not public yet.', valid: true, build: (rng, i) => ({ ...baseService(rng, i), publicationState: 'draft' }) });
registerScenario('archived', { description: 'A retired record.', valid: true, build: (rng, i) => ({ ...baseService(rng, i), publicationState: 'archived' }) });
registerScenario('state-specific', { description: 'Applies to one state only.', valid: true, build: (rng, i) => ({
  ...baseService(rng, i),
  jurisdiction: { level: 'state', states: [rng.pick(STATES)], districts: [], localBody: '' },
}) });
registerScenario('district-specific', { description: 'Applies to one district.', valid: true, build: (rng, i) => ({
  ...baseService(rng, i),
  jurisdiction: { level: 'district', states: [rng.pick(STATES)], districts: [rng.pick(DISTRICTS)], localBody: '' },
}) });
registerScenario('local-body-specific', { description: 'Applies to one local body.', valid: true, build: (rng, i) => ({
  ...baseService(rng, i),
  jurisdiction: { level: 'local', states: [rng.pick(STATES)], districts: [rng.pick(DISTRICTS)], localBody: rng.pick(LOCAL_BODIES) },
}) });
registerScenario('legacy-text-jurisdiction', { description: 'Jurisdiction in the retired plain-text form.', valid: false, expectedErrors: ['jurisdiction'], build: (rng, i) => cloneWith(baseService(rng, i), { jurisdiction: 'Goa' }) });
registerScenario('conditional-eligibility', { description: 'Documents and criteria that depend on the applicant.', valid: true, build: (rng, i) => {
  const record = baseService(rng, i);
  return {
    ...record,
    eligibility: ['Resident of Sampleland', 'Aged 60 or over, or with a recorded disability'],
    documents: ['Sample identity proof', 'Sample age proof', 'Sample disability proof'],
    documentRequirements: {
      'Sample age proof': { type: 'conditional', condition: 'The applicant is applying on the age ground.' },
      'Sample disability proof': { type: 'conditional', condition: 'The applicant is applying on the disability ground.' },
    },
    eligibilityRuleKey: 'sample-conditional-rule',
  };
} });
registerScenario('free-and-instant', { description: 'Zero fee and zero processing days (the edge of the number ranges).', valid: true, build: (rng, i) => ({
  ...baseService(rng, i), feeType: 'free', fees: 'Free', speedDays: 0, processingTime: 'Same day', popularityScore: 0,
}) });
registerScenario('long-text', { description: 'Long names, descriptions and many steps, for layout tests.', valid: true, build: (rng, i) => ({
  ...baseService(rng, i),
  name: `Sample ${'Very Long '.repeat(10)}Service`,
  shortDescription: 'A fictional description. '.repeat(40).trim(),
  steps: Array.from({ length: 12 }, (_, n) => ({ title: `Sample step ${n + 1}`, description: 'A fictional instruction. '.repeat(8).trim() })),
}) });

// partial (valid for the contract, but with gaps a coverage report would show)
registerScenario('no-documents', { description: 'An empty documents list (allowed by the contract).', valid: true, build: (rng, i) => ({ ...baseService(rng, i), documents: [] }) });
registerScenario('no-eligibility', { description: 'An empty eligibility list (allowed by the contract).', valid: true, build: (rng, i) => ({ ...baseService(rng, i), eligibility: [] }) });

// invalid
registerScenario('invalid-missing-id', { description: 'No id.', valid: false, expectedErrors: ['id'], build: (rng, i) => without(baseService(rng, i), 'id') });
registerScenario('invalid-id-format', { description: 'An id that is not a lower-case slug.', valid: false, expectedErrors: ['id'], build: (rng, i) => cloneWith(baseService(rng, i), { id: 'sample-Service!' }) });
registerScenario('invalid-category', { description: 'A category that is not in the list.', valid: false, expectedErrors: ['category'], build: (rng, i) => cloneWith(baseService(rng, i), { category: 'Not A Category' }) });
registerScenario('invalid-missing-department', { description: 'No department.', valid: false, expectedErrors: ['department'], build: (rng, i) => without(baseService(rng, i), 'department') });
registerScenario('invalid-fee-type', { description: 'A fee type that does not exist.', valid: false, expectedErrors: ['feeType'], build: (rng, i) => cloneWith(baseService(rng, i), { feeType: 'maybe' }) });
registerScenario('invalid-negative-speed', { description: 'Negative processing days.', valid: false, expectedErrors: ['speedDays'], build: (rng, i) => cloneWith(baseService(rng, i), { speedDays: -3 }) });
registerScenario('invalid-http-source', { description: 'An official source that is not https.', valid: false, expectedErrors: ['officialSources[0].url'], build: (rng, i) => cloneWith(baseService(rng, i), { officialSources: [{ name: 'Example Sample Portal', url: 'http://example.org/sample' }] }) });
registerScenario('invalid-no-sources', { description: 'An empty list of official sources.', valid: false, expectedErrors: ['officialSources'], build: (rng, i) => cloneWith(baseService(rng, i), { officialSources: [] }) });
registerScenario('invalid-date', { description: 'A date that does not exist.', valid: false, expectedErrors: ['lastVerified'], build: (rng, i) => cloneWith(baseService(rng, i), { lastVerified: '2026-02-30' }) });
registerScenario('invalid-no-steps', { description: 'No steps.', valid: false, expectedErrors: ['steps'], build: (rng, i) => cloneWith(baseService(rng, i), { steps: [] }) });
registerScenario('invalid-step-shape', { description: 'A step without a description.', valid: false, expectedErrors: ['steps[0]'], build: (rng, i) => cloneWith(baseService(rng, i), { steps: [{ title: 'Only a title' }] }) });
registerScenario('invalid-publication-state', { description: 'A publication state that does not exist.', valid: false, expectedErrors: ['publicationState'], build: (rng, i) => cloneWith(baseService(rng, i), { publicationState: 'pending' }) });
registerScenario('invalid-jurisdiction-level', { description: 'A jurisdiction level that does not exist.', valid: false, expectedErrors: ['jurisdiction'], build: (rng, i) => cloneWith(baseService(rng, i), { jurisdiction: { level: 'galaxy' } }) });
registerScenario('invalid-contact', { description: 'A contact with no way to reach it.', valid: false, expectedErrors: ['contacts[0]'], build: (rng, i) => cloneWith(baseService(rng, i), { contacts: [{ label: 'Sample Helpline' }] }) });
registerScenario('invalid-personal-data', { description: 'A record that wrongly carries personal data (fictional values).', valid: false, expectedErrors: ['email', 'phone'], build: (rng, i) => cloneWith(baseService(rng, i), { email: 'person@example.org', phone: '000-000-0000' }) });
registerScenario('invalid-wrong-types', { description: 'Fields with the wrong types.', valid: false, expectedErrors: ['name', 'documents', 'fees'], build: (rng, i) => cloneWith(baseService(rng, i), { name: 42, documents: 'Sample identity proof', fees: { amount: 5 } }) });

// ---- the public functions ---------------------------------------------------------------------------------

export const listScenarios = () =>
  [...SCENARIOS.entries()].map(([name, s]) => ({ name, description: s.description, valid: s.valid, expectedErrors: [...s.expectedErrors] }));

export const scenarioNames = () => [...SCENARIOS.keys()];

/** One record for a scenario. A fresh object every call, identical for the same seed and index. */
export function getScenario(name, { seed = DEFAULT_SEED, index = 1 } = {}) {
  const scenario = SCENARIOS.get(name);
  if (!scenario) throw new Error(`Unknown fixture scenario "${name}". Known: ${scenarioNames().join(', ')}`);
  return scenario.build(createRng(`${seed}:${name}:${index}`), index);
}

/**
 * A catalogue envelope { schemaVersion, services } of synthetic records.
 *   count            how many records (default 12)
 *   scenarios        names to cycle through; default: every valid scenario
 *   includeInvalid   true adds one record of each invalid scenario at the end
 * Ids are unique unless a scenario deliberately removes or breaks them.
 */
export function buildCatalogue({ seed = DEFAULT_SEED, count = 12, scenarios, includeInvalid = false } = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 1000) throw new RangeError('count must be a whole number from 0 to 1000');
  const names = scenarios ?? listScenarios().filter((s) => s.valid).map((s) => s.name);
  if (names.length === 0) throw new Error('scenarios must not be empty');
  const services = Array.from({ length: count }, (_, n) => getScenario(names[n % names.length], { seed, index: n + 1 }));
  if (includeInvalid) {
    listScenarios()
      .filter((s) => !s.valid)
      .forEach((s, n) => services.push(getScenario(s.name, { seed, index: count + n + 1 })));
  }
  return { schemaVersion: SERVICE_SCHEMA_VERSION, services };
}

/** True when a record is clearly synthetic: a sample id and links only to reserved example domains. */
export function isSyntheticRecord(record) {
  if (!record || typeof record !== 'object') return false;
  if (typeof record.id === 'string' && record.id && !record.id.startsWith(FIXTURE_ID_PREFIX)) return false;
  const urls = JSON.stringify(record).match(/https?:\/\/[^\s"']+/g) ?? [];
  return urls.every((url) => /^https?:\/\/(?:[a-z0-9-]+\.)*example\.(?:org|com|net)(?:[/:?#]|$)/i.test(url));
}

/**
 * Writes a catalogue to a storage you pass in (a localStorage-like object). It never writes to the
 * key the real catalogue uses, and only synthetic records are accepted.
 */
export function writeFixtureCatalogue(storage, catalogue, { key = FIXTURE_STORAGE_KEY } = {}) {
  if (!storage || typeof storage.setItem !== 'function') throw new TypeError('Pass the storage to write to; fixtures are never written anywhere by default.');
  if (key === CUSTOM_SERVICES_KEY) throw new Error('Refusing to write fixtures to the key the real catalogue uses.');
  const services = Array.isArray(catalogue?.services) ? catalogue.services : [];
  const real = services.filter((record) => !isSyntheticRecord(record));
  if (real.length) throw new Error(`Refusing to write ${real.length} record(s) that do not look synthetic.`);
  storage.setItem(key, JSON.stringify(services));
  return key;
}
