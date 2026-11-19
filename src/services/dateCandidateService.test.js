import { describe, it, expect } from 'vitest';
import {
  ACTION_TYPES,
  CONFIRMATION_STATES,
  DEADLINE_STORAGE_KEY,
  addDaysToDate,
  calculateDateDependencies,
  confirmDateCandidate,
  exportICal,
  extractDateCandidates,
  formatDisplayDate,
  getDateCandidatesByLane,
  getDateCandidatesByState,
  getDateRulesForCategory,
  getDeadlinesForService,
  getNoticeDeadlines,
  getTodayInTimeZone,
  isDateExpired,
  parseDateOnly,
  rejectDateCandidate,
  resetDateCandidate,
  resetDateCandidates,
  toDateOnly,
  updateDateCandidate,
  validateDateCandidate,
  validateDeadlineEdit,
} from './dateCandidateService';

const makeStorage = (initialData = {}) => {
  const map = new Map(Object.entries(initialData));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    dump: () => Object.fromEntries(map.entries()),
  };
};

const makeNotice = (overrides = {}) => ({
  id: 'notice_test',
  title: 'Test Gazette Notification',
  sourceUrl: 'https://example.gov.in/notice.pdf',
  gazettePublicationDate: '2026-02-15T00:00:00.000Z',
  category: 'rule_amendment',
  summary: 'Notice summary used as the source passage.',
  affectedServiceIds: ['sample-service'],
  status: 'approved',
  ...overrides,
});

const NOTICE_STORAGE_KEY = 'civicbridge_public_notices_digest_v1';

const makeNoticeStorage = (notices = [makeNotice()]) =>
  makeStorage({ [NOTICE_STORAGE_KEY]: JSON.stringify(notices) });

const lastOf = (candidates, actionType) =>
  candidates.find((candidate) => candidate.actionType === actionType);

