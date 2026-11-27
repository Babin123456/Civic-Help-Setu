/**
 * src/services/noticeOrderExplainerService.test.js
 *
 * Unit tests for Plain-Language Government Notice & Order Explainer (#1422).
 */

import { describe, it, expect } from 'vitest';
import {
  explainGovernmentNoticeOrOrder,
  assessOcrConfidence,
  AUTHORITATIVE_TEXT_DISCLAIMER,
} from './noticeOrderExplainerService.js';

describe('noticeOrderExplainerService (#1422)', () => {
  it('extracts sections with page/paragraph citations and preserves authoritative disclaimer', () => {
    const res = explainGovernmentNoticeOrOrder({
      title: 'Revenue Notice #14/2026',
      text: 'Applicants shall furnish an income certificate before 31/12/2026.\n\n---PAGE---\n\nAppeals may be filed at the District Office.',
      jurisdiction: 'Delhi',
      effectiveDate: '2026-11-01',
      lastVerifiedAt: '2026-11-15T10:00:00Z',
    });

    expect(res.officialTextAuthoritative).toBe(true);
    expect(res.authoritativeDisclaimer).toBe(AUTHORITATIVE_TEXT_DISCLAIMER);
    expect(res.verificationStatus).toBe('VERIFIED');
    expect(res.sections).toHaveLength(2);
    expect(res.sections[0].citation).toBe('Page 1, Para 1');
    expect(res.sections[1].citation).toBe('Page 2, Para 1');
    expect(res.sections[0].plainLanguageSummary).toContain('submit');
  });

  it('flags low OCR confidence and conditional uncertainty', () => {
    const lowOcr = assessOcrConfidence('garbled', 0.45);
    expect(lowOcr.ocrLowConfidenceFlag).toBe(true);

    const res = explainGovernmentNoticeOrOrder({
      text: 'Processing times may vary depending on ward check.',
      ocrConfidence: 0.52,
    });
    expect(res.ocrLowConfidenceFlag).toBe(true);
    expect(res.sections[0].uncertaintyFlag).toBe(true);
    expect(res.verificationStatus).toBe('UNVERIFIED');
  });

  it('rejects Aadhaar and PAN PII in notice text', () => {
    expect(() =>
      explainGovernmentNoticeOrOrder({ text: 'Applicant Aadhaar 1234 5678 9012' })
    ).toThrow(/Aadhaar or PAN/i);
  });
});
