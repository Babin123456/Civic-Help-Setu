import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EVENT_CATEGORY,
  EVENT_ERROR,
  EVENT_SOURCE,
  ApplicationEventError,
  appendApplicationEvent,
  createEventDiff,
  detectTimelineAnomalies,
  ensureApplicationEvents,
  getApplicationTimeline,
  getStoredApplicationEvents,
  listApplicationEvents,
  normalizeApplicationEvent,
  parseSourceTimestamp,
  projectLegacyApplicationToEvents,
  reportTimelineInconsistency,
  getInconsistencyReports,
  resetApplicationEventStoreForTests,
  sortEventsChronologically,
} from './applicationEventService';

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: vi.fn((key) => (data.has(key) ? data.get(key) : null)),
    setItem: vi.fn((key, value) => data.set(key, String(value))),
    removeItem: vi.fn((key) => data.delete(key)),
    clear: vi.fn(() => data.clear()),
  };
};

const event = (overrides = {}) => ({
  applicationId: 'SRV-10000001',
  category: EVENT_CATEGORY.REVIEW,
  sourceType: EVENT_SOURCE.OFFICIAL_PORTAL,
  sourceRef: 'State services portal',
  sourceTimestamp: '2026-10-12T10:00:00.000Z',
  ingestedAt: '2026-10-12T10:05:00.000Z',
  status: 'in-progress',
  actorRole: 'reviewer',
  payloadVersion: 1,
  payload: { note: 'Document scrutiny started.' },
  ...overrides,
});

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage());
  resetApplicationEventStoreForTests();
});

describe('parseSourceTimestamp', () => {
  it('parses readable and ISO dates and rejects placeholders', () => {
    expect(parseSourceTimestamp('2026-10-12T10:00:00.000Z')).toBe(
      Date.parse('2026-10-12T10:00:00.000Z')
    );
    expect(parseSourceTimestamp('Oct 12, 2026 • 10:15 AM')).toBe(
      Date.parse('Oct 12, 2026 10:15 AM')
    );
    ['Pending', 'Estimated Oct 22', 'Date pending', '', null, undefined, 'Recent'].forEach(
      (value) => expect(parseSourceTimestamp(value)).toBeNull()
    );
  });
});

describe('validateApplicationEventInput', () => {
  it('rejects malformed events before storage', () => {
    expect(() =>
      appendApplicationEvent({ applicationId: '', category: 'unknown' })
    ).toThrow(ApplicationEventError);

    try {
      appendApplicationEvent({ applicationId: 'SRV-1' });
    } catch (error) {
      expect(error.code).toBe(EVENT_ERROR.VALIDATION_FAILED);
      expect(error.details.length).toBeGreaterThan(2);
    }
    expect(getStoredApplicationEvents()).toHaveLength(0);
  });

  it('prevents citizen notes from claiming official status', () => {
    expect(() =>
      appendApplicationEvent(
        event({
          sourceType: EVENT_SOURCE.CITIZEN_NOTE,
          isOfficial: true,
          status: null,
        })
      )
    ).toThrow(ApplicationEventError);
  });

  it('rejects identity numbers and unsafe source links before storage', () => {
    const detailsFor = (input) => {
      try {
        appendApplicationEvent(input);
      } catch (error) {
        return error.details.join(' ');
      }
      return '';
    };

    expect(
      detailsFor(event({ payload: { text: 'Aadhaar 5544 3322 1100 attached.' } }))
    ).toMatch(/Aadhaar/);
    expect(detailsFor(event({ payload: { pan: 'ABCDE1234F' } }))).toMatch(/PAN/);
    expect(detailsFor(event({ sourceUrl: 'javascript:alert(1)' }))).toMatch(/sourceUrl/);
    expect(detailsFor(event({ payload: { attachment: 'document.pdf' } }))).toMatch(
      /sensitive field/
    );
    expect(detailsFor(event({ payload: { text: 'x'.repeat(4001) } }))).toMatch(
      /4000 characters/
    );
    expect(getStoredApplicationEvents()).toHaveLength(0);
  });

  it('keeps only safe http source links on stored events', () => {
    const stored = appendApplicationEvent(
      event({
        eventId: 'evt-source-link',
        sourceUrl: 'https://services.example.org/application/123',
      })
    );
    const unsafe = normalizeApplicationEvent(
      event({ eventId: 'evt-unsafe', sourceUrl: 'data:text/html,<script>alert(1)</script>' })
    );

    expect(stored.sourceUrl).toBe('https://services.example.org/application/123');
    expect(unsafe.sourceUrl).toBe('');
  });
});

