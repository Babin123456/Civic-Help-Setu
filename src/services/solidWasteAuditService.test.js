import { describe, it, expect } from 'vitest';
import {
  WASTE_DENSITY_METRICS,
  BWG_PREMISE_TYPES,
  NGT_ZONAL_BENCHES,
  evaluateBwgCompliance,
  calculateWasteTonnageAndNgtCompensation,
  evaluateCdWasteCompliance,
  generateRule15StatutoryNotice,
  generateNgtSection14Application,
} from './solidWasteAuditService.js';

describe('Solid Waste Audit Service (#878)', () => {
  describe('evaluateBwgCompliance', () => {
    it('identifies BWG by daily waste threshold (>= 100 kg/day)', () => {
      const res = evaluateBwgCompliance({
        premiseType: 'GATED_RESIDENTIAL_SOCIETY',
        dailyWasteKg: 150,
        builtUpAreaSqM: 3000,
        onSiteWetWasteProcessing: false,
      });

      expect(res.isBulkGenerator).toBe(true);
      expect(res.isBwgByWaste).toBe(true);
      expect(res.isBwgByArea).toBe(false);
      expect(res.isCompliant).toBe(false);
      expect(res.violations.some((v) => v.rule.includes('Rule 4(6)'))).toBe(true);
      expect(res.totalSpotFineExposureInrPerDay).toBeGreaterThan(0);
    });

    it('identifies BWG by campus area threshold (>= 5,000 sq.m)', () => {
      const res = evaluateBwgCompliance({
        premiseType: 'IT_TECH_PARK',
        dailyWasteKg: 60,
        builtUpAreaSqM: 8000,
        onSiteWetWasteProcessing: true,
        bioMethanationOrComposting: true,
        dryWasteChannelized: true,
        hazardousWasteSegregated: true,
      });

      expect(res.isBulkGenerator).toBe(true);
      expect(res.isBwgByWaste).toBe(false);
      expect(res.isBwgByArea).toBe(true);
      expect(res.isCompliant).toBe(true);
      expect(res.complianceScore).toBe(100);
      expect(res.totalSpotFineExposureInrPerDay).toBe(0);
    });

    it('handles non-bulk generators under Rule 4(1) standard segregation', () => {
      const res = evaluateBwgCompliance({
        premiseType: 'GATED_RESIDENTIAL_SOCIETY',
        dailyWasteKg: 40,
        builtUpAreaSqM: 1200,
        dryWasteChannelized: true,
        hazardousWasteSegregated: true,
      });

      expect(res.isBulkGenerator).toBe(false);
      expect(res.isCompliant).toBe(true);
      expect(res.totalSpotFineExposureInrPerDay).toBe(0);
    });
  });

  describe('calculateWasteTonnageAndNgtCompensation', () => {
    it('computes volume and tonnage using CPCB density metrics', () => {
      const res = calculateWasteTonnageAndNgtCompensation({
        dumpLengthM: 10,
        dumpWidthM: 10,
        dumpAvgDepthM: 2, // Volume = 200 m³
        wasteCategory: 'UNCOMPACTED_MIXED_MSW', // Density = 0.45 t/m³ -> 90 tonnes
        defaultDays: 30,
        cityClass: 'CLASS_1_1M_TO_10M',
        scaleOfOperation: 'MEDIUM_COMMERCIAL',
        activeBurningObserved: false,
      });

      expect(res.isValid).toBe(true);
      expect(res.dumpVolumeCuM).toBe(200);
      expect(res.estimatedTonnage).toBe(90);
      expect(res.estimatedRemediationCostInr).toBe(90 * 550);
      expect(res.finalEnvironmentalCompensationInr).toBeGreaterThan(0);
    });

    it('applies 1.5x aggravation multiplier when open burning is present', () => {
      const withoutBurning = calculateWasteTonnageAndNgtCompensation({
        dumpLengthM: 10,
        dumpWidthM: 10,
        dumpAvgDepthM: 1,
        wasteCategory: 'UNCOMPACTED_MIXED_MSW',
        defaultDays: 10,
        activeBurningObserved: false,
      });

      const withBurning = calculateWasteTonnageAndNgtCompensation({
        dumpLengthM: 10,
        dumpWidthM: 10,
        dumpAvgDepthM: 1,
        wasteCategory: 'UNCOMPACTED_MIXED_MSW',
        defaultDays: 10,
        activeBurningObserved: true,
      });

      expect(withBurning.finalEnvironmentalCompensationInr).toBe(
        Math.round(withoutBurning.finalEnvironmentalCompensationInr * 1.5)
      );
      expect(withBurning.burningMultiplier).toBe(1.5);
    });

    it('handles zero or negative dimensions safely', () => {
      const res = calculateWasteTonnageAndNgtCompensation({
        dumpLengthM: 0,
        dumpWidthM: 0,
        dumpAvgDepthM: 0,
      });

      expect(res.isValid).toBe(false);
      expect(res.dumpVolumeCuM).toBe(0);
      expect(res.estimatedTonnage).toBe(0);
    });
  });

  describe('evaluateCdWasteCompliance', () => {
    it('identifies Bulk C&D Generator (> 20 T/day or > 300 T/project)', () => {
      const res = evaluateCdWasteCompliance({
        dailyGenerationTons: 25,
        totalProjectTons: 500,
        hasUlApprovedPlan: false,
        segregatedDeposition: false,
      });

      expect(res.isBulkCdGenerator).toBe(true);
      expect(res.isCompliant).toBe(false);
      expect(res.violations.some((v) => v.rule.includes('Rule 4(3)'))).toBe(true);
      expect(res.violations.some((v) => v.rule.includes('Rule 4(1)'))).toBe(true);
    });

    it('verifies compliant C&D waste operations with approved plan and 4-stream segregation', () => {
      const res = evaluateCdWasteCompliance({
        dailyGenerationTons: 30,
        totalProjectTons: 600,
        hasUlApprovedPlan: true,
        segregatedDeposition: true,
      });

      expect(res.isBulkCdGenerator).toBe(true);
      expect(res.isCompliant).toBe(true);
      expect(res.violations.length).toBe(0);
    });
  });

  describe('Legal Drafters', () => {
    it('generates a formal Rule 15 statutory notice to Municipal Commissioner and SPCB', () => {
      const notice = generateRule15StatutoryNotice({
        complainant: { name: 'Rajesh Kulkarni', address: 'Kothrud, Pune', contact: '9823012345' },
        location: { address: 'Survey No. 48, Near Ram Nadi', ward: 'Ward 28', city: 'Pune', state: 'Maharashtra' },
        calculation: {
          dumpVolumeCuM: 750,
          estimatedTonnage: 337.5,
          estimatedRemediationCostInr: 185625,
          defaultDays: 45,
          finalEnvironmentalCompensationInr: 1080000,
          activeBurningObserved: true,
        },
      });

      expect(notice).toContain('FORMAL STATUTORY NOTICE UNDER RULE 15 & 16 OF SOLID WASTE MANAGEMENT RULES');
      expect(notice).toContain('THE MUNICIPAL COMMISSIONER');
      expect(notice).toContain('Maharashtra State Pollution Control Board');
      expect(notice).toContain('337.5 METRIC TONNES');
      expect(notice).toContain('15-DAY CURE NOTICE');
      expect(notice).toContain('Rajesh Kulkarni');
    });

    it('generates a draft Original Application for the NGT Zonal Bench', () => {
      const application = generateNgtSection14Application({
        bench: 'WESTERN_BENCH_PUNE',
        complainant: { name: 'Citizens Environment Forum' },
        respondentMunicipal: 'Pune Municipal Corporation',
        respondentSpcb: 'Maharashtra Pollution Control Board',
        location: { address: 'Plot 104, Bavdhan' },
        calculation: {
          estimatedTonnage: 250,
          finalEnvironmentalCompensationInr: 800000,
        },
      });

      expect(application).toContain('BEFORE THE HON\'BLE NATIONAL GREEN TRIBUNAL');
      expect(application).toContain('WESTERN ZONAL BENCH, PUNE');
      expect(application).toContain('UNDER SECTION 14 READ WITH SECTION 15');
      expect(application).toContain('Citizens Environment Forum');
      expect(application).toContain('Pune Municipal Corporation');
    });
  });

  describe('Configuration Objects', () => {
    it('provides valid density metrics and NGT zonal benches', () => {
      expect(WASTE_DENSITY_METRICS.UNCOMPACTED_MIXED_MSW.densityTonnesPerCuM).toBe(0.45);
      expect(WASTE_DENSITY_METRICS.CONSTRUCTION_DEMOLITION.densityTonnesPerCuM).toBe(1.50);
      expect(BWG_PREMISE_TYPES.GATED_RESIDENTIAL_SOCIETY.dailyThresholdKg).toBe(100);
      expect(NGT_ZONAL_BENCHES.SOUTHERN_BENCH_CHENNAI.registrarOffice).toContain('Chepauk');
    });
  });
});
