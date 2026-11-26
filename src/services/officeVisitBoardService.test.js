import { describe, it, expect } from 'vitest';
import {
  getVerificationStatus,
  getOpeningStatus,
  getQueueInfo,
  searchOffices,
  buildVisitChecklist,
} from './officeVisitBoardService';

// 3 June 2026 is a Wednesday (getDay() === 3)
const at = (h, m = 0, day = 3) => new Date(2026, 5, day, h, m);

const office = {
  id: 'o1',
  name: 'Ward Office 4',
  locality: 'Riverside',
  address: '12 Station Road',
  verifiedAt: '2026-05-20T00:00:00Z',
  hours: { days: [1, 2, 3, 4, 5], open: '10:00', close: '17:00' },
  lunchClosure: { start: '13:00', end: '13:30' },
  holidays: [
    { date: '2026-06-10', note: 'Local festival' },
    { date: '2026-06-03', note: 'Ward day' },
  ],
  appointment: { required: true, url: 'https://example.org/book' },
  tokenInstructions: 'Take a token at the entrance desk.',
  stepFreeAccess: true,
  facilities: ['drinking water'],
  counters: [
    { id: 'c1', service: 'Birth certificate', name: 'Counter 2', instructions: 'Show the hospital slip.', documents: ['Hospital slip', 'Parent ID'] },
  ],
};

describe('getVerificationStatus', () => {
  it('reports verified, stale and unverified', () => {
    expect(getVerificationStatus(office, at(10))).toBe('verified');
    expect(getVerificationStatus({ verifiedAt: '2025-01-01' }, at(10))).toBe('stale');
    expect(getVerificationStatus({}, at(10))).toBe('unverified');
    expect(getVerificationStatus({ verifiedAt: 'garbage' }, at(10))).toBe('unverified');
  });
});

describe('getOpeningStatus', () => {
  const normal = { ...office, holidays: [] };

  it('is open during working hours', () => {
    expect(getOpeningStatus(normal, at(11)).state).toBe('open');
  });

  it('is closed at lunch, before opening and at closing time', () => {
    expect(getOpeningStatus(normal, at(13, 10))).toMatchObject({ state: 'closed' });
    expect(getOpeningStatus(normal, at(9, 59)).state).toBe('closed');
    expect(getOpeningStatus(normal, at(17, 0)).state).toBe('closed');
  });

  it('is closed on non-working days and holidays', () => {
    expect(getOpeningStatus(normal, at(11, 0, 6)).reason).toContain('Saturday');
    expect(getOpeningStatus(office, at(11)).reason).toContain('Ward day');
  });

  it('says unknown, not closed, when there are no hours', () => {
    expect(getOpeningStatus({ id: 'x', name: 'No hours' }, at(11)).state).toBe('unknown');
    expect(getOpeningStatus({ hours: { days: [1], open: 'late', close: '17:00' } }, at(11)).state).toBe('unknown');
  });
});

describe('getQueueInfo', () => {
  it('shows live numbers only from a fresh feed', () => {
    const live = { ...office, liveFeed: { updatedAt: at(11, 55).toISOString(), nowServing: 'A-21', waiting: 8, source: 'Ward IT cell' } };
    expect(getQueueInfo(live, at(12))).toMatchObject({ mode: 'live', nowServing: 'A-21', waiting: 8 });
  });

  it('falls back to static guidance when the feed is old or missing', () => {
    const old = { ...office, liveFeed: { updatedAt: at(9).toISOString(), nowServing: 'A-1', waiting: 3 } };
    const res = getQueueInfo(old, at(12));
    expect(res.mode).toBe('static');
    expect(res).not.toHaveProperty('waiting');
    expect(res.tokenInstructions).toBe(office.tokenInstructions);
    expect(getQueueInfo(office, at(12)).mode).toBe('static');
  });

  it('ignores a feed timestamp in the future', () => {
    const future = { ...office, liveFeed: { updatedAt: at(14).toISOString(), waiting: 1 } };
    expect(getQueueInfo(future, at(12)).mode).toBe('static');
  });
});

describe('searchOffices', () => {
  it('matches office name, locality and counter service', () => {
    expect(searchOffices([office], 'ward')).toHaveLength(1);
    expect(searchOffices([office], 'riverside')).toHaveLength(1);
    expect(searchOffices([office], 'birth cert')).toHaveLength(1);
    expect(searchOffices([office], 'passport')).toHaveLength(0);
    expect(searchOffices([office], '')).toHaveLength(1);
    expect(searchOffices(undefined, 'x')).toEqual([]);
  });
});

describe('buildVisitChecklist', () => {
  it('lists counter documents, appointment and the no-reservation note', () => {
    const text = buildVisitChecklist(office, 'c1', at(11));
    expect(text).toContain('Visit checklist: Ward Office 4');
    expect(text).toContain('Appointment required: https://example.org/book');
    expect(text).toContain('[ ] Hospital slip');
    expect(text).toContain('Closed 2026-06-03: Ward day');
    expect(text).toContain('Step-free access: yes');
    expect(text).toContain('does not reserve a token');
  });

  it('warns when the record is unverified and skips unknown counters', () => {
    const text = buildVisitChecklist({ id: 'u', name: 'Bare office' }, 'nope', at(11));
    expect(text).toContain('have not been verified');
    expect(text).not.toContain('Counter:');
  });
});
