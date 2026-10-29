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
      ...valid(), jurisdiction: 'Delhi', publicationState: 'draft', warnings: ['Carry originals'],
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
    expect(out).toMatchObject({ publicationState: 'published', jurisdiction: 'India', warnings: [], contacts: [] });
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
