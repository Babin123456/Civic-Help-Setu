import { describe, it, expect, beforeEach } from 'vitest';
import {
  LEGAL_DISCLAIMER,
  NOTICE_STATUSES,
  normalizeSourceUrl,
  normalizeTitle,
  getNotices,
  saveNotices,
  detectDuplicateNotice,
  validateNoticeInput,
  addNotice,
  updateNotice,
  changeNoticeStatus,
  getNoticesForService,
  queryNotices,
  getNoticeDigestStats,
  resetNoticesToDefault,
} from './noticeDigestService';
import { setCurrentActor } from './accessControl';

// These tests are about what the admin features do; who may use them is tested in accessControl.test.js.
setCurrentActor({ role: 'admin', username: 'Test Admin' });

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
  };
};

describe('noticeDigestService', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = makeStorage();
  });

  describe('URL and Title Normalization for Duplicate Detection', () => {
    it('normalizes source URLs by lowercasing host, removing www, and trimming trailing slash', () => {
      const url1 = 'https://WWW.EGAZETTE.GOV.IN/notices/2026/test.pdf/';
      const url2 = 'http://egazette.gov.in/notices/2026/test.pdf';
      expect(normalizeSourceUrl(url1)).toBe('egazette.gov.in/notices/2026/test.pdf');
      expect(normalizeSourceUrl(url2)).toBe('egazette.gov.in/notices/2026/test.pdf');
    });

    it('normalizes titles by removing punctuation and collapsing whitespace', () => {
      const title1 = 'Gazette Notice No. 412: Revision in Income Certificate!!';
      const title2 = 'gazette notice no 412  revision in income certificate';
      expect(normalizeTitle(title1)).toBe(normalizeTitle(title2));
    });

    it('handles empty or non-string inputs safely', () => {
      expect(normalizeSourceUrl(null)).toBe('');
      expect(normalizeSourceUrl(undefined)).toBe('');
      expect(normalizeTitle(null)).toBe('');
      expect(normalizeTitle(123)).toBe('');
    });
  });

  describe('Duplicate Notice Detection', () => {
    it('flags candidate with matching source URL as duplicate', () => {
      const existing = [
        {
          id: 'n1',
          title: 'Existing Notice A',
          sourceUrl: 'https://egazette.gov.in/orders/123.pdf',
          gazettePublicationDate: '2026-01-01T00:00:00.000Z',
          affectedServiceIds: ['income-certificate'],
          status: NOTICE_STATUSES.APPROVED,
        },
      ];
      saveNotices(existing, mockStorage);

      const candidate = {
        title: 'New Notice Different Title',
        sourceUrl: 'https://www.egazette.gov.in/orders/123.pdf/',
      };

      const result = detectDuplicateNotice(candidate, mockStorage);
      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateOf.id).toBe('n1');
      expect(result.reason).toContain('Source URL matches');
    });

    it('flags candidate with matching title as duplicate', () => {
      const existing = [
        {
          id: 'n2',
          title: 'Income Certificate Fee Waiver 2026',
          sourceUrl: 'https://revenue.gov.in/order1.pdf',
          gazettePublicationDate: '2026-01-01T00:00:00.000Z',
          affectedServiceIds: ['income-certificate'],
          status: NOTICE_STATUSES.APPROVED,
        },
      ];
      saveNotices(existing, mockStorage);

      const candidate = {
        title: 'income certificate fee waiver 2026!',
        sourceUrl: 'https://other-dept.gov.in/order-diff.pdf',
      };

      const result = detectDuplicateNotice(candidate, mockStorage);
      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateOf.id).toBe('n2');
      expect(result.reason).toContain('Title identical');
    });

    it('ignores self ID when checking updates', () => {
      const existing = [
        {
          id: 'n_self',
          title: 'Existing Notice Self',
          sourceUrl: 'https://revenue.gov.in/order-self.pdf',
          gazettePublicationDate: '2026-01-01T00:00:00.000Z',
          affectedServiceIds: ['income-certificate'],
          status: NOTICE_STATUSES.APPROVED,
        },
      ];
      saveNotices(existing, mockStorage);

      const candidate = {
        id: 'n_self',
        title: 'Existing Notice Self',
        sourceUrl: 'https://revenue.gov.in/order-self.pdf',
      };

      const result = detectDuplicateNotice(candidate, mockStorage);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('Validation of Notice Inputs and Missing Dates', () => {
    it('fails validation when publication date is missing or invalid', () => {
      const resMissing = validateNoticeInput({
        title: 'Valid Notice Title Here',
        sourceUrl: 'https://parivahan.gov.in/order.html',
        affectedServiceIds: ['driving-licence'],
      });
      expect(resMissing.isValid).toBe(false);
      expect(resMissing.errors.some((e) => e.includes('publication date is mandatory'))).toBe(true);

      const resInvalid = validateNoticeInput({
        title: 'Valid Notice Title Here',
        sourceUrl: 'https://parivahan.gov.in/order.html',
        gazettePublicationDate: 'not-a-valid-date',
        affectedServiceIds: ['driving-licence'],
      });
      expect(resInvalid.isValid).toBe(false);
      expect(resInvalid.errors.some((e) => e.includes('Invalid official publication date'))).toBe(true);
    });

    it('fails validation when source URL is missing or not http(s)', () => {
      const res = validateNoticeInput({
        title: 'Valid Notice Title Here',
        sourceUrl: 'ftp://not-allowed.com',
        gazettePublicationDate: '2026-02-01',
        affectedServiceIds: ['driving-licence'],
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('valid official source URL'))).toBe(true);
    });

    it('fails validation when affected services array is empty', () => {
      const res = validateNoticeInput({
        title: 'Valid Notice Title Here',
        sourceUrl: 'https://parivahan.gov.in/order.html',
        gazettePublicationDate: '2026-02-01',
        affectedServiceIds: [],
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('At least one affected service'))).toBe(true);
    });

    it('fails validation when title is too short', () => {
      const res = validateNoticeInput({
        title: 'Hi',
        sourceUrl: 'https://parivahan.gov.in/order.html',
        gazettePublicationDate: '2026-02-01',
        affectedServiceIds: ['driving-licence'],
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('at least 5 characters'))).toBe(true);
    });
  });

  describe('Add, Update, and Status Transitions', () => {
    it('successfully adds a valid notice with distinct publication date and reviewed date', () => {
      const pubDate = '2026-01-15T00:00:00.000Z';
      const revDate = '2026-01-20T10:00:00.000Z';

      const notice = addNotice(
        {
          title: 'Special Order 99: Extended DL Renewals',
          sourceUrl: 'https://parivahan.gov.in/orders/so99.html',
          gazettePublicationDate: pubDate,
          reviewedAtDate: revDate,
          affectedServiceIds: ['driving-licence'],
          summary: 'Permits 30-day grace period for transport renewals.',
          status: NOTICE_STATUSES.APPROVED,
        },
        'Senior Admin',
        mockStorage
      );

      expect(notice.id).toBeDefined();
      expect(notice.title).toBe('Special Order 99: Extended DL Renewals');
      expect(notice.gazettePublicationDate).toBe(new Date(pubDate).toISOString());
      expect(notice.reviewedAtDate).toBe(new Date(revDate).toISOString());
      expect(notice.legalDisclaimer).toBe(LEGAL_DISCLAIMER);
      expect(notice.history.length).toBe(1);
      expect(notice.history[0].actor).toBe('Senior Admin');
    });

    it('falls back to current timestamp if reviewedAtDate is omitted during addNotice', () => {
      const notice = addNotice(
        {
          title: 'Circular 44: Fee Waiver for Disability Certificates',
          sourceUrl: 'https://welfare.gov.in/circ44.pdf',
          gazettePublicationDate: '2026-02-10T00:00:00.000Z',
          affectedServiceIds: ['disability-certificate'],
        },
        'Reviewer 1',
        mockStorage
      );

      expect(notice.reviewedAtDate).toBeDefined();
      expect(isNaN(new Date(notice.reviewedAtDate).getTime())).toBe(false);
    });

    it('prevents adding duplicate notice and throws an error', () => {
      addNotice(
        {
          title: 'Circular 77: UIDAI Aadhaar Update Rules',
          sourceUrl: 'https://uidai.gov.in/circ77.pdf',
          gazettePublicationDate: '2026-02-01T00:00:00.000Z',
          affectedServiceIds: ['aadhaar-update'],
        },
        'Admin',
        mockStorage
      );

      expect(() => {
        addNotice(
          {
            title: 'Circular 77: UIDAI Aadhaar Update Rules',
            sourceUrl: 'https://uidai.gov.in/circ77.pdf',
            gazettePublicationDate: '2026-02-01T00:00:00.000Z',
            affectedServiceIds: ['aadhaar-update'],
          },
          'Admin',
          mockStorage
        );
      }).toThrow(/Duplicate notice detected/);
    });

    it('updates notice and records audit history', () => {
      const created = addNotice(
        {
          title: 'Panchayat Circular 12: Ration Card Verification',
          sourceUrl: 'https://food.gov.in/circ12.pdf',
          gazettePublicationDate: '2026-01-05T00:00:00.000Z',
          affectedServiceIds: ['ration-card'],
        },
        'Admin',
        mockStorage
      );

      const updated = updateNotice(
        created.id,
        { summary: 'Updated explanation of ration card requirements.' },
        'Editor 2',
        mockStorage
      );

      expect(updated.summary).toBe('Updated explanation of ration card requirements.');
      expect(updated.history.length).toBe(2);
      expect(updated.history[1].action).toBe('UPDATED');
      expect(updated.history[1].actor).toBe('Editor 2');
    });

    it('changes notice review status and appends audit note', () => {
      const created = addNotice(
        {
          title: 'Transport Notice 88: Road Tax Amendment',
          sourceUrl: 'https://transport.gov.in/notices/88.html',
          gazettePublicationDate: '2026-01-02T00:00:00.000Z',
          affectedServiceIds: ['driving-licence'],
          status: NOTICE_STATUSES.PENDING_REVIEW,
        },
        'Admin',
        mockStorage
      );

      const approved = changeNoticeStatus(
        created.id,
        NOTICE_STATUSES.APPROVED,
        'Legal Lead',
        'Verified against official gazette copy',
        mockStorage
      );

      expect(approved.status).toBe(NOTICE_STATUSES.APPROVED);
      const lastHistory = approved.history[approved.history.length - 1];
      expect(lastHistory.action).toBe('STATUS_APPROVED');
      expect(lastHistory.details).toBe('Verified against official gazette copy');
    });
  });

  describe('Service Linking and Queries', () => {
    it('returns only approved notices linked to a specified service', () => {
      // Clear default notices to start fresh
      saveNotices([], mockStorage);

      addNotice(
        {
          title: 'Notice for Driving Licence Approved',
          sourceUrl: 'https://morth.gov.in/dl1.html',
          gazettePublicationDate: '2026-01-10T00:00:00.000Z',
          affectedServiceIds: ['driving-licence'],
          status: NOTICE_STATUSES.APPROVED,
        },
        'Admin',
        mockStorage
      );

      addNotice(
        {
          title: 'Notice for Driving Licence Pending',
          sourceUrl: 'https://morth.gov.in/dl2.html',
          gazettePublicationDate: '2026-01-15T00:00:00.000Z',
          affectedServiceIds: ['driving-licence'],
          status: NOTICE_STATUSES.PENDING_REVIEW,
        },
        'Admin',
        mockStorage
      );

      addNotice(
        {
          title: 'Notice for Passport Only',
          sourceUrl: 'https://passportindia.gov.in/p1.html',
          gazettePublicationDate: '2026-01-12T00:00:00.000Z',
          affectedServiceIds: ['passport-renewal'],
          status: NOTICE_STATUSES.APPROVED,
        },
        'Admin',
        mockStorage
      );

      const dlApproved = getNoticesForService('driving-licence', mockStorage, true);
      expect(dlApproved.length).toBe(1);
      expect(dlApproved[0].title).toBe('Notice for Driving Licence Approved');

      const dlAll = getNoticesForService('driving-licence', mockStorage, false);
      expect(dlAll.length).toBe(2);

      const emptyService = getNoticesForService('non-existent-service', mockStorage);
      expect(emptyService.length).toBe(0);
    });

    it('queries notices by status, search keyword, and category', () => {
      saveNotices([], mockStorage);

      addNotice(
        {
          title: 'Revenue Dept Land Record Digitization',
          sourceUrl: 'https://revenue.gov.in/digit.pdf',
          gazettePublicationDate: '2026-01-05T00:00:00.000Z',
          affectedServiceIds: ['land-records'],
          category: 'rule_amendment',
          status: NOTICE_STATUSES.APPROVED,
          summary: 'Online mutation mandatory across all tehsils.',
        },
        'Admin',
        mockStorage
      );

      const byKeyword = queryNotices(mockStorage, { searchQuery: 'mutation' });
      expect(byKeyword.length).toBe(1);

      const byNonExistentKeyword = queryNotices(mockStorage, { searchQuery: 'unrelatedxyz' });
      expect(byNonExistentKeyword.length).toBe(0);
    });

    it('computes digest metrics accurately', () => {
      saveNotices([], mockStorage);

      addNotice(
        {
          title: 'Notice A',
          sourceUrl: 'https://a.gov.in/1',
          gazettePublicationDate: '2026-01-01',
          affectedServiceIds: ['service-a'],
          status: NOTICE_STATUSES.APPROVED,
        },
        'Admin',
        mockStorage
      );

      addNotice(
        {
          title: 'Notice B',
          sourceUrl: 'https://b.gov.in/2',
          gazettePublicationDate: '2026-01-02',
          affectedServiceIds: ['service-b'],
          status: NOTICE_STATUSES.PENDING_REVIEW,
        },
        'Admin',
        mockStorage
      );

      const stats = getNoticeDigestStats(mockStorage);
      expect(stats.total).toBe(2);
      expect(stats.approved).toBe(1);
      expect(stats.pending).toBe(1);
    });

    it('resets notices to default seed list', () => {
      saveNotices([], mockStorage);
      expect(getNotices(mockStorage).length).toBe(0);

      resetNoticesToDefault(mockStorage);
      expect(getNotices(mockStorage).length).toBeGreaterThan(0);
    });
  });
});
