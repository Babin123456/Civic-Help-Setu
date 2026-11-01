import { describe, it, expect } from 'vitest';
import {
  explainEligibilityAssessment,
  MANDATORY_VERIFICATION_NOTICE
} from './groundedEligibilityExplainerService';

describe('groundedEligibilityExplainerService', () => {
  const eligibleAssessment = {
    status: 'eligible',
    schemeName: 'Post-Matric Scholarship',
    reason: 'Family income below threshold and student enrolled in recognized course.',
    criteria: [
      { id: 'inc', label: 'Annual Family Income', state: 'satisfied', detail: 'Income is ₹1,80,000 (under ₹2,50,000 limit)' },
      { id: 'enr', label: 'Enrolled in Recognized Institution', state: 'satisfied', detail: 'Currently enrolled in B.Tech' },
      { id: 'bon', label: 'Bonafide State Resident', state: 'confirm', detail: 'Needs domicile certificate verification' }
    ]
  };

  const conditionalAssessment = {
    status: 'conditional',
    schemeName: 'PM-Kisan Samman Nidhi',
    reason: 'Landholding verified, but Aadhaar OTP e-KYC must be completed.',
    missingPrerequisites: ['Aadhaar biometric e-KYC at CSC center'],
    criteria: [
      { id: 'lnd', label: 'Cultivable Agricultural Land', state: 'satisfied', detail: '2.5 acres registered land' },
      { id: 'kyc', label: 'Aadhaar e-KYC Status', state: 'missing', detail: 'Aadhaar not linked' }
    ]
  };

  const ineligibleAssessment = {
    status: 'ineligible',
    schemeName: 'Antyodaya Anna Yojana (AAY)',
    reason: 'Family annual income exceeds BPL threshold limit.',
    criteria: [
      { id: 'cat', label: 'Socio-Economic Category', state: 'satisfied', detail: 'Rural resident' },
      { id: 'inc', label: 'Annual Income Below ₹1 Lakh', state: 'missing', detail: 'Annual income is ₹3,20,000 (exceeds ₹1,00,000)' }
    ]
  };

  const unknownAssessment = {
    status: 'unknown',
    schemeName: 'Disability Pension Scheme',
    reason: 'Medical disability certificate percentage is not provided.',
    criteria: [
      { id: 'res', label: 'State Domicile', state: 'satisfied', detail: 'Resident of Uttar Pradesh' },
      { id: 'dis', label: 'UDID Card & Disability Percentage >= 40%', state: 'unknown', detail: 'Question was left unanswered' }
    ]
  };

  it('explains ELIGIBLE status with matched criteria details and never overrides engine status', () => {
    const result = explainEligibilityAssessment(eligibleAssessment);

    expect(result.status).toBe('eligible');
    expect(result.breakdown.matchedCount).toBe(2);
    expect(result.breakdown.provisionalCount).toBe(1);
    expect(result.narrative).toContain('You meet all evaluated requirements');
    expect(result.narrative).toContain('Annual Family Income');
    expect(result.verificationNotice).toBe(MANDATORY_VERIFICATION_NOTICE);
  });

  it('explains CONDITIONAL status with pending prerequisites clearly', () => {
    const result = explainEligibilityAssessment(conditionalAssessment);

    expect(result.status).toBe('conditional');
    expect(result.narrative).toContain('partially qualify');
    expect(result.narrative).toContain('Aadhaar biometric e-KYC');
    expect(result.keyTakeaways[1]).toContain('Aadhaar biometric e-KYC');
  });

  it('explains INELIGIBLE status with confirmed mismatch and does not confuse with missing data', () => {
    const result = explainEligibilityAssessment(ineligibleAssessment);

    expect(result.status).toBe('ineligible');
    expect(result.breakdown.unmatchedCount).toBe(1);
    expect(result.narrative).toContain('does not qualify');
    expect(result.narrative).toContain('Annual Income Below ₹1 Lakh');
    expect(result.narrative).toContain('exceeds ₹1,00,000');
  });

  it('explains UNKNOWN status highlighting unassessed missing questions without calling it rejection', () => {
    const result = explainEligibilityAssessment(unknownAssessment);

    expect(result.status).toBe('unknown');
    expect(result.breakdown.unassessedCount).toBe(1);
    expect(result.narrative).toContain('could not be determined');
    expect(result.narrative).toContain('UDID Card & Disability Percentage');
    expect(result.narrative).toContain('This is not a rejection');
  });

  it('resiliently handles empty or invalid assessment objects without crashing', () => {
    const result = explainEligibilityAssessment(null);
    expect(result.status).toBe('unknown');
    expect(result.isGrounded).toBe(true);

    const malformed = explainEligibilityAssessment({ status: 'invalid-status', criteria: 'not-array' });
    expect(result.status).toBe('unknown');
    expect(result.narrative).toBeDefined();
  });
});
