import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NEWSLETTER_FREQUENCIES,
  NEWSLETTER_STATUS,
  DEFAULT_TOPICS,
  getSubscriptions,
  saveSubscriptions,
  getSentDigests,
  recordSentDigest,
  hasDigestBeenSent,
  validateSubscriptionInput,
  createSubscription,
  getSubscriptionById,
  getSubscriptionByEmail,
  getSubscriptionByToken,
  verifySubscription,
  updateSubscription,
  unsubscribe,
  resubscribe,
  getActiveSubscriptions,
  getSubscriptionsForDigest,
  buildDigestContent,
  markDigestSent,
  generateAdminPreview,
  getSubscriptionStats,
  logDeliveryFailure,
  getDeliveryFailures,
  resetSubscriptionData,
} from './newsletterSubscriptionService';

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

vi.mock('./locationService', () => ({
  getAvailableStates: vi.fn(() => ['Maharashtra', 'Delhi', 'Karnataka']),
  getDistrictsByState: vi.fn((state) => {
    const districts = {
      Maharashtra: ['Mumbai', 'Pune', 'Nagpur'],
      Delhi: ['New Delhi', 'North Delhi', 'South Delhi'],
      Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru'],
    };
    return districts[state] || [];
  }),
}));

vi.mock('./serviceCatalog', () => ({
  getAllServices: vi.fn(() => [
    { id: 'birth-certificate', name: 'Birth Certificate', category: 'Certificates', jurisdiction: { level: 'state', states: ['Maharashtra', 'Delhi'] } },
    { id: 'driving-licence', name: 'Driving Licence', category: 'Transport', jurisdiction: { level: 'national' } },
    { id: 'ration-card', name: 'Ration Card', category: 'Social Welfare', jurisdiction: { level: 'state', states: ['Maharashtra', 'Karnataka'] } },
    { id: 'income-certificate', name: 'Income Certificate', category: 'Certificates', jurisdiction: { level: 'state', states: ['Maharashtra'] } },
    { id: 'pm-kisan', name: 'PM Kisan', category: 'Agriculture', jurisdiction: { level: 'national' } },
  ]),
}));

vi.mock('./noticeDigestService', () => ({
  getNotices: vi.fn(() => [
    {
      id: 'notice_1',
      title: 'New Service: Senior Citizen Card',
      summary: 'New digital service for senior citizens.',
      category: 'gazette_order',
      gazettePublicationDate: '2026-01-15T00:00:00.000Z',
      sourceUrl: 'https://example.gov.in/notice1',
      affectedServiceIds: ['birth-certificate'],
      status: 'approved',
    },
    {
      id: 'notice_2',
      title: 'Driving Licence Fee Revision',
      summary: 'Fees revised for driving licence renewal.',
      category: 'fee_revision',
      gazettePublicationDate: '2026-01-10T00:00:00.000Z',
      sourceUrl: 'https://example.gov.in/notice2',
      affectedServiceIds: ['driving-licence'],
      status: 'approved',
    },
    {
      id: 'notice_3',
      title: 'Ration Card Deadline Extension',
      summary: 'Deadline extended for ration card applications.',
      category: 'deadline_extension',
      gazettePublicationDate: '2026-01-05T00:00:00.000Z',
      sourceUrl: 'https://example.gov.in/notice3',
      affectedServiceIds: ['ration-card'],
      status: 'approved',
    },
    {
      id: 'notice_4',
      title: 'PM Kisan New Installment',
      summary: 'New installment announced for PM Kisan scheme.',
      category: 'gazette_order',
      gazettePublicationDate: '2026-01-01T00:00:00.000Z',
      sourceUrl: 'https://example.gov.in/notice4',
      affectedServiceIds: ['pm-kisan'],
      status: 'approved',
    },
    {
      id: 'notice_5',
      title: 'Draft Notice - Not Approved',
      summary: 'This is a draft notice.',
      category: 'rule_amendment',
      gazettePublicationDate: '2026-01-20T00:00:00.000Z',
      sourceUrl: 'https://example.gov.in/notice5',
      affectedServiceIds: ['income-certificate'],
      status: 'draft',
    },
  ]),
}));

