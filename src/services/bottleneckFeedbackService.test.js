import { describe, it, expect, beforeEach } from 'vitest';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  PLATFORM_FEEDBACK_DISCLAIMER,
  scrubPII,
  validateFeedbackInput,
  submitBottleneckFeedback,
  getAllFeedback,
  saveFeedback,
  getAggregateFrictionMetrics,
  reviewBottleneckFeedback,
  queryFeedbackForModeration,
  resetFeedbackDefaults,
} from './bottleneckFeedbackService';
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

describe('bottleneckFeedbackService', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = makeStorage();
  });

  describe('PII Scrubber and Sensitive Data Shielding', () => {
    it('redacts 12-digit Aadhaar numbers', () => {
      const input = 'My Aadhaar is 1234 5678 9012 and I could not verify OTP.';
      const res = scrubPII(input);
      expect(res.piiDetected).toBe(true);
      expect(res.text).toContain('[AADHAAR_REDACTED]');
      expect(res.text).not.toContain('1234 5678 9012');
    });

    it('redacts 10-digit Indian phone numbers', () => {
      const input = 'Please call me at 9876543210 for clarification.';
      const res = scrubPII(input);
      expect(res.piiDetected).toBe(true);
      expect(res.text).toContain('[PHONE_REDACTED]');
      expect(res.text).not.toContain('9876543210');
    });

    it('redacts email addresses', () => {
      const input = 'Contact me on citizen.user@example.org about this issue.';
      const res = scrubPII(input);
      expect(res.piiDetected).toBe(true);
      expect(res.text).toContain('[EMAIL_REDACTED]');
      expect(res.text).not.toContain('citizen.user@example.org');
    });

    it('redacts 10-character PAN numbers', () => {
      const input = 'My PAN number ABCDE1234F was rejected by the upload form.';
      const res = scrubPII(input);
      expect(res.piiDetected).toBe(true);
      expect(res.text).toContain('[PAN_REDACTED]');
      expect(res.text).not.toContain('ABCDE1234F');
    });

    it('redacts case / grievance reference tokens', () => {
      const input = 'My previous application was CASE-984321 and it expired.';
      const res = scrubPII(input);
      expect(res.piiDetected).toBe(true);
      expect(res.text).toContain('[CASE_ID_REDACTED]');
      expect(res.text).not.toContain('CASE-984321');
    });

    it('leaves standard feedback text without PII untouched', () => {
      const input = 'The doctor signature requirement on Form 1A is unclear.';
      const res = scrubPII(input);
      expect(res.piiDetected).toBe(false);
      expect(res.text).toBe(input);
    });
  });

  describe('Validation & Category Constraints', () => {
    it('accepts valid categories: unclear_instructions, missing_information, broken_link, accessibility, other', () => {
      for (const cat of FEEDBACK_CATEGORIES) {
        const val = validateFeedbackInput({
          serviceId: 'driving-licence',
          category: cat.id,
          rating: 3,
        });
        expect(val.isValid).toBe(true);
      }
    });

    it('rejects unrecognized categories', () => {
      const val = validateFeedbackInput({
        serviceId: 'driving-licence',
        category: 'unrecognized_random_category',
        rating: 3,
      });
      expect(val.isValid).toBe(false);
      expect(val.errors.some((e) => e.includes('Category must be one of'))).toBe(true);
    });

    it('rejects invalid or out-of-range friction ratings', () => {
      const zeroRating = validateFeedbackInput({
        serviceId: 'driving-licence',
        category: 'broken_link',
        rating: 0,
      });
      expect(zeroRating.isValid).toBe(false);

      const sixRating = validateFeedbackInput({
        serviceId: 'driving-licence',
        category: 'broken_link',
        rating: 6,
      });
      expect(sixRating.isValid).toBe(false);
    });

    it('rejects submissions with missing serviceId', () => {
      const missingService = validateFeedbackInput({
        category: 'broken_link',
        rating: 3,
      });
      expect(missingService.isValid).toBe(false);
      expect(missingService.errors.some((e) => e.includes('Service ID is mandatory'))).toBe(true);
    });
  });

  describe('Submission, Optionality, and Government Complaint Disclaimers', () => {
    it('submits feedback without requiring notes (notes are purely optional)', () => {
      const item = submitBottleneckFeedback(
        {
          serviceId: 'ration-card',
          category: 'missing_information',
          rating: 4,
          notes: '',
        },
        mockStorage
      );

      expect(item.id).toBeDefined();
      expect(item.serviceId).toBe('ration-card');
      expect(item.notes).toBe('');
      expect(item.status).toBe(FEEDBACK_STATUSES.PENDING);
      expect(item.feedbackType).toBe('platform_improvement');
    });

    it('explicitly stores disclaimer acknowledging platform feedback rather than government grievance', () => {
      expect(PLATFORM_FEEDBACK_DISCLAIMER).toContain('NOT an official government grievance');
      expect(PLATFORM_FEEDBACK_DISCLAIMER).toContain('do NOT include case numbers');
    });

    it('automatically sanitizes notes upon submission', () => {
      const item = submitBottleneckFeedback(
        {
          serviceId: 'driving-licence',
          category: 'unclear_instructions',
          rating: 2,
          notes: 'Call 9876543210 if any questions.',
        },
        mockStorage
      );

      expect(item.piiDetected).toBe(true);
      expect(item.notes).toContain('[PHONE_REDACTED]');
    });
  });

  describe('Aggregate Friction Metrics & Free-Text Concealment', () => {
    it('aggregates friction without exposing free-text descriptions', () => {
      saveFeedback([], mockStorage);

      submitBottleneckFeedback(
        {
          serviceId: 'driving-licence',
          stepIndex: 1,
          stepTitle: 'Upload Documents',
          category: 'missing_information',
          rating: 4,
          notes: 'Sensitive confidential note that should not leak in aggregates',
        },
        mockStorage
      );

      submitBottleneckFeedback(
        {
          serviceId: 'driving-licence',
          stepIndex: 1,
          stepTitle: 'Upload Documents',
          category: 'missing_information',
          rating: 2,
          notes: 'Another private note',
        },
        mockStorage
      );

      submitBottleneckFeedback(
        {
          serviceId: 'driving-licence',
          stepIndex: 3,
          stepTitle: 'Book Appointment',
          category: 'broken_link',
          rating: 5,
          notes: 'Third private comment',
        },
        mockStorage
      );

      const metrics = getAggregateFrictionMetrics(mockStorage, 'driving-licence');

      expect(metrics.totalReports).toBe(3);
      expect(metrics.averageFrictionScore).toBe(3.7);
      expect(metrics.categoryCounts.missing_information).toBe(2);
      expect(metrics.categoryCounts.broken_link).toBe(1);
      expect(metrics.stepBreakdown.length).toBe(2);
      expect(metrics.stepBreakdown[0].step).toBe('Upload Documents');
      expect(metrics.stepBreakdown[0].count).toBe(2);
      expect(metrics.stepBreakdown[0].averageFriction).toBe(3.0);

      // Verify that free-text notes are NEVER present in aggregate metrics
      const serialized = JSON.stringify(metrics);
      expect(serialized).not.toContain('Sensitive confidential note');
      expect(serialized).not.toContain('Another private note');
      expect(serialized).not.toContain('Third private comment');
    });

    it('returns empty safe defaults when no feedback exists', () => {
      saveFeedback([], mockStorage);
      const metrics = getAggregateFrictionMetrics(mockStorage, 'non-existent');
      expect(metrics.totalReports).toBe(0);
      expect(metrics.averageFrictionScore).toBe(0);
      expect(metrics.stepBreakdown).toEqual([]);
    });
  });

  describe('Moderation & Admin Review Workflow', () => {
    it('allows an admin to mark feedback as reviewed with resolution notes', () => {
      const item = submitBottleneckFeedback(
        {
          serviceId: 'passport-renewal',
          category: 'accessibility',
          rating: 3,
          notes: 'Font size too small on step 2.',
        },
        mockStorage
      );

      expect(item.status).toBe(FEEDBACK_STATUSES.PENDING);

      const reviewed = reviewBottleneckFeedback(
        item.id,
        FEEDBACK_STATUSES.REVIEWED,
        'Senior Admin',
        'Acknowledged; queued design adjustment.',
        mockStorage
      );

      expect(reviewed.status).toBe(FEEDBACK_STATUSES.REVIEWED);
      expect(reviewed.reviewedBy).toBe('Senior Admin');
      expect(reviewed.adminNotes).toBe('Acknowledged; queued design adjustment.');
      expect(reviewed.reviewedAt).toBeDefined();
    });

    it('allows an admin to transition status to addressed or dismissed', () => {
      const item = submitBottleneckFeedback(
        {
          serviceId: 'passport-renewal',
          category: 'broken_link',
          rating: 5,
        },
        mockStorage
      );

      const addressed = reviewBottleneckFeedback(
        item.id,
        FEEDBACK_STATUSES.ADDRESSED,
        'Tech Lead',
        'Fixed redirect link to official passport seva portal.',
        mockStorage
      );

      expect(addressed.status).toBe(FEEDBACK_STATUSES.ADDRESSED);
    });

    it('throws error when reviewing non-existent feedback ID', () => {
      expect(() => {
        reviewBottleneckFeedback('invalid_id_999', FEEDBACK_STATUSES.REVIEWED, 'Admin', '', mockStorage);
      }).toThrow(/not found/);
    });

    it('filters moderation queue by status, category, and search keyword', () => {
      saveFeedback([], mockStorage);

      submitBottleneckFeedback(
        {
          serviceId: 'driving-licence',
          category: 'broken_link',
          rating: 5,
          notes: 'slot booking endpoint broken',
        },
        mockStorage
      );

      submitBottleneckFeedback(
        {
          serviceId: 'income-certificate',
          category: 'unclear_instructions',
          rating: 2,
          notes: 'affidavit notary rules unclear',
        },
        mockStorage
      );

      const brokenOnly = queryFeedbackForModeration(mockStorage, { category: 'broken_link' });
      expect(brokenOnly.length).toBe(1);
      expect(brokenOnly[0].serviceId).toBe('driving-licence');

      const searched = queryFeedbackForModeration(mockStorage, { searchQuery: 'affidavit' });
      expect(searched.length).toBe(1);
      expect(searched[0].serviceId).toBe('income-certificate');
    });

    it('resets feedback defaults to demo seed records', () => {
      saveFeedback([], mockStorage);
      expect(getAllFeedback(mockStorage).length).toBe(0);

      resetFeedbackDefaults(mockStorage);
      expect(getAllFeedback(mockStorage).length).toBeGreaterThan(0);
    });
  });
});
