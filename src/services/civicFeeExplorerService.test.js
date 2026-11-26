import { describe, it, expect } from 'vitest';
import {
  calculateWaterConnectionFee,
  compareFeeScenarios,
  exportFeeEstimateSummary,
  calculatePaymentGatewayCharges,
  CHARGE_TYPES,
  FEE_SCHEDULES
} from './civicFeeExplorerService';

describe('civicFeeExplorerService', () => {
  it('should define statutory schedules and charge classifications', () => {
    expect(CHARGE_TYPES.FIXED).toBe('FIXED');
    expect(CHARGE_TYPES.CONCESSION).toBe('CONCESSION');
    expect(FEE_SCHEDULES.WATER_CONNECTION.baseApplicationFee).toBe(250);
  });

  it('should calculate deterministic water connection fee for standard residential scenario', () => {
    const params = {
      diameter: '0.5_inch',
      roadCuttingMeters: 2, // 2 * 450 = 900
      expressInspection: false,
      isBplCardHolder: false
    };

    const res = calculateWaterConnectionFee(params);
    expect(res.subtotal).toBe(250 + 1500 + 900 + 150); // Base(250) + Conn(1500) + Road(900) + Cess(150) = 2800
    expect(res.finalEstimatedAmount).toBe(2800);
    expect(res.lineItems.length).toBe(4);
    expect(res.concessionTotal).toBe(0);
  });

  it('should apply BPL welfare concessions accurately', () => {
    const params = {
      diameter: '0.5_inch',
      roadCuttingMeters: 0,
      expressInspection: false,
      isBplCardHolder: true
    };

    const res = calculateWaterConnectionFee(params);
    // Base 250 + Conn 1500 + Cess 150 = 1900. 50% concession = 950
    expect(res.subtotal).toBe(1900);
    expect(res.concessionTotal).toBe(950);
    expect(res.finalEstimatedAmount).toBe(950);
    expect(res.lineItems.some(i => i.code === 'BPL_CONCESSION')).toBe(true);
  });

  it('should compare two fee scenarios and calculate difference', () => {
    const scenarioA = { diameter: '0.5_inch', roadCuttingMeters: 0 };
    const scenarioB = { diameter: '1.0_inch', roadCuttingMeters: 5 };

    const comp = compareFeeScenarios(scenarioA, scenarioB);
    expect(comp.differenceAmount).toBeGreaterThan(0);
    expect(comp.moreEconomicalScenario).toBe('Scenario A');
    expect(comp.percentageChange).toBeGreaterThan(0);
  });

  it('should calculate payment gateway transaction charges accurately', () => {
    const upi = calculatePaymentGatewayCharges(2800, 'UPI');
    expect(upi.gatewaySurcharge).toBe(0);
    expect(upi.totalChargeAtCheckout).toBe(2800);

    const netBanking = calculatePaymentGatewayCharges(2800, 'NET_BANKING');
    expect(netBanking.gatewaySurcharge).toBe(10);
    expect(netBanking.totalChargeAtCheckout).toBe(2810);
  });

  it('should export formatted markdown waterfall report with citations', () => {
    const res = calculateWaterConnectionFee({ diameter: '0.5_inch', roadCuttingMeters: 1 });
    const doc = exportFeeEstimateSummary(res);

    expect(doc).toContain('# Civic Fee Composition Estimate: Municipal Water Connection');
    expect(doc).toContain('Gazette Notification No. WSD/2023/114B');
    expect(doc).toContain('Road Cutting & Restoration');
    expect(doc).toContain('Final Net Payable');
  });
});