describe('append-only event storage', () => {
  it('stores events with source, ingestion timestamps, and a payload version', () => {
    const stored = appendApplicationEvent(event({ eventId: 'evt-1' }));

    expect(stored.eventId).toBe('evt-1');
    expect(stored.sourceTimestamp).toBe('2026-10-12T10:00:00.000Z');
    expect(stored.ingestedAt).toBe('2026-10-12T10:05:00.000Z');
    expect(stored.payloadVersion).toBe(1);
    expect(stored.isOfficial).toBe(true);
    expect(getStoredApplicationEvents()).toHaveLength(1);
  });

  it('rejects duplicate event IDs and idempotency keys without overwriting', () => {
    appendApplicationEvent(event({ eventId: 'evt-1', idempotencyKey: 'idem-1' }));

    expect(() =>
      appendApplicationEvent(event({ eventId: 'evt-1', payload: { note: 'Changed' } }))
    ).toThrow(/never overwritten/);

    expect(() =>
      appendApplicationEvent(event({ eventId: 'evt-2', idempotencyKey: 'idem-1' }))
    ).toThrow(ApplicationEventError);

    const [stored] = getStoredApplicationEvents();
    expect(stored.payload.note).toBe('Document scrutiny started.');
    expect(getStoredApplicationEvents()).toHaveLength(1);
  });

  it('rejects identical content even when IDs differ', () => {
    appendApplicationEvent(event({ eventId: 'evt-1' }));
    expect(() => appendApplicationEvent(event({ eventId: 'evt-2' }))).toThrow(
      /identical event record/
    );
  });

  it('sorts by source timestamp and keeps unparseable timestamps last', () => {
    const late = normalizeApplicationEvent(
      event({ eventId: 'late', sourceTimestamp: '2026-10-20T10:00:00.000Z' })
    );
    const early = normalizeApplicationEvent(
      event({
        eventId: 'early',
        sourceTimestamp: '2026-10-01T10:00:00.000Z',
        payload: { note: 'early' },
      })
    );
    const unknown = normalizeApplicationEvent(
      event({
        eventId: 'unknown',
        sourceTimestamp: 'Date pending',
        payload: { note: 'unknown' },
      })
    );

    expect(
      sortEventsChronologically([late, unknown, early]).map((item) => item.eventId)
    ).toEqual(['early', 'late', 'unknown']);
  });

  it('paginates large application timelines', () => {
    for (let index = 0; index < 7; index += 1) {
      appendApplicationEvent(
        event({
          eventId: `evt-${index}`,
          sourceTimestamp: `2026-10-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
          payload: { index },
        })
      );
    }

    const first = listApplicationEvents('SRV-10000001', { limit: 3 });
    const second = listApplicationEvents('SRV-10000001', {
      limit: 3,
      cursor: first.nextCursor,
    });

    expect(first.total).toBe(7);
    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).toBe('3');
    expect(second.items[0].eventId).toBe('evt-3');
  });
});

describe('legacy projection', () => {
  const application = {
    id: 'SRV-20000002',
    appliedDate: 'Oct 12, 2026',
    status: 'in-progress',
    stages: [
      {
        title: 'Application Submitted',
        description: 'Received.',
        timestamp: 'Oct 12, 2026 • 10:15 AM',
        completed: true,
      },
      {
        title: 'Verification',
        description: 'Under review.',
        timestamp: 'Oct 14, 2026 • 03:30 PM',
        inProgress: true,
      },
    ],
    notes: [
      {
        id: 'n1',
        text: 'Citizen uploaded a clearer proof.',
        date: 'Oct 15, 2026 • 02:00 PM',
      },
    ],
  };

  it('creates timeline events and keeps citizen notes separate from official events', () => {
    const projected = projectLegacyApplicationToEvents(application);
    expect(projected).toHaveLength(3);
    expect(projected[0].category).toBe(EVENT_CATEGORY.SUBMISSION);
    expect(projected[1].category).toBe(EVENT_CATEGORY.ACKNOWLEDGEMENT);

    const note = projected[2];
    expect(note.sourceType).toBe(EVENT_SOURCE.CITIZEN_NOTE);
    expect(note.category).toBe(EVENT_CATEGORY.QUERY);
    expect(note.status).toBeNull();
    expect(note.payload.privateGuidance).toBe(true);
  });

  it('appends a new event when a legacy milestone changes and keeps the old one', () => {
    ensureApplicationEvents(application);
    const changed = {
      ...application,
      stages: application.stages.map((stage, index) =>
        index === 1 ? { ...stage, description: 'Review escalated to a senior officer.' } : stage
      ),
    };

    const result = ensureApplicationEvents(changed);
    const reviewEvents = getStoredApplicationEvents().filter(
      (item) => item.applicationId === 'SRV-20000002' && item.category === 'acknowledgement'
    );

    expect(result.seededCount).toBe(1);
    expect(reviewEvents).toHaveLength(2);
    expect(reviewEvents[0].eventId).not.toBe(reviewEvents[1].eventId);
    expect(reviewEvents[0].payload.description).toBe('Under review.');
    expect(reviewEvents[1].payload.description).toContain('senior officer');
  });

  it('seeds legacy events without duplicating them on repeated loads', () => {
    const first = ensureApplicationEvents(application);
    const second = ensureApplicationEvents(application);

    expect(first.seededCount).toBe(3);
    expect(second.seededCount).toBe(0);
    expect(getStoredApplicationEvents()).toHaveLength(3);
    expect(second.events.every((item) => item.isOfficial === false)).toBe(true);
  });

  it('reports empty and ready timeline states', () => {
    const empty = getApplicationTimeline({ id: 'SRV-EMPTY' });
    expect(empty.state).toBe('empty');
    expect(empty.events).toEqual([]);

    const ready = getApplicationTimeline(application);
    expect(ready.state).toBe('ready');
    expect(ready.events).toHaveLength(3);
    expect(ready.dataVersion).toBeTruthy();
  });
});

describe('anomaly detection', () => {
  it('detects out-of-order ingestion, duplicates, and conflicting official evidence', () => {
    const outOfOrder = [
      normalizeApplicationEvent(
        event({
          eventId: 'later-source',
          sourceTimestamp: '2026-10-20T10:00:00.000Z',
          ingestedAt: '2026-10-20T10:05:00.000Z',
        })
      ),
      normalizeApplicationEvent(
        event({
          eventId: 'earlier-source',
          sourceTimestamp: '2026-10-10T10:00:00.000Z',
          ingestedAt: '2026-10-21T10:05:00.000Z',
          payload: { note: 'later ingestion' },
        })
      ),
      normalizeApplicationEvent(
        event({
          eventId: 'conflict-a',
          category: EVENT_CATEGORY.OUTCOME,
          status: 'completed',
          sourceTimestamp: '2026-10-22T10:00:00.000Z',
        })
      ),
      normalizeApplicationEvent(
        event({
          eventId: 'conflict-b',
          category: EVENT_CATEGORY.OUTCOME,
          status: 'action-required',
          sourceTimestamp: '2026-10-22T10:00:00.000Z',
          payload: { note: 'conflicting' },
        })
      ),
    ];

    const duplicate = { ...outOfOrder[0] };

    const anomalies = detectTimelineAnomalies([...outOfOrder, duplicate]);
    const types = anomalies.map((anomaly) => anomaly.type);

    expect(types).toContain('out_of_order');
    expect(types).toContain('duplicate');
    expect(types).toContain('conflicting_official_evidence');
  });
});

describe('event difference viewer', () => {
  it('compares only stored records and lists changed fields', () => {
    appendApplicationEvent(event({ eventId: 'evt-a', payload: { note: 'before' } }));
    appendApplicationEvent(
      event({
        eventId: 'evt-b',
        status: 'action-required',
        sourceTimestamp: '2026-10-14T10:00:00.000Z',
        payload: { note: 'after' },
      })
    );

    const diff = createEventDiff(getStoredApplicationEvents(), 'evt-a', 'evt-b');
    const changed = diff.fields.filter((field) => field.changed).map((field) => field.field);

    expect(changed).toContain('status');
    expect(changed).toContain('sourceTimestamp');
    expect(changed).toContain('payload');
    expect(diff.fields.map((field) => field.field)).toContain('sourceUrl');
    expect(diff.changedCount).toBeGreaterThan(0);
    expect(diff.dataVersion).toBeTruthy();
  });

  it('throws a structured error when either event is missing', () => {
    expect(() => createEventDiff([], 'missing-a', 'missing-b')).toThrow(
      /Both events must exist/
    );
    try {
      createEventDiff([], 'missing-a', 'missing-b');
    } catch (error) {
      expect(error.code).toBe(EVENT_ERROR.EVENT_NOT_FOUND);
    }
  });
});

describe('inconsistency reports', () => {
  it('validates and stores a report for review', () => {
    const report = reportTimelineInconsistency({
      applicationId: 'SRV-10000001',
      eventIds: ['evt-a', 'evt-a', 'evt-b'],
      reason: 'Official source and milestone status disagree.',
    });

    expect(report.eventIds).toEqual(['evt-a', 'evt-b']);
    expect(report.status).toBe('pending_review');
    expect(getInconsistencyReports('SRV-10000001')).toHaveLength(1);
  });

  it('rejects an empty or unsafe report', () => {
    expect(() =>
      reportTimelineInconsistency({ applicationId: 'SRV-1', eventIds: [], reason: 'bad' })
    ).toThrow(ApplicationEventError);
    expect(() =>
      reportTimelineInconsistency({
        applicationId: 'SRV-1',
        eventIds: ['evt-a'],
        reason: 'My Aadhaar 5544 3322 1100 is attached.',
      })
    ).toThrow(ApplicationEventError);
    expect(getInconsistencyReports()).toHaveLength(0);
  });
});
