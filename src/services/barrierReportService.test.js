import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BARRIER_CATEGORIES,
  BARRIER_CATEGORY_LABELS,
  BARRIER_STATUS,
  BARRIER_SEVERITY,
  NON_ESCALATION_DISCLAIMER,
  redactSensitiveData,
  submitBarrierReport,
  getBarrierReportStatus,
  moderateBarrierReport,
  getAggregatedBarrierInsights,
  getAllBarrierReports,
  BARRIER_REPORTS_STORAGE_KEY,
} from './barrierReportService';
import { setCurrentActor } from './accessControl';

// The role that counts is the signed-in user's, not a role passed in by the caller.
const signInAs = (role) => setCurrentActor(role ? { role, username: 'Test User' } : null);
signInAs('admin');


const makeStorage = (initial = []) => {
  const store = new Map();
  if (initial && initial.length > 0) {
    store.set(BARRIER_REPORTS_STORAGE_KEY, JSON.stringify(initial));
  }
  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, val) => store.set(key, String(val))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  };
};

describe('Citizen-Reported Service Barrier Insights Service (#148)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = makeStorage();
  });

  describe('Automated Sensitive Data Redaction', () => {
    it('redacts 12-digit Indian Aadhaar numbers', () => {
      const rawText = 'My Aadhaar is 1234 5678 9012 and it was rejected at counter.';
      const redacted = redactSensitiveData(rawText);
      expect(redacted).not.toContain('1234 5678 9012');
      expect(redacted).toContain('[REDACTED_AADHAAR]');
    });

    it('redacts 10-character PAN card numbers', () => {
      const rawText = 'Official asked for PAN ABCDE1234F and refused to process without it.';
      const redacted = redactSensitiveData(rawText);
      expect(redacted).not.toContain('ABCDE1234F');
      expect(redacted).toContain('[REDACTED_PAN]');
    });

    it('redacts Indian phone numbers', () => {
      const rawText = 'Contact officer called from +91 9876543210 demanding extra money.';
      const redacted = redactSensitiveData(rawText);
      expect(redacted).not.toContain('9876543210');
      expect(redacted).toContain('[REDACTED_PHONE]');
    });

    it('redacts email addresses', () => {
      const rawText = 'Send documents to citizen.private@gmail.com for verification.';
      const redacted = redactSensitiveData(rawText);
      expect(redacted).not.toContain('citizen.private@gmail.com');
      expect(redacted).toContain('[REDACTED_EMAIL]');
    });

    it('handles empty or non-string inputs safely', () => {
      expect(redactSensitiveData('')).toBe('');
      expect(redactSensitiveData(null)).toBe('');
      expect(redactSensitiveData(undefined)).toBe('');
    });
  });

  describe('Report Submission & Initial Moderation Queueing', () => {
    it('submits a structured barrier report with PII redaction and queues for moderation', () => {
      const result = submitBarrierReport(
        {
          serviceId: 'birth-certificate',
          serviceName: 'Birth Certificate',
          department: 'Revenue & Municipal',
          barrierCategory: BARRIER_CATEGORIES.INACCESSIBLE_FACILITY,
          description: 'Ramp was blocked and officer at 9876543210 was unresponsive.',
          severity: BARRIER_SEVERITY.HIGH,
          officeLocation: 'Saket SDM Counter 2',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.trackingCode).toMatch(/^BAR-\d{6}$/);
      expect(result.status).toBe(BARRIER_STATUS.PENDING_MODERATION);
      expect(result.disclaimer).toBe(NON_ESCALATION_DISCLAIMER);

      // Verify stored report in storage
      const stored = getAllBarrierReports(mockStorage);
      expect(stored).toHaveLength(1);
      expect(stored[0].status).toBe(BARRIER_STATUS.PENDING_MODERATION);
      expect(stored[0].description).toContain('[REDACTED_PHONE]');
      expect(stored[0].description).not.toContain('9876543210');
    });

    it('rejects submission with missing serviceId or invalid barrier category', () => {
      expect(() =>
        submitBarrierReport({ serviceId: '', barrierCategory: BARRIER_CATEGORIES.BROKEN_DIGITAL_PORTAL }, mockStorage)
      ).toThrow('A valid service ID is required');

      expect(() =>
        submitBarrierReport({ serviceId: 'pan-card', barrierCategory: 'invalid_category' }, mockStorage)
      ).toThrow('Please select a valid structured barrier category');
    });
  });

  describe('Tracking and Non-Escalation Status Checking', () => {
    it('reports status without implying official government escalation', () => {
      const report = submitBarrierReport(
        {
          serviceId: 'driving-license',
          barrierCategory: BARRIER_CATEGORIES.BROKEN_DIGITAL_PORTAL,
          description: 'Payment gateway crashed.',
        },
        mockStorage
      );

      const status = getBarrierReportStatus(report.trackingCode, mockStorage);
      expect(status).toBeDefined();
      expect(status.status).toBe('Received');
      expect(status.explanation).toContain('waiting for community review');
      expect(status.disclaimer).toContain('does NOT constitute an official government complaint');
    });

    it('returns null for nonexistent tracking code', () => {
      expect(getBarrierReportStatus('BAR-999999', mockStorage)).toBeNull();
    });
  });

  describe('Permission-Checked Moderation Actions', () => {
    it('permits admins and moderators to approve or reject reports', () => {
      const submission = submitBarrierReport(
        {
          serviceId: 'passport-renewal',
          barrierCategory: BARRIER_CATEGORIES.LANGUAGE_UNAVAILABLE,
          description: 'Forms only in English.',
        },
        mockStorage
      );

      const approved = moderateBarrierReport(
        {
          reportId: submission.report.id,
          action: 'approve',
          reviewerNotes: 'Verified with district office forms.',
          userRole: 'admin',
          reviewerName: 'AdminUser',
        },
        mockStorage
      );

      expect(approved.success).toBe(true);
      expect(approved.newStatus).toBe(BARRIER_STATUS.APPROVED);

      // Now verify status check reflects approved state
      const status = getBarrierReportStatus(submission.trackingCode, mockStorage);
      expect(status.status).toBe('Reviewed & Anonymously Aggregated');
    });

    it('strictly blocks unauthorized users (citizens) from moderating reports', () => {
      const submission = submitBarrierReport(
        {
          serviceId: 'passport-renewal',
          barrierCategory: BARRIER_CATEGORIES.EXTREME_WAIT_TIME,
        },
        mockStorage
      );

      signInAs('citizen');
      try {
        expect(() =>
          moderateBarrierReport(
            {
              reportId: submission.report.id,
              action: 'approve',
              userRole: 'admin', // claiming to be an admin changes nothing
            },
            mockStorage
          )
        ).toThrow(/Unauthorized/);
      } finally {
        signInAs('admin');
      }
    });

    it('throws when report ID does not exist', () => {
      expect(() =>
        moderateBarrierReport(
          {
            reportId: 'nonexistent-id',
            action: 'approve',
            userRole: 'admin',
          },
          mockStorage
        )
      ).toThrow(/not found/);
    });
  });

  describe('Privacy-Preserving Metric Aggregation', () => {
    it('aggregates ONLY approved reports and suppresses all free-text fields', () => {
      // 1. Submit multiple reports
      const r1 = submitBarrierReport(
        {
          serviceId: 'aadhaar-card',
          department: 'UIDAI',
          barrierCategory: BARRIER_CATEGORIES.INACCESSIBLE_FACILITY,
          description: 'Secret sensitive detail about counter official',
          severity: BARRIER_SEVERITY.HIGH,
        },
        mockStorage
      );

      const r2 = submitBarrierReport(
        {
          serviceId: 'aadhaar-card',
          department: 'UIDAI',
          barrierCategory: BARRIER_CATEGORIES.INACCESSIBLE_FACILITY,
          description: 'Another personal note about Saket branch',
          severity: BARRIER_SEVERITY.MEDIUM,
        },
        mockStorage
      );

      const r3 = submitBarrierReport(
        {
          serviceId: 'driving-license',
          department: 'Transport',
          barrierCategory: BARRIER_CATEGORIES.BROKEN_DIGITAL_PORTAL,
          description: 'Payment token error on server',
          severity: BARRIER_SEVERITY.CRITICAL,
        },
        mockStorage
      );

      // Approve r1 and r3, reject r2
      moderateBarrierReport({ reportId: r1.report.id, action: 'approve', userRole: 'admin' }, mockStorage);
      moderateBarrierReport({ reportId: r2.report.id, action: 'reject', userRole: 'admin' }, mockStorage);
      // r3 remains pending

      const insights = getAggregatedBarrierInsights(mockStorage);
      expect(insights.totalReportsCount).toBe(3);
      expect(insights.approvedCount).toBe(1); // Only r1 approved
      expect(insights.pendingCount).toBe(1); // r3 pending
      expect(insights.rejectedCount).toBe(1); // r2 rejected

      // Check category breakdown: r1 is INACCESSIBLE_FACILITY
      const facilityStat = insights.categoryBreakdown.find(
        (c) => c.categoryKey === BARRIER_CATEGORIES.INACCESSIBLE_FACILITY
      );
      expect(facilityStat.count).toBe(1);
      expect(facilityStat.percentage).toBe(100);

      // Verify that NO identifying free text description or user location is in the insights object
      const insightsJson = JSON.stringify(insights);
      expect(insightsJson).not.toContain('Secret sensitive detail');
      expect(insightsJson).not.toContain('personal note');
      expect(insightsJson).not.toContain('Payment token error');
      expect(insights.dataPrivacyNotice).toContain('suppressed');
    });
  });
});
