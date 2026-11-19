import { describe, it, expect } from 'vitest';
import {
  validateSubscriptionRequest,
  matchNoticesForSubscription,
  formatNoticeDigest,
  createSubscriptionAuditEntry,
  SUBSCRIPTION_AUDIT_ACTIONS,
  NOTICE_TOPICS,
  DIGEST_FREQUENCIES
} from './civicNoticeSubscriptionService';

describe('civicNoticeSubscriptionService', () => {
  it('should define topics and frequencies', () => {
    expect(NOTICE_TOPICS.WATER_SUPPLY.id).toBe('water_supply');
    expect(NOTICE_TOPICS.ROAD_WORKS.id).toBe('road_works');
    expect(DIGEST_FREQUENCIES.DAILY.id).toBe('daily');
  });

  it('should validate complete subscription and sanitize privacy attributes', () => {
    const rawSub = {
      municipality: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
      ward: '150',
      topics: ['water_supply', 'road_works'],
      email: 'citizen@example.com',
      frequency: 'daily',
      latitude: 12.9716, // should be flagged and stripped
      longitude: 77.5946
    };

    const res = validateSubscriptionRequest(rawSub);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.warnings.some(w => w.includes('Privacy protection'))).toBe(true);
    expect(res.sanitizedSubscription.latitude).toBeUndefined();
    expect(res.sanitizedSubscription.ward).toBe('150');
  });

  it('should catch errors when required fields are missing', () => {
    const emptySub = {
      municipality: '',
      ward: '',
      topics: []
    };

    const res = validateSubscriptionRequest(emptySub);
    expect(res.isValid).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should correctly filter and separate active notices, corrigenda, and superseded notices', () => {
    const corpus = [
      {
        noticeNumber: 'BBMP/WTR/2024/01',
        title: 'Emergency Pipeline Repair at Bellandur',
        municipality: 'BBMP',
        ward: '150',
        topic: 'water_supply',
        publishedDate: '2024-03-01',
        isSuperseded: false,
        noticeType: 'NOTICE'
      },
      {
        noticeNumber: 'BBMP/WTR/2024/01-CORR',
        title: 'Corrigendum: Water Outage Timings Extended',
        municipality: 'BBMP',
        ward: '150',
        topic: 'water_supply',
        supersedesNoticeNumber: 'BBMP/WTR/2024/01',
        publishedDate: '2024-03-02',
        isSuperseded: false,
        noticeType: 'CORRIGENDUM'
      },
      {
        noticeNumber: 'BBMP/RD/2023/99',
        title: 'Old Road Digging Notice',
        municipality: 'BBMP',
        ward: '150',
        topic: 'road_works',
        isSuperseded: true,
        noticeType: 'NOTICE'
      },
      {
        noticeNumber: 'BBMP/RD/2024/40',
        title: 'Unrelated Notice for Ward 80',
        municipality: 'BBMP',
        ward: '80',
        topic: 'road_works'
      }
    ];

    const matchRes = matchNoticesForSubscription(corpus, {
      municipality: 'BBMP',
      ward: '150',
      topics: ['water_supply', 'road_works']
    });

    expect(matchRes.totalMatches).toBe(2); // 1 active + 1 corrigendum
    expect(matchRes.activeNotices).toHaveLength(1);
    expect(matchRes.corrigenda).toHaveLength(1);
    expect(matchRes.supersededNotices).toHaveLength(1);
  });

  it('should create audit entries for subscription lifecycle events', () => {
    const entry = createSubscriptionAuditEntry('SUBSCRIBE', {
      ward: '42',
      municipality: 'Delhi',
      topics: ['water_supply'],
      email: 'user@test.com'
    });

    expect(entry.action).toBe(SUBSCRIPTION_AUDIT_ACTIONS.SUBSCRIBE);
    expect(entry.ward).toBe('42');
    expect(entry.channelType).toBe('EMAIL');
    expect(entry.unsubscribeTokenHash).toBeDefined();
  });

  it('should format a readable markdown notice digest', () => {
    const sub = {
      municipality: 'Pune Municipal Corporation',
      ward: '12',
      frequency: 'Daily'
    };
    const corpus = [
      {
        noticeNumber: 'PMC/2024/77',
        title: 'Ward Committee Public Hearing on SWM',
        municipality: 'Pune Municipal Corporation',
        ward: '12',
        topic: 'public_hearings',
        publishedDate: '2024-03-10',
        summary: 'Discussion on segregation norms in model society clusters.'
      }
    ];

    const digest = formatNoticeDigest(sub, corpus);
    expect(digest).toContain('# Civic Public Notice Digest: Ward 12');
    expect(digest).toContain('Ward Committee Public Hearing on SWM');
    expect(digest).toContain('To update topics or unsubscribe in 1 click');
  });
});
