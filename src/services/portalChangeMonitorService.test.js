/**
 * src/services/portalChangeMonitorService.test.js
 *
 * Unit tests for Government Portal Change Detection & Broken-Link Monitor (#1428).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeContentFingerprint,
  recordPortalCheck,
  reviewPortalChange,
  listPortalReviewQueue,
} from './portalChangeMonitorService.js';

const createMockStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
};

describe('portalChangeMonitorService (#1428)', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('ignores trivial timestamp & whitespace churn in content fingerprints', () => {
    const fp1 = computeContentFingerprint('Income Certificate Fee: Rs 50   Updated 2026-11-26T10:00:00Z');
    const fp2 = computeContentFingerprint('Income Certificate Fee: Rs 50 Updated 2026-11-27T14:22:11Z');
    expect(fp1).toBe(fp2);

    const fpChanged = computeContentFingerprint('Income Certificate Fee: Rs 100 Updated 2026-11-27T14:22:11Z');
    expect(fpChanged).not.toBe(fp1);
  });

  it('detects broken links (404), redirects, and meaningful content changes into the human review queue', () => {
    const broken = recordPortalCheck({
      sourceId: 'portal-edistrict-delhi',
      url: 'https://edistrict.delhigovt.nic.in',
      httpStatus: 404,
      customStorage: storage,
    });
    expect(broken.isBroken).toBe(true);
    expect(broken.record.healthStatus).toBe('BROKEN_LINK');
    expect(broken.reviewItem.status).toBe('PENDING_REVIEW');

    const redir = recordPortalCheck({
      sourceId: 'portal-cpgrams',
      url: 'https://pgportal.gov.in',
      httpStatus: 301,
      redirectedTo: 'https://pgportal.gov.in/v2',
      customStorage: storage,
    });
    expect(redir.isRedirected).toBe(true);
    expect(redir.record.healthStatus).toBe('REDIRECTED');

    expect(listPortalReviewQueue(storage)).toHaveLength(2);
  });

  it('enforces reviewer/admin role on human review approval and rejects PII', () => {
    const { reviewItem } = recordPortalCheck({
      sourceId: 'portal-edistrict-delhi',
      url: 'https://edistrict.delhigovt.nic.in',
      httpStatus: 500,
      customStorage: storage,
    });

    expect(() =>
      reviewPortalChange({
        changeId: reviewItem.changeId,
        reviewerRole: 'citizen',
        decision: 'APPROVE',
        customStorage: storage,
      })
    ).toThrow(/forbidden/i);

    const approved = reviewPortalChange({
      changeId: reviewItem.changeId,
      reviewerId: 'rev-1',
      reviewerRole: 'reviewer',
      decision: 'APPROVE',
      rationale: 'Confirmed portal outage',
      customStorage: storage,
    });
    expect(approved.status).toBe('APPROVED');

    expect(() =>
      recordPortalCheck({
        sourceId: 's1',
        url: 'https://gov.in',
        contentSample: 'Aadhaar 1234 5678 9012',
        customStorage: storage,
      })
    ).toThrow(/Aadhaar or PAN/i);
  });
});
