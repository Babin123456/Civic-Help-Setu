import { describe, it, expect } from 'vitest';
import registry from './registry.json';
import { assertEventContract, checkEventRegistry, eventContractImpact, validateEventPayload, consumerContractVersions } from './eventCompatibility.js';

const now = Date.parse('2026-11-25T00:00:00Z');
const copy = () => structuredClone(registry);
const strict = value => value.events.releases.find(row => row.version === '2.0.0');
const addVersion = (value, version = '2.1.0') => {
  const release = { ...structuredClone(strict(value)), version };
  value.events.releases.push(release);
  value.events.changes.push({ eventType: release.eventType, version, owner: 'test-owner', reason: 'Synthetic change', migration: 'Keep old producers; upgrade consumer declarations before opt-in.' });
  return release;
};

describe('event registry compatibility and generated contracts', () => {
  it('validates the shipped registry and bootstrap migration', () => {
    expect(checkEventRegistry(registry, null, now)).toEqual([]);
    expect(checkEventRegistry(registry, registry, now)).toEqual([]);
  });

  it.each(registry.events.releases)('generates valid samples for $eventType@$version', release => {
    for (const sample of release.samples) expect(validateEventPayload(release, sample)).toEqual([]);
  });

  it('accepts additive optional fields with a new minor release, and reports affected owners', () => {
    const next = copy(); const release = addVersion(next);
    release.schema.properties.channel = { type: 'string' };
    next.events.consumers.push({ id: 'synthetic-reader', owner: 'test-owner', status: 'active', eventTypes: ['APPLICATION_SUBMITTED'], contractVersions: { APPLICATION_SUBMITTED: ['1.0.0'] } });
    expect(checkEventRegistry(next, registry, now)).toEqual([]);
    expect(eventContractImpact(next, registry)).toEqual([expect.objectContaining({ version: '2.1.0', owner: 'GoldRay19', consumers: [{ id: 'synthetic-reader', owner: 'test-owner', acceptsVersion: false }] })]);
  });

  it.each(['remove', 'type', 'required'])('rejects incompatible %s changes in a minor version', change => {
    const next = copy(); const release = addVersion(next);
    if (change === 'remove') { delete release.schema.properties.serviceId; release.schema.required = []; }
    if (change === 'type') release.schema.properties.serviceId = { type: 'integer' };
    if (change === 'required') { release.schema.properties.extra = { type: 'string' }; release.schema.required.push('extra'); }
    release.samples = [change === 'type' ? { serviceId: 3 } : change === 'required' ? { serviceId: 'SYNTHETIC', extra: 'value' } : {}];
    expect(checkEventRegistry(next, registry, now).join('\n')).toContain('incompatible changes require');
  });

  it('allows a separate major version with a migration, while retaining all old contracts', () => {
    const next = copy(); const release = addVersion(next, '3.0.0');
    release.schema.properties.serviceId = { type: 'integer' }; release.samples = [{ serviceId: 7 }];
    expect(checkEventRegistry(next, registry, now)).toEqual([]);
    next.events.changes.at(-1).migration = '';
    expect(checkEventRegistry(next, registry, now).join('\n')).toContain('migration instructions');
  });

  it('never permits rewriting a published release, removing schemas, or erasing audit history', () => {
    const rewritten = copy(); strict(rewritten).schema.properties.serviceId.type = 'number';
    expect(checkEventRegistry(rewritten, registry, now).join('\n')).toContain('published releases are immutable');
    const removed = copy(); removed.events.releases.pop();
    expect(checkEventRegistry(removed, registry, now).join('\n')).toContain('must remain available');
    const history = copy(); history.events.changes.pop();
    expect(checkEventRegistry(history, registry, now).join('\n')).toContain('Historical event change records');
  });

  it('rejects unsupported schema keywords, malformed registry rows and invalid samples', () => {
    const unsupported = copy(); strict(unsupported).schema.anyOf = [];
    expect(checkEventRegistry(unsupported, registry, now).join('\n')).toContain('unsupported schema keyword');
    const invalid = copy(); strict(invalid).samples = [{ serviceId: 7 }];
    expect(checkEventRegistry(invalid, null, now).join('\n')).toContain('sample:');
    const malformed = copy(); malformed.events.releases.push(null);
    expect(checkEventRegistry(malformed, registry, now)).toEqual(['Event registry records must be objects']);
  });

  it('enforces real deprecation notice and producer admission, with no backdating shortcut', () => {
    const next = copy(); next.events.deprecations.push({ eventType: 'APPLICATION_SUBMITTED', version: '1.0.0', owner: 'test-owner', announcedAt: '2026-11-25T00:00:00Z', sunsetAt: '2026-12-03T00:00:00Z', migration: 'Upgrade consumers then producer to2.0.0.' });
    expect(checkEventRegistry(next, registry, now)).toEqual([]);
    expect(() => assertEventContract(next.events, 'APPLICATION_SUBMITTED', '1.0.0', 'CIVIC_CORE', {}, now)).not.toThrow();
    expect(() => assertEventContract(next.events, 'APPLICATION_SUBMITTED', '1.0.0', 'CIVIC_CORE', {}, Date.parse('2026-12-03T00:00:00Z'))).toThrow('admission window');
    next.events.deprecations[0].announcedAt = '2026-11-01T00:00:00Z'; next.events.deprecations[0].sunsetAt = '2026-11-26T00:00:00Z';
    expect(checkEventRegistry(next, registry, now).join('\n')).toContain('full notice window');
  });

  it('blocks expired consumers and requires explicit inventory retirement instead of deleting them', () => {
    const previous = copy(); previous.events.consumers.push({ id: 'synthetic-reader', owner: 'test-owner', status: 'active', eventTypes: ['APPLICATION_SUBMITTED'], contractVersions: { APPLICATION_SUBMITTED: ['1.0.0'] } });
    const next = structuredClone(previous); const retirement = { eventType: 'APPLICATION_SUBMITTED', version: '1.0.0', owner: 'test-owner', announcedAt: '2026-11-01T00:00:00Z', sunsetAt: '2026-11-20T00:00:00Z', migration: 'Use2.0.0 after consumer rollout.' };previous.events.deprecations.push(retirement); next.events.deprecations.push(retirement);
    expect(checkEventRegistry(next, previous, now).join('\n')).toContain('no supported version remains');
    next.events.consumers[0].contractVersions.APPLICATION_SUBMITTED.push('2.0.0');
    expect(checkEventRegistry(next, previous, now)).toEqual([]);
    next.events.consumers = [];
    expect(checkEventRegistry(next, previous, now).join('\n')).toContain('explicit retired inventory entry');
  });

  it('rejects undeclared producer versions, payload limits and unknown consumer declarations', () => {
    expect(() => assertEventContract(registry.events, 'APPLICATION_SUBMITTED', '9.0.0', 'CIVIC_CORE', {}, now)).toThrow('Unknown event contract');
    expect(() => assertEventContract(registry.events, 'APPLICATION_SUBMITTED', '2.0.0', 'UNKNOWN_PRODUCER', { serviceId: 'fixture' }, now)).toThrow('Producer is not declared');
    expect(validateEventPayload(strict(registry), { serviceId: 'fixture', extra: 'x'.repeat(70000) })).toContain('Payload exceeds the configured byte limit');
    expect(() => consumerContractVersions(registry.events, ['APPLICATION_SUBMITTED'], { APPLICATION_SUBMITTED: ['9.0.0'] })).toThrow('Invalid consumer');
  });
});
