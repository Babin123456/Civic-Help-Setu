import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  PROCUREMENT_CATEGORIES,
  PROCUREMENT_METHODS,
  RED_FLAG_INDICATORS,
  REVIEW_STATUSES,
  USER_ROLES,
  validateProcurementNotice,
  validateAuditReviewPayload,
  validateVendorEntity,
  generateAuditSeal,
  checkForForbiddenPII,
  sanitizeText,
  isValidHttpsUrl,
} from './openContractingContract.js';

describe('openContractingContract (#751)', () => {
  it('defines valid core enums and current schema version', () => {
    expect(SCHEMA_VERSION).toBe('1.0.0');
    expect(Object.keys(PROCUREMENT_CATEGORIES)).toContain('works');
    expect(Object.keys(PROCUREMENT_METHODS)).toContain('open_competitive');
    expect(Object.keys(RED_FLAG_INDICATORS)).toContain('single_bid_award');
    expect(Object.keys(RED_FLAG_INDICATORS)).toContain('unusual_amendments');
    expect(Object.keys(REVIEW_STATUSES)).toContain('marked_false_positive');
    expect(Object.keys(USER_ROLES)).toContain('auditor');
  });

  describe('validateProcurementNotice', () => {
    const validNotice = {
      id: 'ocds-notice-2026-001',
      tenderRefNumber: 'BBMP/EE/SWD/2026/0491',
      title: 'Stormwater Culvert Remodeling and Desilting - Bellandur Sub-division',
      category: 'works',
      procurementMethod: 'open_competitive',
      estimatedValue: 4500000,
      publicationDate: '2026-03-01T09:00:00Z',
      submissionDeadline: '2026-03-25T17:00:00Z',
      sourceUrl: 'https://kppp.karnataka.gov.in/portal/tender/BBMP-2026-0491',
    };

    it('validates a compliant procurement notice record', () => {
      const errors = validateProcurementNotice(validNotice);
      expect(errors).toEqual([]);
    });

    it('rejects notice with missing or short title', () => {
      const bad = { ...validNotice, title: 'Road' };
      const errors = validateProcurementNotice(bad);
      expect(errors.some((e) => e.includes('at least 10 characters'))).toBe(true);
    });

    it('rejects invalid category and procurement method', () => {
      const bad = { ...validNotice, category: 'space_travel', procurementMethod: 'secret' };
      const errors = validateProcurementNotice(bad);
      expect(errors.some((e) => e.includes('Category must be'))).toBe(true);
      expect(errors.some((e) => e.includes('procurementMethod must be'))).toBe(true);
    });

    it('rejects negative or non-numeric estimated value', () => {
      const bad = { ...validNotice, estimatedValue: -500 };
      const errors = validateProcurementNotice(bad);
      expect(errors.some((e) => e.includes('positive number'))).toBe(true);
    });

    it('validates publicationDate cannot be later than submissionDeadline', () => {
      const bad = {
        ...validNotice,
        publicationDate: '2026-04-01T00:00:00Z',
        submissionDeadline: '2026-03-01T00:00:00Z',
      };
      const errors = validateProcurementNotice(bad);
      expect(errors.some((e) => e.includes('cannot be later than'))).toBe(true);
    });

    it('enforces secure HTTPS source URLs', () => {
      const bad = { ...validNotice, sourceUrl: 'http://insecure-portal.gov.in/tender' };
      const errors = validateProcurementNotice(bad);
      expect(errors.some((e) => e.includes('HTTPS'))).toBe(true);
    });
  });

  describe('validateAuditReviewPayload', () => {
    const validReview = {
      flagId: 'RF-2026-001',
      disposition: 'marked_false_positive',
      justification: 'Statutory emergency repair approved by Commissioner due to monsoon culvert collapse risk.',
      reviewerRole: 'auditor',
      evidenceDocumentUrl: 'https://bbmp.gov.in/proceedings/order-2026-monsoon-emergency.pdf',
    };

    it('validates a valid auditor review submission', () => {
      const errors = validateAuditReviewPayload(validReview);
      expect(errors).toEqual([]);
    });

    it('rejects review with short or missing justification', () => {
      const bad = { ...validReview, justification: 'Looks ok.' };
      const errors = validateAuditReviewPayload(bad);
      expect(errors.some((e) => e.includes('at least 15 characters'))).toBe(true);
    });

    it('rejects review containing forbidden PII', () => {
      const piiReview = {
        ...validReview,
        justification: 'Contact auditor at 9876543210 or auditor@example.com for PAN ABCDE1234F details.',
      };
      const errors = validateAuditReviewPayload(piiReview);
      expect(errors.some((e) => e.includes('telephone'))).toBe(true);
      expect(errors.some((e) => e.includes('email'))).toBe(true);
    });
  });

  describe('validateVendorEntity', () => {
    it('validates a valid vendor entity and rejects missing fields', () => {
      const valid = { id: 'VND-001', name: 'Valid Vendor Corp' };
      expect(validateVendorEntity(valid)).toEqual([]);
      expect(validateVendorEntity({ id: '' })).toContain('Vendor ID is required.');
    });
  });

  describe('anti-PII detection and sanitization', () => {
    it('detects Aadhaar, PAN, phone, and email patterns', () => {
      expect(checkForForbiddenPII('1234 5678 9012')).toContain('Aadhaar');
      expect(checkForForbiddenPII('ABCDE1234F')).toContain('PAN');
      expect(checkForForbiddenPII('9876543210')).toContain('telephone');
      expect(checkForForbiddenPII('test@domain.com')).toContain('email');
      expect(checkForForbiddenPII('Civil contract works specification 2026')).toBeNull();
    });

    it('sanitizes HTML tags and strips control characters', () => {
      const dirty = '<script>alert("xss")</script><strong>Clean notice</strong>';
      expect(sanitizeText(dirty)).toBe('alert("xss")Clean notice');
    });

    it('validates HTTPS URLs correctly', () => {
      expect(isValidHttpsUrl('https://gem.gov.in/tender/123')).toBe(true);
      expect(isValidHttpsUrl('http://insecure.com')).toBe(false);
      expect(isValidHttpsUrl('not-a-url')).toBe(false);
    });
  });

  describe('generateAuditSeal', () => {
    it('generates deterministic tamper-evident audit seals', () => {
      const s1 = generateAuditSeal('FLAG-1', 'AUD-007', 'escalated_for_formal_audit', '2026-11-16T12:00:00Z');
      const s2 = generateAuditSeal('FLAG-1', 'AUD-007', 'escalated_for_formal_audit', '2026-11-16T12:00:00Z');
      expect(s1).toBe(s2);
      expect(s1).toMatch(/^AUDIT-SEAL-[0-9A-F]{4}-[0-9A-F]{4}$/);
    });
  });
});
