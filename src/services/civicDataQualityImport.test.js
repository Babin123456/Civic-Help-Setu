import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_SERVICES } from '../data/services.js';
import { buildImportPreview } from './serviceImportService.js';
import { importAdminServices } from './adminService.js';
import { setCurrentActor } from './accessControl.js';
const copy = value => JSON.parse(JSON.stringify(value));
const record = () => ({ ...copy(MOCK_SERVICES[0]), id: 'synthetic-contract-guide', name: 'Synthetic Contract Guide' });
let storage;
beforeEach(() => {
  const data = new Map();
  storage = { getItem: vi.fn(key => data.get(key) ?? null), setItem: vi.fn((key, value) => data.set(key, value)) };
  vi.stubGlobal('localStorage', storage); setCurrentActor({ role: 'admin', username: 'Synthetic Admin' });
});
describe('versioned import preview and write boundary', () => {
  it('accepts an explicit valid contract and persists its version through the existing admin path', () => {
    const report = buildImportPreview(JSON.stringify({ contractVersion: '1.0.0', services: [record()] }), { fileName: 'services.json' });
    expect(report.invalid).toEqual([]); expect(report.fileErrors).toEqual([]); expect(report.valid).toHaveLength(1);
    expect(report.valid[0].service.dataContract).toEqual({ type: 'service', version: '1.0.0' });
    expect(importAdminServices(report.valid.map(row => row.service)).imported).toBe(1);
    expect(JSON.parse(storage.getItem('civicbridge_custom_services'))[0].dataContract.version).toBe('1.0.0');
  });
  it('does not silently downgrade unsupported contracts or retain rejected raw values', () => {
    const report = buildImportPreview(JSON.stringify({ contractVersion: '99.0.0', services: [record()] }), { fileName: 'services.json' });
    expect(report.valid).toHaveLength(0); expect(report.invalid).toHaveLength(1);
    expect(report.invalid[0].errors[0]).toContain('unsupported contract');
  });
  it('revalidates after preview tampering, leaves storage untouched and enforces permissions first', () => {
    const tagged = { ...record(), dataContract: { type: 'service', version: '1.0.0' }, popularityScore: -1 };
    expect(importAdminServices([tagged]).ok).toBe(false); expect(storage.setItem).not.toHaveBeenCalled();
    setCurrentActor(null); expect(() => importAdminServices([tagged])).toThrow(); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('quarantines invalid strict rows while preserving legacy imports', () => {
    const bad = record(); bad.lastVerified = '2026-02-30';
    const strict = buildImportPreview(JSON.stringify({ contractVersion: '1.0.0', services: [bad, record()] }), { fileName: 'services.json' });
    expect(strict.invalid).toHaveLength(2); // duplicate IDs are never arbitrarily selected
    const legacy = buildImportPreview(JSON.stringify([{ name: 'Legacy Guide', shortDescription: 'Synthetic legacy description', category: 'Identity', officialSources: [{ url: 'https://example.gov.in' }] }]), { fileName: 'legacy.json' });
    expect(legacy.valid).toHaveLength(1); expect(legacy.valid[0].service.dataContract).toBeUndefined();
  });
  it('does not damage existing records if a versioned import cannot be written', () => {
    const tagged = { ...record(), dataContract: { type: 'service', version: '1.0.0' } };
    storage.setItem.mockImplementation(() => { throw new Error('synthetic quota failure'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(importAdminServices([tagged]).ok).toBe(false);
    expect(storage.getItem('civicbridge_custom_services')).toBeNull();
  });
});
