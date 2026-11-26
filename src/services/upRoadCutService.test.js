import { describe, it, expect } from 'vitest';
import {
  assessRoadCutSafetyRisk,
  checkReinstatementSla,
  aggregateRoadCutObservations,
  exportRoadCutEscalationNotice,
  UP_EXCAVATING_AGENCIES,
  UP_ROAD_AUTHORITIES,
  REINSTATEMENT_STATUSES
} from './upRoadCutService';

describe('upRoadCutService', () => {
  it('should list official agencies and road authorities in UP', () => {
    expect(UP_EXCAVATING_AGENCIES.length).toBeGreaterThanOrEqual(4);
    expect(UP_EXCAVATING_AGENCIES.some(a => a.includes('Jal Nigam'))).toBe(true);
    expect(UP_ROAD_AUTHORITIES.PWD.code).toBe('PWD');
    expect(UP_ROAD_AUTHORITIES.NAGAR_NIGAM.officer).toContain('Municipal Commissioner');
  });

  it('should assess critical safety risk when deep trench lacks barricades and lighting near school', () => {
    const hazard = {
      hasWarningBarricades: false,
      hasRetroreflectiveTapeOrNightLighting: false,
      isNearSchoolOrHospital: true,
      isMainArterialRoad: true,
      trenchDepthMeters: 2.0
    };

    const risk = assessRoadCutSafetyRisk(hazard);
    expect(risk.safetyScore).toBeGreaterThanOrEqual(70);
    expect(risk.severityLevel).toBe('CRITICAL');
    expect(risk.isImmediateHazard).toBe(true);
    expect(risk.requiredImmediateAction).toContain('Immediate intervention required');
  });

  it('should calculate SLA breach when reinstatement exceeds 14 days', () => {
    const cutRecord = {
      excavationEndDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      status: REINSTATEMENT_STATUSES.BACKFILLED_UNPAVED
    };

    const sla = checkReinstatementSla(cutRecord);
    expect(sla.isOverdue).toBe(true);
    expect(sla.overdueDays).toBe(21); // 35 - 14
    expect(sla.status).toBe(REINSTATEMENT_STATUSES.OVERDUE_BREACHED);
    expect(sla.bankGuaranteeForfeitureEligible).toBe(true);
  });

  it('should report compliant status when within 14 days', () => {
    const cutRecord = {
      excavationEndDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: REINSTATEMENT_STATUSES.EXCAVATION_IN_PROGRESS
    };

    const sla = checkReinstatementSla(cutRecord);
    expect(sla.isOverdue).toBe(false);
    expect(sla.overdueDays).toBe(0);
  });

  it('should aggregate community citizen reports and confirm consensus', () => {
    const reports = [
      { roadId: 'CUT-101', hasBarricade: false, depthMeters: 1.2 },
      { roadId: 'CUT-101', hasBarricade: false, depthMeters: 1.0 },
      { roadId: 'CUT-101', hasBarricade: true, depthMeters: 1.1 }
    ];

    const agg = aggregateRoadCutObservations(reports);
    expect(agg.totalObservations).toBe(3);
    expect(agg.verifiedByCommunity).toBe(true);
    expect(agg.consensusBarricadingMissing).toBe(true);
    expect(agg.averageReportedDepthMeters).toBe(1.1);
  });

  it('should export public escalation demand notice markdown', () => {
    const cut = {
      locationName: 'Gomti Nagar Main Road',
      city: 'Lucknow',
      authorityName: 'Lucknow Nagar Nigam',
      excavatingAgency: 'UP Jal Nigam',
      permitNumber: 'LNN-CUT-2026-992'
    };
    const safety = { severityLevel: 'CRITICAL', safetyScore: 85, isImmediateHazard: true };
    const sla = { status: 'OVERDUE_BREACHED', overdueDays: 16, bankGuaranteeForfeitureEligible: true };

    const notice = exportRoadCutEscalationNotice(cut, safety, sla);
    expect(notice).toContain('# Public Notice & Reinstatement Demand');
    expect(notice).toContain('Gomti Nagar Main Road');
    expect(notice).toContain('Lucknow Nagar Nigam');
    expect(notice).toContain('14 Calendar Days');
    expect(notice).toContain('CRITICAL');
    expect(notice).toContain('Bank Guarantee Clause');
  });

  it('should retrieve technical reinstatement standards and municipal helplines', async () => {
    const { getTechnicalReinstatementStandards, getMunicipalHelpline } = await import('./upRoadCutService');
    const standards = getTechnicalReinstatementStandards();
    expect(standards.BASE_COURSE).toContain('Wet Mix Macadam');
    expect(standards.MINIMUM_CURING_TIME_DAYS).toBe(7);

    const lko = getMunicipalHelpline('Lucknow');
    expect(lko.agency).toContain('Lucknow Municipal Corporation');
    expect(lko.contact).toContain('1533');

    const fallback = getMunicipalHelpline('UnlistedCity');
    expect(fallback.contact).toContain('1533');
  });

  it('should list statutory excavation permit conditions', async () => {
    const { getExcavationPermitConditions } = await import('./upRoadCutService');
    const conditions = getExcavationPermitConditions();
    expect(conditions.length).toBeGreaterThanOrEqual(4);
    expect(conditions.some(c => c.includes('potholing'))).toBe(true);
    expect(conditions.some(c => c.includes('Amber hazard lamps'))).toBe(true);
  });
});
