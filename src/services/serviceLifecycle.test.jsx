import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  isArchived,
  missingRequiredFields,
  planBulkArchive,
  planBulkRestore,
  withArchived,
  withRestored,
} from './serviceLifecycle';
import {
  archiveAdminServices,
  restoreAdminServices,
  getAdminServices,
  getAuditLogs,
  saveAdminService,
} from './adminService';
import { getAllServices, getServiceById } from './serviceCatalog';
import { MOCK_SERVICES } from '../data/services';
import { setCurrentActor } from './accessControl';
import { MemoryRouter } from 'react-router-dom';
import RetiredServiceNotice from '../components/common/RetiredServiceNotice';
import ServiceLifecycleReview from '../components/admin/ServiceLifecycleReview';

const SERVICES_KEY = 'civicbridge_custom_services';
const builtInId = MOCK_SERVICES[0].id;
const full = (name) => ({ name, category: 'Welfare', shortDescription: `${name} guide` });

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: vi.fn((k) => (data.has(k) ? data.get(k) : null)),
    setItem: vi.fn((k, v) => data.set(k, String(v))),
    removeItem: vi.fn((k) => data.delete(k)),
  };
};

describe('lifecycle planning', () => {
  const list = [
    { id: 'a', ...full('A') },
    { id: 'b', ...full('B'), archived: true },
    { id: 'c', name: 'C', category: '', shortDescription: 'x', archived: true },
  ];

  it('archive: changes active, skips archived and stale ids, ignores duplicates', () => {
    const plan = planBulkArchive(['a', 'b', 'gone', 'a', 42], list);
    expect(plan.toChange.map((s) => s.id)).toEqual(['a']);
    expect(plan.skippedAlreadyArchived.map((s) => s.id)).toEqual(['b']);
    expect(plan.unknownIds).toEqual(['gone']);
  });

  it('restore: validates required fields before re-listing', () => {
    const plan = planBulkRestore(['a', 'b', 'c', 'gone'], list);
    expect(plan.toChange.map((s) => s.id)).toEqual(['b']);
    expect(plan.skippedNotArchived.map((s) => s.id)).toEqual(['a']);
    expect(plan.invalid).toEqual([{ id: 'c', name: 'C', missing: ['category'] }]);
    expect(plan.unknownIds).toEqual(['gone']);
  });

  it('handles an empty or non-array selection', () => {
    expect(planBulkArchive(undefined, list).toChange).toEqual([]);
    expect(planBulkRestore([], list).toChange).toEqual([]);
  });

  it('flags blank and non-string required fields', () => {
    expect(missingRequiredFields({ name: ' ', category: 5, shortDescription: 'ok' })).toEqual(['name', 'category']);
  });

  it('withArchived and withRestored round trip without losing fields or the id', () => {
    const svc = { id: 'a', ...full('A'), steps: [1] };
    const archived = withArchived(svc, '2026-10-29');
    expect(isArchived(archived)).toBe(true);
    expect(withRestored(archived)).toEqual(svc);
  });
});

