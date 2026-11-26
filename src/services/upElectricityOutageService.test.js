import { describe, it, expect } from 'vitest';
import {
  diagnoseOutageScope,
  aggregateOutageCluster,
  exportOutageGrievanceDossier,
  UPPCL_DISCOMS,
  OUTAGE_SCOPES,
  UPPCL_ESCALATION_OFFICERS
} from './upElectricityOutageService';

describe('upElectricityOutageService', () => {
  it('should list official UP Discoms and escalation officers', () => {
    expect(UPPCL_DISCOMS.MVVNL.code).toBe('MVVNL');
    expect(UPPCL_DISCOMS.PUVVNL.hq).toBe('Varanasi');
    expect(OUTAGE_SCOPES.DISTRIBUTION_TRANSFORMER.upercSlaHoursRural).toBe(48);
    expect(OUTAGE_SCOPES.DISTRIBUTION_TRANSFORMER.upercSlaHoursUrban).toBe(24);
    expect(UPPCL_ESCALATION_OFFICERS.length).toBe(4);
    expect(UPPCL_ESCALATION_OFFICERS[3].level).toBe('STATUTORY');
  });

  it('should diagnose burnt distribution transformer in rural area and evaluate SLA breach', () => {
    const outage = {
      isTransformerSparkingOrLeakingOil: true,
      isRuralArea: true,
      durationHours: 60 // > 48h
    };

    const res = diagnoseOutageScope(outage);
    expect(res.scopeCode).toBe('DISTRIBUTION_TRANSFORMER');
    expect(res.prescribedSlaHours).toBe(48);
    expect(res.isSlaBreached).toBe(true);
    expect(res.overdueHours).toBe(12);
    expect(res.statutoryCompensationEligible).toBe(true);
    expect(res.remedyGuidance).toContain('Divisional Transformer Workshop');
  });

  it('should diagnose feeder level blackout for entire village', () => {
    const outage = {
      isTransformerSparkingOrLeakingOil: false,
      isEntireVillageOrColonyDark: true,
      durationHours: 10 // > 8h
    };

    const res = diagnoseOutageScope(outage);
    expect(res.scopeCode).toBe('FEEDER_LEVEL_OUTAGE');
    expect(res.prescribedSlaHours).toBe(8);
    expect(res.isSlaBreached).toBe(true);
    expect(res.overdueHours).toBe(2);
  });

  it('should diagnose isolated household fault', () => {
    const outage = {
      isTransformerSparkingOrLeakingOil: false,
      isEntireVillageOrColonyDark: false,
      durationHours: 2 // <= 4h
    };

    const res = diagnoseOutageScope(outage);
    expect(res.scopeCode).toBe('INDIVIDUAL_HOUSEHOLD');
    expect(res.prescribedSlaHours).toBe(4);
    expect(res.isSlaBreached).toBe(false);
  });

  it('should aggregate neighborhood outage reports and confirm consensus', () => {
    const reports = [
      { transformerId: 'DT-12', durationHours: 24 },
      { transformerId: 'DT-12', durationHours: 26 },
      { transformerId: 'DT-12', durationHours: 25 }
    ];

    const cluster = aggregateOutageCluster(reports);
    expect(cluster.totalConsumersReported).toBe(3);
    expect(cluster.isCommunityConsensusConfirmed).toBe(true);
    expect(cluster.averageOutageHours).toBe(25);
    expect(cluster.isMassPowerFailureAlert).toBe(false);
  });

  it('should export formatted representation dossier for Executive Engineer', () => {
    const consumer = {
      discomCode: 'MVVNL',
      substationName: 'Gosainganj 33/11 kV Substation',
      feederOrTransformerName: '100 kVA Transformer - Ward 4',
      consumerNumber: '098765432112'
    };
    const diagnosis = {
      isRural: true,
      scopeLabel: 'Distribution Transformer (DT) Failure / Oil Leak / Burnt Coils',
      reportedDurationHours: 72,
      prescribedSlaHours: 48,
      isSlaBreached: true,
      overdueHours: 24,
      statutoryCompensationEligible: true
    };
    const cluster = { totalConsumersReported: 4 };

    const dossier = exportOutageGrievanceDossier(consumer, diagnosis, cluster);
    expect(dossier).toContain('# Statutory Grievance: Persistent Power Outage & SLA Breach');
    expect(dossier).toContain('Madhyanchal Vidyut Vitaran Nigam Ltd');
    expect(dossier).toContain('UPPCL-****-2112');
    expect(dossier).toContain('SLA BREACHED by 24 Hours');
    expect(dossier).toContain('Consumer Grievance Redressal Forum (CGRF');
    expect(dossier).toContain('Privacy Guard');
  });

  it('should retrieve UPPCL consumer FAQs and electrical safety norms', async () => {
    const { getElectricityFaqs, getElectricalSafetyNorms } = await import('./upElectricityOutageService');
    const faqs = getElectricityFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].a).toContain('dial 1912');
    expect(faqs[1].a).toContain('entirely at UPPCL expense');

    const norms = getElectricalSafetyNorms();
    expect(norms.length).toBeGreaterThanOrEqual(4);
    expect(norms.some(n => n.includes('11 kV'))).toBe(true);
    expect(norms.some(n => n.includes('Earth Leakage Circuit Breaker'))).toBe(true);
  });

  it('should list standard transformer capacity slabs', async () => {
    const { getTransformerCapacitySlabs } = await import('./upElectricityOutageService');
    const slabs = getTransformerCapacitySlabs();
    expect(slabs.length).toBeGreaterThanOrEqual(4);
    expect(slabs.some(s => s.capacityKva === 25)).toBe(true);
    expect(slabs.some(s => s.capacityKva === 100)).toBe(true);
  });
});
