import { describe, it, expect } from 'vitest';
import {
  diagnoseHandpumpFault,
  aggregateHandpumpDowntimeReports,
  exportHandpumpGrievanceMemo,
  UP_HANDPUMP_MODELS,
  HANDPUMP_FAULT_CATEGORIES,
  UP_WATER_ESCALATION_OFFICERS
} from './upHandpumpRepairService';

describe('upHandpumpRepairService', () => {
  it('should list handpump models and fault categories', () => {
    expect(UP_HANDPUMP_MODELS.INDIA_MARK_II).toContain('India Mark-II');
    expect(HANDPUMP_FAULT_CATEGORIES.MECHANICAL_SURFACE.statutorySlaHours).toBe(48);
    expect(HANDPUMP_FAULT_CATEGORIES.WATER_TABLE_DEPLETED_OR_DRY.statutorySlaHours).toBe(720);
    expect(UP_WATER_ESCALATION_OFFICERS.length).toBe(3);
    expect(UP_WATER_ESCALATION_OFFICERS[1].designation).toContain('ADO');
  });

  it('should diagnose surface mechanical failure and calculate SLA breach', () => {
    const fault = {
      isWaterDriedOrSeasonallyDry: false,
      hasWaterDiscolorationOrSmell: false,
      isPlatformCrackedOrWaterlogged: false,
      isPumpDrawingAirOrNoWaterWhileHandleMoves: false,
      downtimeDays: 5 // > 2 days (48h)
    };

    const res = diagnoseHandpumpFault(fault);
    expect(res.faultCode).toBe('MECHANICAL_SURFACE');
    expect(res.statutorySlaDays).toBe(2);
    expect(res.isSlaBreached).toBe(true);
    expect(res.overdueDays).toBe(3);
    expect(res.technicalRemedy).toContain('Village Handpump Mechanic');
  });

  it('should diagnose cylinder and washer leakage failure', () => {
    const fault = {
      isPumpDrawingAirOrNoWaterWhileHandleMoves: true,
      downtimeDays: 2
    };

    const res = diagnoseHandpumpFault(fault);
    expect(res.faultCode).toBe('CYLINDER_AND_CONNECTING_ROD');
    expect(res.statutorySlaDays).toBe(3);
    expect(res.isSlaBreached).toBe(false);
  });

  it('should diagnose water table depletion requiring re-boring', () => {
    const fault = {
      isWaterDriedOrSeasonallyDry: true,
      downtimeDays: 35
    };

    const res = diagnoseHandpumpFault(fault);
    expect(res.faultCode).toBe('WATER_TABLE_DEPLETED_OR_DRY');
    expect(res.statutorySlaDays).toBe(30);
    expect(res.isSlaBreached).toBe(true);
    expect(res.overdueDays).toBe(5);
    expect(res.responsibleAuthority).toContain('Jal Nigam');
  });

  it('should aggregate household downtime reports and identify drinking water crisis', () => {
    const reports = [
      { handpumpId: 'HP-101', noAlternativeDrinkingWaterSource: true },
      { handpumpId: 'HP-101', noAlternativeDrinkingWaterSource: true },
      { handpumpId: 'HP-101', noAlternativeDrinkingWaterSource: false }
    ];

    const agg = aggregateHandpumpDowntimeReports(reports);
    expect(agg.totalHouseholdsReported).toBe(3);
    expect(agg.hasCommunityConsensus).toBe(true);
    expect(agg.isDrinkingWaterCrisis).toBe(true);
    expect(agg.urgencyPriority).toBe('CRITICAL_WATER_STRESS');
  });

  it('should export formatted representation memorandum for ADO (Panchayat)', () => {
    const details = {
      handpumpId: 'HP-UP-****-8812',
      majraOrHamlet: 'Purwa Tolla',
      gramPanchayat: 'Bheeti',
      block: 'Amethi',
      district: 'Amethi'
    };
    const diagnosis = {
      faultName: 'Subsurface Cylinder, Plunger Rod or Washer Failure',
      downtimeDaysRecorded: 6,
      statutorySlaDays: 3,
      isSlaBreached: true,
      overdueDays: 3,
      technicalRemedy: 'Lifting connecting rods and replacing rubber washers.',
      responsibleAuthority: 'Block Handpump Repair Gang / ADO (Panchayat)'
    };
    const community = { totalHouseholdsReported: 5, hasCommunityConsensus: true };

    const memo = exportHandpumpGrievanceMemo(details, diagnosis, community);
    expect(memo).toContain('# Public Handpump Repair Requisition & Downtime Escalation');
    expect(memo).toContain('Purwa Tolla');
    expect(memo).toContain('Bheeti');
    expect(memo).toContain('OVERDUE by 3 days');
    expect(memo).toContain('Assistant Development Officer (Panchayat)');
    expect(memo).toContain('Citizen Accountability');
  });

  it('should retrieve handpump maintenance FAQs and water testing parameters', async () => {
    const { getHandpumpFaqs, getWaterTestingParameters } = await import('./upHandpumpRepairService');
    const faqs = getHandpumpFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].a).toContain('15th Finance Commission');
    expect(faqs[1].a).toContain('Jal Sakhis');

    const params = getWaterTestingParameters();
    expect(params.length).toBeGreaterThanOrEqual(4);
    expect(params.some(p => p.parameter.includes('Iron'))).toBe(true);
    expect(params.some(p => p.parameter.includes('Fluoride'))).toBe(true);
  });

  it('should list standard India Mark-II spare parts catalogue', async () => {
    const { getHandpumpSparePartsCatalogue } = await import('./upHandpumpRepairService');
    const parts = getHandpumpSparePartsCatalogue();
    expect(parts.length).toBeGreaterThanOrEqual(4);
    expect(parts.some(p => p.includes('Bucket Washer'))).toBe(true);
    expect(parts.some(p => p.includes('Connecting Rod'))).toBe(true);
  });
});
