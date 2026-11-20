import { describe, it, expect } from 'vitest';
import {
  assessCounterCongestion,
  evaluateHealthObservationFreshness,
  aggregateHealthQueueObservations,
  exportHealthQueueRepresentation,
  UP_HEALTH_FACILITY_TIERS,
  COUNTER_TYPES,
  UP_HEALTH_ESCALATION_OFFICERS
} from './upHealthQueueService';

describe('upHealthQueueService', () => {
  it('should define health facility tiers, counters, and escalation hierarchy', () => {
    expect(UP_HEALTH_FACILITY_TIERS.PHC.code).toBe('PHC');
    expect(UP_HEALTH_FACILITY_TIERS.CHC.doctorNorm).toContain('Specialists');
    expect(COUNTER_TYPES.OPD_REGISTRATION.normWaitMinutes).toBe(20);
    expect(UP_HEALTH_ESCALATION_OFFICERS.length).toBe(3);
    expect(UP_HEALTH_ESCALATION_OFFICERS[1].title).toContain('Chief Medical Officer');
  });

  it('should detect severe congestion when queue wait exceeds twice the prescribed norm', () => {
    const counterData = {
      counterType: 'OPD_REGISTRATION',
      waitMinutes: 60, // norm is 20
      queueLengthPersons: 65,
      isOpen: true
    };

    const res = assessCounterCongestion(counterData);
    expect(res.isSevereCongestion).toBe(true);
    expect(res.statusLevel).toBe('HEAVILY_CONGESTED');
    expect(res.actionRequired).toContain('auxiliary ABHA digital queue counter');
  });

  it('should flag shuttered counter when closed during official OPD shift', () => {
    const counterData = {
      counterType: 'PHARMACY_DISPENSARY',
      isOpen: false
    };

    const res = assessCounterCongestion(counterData);
    expect(res.statusLevel).toBe('COUNTER_SHUTTERED');
    expect(res.isCounterOpen).toBe(false);
    expect(res.actionRequired).toContain('MOIC intervention needed');
  });

  it('should enforce strict 4-hour intra-day freshness decay', () => {
    const now = Date.now();
    const freshTime = new Date(now - 1.5 * 60 * 60 * 1000).toISOString(); // 1.5h ago
    const staleTime = new Date(now - 5 * 60 * 60 * 1000).toISOString(); // 5h ago

    const fresh = evaluateHealthObservationFreshness(freshTime);
    expect(fresh.isFresh).toBe(true);
    expect(fresh.ageHours).toBeCloseTo(1.5, 0);

    const stale = evaluateHealthObservationFreshness(staleTime);
    expect(stale.isFresh).toBe(false);
    expect(stale.statusNote).toContain('Stale Observation');
  });

  it('should aggregate community queue reports and verify consensus with 3+ reports', () => {
    const now = new Date().toISOString();
    const reports = [
      { reportedAt: now, isEssentialMedicineStockOut: true },
      { reportedAt: now, isEssentialMedicineStockOut: true },
      { reportedAt: now, isEssentialMedicineStockOut: false }
    ];

    const agg = aggregateHealthQueueObservations(reports);
    expect(agg.totalObservations).toBe(3);
    expect(agg.isVerifiedConsensus).toBe(true);
    expect(agg.hasSevereStockOutConsensus).toBe(true);
    expect(agg.priorityEscalationNeeded).toBe(true);
  });

  it('should export formatted representation memorandum for Chief Medical Superintendent', () => {
    const facility = {
      name: 'Mohanlalganj Community Health Centre',
      tier: 'CHC (30 Bedded)',
      blockOrTehsil: 'Mohanlalganj',
      district: 'Lucknow'
    };
    const congestion = {
      counterName: 'Free Medicine Dispensary (Dava Vitaran Kaksh)',
      statusLevel: 'HEAVILY_CONGESTED',
      estimatedWaitMinutes: 55,
      queueLengthPersons: 48,
      isCounterOpen: true,
      actionRequired: 'Deploy second counter'
    };
    const aggregate = {
      totalObservations: 4,
      hasSevereStockOutConsensus: true
    };

    const memo = exportHealthQueueRepresentation(facility, congestion, aggregate);
    expect(memo).toContain('# Public Health Counter Service & Availability Memorandum');
    expect(memo).toContain('Mohanlalganj Community Health Centre');
    expect(memo).toContain('Free Medicine Dispensary');
    expect(memo).toContain('UPMSCL');
    expect(memo).toContain('Patient Dignity & Clinical Privacy');
  });

  it('should retrieve health facility FAQs and essential diagnostics list', async () => {
    const { getHealthFacilityFaqs, getEssentialDiagnosticsList } = await import('./upHealthQueueService');
    const faqs = getHealthFacilityFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].a).toContain('free of cost');
    expect(faqs[1].q).toContain('ABHA Scan and Share');

    const tests = getEssentialDiagnosticsList();
    expect(tests.length).toBeGreaterThanOrEqual(5);
    expect(tests.some(t => t.includes('CBC'))).toBe(true);
    expect(tests.some(t => t.includes('Tuberculosis'))).toBe(true);
  });
});
