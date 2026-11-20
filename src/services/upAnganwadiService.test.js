import { describe, it, expect } from 'vitest';
import {
  assessAnganwadiFacility,
  aggregateAnganwadiCommunityConcerns,
  exportAnganwadiGrievanceMemo,
  ICDS_CORE_SERVICES,
  ANGANWADI_ESCALATION_HIERARCHY,
  COMMON_FACILITY_CONCERNS
} from './upAnganwadiService';

describe('upAnganwadiService', () => {
  it('should list core ICDS services and escalation officers in UP', () => {
    expect(ICDS_CORE_SERVICES.SUPPLEMENTARY_NUTRITION.code).toBe('SUPPLEMENTARY_NUTRITION');
    expect(ICDS_CORE_SERVICES.GROWTH_MONITORING.tools).toContain('Poshan Tracker');
    expect(ANGANWADI_ESCALATION_HIERARCHY.length).toBe(3);
    expect(ANGANWADI_ESCALATION_HIERARCHY[1].designation).toContain('CDPO');
    expect(COMMON_FACILITY_CONCERNS.RATION_SUPPLY_IRREGULARITY).toBeDefined();
  });

  it('should detect critical gaps when drinking water, toilet, and ration are disrupted', () => {
    const awcData = {
      awcCode: '09123456789',
      villageOrWard: 'Gram Rampur',
      district: 'Sitapur',
      hasPotableWater: false,
      hasFunctionalToilet: false,
      hasFunctionalWeighingScale: false,
      reportedRationDelayedMonths: 2
    };

    const res = assessAnganwadiFacility(awcData);
    expect(res.qualityScore).toBe(0); // 100 - 25 - 25 - 20 - 30 = 0
    expect(res.status).toBe('CRITICAL_GAPS');
    expect(res.awcCode).toBe('AWC-UP-****-6789');
    expect(res.identifiedIssues.length).toBe(4);
    expect(res.requiresSectorSupervision).toBe(true);
  });

  it('should evaluate satisfactory status when facilities are operational', () => {
    const goodAwc = {
      awcCode: '09998877665',
      hasPotableWater: true,
      hasFunctionalToilet: true,
      hasFunctionalWeighingScale: true,
      reportedRationDelayedMonths: 0
    };

    const res = assessAnganwadiFacility(goodAwc);
    expect(res.qualityScore).toBe(100);
    expect(res.status).toBe('SATISFACTORY');
    expect(res.requiresSectorSupervision).toBe(false);
  });

  it('should aggregate community observations and verify concerns with 3+ reports', () => {
    const reports = [
      { awcId: 'AWC-1', flaggedConcerns: ['RATION_DISRUPTED', 'TOILET_BROKEN'] },
      { awcId: 'AWC-1', flaggedConcerns: ['RATION_DISRUPTED'] },
      { awcId: 'AWC-1', flaggedConcerns: ['RATION_DISRUPTED', 'CENTRE_CLOSED'] }
    ];

    const agg = aggregateAnganwadiCommunityConcerns(reports);
    expect(agg.totalObservations).toBe(3);
    expect(agg.verifiedByCommunity).toBe(true);
    expect(agg.verifiedConcerns).toContain('RATION_DISRUPTED');
    expect(agg.requiresOfficialEscalation).toBe(true);
  });

  it('should export formatted representation memo for CDPO', () => {
    const facility = {
      awcCode: 'AWC-UP-****-1122',
      villageOrWard: 'Ward 5, Bakshi Ka Talab',
      district: 'Lucknow',
      qualityScore: 45,
      status: 'CRITICAL_GAPS',
      identifiedIssues: ['Missing child-friendly toilet facility.']
    };

    const aggregate = {
      totalObservations: 4,
      verifiedConcerns: ['Ration supply disrupted for past 6 weeks.']
    };

    const memo = exportAnganwadiGrievanceMemo(facility, aggregate);
    expect(memo).toContain('# Representation: Anganwadi Facility & Service Delivery Deficit');
    expect(memo).toContain('Bakshi Ka Talab');
    expect(memo).toContain('Mukhya Sevika (Sector Supervisor)');
    expect(memo).toContain('Child Development Project Officer (CDPO');
    expect(memo).toContain('Child Protection Standard');
  });

  it('should retrieve Anganwadi FAQs and prescribed infrastructure norms', async () => {
    const { getAnganwadiFaqs, getAnganwadiInfrastructureNorms } = await import('./upAnganwadiService');
    const faqs = getAnganwadiFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].q).toContain('Take Home Ration');
    expect(faqs[3].a).toContain('completely free of cost');

    const norms = getAnganwadiInfrastructureNorms();
    expect(norms.length).toBeGreaterThanOrEqual(4);
    expect(norms.some(n => n.includes('infantometer'))).toBe(true);
    expect(norms.some(n => n.includes('child-friendly toilet'))).toBe(true);
  });

  it('should list emergency maternal and child welfare hotlines', async () => {
    const { getIcdsHotlines } = await import('./upAnganwadiService');
    const hotlines = getIcdsHotlines();
    expect(hotlines.length).toBeGreaterThanOrEqual(3);
    expect(hotlines.some(h => h.number === '1098')).toBe(true);
    expect(hotlines.some(h => h.number === '1076')).toBe(true);
  });
});