describe('archiveAdminServices and restoreAdminServices', () => {
  let storage;
  beforeEach(() => {
    storage = makeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setCurrentActor({ role: 'admin', username: 'Test Admin' });
  });

  it('archives a custom guide without deleting it and keeps its id', () => {
    saveAdminService(full('Old Pension'), 't');
    const res = archiveAdminServices(['old-pension'], 't');
    expect(res.ok).toBe(true);
    expect(res.changed).toBe(1);
    expect(getAdminServices().find((s) => s.id === 'old-pension')).toMatchObject({ archived: true });
    expect(getAllServices().some((s) => s.id === 'old-pension')).toBe(false);
    expect(getAllServices({ includeArchived: true }).some((s) => s.id === 'old-pension')).toBe(true);
  });

  it('archives a built-in guide through a saved copy and keeps its text', () => {
    const res = archiveAdminServices([builtInId], 't');
    expect(res.changed).toBe(1);
    expect(getAllServices().some((s) => s.id === builtInId)).toBe(false);
    expect(getServiceById(builtInId)).toMatchObject({ id: builtInId, name: MOCK_SERVICES[0].name, archived: true });
  });

  it('a direct lookup still returns an archived guide so its page can show a notice', () => {
    saveAdminService(full('Old Pension'), 't');
    archiveAdminServices(['old-pension'], 't');
    expect(getServiceById('old-pension')).toMatchObject({ archived: true });
    expect(getServiceById('never-existed')).toBeNull();
  });

  it('mixed selection: applies the valid ids and reports the rest', () => {
    saveAdminService(full('One'), 't');
    saveAdminService(full('Two'), 't');
    archiveAdminServices(['two'], 't');
    const res = archiveAdminServices(['one', 'two', 'stale-id'], 't');
    expect(res.changed).toBe(1);
    expect(res.plan.skippedAlreadyArchived.map((s) => s.id)).toEqual(['two']);
    expect(res.plan.unknownIds).toEqual(['stale-id']);
    expect(getAuditLogs()[0]).toMatchObject({ action: 'SERVICES_ARCHIVED', target: '1 service' });
    expect(getAuditLogs()[0].details).toContain('1 no longer exist');
  });

  it('only stale ids: writes nothing and logs nothing', () => {
    const logsBefore = getAuditLogs().length;
    storage.setItem.mockClear();
    const res = archiveAdminServices(['stale'], 't');
    expect(res).toMatchObject({ ok: true, changed: 0 });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(getAuditLogs()).toHaveLength(logsBefore);
  });

  it('restore re-lists a valid guide and keeps its id', () => {
    saveAdminService(full('Old Pension'), 't');
    archiveAdminServices(['old-pension'], 't');
    const res = restoreAdminServices(['old-pension'], 't');
    expect(res.changed).toBe(1);
    expect(getAllServices().find((s) => s.id === 'old-pension')).toBeTruthy();
    expect(getServiceById('old-pension').archived).toBeUndefined();
    expect(getAuditLogs()[0].action).toBe('SERVICES_RESTORED');
  });

  it('restore refuses a record that fails validation and leaves it archived', () => {
    storage.setItem(
      SERVICES_KEY,
      JSON.stringify([{ id: 'broken', name: 'Broken', category: '', shortDescription: '', archived: true }])
    );
    const res = restoreAdminServices(['broken'], 't');
    expect(res.changed).toBe(0);
    expect(res.plan.invalid[0]).toMatchObject({ id: 'broken', missing: ['category', 'short description'] });
    expect(getServiceById('broken').archived).toBe(true);
  });

  it('a failed write changes nothing and is not logged', () => {
    saveAdminService(full('One'), 't');
    const logsBefore = getAuditLogs().length;
    storage.setItem.mockImplementation(() => {
      throw new Error('quota');
    });
    const res = archiveAdminServices(['one'], 't');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Nothing was changed/);
    expect(getAuditLogs()).toHaveLength(logsBefore);
  });

  it('is refused for a non-admin', () => {
    setCurrentActor({ role: 'citizen', username: 'x' });
    expect(() => archiveAdminServices(['a'])).toThrow(/Not allowed/);
    expect(() => restoreAdminServices(['a'])).toThrow(/Not allowed/);
  });
});

describe('ServiceLifecycleReview markup', () => {
  const noop = () => {};

  it('lists what changes and what is skipped before applying', () => {
    const plan = {
      toChange: [{ id: 'a', name: 'Alpha' }],
      skippedNotArchived: [{ id: 'n', name: 'Nope' }],
      invalid: [{ id: 'c', name: 'Charlie', missing: ['category'] }],
      unknownIds: ['stale-1'],
    };
    const html = renderToStaticMarkup(
      <ServiceLifecycleReview kind="restore" plan={plan} onConfirm={noop} onCancel={noop} />
    );
    expect(html).toContain('Review: restore 1 service guide');
    expect(html).toContain('Alpha');
    expect(html).toContain('Charlie: missing category');
    expect(html).toContain('stale-1');
    expect(html).toContain('Restore 1 guide');
  });

  it('disables apply when nothing can change', () => {
    const plan = { toChange: [], skippedAlreadyArchived: [], unknownIds: ['x'] };
    const html = renderToStaticMarkup(
      <ServiceLifecycleReview kind="archive" plan={plan} onConfirm={noop} onCancel={noop} />
    );
    expect(html).toContain('Nothing in this selection can be changed.');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Archive 0 guides/);
  });
});

describe('RetiredServiceNotice markup', () => {
  const render = (service) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <RetiredServiceNotice service={service} />
      </MemoryRouter>
    );

  it('shows a clear retired notice with a way back for an archived guide', () => {
    const html = render({ id: 'a', name: 'A', archived: true, archivedAt: '2026-10-29' });
    expect(html).toContain('This service guide has been retired');
    expect(html).toContain('archived 2026-10-29');
    expect(html).toContain('href="/services"');
    expect(html).toContain('role="status"');
  });

  it('renders nothing for an active or missing guide', () => {
    expect(render({ id: 'a', name: 'A' })).toBe('');
    expect(render(null)).toBe('');
  });
});
