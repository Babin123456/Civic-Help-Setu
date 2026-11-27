import { describe, it, expect } from 'vitest';
import {
  RULESET_VERSION,
  calculateDaysBetween,
  computeCohortBaselines,
  runProcurementRedFlagAnalytics,
} from './openContractingAnalyticsService.js';
import {
  OPEN_CONTRACTING_SEED_DATA,
} from '../data/openContractingSeed.js';

describe('openContractingAnalyticsService (#751)', () => {
  it('correctly calculates days between dates', () => {
    expect(calculateDaysBetween('2026-01-01T00:00:00Z', '2026-01-15T00:00:00Z')).toBe(14);
    expect(calculateDaysBetween('2026-02-01T00:00:00Z', '2026-02-05T00:00:00Z')).toBe(4);
    expect(calculateDaysBetween(null, '2026-02-05T00:00:00Z')).toBe(0);
    expect(calculateDaysBetween('2026-02-05T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(0);
  });

  it('computes cohort baselines across categories and jurisdictions', () => {
    const baselines = computeCohortBaselines(
      OPEN_CONTRACTING_SEED_DATA.notices,
      OPEN_CONTRACTING_SEED_DATA.bids,
      OPEN_CONTRACTING_SEED_DATA.awards,
      OPEN_CONTRACTING_SEED_DATA.amendments
    );

    expect(baselines).toBeDefined();
    const worksKey = 'works|Bengaluru Urban, Karnataka';
    expect(baselines[worksKey]).toBeDefined();
    expect(baselines[worksKey].noticeCount).toBeGreaterThanOrEqual(2);
    expect(baselines[worksKey].avgBidsPerNotice).toBeGreaterThan(0);
  });

  it('runs analytics and detects expected anomaly patterns on seed data', () => {
    const results = runProcurementRedFlagAnalytics({
      notices: OPEN_CONTRACTING_SEED_DATA.notices,
      bids: OPEN_CONTRACTING_SEED_DATA.bids,
      awards: OPEN_CONTRACTING_SEED_DATA.awards,
      amendments: OPEN_CONTRACTING_SEED_DATA.amendments,
      vendors: OPEN_CONTRACTING_SEED_DATA.vendors,
    });

    expect(results.rulesetVersion).toBe(RULESET_VERSION);
    expect(results.totalNoticesAnalyzed).toBe(5);
    expect(results.totalRedFlagsDetected).toBeGreaterThan(0);

    const flags = results.redFlags;

    // Check Single-Bid Award detection
    const singleBidFlag = flags.find((f) => f.indicatorId === 'single_bid_award');
    expect(singleBidFlag).toBeDefined();
    expect(singleBidFlag.noticeId).toBe('NOT-2026-BLR-002');
    expect(singleBidFlag.cohortBenchmark).toBeDefined();
    expect(singleBidFlag.cohortBenchmark.metricLabel).toContain('Bids');

    // Check Short Bidding Window detection
    const shortWindowFlag = flags.find((f) => f.indicatorId === 'short_bidding_window');
    expect(shortWindowFlag).toBeDefined();
    expect(shortWindowFlag.noticeId).toBe('NOT-2026-PUN-003');
    expect(shortWindowFlag.influencingFields.some((f) => f.includes('windowDays: 4'))).toBe(true);

    // Check Unusual Amendments / High Cost Creep detection
    const amendFlag = flags.find((f) => f.indicatorId === 'unusual_amendments');
    expect(amendFlag).toBeDefined();
    expect(amendFlag.noticeId).toBe('NOT-2026-DEL-004');
    expect(amendFlag.severity).toBe('critical');

    // Check Price Outlier detection
    const priceFlag = flags.find((f) => f.indicatorId === 'price_outlier');
    expect(priceFlag).toBeDefined();
    expect(priceFlag.noticeId).toBe('NOT-2026-BLR-005');
  });

  it('enforces explainability metadata on every generated red flag', () => {
    const results = runProcurementRedFlagAnalytics({
      notices: OPEN_CONTRACTING_SEED_DATA.notices,
      bids: OPEN_CONTRACTING_SEED_DATA.bids,
      awards: OPEN_CONTRACTING_SEED_DATA.awards,
      amendments: OPEN_CONTRACTING_SEED_DATA.amendments,
      vendors: OPEN_CONTRACTING_SEED_DATA.vendors,
    });

    results.redFlags.forEach((flag) => {
      expect(flag.id).toBeDefined();
      expect(flag.indicatorId).toBeDefined();
      expect(flag.rulesetVersion).toBe(RULESET_VERSION);
      expect(flag.executedAt).toBeDefined();
      expect(Array.isArray(flag.influencingFields)).toBe(true);
      expect(flag.influencingFields.length).toBeGreaterThan(0);
      expect(flag.cohortBenchmark).toBeDefined();
      expect(flag.recommendedAuditorAction).toBeDefined();
      // Verify language is non-accusatory
      expect(flag.title).not.toMatch(/corrupt|bribe|fraud|criminal|guilty/i);
      expect(flag.explanation).not.toMatch(/corrupt|bribe|fraud|criminal|guilty/i);
    });
  });

  it('filters analysis by jurisdiction if specified', () => {
    const punResults = runProcurementRedFlagAnalytics({
      notices: OPEN_CONTRACTING_SEED_DATA.notices,
      bids: OPEN_CONTRACTING_SEED_DATA.bids,
      awards: OPEN_CONTRACTING_SEED_DATA.awards,
      amendments: OPEN_CONTRACTING_SEED_DATA.amendments,
      vendors: OPEN_CONTRACTING_SEED_DATA.vendors,
      jurisdictionFilter: 'Pune, Maharashtra',
    });

    expect(punResults.totalNoticesAnalyzed).toBe(1);
    expect(punResults.redFlags.every((f) => !f.jurisdiction || f.jurisdiction === 'Pune, Maharashtra')).toBe(true);
  });
});
