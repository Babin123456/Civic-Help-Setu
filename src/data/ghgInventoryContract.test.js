import { describe, it, expect } from 'vitest';
import {
  buildInventoryExport,
  buildMissingDataRecommendation,
  buildPublicSummary,
  calculateEmission,
  compareCategoryTotals,
  computePeriodTotals,
  contentDigest,
  convertQuantity,
  resolveFactorVersion,
  severityForUncertainty,
} from './ghgInventoryContract.js';
import {
  SEED_ACTIVITY_RECORDS,
  SEED_EMISSION_FACTORS,
  SEED_EMISSION_SOURCES,
  SEED_FACTOR_VERSIONS,
  SEED_REPORTING_PERIODS,
  GHG_JURISDICTIONS,
} from './ghgInventorySeed.js';
import {
  ACTIVITY_STATUS,
  DATA_QUALITY,
  GHG_ERROR_CODES,
} from '../services/ghgInventoryConstants.js';
import { GhgInventoryError } from '../services/ghgInventoryValidation.js';

const period = SEED_REPORTING_PERIODS.find((item) => item.id === 'PER-2025-26');
const approvedRecords = SEED_ACTIVITY_RECORDS.filter(
  (record) => record.periodId === period.id && record.status === ACTIVITY_STATUS.LOCKED
);

const expectGhgError = (fn, code) => {
  try {
    fn();
    throw new Error('Expected a GhgInventoryError');
  } catch (error) {
    expect(error).toBeInstanceOf(GhgInventoryError);
    expect(error.code).toBe(code);
  }
};

