import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createActionGuard,
  buildServiceRemovalDialog,
  buildReportDismissalDialog,
  removeServiceGuide,
  dismissReportEntry,
  describeActionFailure,
} from './adminDestructiveActions';
import { deleteAdminService, getAdminServices, getReports, dismissReport, saveAdminService } from '../services/adminService';
import { MOCK_SERVICES } from '../data/services';
import { setCurrentActor } from '../services/accessControl';

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

const custom = { name: 'Ration Card Update', category: 'Welfare', shortDescription: 'Update ration card details' };

let storage;
beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal('localStorage', storage);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('confirmation copy', () => {
  it('names the service and the exact consequence, without promising undo', () => {
    const dialog = buildServiceRemovalDialog({ name: 'Ration Card Update' });
    expect(dialog.itemName).toBe('Ration Card Update');
    expect(dialog.message).toContain('"Ration Card Update"');
    expect(dialog.message).toContain('removes');
    expect(dialog.message).toContain('cannot be undone');
    expect(dialog.confirmLabel).toBe('Remove service');
    expect(dialog.message.toLowerCase()).not.toMatch(/restore|recover|undo it|revert/);
  });

  it('is honest that a built-in guide stays in the directory', () => {
    const dialog = buildServiceRemovalDialog({ name: 'Birth Certificate' }, { builtIn: true });
    expect(dialog.message).toContain('cannot be removed from the directory');
    expect(dialog.confirmLabel).toBe('Clear local changes');
  });

  it('says a dismissed report is deleted, not resolved', () => {
    const dialog = buildReportDismissalDialog({ serviceName: 'PAN Card', issueType: 'Outdated Fees' });
    expect(dialog.itemName).toBe('PAN Card: Outdated Fees');
    expect(dialog.message).toContain('deletes the report');
    expect(dialog.message).toContain('cannot be brought back');
  });

  it('never leaks exception text into the failure message', () => {
    const msg = describeActionFailure('service', 'PAN Card');
    expect(msg).toContain('"PAN Card"');
    expect(describeActionFailure('report')).toContain('still in the queue');
  });
});

describe('createActionGuard', () => {
  it('runs the task once and reports the result', async () => {
    const guard = createActionGuard();
    const task = vi.fn().mockResolvedValue('ok');
    expect(await guard.run(task)).toEqual({ status: 'done', value: 'ok' });
    expect(task).toHaveBeenCalledTimes(1);
    expect(guard.isPending()).toBe(false);
  });

  it('ignores repeated clicks while the first one is pending', async () => {
    const guard = createActionGuard();
    let release;
    const task = vi.fn(() => new Promise((resolve) => { release = resolve; }));

    const first = guard.run(task);
    expect(guard.isPending()).toBe(true);
    const second = await guard.run(task);
    const third = await guard.run(task);
    expect(second).toEqual({ status: 'busy' });
    expect(third).toEqual({ status: 'busy' });

    release('done');
    expect((await first).status).toBe('done');
    expect(task).toHaveBeenCalledTimes(1);
    expect(guard.isPending()).toBe(false);
  });

  it('reports a failure, unlocks, and allows a retry', async () => {
    const guard = createActionGuard();
    const task = vi.fn().mockRejectedValueOnce(new Error('storage full')).mockResolvedValueOnce('ok');

    const failed = await guard.run(task);
    expect(failed.status).toBe('failed');
    expect(guard.isPending()).toBe(false);

    expect((await guard.run(task)).status).toBe('done');
    expect(task).toHaveBeenCalledTimes(2);
  });
});

describe('removing a service guide', () => {
  const run = (id, name, builtIn) =>
    removeServiceGuide({ id, name, builtIn, actor: 'tester', deleteService: deleteAdminService });

  it('cancel: opening the confirmation only builds text, it never writes storage', () => {
    saveAdminService(custom, 'tester');
    const before = getAdminServices();
    storage.setItem.mockClear();
    buildServiceRemovalDialog(before.find((s) => s.id === 'ration-card-update'));
    // Cancelling never reaches removeServiceGuide; the dialog just closes.
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(getAdminServices()).toEqual(before);
  });

  it('confirm: removes a custom guide and returns the new list', () => {
    saveAdminService(custom, 'tester');
    const result = run('ration-card-update', custom.name, false);
    expect(result.outcome).toBe('removed');
    expect(result.services.some((s) => s.id === 'ration-card-update')).toBe(false);
  });

  it('confirm on a built-in guide never removes it and says so', () => {
    const builtIn = MOCK_SERVICES[0];
    const result = run(builtIn.id, builtIn.name, true);
    expect(result.outcome).toBe('reverted-to-builtin');
    expect(result.services.some((s) => s.id === builtIn.id)).toBe(true);
  });

  it('failure: a storage error leaves the guide listed and is reported as a failure', () => {
    saveAdminService(custom, 'tester');
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => run('ration-card-update', custom.name, false)).toThrow(/still in the directory/);
  });
});

describe('dismissing a report', () => {
  const REPORTS_KEY = 'civicbridge_error_reports';

  it('confirm: report leaves the queue', () => {
    const [first] = getReports();
    const remaining = dismissReportEntry({ id: first.id, dismissReport });
    expect(remaining.some((r) => r.id === first.id)).toBe(false);
    expect(JSON.parse(storage.getItem(REPORTS_KEY)).some((r) => r.id === first.id)).toBe(false);
  });

  it('cancel: opening the confirmation does not touch the queue', () => {
    const before = getReports();
    storage.setItem.mockClear();
    buildReportDismissalDialog(before[0]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(getReports()).toEqual(before);
  });

  it('failure: a storage error surfaces instead of looking like success', () => {
    const [first] = getReports();
    const failing = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => dismissReportEntry({ id: first.id, dismissReport: failing })).toThrow();
    expect(getReports().some((r) => r.id === first.id)).toBe(true);
  });

  it('failure: a dismiss that did not remove the report is not treated as success', () => {
    const [first] = getReports();
    const noop = vi.fn(() => getReports());
    expect(() => dismissReportEntry({ id: first.id, dismissReport: noop })).toThrow(/still in the queue/);
  });
});
