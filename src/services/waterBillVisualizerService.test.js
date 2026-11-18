import { describe, it, expect, beforeEach } from 'vitest';
import {
  MeterReading,
  BillingPeriod,
  SlabCalculationResult,
  WaterBillChargeComposition,
  DiscrepancyItem,
  PeriodComparisonResult,
  WaterBillVisualizerService,
  TARIFF_SLABS,
  TARIFF_VERSIONS,
} from './waterBillVisualizerService.js';

describe('Municipal Water Bill Visualizer Service', () => {
  // -------------------------------------------------------------------------
  // MeterReading
  // -------------------------------------------------------------------------
  describe('MeterReading', () => {
    it('creates a reading with actual type', () => {
      const reading = new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'actual',
        unitsConsumed: 4500,
        source: 'manual',
      });
      expect(reading.readingType).toBe('actual');
      expect(reading.unitsConsumed).toBe(4500);
      expect(reading.id).toBeDefined();
    });

    it('creates a reading with estimated type', () => {
      const reading = new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'estimated',
        unitsConsumed: 5200,
        source: 'ocr',
        isOCRSuggestion: true,
      });
      expect(reading.readingType).toBe('estimated');
      expect(reading.isOCRSuggestion).toBe(true);
      expect(reading.isEstimated()).toBe(true);
    });

    it('calculates net consumption from opening/closing readings', () => {
      const reading = new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'actual',
        openingReading: 12000,
        closingReading: 16500,
        source: 'manual',
      });
      const net = reading.calculateNetConsumption();
      expect(net).toBe(4500);
    });

    it('returns reading type label', () => {
      const actualReading = new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'actual',
        source: 'manual',
      });
      expect(actualReading.getReadingTypeLabel()).toBe('Actual reading');

      const estimatedReading = new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'estimated',
        source: 'ocr',
        isOCRSuggestion: true,
      });
      expect(estimatedReading.getReadingTypeLabel()).toBe('Estimated (AI suggestion)');
    });

    it('isOCRSuggestionUnconfirmed returns false when not an OCR suggestion', () => {
      const reading = new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'actual',
        source: 'manual',
      });
      expect(reading.isOCRSuggestionUnconfirmed()).toBe(false);
    });

    it('isOCRSuggestionUnconfirmed returns true for unconfirmed OCR', () => {
      const reading = new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'estimated',
        unitsConsumed: 5200,
        source: 'ocr',
        isOCRSuggestion: true,
      });
      expect(reading.isOCRSuggestionUnconfirmed()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // BillingPeriod
  // -------------------------------------------------------------------------
  describe('BillingPeriod', () => {
    it('creates a billing period and computes duration', () => {
      const reading = new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'actual',
        unitsConsumed: 4500,
      });
      const period = new BillingPeriod({
        periodStart: '2024-01-01',
        periodEnd: '2024-03-31',
        reading,
        tariffVersion: 'DJB-2024',
      });
      expect(period.periodStart).toBe('2024-01-01');
      expect(period.periodEnd).toBe('2024-03-31');
      expect(period.tariffVersion).toBe('DJB-2024');
      expect(period.getDurationDays()).toBe(90);
    });

    it('isValid returns true for valid period', () => {
      const reading = new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'actual',
      });
      const period = new BillingPeriod({
        periodStart: '2024-01-01',
        periodEnd: '2024-03-31',
        reading,
      });
      expect(period.isValid()).toBe(true);
    });

    it('isValid returns false when end before start', () => {
      const reading = new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'actual',
      });
      const period = new BillingPeriod({
        periodStart: '2024-03-31',
        periodEnd: '2024-01-01',
        reading,
      });
      expect(period.isValid()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // SlabCalculationResult
  // -------------------------------------------------------------------------
  describe('SlabCalculationResult', () => {
    const sampleSlabs = [
      { minLiters: 0, maxLiters: 1000, ratePerLiter: 2.5 },
      { minLiters: 1000, maxLiters: 3000, ratePerLiter: 5.0 },
      { minLiters: 3000, maxLiters: null, ratePerLiter: 8.0 },
    ];

    it('computes total charge for consumption within first slab', () => {
      const result = new SlabCalculationResult({
        consumption: 500,
        slabs: sampleSlabs,
        tariffVersion: 'DJB-2024',
      });
      expect(result.totalCharge).toBe(500 * 2.5); // 1,250
      expect(result.slabBreakdown.length).toBe(1);
      expect(result.slabBreakdown[0].consumedInSlab).toBe(500);
    });

    it('computes total charge for consumption across multiple slabs', () => {
      const result = new SlabCalculationResult({
        consumption: 2500,
        slabs: sampleSlabs,
        tariffVersion: 'DJB-2024',
      });
      // First 1000 L @ 2.5 = 2,500
      // Next 1500 L @ 5.0 = 7,500
      // Total = 10,000
      expect(result.totalCharge).toBe(10000);
      expect(result.slabBreakdown.length).toBe(2); // only 2 slabs have consumption
      // First slab should have 1000 L
      expect(result.slabBreakdown[0].consumedInSlab).toBe(1000);
      // Second slab should have 1500 L
      expect(result.slabBreakdown[1].consumedInSlab).toBe(1500);
    });

    it('computes total charge for consumption exceeding all slabs', () => {
      const result = new SlabCalculationResult({
        consumption: 5000,
        slabs: sampleSlabs,
        tariffVersion: 'DJB-2024',
      });
      // First 1000 L @ 2.5 = 2,500
      // Next 2000 L @ 5.0 = 10,000
      // Remaining 2000 L at last rate 8.0 = 16,000
      // Total = 28,500
      expect(result.totalCharge).toBe(28500);
      // Consumption spans all 3 slabs
      expect(result.slabBreakdown.length).toBe(3);
    });

    it('computes effective rate', () => {
      const result = new SlabCalculationResult({
        consumption: 2500,
        slabs: sampleSlabs,
        tariffVersion: 'DJB-2024',
      });
      // Effective rate = 10000 / 2500 = 4.0
      expect(result.effectiveRate).toBeCloseTo(4.0, 3);
    });

    it('formats slab range correctly', () => {
      const result = new SlabCalculationResult({
        consumption: 500,
        slabs: [{ minLiters: 0, maxLiters: 1000, ratePerLiter: 2.5 }],
        tariffVersion: 'DJB-2024',
      });
      expect(result.slabBreakdown[0].slabRange).toBe('0-1000 liters');
    });

    it('handles zero consumption', () => {
      const result = new SlabCalculationResult({
        consumption: 0,
        slabs: sampleSlabs,
        tariffVersion: 'DJB-2024',
      });
      expect(result.totalCharge).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // WaterBillChargeComposition
  // -------------------------------------------------------------------------
  describe('WaterBillChargeComposition', () => {
    it('recalculates total from line items', () => {
      const composition = new WaterBillChargeComposition({
        fixedCharges: 50,
        consumptionCharge: 1250,
        arrears: 30,
        adjustments: -10,
      });
      expect(composition.recalculateTotal()).toBe(1320);
      expect(composition.total).toBe(1320);
    });

    it('validates total reconciles', () => {
      const composition = new WaterBillChargeComposition({
        fixedCharges: 50,
        consumptionCharge: 1250,
        arrears: 30,
        adjustments: -10,
        total: 1320,
      });
      expect(composition.validateTotalReconciles()).toBe(true);
    });

    it('validates total reconciles with tolerance', () => {
      const composition = new WaterBillChargeComposition({
        fixedCharges: 50,
        consumptionCharge: 1250,
        arrears: 30,
        adjustments: -10,
        total: 1320.01, // within 0.01 tolerance
      });
      expect(composition.validateTotalReconciles(0.01)).toBe(true);
    });

    it('validates total reconciles fails with large deviation', () => {
      const composition = new WaterBillChargeComposition({
        fixedCharges: 50,
        consumptionCharge: 1250,
        total: 9999, // wildly off
      });
      expect(composition.validateTotalReconciles()).toBe(false);
    });

    it('formats toString correctly', () => {
      const composition = new WaterBillChargeComposition({
        fixedCharges: 50,
        consumptionCharge: 1250,
        arrears: 30,
        adjustments: -10,
        total: 1320,
      });
      const str = composition.toString();
      expect(str).toContain('Fixed charges: ₹50.00');
      // toFixed(2) does not add thousands separators
      expect(str).toContain('Consumption charge: ₹1250.00');
      expect(str).toContain('Total: ₹1320.00');
    });

    it('handles zero amounts', () => {
      const composition = new WaterBillChargeComposition({
        fixedCharges: 0,
        consumptionCharge: 0,
        arrears: 0,
        adjustments: 0,
        total: 0,
      });
      expect(composition.validateTotalReconciles()).toBe(true);
      expect(composition.toString()).toContain('Total: ₹0.00');
    });
  });

  // -------------------------------------------------------------------------
  // DiscrepancyItem
  // -------------------------------------------------------------------------
  describe('DiscrepancyItem', () => {
    it('creates a discrepancy item', () => {
      const item = new DiscrepancyItem({
        field: 'consumption',
        description: 'Water consumption',
        oldValue: 4500,
        newValue: 5200,
        reason: 'Increase detected',
      });
      expect(item.field).toBe('consumption');
      expect(item.description).toBe('Water consumption');
      expect(item.oldValue).toBe(4500);
      expect(item.newValue).toBe(5200);
      expect(item.reason).toBe('Increase detected');
      expect(item.userConfirmed).toBe(false);
      expect(item.id).toBeDefined();
    });

    it('isResolved returns false by default', () => {
      const item = new DiscrepancyItem({ field: 'test' });
      expect(item.isResolved()).toBe(false);
    });

    it('isResolved returns true when userConfirmed', () => {
      const item = new DiscrepancyItem({
        field: 'test',
        userConfirmed: true,
      });
      expect(item.isResolved()).toBe(true);
    });

    it('toString formats correctly', () => {
      const item = new DiscrepancyItem({
        field: 'consumption',
        description: 'Water consumption',
        oldValue: 4500,
        newValue: 5200,
        reason: 'Increase detected',
      });
      expect(item.toString()).toContain('Water consumption');
      expect(item.toString()).toContain('changed from 4500 to 5200');
    });
  });

  // -------------------------------------------------------------------------
  // PeriodComparisonResult
  // -------------------------------------------------------------------------
  describe('PeriodComparisonResult', () => {
    const periodA = new BillingPeriod({
      periodStart: '2024-01-01',
      periodEnd: '2024-03-31',
      reading: new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'actual',
        unitsConsumed: 4500,
      }),
      tariffVersion: 'DJB-2024',
    });

    const periodB = new BillingPeriod({
      periodStart: '2023-01-01',
      periodEnd: '2023-03-31',
      reading: new MeterReading({
        readingDate: '2023-03-15',
        readingType: 'actual',
        unitsConsumed: 3800,
      }),
      tariffVersion: 'DJB-2024',
    });

    it('compares periods with consumption difference', () => {
      const comparison = PeriodComparisonResult.comparePeriods(periodA, periodB, {
        compareConsumption: true,
        compareCharges: false,
      });
      expect(comparison.discrepancies.length).toBeGreaterThan(0);
      expect(comparison.discrepancies[0].field).toBe('consumption');
      expect(comparison.consumptionDelta).toBe(700); // 4500 - 3800
    });

    it('compares periods with same consumption', () => {
      const periodASame = new BillingPeriod({
        periodStart: '2024-01-01',
        periodEnd: '2024-03-31',
        reading: new MeterReading({
          readingDate: '2024-03-15',
          readingType: 'actual',
          unitsConsumed: 4500,
        }),
        tariffVersion: 'DJB-2024',
      });
      const periodBSame = new BillingPeriod({
        periodStart: '2023-01-01',
        periodEnd: '2023-03-31',
        reading: new MeterReading({
          readingDate: '2023-03-15',
          readingType: 'actual',
          unitsConsumed: 4500,
        }),
        tariffVersion: 'DJB-2024',
      });
      const comparison = PeriodComparisonResult.comparePeriods(periodASame, periodBSame, {
        compareConsumption: true,
        compareCharges: false,
      });
      expect(comparison.discrepancies.length).toBe(0);
      expect(comparison.consumptionDelta).toBe(0);
    });

    it('compares periods with estimated readings flag', () => {
      const periodAEst = new BillingPeriod({
        periodStart: '2024-01-01',
        periodEnd: '2024-03-31',
        reading: new MeterReading({
          readingDate: '2024-03-15',
          readingType: 'estimated',
          unitsConsumed: 4500,
        }),
        tariffVersion: 'DJB-2024',
      });
      const periodBActual = new BillingPeriod({
        periodStart: '2023-01-01',
        periodEnd: '2023-03-31',
        reading: new MeterReading({
          readingDate: '2023-03-15',
          readingType: 'actual',
          unitsConsumed: 3800,
        }),
        tariffVersion: 'DJB-2024',
      });
      const comparison = PeriodComparisonResult.comparePeriods(periodAEst, periodBActual, {
        compareConsumption: true,
        compareCharges: false,
      });
      // Should include a reason about estimated readings
      expect(comparison.discrepancies[0].reason).toContain('estimated');
    });

    it('comparison result has ID', () => {
      const comparison = PeriodComparisonResult.comparePeriods(periodA, periodB, {
        compareConsumption: true,
        compareCharges: false,
      });
      expect(comparison.id).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // WaterBillVisualizerService
  // -------------------------------------------------------------------------
  describe('WaterBillVisualizerService', () => {
    let service;

    beforeEach(() => {
      service = new WaterBillVisualizerService();
    });

    it('creates a session', () => {
      const sessionId = service.createSession();
      const retrieved = service.getSession(sessionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved.id).toBe(sessionId);
      expect(retrieved.isOfficialStatus).toBe(false); // distinguishes from official gov status
    });

    it('imports bill data with consent', () => {
      const result = service.importBillData({
        consumerNumber: 'CNC123456',
        lineItems: [
          { label: 'Water Consumption', amount: 1250 },
          { label: 'Service Charge', amount: 50 },
        ],
        consent: true,
      });
      expect(result.lineItems.length).toBe(2);
      expect(result.consentRequired).toBe(false);
      expect(result.errors).toBeNull();
    });

    it('imports bill data without consent marks consentRequired', () => {
      const result = service.importBillData({
        lineItems: [
          { label: 'Water Consumption', amount: 1250 },
        ],
        // consent not provided
      });
      expect(result.consentRequired).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('imports bill data with errors', () => {
      const result = service.importBillData({
        lineItems: [
          { /* missing description and amount */ }
        ],
      });
      expect(result.errors.length).toBeGreaterThan(0);
      // consentRequired is true when payload.consent is not explicitly true
      expect(result.consentRequired).toBe(true);
    });

    it('parses OCR suggestions', () => {
      const ocrResults = [
        {
          readingDate: '2024-03-15',
          readingType: 'actual',
          unitsConsumed: 4500,
          openingReading: 12000,
          closingReading: 16500,
        },
      ];
      const readings = service.parseOCRSuggestions(ocrResults);
      expect(readings.length).toBe(1);
      expect(readings[0].isOCRSuggestion).toBe(true);
      expect(readings[0].isEstimated()).toBe(false);
      expect(readings[0].id).toBeDefined();
    });

    it('parses OCR suggestions with estimated flag', () => {
      const ocrResults = [
        {
          readingDate: '2024-03-15',
          readingType: 'estimated',
          unitsConsumed: 5200,
        },
      ];
      const readings = service.parseOCRSuggestions(ocrResults);
      expect(readings.length).toBe(1);
      expect(readings[0].isEstimated()).toBe(true);
      expect(readings[0].isOCRSuggestion).toBe(true);
    });

    it('calculates charge composition', () => {
      const reading = new MeterReading({
        readingDate: '2024-03-15',
        readingType: 'actual',
        unitsConsumed: 2500,
      });
      const period = new BillingPeriod({
        periodStart: '2024-01-01',
        periodEnd: '2024-03-31',
        reading,
        tariffVersion: 'DJB-2024',
      });
      const composition = service.calculateChargeComposition({ period });
      expect(composition).toBeInstanceOf(Object);
      expect(composition.total).toBeDefined();
      expect(composition.fixedCharges).toBe(50); // generic default
      expect(composition.validateTotalReconciles()).toBe(true);
    });

    it('generates discrepancy checklist', () => {
      const periodA = new BillingPeriod({
        periodStart: '2024-01-01',
        periodEnd: '2024-03-31',
        reading: new MeterReading({
          readingDate: '2024-03-15',
          readingType: 'actual',
          unitsConsumed: 4500,
        }),
        tariffVersion: 'DJB-2024',
      });
      const periodB = new BillingPeriod({
        periodStart: '2023-01-01',
        periodEnd: '2023-03-31',
        reading: new MeterReading({
          readingDate: '2023-03-15',
          readingType: 'actual',
          unitsConsumed: 3800,
        }),
        tariffVersion: 'DJB-2024',
      });

      const comparison = PeriodComparisonResult.comparePeriods(periodA, periodB, {
        compareConsumption: true,
        compareCharges: true,
      });
      const checklist = service.generateDiscrepancyChecklist(comparison);
      expect(checklist.length).toBeGreaterThan(0);
      expect(checklist[0]).toBeInstanceOf(DiscrepancyItem);
    });

    it('confirms discrepancy (no-op when not found, but does not throw)', () => {
      const result = service.confirmDiscrepancy('non-existent-id');
      expect(result).toBe(false); // not found, but no error thrown
    });

    it('gets data version', () => {
      const version = service.getDataVersion();
      expect(version).toHaveProperty('tariffVersion');
      expect(version).toHaveProperty('slabsVersion');
      expect(version).toHaveProperty('generatedAt');
    });
  });
});