describe('dateCandidateService - date arithmetic', () => {
  it('adds days across a month boundary', () => {
    expect(addDaysToDate('2026-02-15', 30)).toBe('2026-03-17');
  });

  it('adds days across a year boundary', () => {
    expect(addDaysToDate('2026-12-20', 15)).toBe('2027-01-04');
  });

  it('handles leap years', () => {
    expect(addDaysToDate('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysToDate('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDaysToDate('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('does not shift a UTC midnight timestamp to the previous day', () => {
    expect(toDateOnly('2026-02-15T00:00:00.000Z')).toBe('2026-02-15');
    expect(addDaysToDate('2026-02-15T00:00:00.000Z', 0)).toBe('2026-02-15');
  });

  it('rejects impossible dates and garbage', () => {
    expect(parseDateOnly('2026-13-40')).toBeNull();
    expect(parseDateOnly('not-a-date')).toBeNull();
    expect(addDaysToDate('not-a-date', 5)).toBeNull();
    expect(addDaysToDate('2026-02-15', Number.NaN)).toBeNull();
  });

  it('formats for display without a timezone shift', () => {
    expect(formatDisplayDate('2026-03-17')).toBe('17 Mar 2026');
  });
});

describe('dateCandidateService - rule sets', () => {
  it('always includes objection, submission and appeal windows', () => {
    const actionTypes = getDateRulesForCategory('other').map((rule) => rule.actionType);
    expect(actionTypes).toEqual([
      ACTION_TYPES.OBJECTION,
      ACTION_TYPES.SUBMISSION,
      ACTION_TYPES.APPEAL,
    ]);
  });

  it('adds a hearing window for rule amendments', () => {
    const rules = getDateRulesForCategory('rule_amendment');
    const hearing = rules.find((rule) => rule.actionType === ACTION_TYPES.HEARING);
    expect(hearing).toBeDefined();
    expect(hearing.days).toBe(45);
  });

  it('adds a payment window for fee revisions', () => {
    const rules = getDateRulesForCategory('fee_revision');
    expect(rules.some((rule) => rule.actionType === ACTION_TYPES.PAYMENT)).toBe(true);
  });

  it('never returns duplicate action types', () => {
    const rules = getDateRulesForCategory('rule_amendment');
    const actionTypes = rules.map((rule) => rule.actionType);
    expect(new Set(actionTypes).size).toBe(actionTypes.length);
  });
});

describe('dateCandidateService - extraction', () => {
  it('returns an empty list without a notice id or publication date', () => {
    expect(extractDateCandidates(null)).toEqual([]);
    expect(extractDateCandidates({ ...makeNotice(), id: undefined })).toEqual([]);
    expect(extractDateCandidates({ ...makeNotice(), gazettePublicationDate: null })).toEqual([]);
  });

  it('derives publication, objection, submission, hearing and appeal dates', () => {
    const candidates = extractDateCandidates(makeNotice());
    expect(lastOf(candidates, ACTION_TYPES.PUBLICATION).normalizedDate).toBe('2026-02-15');
    expect(lastOf(candidates, ACTION_TYPES.OBJECTION).normalizedDate).toBe('2026-03-17');
    expect(lastOf(candidates, ACTION_TYPES.SUBMISSION).normalizedDate).toBe('2026-03-02');
    expect(lastOf(candidates, ACTION_TYPES.HEARING).normalizedDate).toBe('2026-04-01');
    expect(lastOf(candidates, ACTION_TYPES.APPEAL).normalizedDate).toBe('2026-04-16');
  });

  it('uses stable ids so a re-analysis does not duplicate state', () => {
    const first = extractDateCandidates(makeNotice()).map((c) => c.id);
    const second = extractDateCandidates(makeNotice()).map((c) => c.id);
    expect(first).toEqual(second);
    expect(first[0]).toBe('deadline_notice_test_publication');
  });

  it('carries a source reference for every candidate', () => {
    const candidates = extractDateCandidates(makeNotice());
    candidates.forEach((candidate) => {
      expect(candidate.sourceAnchor.url).toBe('https://example.gov.in/notice.pdf');
      expect(candidate.rawText.length).toBeGreaterThan(0);
    });
  });

  it('routes low-confidence candidates to review', () => {
    const appeal = lastOf(extractDateCandidates(makeNotice()), ACTION_TYPES.APPEAL);
    expect(appeal.confidence).toBeLessThan(0.6);
    expect(appeal.requiresReview).toBe(true);

    const publication = lastOf(extractDateCandidates(makeNotice()), ACTION_TYPES.PUBLICATION);
    expect(publication.isOfficialField).toBe(true);
    expect(publication.requiresReview).toBe(false);
  });
});

describe('dateCandidateService - citizen confirmation state', () => {
  it('leaves every candidate pending by default', () => {
    const deadlines = getNoticeDeadlines(makeNotice());
    expect(deadlines.every((d) => d.confirmationState === CONFIRMATION_STATES.PENDING)).toBe(true);
  });

  it('confirms a candidate and exposes it in the confirmed bucket', () => {
    const storage = makeNoticeStorage();
    confirmDateCandidate('deadline_notice_test_objection', storage);

    const grouped = getDateCandidatesByState('notice_test', storage);
    expect(grouped.confirmed).toHaveLength(1);
    expect(grouped.confirmed[0].actionType).toBe(ACTION_TYPES.OBJECTION);
    expect(grouped.pending.some((d) => d.actionType === ACTION_TYPES.OBJECTION)).toBe(false);
  });

  it('dismisses a candidate without deleting it from history', () => {
    const storage = makeNoticeStorage();
    rejectDateCandidate('deadline_notice_test_appeal', storage);

    const grouped = getDateCandidatesByState('notice_test', storage);
    expect(grouped.rejected).toHaveLength(1);
    expect(grouped.rejected[0].isExpired).toBe(true);
  });

  it('edits the date and note and confirms the deadline', () => {
    const storage = makeStorage();
    updateDateCandidate(
      'deadline_notice_test_submission',
      { normalizedDate: '2026-03-05', note: 'Office confirmed this date' },
      storage
    );

    const deadlines = getNoticeDeadlines(makeNotice(), { storage });
    const submission = deadlines.find((d) => d.actionType === ACTION_TYPES.SUBMISSION);
    expect(submission.normalizedDate).toBe('2026-03-05');
    expect(submission.note).toBe('Office confirmed this date');
    expect(submission.confirmationState).toBe(CONFIRMATION_STATES.CONFIRMED);
  });

  it('rejects an invalid edit', () => {
    const storage = makeStorage();
    expect(() =>
      updateDateCandidate('deadline_notice_test_submission', { normalizedDate: '2026-99-99' }, storage)
    ).toThrow(/valid date/i);
  });

  it('resets a single candidate back to its derived value', () => {
    const storage = makeStorage();
    updateDateCandidate('deadline_notice_test_submission', { normalizedDate: '2026-03-05' }, storage);
    resetDateCandidate('deadline_notice_test_submission', storage);

    const deadlines = getNoticeDeadlines(makeNotice(), { storage });
    const submission = deadlines.find((d) => d.actionType === ACTION_TYPES.SUBMISSION);
    expect(submission.normalizedDate).toBe('2026-03-02');
    expect(submission.confirmationState).toBe(CONFIRMATION_STATES.PENDING);
  });

  it('resets every candidate for a notice', () => {
    const storage = makeNoticeStorage();
    confirmDateCandidate('deadline_notice_test_objection', storage);
    confirmDateCandidate('deadline_notice_test_submission', storage);
    resetDateCandidates('notice_test', storage);

    const grouped = getDateCandidatesByState('notice_test', storage);
    expect(grouped.confirmed).toHaveLength(0);
    expect(grouped.pending).toHaveLength(5);
  });

  it('groups candidates into lanes', () => {
    const storage = makeNoticeStorage();
    const lanes = getDateCandidatesByLane('notice_test', storage);
    expect(lanes.response.map((d) => d.actionType)).toEqual([
      ACTION_TYPES.PUBLICATION,
      ACTION_TYPES.SUBMISSION,
      ACTION_TYPES.OBJECTION,
    ]);
    expect(lanes.hearing.map((d) => d.actionType)).toEqual([ACTION_TYPES.HEARING]);
    expect(lanes.payment).toEqual([]);
    expect(lanes.appeal.map((d) => d.actionType)).toEqual([ACTION_TYPES.APPEAL]);
  });

  it('survives malformed stored state', () => {
    const storage = makeStorage({ [DEADLINE_STORAGE_KEY]: '{not json' });
    const deadlines = getNoticeDeadlines(makeNotice(), { storage });
    expect(deadlines.every((d) => d.confirmationState === CONFIRMATION_STATES.PENDING)).toBe(true);
  });
});

describe('dateCandidateService - expiration and history', () => {
  it('keeps expired deadlines in the result but flags them', () => {
    const now = new Date('2026-11-19T12:00:00.000Z');
    const deadlines = getNoticeDeadlines(makeNotice(), { now });
    expect(deadlines.length).toBe(5);
    expect(deadlines.every((d) => d.isExpired)).toBe(true);
  });

  it('does not flag future deadlines as expired', () => {
    const now = new Date('2026-02-20T12:00:00.000Z');
    const deadlines = getNoticeDeadlines(makeNotice(), { now });
    expect(deadlines.find((d) => d.actionType === ACTION_TYPES.OBJECTION).isExpired).toBe(false);
  });

  it('uses the IST calendar day for expiry', () => {
    const lateUtc = new Date('2026-11-19T20:00:00.000Z');
    expect(getTodayInTimeZone(lateUtc)).toBe('2026-11-20');
    expect(isDateExpired('2026-11-19', lateUtc)).toBe(true);
    expect(isDateExpired('2026-11-20', lateUtc)).toBe(false);
  });

  it('resolves deadlines for a linked service', () => {
    const storage = makeStorage();
    const deadlines = getDeadlinesForService('income-certificate', { storage });
    expect(deadlines.length).toBeGreaterThan(0);
    expect(deadlines.every((d) => d.noticeId === 'notice_gaz_2026_01')).toBe(true);
  });

  it('returns nothing for a service without a linked notice', () => {
    expect(getDeadlinesForService('no-such-service', { storage: makeStorage() })).toEqual([]);
  });
});

describe('dateCandidateService - dependencies', () => {
  it('links each action to its prerequisites without looping forever', () => {
    const candidates = extractDateCandidates(makeNotice());
    const graph = calculateDateDependencies(candidates);
    const byAction = Object.fromEntries(candidates.map((c) => [c.actionType, c]));

    expect(graph[byAction[ACTION_TYPES.OBJECTION].id]).toEqual([
      expect.objectContaining({ dependsOnActionType: ACTION_TYPES.PUBLICATION }),
    ]);

    const hearingDeps = graph[byAction[ACTION_TYPES.HEARING].id].map((d) => d.dependsOnActionType);
    expect(hearingDeps).toEqual([ACTION_TYPES.PUBLICATION, ACTION_TYPES.OBJECTION]);

    const paymentDeps = graph[byAction[ACTION_TYPES.PAYMENT]?.id || 'missing'] || [];
    expect(paymentDeps).toEqual([]);
  });

  it('ignores prerequisites that are not in the list', () => {
    const candidates = extractDateCandidates(makeNotice()).filter(
      (c) => c.actionType !== ACTION_TYPES.PUBLICATION
    );
    const graph = calculateDateDependencies(candidates);
    const objection = candidates.find((c) => c.actionType === ACTION_TYPES.OBJECTION);
    expect(graph[objection.id]).toEqual([]);
  });
});

describe('dateCandidateService - validation', () => {
  it('accepts a well-formed candidate', () => {
    const [candidate] = extractDateCandidates(makeNotice());
    expect(validateDateCandidate(candidate)).toEqual({ isValid: true, errors: [] });
  });

  it('rejects missing action type, bad dates and out-of-range confidence', () => {
    expect(validateDateCandidate({}).isValid).toBe(false);
    expect(
      validateDateCandidate({
        actionType: ACTION_TYPES.OBJECTION,
        normalizedDate: '2026-02-31',
        rawText: 'x',
      }).isValid
    ).toBe(false);
    expect(
      validateDateCandidate({
        actionType: ACTION_TYPES.OBJECTION,
        normalizedDate: '2026-03-01',
        rawText: 'x',
        confidence: 1.4,
      }).isValid
    ).toBe(false);
  });

  it('validates citizen edits', () => {
    expect(validateDeadlineEdit({ normalizedDate: '2026-04-01', note: 'ok' }).isValid).toBe(true);
    expect(validateDeadlineEdit({ normalizedDate: '' }).isValid).toBe(true);
    expect(validateDeadlineEdit({ normalizedDate: 'nope' }).isValid).toBe(false);
    expect(validateDeadlineEdit({ note: 'x'.repeat(501) }).isValid).toBe(false);
    expect(validateDeadlineEdit({ note: 42 }).isValid).toBe(false);
  });
});

describe('dateCandidateService - iCalendar export', () => {
  it('returns null when nothing is confirmed', () => {
    expect(exportICal(makeNotice(), makeStorage())).toBeNull();
  });

  it('exports only confirmed deadlines', () => {
    const storage = makeStorage();
    confirmDateCandidate('deadline_notice_test_objection', storage);
    rejectDateCandidate('deadline_notice_test_submission', storage);

    const ical = exportICal(makeNotice(), storage);
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('END:VCALENDAR');
    expect(ical).toContain('DTSTART;VALUE=DATE:20260317');
    expect(ical).toContain('DTEND;VALUE=DATE:20260318');
    expect(ical).toContain('STATUS:CONFIRMED');
    expect(ical).toContain('@civic-helpsetu');
    expect(ical).not.toContain('20260302');
    expect(ical.split('\r\n').length).toBeGreaterThan(5);
  });

  it('escapes commas, semicolons and newlines in text fields', () => {
    const storage = makeStorage();
    const notice = makeNotice({
      id: 'notice_test_escape',
      title: 'Special, notice; with newline\nand comma',
      sourceUrl: 'https://example.gov.in/special.pdf',
    });
    confirmDateCandidate('deadline_notice_test_escape_publication', storage);

    const ical = exportICal(notice, storage);
    expect(ical).toContain('SUMMARY:');
    expect(ical).toContain('Special\\, notice\\; with newline\\nand comma');
  });

  it('accepts a notice id and resolves it from storage', () => {
    const storage = makeStorage();
    confirmDateCandidate('deadline_notice_gaz_2026_01_publication', storage);
    const ical = exportICal('notice_gaz_2026_01', storage);
    expect(ical).toContain('BEGIN:VEVENT');
  });
});