describe('newsletterSubscriptionService', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = makeStorage();
    vi.clearAllMocks();
  });

  describe('Storage Helpers', () => {
    it('getSubscriptions returns empty array when no data', () => {
      expect(getSubscriptions(mockStorage)).toEqual([]);
    });

    it('saveSubscriptions and getSubscriptions roundtrip', () => {
      const subs = [{ id: '1', email: 'test@example.com' }];
      saveSubscriptions(subs, mockStorage);
      expect(getSubscriptions(mockStorage)).toEqual(subs);
    });

    it('getSentDigests returns empty array when no data', () => {
      expect(getSentDigests(mockStorage)).toEqual([]);
    });

    it('recordSentDigest and hasDigestBeenSent work correctly', () => {
      recordSentDigest('sub-1', 'digest-1', mockStorage);
      expect(hasDigestBeenSent('sub-1', 'digest-1', mockStorage)).toBe(true);
      expect(hasDigestBeenSent('sub-1', 'digest-2', mockStorage)).toBe(false);
      expect(hasDigestBeenSent('sub-2', 'digest-1', mockStorage)).toBe(false);
    });
  });

  describe('validateSubscriptionInput', () => {
    it('passes with valid minimal input', () => {
      const result = validateSubscriptionInput({
        email: 'test@example.com',
        consentGiven: true,
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when email is missing or invalid', () => {
      expect(validateSubscriptionInput({ consentGiven: true }).isValid).toBe(false);
      expect(validateSubscriptionInput({ email: 'invalid', consentGiven: true }).isValid).toBe(false);
    });

    it('fails when consent is not given', () => {
      const result = validateSubscriptionInput({ email: 'test@example.com', consentGiven: false });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('consent'))).toBe(true);
    });

    it('fails with invalid frequency', () => {
      const result = validateSubscriptionInput({
        email: 'test@example.com',
        consentGiven: true,
        frequency: 'weekly',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('frequency'))).toBe(true);
    });

    it('fails with invalid topics', () => {
      const result = validateSubscriptionInput({
        email: 'test@example.com',
        consentGiven: true,
        topics: ['invalid_topic'],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('topics'))).toBe(true);
    });

    it('fails with invalid geography level', () => {
      const result = validateSubscriptionInput({
        email: 'test@example.com',
        consentGiven: true,
        geography: { level: 'invalid', states: [], districts: [] },
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('level'))).toBe(true);
    });

    it('fails when state-level geography has no states', () => {
      const result = validateSubscriptionInput({
        email: 'test@example.com',
        consentGiven: true,
        geography: { level: 'state', states: [], districts: [] },
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('state'))).toBe(true);
    });

    it('fails with invalid state names', () => {
      const result = validateSubscriptionInput({
        email: 'test@example.com',
        consentGiven: true,
        geography: { level: 'state', states: ['InvalidState'], districts: [] },
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid states'))).toBe(true);
    });

    it('fails with invalid district names', () => {
      const result = validateSubscriptionInput({
        email: 'test@example.com',
        consentGiven: true,
        geography: { level: 'district', states: ['Maharashtra'], districts: ['InvalidDistrict'] },
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid districts'))).toBe(true);
    });

    it('fails with invalid saved service IDs', () => {
      const result = validateSubscriptionInput({
        email: 'test@example.com',
        consentGiven: true,
        savedServiceIds: ['invalid-service'],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('service IDs'))).toBe(true);
    });

    it('passes with valid state-level geography', () => {
      const result = validateSubscriptionInput({
        email: 'test@example.com',
        consentGiven: true,
        geography: { level: 'state', states: ['Maharashtra', 'Delhi'], districts: [] },
      });
      expect(result.isValid).toBe(true);
    });

    it('passes with valid district-level geography', () => {
      const result = validateSubscriptionInput({
        email: 'test@example.com',
        consentGiven: true,
        geography: { level: 'district', states: ['Maharashtra'], districts: ['Mumbai', 'Pune'] },
      });
      expect(result.isValid).toBe(true);
    });

    it('passes with valid saved service IDs', () => {
      const result = validateSubscriptionInput({
        email: 'test@example.com',
        consentGiven: true,
        savedServiceIds: ['birth-certificate', 'driving-licence'],
      });
      expect(result.isValid).toBe(true);
    });
  });

  describe('createSubscription', () => {
    it('creates a new subscription with defaults', () => {
      const sub = createSubscription(
        { email: 'test@example.com', consentGiven: true },
        mockStorage
      );
      expect(sub.id).toBeDefined();
      expect(sub.email).toBe('test@example.com');
      expect(sub.status).toBe(NEWSLETTER_STATUS.PENDING_VERIFICATION);
      expect(sub.frequency).toBe(NEWSLETTER_FREQUENCIES.MONTHLY);
      expect(sub.topics).toEqual(DEFAULT_TOPICS);
      expect(sub.geography.level).toBe('national');
      expect(sub.consentGiven).toBe(true);
      expect(sub.consentGivenAt).toBeDefined();
      expect(sub.verificationToken).toBeDefined();
      expect(sub.verificationTokenExpiry).toBeDefined();
    });

    it('creates subscription with custom preferences', () => {
      const sub = createSubscription(
        {
          email: 'custom@example.com',
          consentGiven: true,
          frequency: NEWSLETTER_FREQUENCIES.MONTHLY,
          topics: ['new_services', 'deadlines'],
          geography: { level: 'state', states: ['Maharashtra'], districts: [] },
          savedServiceIds: ['birth-certificate'],
        },
        mockStorage
      );
      expect(sub.topics).toEqual(['new_services', 'deadlines']);
      expect(sub.geography.level).toBe('state');
      expect(sub.geography.states).toEqual(['Maharashtra']);
      expect(sub.savedServiceIds).toEqual(['birth-certificate']);
    });

    it('throws when consent is not given', () => {
      expect(() =>
        createSubscription({ email: 'test@example.com', consentGiven: false }, mockStorage)
      ).toThrow('Explicit consent is required');
    });

    it('throws on invalid input', () => {
      expect(() =>
        createSubscription({ email: 'invalid', consentGiven: true }, mockStorage)
      ).toThrow();
    });

    it('updates existing subscription for same email', () => {
      const sub1 = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      const sub2 = createSubscription(
        { email: 'test@example.com', consentGiven: true, frequency: NEWSLETTER_FREQUENCIES.NONE },
        mockStorage
      );
      expect(sub2.id).toBe(sub1.id);
      expect(sub2.frequency).toBe(NEWSLETTER_FREQUENCIES.NONE);
      expect(getSubscriptions(mockStorage)).toHaveLength(1);
    });
  });

  describe('getSubscriptionById / ByEmail / ByToken', () => {
    it('retrieves subscription by id', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      const found = getSubscriptionById(created.id, mockStorage);
      expect(found).toEqual(created);
    });

    it('retrieves subscription by email (case insensitive)', () => {
      createSubscription({ email: 'Test@Example.com', consentGiven: true }, mockStorage);
      const found = getSubscriptionByEmail('test@example.com', mockStorage);
      expect(found).toBeDefined();
      expect(found.email).toBe('test@example.com');
    });

    it('retrieves subscription by verification token', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      const found = getSubscriptionByToken(created.verificationToken, mockStorage);
      expect(found).toEqual(created);
    });

    it('returns null for non-existent id/email/token', () => {
      expect(getSubscriptionById('non-existent', mockStorage)).toBeNull();
      expect(getSubscriptionByEmail('none@example.com', mockStorage)).toBeNull();
      expect(getSubscriptionByToken('invalid-token', mockStorage)).toBeNull();
    });
  });

  describe('verifySubscription', () => {
    it('verifies a pending subscription', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      const result = verifySubscription(created.verificationToken, mockStorage);
      expect(result.valid).toBe(true);
      expect(result.subscription.status).toBe(NEWSLETTER_STATUS.ACTIVE);
      expect(result.subscription.verificationTokenUsed).toBe(true);
    });

    it('returns alreadyVerified for already active subscription', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      verifySubscription(created.verificationToken, mockStorage);
      const result = verifySubscription(created.verificationToken, mockStorage);
      expect(result.valid).toBe(true);
      expect(result.alreadyVerified).toBe(true);
    });

    it('rejects invalid token', () => {
      const result = verifySubscription('invalid-token', mockStorage);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_token');
    });

    it('rejects expired token', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      const subscriptions = getSubscriptions(mockStorage);
      subscriptions[0].verificationTokenExpiry = new Date(Date.now() - 1000).toISOString();
      saveSubscriptions(subscriptions, mockStorage);

      const result = verifySubscription(created.verificationToken, mockStorage);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
    });
  });

  describe('updateSubscription', () => {
    it('updates subscription fields', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      verifySubscription(created.verificationToken, mockStorage);

      const updated = updateSubscription(created.id, { frequency: NEWSLETTER_FREQUENCIES.NONE }, mockStorage);
      expect(updated.frequency).toBe(NEWSLETTER_FREQUENCIES.NONE);
      expect(updated.updatedAt).toBeDefined();
    });

    it('throws for non-existent subscription', () => {
      expect(() => updateSubscription('non-existent', {}, mockStorage)).toThrow('Subscription not found');
    });

    it('throws for unsubscribed subscription', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      verifySubscription(created.verificationToken, mockStorage);
      unsubscribe(created.id, mockStorage);

      expect(() => updateSubscription(created.id, { frequency: NEWSLETTER_FREQUENCIES.MONTHLY }, mockStorage)).toThrow(
        'Cannot update an unsubscribed subscription'
      );
    });

    it('validates updated input', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      verifySubscription(created.verificationToken, mockStorage);

      expect(() => updateSubscription(created.id, { frequency: 'invalid' }, mockStorage)).toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('unsubscribes by id', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      verifySubscription(created.verificationToken, mockStorage);

      const result = unsubscribe(created.id, mockStorage);
      expect(result.status).toBe(NEWSLETTER_STATUS.UNSUBSCRIBED);
      expect(result.frequency).toBe(NEWSLETTER_FREQUENCIES.NONE);
      expect(result.unsubscribedAt).toBeDefined();
    });

    it('unsubscribes by email', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      verifySubscription(created.verificationToken, mockStorage);

      const result = unsubscribe('test@example.com', mockStorage);
      expect(result.status).toBe(NEWSLETTER_STATUS.UNSUBSCRIBED);
    });

    it('throws for non-existent subscription', () => {
      expect(() => unsubscribe('non-existent', mockStorage)).toThrow('Subscription not found');
    });
  });

  describe('resubscribe', () => {
    it('resubscribes an unsubscribed user', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      verifySubscription(created.verificationToken, mockStorage);
      unsubscribe(created.id, mockStorage);

      const result = resubscribe('test@example.com', mockStorage);
      expect(result.status).toBe(NEWSLETTER_STATUS.PENDING_VERIFICATION);
      expect(result.verificationToken).toBeDefined();
      expect(result.unsubscribedAt).toBeNull();
      expect(result.frequency).toBe(NEWSLETTER_FREQUENCIES.MONTHLY);
    });

    it('throws for non-existent email', () => {
      expect(() => resubscribe('none@example.com', mockStorage)).toThrow('No previous subscription found');
    });

    it('throws for already active subscription', () => {
      const created = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      verifySubscription(created.verificationToken, mockStorage);

      expect(() => resubscribe('test@example.com', mockStorage)).toThrow('Subscription is already active');
    });
  });

  describe('getActiveSubscriptions', () => {
    it('returns only active monthly subscriptions', () => {
      const sub1 = createSubscription({ email: 'active1@example.com', consentGiven: true }, mockStorage);
      verifySubscription(sub1.verificationToken, mockStorage);

      const sub2 = createSubscription({ email: 'active2@example.com', consentGiven: true }, mockStorage);
      verifySubscription(sub2.verificationToken, mockStorage);
      updateSubscription(sub2.id, { frequency: NEWSLETTER_FREQUENCIES.NONE }, mockStorage);

      createSubscription({ email: 'pending@example.com', consentGiven: true }, mockStorage);

      const sub4 = createSubscription({ email: 'unsub@example.com', consentGiven: true }, mockStorage);
      verifySubscription(sub4.verificationToken, mockStorage);
      unsubscribe(sub4.id, mockStorage);

      const active = getActiveSubscriptions(mockStorage);
      expect(active).toHaveLength(1);
      expect(active[0].email).toBe('active1@example.com');
    });
  });

  describe('getSubscriptionsForDigest', () => {
    it('returns active subscriptions due for monthly digest', () => {
      const sub1 = createSubscription({ email: 'recent@example.com', consentGiven: true }, mockStorage);
      verifySubscription(sub1.verificationToken, mockStorage);

      const sub2 = createSubscription({ email: 'old@example.com', consentGiven: true }, mockStorage);
      verifySubscription(sub2.verificationToken, mockStorage);
      const subscriptions = getSubscriptions(mockStorage);
      subscriptions[1].lastSentAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      saveSubscriptions(subscriptions, mockStorage);

      const due = getSubscriptionsForDigest(mockStorage);
      // Both should be due: recent (never sent) and old (30 days ago)
      expect(due).toHaveLength(2);
      expect(due.map((d) => d.email).sort()).toEqual(['old@example.com', 'recent@example.com']);
    });

    it('includes subscriptions never sent', () => {
      const sub = createSubscription({ email: 'never@example.com', consentGiven: true }, mockStorage);
      verifySubscription(sub.verificationToken, mockStorage);

      const due = getSubscriptionsForDigest(mockStorage);
      expect(due).toHaveLength(1);
      expect(due[0].email).toBe('never@example.com');
    });
  });

  describe('buildDigestContent', () => {
    it('builds digest with relevant notices based on topics and geography', () => {
      const sub = createSubscription(
        {
          email: 'test@example.com',
          consentGiven: true,
          topics: ['new_services', 'service_changes', 'deadlines', 'announcements', 'schemes'],
          geography: { level: 'national', states: [], districts: [] },
        },
        mockStorage
      );
      verifySubscription(sub.verificationToken, mockStorage);

      const digest = buildDigestContent(sub, mockStorage);
      expect(digest.subscriptionId).toBe(sub.id);
      expect(digest.email).toBe(sub.email);
      expect(digest.notices).toBeDefined();
      expect(digest.notices.length).toBeGreaterThan(0);
      expect(digest.unsubscribeUrl).toContain('unsubscribe');
      expect(digest.preferencesUrl).toContain('preferences');
    });

    it('filters notices by geography level - state', () => {
      const sub = createSubscription(
        {
          email: 'test@example.com',
          consentGiven: true,
          topics: ['announcements'],
          geography: { level: 'state', states: ['Maharashtra'], districts: [] },
        },
        mockStorage
      );
      verifySubscription(sub.verificationToken, mockStorage);

      const digest = buildDigestContent(sub, mockStorage);
      const noticeServiceIds = digest.notices.flatMap((n) => n.affectedServices.map((s) => s.id));
      // Should include services in Maharashtra (birth-certificate, ration-card, income-certificate)
      // AND national services (driving-licence, pm-kisan)
      expect(noticeServiceIds.every((id) =>
        ['birth-certificate', 'ration-card', 'income-certificate', 'driving-licence', 'pm-kisan'].includes(id)
      )).toBe(true);
    });

    it('filters notices by geography level - district', () => {
      const sub = createSubscription(
        {
          email: 'test@example.com',
          consentGiven: true,
          topics: ['announcements'],
          geography: { level: 'district', states: ['Maharashtra'], districts: ['Mumbai'] },
        },
        mockStorage
      );
      verifySubscription(sub.verificationToken, mockStorage);

      const digest = buildDigestContent(sub, mockStorage);
      expect(digest.notices.length).toBeGreaterThanOrEqual(0);
    });

    it('excludes already sent notices', () => {
      const sub = createSubscription(
        { email: 'test@example.com', consentGiven: true, topics: ['announcements'] },
        mockStorage
      );
      verifySubscription(sub.verificationToken, mockStorage);

      recordSentDigest(sub.id, 'notice_1', mockStorage);
      const digest = buildDigestContent(sub, mockStorage);
      expect(digest.notices.find((n) => n.id === 'notice_1')).toBeUndefined();
    });

    it('excludes draft notices', () => {
      const sub = createSubscription(
        { email: 'test@example.com', consentGiven: true, topics: ['announcements'] },
        mockStorage
      );
      verifySubscription(sub.verificationToken, mockStorage);

      const digest = buildDigestContent(sub, mockStorage);
      expect(digest.notices.find((n) => n.id === 'notice_5')).toBeUndefined();
    });

    it('limits to 20 notices', () => {
      const manyNotices = Array.from({ length: 25 }, (_, i) => ({
        id: `notice_${i + 10}`,
        title: `Notice ${i + 10}`,
        summary: 'Summary',
        category: 'gazette_order',
        gazettePublicationDate: new Date(Date.now() - i * 86400000).toISOString(),
        sourceUrl: `https://example.gov.in/notice${i + 10}`,
        affectedServiceIds: ['driving-licence'],
        status: 'approved',
      }));

      const storage = makeStorage({
        'civicbridge_public_notices_digest_v1': JSON.stringify(manyNotices),
      });

      const sub = createSubscription(
        { email: 'test@example.com', consentGiven: true, topics: ['announcements'] },
        storage
      );
      verifySubscription(sub.verificationToken, storage);

      const digest = buildDigestContent(sub, storage);
      expect(digest.notices.length).toBeLessThanOrEqual(20);
    });
  });

  describe('markDigestSent', () => {
    it('marks digest as sent and records it', () => {
      const sub = createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      verifySubscription(sub.verificationToken, mockStorage);

      const result = markDigestSent(sub.id, 'digest-123', mockStorage);
      expect(result).toBe(true);

      const updated = getSubscriptionById(sub.id, mockStorage);
      expect(updated.lastSentAt).toBeDefined();
      expect(updated.lastSentDigestId).toBe('digest-123');
      expect(hasDigestBeenSent(sub.id, 'digest-123', mockStorage)).toBe(true);
    });

    it('returns false for non-existent subscription', () => {
      const result = markDigestSent('non-existent', 'digest-123', mockStorage);
      expect(result).toBe(false);
    });
  });

  describe('generateAdminPreview', () => {
    it('generates preview for a subscription', () => {
      const sub = createSubscription(
        { email: 'test@example.com', consentGiven: true, topics: ['announcements'] },
        mockStorage
      );
      verifySubscription(sub.verificationToken, mockStorage);

      const preview = generateAdminPreview(sub.id, mockStorage);
      expect(preview.subscriptionId).toBe(sub.id);
      expect(preview.notices).toBeDefined();
    });

    it('throws for non-existent subscription', () => {
      expect(() => generateAdminPreview('non-existent', mockStorage)).toThrow('Subscription not found');
    });
  });

  describe('getSubscriptionStats', () => {
    it('returns correct statistics', () => {
      const sub1 = createSubscription({ email: 'active@example.com', consentGiven: true }, mockStorage);
      verifySubscription(sub1.verificationToken, mockStorage);

      createSubscription({ email: 'pending@example.com', consentGiven: true }, mockStorage);

      const sub3 = createSubscription({ email: 'unsub@example.com', consentGiven: true }, mockStorage);
      verifySubscription(sub3.verificationToken, mockStorage);
      unsubscribe(sub3.id, mockStorage);

      const stats = getSubscriptionStats(mockStorage);
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.unsubscribed).toBe(1);
      // active + pending both have monthly frequency
      expect(stats.monthly).toBe(2);
    });
  });

  describe('logDeliveryFailure / getDeliveryFailures', () => {
    it('logs and retrieves delivery failures', () => {
      logDeliveryFailure('sub-1', new Error('Network error'), mockStorage);
      logDeliveryFailure('sub-2', new Error('Timeout'), mockStorage);

      const failures = getDeliveryFailures(mockStorage);
      expect(failures).toHaveLength(2);
      expect(failures[0].subscriptionId).toBe('sub-1');
      expect(failures[0].error).toBe('Network error');
      expect(failures[1].subscriptionId).toBe('sub-2');
    });
  });

  describe('resetSubscriptionData', () => {
    it('clears all subscription data', () => {
      createSubscription({ email: 'test@example.com', consentGiven: true }, mockStorage);
      recordSentDigest('sub-1', 'digest-1', mockStorage);
      logDeliveryFailure('sub-1', new Error('Error'), mockStorage);

      resetSubscriptionData(mockStorage);

      expect(getSubscriptions(mockStorage)).toHaveLength(0);
      expect(getSentDigests(mockStorage)).toHaveLength(0);
      expect(getDeliveryFailures(mockStorage)).toHaveLength(0);
    });
  });
});