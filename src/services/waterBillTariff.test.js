import {
  calculateTotalBill,
  calculateVariableCharge,
  compareBillPeriods,
  formatRupee,
  formatLiters,
  isReadingEstimated,
  listAvailableTariffs,
  validateBillInput,
  PMC_TARIFF,
  DJB_TARIFF,
  BWSSB_TARIFF,
  GENERIC_ULB_TARIFF,
  getTariffConfig,
  DEFAULT_SLAB_STRUCTURE,
} from './waterBillTariff';

import { describe, it, expect, beforeEach } from 'vitest';

describe('Water Bill Tariff Service', () => {
  beforeEach(() => {
    // vitest handles test isolation automatically
  });

  const approx = (a, b, delta = 0.01) => Math.abs(a - b) < delta;

  describe('formatRupee', () => {
    it('formats a number as rupees with 2 decimal places', () => {
      expect(formatRupee(1234.56)).toBe('₹1,234.56');
    });

    it('formats a whole number', () => {
      expect(formatRupee(100)).toBe('₹100.00');
    });

    it('formats zero', () => {
      expect(formatRupee(0)).toBe('₹0.00');
    });

    it('formats a large number', () => {
      expect(formatRupee(99999.99)).toBe('₹99,999.99');
    });
  });

  describe('formatLiters', () => {
    it('formats liters in liters', () => {
      expect(formatLiters(500)).toBe('500 L');
    });

    it('formats liters in kiloliters', () => {
      expect(formatLiters(1500)).toBe('1.50 KL');
    });

    it('formats liters in megaliters', () => {
      expect(formatLiters(1500000)).toBe('1.50 ML');
    });

    it('formats zero liters', () => {
      expect(formatLiters(0)).toBe('0 L');
    });
  });

  describe('isReadingEstimated', () => {
    it('returns false for actual reading', () => {
      expect(isReadingEstimated({ readingType: 'actual' })).toEqual({
        isEstimated: false,
        reason: 'Actual meter reading',
      });
    });

    it('returns true for estimated reading', () => {
      expect(isReadingEstimated({ readingType: 'estimated' })).toEqual({
        isEstimated: true,
        reason: 'Marked as estimated reading',
      });
    });

    it('returns false when no bill data provided', () => {
      expect(isReadingEstimated({})).toEqual({
        isEstimated: false,
        reason: 'No bill data provided',
      });
    });
  });

  describe('validateBillInput', () => {
    it('validates a valid bill input', () => {
      const result = validateBillInput({
        boardKey: 'PMC_PUNE',
        consumptionLiters: 1500,
        fixedCharge: 50,
        arrears: 0,
        adjustment: 0,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid boardKey', () => {
      const result = validateBillInput({
        boardKey: 'INVALID_BOARD',
        consumptionLiters: 1500,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid boardKey');
    });

    it('rejects negative consumption', () => {
      const result = validateBillInput({
        boardKey: 'PMC_PUNE',
        consumptionLiters: -100,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('consumptionLiters must be a non-negative number');
    });

    it('rejects missing consumption', () => {
      const result = validateBillInput({
        boardKey: 'PMC_PUNE',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('consumptionLiters is required');
    });

    it('accepts missing optional fields', () => {
      const result = validateBillInput({
        boardKey: 'PMC_PUNE',
        consumptionLiters: 1500,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('listAvailableTariffs', () => {
    it('returns list of available tariff configurations', () => {
      const tariffs = listAvailableTariffs();
      expect(tariffs).toHaveLength(4);
      expect(tariffs.some((t) => t.boardKey === 'PMC_PUNE')).toBe(true);
      expect(tariffs.some((t) => t.boardKey === 'DJB_DELHI')).toBe(true);
      expect(tariffs.some((t) => t.boardKey === 'BWSSB_BENGALURU')).toBe(true);
      expect(tariffs.some((t) => t.boardKey === 'GENERIC_ULB')).toBe(true);
    });
  });

  describe('getTariffConfig', () => {
    it('returns PMC tariff config', () => {
      const config = getTariffConfig('PMC_PUNE');
      expect(config.boardKey).toBe('PMC_PUNE');
      expect(config.tariffVersion).toBe('2.3.0');
      expect(config.fixedChargePerPeriod).toBe(50);
    });

    it('returns DJB tariff config', () => {
      const config = getTariffConfig('DJB_DELHI');
      expect(config.boardKey).toBe('DJB_DELHI');
      expect(config.tariffVersion).toBe('3.1.0');
    });

    it('returns BWSSB tariff config', () => {
      const config = getTariffConfig('BWSSB_BENGALURU');
      expect(config.boardKey).toBe('BWSSB_BENGALURU');
      expect(config.tariffVersion).toBe('2.0.0');
    });

    it('returns generic ULB config for unknown board key', () => {
      const config = getTariffConfig('UNKNOWN_BOARD');
      expect(config.boardKey).toBe('GENERIC_ULB');
    });
  });

  describe('calculateVariableCharge', () => {
    it('calculates variable charge for consumption within slab1', () => {
      const result = calculateVariableCharge(500); // 500L in slab1 (0-1000L)
      // 500L * 2 paise/L = 1000 paise = ₹10.00 exactly
      // Use approx for floating-point tolerance in vitest environment
      expect(approx(result.totalVariableCharge, 10, 0.01)).toBe(true);
      expect(result.slabBreakdown.length).toBe(1);
      expect(result.slabBreakdown[0].litersInSlab).toBe(500);
    });

    it('calculates variable charge for consumption across slabs', () => {
      const result = calculateVariableCharge(3500); // 3500L crosses all 3 slabs
      expect(result.totalVariableCharge).toBeGreaterThan(0);
      expect(result.slabBreakdown.length).toBe(3);
      // Accept floating-point precision of 0.01
      expect(approx(result.totalVariableCharge, 135, 0.01)).toBe(true);
    });

    it('calculates variable charge for exact slab boundary', () => {
      const result = calculateVariableCharge(1000); // exactly at slab1 boundary
      expect(result.totalVariableCharge).toBe(20); // 1000L * 2 paise/L = ₹20
      expect(result.slabBreakdown[0].litersInSlab).toBe(1000);
    });

    it('calculates variable charge for slab2 boundary', () => {
      const result = calculateVariableCharge(3000); // exactly at slab2 boundary
      // (1000 * 2) + (2000 * 4) paise = 2000 + 8000 = 10000 paise = ₹100
      expect(approx(result.totalVariableCharge, 100, 0.01)).toBe(true);
      const slab2 = result.slabBreakdown[1];
      expect(slab2.litersInSlab).toBe(2000); // 1001-3000 = 2000L
    });

    it('calculates variable charge for consumption in slab3', () => {
      const result = calculateVariableCharge(4000); // 4000L
      // 1000*2 + 2000*4 + 1000*7 = 2000 + 8000 + 7000 = 17000 paise = ₹170
      expect(approx(result.totalVariableCharge, 170, 0.01)).toBe(true);
    });
  });

  describe('calculateTotalBill', () => {
    it('calculates total bill with default parameters', () => {
      const result = calculateTotalBill({ consumptionLiters: 1500 });
      expect(result.consumptionLiters).toBe(1500);
      expect(result.tariffVersion).toBe('2.3.0');
      expect(result.boardKey).toBe('PMC_PUNE');
      expect(result.variableCharge).toBeGreaterThan(0);
      expect(result.fixedCharge).toBe(50);
      expect(result.totalPayable).toBeGreaterThan(0);
      expect(result.totalBeforeTax).toBeGreaterThan(0);
    });

    it('calculates total bill with all parameters', () => {
      const result = calculateTotalBill({
        consumptionLiters: 3500,
        fixedCharge: 75,
        arrears: 200,
        adjustment: -50,
        tariffVersion: '3.1.0',
        boardKey: 'DJB_DELHI',
      });
      expect(result.consumptionLiters).toBe(3500);
      expect(result.boardKey).toBe('DJB_DELHI');
      expect(result.tariffVersion).toBe('3.1.0');
      expect(result.fixedCharge).toBe(75);
      expect(result.arrears).toBe(200);
      expect(result.adjustment).toBe(-50);
      expect(result.totalPayable).toBeGreaterThan(0);
    });

    it('includes slab breakdown in results', () => {
      const result = calculateTotalBill({ consumptionLiters: 3500 });
      expect(Array.isArray(result.variableSlabBreakdown)).toBe(true);
      expect(result.variableSlabBreakdown.length).toBe(3);
    });

    it('includes source reference', () => {
      const result = calculateTotalBill({ consumptionLiters: 1500 });
      expect(result.sourceReference).toBeDefined();
      expect(result.sourceReference.boardKey).toBe('PMC_PUNE');
      expect(result.sourceReference.tariffVersion).toBe('2.3.0');
    });

    it('includes notes about calculation', () => {
      const result = calculateTotalBill({ consumptionLiters: 1500 });
      expect(result.notes).toBeDefined();
      expect(result.notes.variableCalculation).toBeDefined();
      expect(result.notes.arrearsLabel).toBeDefined();
      expect(result.notes.adjustmentLabel).toBeDefined();
    });
  });

  describe('compareBillPeriods', () => {
    it('compares two bill periods with different consumption', () => {
      const result = compareBillPeriods({
        period1Consumption: 1000,
        period2Consumption: 2000,
      });
      expect(result.consumptionDiff).toBe(1000);
      expect(result.diffDirection).toBe('increase');
      expect(result.bill1).toBeDefined();
      expect(result.bill2).toBeDefined();
      expect(result.chargeDiff).toBeDefined();
      expect(result.checklistItems).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
    });

    it('compares two bill periods with same consumption', () => {
      const result = compareBillPeriods({
        period1Consumption: 1500,
        period2Consumption: 1500,
      });
      expect(result.consumptionDiff).toBe(0);
      expect(result.diffDirection).toBe('increase'); // 0 >= 0
      expect(result.chargeDiff).toBe(0);
    });

    it('generates checklist items for all categories', () => {
      const result = compareBillPeriods({
        period1Consumption: 500,
        period2Consumption: 1500,
      });
      const categories = result.checklistItems.map((item) => item.category);
      expect(categories).toContain('consumption');
      expect(categories).toContain('charges');
      expect(categories).toContain('arrears');
      expect(categories).toContain('adjustments');
    });

    it('marks critical items for large consumption changes', () => {
      const result = compareBillPeriods({
        period1Consumption: 100,
        period2Consumption: 2000,
      });
      const criticalItems = result.checklistItems.filter((item) => item.isCritical);
      expect(criticalItems.length).toBeGreaterThan(0);
    });
  });
});
