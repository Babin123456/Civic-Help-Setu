import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteAdminService,
  getAdminServices,
  getAuditLogs,
  hasLocalServiceCopy,
  saveAdminService,
} from './adminService';
import { removeServiceGuide } from '../utils/adminDestructiveActions';
import { MOCK_SERVICES } from '../data/services';
import { setCurrentActor } from './accessControl';

// These tests are about what the admin features do; who may use them is tested in accessControl.test.js.
setCurrentActor({ role: 'admin', username: 'Test Admin' });

const SERVICES_KEY = 'civicbridge_custom_services';
const AUDIT_KEY = 'civicbridge_audit_logs';

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: vi.fn((k) => (data.has(k) ? data.get(k) : null)),
    setItem: vi.fn((k, v) => data.set(k, String(v))),
    removeItem: vi.fn((k) => data.delete(k)),
  };
};

const custom = { name: 'Ration Card Update', category: 'Welfare', shortDescription: 'Update ration card details' };
const builtIn = MOCK_SERVICES[0];

let storage;
beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal('localStorage', storage);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const logsAfterSeed = () => getAuditLogs().length;

describe('deleteAdminService audit log', () => {
  it('logs a permanent removal for a custom guide that was really removed', () => {
    saveAdminService(custom, 'tester');
    const before = logsAfterSeed();

    const list = deleteAdminService('ration-card-update', 'tester');

    expect(list.some((s) => s.id === 'ration-card-update')).toBe(false);
    const logs = getAuditLogs();
    expect(logs).toHaveLength(before + 1);
    expect(logs[0]).toMatchObject({
      action: 'SERVICE_DELETED',
      actor: 'tester',
      target: 'Ration Card Update',
      details: 'Service entry ration-card-update permanently removed from directory.',
    });
  });

  it('writes nothing for a built-in guide with no saved edit, and the guide stays', () => {
    const before = logsAfterSeed();
    storage.setItem.mockClear();

    const list = deleteAdminService(builtIn.id, 'tester');

    expect(list.some((s) => s.id === builtIn.id)).toBe(true);
    expect(getAuditLogs()).toHaveLength(before);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(JSON.stringify(getAuditLogs())).not.toContain('permanently removed');
  });

  it('writes nothing for an id that exists nowhere', () => {
    const before = logsAfterSeed();
    const listBefore = getAdminServices();

    const list = deleteAdminService('no-such-service', 'tester');

    expect(list).toEqual(listBefore);
    expect(getAuditLogs()).toHaveLength(before);
  });

  it('logs a built-in guide with a saved edit as cleared changes, not a removal', () => {
    storage.setItem(SERVICES_KEY, JSON.stringify([{ ...builtIn, name: `${builtIn.name} (edited)` }]));
    const before = logsAfterSeed();

    const list = deleteAdminService(builtIn.id, 'tester');

    expect(list.find((s) => s.id === builtIn.id).name).toBe(builtIn.name);
    const logs = getAuditLogs();
    expect(logs).toHaveLength(before + 1);
    expect(logs[0].action).toBe('SERVICE_UPDATED');
    expect(logs[0].target).toBe(`${builtIn.name} (edited)`);
    expect(logs[0].details).toMatch(/stays in the directory/);
    expect(logs[0].details).not.toMatch(/permanently removed/);
  });

  it('does not log a removal when the storage write fails', () => {
    saveAdminService(custom, 'tester');
    const before = logsAfterSeed();
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const list = deleteAdminService('ration-card-update', 'tester');

    expect(list.some((s) => s.id === 'ration-card-update')).toBe(true);
    expect(JSON.parse(storage.getItem(AUDIT_KEY))).toHaveLength(before);
  });

  it('does not log anything when the saved list cannot be read', () => {
    storage.setItem(SERVICES_KEY, '{not json');
    const before = logsAfterSeed();
    expect(() => deleteAdminService('ration-card-update', 'tester')).not.toThrow();
    expect(getAuditLogs()).toHaveLength(before);
  });

  it('keeps returning the merged list', () => {
    saveAdminService(custom, 'tester');
    const list = deleteAdminService('ration-card-update', 'tester');
    expect(list).toEqual(getAdminServices());
    expect(list).toHaveLength(MOCK_SERVICES.length);
  });
});

describe('hasLocalServiceCopy', () => {
  it('is true only for ids in the saved list', () => {
    saveAdminService(custom, 'tester');
    expect(hasLocalServiceCopy('ration-card-update')).toBe(true);
    expect(hasLocalServiceCopy(builtIn.id)).toBe(false);
  });

  it('is false when storage is unreadable', () => {
    storage.setItem(SERVICES_KEY, '{not json');
    expect(hasLocalServiceCopy('x')).toBe(false);
  });
});

describe('removeServiceGuide outcomes', () => {
  const run = (id, name, isBuiltIn, hadLocalChanges) =>
    removeServiceGuide({ id, name, builtIn: isBuiltIn, actor: 'tester', deleteService: deleteAdminService, hadLocalChanges });

  it('built-in with nothing saved reports nothing-to-clear', () => {
    expect(run(builtIn.id, builtIn.name, true, hasLocalServiceCopy(builtIn.id)).outcome).toBe('nothing-to-clear');
  });

  it('built-in with a saved edit reports reverted-to-builtin', () => {
    storage.setItem(SERVICES_KEY, JSON.stringify([{ ...builtIn, name: 'Edited' }]));
    expect(run(builtIn.id, builtIn.name, true, hasLocalServiceCopy(builtIn.id)).outcome).toBe('reverted-to-builtin');
  });

  it('defaults to reverted-to-builtin when the caller does not say', () => {
    expect(run(builtIn.id, builtIn.name, true, undefined).outcome).toBe('reverted-to-builtin');
  });

  it('custom guide is still reported as removed', () => {
    saveAdminService(custom, 'tester');
    expect(run('ration-card-update', custom.name, false, true).outcome).toBe('removed');
  });
});
