import { describe, it, expect } from 'vitest';
import {
  explainRejectionNotice,
  getStatutoryAppealRights,
  REJECTION_CATEGORIES,
  SAMPLE_REJECTION_NOTICES,
} from './rejectionNoticeExplainerService.js';

describe('rejectionNoticeExplainerService', () => {
  it('translates annexure deficiency notices into plain language with steps', () => {
    const raw = 'Deficiency in Annexure IV observed. Clause 3 uncompleted. File halted.';
    const result = explainRejectionNotice(raw, { name: 'Ration Card Scheme', officialWebsite: 'https://nfsa.gov.in' });

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(REJECTION_CATEGORIES.ANNEXURE_DEFICIENCY);
    expect(result.title).toContain('Supporting Annexure');
    expect(result.plainLanguageExplanation).toContain('blank, incomplete, or missing');
    expect(result.statutoryDeadline).toContain('15 to 30 days');
    expect(result.remediationSteps.length).toBeGreaterThanOrEqual(3);
    expect(result.officialWebsite).toBe('https://nfsa.gov.in');
  });

  it('translates name mismatch and demographic disparity notices', () => {
    const raw = 'Name mismatch detected between Aadhaar card (R. K. Sharma) and Class X matriculation certificate.';
    const result = explainRejectionNotice(raw);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(REJECTION_CATEGORIES.DEMOGRAPHIC_MISMATCH);
    expect(result.title).toContain('Mismatched Personal Details');
    expect(result.plainLanguageExplanation).toContain('spelling');
    expect(result.remediationSteps.some((s) => s.includes('One and the Same Person'))).toBe(true);
  });

  it('translates expired certificate notices', () => {
    const raw = 'Rejected due to invalid validity: Parental annual income certificate has expired validity date.';
    const result = explainRejectionNotice(raw);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(REJECTION_CATEGORIES.EXPIRED_DOCUMENT);
    expect(result.remediationSteps.some((s) => s.includes('renewed copy'))).toBe(true);
  });

  it('translates missing attestation or unsigned notices', () => {
    const raw = 'Non-gazetted self-attestation invalid. Signature missing on Schedule 2.';
    const result = explainRejectionNotice(raw);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(REJECTION_CATEGORIES.ATTESTATION_OR_SIGNATURE);
    expect(result.plainLanguageExplanation).toContain('without your signature');
  });

  it('translates fee deficit and challan mismatch notices', () => {
    const raw = 'Court fee deficit of Rs. 50 noted. E-Challan payment reconciliation failed.';
    const result = explainRejectionNotice(raw);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(REJECTION_CATEGORIES.FEE_DEFICIT);
    expect(result.remediationSteps.some((s) => s.includes('supplementary challan'))).toBe(true);
  });

  it('translates photo and biometric specification rejection', () => {
    const raw = 'Photo rejected: White background specification not met and facial features unclear.';
    const result = explainRejectionNotice(raw);

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(REJECTION_CATEGORIES.PHOTO_BIOMETRICS);
    expect(result.remediationSteps.some((s) => s.includes('white background'))).toBe(true);
  });

  it('provides safe fallback for unknown or unparseable notices', () => {
    const raw = 'Internal code 9931 clerk ref #402.';
    const result = explainRejectionNotice(raw, { name: 'Land Mutation' });

    expect(result.isValid).toBe(true);
    expect(result.category).toBe(REJECTION_CATEGORIES.UNKNOWN_FALLBACK);
    expect(result.plainLanguageExplanation).toContain('non-standard departmental terminology');
    expect(result.remediationSteps.length).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', () => {
    const result = explainRejectionNotice('');
    expect(result.isValid).toBe(false);
    expect(result.explanation).toBeNull();
  });

  it('provides statutory appeal rights information', () => {
    const appeal = getStatutoryAppealRights('Driving License');
    expect(appeal.appellateTitle).toContain('Appellate Authority');
    expect(appeal.groundsForAppeal.length).toBeGreaterThan(0);
  });

  it('verifies all curated sample rejection notices parse correctly', () => {
    SAMPLE_REJECTION_NOTICES.forEach((sample) => {
      const res = explainRejectionNotice(sample.rawNotice, { name: sample.service });
      expect(res.isValid).toBe(true);
      expect(res.category).not.toBe(REJECTION_CATEGORIES.UNKNOWN_FALLBACK);
      expect(res.remediationSteps.length).toBeGreaterThan(0);
    });
  });
});

