import { describe, it, expect } from 'vitest';
import {
  createReliefCampaign,
  recordContributionReceipt,
  recordDistributionDispatch,
  reconcileReliefLedger,
  exportReliefLedgerReport,
  CAMPAIGN_STATUSES,
  RELIEF_CATEGORIES
} from './reliefLedgerService';

describe('reliefLedgerService', () => {
  it('should define campaign statuses and relief categories', () => {
    expect(CAMPAIGN_STATUSES.ACTIVE).toBe('ACTIVE');
    expect(RELIEF_CATEGORIES.RATION_KITS.unit).toBe('kits');
    expect(RELIEF_CATEGORIES.DRINKING_WATER.unit).toBe('litres');
  });

  it('should create authorized relief campaign and validate fields', () => {
    const res = createReliefCampaign({
      campaignName: 'Assam Flood Relief Emergency Drive',
      disasterAuthority: 'District Disaster Management Authority (DDMA) Cachar',
      reliefCategory: 'RATION_KITS',
      targetQuantity: 5000
    });

    expect(res.success).toBe(true);
    expect(res.campaign.status).toBe(CAMPAIGN_STATUSES.ACTIVE);
    expect(res.campaign.category.unit).toBe('kits');
    expect(res.campaign.totalReceived).toBe(0);

    const invalid = createReliefCampaign({ campaignName: 'No' });
    expect(invalid.success).toBe(false);
    expect(invalid.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should record consignment receipt and update depot balance', () => {
    const campaign = {
      campaignId: 'rel_test',
      status: CAMPAIGN_STATUSES.ACTIVE,
      category: RELIEF_CATEGORIES.RATION_KITS,
      totalReceived: 0,
      totalDistributed: 0
    };

    const receiptRes = recordContributionReceipt(campaign, {
      quantityReceived: 200,
      consignmentChallanNo: 'CHAL/2024/09',
      donorOrgPseudonym: 'Red Cross State Chapter'
    });

    expect(receiptRes.success).toBe(true);
    expect(receiptRes.batchRecord.quantityReceived).toBe(200);
    expect(receiptRes.updatedTotals.currentBalance).toBe(200);
  });

  it('should prevent distribution dispatch exceeding depot available stock', () => {
    const campaign = {
      campaignId: 'rel_test',
      status: CAMPAIGN_STATUSES.ACTIVE,
      category: RELIEF_CATEGORIES.RATION_KITS,
      totalReceived: 100,
      totalDistributed: 80 // only 20 remaining
    };

    const dispatchAttempt = recordDistributionDispatch(campaign, {
      quantityDispatched: 50, // exceeds 20
      receivingCampLocation: 'Relief Camp Silchar Town'
    });

    expect(dispatchAttempt.success).toBe(false);
    expect(dispatchAttempt.error).toContain('Insufficient stock');
  });

  it('should successfully record valid distribution dispatch', () => {
    const campaign = {
      campaignId: 'rel_test',
      status: CAMPAIGN_STATUSES.ACTIVE,
      category: RELIEF_CATEGORIES.RATION_KITS,
      totalReceived: 500,
      totalDistributed: 200
    };

    const dispatchRes = recordDistributionDispatch(campaign, {
      quantityDispatched: 150,
      receivingCampLocation: 'Shelter Ward 4',
      beneficiaryCount: 525
    });

    expect(dispatchRes.success).toBe(true);
    expect(dispatchRes.updatedTotals.totalDistributed).toBe(350);
    expect(dispatchRes.updatedTotals.remainingDepotStock).toBe(150);
  });

  it('should reconcile receipts and dispatches accurately', () => {
    const campaign = {
      campaignId: 'rel_audited',
      campaignName: 'Cyclone Biparjoy Coastal Relief',
      category: RELIEF_CATEGORIES.DRINKING_WATER
    };

    const receipts = [
      { quantityReceived: 5000 },
      { quantityReceived: 3000 }
    ];

    const dispatches = [
      { quantityDispatched: 4000, beneficiaryCountEstimate: 12000 },
      { quantityDispatched: 3500, beneficiaryCountEstimate: 10500 }
    ];

    const rec = reconcileReliefLedger(campaign, receipts, dispatches);
    expect(rec.cumulativeReceived).toBe(8000);
    expect(rec.cumulativeDistributed).toBe(7500);
    expect(rec.depotBalance).toBe(500);
    expect(rec.isReconciled).toBe(true);
    expect(rec.status).toBe('RECONCILED_HEALTHY');
  });

  it('should export formatted markdown reconciliation dossier with privacy notice', () => {
    const campaign = {
      campaignName: 'Wayanad Landslide Emergency Food Drive',
      disasterAuthority: 'DDMA Wayanad',
      category: RELIEF_CATEGORIES.RATION_KITS,
      status: 'AUDITED'
    };

    const reconciliation = {
      depotBalance: 400,
      cumulativeReceived: 2500,
      totalReceiptsCount: 5,
      cumulativeDistributed: 2100,
      totalDispatchesCount: 8,
      estimatedBeneficiariesServed: 7350,
      status: 'RECONCILED_HEALTHY'
    };

    const doc = exportReliefLedgerReport(campaign, reconciliation);
    expect(doc).toContain('# Public Relief & Material Distribution Reconciliation Ledger');
    expect(doc).toContain('Wayanad Landslide Emergency Food Drive');
    expect(doc).toContain('DDMA Wayanad');
    expect(doc).toContain('Privacy Safeguard');
  });
});
