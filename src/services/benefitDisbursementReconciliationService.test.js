import { describe, it, expect } from 'vitest';
import {
  DISBURSEMENT_STATUS,
  VERIFICATION_STATUS,
  exportRedactedChronology,
  getRedressalGuidance,
  reconcileBenefitTimeline,
  recordBenefitPaymentEvent,
} from './benefitDisbursementReconciliationService.js';

describe('benefitDisbursementReconciliationService', () => {
  it('records a benefit payment event with safe masked account identifiers', () => {
    const event = recordBenefitPaymentEvent({
      schemeName: 'PM-KISAN Samman Nidhi',
      instalmentNumber: 15,
      sanctionedAmount: 2000,
      receivedAmount: 2000,
      expectedDate: '2026-01-15',
      receivedDate: '2026-01-18',
      paymentReference: 'UTR9988776655',
      bankAccountMask: '4321',
      status: DISBURSEMENT_STATUS.USER_REPORTED_RECEIVED,
    });

    expect(event.schemeName).toBe('PM-KISAN Samman Nidhi');
    expect(event.instalmentNumber).toBe(15);
    expect(event.bankAccountMask).toBe('••••4321');
    expect(event.verificationStatus).toBe(VERIFICATION_STATUS.UNVERIFIED_SELF_REPORTED);
  });

  it('strictly rejects storage of sensitive banking credentials and full account numbers', () => {
    expect(() =>
      recordBenefitPaymentEvent({
        schemeName: 'Old Age Pension',
        accountNumber: '1234567890123456',
        pin: '1234',
      })
    ).toThrow(/Security Policy Violation/);

    expect(() =>
      recordBenefitPaymentEvent({
        schemeName: 'Disability Grant',
        otp: '987654',
      })
    ).toThrow(/Security Policy Violation/);
  });

  it('detects duplicate instalment records and flags anomalies', () => {
    const ev1 = recordBenefitPaymentEvent({
      id: 'pay_1',
      schemeName: 'State Widow Pension',
      instalmentNumber: 12,
      sanctionedAmount: 1500,
      receivedAmount: 1500,
      status: DISBURSEMENT_STATUS.USER_REPORTED_RECEIVED,
    });

    const ev2 = recordBenefitPaymentEvent({
      id: 'pay_2',
      schemeName: 'State Widow Pension',
      instalmentNumber: 12, // Duplicate instalment 12
      sanctionedAmount: 1500,
      receivedAmount: null,
      status: DISBURSEMENT_STATUS.PENDING_CONFIRMATION,
    });

    const reconciliation = reconcileBenefitTimeline([ev1, ev2]);
    expect(reconciliation.hasAnomalies).toBe(true);
    const duplicateAnomaly = reconciliation.anomalies.find((a) => a.type === 'DUPLICATE_INSTALMENT');
    expect(duplicateAnomaly).toBeDefined();
    expect(duplicateAnomaly.instalmentNumber).toBe(12);
  });

  it('flags payment reversals and partial disbursements', () => {
    const reversedEvent = recordBenefitPaymentEvent({
      schemeName: 'Rythu Bharosa',
      instalmentNumber: 4,
      sanctionedAmount: 5000,
      receivedAmount: 0,
      status: DISBURSEMENT_STATUS.REVERSED_OR_FAILED,
    });

    const partialEvent = recordBenefitPaymentEvent({
      schemeName: 'Kalaignar Magalir Urimai Thogai',
      instalmentNumber: 7,
      sanctionedAmount: 1000,
      receivedAmount: 500, // Shortfall of ₹500
      status: DISBURSEMENT_STATUS.USER_REPORTED_RECEIVED,
    });

    const reconciliation = reconcileBenefitTimeline([reversedEvent, partialEvent]);
    expect(reconciliation.hasAnomalies).toBe(true);

    const revAnomaly = reconciliation.anomalies.find((a) => a.type === 'PAYMENT_REVERSED');
    expect(revAnomaly).toBeDefined();

    const partialAnomaly = reconciliation.anomalies.find((a) => a.type === 'PARTIAL_DISBURSEMENT');
    expect(partialAnomaly).toBeDefined();
    expect(partialAnomaly.shortfall).toBe(500);
  });

  it('retrieves jurisdiction-specific redressal guidance', () => {
    const central = getRedressalGuidance('CENTRAL');
    expect(central.portalUrl).toContain('pfms.nic.in');
    expect(central.helpline).toBeDefined();

    const tn = getRedressalGuidance('TAMIL_NADU');
    expect(tn.authority).toContain('Tamil Nadu Treasury');
  });

  it('exports a redacted and sorted chronological payment history', () => {
    const events = [
      recordBenefitPaymentEvent({
        schemeName: 'PM-KISAN',
        instalmentNumber: 2,
        expectedDate: '2026-03-01',
        receivedDate: '2026-03-05',
        paymentReference: 'UTR1122334455',
        bankAccountMask: '9876',
        status: DISBURSEMENT_STATUS.USER_REPORTED_RECEIVED,
      }),
      recordBenefitPaymentEvent({
        schemeName: 'PM-KISAN',
        instalmentNumber: 1,
        expectedDate: '2026-01-01',
        receivedDate: '2026-01-03',
        paymentReference: 'UTR9988776655',
        bankAccountMask: '9876',
        status: DISBURSEMENT_STATUS.USER_REPORTED_RECEIVED,
      }),
    ];

    const exportData = exportRedactedChronology(events);
    expect(exportData.totalEntries).toBe(2);
    // Verified chronological sorting (earliest date first)
    expect(exportData.timelineEntries[0].instalmentNumber).toBe(1);
    expect(exportData.timelineEntries[1].instalmentNumber).toBe(2);

    // Verified masking of payment reference
    expect(exportData.timelineEntries[0].paymentReferenceMasked).toContain('••••');
    expect(exportData.timelineEntries[0].accountMask).toBe('••••9876');
  });
});
