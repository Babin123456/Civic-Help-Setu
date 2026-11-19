import { describe, it, expect } from 'vitest';
import {
  getWaterBoardSpecs,
  generateWaterConnectionPlan,
  WaterConnectionTracker,
  UTILITY_JOURNEY_TYPE,
  WATER_BOARD_KEY,
  WATER_PLANNER_DISCLAIMER,
} from './municipalWaterSewerPlannerService.js';

describe('Municipal Water and Sewer Connection Application Planner', () => {
  it('identifies local water boards with official URLs and deposits', () => {
    const djb = getWaterBoardSpecs(WATER_BOARD_KEY.DJB_DELHI);
    expect(djb.name).toContain('Delhi Jal Board');
    expect(djb.standardDomesticWaterDeposit).toBe(1000);

    const bwssb = getWaterBoardSpecs(WATER_BOARD_KEY.BWSSB_BENGALURU);
    expect(bwssb.name).toContain('Bangalore Water Supply');
    expect(bwssb.sewerDevelopmentChargePerSqm).toBe(250);
  });

  it('calculates sourced connection fee breakdown based on area and category', () => {
    const plan = generateWaterConnectionPlan({
      journeyType: UTILITY_JOURNEY_TYPE.NEW_WATER_CONNECTION,
      boardKey: WATER_BOARD_KEY.BWSSB_BENGALURU,
      propertyDetails: { builtUpAreaSqm: 120, isCommercial: false },
    });

    expect(plan.estimatedFeeBreakdown.statutorySecurityDeposit).toBe(2500);
    expect(plan.estimatedFeeBreakdown.sewerDevelopmentCharges).toBe(120 * 250); // 30,000
    expect(plan.estimatedFeeBreakdown.estimatedTotalPreTax).toBe(32500);
    expect(plan.disclaimer).toBe(WATER_PLANNER_DISCLAIMER);
  });

  it('conditionally includes licensed plumber requirement where mandated', () => {
    const djbPlan = generateWaterConnectionPlan({
      journeyType: UTILITY_JOURNEY_TYPE.NEW_WATER_CONNECTION,
      boardKey: WATER_BOARD_KEY.DJB_DELHI,
    });
    const plumberDoc = djbPlan.requiredEvidence.find((e) => e.document.includes('Plumber'));
    expect(plumberDoc).toBeDefined();

    const pmcPlan = generateWaterConnectionPlan({
      journeyType: UTILITY_JOURNEY_TYPE.NEW_WATER_CONNECTION,
      boardKey: WATER_BOARD_KEY.PMC_PUNE,
    });
    const pmcPlumber = pmcPlan.requiredEvidence.find((e) => e.document.includes('Plumber'));
    expect(pmcPlumber).toBeUndefined();
  });

  it('structures distinct journey for meter replacement', () => {
    const meterPlan = generateWaterConnectionPlan({
      journeyType: UTILITY_JOURNEY_TYPE.METER_REPLACEMENT_OR_TESTING,
      boardKey: WATER_BOARD_KEY.DJB_DELHI,
    });

    expect(meterPlan.estimatedFeeBreakdown.statutorySecurityDeposit).toBe(500);
    expect(meterPlan.estimatedFeeBreakdown.sewerDevelopmentCharges).toBe(0);
  });

  it('tracks connection milestones client-side without collecting user identity details', () => {
    const tracker = new WaterConnectionTracker();
    const plan = generateWaterConnectionPlan({
      journeyType: UTILITY_JOURNEY_TYPE.NEW_WATER_CONNECTION,
      boardKey: WATER_BOARD_KEY.DJB_DELHI,
    });

    const tracking = tracker.createConnectionTracking('water-conn-001', plan);
    expect(tracking.milestones.length).toBeGreaterThanOrEqual(4);
    expect(tracking.milestones[0].isCompleted).toBe(false);

    // Complete inspection
    const updated = tracker.completeMilestone('water-conn-001', 1);
    expect(updated.milestones[0].isCompleted).toBe(true);
    expect(updated.milestones[0].completedAt).toBeDefined();

    // Delete
    expect(tracker.deleteTracking('water-conn-001')).toBe(true);
    expect(tracker.getTracking('water-conn-001')).toBeNull();
  });
});
