import { describe, it, expect } from 'vitest';
import {
  decomposeClaims,
  verifyClaim,
  verifyAnswerEntailment,
  CLAIM_RISK_CATEGORY,
  ENTAILMENT_STATUS,
} from './evidenceEntailmentVerificationService.js';

describe('Evidence Entailment Verification Service', () => {
  const mockEvidence = [
    {
      id: 'doc-1',
      title: 'Voter ID Replacement Guidelines',
      sourceUrl: 'https://voters.eci.gov.in',
      text: 'Replacement of EPIC card requires Form 8 submission. A replacement fee is charged at the counter.',
    },
    {
      id: 'doc-2',
      title: 'Ration Card Renewal Rules',
      sourceUrl: 'https://nfsa.gov.in',
      text: 'The statutory deadline for processing rural ration card transfer applications is 30 days from document verification.',
    },
    {
      id: 'doc-3',
      title: 'Income Certificate Documentation',
      sourceUrl: 'https://edistrict.gov.in',
      text: 'Mandatory documents include salary slips, Form 16, or affidavit of annual income from the local tehsildar.',
    },
  ];

  it('decomposes sentences and detects high-risk categories', () => {
    const text = `
    1. Replacement of EPIC card requires Form 8 submission.
    2. The application fee is rupees 25.
    3. You must complete verification within 30 days.
    4. Violations under Section 420 carry severe penalties.
    `;

    const claims = decomposeClaims(text);
    expect(claims.length).toBe(4);

    expect(claims[0].riskCategory).toBe(CLAIM_RISK_CATEGORY.GENERAL_FACT);
    expect(claims[1].riskCategory).toBe(CLAIM_RISK_CATEGORY.HIGH_RISK_FEE);
    expect(claims[2].riskCategory).toBe(CLAIM_RISK_CATEGORY.HIGH_RISK_DEADLINE);
    expect(claims[3].riskCategory).toBe(CLAIM_RISK_CATEGORY.HIGH_RISK_PENALTY_LEGAL);
  });

  it('verifies a fully supported claim against evidence', () => {
    const claim = {
      id: 'c-1',
      text: 'Replacement of EPIC card requires Form 8 submission.',
      riskCategory: CLAIM_RISK_CATEGORY.GENERAL_FACT,
    };

    const res = verifyClaim(claim, mockEvidence);
    expect(res.status).toBe(ENTAILMENT_STATUS.SUPPORTED);
    expect(res.supportingChunkIds).toContain('doc-1');
    expect(res.citations.length).toBe(1);
    expect(res.citations[0].url).toBe('https://voters.eci.gov.in');
  });

  it('flags insufficient evidence when claim has no backing chunks', () => {
    const claim = {
      id: 'c-unknown',
      text: 'You must provide a passport and five notarized stamps from the high commission.',
      riskCategory: CLAIM_RISK_CATEGORY.GENERAL_FACT,
    };

    const res = verifyClaim(claim, mockEvidence);
    expect(res.status).toBe(ENTAILMENT_STATUS.INSUFFICIENT_EVIDENCE);
    expect(res.supportingChunkIds.length).toBe(0);
  });

  it('detects contradiction when negation flips meaning', () => {
    const claim = {
      id: 'c-contra',
      text: 'Mandatory documents do not include salary slips or Form 16.',
      riskCategory: CLAIM_RISK_CATEGORY.GENERAL_FACT,
    };

    const res = verifyClaim(claim, mockEvidence);
    expect(res.status).toBe(ENTAILMENT_STATUS.CONTRADICTED);
  });

  it('applies fail-closed notice when high risk claims lack supporting evidence', () => {
    const answer = 'The statutory fee for this scheme is Rs 5000 and must be paid in cash.';
    const result = verifyAnswerEntailment(answer, mockEvidence);

    expect(result.overallSupported).toBe(false);
    expect(result.unsupportedCount).toBeGreaterThanOrEqual(1);
    expect(result.failClosedNotice).toContain('Caution: Statutory fee or deadline information');
    expect(result.sanitizedAnswer).toContain('[!NOTE]');
  });

  it('returns clean verified result when all claims are entailed', () => {
    const answer = 'The statutory deadline for processing rural ration card transfer applications is 30 days from document verification.';
    const result = verifyAnswerEntailment(answer, mockEvidence);

    expect(result.overallSupported).toBe(true);
    expect(result.verifiedCount).toBe(1);
    expect(result.unsupportedCount).toBe(0);
    expect(result.failClosedNotice).toBeNull();
  });
});
