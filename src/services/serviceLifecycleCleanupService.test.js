import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerServiceCleanupHook,
  unregisterServiceCleanupHook,
  getRegisteredCleanupHooks,
  clearRegisteredCleanupHooks,
  executeServiceCleanupHooks,
  auditServiceOrphanedRecords,
} from './serviceLifecycleCleanupService';

describe('serviceLifecycleCleanupService (#429)', () => {
  beforeEach(() => {
    clearRegisteredCleanupHooks();
  });

  it('registers cleanup hooks and sorts them by priority', () => {
    registerServiceCleanupHook('notices', vi.fn(), { priority: 20 });
    registerServiceCleanupHook('ownership', vi.fn(), { priority: 10 });
    registerServiceCleanupHook('reviews', vi.fn(), { priority: 30 });

    const hooks = getRegisteredCleanupHooks();
    expect(hooks.map((h) => h.name)).toEqual(['ownership', 'notices', 'reviews']);
  });

  it('rejects invalid hook registrations', () => {
    expect(() => registerServiceCleanupHook('', vi.fn())).toThrow(/non-empty string/);
    expect(() => registerServiceCleanupHook('invalid', 'notAFunction')).toThrow(/valid callback/);
  });

  it('unregisters hooks cleanly', () => {
    registerServiceCleanupHook('test_hook', vi.fn());
    expect(getRegisteredCleanupHooks()).toHaveLength(1);

    expect(unregisterServiceCleanupHook('test_hook')).toBe(true);
    expect(getRegisteredCleanupHooks()).toHaveLength(0);
  });

  it('executes hooks in sequence and isolates failing callbacks without halting others', () => {
    const successHook1 = vi.fn().mockReturnValue(42);
    const failingHook = vi.fn().mockImplementation(() => {
      throw new Error('Database connection failed');
    });
    const successHook2 = vi.fn().mockReturnValue('cleaned');

    registerServiceCleanupHook('h1', successHook1, { priority: 1 });
    registerServiceCleanupHook('h2_fail', failingHook, { priority: 2 });
    registerServiceCleanupHook('h3', successHook2, { priority: 3 });

    const report = executeServiceCleanupHooks('srv-ration-card-101');
    expect(report.totalHooks).toBe(3);
    expect(report.executedHooks).toBe(3);
    expect(report.failedHooks).toBe(1);
    expect(report.success).toBe(false);

    expect(successHook1).toHaveBeenCalledWith('srv-ration-card-101', {});
    expect(failingHook).toHaveBeenCalledWith('srv-ration-card-101', {});
    expect(successHook2).toHaveBeenCalledWith('srv-ration-card-101', {});

    const failedResult = report.results.find((r) => r.hookName === 'h2_fail');
    expect(failedResult.success).toBe(false);
    expect(failedResult.error).toContain('Database connection failed');
  });

  it('audits storage for orphaned availability notices and ownership records', () => {
    const mockStorage = {
      getItem: vi.fn((key) => {
        if (key === 'civicbridge_service_availability_notices_v1') {
          return JSON.stringify([
            { id: 'notif-1', serviceId: 'srv-pension' },
            { id: 'notif-2', serviceId: 'other-srv' },
          ]);
        }
        if (key === 'civicbridge_service_ownership_v1') {
          return JSON.stringify({
            'srv-pension': { ownerId: 'usr-42' },
          });
        }
        return null;
      }),
    };

    const audit = auditServiceOrphanedRecords('srv-pension', mockStorage);
    expect(audit.hasOrphans).toBe(true);
    expect(audit.totalOrphansCount).toBe(2);
    expect(audit.orphanCategories.map((c) => c.type)).toContain('availability_notices');
    expect(audit.orphanCategories.map((c) => c.type)).toContain('service_ownership');
  });
});
