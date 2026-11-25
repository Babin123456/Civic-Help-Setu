import { describe, it, expect } from 'vitest';
import {
  calculatePecuniaryJurisdiction,
  assessComplaintReadiness,
  generateComplaintMemorandum,
  JURISDICTION_THRESHOLDS,
  DEFICIENCY_TYPES,
  MANDATORY_LEGAL_DISCLAIMER
} from './consumerComplaintReadinessService';

describe('consumerComplaintReadinessService', () => {
  it('should define statutory pecuniary jurisdiction accurately', () => {
    // District: <= 50 Lakhs
    const resDistrict = calculatePecuniaryJurisdiction(2500000);
    expect(resDistrict.tier).toBe('DISTRICT');
    expect(resDistrict.commission.code).toBe('DISTRICT_COMMISSION');

    // State: 50L - 2 Cr
    const resState = calculatePecuniaryJurisdiction(7500000);
    expect(resState.tier).toBe('STATE');
    expect(resState.commission.code).toBe('STATE_COMMISSION');

    // National: > 2 Cr
    const resNational = calculatePecuniaryJurisdiction(25000000);
    expect(resNational.tier).toBe('NATIONAL');
    expect(resNational.commission.code).toBe('NATIONAL_COMMISSION');
  });

  it('should handle invalid consideration amounts gracefully', () => {
    const invalidRes = calculatePecuniaryJurisdiction(-100);
    expect(invalidRes.error).toBeDefined();
    expect(invalidRes.commission.code).toBe('DISTRICT_COMMISSION');
  });

  it('should evaluate valid complaint readiness and include e-Jagriti info', () => {
    const complaint = {
      complainantName: 'Sunil Verma',
      complainantAddress: 'B-12, Sector 18, Noida',
      oppositePartyName: 'ABC Electronics Pvt Ltd',
      oppositePartyAddress: 'Plot 4, Okhla Ind Area, New Delhi',
      paidAmount: 45000,
      causeOfActionDate: new Date().toISOString().split('T')[0],
      documents: ['invoice_or_receipt', 'legal_notice_or_email'],
      chronology: [
        { date: '2024-01-10', description: 'Purchased LED Television for ₹45,000' },
        { date: '2024-01-15', description: 'Screen failed completely with no display' },
        { date: '2024-01-20', description: 'Customer support refused replacement or refund' }
      ]
    };

    const readiness = assessComplaintReadiness(complaint);
    expect(readiness.readyToDraft).toBe(true);
    expect(readiness.jurisdiction.tier).toBe('DISTRICT');
    expect(readiness.errors).toHaveLength(0);
    expect(readiness.eDaakhilPortalUrl).toContain('edaakhil.nic.in');
    expect(readiness.disclaimer).toBe(MANDATORY_LEGAL_DISCLAIMER);
  });

  it('should detect missing mandatory evidence and statutory limitation warnings', () => {
    const complaint = {
      complainantName: '',
      oppositePartyName: '',
      paidAmount: 0,
      causeOfActionDate: '2020-01-01', // older than 2 years
      documents: []
    };

    const readiness = assessComplaintReadiness(complaint);
    expect(readiness.readyToDraft).toBe(false);
    expect(readiness.errors.length).toBeGreaterThanOrEqual(3);
    expect(readiness.warnings.some(w => w.includes('limitation') || w.includes('2 years'))).toBe(true);
  });

  it('should format a formal complaint memorandum with required sections and disclaimer', () => {
    const complaint = {
      complainantName: 'Kavita Roy',
      complainantAddress: 'Salt Lake Sector 1, Kolkata',
      oppositePartyName: 'FastFly Airlines Ltd',
      oppositePartyAddress: 'Terminal 1B, Delhi Airport',
      districtOrCity: 'North 24 Parganas',
      paidAmount: 18000,
      compensationClaimed: 50000,
      litigationCostClaimed: 15000,
      causeOfActionDate: '2024-02-14',
      chronology: [{ date: '2024-02-14', description: 'Arbitrary flight cancellation without refund' }]
    };

    const memo = generateComplaintMemorandum(complaint);
    expect(memo).toContain('BEFORE THE HON\'BLE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION');
    expect(memo).toContain('Kavita Roy');
    expect(memo).toContain('FastFly Airlines Ltd');
    expect(memo).toContain('PRAYER / RELIEF SOUGHT');
    expect(memo).toContain('IMPORTANT STATUTORY DISCLAIMER:');
  });
});
