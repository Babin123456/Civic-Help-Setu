import { describe, it, expect, beforeEach } from 'vitest';
import {
  AVAILABILITY_STORAGE_KEY,
  PUBLICATION_STATES,
  NOTICE_STATUS,
  validateAvailabilityNotice,
  getNoticeStatus,
  istInputToIso,
  isoToIstInput,
  formatNoticeTime,
  addAvailabilityNotice,
  updateAvailabilityNotice,
  publishAvailabilityNotice,
  withdrawAvailabilityNotice,
  deleteAvailabilityNotice,
  getAvailabilityNotices,
  getActiveNoticesForService,
} from './serviceAvailabilityNoticeService';
import { setCurrentActor } from './accessControl';

setCurrentActor({ role: 'admin', username: 'Test Admin' });

const services = [{ id: 'aadhaar-card', name: 'Aadhaar Card' }, { id: 'pan-card', name: 'PAN Card' }];

const makeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
};

const base = (over = {}) => ({
  id: 'n1',
  serviceId: 'aadhaar-card',
  message: 'Portal down for announced maintenance.',
  startsAt: '2026-11-01T00:00:00.000Z',
  endsAt: '2026-11-02T00:00:00.000Z',
  ongoing: false,
  sourceName: 'UIDAI notice',
  sourceUrl: 'https://uidai.gov.in/notice',
  confirmed: true,
  state: PUBLICATION_STATES.PUBLISHED,
  createdAt: '2026-10-29T00:00:00.000Z',
  updatedAt: '2026-10-29T00:00:00.000Z',
  ...over,
});

const at = (iso) => new Date(iso);

describe('getNoticeStatus', () => {
  it('is active inside the range', () => {
    expect(getNoticeStatus(base(), at('2026-11-01T12:00:00Z'), services)).toBe(NOTICE_STATUS.ACTIVE);
  });
  it('is upcoming before the start', () => {
    expect(getNoticeStatus(base(), at('2026-10-31T23:59:00Z'), services)).toBe(NOTICE_STATUS.UPCOMING);
  });
  it('is expired at and after the end, so it stops showing as current', () => {
    expect(getNoticeStatus(base(), at('2026-11-02T00:00:00Z'), services)).toBe(NOTICE_STATUS.EXPIRED);
    expect(getNoticeStatus(base(), at('2027-01-01T00:00:00Z'), services)).toBe(NOTICE_STATUS.EXPIRED);
  });
  it('never shows a withdrawn or draft notice', () => {
    expect(getNoticeStatus(base({ state: 'withdrawn' }), at('2026-11-01T12:00:00Z'), services)).toBe(NOTICE_STATUS.WITHDRAWN);
    expect(getNoticeStatus(base({ state: 'draft' }), at('2026-11-01T12:00:00Z'), services)).toBe(NOTICE_STATUS.DRAFT);
  });
  it('treats a missing end time as ongoing only when the record says so', () => {
    const open = base({ endsAt: '', ongoing: true });
    expect(getNoticeStatus(open, at('2030-01-01T00:00:00Z'), services)).toBe(NOTICE_STATUS.ACTIVE);
    expect(getNoticeStatus(base({ endsAt: '', ongoing: false }), at('2026-11-01T12:00:00Z'), services)).toBe(NOTICE_STATUS.MALFORMED);
  });
  it('treats malformed records as malformed, never active', () => {
    const now = at('2026-11-01T12:00:00Z');
    [null, 'x', [], {}, base({ startsAt: 'not a date' }), base({ endsAt: '2026-10-01T00:00:00Z' }),
      base({ serviceId: 'gone' }), base({ message: '   ' }), base({ state: 'weird' })]
      .forEach((n) => expect(getNoticeStatus(n, now, services)).toBe(NOTICE_STATUS.MALFORMED));
  });
});

describe('validateAvailabilityNotice', () => {
  it('accepts a good notice', () => {
    expect(validateAvailabilityNotice(base(), services)).toEqual({ isValid: true, errors: [] });
  });
  it('requires a service that exists', () => {
    expect(validateAvailabilityNotice(base({ serviceId: 'nope' }), services).isValid).toBe(false);
  });
  it('rejects an end before the start and an end on an ongoing notice', () => {
    expect(validateAvailabilityNotice(base({ endsAt: '2026-11-01T00:00:00.000Z' }), services).errors.join()).toMatch(/after the start/);
    expect(validateAvailabilityNotice(base({ ongoing: true }), services).errors.join()).toMatch(/ongoing/i);
  });
  it('only lets a notice be confirmed when it links an official announcement', () => {
    expect(validateAvailabilityNotice(base({ sourceUrl: '' }), services).errors.join()).toMatch(/confirmed/i);
    expect(validateAvailabilityNotice(base({ sourceUrl: '', confirmed: false }), services).isValid).toBe(true);
    expect(validateAvailabilityNotice(base({ sourceUrl: 'javascript:alert(1)', confirmed: false }), services).isValid).toBe(false);
  });
  it('requires a source name and caps the explanation length', () => {
    expect(validateAvailabilityNotice(base({ sourceName: '' }), services).isValid).toBe(false);
    expect(validateAvailabilityNotice(base({ message: 'a'.repeat(501) }), services).isValid).toBe(false);
  });
});

