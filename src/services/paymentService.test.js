import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createPaymentRecord,
  getPaymentRecords,
  getPaymentRecordById,
  updatePaymentRecord,
  deletePaymentRecord,
  calculateServicePaymentTotals,
  calculateJourneyBalance,
  recordRefund,
  exportPaymentRecords,
  getEnrichedFeeBreakdown,
  validatePaymentRecord,
  groupPaymentsByService,
  isDisputedPayment,
  isOfficiallyVerifiedPayment,
  defaultPaymentRecord,
  PAYMENT_STATUS,
  STORAGE,
} from './paymentService';
import { getFeeVersionHistory, getFeeHistoricalVersion } from './feeTransparencyService';

const TEST_SERVICE_ID = 'test-service-123';

describe('paymentService (#647)', () => {
  beforeEach(() => {
    // Only reset localStorage mock, not STORAGE data
    // STORAGE data management is handled per-test via afterEach
    let store = {};
    globalThis.localStorage = {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => {
        store[key] = String(value);
      },
      removeItem: (key) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  });

  afterEach(() => {
    // Clear STORAGE data after each test to prevent cross-test contamination
    STORAGE.clearAll();
  });

  describe('Acceptance Criteria: Payment Record Creation', () => {
    it('creates a valid payment record with required fields', () => {
      const record = createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Driving License',
        amount: 500,
        paymentMode: 'UPI',
      });

      expect(record).toBeDefined();
      expect(record.id).toBeDefined();
      expect(record.serviceId).toBe(TEST_SERVICE_ID);
      expect(record.serviceName).toBe('Driving License');
      expect(record.amount).toBe(500);
      expect(record.paymentMode).toBe('UPI');
      expect(record.isOfficialVerified).toBe(true);
      expect(record.isDisputed).toBe(false);
      expect(record.version).toBe(1);
    });

    it('creates a payment record with all optional fields', () => {
      const record = createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Passport Application',
        amount: 1500,
        paymentMode: 'NET_BANKING',
        paymentDate: '2026-01-15',
        feeComponent: 'tier-standard-36',
        receiptNumber: 'SRN-2026-001',
        receiptAttachment: 'receipts/passport-2026-001.pdf',
        jurisdiction: { level: 'state', states: ['Maharashtra'], districts: ['Mumbai'] },
        notes: 'Paid at RTO counter, received computer-generated receipt',
      });

      expect(record.serviceId).toBe(TEST_SERVICE_ID);
      expect(record.paymentDate).toBe('2026-01-15');
      expect(record.feeComponent).toBe('tier-standard-36');
      expect(record.receiptNumber).toBe('SRN-2026-001');
      expect(record.receiptAttachment).toContain('receipts/passport-2026-001.pdf');
      expect(record.jurisdiction.states).toEqual(['Maharashtra']);
      expect(record.notes).toBe('Paid at RTO counter, received computer-generated receipt');
    });

    it('validates payment record correctly', () => {
      // Valid record
      const validRecord = {
        id: 'pay-001',
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 100,
        currency: 'INR',
        paymentMode: 'UPI',
      };
      const validResult = validatePaymentRecord(validRecord);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Invalid: missing serviceId
      const invalidNoServiceId = {
        ...validRecord,
        serviceId: '',
      };
      const result1 = validatePaymentRecord(invalidNoServiceId);
      expect(result1.isValid).toBe(false);
      expect(result1.errors.some((e) => e.includes('Service ID'))).toBe(true);

      // Invalid: negative amount
      const invalidNegativeAmount = {
        ...validRecord,
        amount: -50,
      };
      const result2 = validatePaymentRecord(invalidNegativeAmount);
      expect(result2.isValid).toBe(false);
      expect(result2.errors.some((e) => e.includes('non-negative'))).toBe(true);

      // Invalid: invalid payment mode
      const invalidMode = {
        ...validRecord,
        paymentMode: 'INVALID_MODE',
      };
      const result3 = validatePaymentRecord(invalidMode);
      expect(result3.isValid).toBe(false);
      expect(result3.errors.some((e) => e.includes('Valid payment mode'))).toBe(true);
    });
  });

  describe('Acceptance Criteria: Record Retrieval', () => {
    it('retrieves payment records for a service', () => {
      // Create some records
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 100,
        paymentMode: 'UPI',
      });
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 200,
        paymentMode: 'NET_BANKING',
      });

      const records = getPaymentRecords(TEST_SERVICE_ID);
      expect(records).toBeDefined();
      expect(records.length).toBe(2);
    });

    it('retrieves a specific payment record by ID', () => {
      const created = createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 100,
        paymentMode: 'UPI',
      });

      const retrieved = getPaymentRecordById(TEST_SERVICE_ID, created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.amount).toBe(100);
    });

    it('returns null for non-existent record', () => {
      const retrieved = getPaymentRecordById(TEST_SERVICE_ID, 'non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('Acceptance Criteria: Payment Record Updates and Deletion', () => {
    it('updates an existing payment record', () => {
      const created = createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 100,
        paymentMode: 'UPI',
      });

      const updated = updatePaymentRecord(TEST_SERVICE_ID, created.id, {
        amount: 250,
        notes: 'Updated notes',
      });

      expect(updated).toBeDefined();
      expect(updated.amount).toBe(250);
      expect(updated.notes).toBe('Updated notes');
      expect(updated.updatedAt).toBeDefined();
    });

    it('returns null when updating non-existent record', () => {
      const updated = updatePaymentRecord(TEST_SERVICE_ID, 'non-existent-id', {
        amount: 500,
      });
      expect(updated).toBeNull();
    });

    it('deletes a payment record', () => {
      const created = createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 100,
        paymentMode: 'UPI',
      });

      const deleted = deletePaymentRecord(TEST_SERVICE_ID, created.id);
      expect(deleted).toBeDefined();
      expect(deleted.id).toBe(created.id);

      const records = getPaymentRecords(TEST_SERVICE_ID);
      expect(records.length).toBe(0);
    });

    it('clears all payment records for a service', () => {
      // Create multiple records
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 100,
        paymentMode: 'UPI',
      });
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 200,
        paymentMode: 'NET_BANKING',
      });

      // Verify records exist before clearing
      let records = getPaymentRecords(TEST_SERVICE_ID);
      expect(records.length).toBe(2);

      // Clear all records
      STORAGE.clearAll();

      // Verify records are cleared
      records = getPaymentRecords(TEST_SERVICE_ID);
      expect(records.length).toBe(0);
    });
  });

  describe('Acceptance Criteria: Multiple Payments Linked to Service Journey', () => {
    it('supports multiple payments linked to one service journey', () => {
      // Record multiple payments
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Driving License',
        amount: 500,
        paymentMode: 'UPI',
        feeComponent: 'tier-dl-single-class',
      });
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Driving License',
        amount: 200,
        paymentMode: 'CASH',
        feeComponent: 'dl-smartcard-issue',
      });
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Driving License',
        amount: 300,
        paymentMode: 'CHALLAN',
        feeComponent: 'dl-test-statutory',
        isDisputed: true, // One is disputed
      });

      const records = getPaymentRecords(TEST_SERVICE_ID);
      expect(records.length).toBe(3);

      // Verify groupPaymentsByService groups records by serviceId
      const grouped = groupPaymentsByService(records);
      // Should have at least one group
      const groupKeys = Object.keys(grouped);
      expect(groupKeys.length).toBeGreaterThan(0);
      // The first group should have totalPayments of 3 and totalAmount of 1000
      const firstGroupKey = groupKeys[0];
      expect(grouped[firstGroupKey].totalPayments).toBe(3);
      expect(grouped[firstGroupKey].totalAmount).toBe(1000); // 500 + 200 + 300
    });

    it('calculates official vs disputed totals correctly', () => {
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 100,
        paymentMode: 'UPI',
      });
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 50,
        paymentMode: 'CASH',
        isDisputed: true,
      });

      const totals = calculateServicePaymentTotals(TEST_SERVICE_ID);
      expect(totals.totalPayments).toBe(2);
      expect(totals.totalAmount).toBe(150);
      expect(totals.officialCount).toBe(1);
      expect(totals.officialTotalAmount).toBe(100);
      expect(totals.disputedCount).toBe(1);
      expect(totals.disputedTotalAmount).toBe(50);
    });
  });

  describe('Acceptance Criteria: Export with Redacted Identifiers', () => {
    it('exports payment records with redacted transaction identifiers', () => {
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 100,
        paymentMode: 'UPI',
        receiptNumber: 'SRN-SECRET-123',
        receiptAttachment: 'receipts/file.pdf',
      });

      const exportData = exportPaymentRecords(TEST_SERVICE_ID);

      expect(exportData).toBeDefined();
      expect(exportData.totalRecords).toBe(1);
      expect(exportData.totalAmount).toBe(100);

      // Check that identifiers are redacted
      const record = exportData.records[0];
      expect(record.receiptNumber).toBe('[REDACTED]');
      expect(record.receiptAttachment).toBe('[REDACTED]');
      // ID should also be redacted in the export
      expect(record.id).toBeDefined(); // ID is preserved but may have redaction pattern
    });

    it('export has correct summary statistics', () => {
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 100,
        paymentMode: 'UPI',
      });
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 50,
        paymentMode: 'CASH',
        isDisputed: true,
      });

      const exportData = exportPaymentRecords(TEST_SERVICE_ID);

      expect(exportData.summary.officialTotal).toBe(100);
      expect(exportData.summary.disputedTotal).toBe(50);
      expect(exportData.summary.totalCount).toBe(2);
      expect(exportData.summary.officialCount).toBe(1);
      expect(exportData.summary.disputedCount).toBe(1);
    });

    it('export can omit redaction for internal audit', () => {
      createPaymentRecord({
        serviceId: TEST_SERVICE_ID,
        serviceName: 'Test Service',
        amount: 100,
        paymentMode: 'UPI',
      });

      // Export without redaction (internal use)
      const exportData = exportPaymentRecords(TEST_SERVICE_ID, { redactIdentifiers: false });

      expect(exportData.metadata.exportIncludesIdentifiers).toBe(true);
      // Records should contain original identifiers
      const record = exportData.records[0];
      expect(record.receiptNumber).not.toBe('[REDACTED]');
    });
  });

  describe('Acceptance Criteria: Enriched Fee Breakdown with Payment Status', () => {
    it('enriches fee breakdown with payment status', () => {
      // Create a payment record
      createPaymentRecord({
        serviceId: 'passport',
        serviceName: 'Passport Application',
        amount: 1500,
        paymentMode: 'UPI',
        feeComponent: 'tier-standard-36',
      });

      const enriched = getEnrichedFeeBreakdown('passport');

      expect(enriched).toBeDefined();
      expect(enriched.conditionalTiers).toBeDefined();
      expect(enriched.officialStatutoryFees).toBeDefined();
      expect(enriched.optionalProviderCharges).toBeDefined();
      expect(enriched.paidComponents).toBeDefined();

      // Check that the selected tier shows as paid
      const standardTier = enriched.conditionalTiers.find((t) => t.id === 'tier-standard-36');
      expect(standardTier).toBeDefined();
      expect(standardTier.isPaid).toBe(true);
      expect(standardTier.paidAmount).toBe(1500);
    });

    it('handles services with no payment records', () => {
      const enriched = getEnrichedFeeBreakdown('aadhaar-card');

      expect(enriched.paidComponents).toBeDefined();
      expect(enriched.paidComponents.length).toBe(0);
      expect(enriched.totalPaidAmount).toBe(0);
    });
  });

  describe('Acceptance Criteria: Payment Status Checks', () => {
    it('identifies disputed payments', () => {
      const disputedRecord = {
        ...defaultPaymentRecord,
        id: 'pay-disputed-1',
        isDisputed: true,
      };
      expect(isDisputedPayment(disputedRecord)).toBe(true);

      const verifiedRecord = {
        ...defaultPaymentRecord,
        id: 'pay-verified-1',
        isDisputed: false,
      };
      expect(isDisputedPayment(verifiedRecord)).toBe(false);
    });

    it('identifies officially verified payments', () => {
      const verifiedRecord = {
        ...defaultPaymentRecord,
        isOfficialVerified: true,
      };
      expect(isOfficiallyVerifiedPayment(verifiedRecord)).toBe(true);

      const unverifiedRecord = {
        ...defaultPaymentRecord,
        isOfficialVerified: false,
      };
      expect(isOfficiallyVerifiedPayment(unverifiedRecord)).toBe(false);
    });
  });

  describe('Acceptance Criteria: Default Payment Record Template', () => {
    it('has correct default values', () => {
      expect(defaultPaymentRecord.serviceId).toBe('');
      expect(defaultPaymentRecord.serviceName).toBe('');
      expect(defaultPaymentRecord.amount).toBe(0);
      expect(defaultPaymentRecord.currency).toBe('INR');
      expect(defaultPaymentRecord.paymentMode).toBe('UPI');
      expect(defaultPaymentRecord.isOfficialVerified).toBe(true);
      expect(defaultPaymentRecord.isDisputed).toBe(false);
      expect(defaultPaymentRecord.version).toBe(1);
    });
  });

  describe('Acceptance Criteria: Payment Status Constants', () => {
    it('defines valid payment statuses', () => {
      expect(PAYMENT_STATUS).toContain('pending');
      expect(PAYMENT_STATUS).toContain('completed');
      expect(PAYMENT_STATUS).toContain('failed');
      expect(PAYMENT_STATUS).toContain('refunded');
    });
  });

  describe('Acceptance Criteria: Historical Fee Versions and Auditing (#647)', () => {
    it('provides auditable fee history for civic services', () => {
      const history = getFeeVersionHistory('passport');
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(3);

      // Verify structure of version records
      const v1 = history.find((v) => v.version === 1);
      const v2 = history.find((v) => v.version === 2);
      const v3 = history.find((v) => v.version === 3);

      expect(v1).toBeDefined();
      expect(v1.effectiveDate).toBe('2024-01-01');
      expect(v1.verificationDate).toBeDefined();
      expect(v1.source).toContain('Passport Rules 1980');

      expect(v2).toBeDefined();
      expect(v2.effectiveDate).toBe('2025-03-15');
      expect(v2.notes).toContain('Tatkaal');

      expect(v3).toBeDefined();
      expect(v3.effectiveDate).toBe('2026-07-10');
      expect(v3.verificationDate).toBe('2026-07-10');
    });

    it('retrieves specific historical fee version details', () => {
      const versionRecord = getFeeHistoricalVersion('passport', 2);
      expect(versionRecord).toBeDefined();
      expect(versionRecord.version).toBe(2);
      expect(versionRecord.notes).toContain('Tatkaal');

      const nonExistent = getFeeHistoricalVersion('passport', 999);
      expect(nonExistent).toBeNull();
    });

    it('records payments associated with the effective fee schedule version', () => {
      const payment = createPaymentRecord({
        serviceId: 'passport',
        serviceName: 'Passport Application',
        amount: 1500,
        paymentMode: 'UPI',
        feeScheduleVersion: 3,
      });

      expect(payment.feeScheduleVersion).toBe(3);
      expect(payment.jurisdiction).toBeDefined();
      expect(payment.jurisdiction.level).toBe('national');
    });
  });

  describe('Acceptance Criteria: Partial Payments Tracking (#647)', () => {
    it('tracks partial payment progress against statutory fee requirements', () => {
      const journeyId = 'journey-passport-partial-01';

      // First partial payment: ₹500 towards ₹1,500 standard passport fee
      createPaymentRecord({
        serviceId: 'passport',
        journeyId,
        amount: 500,
        paymentMode: 'UPI',
        feeComponent: 'tier-standard-36',
      });

      const balance1 = calculateJourneyBalance('passport', journeyId, 'tier-standard-36');
      expect(balance1.statutoryRequired).toBe(1500);
      expect(balance1.totalPaid).toBe(500);
      expect(balance1.netPaid).toBe(500);
      expect(balance1.remainingBalance).toBe(1000);
      expect(balance1.isPartiallyPaid).toBe(true);
      expect(balance1.isFullyPaid).toBe(false);
      expect(balance1.paymentCount).toBe(1);

      // Second partial payment: remaining ₹1,000
      createPaymentRecord({
        serviceId: 'passport',
        journeyId,
        amount: 1000,
        paymentMode: 'NET_BANKING',
        feeComponent: 'tier-standard-36',
      });

      const balance2 = calculateJourneyBalance('passport', journeyId, 'tier-standard-36');
      expect(balance2.totalPaid).toBe(1500);
      expect(balance2.netPaid).toBe(1500);
      expect(balance2.remainingBalance).toBe(0);
      expect(balance2.isPartiallyPaid).toBe(false);
      expect(balance2.isFullyPaid).toBe(true);
      expect(balance2.paymentCount).toBe(2);
    });
  });

  describe('Acceptance Criteria: Refunds and Net Totals (#647)', () => {
    it('records refund and adjusts net expenditure correctly', () => {
      const journeyId = 'journey-dl-refund-01';

      const payment = createPaymentRecord({
        serviceId: 'driving-license',
        journeyId,
        amount: 500,
        paymentMode: 'UPI',
        feeComponent: 'tier-dl-single-class',
      });

      // Record full refund
      const refunded = recordRefund('driving-license', payment.id, {
        refundAmount: 500,
        refundDate: '2026-06-01',
        reason: 'Cancelled slot before test appointment',
      });

      expect(refunded).toBeDefined();
      expect(refunded.status).toBe('refunded');
      expect(refunded.refundInfo.refundAmount).toBe(500);
      expect(refunded.refundInfo.isFullRefund).toBe(true);

      // Totals check
      const totals = calculateServicePaymentTotals('driving-license');
      expect(totals.refundedCount).toBe(1);
      expect(totals.refundedTotalAmount).toBe(500);
      expect(totals.netOfficialTotal).toBe(0);

      // Balance check
      const balance = calculateJourneyBalance('driving-license', journeyId, 'tier-dl-single-class');
      expect(balance.totalRefunded).toBe(500);
      expect(balance.netPaid).toBe(0);
      expect(balance.remainingBalance).toBe(500);
      expect(balance.isFullyPaid).toBe(false);
    });

    it('records partial refunds and adjusts remaining balance', () => {
      const journeyId = 'journey-passport-partial-refund';

      const payment = createPaymentRecord({
        serviceId: 'passport',
        journeyId,
        amount: 3500,
        paymentMode: 'CREDIT_CARD',
        feeComponent: 'tier-tatkaal-36',
      });

      // Refund Tatkaal portion (₹2,000)
      recordRefund('passport', payment.id, {
        refundAmount: 2000,
        refundDate: '2026-06-05',
        reason: 'Tatkaal downgraded to normal application',
      });

      const totals = calculateServicePaymentTotals('passport');
      expect(totals.refundedTotalAmount).toBe(2000);
      expect(totals.netOfficialTotal).toBe(1500);

      const balance = calculateJourneyBalance('passport', journeyId, 'tier-tatkaal-36');
      expect(balance.netPaid).toBe(1500);
      expect(balance.remainingBalance).toBe(2000);
    });
  });

  describe('Acceptance Criteria: Disputed / Unknown Charges Separation (#647)', () => {
    it('ensures disputed charges are never presented or counted as official statutory fees', () => {
      const journeyId = 'journey-disputed-test';

      // Official payment
      createPaymentRecord({
        serviceId: 'driving-license',
        journeyId,
        amount: 300,
        paymentMode: 'UPI',
        isDisputed: false,
      });

      // Unofficial agent extortion charge
      createPaymentRecord({
        serviceId: 'driving-license',
        journeyId,
        amount: 2000,
        paymentMode: 'CASH',
        isDisputed: true,
        notes: 'Informal facilitation fee demanded by unauthorized tout outside RTO',
      });

      const totals = calculateServicePaymentTotals('driving-license');
      expect(totals.officialCount).toBe(1);
      expect(totals.officialTotalAmount).toBe(300);
      expect(totals.disputedCount).toBe(1);
      expect(totals.disputedTotalAmount).toBe(2000);
      expect(totals.totalAmount).toBe(2300);

      // Verify journey balance excludes disputed charge completely
      const balance = calculateJourneyBalance('driving-license', journeyId, 'tier-dl-single-class');
      expect(balance.totalPaid).toBe(300);
      expect(balance.remainingBalance).toBe(200); // 500 - 300
    });
  });
});