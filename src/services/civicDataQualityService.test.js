import { describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { CIVIC_CONTRACT_REGISTRY, MAX_DATASET_ROWS, validateCivicDataset } from './civicDataQualityService.js';
import { MOCK_SERVICES } from '../data/services.js';
import { VERIFIED_COMMUNITY_FACILITIES } from '../data/communityFacilities.js';

const copy = value => JSON.parse(JSON.stringify(value));
const metadata = (id, extra = {}) => ({ id, name: `Synthetic ${id}`, lastVerified: '2026-01-15', officialSources: [{ name: 'Synthetic authority', url: 'https://example.gov.in/source' }], ...extra });
const entry = (type, record) => ({ type, version: '1.0.0', record: copy(record) });
const dataset = entities => ({ registryVersion: 1, entities });
const authority = id => entry('authority', metadata(id, { jurisdiction: { level: 'national', states: [], districts: [], localBody: '' } }));
const service = extra => entry('service', { ...copy(MOCK_SERVICES[0]), id: 'sample-service', ...extra });
const mixed = () => dataset([
  service({ authorityId: 'sample-authority', documentIds: ['sample-document'], deadlineIds: ['sample-deadline'] }),
  entry('deadline', metadata('sample-deadline', { serviceId: 'sample-service', documentId: 'sample-document', dueDate: '2026-12-01' })),
  entry('document', metadata('sample-document', { authorityId: 'sample-authority', validityDays: 365 })),
  authority('sample-authority'),
  entry('publicFacility', { ...copy(VERIFIED_COMMUNITY_FACILITIES[0]), authorityId: 'sample-authority' }),
]);

describe('public civic data contracts', () => {
  it('accepts all five domains, forward references and a valid service/deadline cycle without mutating input', () => {
    const input = mixed(); const original = copy(input);
    const result = validateCivicDataset(input);
    expect(result.quarantined).toEqual([]); expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true); expect(result.accepted).toHaveLength(5);
    result.accepted[0].record.name = 'changed by caller';
    expect(input).toEqual(original);
  });

  it.each([
    ['service', value => { value.entities[0].record.popularityScore = -1; }],
    ['publicFacility', value => { value.entities[4].record.pincode = 'bad'; }],
    ['authority', value => { value.entities[3].record.jurisdiction = null; }],
    ['document', value => { value.entities[2].record.validityDays = 0; }],
    ['deadline', value => { value.entities[1].record.dueDate = '2026-02-30'; }],
  ])('rejects invalid %s domain fields and dependents', (_type, invalidate) => {
    const input = mixed(); invalidate(input);
    const result = validateCivicDataset(input);
    expect(result.valid).toBe(false);
    expect(result.quarantined.length).toBeGreaterThan(0);
    for (const row of result.accepted) expect(row.record).not.toEqual(input.entities.find(item => item.type === _type)?.record);
  });

  it('quarantines missing references and their dependents while preserving an unrelated valid row', () => {
    const input = mixed(); input.entities.splice(3, 1); input.entities.push(authority('unrelated'));
    const result = validateCivicDataset(input);
    expect(result.accepted.map(row => row.record.id)).toEqual(['unrelated']);
    expect(result.quarantined).toHaveLength(4);
    expect(result.quarantined.every(row => row.errors.some(error => error.code === 'INVALID_REFERENCE'))).toBe(true);
  });

  it('quarantines both duplicate IDs, never arbitrarily choosing one', () => {
    const result = validateCivicDataset(dataset([authority('duplicate'), authority('duplicate')]));
    expect(result.accepted).toHaveLength(0); expect(result.quarantined).toHaveLength(2);
    expect(result.quarantined[0].errors[0].code).toBe('DUPLICATE_ID');
  });

  it.each([['document', '1.1.0'], ['unknown', '1.0.0'], ['constructor', '1.0.0']])('fails closed for %s at %s', (type, version) => {
    const result = validateCivicDataset(dataset([{ type, version, record: metadata('sample') }]));
    expect(result.quarantined[0].errors[0].code).toBe('UNSUPPORTED_CONTRACT');
  });

  it('does not expose or retain rejected citizen content in diagnostics', () => {
    const input = mixed(); input.entities[2].record.extra = { aadhaarNumber: 'SYNTHETIC_PRIVATE_SENTINEL' };
    const result = validateCivicDataset(input);
    expect(result.accepted).toEqual([]); expect(result.errors[0].code).toBe('UNSAFE_INPUT');
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
  });

  it('rejects cyclic, non-JSON, deeply nested, oversized and row-flood inputs', () => {
    const circular = {}; circular.self = circular;
    const deep = {}; let node = deep; for (let i = 0; i < 25; i++) node = node.next = {};
    for (const input of [circular, deep, { entities: [undefined] }, { amount: Infinity }, JSON.parse('{"__proto__":{}}')]) expect(validateCivicDataset(input).errors[0].code).toBe('UNSAFE_INPUT');
    expect(validateCivicDataset({ text: 'x'.repeat(1024 * 1024) }).errors[0].code).toBe('BYTE_LIMIT');
    expect(validateCivicDataset(dataset(Array.from({ length: 501 }, (_, index) => authority(`authority-${index}`)))).errors[0].code).toBe('ROW_LIMIT');
  });

  it('handles a throwing input accessor without leaking its exception', () => {
    const bad = { get entities() { throw new Error('SYNTHETIC_PRIVATE_SENTINEL'); } };
    expect(validateCivicDataset(bad).errors[0].code).toBe('UNSAFE_INPUT');
    expect(JSON.stringify(validateCivicDataset(bad))).not.toContain('SENTINEL');
  });

  it('rejects undeclared fields and null optional values on new public metadata adapters', () => {
    const input = dataset([authority('sample')]); input.entities[0].record.extra = 'unexpected';
    expect(validateCivicDataset(input).quarantined[0].errors[0].code).toBe('UNKNOWN_FIELD');
    const docs = mixed(); docs.entities[2].record.validityDays = null;
    expect(validateCivicDataset(docs).valid).toBe(false);
  });

  it('validates a maximum-size batch within a coarse regression budget', () => {
    const input = dataset(Array.from({ length: MAX_DATASET_ROWS }, (_, index) => authority(`authority-${index}`)));
    const start = performance.now(); const result = validateCivicDataset(input);
    expect(result.valid).toBe(true); expect(result.metrics.accepted).toBe(500);
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('isolates simultaneous producer validations and cannot mutate the frozen registry', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, async (_, index) => validateCivicDataset(dataset([authority(`authority-${index}`)]))));
    results.forEach((result, index) => expect(result.accepted[0].record.id).toBe(`authority-${index}`));
    expect(() => { CIVIC_CONTRACT_REGISTRY.contracts[0].owner = 'changed'; }).toThrow();
  });
});
