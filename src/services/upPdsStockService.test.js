import { describe, it, expect } from 'vitest';
import {
  calculatePdsEntitlement,
  evaluateObservationFreshness,
  analyzePdsStockDiscrepancy,
  exportPdsGrievanceMemo,
  UP_RATION_CARD_TYPES,
  UP_PDS_ESCALATION_OFFICERS
} from './upPdsStockService';

describe('upPdsStockService', () => {
  it('should list statutory ration card types and escalation officers', () => {
    expect(UP_RATION_CARD_TYPES.ANTYODAYA.fixedScalePerCardKg).toBe(35);
    expect(UP_RATION_CARD_TYPES.PRIORITY_HOUSEHOLD.scalePerUnitKg).toBe(5);
    expect(UP_PDS_ESCALATION_OFFICERS.length).toBe(3);
    expect(UP_PDS_ESCALATION_OFFICERS[0].title).toContain('Supply Inspector');
  });

  it('should calculate fixed 35 kg grain for Antyodaya cards regardless of unit count', () => {
    const ent1 = calculatePdsEntitlement('ANTYODAYA', 2);
    expect(ent1.totalGrainKg).toBe(35);
    expect(ent1.wheatKg).toBe(14);
    expect(ent1.riceKg).toBe(21);
    expect(ent1.totalCostINR).toBe(0);

    const ent2 = calculatePdsEntitlement('ANTYODAYA', 6);
    expect(ent2.totalGrainKg).toBe(35);
  });

  it('should calculate 5 kg per unit for Priority Household (PHH) cards', () => {
    const phh = calculatePdsEntitlement('PRIORITY_HOUSEHOLD', 4);
    expect(phh.totalGrainKg).toBe(20); // 4 units * 5 kg
    expect(phh.wheatKg).toBe(8); // 4 units * 2 kg
    expect(phh.riceKg).toBe(12); // 4 units * 3 kg
    expect(phh.totalCostINR).toBe(0);
  });

  it('should evaluate freshness with 48h decay window', () => {
    const now = new Date();
    const freshDate = new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(); // 10h ago
    const expiredDate = new Date(now.getTime() - 55 * 60 * 60 * 1000).toISOString(); // 55h ago

    const fresh = evaluateObservationFreshness(freshDate);
    expect(fresh.isFresh).toBe(true);
    expect(fresh.ageHours).toBeCloseTo(10, 0);

    const expired = evaluateObservationFreshness(expiredDate);
    expect(expired.isFresh).toBe(false);
    expect(expired.statusText).toContain('Expired');
  });

  it('should detect divergence between official e-PoS stock and crowdsourced shortage reports', () => {
    const officialStock = {
      dealerCode: '2026119934',
      wheatBalanceKg: 2400,
      riceBalanceKg: 3600
    };

    const now = new Date().toISOString();
    const reports = [
      { reportedAt: now, dealerClaimsOutOfStock: true },
      { reportedAt: now, dealerClaimsOutOfStock: true },
      { reportedAt: now, isShopClosedDuringWorkingHours: true }
    ];

    const result = analyzePdsStockDiscrepancy(officialStock, reports);
    expect(result.discrepancyDetected).toBe(true);
    expect(result.dealerCode).toBe('FPS-UP-****-9934');
    expect(result.flaggedIssues.length).toBeGreaterThan(0);
    expect(result.flaggedIssues[0]).toContain('e-PoS Stock Inconsistency');
    expect(result.recommendInspection).toBe(true);
  });

  it('should export formatted memo representation for District Supply Officer', () => {
    const shop = { villageOrWard: 'Ward 12, Mohanlalganj', district: 'Lucknow' };
    const analysis = {
      dealerCode: 'FPS-UP-****-9934',
      officialBalanceWheatKg: 1500,
      officialBalanceRiceKg: 2000,
      freshCommunityReportCount: 4,
      flaggedIssues: ['Dealers claims out of stock despite portal balance > 3000 kg.']
    };

    const memo = exportPdsGrievanceMemo(shop, analysis);
    expect(memo).toContain('# Memorandum of Irregularity: Fair Price Shop');
    expect(memo).toContain('Mohanlalganj');
    expect(memo).toContain('1500 kg');
    expect(memo).toContain('Supply Inspector (Poorti Nirikshak)');
    expect(memo).toContain('Beneficiary Protection');
  });

  it('should retrieve PDS FAQs and complaint channels', async () => {
    const { getPdsFaqs, getPdsComplaintChannels } = await import('./upPdsStockService');
    const faqs = getPdsFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].a).toContain('completely free of charge');
    expect(faqs[2].a).toContain('One Nation One Ration Card');

    const channels = getPdsComplaintChannels();
    expect(channels.some(c => c.contact.includes('1967'))).toBe(true);
    expect(channels.some(c => c.channel.includes('Jan Sunwai'))).toBe(true);
  });

  it('should list shop inspection checklist for Supply Inspectors', async () => {
    const { getShopInspectionChecklist } = await import('./upPdsStockService');
    const items = getShopInspectionChecklist();
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.some(i => i.includes('calibration seal'))).toBe(true);
    expect(items.some(i => i.includes('e-PoS opening balance'))).toBe(true);
  });
});
