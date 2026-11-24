import { describe, expect, it } from 'vitest';
import registry from './registry.json';
import { checkContractRegistry } from './compatibility.js';
const copy = () => JSON.parse(JSON.stringify(registry));
describe('contract history gate', () => {
  it('accepts bootstrap and unchanged history', () => {
    expect(checkContractRegistry(registry)).toEqual([]);
    expect(checkContractRegistry(registry, copy())).toEqual([]);
  });
  it('requires version and owned audit entries for a change', () => {
    const next = copy(); next.contracts[0].owner = 'new-owner';
    expect(checkContractRegistry(next, registry)).toContain('Changed contract must increase its semantic version.');
    next.contracts[0].version = '1.1.0';
    expect(checkContractRegistry(next, registry)).toContain('Contract change needs an owned change record.');
    next.changes.push({ version: '1.1.0', owner: 'new-owner', reason: 'Ownership transfer with no validation change.' });
    expect(checkContractRegistry(next, registry)).toEqual([]);
  });
  it('requires a major version for a narrowing or required new field and preserves audit history', () => {
    const next = copy(); next.contracts[0].version = '1.1.0'; next.contracts[0].fields.newField = { type: 'text', required: true };
    next.changes.push({ version: '1.1.0', owner: 'catalogue', reason: 'Require another field.' });
    expect(checkContractRegistry(next, registry)).toContain('Breaking changes require a major version and migration notes.');
    next.contracts[0].version = '2.0.0'; next.changes[1].version = '2.0.0'; next.changes[1].migration = 'Populate newField before opt-in re-import; keep legacy readers and roll back producer version if validation fails.';
    expect(checkContractRegistry(next, registry)).toEqual([]);
    next.changes.shift(); expect(checkContractRegistry(next, registry)).toContain('Historical change records must be preserved.');
  });
  it('rejects malformed contract metadata without crashing', () => {
    const next = copy(); next.contracts[0].version = null; next.contracts[1].owner = 42; next.contracts[2].fields.id = null;
    expect(checkContractRegistry(next).length).toBeGreaterThan(0);
    expect(checkContractRegistry({ registryVersion: 1, contracts: [null], changes: [] }).length).toBeGreaterThan(0);
  });
  it('rejects domain deletion, duplicate IDs, unknown references and missing ownership', () => {
    const next = copy(); next.contracts.pop(); next.contracts[0].owner = ''; next.contracts[0].fields.authorityId.reference = 'missing';
    expect(checkContractRegistry(next, registry).length).toBeGreaterThan(0);
    next.contracts.push(next.contracts[0]); expect(checkContractRegistry(next, registry).length).toBeGreaterThan(0);
  });
});
