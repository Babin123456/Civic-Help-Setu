/**
 * Water-Connection Demand and Capacity Planning Visualizer Service
 * 
 * Provides indicative household and commercial water demand range forecasting
 * based on standard national engineering norms (CPHEEO Manual on Water Supply):
 * - Benchmark: 135 Litres Per Capita Daily (LPCD) for residential piped domestic supply
 * - Commercial / Institutional standard multipliers (offices, restaurants, schools)
 * - Compares scenario demand ranges (e.g. household size, storage capacity, rainwater harvesting)
 * - Flags unsupported localities with explicit unavailable data states
 * - Disclaims clearly that calculated demand is an indicative planning estimate,
 *   NOT a formal confirmation of distribution network hydraulic capacity.
 */

export const DEMAND_BENCHMARKS = {
  RESIDENTIAL_DOMESTIC: {
    code: 'RESIDENTIAL_DOMESTIC',
    lpcd: 135, // Litres per capita per day (CPHEEO norm)
    label: 'Standard Urban Residential (135 LPCD)',
    statutoryStandard: 'CPHEEO Manual on Water Supply and Treatment (Ministry of Housing and Urban Affairs)'
  },
  COMMERCIAL_OFFICE: {
    code: 'COMMERCIAL_OFFICE',
    lpcd: 45, // Litres per employee per day
    label: 'Commercial Office Space (45 LPCD per occupant)',
    statutoryStandard: 'National Building Code 2016 Part 9 Section 1'
  },
  RESTAURANT_HOTEL: {
    code: 'RESTAURANT_HOTEL',
    lpcd: 70, // Litres per seat per day
    label: 'Restaurant / Eatery (70 LPCD per dining seat)',
    statutoryStandard: 'Public Health Engineering Standards'
  }
};

export const LOCALITY_HYDRAULIC_ZONES = {
  ZONE_A_CENTRAL: { id: 'ZONE_A_CENTRAL', pressureBar: 1.2, networkStatus: 'ADEQUATE_CAPACITY' },
  ZONE_B_SUBURBAN: { id: 'ZONE_B_SUBURBAN', pressureBar: 0.8, networkStatus: 'MODERATE_PRESSURE' },
  ZONE_C_PERIPHERAL: { id: 'ZONE_C_PERIPHERAL', pressureBar: 0.4, networkStatus: 'LOW_PRESSURE_AUGMENTATION_NEEDED' }
};

export const HYDRAULIC_DISCLAIMER =
  'IMPORTANT NOTICE: Calculated water demand is an indicative engineering estimate based on CPHEEO benchmarks. It does not constitute official approval, confirmed line pressure, or a legal guarantee of municipal water supply connection.';

export const GROUNDWATER_RECHARGE_BOREWELL_RULES = {
  maxDepthMetersWithoutPermit: 60,
  centralGroundWaterAuthorityPermissionNeeded: true,
  penaltyForUnauthorizedCommercialDrillingINR: 100000
};

/**
 * Returns Central Ground Water Authority drilling statutory rules.
 * @returns {Object}
 */
export function getGroundwaterRegulations() {
  return GROUNDWATER_RECHARGE_BOREWELL_RULES;
}

export const MONSOON_SEASONAL_FACTORS = {
  SUMMER: { multiplier: 1.25, label: 'Peak Summer Season (+25% Surge Factor)' },
  MONSOON: { multiplier: 0.85, label: 'Monsoon Season (-15% Draw Reduction)' },
  WINTER: { multiplier: 0.95, label: 'Winter Season (-5% Normal Draw)' }
};

/**
 * Adjusts baseline demand by seasonal variation factor.
 * @param {number} baselineLitres 
 * @param {string} season 
 * @returns {Object} seasonalAdjustment
 */
export function adjustDemandBySeason(baselineLitres = 0, season = 'SUMMER') {
  const base = Math.max(0, Number(baselineLitres) || 0);
  const factor = MONSOON_SEASONAL_FACTORS[season] || MONSOON_SEASONAL_FACTORS.SUMMER;
  const adjusted = Math.round(base * factor.multiplier);

  return {
    season,
    multiplier: factor.multiplier,
    label: factor.label,
    originalDailyLitres: base,
    adjustedDailyLitres: adjusted
  };
}

export const RAINWATER_HARVESTING_SAVINGS = {
  averageRwhCoveragePercent: 25,
  statutoryMandateThresholdSqMeters: 100, // plot area >= 100 sq meters requires RWH in most urban municipal bye-laws
  annualSavingKilolitresPer100SqM: 40
};

/**
 * Computes rainwater harvesting offset credit for a property.
 * @param {number} roofAreaSqMeters 
 * @param {number} annualDemandKilolitres 
 * @returns {Object} rwhOffset
 */
export function calculateRainwaterHarvestingOffset(roofAreaSqMeters = 0, annualDemandKilolitres = 0) {
  const area = Math.max(0, Number(roofAreaSqMeters) || 0);
  const demand = Math.max(0, Number(annualDemandKilolitres) || 0);

  const potentialHarvestedKL = Math.round((area / 100) * RAINWATER_HARVESTING_SAVINGS.annualSavingKilolitresPer100SqM);
  const netDemandKL = Math.max(0, demand - potentialHarvestedKL);
  const isMandatoryByLaw = area >= RAINWATER_HARVESTING_SAVINGS.statutoryMandateThresholdSqMeters;

  return {
    roofAreaSqMeters: area,
    potentialHarvestedKL,
    netDemandAfterHarvestingKL: netDemandKL,
    isMandatoryByLaw,
    regulatoryRule: isMandatoryByLaw
      ? 'Mandatory RWH: Properties exceeding 100 sq.m are statutorily required to install functional RWH pits prior to permanent connection sanction.'
      : 'Recommended RWH: Voluntary installation earns green civic tariff rebate.'
  };
}

