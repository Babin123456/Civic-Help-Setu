import { describe, it, expect } from 'vitest';
import {
  assessVendorReadiness,
  buildStreetVendorApplicationGuide,
  exportStreetVendorReadinessSummary,
  VENDING_CATEGORIES,
  ZONE_TYPES,
  STATUTORY_EVIDENCE_CHECKLIST,
  SVANIDHI_DISTINCTION_FACTS
} from './streetVendorWorkspaceService';

describe('streetVendorWorkspaceService', () => {
  it('should define statutory categories and zones', () => {
    expect(VENDING_CATEGORIES.STATIONARY.id).toBe('stationary');
    expect(VENDING_CATEGORIES.MOBILE.id).toBe('mobile');
    expect(ZONE_TYPES.VENDING.id).toBe('vending_zone');
    expect(ZONE_TYPES.NO_VENDING.id).toBe('no_vending_zone');
    expect(STATUTORY_EVIDENCE_CHECKLIST.length).toBeGreaterThanOrEqual(4);
  });

  it('should validate complete vendor readiness accurately', () => {
    const validVendor = {
      fullName: 'Ramesh Kumar',
      municipality: 'Patna Municipal Corporation',
      category: 'stationary',
      age: 38,
      hasSurveySlip: true,
      documents: [
        'identity_proof',
        'residence_proof',
        'vending_site_photograph',
        'no_other_vending_undertaking'
      ]
    };

    const result = assessVendorReadiness(validVendor);
    expect(result.readyToSubmit).toBe(true);
    expect(result.surveyStatus).toBe('SURVEYED_TVC');
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('should catch errors when mandatory fields are missing', () => {
    const invalidVendor = {
      fullName: '',
      municipality: '',
      category: 'unknown_cat',
      age: 12,
      documents: []
    };

    const result = assessVendorReadiness(invalidVendor);
    expect(result.readyToSubmit).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.warnings.length).toBeGreaterThanOrEqual(4);
  });

  it('should distinguish Certificate of Vending from PM SVANidhi loans', () => {
    expect(SVANIDHI_DISTINCTION_FACTS.certificateOfVending.financialBenefit).toBe(false);
    expect(SVANIDHI_DISTINCTION_FACTS.pmSvanidhiLoan.financialBenefit).toBe(true);
    expect(SVANIDHI_DISTINCTION_FACTS.certificateOfVending.statute).toContain('Street Vendors Act, 2014');
  });

  it('should build a structured application guide', () => {
    const guide = buildStreetVendorApplicationGuide({
      municipality: 'Greater Chennai Corporation',
      category: 'mobile',
      zoneType: 'restricted_vending_zone'
    });

    expect(guide.authority).toBe('Greater Chennai Corporation');
    expect(guide.categoryDetails.id).toBe('mobile');
    expect(guide.zoneDetails.id).toBe('restricted_vending_zone');
    expect(guide.steps).toHaveLength(4);
    expect(guide.protectionNotice).toContain('Section 3(3)');
  });

  it('should export a comprehensive markdown readiness summary', () => {
    const vendor = {
      fullName: 'Sunita Devi',
      municipality: 'Municipal Corporation of Delhi',
      category: 'peripatetic',
      zoneType: 'vending_zone',
      age: 42,
      hasSurveySlip: false,
      interestedInLoan: true,
      documents: ['identity_proof']
    };

    const summary = exportStreetVendorReadinessSummary(vendor);
    expect(summary).toContain('# Street Vendor Certificate & Vending-Zone Application Summary');
    expect(summary).toContain('Sunita Devi');
    expect(summary).toContain('Municipal Corporation of Delhi');
    expect(summary).toContain('UNSURVEYED_APPLICANT');
    expect(summary).toContain('PM SVANidhi');
  });
});
