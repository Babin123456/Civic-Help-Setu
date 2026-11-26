import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  exportPaymentsMarkdown,
  exportPaymentsPlainText,
  exportPaymentSummary,
  exportPaymentsCsv,
} from './expenseExportService';
import { createPaymentRecord, STORAGE } from './paymentService';

describe('expenseExportService', () => {
  const TEST_SERVICE = 'passport';
  const TEST_JOURNEY = 'journey-777';

  beforeEach(() => {
    STORAGE.clearAll();
  });

  afterEach(() => {
    STORAGE.clearAll();
  });

  describe('exportPaymentSummary', () => {
    it('returns empty summary structure when no records exist', () => {
      const summary = exportPaymentSummary(TEST_SERVICE, TEST_JOURNEY, { redact: false });
      expect(summary.serviceId).toBe(TEST_SERVICE);
      expect(summary.journeyId).toBe(TEST_JOURNEY);
      expect(summary.totalPaid).toBe(0);
      expect(summary.totalRefunded).toBe(0);
      expect(summary.netTotal).toBe(0);
      expect(summary.paymentCount).toBe(0);
      expect(summary.summaryNotes).toBe('Full details included.');
    });

    it('summarizes confirmed and refunded payments with redaction', () => {
      createPaymentRecord({
        serviceId: TEST_SERVICE,
        journeyId: TEST_JOURNEY,
        amount: 1500,
        paymentMode: 'UPI',
        receiptNumber: 'BHIM-SECRET-1234',
        status: 'confirmed',
      });

      createPaymentRecord({
        serviceId: TEST_SERVICE,
        journeyId: TEST_JOURNEY,
        amount: 500,
        paymentMode: 'NET_BANKING',
        status: 'refunded',
        refundInfo: { refundAmount: 500, refundDate: '2026-02-01', reason: 'Excess slot fee' },
      });

      const summary = exportPaymentSummary(TEST_SERVICE, TEST_JOURNEY, { redact: true });
      expect(summary.totalPaid).toBe(1500);
      expect(summary.totalRefunded).toBe(500);
      expect(summary.netTotal).toBe(1000);
      expect(summary.paymentCount).toBe(1);
      expect(summary.refundCount).toBe(1);
      expect(summary.redact).toBe(true);
      expect(summary.summaryNotes).toContain('redacted');
      // Redacted payments in summary
      expect(summary.payments[0].receiptNumber).toBeNull();
      expect(summary.payments[0].id).toBe('[REDACTED]');
    });
  });

  describe('exportPaymentsMarkdown', () => {
    it('generates placeholder markdown when no payments found', () => {
      const markdown = exportPaymentsMarkdown(TEST_SERVICE, TEST_JOURNEY, { redact: false });
      expect(markdown).toContain(`Civic Payment Export: ${TEST_SERVICE}`);
      expect(markdown).toContain(`**Journey ID:** ${TEST_JOURNEY}`);
      expect(markdown).toContain('No payment records found');
    });

    it('generates redacted markdown stripping sensitive transaction IDs and receipt numbers', () => {
      createPaymentRecord({
        serviceId: TEST_SERVICE,
        journeyId: TEST_JOURNEY,
        amount: 1500,
        paymentMode: 'UPI',
        receiptNumber: 'CONFIDENTIAL-REC-999',
        receiptAttachment: 'private_receipt.pdf',
        notes: 'Paid at counter',
      });

      const markdown = exportPaymentsMarkdown(TEST_SERVICE, TEST_JOURNEY, { redact: true });
      expect(markdown).toContain(`Civic Payment Export: ${TEST_SERVICE}`);
      expect(markdown).toContain('**Redacted:** true');
      expect(markdown).toContain('[REDACTED]');
      expect(markdown).not.toContain('CONFIDENTIAL-REC-999');
      expect(markdown).not.toContain('private_receipt.pdf');
      expect(markdown).toContain('₹1,500');
      expect(markdown).toContain('UPI');
    });

    it('generates unredacted markdown when redact is false', () => {
      createPaymentRecord({
        serviceId: TEST_SERVICE,
        journeyId: TEST_JOURNEY,
        amount: 1500,
        paymentMode: 'UPI',
        receiptNumber: 'CONFIDENTIAL-REC-999',
      });

      const markdown = exportPaymentsMarkdown(TEST_SERVICE, TEST_JOURNEY, { redact: false });
      expect(markdown).toContain('CONFIDENTIAL-REC-999');
      expect(markdown).toContain('**Redacted:** false');
    });
  });

  describe('exportPaymentsPlainText', () => {
    it('generates plain text format without markdown hash characters', () => {
      createPaymentRecord({
        serviceId: TEST_SERVICE,
        journeyId: TEST_JOURNEY,
        amount: 1500,
        paymentMode: 'UPI',
        receiptNumber: 'BHIM-12345',
      });

      const plainText = exportPaymentsPlainText(TEST_SERVICE, TEST_JOURNEY, { redact: true });
      expect(plainText).toContain(`Civic Payment Export: ${TEST_SERVICE}`);
      expect(plainText).not.toContain('#');
      expect(plainText).toContain('Redacted: true');
      expect(plainText).not.toContain('BHIM-12345');
    });
  });

  describe('exportPaymentsCsv', () => {
    it('generates headers when no payments exist', () => {
      const csv = exportPaymentsCsv(TEST_SERVICE, TEST_JOURNEY, { redact: false });
      expect(csv).toContain('Transaction ID,Date,Amount,Currency,Mode,Category,Receipt Number,Status,Disputed,Notes');
    });

    it('generates redacted CSV rows with masked identifiers', () => {
      createPaymentRecord({
        serviceId: TEST_SERVICE,
        journeyId: TEST_JOURNEY,
        amount: 1500,
        paymentMode: 'UPI',
        receiptNumber: 'CONFIDENTIAL-REC-CSV',
      });

      const csv = exportPaymentsCsv(TEST_SERVICE, TEST_JOURNEY, { redact: true });
      expect(csv).toContain('[REDACTED]');
      expect(csv).not.toContain('CONFIDENTIAL-REC-CSV');
      expect(csv).toContain('1500');
      expect(csv).toContain('UPI');
    });
  });
});