export const WATER_CONSERVATION_MEASURES = [
  { item: 'Aerated Low-Flow Faucets', savingsPercent: 15 },
  { item: 'Dual-Flush Toilet Cisterns', savingsPercent: 20 },
  { item: 'Greywater Recycling for Gardening', savingsPercent: 25 }
];

/**
 * Calculates indicative daily and monthly water demand range for a scenario.
 * @param {Object} scenario 
 * @returns {Object} demandProjection
 */
export function calculateWaterDemandRange(scenario = {}) {
  const categoryKey = scenario.category || 'RESIDENTIAL_DOMESTIC';
  const benchmark = DEMAND_BENCHMARKS[categoryKey] || DEMAND_BENCHMARKS.RESIDENTIAL_DOMESTIC;

  const occupancy = Math.max(1, Number(scenario.occupancyCount) || 4);
  const baselineDailyLitres = occupancy * benchmark.lpcd;

  // Range band (±15% to account for seasonal variations / peak summer)
  const minDailyLitres = Math.round(baselineDailyLitres * 0.85);
  const maxDailyLitres = Math.round(baselineDailyLitres * 1.15);

  // Monthly projection (30 days)
  const monthlyKilolitres = +((baselineDailyLitres * 30) / 1000).toFixed(1);

  // Recommended underground sump & overhead tank capacity
  const recommendedSumpCapacityLitres = Math.round(baselineDailyLitres * 1.5);
  const recommendedOhtCapacityLitres = Math.round(baselineDailyLitres * 0.5);

  // Pipe diameter recommendation
  let recommendedPipeDiameter = '0.5_inch (15 mm)';
  if (baselineDailyLitres > 2000) {
    recommendedPipeDiameter = '1.0_inch (25 mm)';
  } else if (baselineDailyLitres > 800) {
    recommendedPipeDiameter = '0.75_inch (20 mm)';
  }

  // Locality check
  const localityZone = LOCALITY_HYDRAULIC_ZONES[scenario.localityZoneId];

  return {
    category: benchmark.label,
    standardNorm: benchmark.statutoryStandard,
    occupancyCount: occupancy,
    dailyDemandLitres: {
      min: minDailyLitres,
      baseline: baselineDailyLitres,
      max: maxDailyLitres
    },
    monthlyKilolitres,
    storageRecommendations: {
      undergroundSumpLitres: recommendedSumpCapacityLitres,
      overheadTankLitres: recommendedOhtCapacityLitres
    },
    recommendedPipeDiameter,
    localityStatus: localityZone ? localityZone.networkStatus : 'LOCALITY_DATA_UNAVAILABLE',
    disclaimer: HYDRAULIC_DISCLAIMER
  };
}

/**
 * Compares two water demand planning scenarios.
 * @param {Object} scenarioA 
 * @param {Object} scenarioB 
 * @returns {Object} comparison
 */
export function compareWaterDemandScenarios(scenarioA, scenarioB) {
  const resultA = calculateWaterDemandRange(scenarioA);
  const resultB = calculateWaterDemandRange(scenarioB);

  const deltaDaily = resultB.dailyDemandLitres.baseline - resultA.dailyDemandLitres.baseline;
  const deltaMonthlyKL = +(resultB.monthlyKilolitres - resultA.monthlyKilolitres).toFixed(1);

  return {
    scenarioA: { occupancy: resultA.occupancyCount, dailyBaseline: resultA.dailyDemandLitres.baseline },
    scenarioB: { occupancy: resultB.occupancyCount, dailyBaseline: resultB.dailyDemandLitres.baseline },
    deltaDailyLitres: deltaDaily,
    deltaMonthlyKL,
    percentageVariance: resultA.dailyDemandLitres.baseline > 0
      ? +((deltaDaily / resultA.dailyDemandLitres.baseline) * 100).toFixed(1)
      : 0
  };
}

/**
 * Exports formatted water demand planning dossier in markdown.
 * @param {Object} demandResult 
 * @returns {string} markdown
 */
export function exportWaterDemandDossier(demandResult = {}) {
  return [
    `# Water-Connection Demand & Storage Planning Dossier`,
    `**Application Category:** ${demandResult.category || 'Residential Domestic'}`,
    `**Occupancy Band:** ${demandResult.occupancyCount || 4} Persons / Occupants`,
    `**Indicative Daily Demand:** ${demandResult.dailyDemandLitres?.baseline || 0} Litres/Day (Range: ${demandResult.dailyDemandLitres?.min || 0} – ${demandResult.dailyDemandLitres?.max || 0} L/day)`,
    `**Estimated Monthly Consumption:** ~${demandResult.monthlyKilolitres || 0} KiloLitres (KL)`,
    `**Recommended Connection Size:** ${demandResult.recommendedPipeDiameter || '0.5 inch'}`,
    ``,
    `## Recommended On-Site Storage Infrastructure`,
    `- **Underground Sump Tank:** Minimum ${demandResult.storageRecommendations?.undergroundSumpLitres || 0} Litres (1.5 days reserve)`,
    `- **Overhead Tank (OHT):** Minimum ${demandResult.storageRecommendations?.overheadTankLitres || 0} Litres (0.5 day distribution)`,
    ``,
    `## Locality Network Status`,
    `- **Status:** \`${demandResult.localityStatus || 'UNAVAILABLE'}\``,
    `- **Statutory Standard:** ${demandResult.standardNorm || 'CPHEEO Norms'}`,
    ``,
    `---`,
    `> **Mandatory Disclaimer:** ${demandResult.disclaimer || HYDRAULIC_DISCLAIMER}`
  ].join('\n');
}