describe('GHG inventory calculation contract (#753)', () => {
  it('converts supported units and refuses incompatible dimensions', () => {
    const conversion = convertQuantity(1, 'MWh', 'kWh');
    expect(conversion.factorQuantity).toBe(1000);
    expect(conversion.factorUnit).toBe('kWh');

    expectGhgError(() => convertQuantity(1, 'L', 'kWh'), GHG_ERROR_CODES.UNIT_MISMATCH);
    expectGhgError(() => convertQuantity(1, 'bogus', 'kWh'), GHG_ERROR_CODES.VALIDATION_ERROR);
    // Numeric strings are accepted because HTML number inputs return strings.
    expect(convertQuantity('1', 'kWh', 'kWh').factorQuantity).toBe(1);
    expectGhgError(() => convertQuantity('not-a-number', 'kWh', 'kWh'), GHG_ERROR_CODES.VALIDATION_ERROR);
  });

  it('calculates deterministic measured, estimated and excluded emissions', () => {
    const measured = calculateEmission({
      quantity: 1_000_000,
      unit: 'kWh',
      factorValue: 0.00069,
      factorUnit: 'kWh',
      dataQuality: DATA_QUALITY.MEASURED,
    });
    expect(measured.tCO2e).toBe(690);
    expect(measured.grossTCO2e).toBe(690);
    expect(measured.counted).toBe(true);
    expect(measured.formula).toContain('0.00069 tCO2e/kWh');

    const excluded = calculateEmission({
      quantity: 100,
      unit: 't',
      factorValue: 0.65,
      factorUnit: 't',
      dataQuality: DATA_QUALITY.EXCLUDED,
    });
    expect(excluded.tCO2e).toBe(0);
    expect(excluded.grossTCO2e).toBe(65);
    expect(excluded.counted).toBe(false);
  });

  it('resolves only published factor versions effective on the activity date', () => {
    const historical = resolveFactorVersion(SEED_FACTOR_VERSIONS, 'EF-GRID-IN', '2025-06-01');
    expect(historical.id).toBe('EFV-GRID-IN-1');

    const current = resolveFactorVersion(SEED_FACTOR_VERSIONS, 'EF-GRID-IN', '2026-06-01');
    expect(current.id).toBe('EFV-GRID-IN-2');

    const unsupported = SEED_FACTOR_VERSIONS.find((version) => version.id === 'EFV-GRID-IN-1');
    expectGhgError(
      () =>
        resolveFactorVersion(SEED_FACTOR_VERSIONS, 'EF-GRID-IN', '2025-06-01', 'EFV-GRID-IN-2'),
      GHG_ERROR_CODES.FACTOR_UNAVAILABLE
    );
    expect(unsupported.activityUnit).toBe('kWh');
  });

  it('totals the seeded FY 2025-26 inventory into measured and category buckets', () => {
    const result = computePeriodTotals({
      period,
      records: approvedRecords,
      sources: SEED_EMISSION_SOURCES,
      factors: SEED_EMISSION_FACTORS,
      versions: SEED_FACTOR_VERSIONS,
      computedAt: '2026-04-19T08:00:00.000Z',
    });

    expect(result.totals.tCO2e).toBe(5790.14);
    expect(result.totals.measuredTCO2e).toBe(5790.14);
    expect(result.totals.estimatedTCO2e).toBe(0);
    expect(result.totals.excludedTCO2e).toBe(0);
    expect(result.byCategory).toHaveLength(4);
    expect(result.lines).toHaveLength(6);
    expect(
      result.byCategory.find((bucket) => bucket.category === 'waste_operations').tCO2e
    ).toBe(3700);
    expect(result.warnings.some((warning) => warning.code === 'uncertainty_above_30_percent')).toBe(true);
  });

  it('keeps excluded activity out of the counted total but retains its gross value', () => {
    const excludedRecord = {
      ...approvedRecords[0],
      id: 'ACT-TEST-EXCLUDED',
      dataQuality: DATA_QUALITY.EXCLUDED,
      quantity: 100,
      unit: 't',
      sourceId: 'SRC-WST-01',
      category: 'waste_operations',
      factorId: 'EF-MSW-BURN',
      factorVersionId: 'EFV-MSW-BURN-1',
    };
    const result = computePeriodTotals({
      period,
      records: [excludedRecord],
      sources: SEED_EMISSION_SOURCES,
      factors: SEED_EMISSION_FACTORS,
      versions: SEED_FACTOR_VERSIONS,
    });
    expect(result.totals.tCO2e).toBe(0);
    expect(result.totals.excludedTCO2e).toBe(65);
    expect(result.lines[0].counted).toBe(false);
  });

  it('compares category totals without dividing by zero', () => {
    const current = { byCategory: [{ category: 'fleet_fuel', tCO2e: 120 }] };
    const previous = { byCategory: [{ category: 'fleet_fuel', tCO2e: 100 }] };
    const rows = compareCategoryTotals(current, previous);
    expect(rows[0]).toMatchObject({
      category: 'fleet_fuel',
      currentTCO2e: 120,
      previousTCO2e: 100,
      deltaTCO2e: 20,
      percentChange: 20,
    });

    const noBaseline = compareCategoryTotals(
      { byCategory: [{ category: 'waste_operations', tCO2e: 10 }] },
      { byCategory: [{ category: 'waste_operations', tCO2e: 0 }] }
    );
    expect(noBaseline[0].percentChange).toBeNull();
  });

  it('produces a public projection without internal ids, notes or documents', () => {
    const totals = computePeriodTotals({
      period,
      records: approvedRecords,
      sources: SEED_EMISSION_SOURCES,
      factors: SEED_EMISSION_FACTORS,
      versions: SEED_FACTOR_VERSIONS,
    });
    const summary = buildPublicSummary({
      period,
      jurisdiction: GHG_JURISDICTIONS[0],
      calculationRun: {
        methodologyVersion: totals.methodologyVersion,
        totals: totals.totals,
        byCategory: totals.byCategory,
        warnings: totals.warnings,
      },
      generatedAt: '2026-05-01T00:00:00.000Z',
    });
    const text = JSON.stringify(summary);
    expect(summary.totals.tCO2e).toBe(5790.14);
    expect(summary.byCategory).toHaveLength(4);
    expect(text).not.toMatch(/SUB-|ACT-|SRC-|EFV-/);
    expect(text).not.toContain('reviewer.ward42');
    expect(text).not.toContain('sourceDocument');
    expect(summary.disclosure).toContain('aggregate data only');
  });

  it('calculates a labelled recommendation from historical activity only', () => {
    const recommendation = buildMissingDataRecommendation({
      source: SEED_EMISSION_SOURCES.find((source) => source.id === 'SRC-FLT-02'),
      period: SEED_REPORTING_PERIODS.find((item) => item.id === 'PER-2026-27'),
      history: [
        { periodId: 'PER-2025-26', periodLabel: 'FY 2025-26', quantity: 18_500 },
        { periodId: 'PER-2024-25', periodLabel: 'FY 2024-25', quantity: 16_900 },
      ],
      factorVersion: SEED_FACTOR_VERSIONS.find((version) => version.id === 'EFV-DIESEL-1'),
      executionTimestamp: '2026-11-16T06:00:00.000Z',
    });
    expect(recommendation.estimatedQuantity).toBe(17_700);
    expect(recommendation.estimateTCO2e).toBe(47.436);
    expect(recommendation.status).toBe('pending');
    expect(recommendation.explanation).toContain('labelled estimated');
    expect(recommendation.sourceFields.length).toBeGreaterThan(0);
  });

  it('builds an export with a stable content digest and no actor identifiers', () => {
    const totals = computePeriodTotals({
      period,
      records: approvedRecords,
      sources: SEED_EMISSION_SOURCES,
      factors: SEED_EMISSION_FACTORS,
      versions: SEED_FACTOR_VERSIONS,
    });
    const submissionById = new Map(
      SEED_ACTIVITY_RECORDS.filter((record) => approvedRecords.includes(record)).map((record) => [
        record.submissionId,
        { status: 'locked' },
      ])
    );
    const payload = buildInventoryExport({
      period,
      jurisdiction: GHG_JURISDICTIONS[0],
      sources: SEED_EMISSION_SOURCES,
      records: approvedRecords,
      factors: SEED_EMISSION_FACTORS,
      versions: SEED_FACTOR_VERSIONS,
      submissionById,
      calculationRun: {
        methodologyVersion: totals.methodologyVersion,
        totals: totals.totals,
        byCategory: totals.byCategory,
        warnings: totals.warnings.map((warning) => warning.message),
        factorVersionIds: totals.factorVersionIds,
      },
      generatedAt: '2026-05-01T00:00:00.000Z',
    });
    expect(payload.lines).toHaveLength(6);
    expect(payload.totals.tCO2e).toBe(5790.14);
    expect(payload.contentDigest).toMatch(/^ghg-fnv1a64:[0-9a-f]{16}$/);
    expect(JSON.stringify(payload)).not.toContain('reviewer.ward42');

    const same = contentDigest({ b: 2, a: 1 });
    const reordered = contentDigest({ a: 1, b: 2 });
    expect(same).toBe(reordered);
    expect(contentDigest({ a: 1 })).not.toBe(contentDigest({ a: 2 }));
  });

  it('maps uncertainty to readable severity bands', () => {
    expect(severityForUncertainty(4)).toBe('low');
    expect(severityForUncertainty(15)).toBe('medium');
    expect(severityForUncertainty(45)).toBe('high');
    expect(severityForUncertainty(null)).toBe('unknown');
  });
});