describe('time handling', () => {
  it('reads form input as IST and shows it back in IST', () => {
    expect(istInputToIso('2026-11-01T09:30')).toBe('2026-11-01T04:00:00.000Z');
    expect(isoToIstInput('2026-11-01T04:00:00.000Z')).toBe('2026-11-01T09:30');
    expect(formatNoticeTime('2026-11-01T04:00:00.000Z')).toMatch(/09:30 am IST$/i);
  });
  it('rejects impossible dates', () => {
    expect(istInputToIso('2026-02-31T10:00')).toBe('');
    expect(istInputToIso('garbage')).toBe('');
    expect(formatNoticeTime('nope')).toBe('');
  });
});

describe('storage and lifecycle', () => {
  let storage;
  beforeEach(() => { storage = makeStorage(); });
  const input = (over = {}) => ({
    serviceId: 'aadhaar-card',
    message: 'Maintenance.',
    startsAt: '2026-11-01T00:00:00.000Z',
    endsAt: '2026-11-02T00:00:00.000Z',
    sourceName: 'UIDAI',
    sourceUrl: 'https://uidai.gov.in/x',
    confirmed: true,
    ...over,
  });

  it('adds as draft, publishes, edits, withdraws and deletes', () => {
    const n = addAvailabilityNotice(input(), storage, services);
    expect(n.state).toBe('draft');
    expect(getActiveNoticesForService('aadhaar-card', at('2026-11-01T12:00:00Z'), storage, services)).toHaveLength(0);

    publishAvailabilityNotice(n.id, storage, services);
    expect(getActiveNoticesForService('aadhaar-card', at('2026-11-01T12:00:00Z'), storage, services)).toHaveLength(1);
    expect(getActiveNoticesForService('pan-card', at('2026-11-01T12:00:00Z'), storage, services)).toHaveLength(0);

    updateAvailabilityNotice(n.id, { message: 'Updated text.' }, storage, services);
    expect(getAvailabilityNotices(storage)[0].message).toBe('Updated text.');

    withdrawAvailabilityNotice(n.id, storage, services);
    expect(getActiveNoticesForService('aadhaar-card', at('2026-11-01T12:00:00Z'), storage, services)).toHaveLength(0);

    deleteAvailabilityNotice(n.id, storage);
    expect(getAvailabilityNotices(storage)).toEqual([]);
  });

  it('stops returning a published notice once it expires, without deleting it', () => {
    addAvailabilityNotice(input({ state: 'published' }), storage, services);
    expect(getActiveNoticesForService('aadhaar-card', at('2026-11-01T01:00:00Z'), storage, services)).toHaveLength(1);
    expect(getActiveNoticesForService('aadhaar-card', at('2026-11-02T00:00:01Z'), storage, services)).toHaveLength(0);
    expect(getAvailabilityNotices(storage)).toHaveLength(1);
  });

  it('refuses to save invalid input and strips markup from text', () => {
    expect(() => addAvailabilityNotice(input({ endsAt: '' }), storage, services)).toThrow(/end time/i);
    const n = addAvailabilityNotice(input({ message: 'Down <script>alert(1)</script>today' }), storage, services);
    expect(n.message).not.toContain('<');
  });

  it('survives corrupt storage and ignores malformed stored records on the public side', () => {
    expect(getAvailabilityNotices(makeStorage({ [AVAILABILITY_STORAGE_KEY]: '{oops' }))).toEqual([]);
    const bad = makeStorage({ [AVAILABILITY_STORAGE_KEY]: JSON.stringify([base({ id: 'bad', startsAt: 'x' }), 5, null, base({ id: 'ok' })]) });
    expect(getAvailabilityNotices(bad)).toHaveLength(2);
    expect(getActiveNoticesForService('aadhaar-card', at('2026-11-01T12:00:00Z'), bad, services).map((x) => x.id)).toEqual(['ok']);
  });

  it('blocks non-admins from writing', () => {
    setCurrentActor({ role: 'citizen' });
    try {
      expect(() => addAvailabilityNotice(input(), storage, services)).toThrow(/Not allowed/);
    } finally {
      setCurrentActor({ role: 'admin', username: 'Test Admin' });
    }
  });
});
