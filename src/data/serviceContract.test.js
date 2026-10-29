import { describe, expect, it } from 'vitest';
import {
  SERVICE_SCHEMA_VERSION, applyServiceDefaults, formatContractError,
  validateCatalogue, validateServiceRecord,
} from './serviceContract';
import { MOCK_SERVICES } from './services';

const valid = () => ({
  id: 'voter-id', name: 'Voter ID', shortDescription: 'Electoral photo identity card.',
  category: 'Identity', department: 'Election Commission', type: 'Online',
  difficulty: 'Easy', feeType: 'free', speedDays: 30,
  eligibility: ['Indian citizen aged 18 or above'], documents: ['Proof of age'],
  steps: [{ title: 'Apply', description: 'Submit the form online.' }],
  fees: 'Free', processingTime: '30 days',
  officialSources: [{ name: 'ECI', url: 'https://eci.gov.in' }],
  lastVerified: '2024-01-15',
});
const fields = (r) => validateServiceRecord(r).map((e) => e.field);

describe('validateServiceRecord', () => {
  it('accepts a valid record with only required fields', () => {
    expect(validateServiceRecord(valid())).toEqual([]);
  });

  it('accepts optional fields when valid', () => {
    const r = {
      ...valid(), jurisdiction: { level: 'state', states: ['Delhi'], districts: [], localBody: '' }, publicationState: 'draft', warnings: ['Carry originals'],
      contacts: [{ label: 'Helpline', phone: '1950' }, { label: 'Web', url: 'https://eci.gov.in' }],
    };
    expect(validateServiceRecord(r)).toEqual([]);
  });

  it('names the field and reason for a missing id', () => {
    const r = valid();
    delete r.id;
    const [e] = validateServiceRecord(r);
    expect(e.field).toBe('id');
    expect(e.reason).toMatch(/slug/);
  });

  it.each([
    ['category', { category: 'Nonsense' }],
    ['difficulty', { difficulty: 'Impossible' }],
    ['feeType', { feeType: 'maybe' }],
    ['speedDays', { speedDays: -2 }],
    ['lastVerified', { lastVerified: '2024-02-30' }],
    ['steps[0]', { steps: [{ title: 'x' }] }],
    ['officialSources[0].url', { officialSources: [{ name: 'A', url: 'http://insecure.example' }] }],
    ['publicationState', { publicationState: 'live' }],
    ['contacts[0]', { contacts: [{ label: 'Empty' }] }],
    ['contacts[0].email', { contacts: [{ label: 'Mail', email: 'nope' }] }],
  ])('rejects invalid %s', (field, patch) => {
    expect(fields({ ...valid(), ...patch })).toContain(field);
  });

  it('rejects personal data fields', () => {
    const f = fields({ ...valid(), aadhaarNumber: '1234', email: 'a@b.in' });
    expect(f).toEqual(expect.arrayContaining(['aadhaarNumber', 'email']));
  });

  it('rejects non-objects', () => {
    expect(validateServiceRecord(null)[0].field).toBe('(record)');
  });
});

describe('applyServiceDefaults', () => {
  it('fills optional fields without mutating the input', () => {
    const input = valid();
    const out = applyServiceDefaults(input);
    expect(out).toMatchObject({ publicationState: 'published', warnings: [], contacts: [] });
    expect(out.jurisdiction).toBeUndefined();
    expect(input.publicationState).toBeUndefined();
  });
});

describe('validateCatalogue', () => {
  it('validates the shipped catalogue against the contract', () => {
    const result = validateCatalogue({ schemaVersion: SERVICE_SCHEMA_VERSION, services: MOCK_SERVICES });
    expect(result.errors.map(formatContractError)).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('fails with a diagnostic for an unsupported version', () => {
    const { valid: ok, errors } = validateCatalogue({ schemaVersion: 2, services: [] });
    expect(ok).toBe(false);
    expect(errors[0].reason).toMatch(/unsupported schema version 2.*supported versions: 1/);
  });

  it('fails when the version is missing', () => {
    expect(validateCatalogue({ services: [] }).errors[0].field).toBe('schemaVersion');
  });

  it('reports the service id with each error and catches duplicates', () => {
    const bad = { ...valid(), id: 'other-service', difficulty: 'x' };
    const { errors } = validateCatalogue({ schemaVersion: 1, services: [valid(), valid(), bad] });
    expect(errors.some((e) => e.field === 'id' && /duplicates/.test(e.reason))).toBe(true);
    expect(errors.some((e) => e.serviceId === 'other-service' && e.field === 'difficulty')).toBe(true);
  });
});

describe('jurisdiction', () => {
  const base = () => structuredClone(MOCK_SERVICES[0]);
  const withJurisdiction = (jurisdiction) => validateServiceRecord({ ...base(), jurisdiction }).map((e) => `${e.field} ${e.reason}`);

  it('accepts valid structured jurisdictions', () => {
    expect(withJurisdiction({ level: 'national', states: [], districts: [], localBody: '' })).toEqual([]);
    expect(withJurisdiction({ level: 'state', states: ['Kerala'], districts: [], localBody: '' })).toEqual([]);
    expect(withJurisdiction({ level: 'district', states: ['Kerala'], districts: ['Kochi'] })).toEqual([]);
  });

  it('rejects legacy text and other types', () => {
    for (const v of ['India', '   ', 5, [], null]) {
      expect(withJurisdiction(v)[0]).toMatch(/^jurisdiction must be \{ level/);
    }
    expect(withJurisdiction({ level: 'galaxy' })[0]).toMatch(/^jurisdiction /);
    expect(withJurisdiction({})[0]).toMatch(/^jurisdiction /);
  });

  it('applies the same rules as the app', () => {
    expect(withJurisdiction({ level: 'state' })[0]).toMatch(/at least one state/);
    expect(withJurisdiction({ level: 'national', states: ['Kerala'] })[0]).toMatch(/national service cannot list/);
    expect(withJurisdiction({ level: 'state', states: ['Atlantis'] })[0]).toMatch(/not a recognised state/);
  });

});

describe('personal data in nested objects', () => {
  const base = () => structuredClone(MOCK_SERVICES[0]);
  const fields = (r) => validateServiceRecord(r).map((e) => e.field);

  it('rejects forbidden keys inside steps and contacts', () => {
    const r = base();
    r.steps = [{ title: 'a', description: 'b', aadhaar: '1234' }];
    r.contacts = [{ label: 'x', phone: '1950', address: 'Some street' }];
    expect(fields(r)).toEqual(expect.arrayContaining(['steps[0].aadhaar', 'contacts[0].address']));
  });

  it('still allows phone and email on a contact, but not elsewhere nested', () => {
    const ok = { ...base(), contacts: [{ label: 'x', phone: '1950', email: 'help@gov.in' }] };
    expect(validateServiceRecord(ok)).toEqual([]);
    const bad = { ...base(), steps: [{ title: 'a', description: 'b', email: 'me@x.in' }] };
    expect(fields(bad)).toContain('steps[0].email');
  });

  it('does not let a falsy phone or a non-string email count as contact details', () => {
    const r = { ...base(), contacts: [{ label: 'x', phone: 0 }, { label: 'y', email: '' }, { label: 'z', email: 5 }] };
    expect(fields(r)).toEqual(expect.arrayContaining(['contacts[0].phone', 'contacts[1].email', 'contacts[2].email']));
  });
});
