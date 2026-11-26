import { describe, it, expect } from 'vitest';
import {
  assessFacilityInfrastructure,
  checkFeeTransparency,
  exportCremationGrievanceMemo,
  UP_FACILITY_TYPES,
  UP_CREMATION_ESCALATION
} from './upCremationBurialService';

describe('upCremationBurialService', () => {
  it('should define facility types and escalation authorities in UP', () => {
    expect(UP_FACILITY_TYPES.ELECTRIC_CREMATORIUM.code).toBe('ELECTRIC_CREMATORIUM');
    expect(UP_FACILITY_TYPES.BURIAL_GROUND_KABRISTAN.fuelType).toBe('EARTH_BURIAL');
    expect(UP_CREMATION_ESCALATION.length).toBe(3);
    expect(UP_CREMATION_ESCALATION[1].title).toContain('Municipal Commissioner');
  });

  it('should detect critical neglect when water, shed, and lighting are missing', () => {
    const neglected = {
      facilityId: '109923',
      facilityName: 'Baikunth Dham Ghat',
      hasRunningWater: false,
      hasCoveredShed: false,
      hasNightLighting: false,
      hasPavedRoadAccess: true,
      hasBoundaryWallOrGate: false
    };

    const res = assessFacilityInfrastructure(neglected);
    expect(res.amenityScore).toBe(15); // 100 - 25 - 25 - 20 - 15 = 15
    expect(res.status).toBe('CRITICAL_NEGLECT');
    expect(res.facilityId).toBe('FAC-UP-****-9923');
    expect(res.identifiedIssues.length).toBe(4);
    expect(res.requiresMunicipalIntervention).toBe(true);
  });

  it('should evaluate well-maintained facility with all amenities', () => {
    const good = {
      facilityId: '556677',
      facilityName: 'Eco-Friendly Electric Crematorium',
      hasRunningWater: true,
      hasCoveredShed: true,
      hasNightLighting: true,
      hasPavedRoadAccess: true,
      hasBoundaryWallOrGate: true
    };

    const res = assessFacilityInfrastructure(good);
    expect(res.amenityScore).toBe(100);
    expect(res.status).toBe('WELL_MAINTAINED');
    expect(res.requiresMunicipalIntervention).toBe(false);
  });

  it('should detect fee overcharging and missing rate boards', () => {
    const fee = {
      officialRateINR: 500,
      chargedRateINR: 2000,
      hasOfficialRateBoardDisplayed: false
    };

    const analysis = checkFeeTransparency(fee);
    expect(analysis.isOverchargingReported).toBe(true);
    expect(analysis.excessAmountChargedINR).toBe(1500);
    expect(analysis.hasOfficialRateBoardDisplayed).toBe(false);
    expect(analysis.advisory).toContain('Overcharging alert');
  });

  it('should export formatted memorandum for Municipal Commissioner', () => {
    const facility = {
      facilityName: 'Gulab Bari Mokshadham',
      facilityId: 'FAC-UP-****-1234',
      location: 'Ward 8',
      district: 'Ayodhya',
      amenityScore: 40,
      status: 'CRITICAL_NEGLECT',
      identifiedIssues: ['Missing running water connection for bathing.']
    };
    const fee = {
      officialRateINR: 500,
      isOverchargingReported: true,
      hasOfficialRateBoardDisplayed: false,
      advisory: 'Report middleman extortion'
    };

    const memo = exportCremationGrievanceMemo(facility, fee);
    expect(memo).toContain('# Memorandum: Public Crematorium / Burial Ground Infrastructure Deficit');
    expect(memo).toContain('Gulab Bari Mokshadham');
    expect(memo).toContain('Ayodhya');
    expect(memo).toContain('Sanitary Inspector / Ward Junior Engineer');
    expect(memo).toContain('Bereavement Privacy Standard');
  });

  it('should retrieve environmental norms and citizen FAQs', async () => {
    const { getCrematoriumEnvironmentalNorms, getCremationDirectoryFaqs } = await import('./upCremationBurialService');
    const norms = getCrematoriumEnvironmentalNorms();
    expect(norms.length).toBeGreaterThanOrEqual(4);
    expect(norms.some(n => n.includes('Wet scrubber'))).toBe(true);
    expect(norms.some(n => n.includes('Go-Kashth'))).toBe(true);

    const faqs = getCremationDirectoryFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].a).toContain('NGT');
    expect(faqs[3].q).toContain('Antyeshti Sthal Yojana');
  });

  it('should list cremation helpline channels', async () => {
    const { getCremationHelplines } = await import('./upCremationBurialService');
    const channels = getCremationHelplines();
    expect(channels.length).toBeGreaterThanOrEqual(3);
    expect(channels.some(c => c.number === '1533')).toBe(true);
    expect(channels.some(c => c.number === '112')).toBe(true);
  });

  it('should validate facility id masking', () => {
    const res = assessFacilityInfrastructure({ facilityId: '9876543210' });
    expect(res.facilityId).toBe('FAC-UP-****-3210');
  });

  it('should handle unlisted facility fallback', () => {
    const res = assessFacilityInfrastructure({});
    expect(res.facilityId).toBe('FAC-UNKNOWN');
    expect(res.facilityName).toBe('Public Cremation / Burial Ground');
  });
});
