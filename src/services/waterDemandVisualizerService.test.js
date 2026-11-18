import { describe, it, expect } from 'vitest';
import {
  calculateWaterDemandRange,
  compareWaterDemandScenarios,
  exportWaterDemandDossier,
  calculateRainwaterHarvestingOffset,
  adjustDemandBySeason,
  DEMAND_BENCHMARKS,
  LOCALITY_HYDRAULIC_ZONES,
  HYDRAULIC_DISCLAIMER
} from './waterDemandVisualizerService';

describe('waterDemandVisualizerService', () => {
  it('should define statutory CPHEEO benchmarks and disclaimer', () => {
    expect(DEMAND_BENCHMARKS.RESIDENTIAL_DOMESTIC.lpcd).toBe(135);
    expect(DEMAND_BENCHMARKS.COMMERCIAL_OFFICE.lpcd).toBe(45);
    expect(HYDRAULIC_DISCLAIMER).toContain('does not constitute official approval');
  });

  it('should calculate residential water demand correctly for a 4-person household', () => {
    const scenario = {
      category: 'RESIDENTIAL_DOMESTIC',
      occupancyCount: 4,
      localityZoneId: 'ZONE_A_CENTRAL'
    };

    const res = calculateWaterDemandRange(scenario);
    expect(res.dailyDemandLitres.baseline).toBe(540); // 4 * 135
    expect(res.dailyDemandLitres.min).toBe(Math.round(540 * 0.85));
    expect(res.dailyDemandLitres.max).toBe(Math.round(540 * 1.15));
    expect(res.monthlyKilolitres).toBe(16.2); // (540 * 30) / 1000
    expect(res.storageRecommendations.undergroundSumpLitres).toBe(810); // 1.5 days
    expect(res.localityStatus).toBe('ADEQUATE_CAPACITY');
    expect(res.recommendedPipeDiameter).toContain('0.5_inch');
  });

  it('should return explicit data unavailable status when locality zone is unknown', () => {
    const scenario = {
      category: 'RESIDENTIAL_DOMESTIC',
      occupancyCount: 5,
      localityZoneId: 'UNKNOWN_ZONE_404'
    };

    const res = calculateWaterDemandRange(scenario);
    expect(res.localityStatus).toBe('LOCALITY_DATA_UNAVAILABLE');
  });

  it('should recommend larger pipe diameter for high consumption scenarios', () => {
    const highDemandScenario = {
      category: 'RESTAURANT_HOTEL',
      occupancyCount: 50 // 50 seats * 70 = 3500 LPCD > 2000
    };

    const res = calculateWaterDemandRange(highDemandScenario);
    expect(res.recommendedPipeDiameter).toContain('1.0_inch');
  });

  it('should compare two scenarios and calculate variances', () => {
    const scenarioA = { occupancyCount: 4 };
    const scenarioB = { occupancyCount: 8 };

    const comp = compareWaterDemandScenarios(scenarioA, scenarioB);
    expect(comp.deltaDailyLitres).toBe(540); // 1080 - 540
    expect(comp.percentageVariance).toBe(100.0);
  });

  it('should calculate rainwater harvesting statutory offset', () => {
    const rwh = calculateRainwaterHarvestingOffset(150, 180);
    expect(rwh.isMandatoryByLaw).toBe(true);
    expect(rwh.potentialHarvestedKL).toBe(60);
    expect(rwh.netDemandAfterHarvestingKL).toBe(120);
    expect(rwh.regulatoryRule).toContain('Mandatory RWH');
  });

  it('should adjust demand by seasonal variation multipliers', () => {
    const summer = adjustDemandBySeason(540, 'SUMMER');
    expect(summer.adjustedDailyLitres).toBe(675); // 540 * 1.25

    const monsoon = adjustDemandBySeason(540, 'MONSOON');
    expect(monsoon.adjustedDailyLitres).toBe(459); // 540 * 0.85
  });

  it('should export formatted markdown demand dossier with standards', () => {
    const res = calculateWaterDemandRange({ occupancyCount: 6, localityZoneId: 'ZONE_B_SUBURBAN' });
    const doc = exportWaterDemandDossier(res);

    expect(doc).toContain('# Water-Connection Demand & Storage Planning Dossier');
    expect(doc).toContain('6 Persons / Occupants');
    expect(doc).toContain('CPHEEO Manual on Water Supply');
    expect(doc).toContain('Underground Sump Tank');
  });
});
