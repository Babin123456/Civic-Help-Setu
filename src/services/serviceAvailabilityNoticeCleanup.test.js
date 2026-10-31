import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  updateAvailabilityNotice,
  withdrawAvailabilityNotice,
  removeNoticesForService,
  getAvailabilityNotices,
  AVAILABILITY_STORAGE_KEY,
  PUBLICATION_STATES,
} from './serviceAvailabilityNoticeService';
import { CUSTOM_SERVICES_KEY } from './serviceCatalog';
import { setCurrentActor } from './accessControl';
import { removeServiceGuide } from '../utils/adminDestructiveActions';

setCurrentActor({ role: 'admin', username: 'Test Admin' });

const notice = (id, serviceId) => ({
  id, serviceId, message: 'Portal down.', startsAt: '2026-11-01T00:00:00.000Z', endsAt: '2026-11-02T00:00:00.000Z',
  ongoing: false, sourceName: 'Dept', sourceUrl: 'https://example.gov.in/n', confirmed: true,
  state: PUBLICATION_STATES.PUBLISHED, createdAt: '2026-10-29T00:00:00.000Z', updatedAt: '2026-10-29T00:00:00.000Z',
});

let data;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  });
});

describe('notices for archived or removed guides', () => {
  it('can still withdraw and edit a notice after its guide is archived', () => {
    data.set(CUSTOM_SERVICES_KEY, JSON.stringify([{ id: 'aadhaar-card', name: 'Aadhaar Card', archived: true }]));
    data.set(AVAILABILITY_STORAGE_KEY, JSON.stringify([notice('n1', 'aadhaar-card')]));
    expect(withdrawAvailabilityNotice('n1').state).toBe('withdrawn');
    expect(updateAvailabilityNotice('n1', { message: 'Updated text.' }).message).toBe('Updated text.');
  });

  it('still rejects a notice for a service that does not exist', () => {
    data.set(AVAILABILITY_STORAGE_KEY, JSON.stringify([notice('n1', 'no-such-service')]));
    expect(() => withdrawAvailabilityNotice('n1')).toThrow(/service that exists/);
  });

  it('removeNoticesForService drops only that service\'s notices', () => {
    data.set(AVAILABILITY_STORAGE_KEY, JSON.stringify([notice('a', 'x'), notice('b', 'y'), notice('c', 'x')]));
    expect(removeNoticesForService('x')).toBe(2);
    expect(getAvailabilityNotices().map((n) => n.id)).toEqual(['b']);
  });

  it('deleting a guide runs the cleanup callbacks, and a failing one does not undo the delete', () => {
    const cleanup = vi.fn();
    const result = removeServiceGuide({
      id: 'x', name: 'X', builtIn: false, actor: 't', deleteService: () => [],
      cleanup: [() => { throw new Error('boom'); }, cleanup],
    });
    expect(result.outcome).toBe('removed');
    expect(cleanup).toHaveBeenCalledWith('x');
  });

  it('does not run cleanup when a built-in guide is only reverted', () => {
    const cleanup = vi.fn();
    removeServiceGuide({ id: 'b', name: 'B', builtIn: true, actor: 't', deleteService: () => [{ id: 'b' }], cleanup: [cleanup] });
    expect(cleanup).not.toHaveBeenCalled();
  });
});
