import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminServices, getAuditLogs, importAdminServices } from './adminService';
import { MOCK_SERVICES } from '../data/services';
import { setCurrentActor } from './accessControl';

// These tests are about what the admin features do; who may use them is tested in accessControl.test.js.
setCurrentActor({ role: 'admin', username: 'Test Admin' });

const SERVICES_KEY = 'civicbridge_custom_services';

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: vi.fn((k) => (data.has(k) ? data.get(k) : null)),
    setItem: vi.fn((k, v) => data.set(k, String(v))),
    removeItem: vi.fn((k) => data.delete(k)),
  };
};

const service = (name, id) => ({
  id: id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  shortDescription: `About ${name}`,
  category: 'Identity',
  officialSources: [{ name: 'Portal', url: 'https://example.gov.in', verified: true }],
});

let storage;
beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal('localStorage', storage);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('importAdminServices', () => {
  it('saves all services in one write and logs the import', () => {
    const existing = [service('Already Custom')];
    storage.setItem(SERVICES_KEY, JSON.stringify(existing));
    storage.setItem.mockClear();

    const result = importAdminServices([service('One'), service('Two')], 'PriyaSharma');

    expect(result).toEqual({ ok: true, imported: 2, skipped: [], error: null });
    const serviceWrites = storage.setItem.mock.calls.filter(([key]) => key === SERVICES_KEY);
    expect(serviceWrites).toHaveLength(1);
    const names = getAdminServices().map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['One', 'Two', 'Already Custom', MOCK_SERVICES[0].name]));

    const [log] = getAuditLogs();
    expect(log).toMatchObject({ action: 'SERVICES_IMPORTED', actor: 'PriyaSharma', target: '2 services' });
  });

  it('stamps lastVerified with today when the file did not have one', () => {
    importAdminServices([service('One')]);
    const saved = JSON.parse(storage.getItem(SERVICES_KEY));
    expect(saved[0].lastVerified).toBe(new Date().toISOString().split('T')[0]);
  });

  it('leaves existing data untouched when the write fails', () => {
    const existing = JSON.stringify([service('Already Custom')]);
    storage.setItem(SERVICES_KEY, existing);
    storage.setItem.mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    const result = importAdminServices([service('One')]);

    expect(result.ok).toBe(false);
    expect(result.imported).toBe(0);
    expect(result.error).toMatch(/No services were imported/);
    expect(storage.getItem(SERVICES_KEY)).toBe(existing);
  });

  it('refuses to import over corrupted stored data instead of overwriting it', () => {
    storage.setItem(SERVICES_KEY, '{not json');
    storage.setItem.mockClear();

    const result = importAdminServices([service('One')]);

    expect(result.ok).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem(SERVICES_KEY)).toBe('{not json');
  });

  it('skips services that were added after the preview was built', () => {
    storage.setItem(SERVICES_KEY, JSON.stringify([service('Added In Another Tab')]));

    const result = importAdminServices([service('added in another tab', 'other-id'), service('Fresh')]);

    expect(result).toMatchObject({ ok: true, imported: 1, skipped: ['added in another tab'] });
  });

  it('never overwrites a built-in service', () => {
    const result = importAdminServices([service('Birth Cert Copy', MOCK_SERVICES[0].id)]);
    expect(result).toMatchObject({ imported: 0, skipped: ['Birth Cert Copy'] });
  });
});
