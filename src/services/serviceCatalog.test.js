import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllServices, getServiceById, CUSTOM_SERVICES_KEY } from './serviceCatalog';
import { saveAdminService, getAdminServices, importAdminServices } from './adminService';
import { rankAndFilterServices } from './searchRankingEngine';
import { comparisonService } from './comparisonService';
import { MOCK_SERVICES } from '../data/services';
import { setCurrentActor } from './accessControl';

// These tests are about what the admin features do; who may use them is tested in accessControl.test.js.
setCurrentActor({ role: 'admin', username: 'Test Admin' });

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: vi.fn((k) => (data.has(k) ? data.get(k) : null)),
    setItem: vi.fn((k, v) => data.set(k, String(v))),
    removeItem: vi.fn((k) => data.delete(k)),
  };
};

let storage;
beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal('localStorage', storage);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const zebra = {
  name: 'Zebra Crossing Permit',
  category: 'Certificates',
  type: 'Online / Offline',
  shortDescription: 'Permit to paint a zebra crossing outside a school.',
};

describe('getAllServices', () => {
  it('is just the built-in guides when nothing is saved', () => {
    expect(getAllServices()).toEqual(MOCK_SERVICES);
  });

  it('does not hand out the built-in array itself', () => {
    expect(getAllServices()).not.toBe(MOCK_SERVICES);
  });

  it('includes a guide the admin added', () => {
    saveAdminService(zebra, 'tester');
    const all = getAllServices();
    expect(all).toHaveLength(MOCK_SERVICES.length + 1);
    expect(all.find((s) => s.id === 'zebra-crossing-permit').name).toBe('Zebra Crossing Permit');
  });

  it('shows an admin edit of a built-in guide instead of the original, once', () => {
    const original = MOCK_SERVICES[0];
    saveAdminService({ ...original, fees: 'Edited fee text' }, 'tester');
    const all = getAllServices();
    expect(all).toHaveLength(MOCK_SERVICES.length);
    expect(all.filter((s) => s.id === original.id)).toHaveLength(1);
    expect(getServiceById(original.id).fees).toBe('Edited fee text');
    // the rest of the built-in fields survive the edit
    expect(getServiceById(original.id).department).toBe(original.department);
  });

  it('keeps an edited built-in guide in its original position', () => {
    const target = MOCK_SERVICES[2];
    saveAdminService({ ...target, fees: 'Edited fee text' }, 'tester');
    saveAdminService(zebra, 'tester');
    const ids = getAllServices().map((s) => s.id);
    expect(ids.slice(0, MOCK_SERVICES.length)).toEqual(MOCK_SERVICES.map((s) => s.id));
    expect(ids[ids.length - 1]).toBe('zebra-crossing-permit');
  });

  it('is the same list the admin dashboard reads', () => {
    saveAdminService(zebra, 'tester');
    expect(getAdminServices()).toEqual(getAllServices());
  });

  it('includes guides added through the bulk import', () => {
    const result = importAdminServices(
      [{ id: 'bulk-one', name: 'Bulk One', category: 'Welfare', shortDescription: 'x' }],
      'tester'
    );
    expect(result.imported).toBe(1);
    expect(getServiceById('bulk-one')).not.toBeNull();
  });

  it('falls back to the built-in guides when the saved list is unreadable', () => {
    storage.setItem(CUSTOM_SERVICES_KEY, '{not json');
    expect(getAllServices()).toEqual(MOCK_SERVICES);
    storage.setItem(CUSTOM_SERVICES_KEY, JSON.stringify({ not: 'a list' }));
    expect(getAllServices()).toEqual(MOCK_SERVICES);
  });

  it('skips saved entries that have no id or name instead of breaking the pages', () => {
    storage.setItem(
      CUSTOM_SERVICES_KEY,
      JSON.stringify([null, 'text', { id: 'no-name' }, { name: 'no id' }, { id: 'ok-one', name: 'Ok One' }])
    );
    const all = getAllServices();
    expect(all).toHaveLength(MOCK_SERVICES.length + 1);
    expect(getServiceById('ok-one')).not.toBeNull();
  });
});

describe('getServiceById', () => {
  it('finds a built-in and a saved guide, and returns null for an unknown id', () => {
    saveAdminService(zebra, 'tester');
    expect(getServiceById(MOCK_SERVICES[1].id).name).toBe(MOCK_SERVICES[1].name);
    expect(getServiceById('zebra-crossing-permit')).not.toBeNull();
    expect(getServiceById('does-not-exist')).toBeNull();
  });
});

describe('what the directory does with the merged list', () => {
  it('a search finds the admin guide and the old built-in list does not', () => {
    saveAdminService(zebra, 'tester');
    const found = rankAndFilterServices(getAllServices(), { searchQuery: 'Zebra' });
    expect(found.map((s) => s.id)).toContain('zebra-crossing-permit');
    const before = rankAndFilterServices(MOCK_SERVICES, { searchQuery: 'Zebra' });
    expect(before.map((s) => s.id)).not.toContain('zebra-crossing-permit');
  });

  it('a guide the admin added can be compared', () => {
    saveAdminService(zebra, 'tester');
    expect(comparisonService.addService('zebra-crossing-permit').success).toBe(true);
    expect(comparisonService.getComparedServices().map((s) => s.name)).toEqual(['Zebra Crossing Permit']);
  });
});
