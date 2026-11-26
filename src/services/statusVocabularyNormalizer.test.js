import { describe, it, expect } from 'vitest';
import {
  CANONICAL_STATUS,
  CANONICAL_STATUS_META,
  normalizeStatusPhrase,
  getCanonicalStatusMeta,
  getSourceWeight,
} from './statusVocabularyNormalizer.js';

describe('statusVocabularyNormalizer', () => {
  describe('Canonical status taxonomy & metadata', () => {
    it('defines all 7 canonical statuses with correct metadata', () => {
      const keys = Object.keys(CANONICAL_STATUS);
      expect(keys).toHaveLength(7);

      keys.forEach((key) => {
        const val = CANONICAL_STATUS[key];
        const meta = getCanonicalStatusMeta(val);
        expect(meta).toBeDefined();
        expect(meta.label).toBeTypeOf('string');
        expect(meta.color).toBeTypeOf('string');
        expect(meta.isTerminal).toBeTypeOf('boolean');
      });
    });

    it('returns default fallback meta for unknown status code', () => {
      const meta = getCanonicalStatusMeta('NON_EXISTENT_STATUS');
      expect(meta.label).toBe(CANONICAL_STATUS_META[CANONICAL_STATUS.UNDER_REVIEW].label);
    });
  });

  describe('Source weights', () => {
    it('provides weights for official and manual channels', () => {
      expect(getSourceWeight('PORTAL_EXPORT')).toBe(0.95);
      expect(getSourceWeight('PAPER_RECEIPT')).toBe(0.90);
      expect(getSourceWeight('SMS')).toBe(0.85);
      expect(getSourceWeight('EMAIL')).toBe(0.80);
      expect(getSourceWeight('USER_NOTE')).toBe(0.50);
      expect(getSourceWeight('UNKNOWN_CHANNEL')).toBe(0.60);
    });
  });

  describe('normalizeStatusPhrase', () => {
    it('normalizes action required / deficiency terms', () => {
      const phrases = [
        'Query Raised by Tahsildar',
        'Deficiency found in uploaded certificate',
        'Objection raised during field inspection',
        'Document re-upload needed',
        'Applicant response pending',
        'Defect notice issued',
      ];

      phrases.forEach((phrase) => {
        const res = normalizeStatusPhrase(phrase);
        expect(res.canonicalStatus).toBe(CANONICAL_STATUS.ACTION_REQUIRED);
        expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('normalizes rejected and dismissed terms including vernacular', () => {
      const phrases = [
        'Application Rejected',
        'Disposed off with rejection',
        'Dismissed due to eligibility failure',
        'Declined by sub-divisional magistrate',
        'Asvikrit',
        'Cancelled by admin',
      ];

      phrases.forEach((phrase) => {
        const res = normalizeStatusPhrase(phrase);
        expect(res.canonicalStatus).toBe(CANONICAL_STATUS.REJECTED);
      });
    });

    it('normalizes dispatched and in-transit notices', () => {
      const phrases = [
        'Card dispatched via Speed Post',
        'Consignment booked with tracking AW1234',
        'Printed and out for delivery',
        'In transit to delivery post office',
      ];

      phrases.forEach((phrase) => {
        const res = normalizeStatusPhrase(phrase);
        expect(res.canonicalStatus).toBe(CANONICAL_STATUS.DISPATCHED);
      });
    });

    it('normalizes completed and issued statuses', () => {
      const phrases = [
        'Delivered to applicant',
        'Certificate generated and downloaded',
        'Disposed with issuance',
        'Closed successfully',
        'Collected by applicant',
      ];

      phrases.forEach((phrase) => {
        const res = normalizeStatusPhrase(phrase);
        expect(res.canonicalStatus).toBe(CANONICAL_STATUS.COMPLETED);
      });
    });

    it('normalizes approved and sanctioned terms', () => {
      const phrases = [
        'Sanctioned by Municipal Commissioner',
        'Approval granted',
        'Svikrit',
        'Final order passed',
      ];

      phrases.forEach((phrase) => {
        const res = normalizeStatusPhrase(phrase);
        expect(res.canonicalStatus).toBe(CANONICAL_STATUS.APPROVED);
      });
    });

    it('normalizes submitted and acknowledged entries', () => {
      const phrases = [
        'Acknowledgement generated at counter',
        'Received at counter by clerk',
        'Application received online',
        'Challan generated',
      ];

      phrases.forEach((phrase) => {
        const res = normalizeStatusPhrase(phrase);
        expect(res.canonicalStatus).toBe(CANONICAL_STATUS.SUBMITTED);
      });
    });

    it('normalizes under scrutiny / review phrasing', () => {
      const phrases = [
        'Under scrutiny with Revenue Inspector',
        'Processing at Head Office',
        'Field verification pending',
        'Pending with officer',
        'Stage 2 in progress',
      ];

      phrases.forEach((phrase) => {
        const res = normalizeStatusPhrase(phrase);
        expect(res.canonicalStatus).toBe(CANONICAL_STATUS.UNDER_REVIEW);
      });
    });

    it('handles edge cases safely (empty, non-string, completely unknown)', () => {
      expect(normalizeStatusPhrase('').canonicalStatus).toBe(CANONICAL_STATUS.UNDER_REVIEW);
      expect(normalizeStatusPhrase(null).canonicalStatus).toBe(CANONICAL_STATUS.UNDER_REVIEW);
      expect(normalizeStatusPhrase(12345).canonicalStatus).toBe(CANONICAL_STATUS.UNDER_REVIEW);

      const unknown = normalizeStatusPhrase('Random gibberish xyz');
      expect(unknown.canonicalStatus).toBe(CANONICAL_STATUS.UNDER_REVIEW);
      expect(unknown.confidence).toBeLessThan(0.5);
    });
  });
});
