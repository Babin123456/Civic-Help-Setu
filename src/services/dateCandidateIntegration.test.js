import { describe, it, expect } from 'vitest';
import { getNotices } from './noticeDigestService';
import {
  CONFIRMATION_STATES,
  DEADLINE_STORAGE_KEY,
  confirmDateCandidate,
  extractDateCandidates,
  getDateCandidatesByState,
  getDeadlinesForService,
  getNoticeDeadlines,
} from './dateCandidateService';

const NOTICE_STORAGE_KEY = 'civicbridge_public_notices_digest_v1';

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
    clear: () => map.clear(),
    dump: () => Object.fromEntries(map.entries()),
  };
};

const makeNotice = (overrides = {}) => ({
  id: 'notice_it_1',
  title: 'Integration Gazette Notification',
  sourceUrl: 'https://example.gov.in/notice.pdf',
  gazettePublicationDate: '2026-02-15T00:00:00.000Z',
  category: 'rule_amendment',
  summary: 'Integration summary.',
  affectedServiceIds: ['integration-service'],
  status: 'approved',
  ...overrides,
});

const seededStorage = (notices) =>
  makeStorage({ [NOTICE_STORAGE_KEY]: JSON.stringify(notices) });

describe('notice deadline service integration', () => {
  it('does not mutate official notice records when a citizen confirms a date', () => {
    const storage = seededStorage([makeNotice()]);
    const before = JSON.stringify(getNotices(storage));

    confirmDateCandidate('deadline_notice_it_1_objection', storage);

    const after = JSON.stringify(getNotices(storage));
    expect(after).toBe(before);
    expect(storage.dump()[DEADLINE_STORAGE_KEY]).toBeDefined();
  });

  it('keeps citizen state separate for each notice', () => {
    const storage = seededStorage([
      makeNotice(),
      makeNotice({ id: 'notice_it_2', title: 'Second Integration Notice' }),
    ]);

    confirmDateCandidate('deadline_notice_it_1_objection', storage);

    const first = getDateCandidatesByState('notice_it_1', storage);
    const second = getDateCandidatesByState('notice_it_2', storage);
    expect(first.confirmed).toHaveLength(1);
    expect(second.confirmed).toHaveLength(0);
  });

  it('returns empty results for unknown or empty inputs', () => {
    const storage = seededStorage([]);
    expect(getDeadlinesForService('', { storage })).toEqual([]);
    expect(getDeadlinesForService('missing-service', { storage })).toEqual([]);
    expect(getDateCandidatesByState('missing-notice', storage)).toEqual({
      pending: [],
      confirmed: [],
      rejected: [],
    });
  });

  it('ignores notices that are not approved', () => {
    const storage = seededStorage([makeNotice({ status: 'pending_review' })]);
    expect(getDeadlinesForService('integration-service', { storage })).toEqual([]);
  });

  it('handles a malformed notice without throwing', () => {
    const notice = makeNotice({ gazettePublicationDate: 'not-a-date' });
    expect(extractDateCandidates(notice)).toEqual([]);
    expect(getNoticeDeadlines(notice)).toEqual([]);
  });

  it('tolerates malformed persisted state instead of crashing', () => {
    const storage = makeStorage({
      [NOTICE_STORAGE_KEY]: JSON.stringify([makeNotice()]),
      [DEADLINE_STORAGE_KEY]: 'not-json',
    });

    const deadlines = getNoticeDeadlines(makeNotice(), { storage });
    expect(deadlines).toHaveLength(5);
    expect(deadlines.every((d) => d.confirmationState === CONFIRMATION_STATES.PENDING)).toBe(true);
  });

  it('returns deadlines for a service only from its approved linked notices', () => {
    const storage = seededStorage([
      makeNotice(),
      makeNotice({ id: 'notice_it_2', affectedServiceIds: ['other-service'] }),
    ]);

    const deadlines = getDeadlinesForService('integration-service', { storage });
    expect(deadlines).toHaveLength(5);
    expect(new Set(deadlines.map((d) => d.noticeId))).toEqual(new Set(['notice_it_1']));
  });
});
