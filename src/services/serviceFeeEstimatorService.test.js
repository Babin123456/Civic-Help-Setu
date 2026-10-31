import { describe, it, expect } from 'vitest';
import {
  CONCESSION_CATEGORIES,
  parseBaseFeeAmount,
  calculateEstimatedCost,
} from './serviceFeeEstimatorService';

describe('serviceFeeEstimatorService', () => {
  it('parses numeric amounts from diverse fee strings', () => {
    expect(parseBaseFeeAmount('₹50 (Free for BPL)')).toBe(50);
    expect(parseBaseFeeAmount('1,500 INR')).toBe(1500);
    expect(parseBaseFeeAmount('Free')).toBe(0);
    expect(parseBaseFeeAmount('Nil statutory charges')).toBe(0);
    expect(parseBaseFeeAmount('')).toBe(0);
  });

  it('calculates standard cost with default options', () => {
    const service = { name: 'Driving License', fees: '₹200' };
    const cost = calculateEstimatedCost(service, {
      isTatkal: false,
      needsPostalDelivery: true,
      needsNotaryAffidavit: false,
      needsKioskAssistance: false,
      concessionId: 'NONE',
    });

    expect(cost.baseFee).toBe(200);
    expect(cost.postalFee).toBe(50);
    expect(cost.grossTotal).toBe(250);
    expect(cost.netPayable).toBe(250);
    expect(cost.waiverDiscount).toBe(0);
  });

  it('applies 100% base fee waiver for BPL concession', () => {
    const service = { name: 'Income Certificate', fees: '₹60' };
    const cost = calculateEstimatedCost(service, {
      isTatkal: false,
      needsPostalDelivery: false,
      needsNotaryAffidavit: false,
      needsKioskAssistance: false,
      concessionId: 'BPL',
    });

    expect(cost.baseFee).toBe(60);
    expect(cost.waiverDiscount).toBe(60);
    expect(cost.netPayable).toBe(0);
    expect(cost.isFullyExempt).toBe(true);
  });

  it('computes tatkal, notary, and kiosk surcharges correctly', () => {
    const service = { name: 'Passport Renewal', fees: '₹1500' };
    const cost = calculateEstimatedCost(service, {
      isTatkal: true,
      needsPostalDelivery: true,
      needsNotaryAffidavit: true,
      needsKioskAssistance: true,
      concessionId: 'NONE',
    });

    expect(cost.baseFee).toBe(1500);
    expect(cost.tatkalFee).toBe(2250); // 1.5x of 1500
    expect(cost.postalFee).toBe(50);
    expect(cost.notaryFee).toBe(150);
    expect(cost.kioskFee).toBe(60);
    expect(cost.netPayable).toBe(1500 + 2250 + 50 + 150 + 60);
  });
});
