import { describe, it, expect } from 'vitest';
import {
  validateSchoolFacilityObservation,
  aggregateSchoolGaps,
  exportSchoolGapDossier,
  getOperationKayakalpParameters,
  UP_SCHOOL_FACILITY_CATEGORIES,
  AGGREGATION_CONFIG
} from './upSchoolFacilityGapService';

describe('upSchoolFacilityGapService', () => {
  it('should define statutory UP school facility categories', () => {
    expect(UP_SCHOOL_FACILITY_CATEGORIES.DRINKING_WATER.code).toBe('DRINKING_WATER');
    expect(UP_SCHOOL_FACILITY_CATEGORIES.BOYS_GIRLS_TOILETS.statutoryNorm).toContain('Supreme Court');
    expect(UP_SCHOOL_FACILITY_CATEGORIES.RAMP_ACCESSIBILITY.code).toBe('RAMP_ACCESSIBILITY');
  });

  it('should validate complete observation report', () => {
    const validData = {
      udiseCode: '09120401201', // 11-digit valid code
      schoolName: 'Prathmik Vidyalaya Mohanpur',
      district: 'Varanasi',
      block: 'Kashi Vidyapeeth',
      facilityCategory: 'DRINKING_WATER',
      observationDate: '2024-03-01',
      description: 'The submersible water pump has been non-functional for three weeks; taps are dry.'
    };

    const res = validateSchoolFacilityObservation(validData);
    expect(res.isValid).toBe(true);
    expect(res.sanitizedObservation.udiseCode).toBe('09120401201');
    expect(res.sanitizedObservation.isCommunityReport).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('should reject invalid UDISE+ codes and short descriptions', () => {
    const invalid = validateSchoolFacilityObservation({
      udiseCode: '123', // not 11 digits
      schoolName: '',
      facilityCategory: 'INVALID',
      description: 'Too short'
    });

    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should enforce child privacy protection by rejecting reports with child names or roll numbers', () => {
    const childBreach = {
      udiseCode: '09120401201',
      schoolName: 'Prathmik Vidyalaya Mohanpur',
      facilityCategory: 'BOYS_GIRLS_TOILETS',
      observationDate: '2024-03-01',
      description: 'Student name Rahul in Class 5 could not use the toilet.'
    };

    const res = validateSchoolFacilityObservation(childBreach);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.includes('Child Privacy Violation'))).toBe(true);
  });

  it('should warn on named staff accusations and uphold infrastructure focus', () => {
    const staffNotice = {
      udiseCode: '09120401201',
      schoolName: 'Prathmik Vidyalaya Mohanpur',
      facilityCategory: 'CLASSROOM_INFRASTRUCTURE',
      observationDate: '2024-03-01',
      description: 'The roof plaster is falling down and Principal Sharma is not fixing it.'
    };

    const res = validateSchoolFacilityObservation(staffNotice);
    expect(res.isValid).toBe(true); // infrastructure valid, but warning issued
    expect(res.warnings.some(w => w.includes('Staff Protection Notice'))).toBe(true);
  });

  it('should enforce minimum report threshold for public aggregation', () => {
    const sampleObs = [
      { udiseCode: '09120401201', schoolName: 'PV Mohanpur', facilityCategory: 'DRINKING_WATER' },
      { udiseCode: '09120401201', schoolName: 'PV Mohanpur', facilityCategory: 'DRINKING_WATER' }
    ];

    // 2 reports < threshold 3
    const belowThreshold = aggregateSchoolGaps(sampleObs, '09120401201');
    expect(belowThreshold.meetsPublicThreshold).toBe(false);
    expect(belowThreshold.message).toContain('Below minimum threshold');

    // Add 3rd report
    sampleObs.push({ udiseCode: '09120401201', schoolName: 'PV Mohanpur', facilityCategory: 'BOYS_GIRLS_TOILETS' });
    const aboveThreshold = aggregateSchoolGaps(sampleObs, '09120401201');
    expect(aboveThreshold.meetsPublicThreshold).toBe(true);
    expect(aboveThreshold.totalReports).toBe(3);
    expect(aboveThreshold.topGapCategory).toBe('DRINKING_WATER');
  });

  it('should list Operation Kayakalp core parameters', () => {
    const params = getOperationKayakalpParameters();
    expect(params.length).toBeGreaterThanOrEqual(8);
    expect(params[0].item).toContain('Safe Drinking Water');
  });

  it('should export formatted markdown dossier with SMC and BEO follow-up routes', () => {
    const obs = {
      schoolName: 'Uchha Prathmik Vidyalaya Alinagar',
      udiseCode: '09120409999',
      district: 'Chandauli',
      block: 'Niyamatabad',
      facilityCategory: 'BOYS_GIRLS_TOILETS',
      observationDate: '2024-02-20',
      description: 'Girls toilet doors broken; no running water connection.'
    };

    const doc = exportSchoolGapDossier(obs);
    expect(doc).toContain('# UP School Basic-Facility Gap Observation & Follow-Up Dossier');
    expect(doc).toContain('Uchha Prathmik Vidyalaya Alinagar');
    expect(doc).toContain('09120409999');
    expect(doc).toContain('School Management Committee (SMC)');
    expect(doc).toContain('Block Education Officer (BEO)');
    expect(doc).toContain('District Basic Shiksha Adhikari (BSA)');
  });
});
