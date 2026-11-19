import { describe, it, expect } from 'vitest';
import {
  SOP_COMPENSATION_BENCHMARKS,
  calculateSopCompensation,
  auditDisconnectionLegality,
  diagnoseDefectiveMeterAndBilling,
  generateCgrfPetition,
} from './electricityConsumerService.js';

describe('electricityConsumerService', () => {
  describe('Static Constants & Benchmarks', () => {
    it('defines SoP performance benchmarks under Rule 11', () => {
      expect(SOP_COMPENSATION_BENCHMARKS.SUPPLY_OUTAGE.permissibleHours).toBe(4);
      expect(SOP_COMPENSATION_BENCHMARKS.SUPPLY_OUTAGE.ratePerHourInr).toBe(10);
      expect(SOP_COMPENSATION_BENCHMARKS.TRANSFORMER_FAILURE.ratePerDayInr).toBe(150);
      expect(SOP_COMPENSATION_BENCHMARKS.NEW_CONNECTION_DELAY.ratePerWeekInr).toBe(500);
      expect(SOP_COMPENSATION_BENCHMARKS.METER_REPLACEMENT_DELAY.ratePerDayInr).toBe(50);
    });
  });

  describe('calculateSopCompensation', () => {
    it('returns zero claim when service is delivered within statutory timelines', () => {
      const result = calculateSopCompensation({
        outageDurationHours: 3, // under 4h limit
        transformerFailureDays: 1, // 24h urban limit
        isRuralArea: false,
        newConnectionDelayDays: 0,
        meterDelayDays: 0,
        voltageDelayDays: 0,
      });

      expect(result.hasClaim).toBe(false);
      expect(result.totalCompensationInr).toBe(0);
      expect(result.breakdown.length).toBe(0);
    });

    it('accurately computes multi-failure compensation credits', () => {
      const result = calculateSopCompensation({
        outageDurationHours: 28, // 28 - 4 = 24 excess hours -> max(240, 100) = 240
        transformerFailureDays: 4, // 4 - 1 = 3 days urban -> 3 * 150 = 450
        isRuralArea: false,
        newConnectionDelayDays: 14, // 2 weeks * 500 = 1000
        meterDelayDays: 3, // 3 * 50 = 150
        voltageDelayDays: 2, // 2 * 100 = 200
      });

      expect(result.hasClaim).toBe(true);
      expect(result.totalCompensationInr).toBe(240 + 450 + 1000 + 150 + 200);
      expect(result.breakdown.length).toBe(5);
    });
  });

  describe('auditDisconnectionLegality', () => {
    it('confirms legality when 15 clear days notice served in normal daytime', () => {
      const result = auditDisconnectionLegality({
        noticeDaysGiven: 16,
        writtenNoticeServed: true,
        disconnectedAfterOnePm: false,
        disconnectedOnFridayOrHoliday: false,
        hasDisputedProvisionalBill: false,
        depositedProtestAmount: false,
      });

      expect(result.isIllegalDisconnection).toBe(false);
      expect(result.severity).toBe('LEGAL');
      expect(result.violations.length).toBe(0);
    });

    it('identifies illegal disconnections violating Section 56(1) and holiday bars', () => {
      const result = auditDisconnectionLegality({
        noticeDaysGiven: 5, // < 15 days
        writtenNoticeServed: true,
        disconnectedAfterOnePm: true,
        disconnectedOnFridayOrHoliday: true,
        hasDisputedProvisionalBill: true,
        depositedProtestAmount: true,
      });

      expect(result.isIllegalDisconnection).toBe(true);
      expect(result.severity).toBe('HIGHLY_ILLEGAL');
      expect(result.violations.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('diagnoseDefectiveMeterAndBilling', () => {
    it('detects erratic consumption spike over historical baseline', () => {
      const result = diagnoseDefectiveMeterAndBilling({
        historicalAverageUnits: 150,
        disputedBillUnits: 650, // > 4x spike
        unitTariffInr: 8,
      });

      expect(result.isErraticSpike).toBe(true);
      expect(result.unitSpikeRatio).toBeGreaterThan(4);
      expect(result.excessUnits).toBe(500);
      expect(result.estimatedRefundInr).toBe(4000);
    });

    it('calculates fast-meter refund when laboratory test shows error > 2%', () => {
      const result = diagnoseDefectiveMeterAndBilling({
        historicalAverageUnits: 200,
        disputedBillUnits: 800,
        unitTariffInr: 10,
        meterTestBenchRequested: true,
        meterTestErrorPercentage: 15, // 15% fast running meter
      });

      expect(result.isMeterFast).toBe(true);
      expect(result.excessUnits).toBeGreaterThan(0);
      expect(result.estimatedRefundInr).toBeGreaterThan(0);
    });
  });

  describe('generateCgrfPetition', () => {
    it('generates formal petition addressed to CGRF with statutory grounds', () => {
      const petition = generateCgrfPetition({
        consumerName: 'Kavita Sundaram',
        caNumber: 'CA-9920148',
        meterNumber: 'MTR-88129',
        sanctionedLoadKw: '5 kW Domestic',
        consumerAddress: 'No 45, Indiranagar',
        contactPhone: '9845098450',
        discomName: 'BESCOM',
        divisionOffice: 'East Sub-Division',
        districtName: 'Bengaluru',
        stateName: 'Karnataka',
        sopData: {
          hasClaim: true,
          totalCompensationInr: 1850,
          breakdown: [{ category: 'Power Supply Outage Delay', excessDuration: '24 hours' }],
        },
        disconnectionData: {
          isIllegalDisconnection: true,
          violations: [{ provision: 'Section 56(1)', name: 'Lack of 15-day notice', impact: 'Illegal action' }],
        },
        meterData: {
          isErraticSpike: true,
          unitSpikeRatio: 3.5,
          excessUnits: 450,
          estimatedRefundInr: 3600,
        },
        grievanceDescription: 'Disconnected supply without notice and billed 3.5x regular units',
      });

      expect(petition).toContain('SECTION 42(5) OF THE ELECTRICITY ACT, 2003');
      expect(petition).toContain('Kavita Sundaram');
      expect(petition).toContain('CA-9920148');
      expect(petition).toContain('BESCOM');
      expect(petition).toContain('INR 1,850');
      expect(petition).toContain('INR 3,600');
      expect(petition).toContain('Section 142');
    });
  });
});
