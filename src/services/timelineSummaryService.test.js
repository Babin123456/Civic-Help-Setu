import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EVENT_CATEGORY,
  EVENT_SOURCE,
  normalizeApplicationEvent,
  resetApplicationEventStoreForTests,
} from './applicationEventService';
import { SUMMARY_LABEL, summarizeApplicationEvents } from './timelineSummaryService';

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: vi.fn((key) => (data.has(key) ? data.get(key) : null)),
    setItem: vi.fn((key, value) => data.set(key, String(value))),
    removeItem: vi.fn((key) => data.delete(key)),
    clear: vi.fn(() => data.clear()),
  };
};

const build = (overrides = {}) =>
  normalizeApplicationEvent({
    eventId: 'evt-1',
    applicationId: 'SRV-30000003',
    category: EVENT_CATEGORY.REVIEW,
    sourceType: EVENT_SOURCE.OFFICIAL_PORTAL,
    sourceRef: 'State portal',
    sourceTimestamp: '2026-10-14T10:00:00.000Z',
    sourceUrl: 'https://services.example.org/application/30000003',
    ingestedAt: '2026-10-14T10:05:00.000Z',
    status: 'in-progress',
    actorRole: 'reviewer',
    payloadVersion: 3,
    payload: { note: 'Review started.' },
    ...overrides,
  });

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage());
  resetApplicationEventStoreForTests();
});

describe('timeline summary service', () => {
  it('labels output as a suggestion and cites event IDs with exact dates', () => {
    const events = [
      build({ eventId: 'evt-submit', category: EVENT_CATEGORY.SUBMISSION }),
      build({
        eventId: 'evt-review',
        sourceTimestamp: '2026-10-16T09:30:00.000Z',
        payload: { note: 'Review continues.' },
      }),
    ];

    const result = summarizeApplicationEvents('SRV-30000003', events);

    expect(result.label).toBe(SUMMARY_LABEL);
    expect(result.isSuggestion).toBe(true);
    expect(result.summary).toContain('evt-submit');
    expect(result.summary).toContain('2026-10-14T10:00:00.000Z');
    expect(result.summary).toContain('2026-10-16T09:30:00.000Z');
    expect(result.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventId: 'evt-submit' }),
        expect.objectContaining({ eventId: 'evt-review' }),
      ])
    );
    expect(result.sourceReferences[0].sourceUrl).toBe(
      'https://services.example.org/application/30000003'
    );
    expect(result.dataVersion).toBeTruthy();
    expect(result.requiresReview).toBe(false);
  });

  it('never decides an official outcome from recorded events', () => {
    const result = summarizeApplicationEvents('SRV-30000003', [
      build({ eventId: 'evt-1', status: 'completed' }),
    ]);

    expect(result.summary).not.toMatch(/approved|rejected|guaranteed/i);
    expect(result.summary).toContain('does not decide or predict an official government status');
  });

  it('keeps citizen notes separate from official status', () => {
    const result = summarizeApplicationEvents('SRV-30000003', [
      build({ eventId: 'evt-official' }),
      build({
        eventId: 'evt-note',
        category: EVENT_CATEGORY.QUERY,
        sourceType: EVENT_SOURCE.CITIZEN_NOTE,
        sourceRef: 'Citizen note',
        status: null,
        actorRole: 'citizen',
        payload: { text: 'My private reminder.', privateGuidance: true },
      }),
    ]);

    expect(result.summary).toContain('Citizen notes kept separate as private guidance: 1');
    expect(
      result.sourceReferences.find((reference) => reference.eventId === 'evt-note')
        .isPrivateGuidance
    ).toBe(true);
  });

  it('routes conflicting official evidence to review with low confidence', () => {
    const result = summarizeApplicationEvents('SRV-30000003', [
      build({
        eventId: 'evt-conflict-a',
        category: EVENT_CATEGORY.OUTCOME,
        sourceTimestamp: '2026-10-20T10:00:00.000Z',
        status: 'completed',
      }),
      build({
        eventId: 'evt-conflict-b',
        category: EVENT_CATEGORY.OUTCOME,
        sourceTimestamp: '2026-10-20T10:00:00.000Z',
        status: 'action-required',
      }),
    ]);

    expect(result.requiresReview).toBe(true);
    expect(result.confidence).toBe('low');
    expect(result.reviewReason).toMatch(/Conflicting/);
  });

  it('returns a safe empty summary without inferring status', () => {
    const result = summarizeApplicationEvents('SRV-EMPTY', []);

    expect(result.citations).toEqual([]);
    expect(result.requiresReview).toBe(false);
    expect(result.summary).toContain('No status is inferred');
  });
});
