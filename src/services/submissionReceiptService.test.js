import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateReceiptVerificationHash,
  buildReceiptSummary,
  formatReceiptAsPlainText,
  downloadReceiptTextFile
} from './submissionReceiptService';

describe('submissionReceiptService', () => {
  const sampleApp = {
    id: 'APP-10294-DL',
    serviceName: 'Driving License Renewal',
    applicantName: 'Vikram Joshi',
    appliedDate: '2026-10-15',
    estimatedCompletion: '2026-10-30',
    status: 'in-progress',
    stages: [
      { title: 'Application Submitted', completed: true, date: '15 Oct 2026' },
      { title: 'Document Verification', current: true, completed: false },
      { title: 'Biometrics & Driving Test', completed: false },
      { title: 'Smart Card Dispatch', completed: false }
    ]
  };

  it('generates a consistent, deterministic verification seal for an application', () => {
    const seal1 = generateReceiptVerificationHash(sampleApp);
    const seal2 = generateReceiptVerificationHash(sampleApp);

    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^CB-SEAL-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('handles null and empty application data safely when generating hash', () => {
    expect(generateReceiptVerificationHash(null)).toBe('CB-SEAL-0000-0000');
    expect(generateReceiptVerificationHash({})).toBe('CB-SEAL-0000-0000');
  });

  it('builds structured receipt summary with all mandatory statutory fields', () => {
    const summary = buildReceiptSummary(sampleApp);

    expect(summary).not.toBeNull();
    expect(summary.receiptNumber).toBe('REC-APP-10294-DL');
    expect(summary.applicationId).toBe('APP-10294-DL');
    expect(summary.serviceName).toBe('Driving License Renewal');
    expect(summary.applicantName).toBe('Vikram Joshi');
    expect(summary.verificationSeal).toContain('CB-SEAL-');
    expect(summary.statutoryNotice).toContain('State Right to Public Services');
    expect(summary.stages).toHaveLength(4);
    expect(summary.stages[0].status).toBe('COMPLETED');
    expect(summary.stages[1].status).toBe('IN PROGRESS');
    expect(summary.stages[2].status).toBe('PENDING');
  });

  it('returns null when building receipt summary for undefined application', () => {
    expect(buildReceiptSummary(null)).toBeNull();
  });

  it('formats receipt summary into plain-text ASCII slip', () => {
    const summary = buildReceiptSummary(sampleApp);
    const textSlip = formatReceiptAsPlainText(summary);

    expect(textSlip).toContain('CIVIC-HELP-SETU PORTAL');
    expect(textSlip).toContain('OFFICIAL SUBMISSION ACKNOWLEDGMENT');
    expect(textSlip).toContain('Reference ID      : APP-10294-DL');
    expect(textSlip).toContain('Applicant Name    : Vikram Joshi');
    expect(textSlip).toContain('Digital Seal      : CB-SEAL-');
    expect(textSlip).toContain('[COMPLETED] Stage 1: Application Submitted');
  });

  describe('downloadReceiptTextFile in DOM environment', () => {
    const originalDocument = global.document;
    const originalURL = global.URL;

    afterEach(() => {
      global.document = originalDocument;
      global.URL = originalURL;
    });

    it('triggers text file download with correct filename and URL revocation', () => {
      const mockClick = vi.fn();
      const mockAppend = vi.fn();
      const mockRemove = vi.fn();
      const mockCreateObjectUrl = vi.fn().mockReturnValue('blob:dummy-receipt-url');
      const mockRevokeObjectUrl = vi.fn();

      global.document = {
        createElement: vi.fn().mockReturnValue({
          href: '',
          download: '',
          click: mockClick
        }),
        body: {
          appendChild: mockAppend,
          removeChild: mockRemove
        }
      };

      global.URL = {
        createObjectURL: mockCreateObjectUrl,
        revokeObjectURL: mockRevokeObjectUrl
      };

      const summary = buildReceiptSummary(sampleApp);
      downloadReceiptTextFile(summary);

      expect(mockCreateObjectUrl).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectUrl).toHaveBeenCalledWith('blob:dummy-receipt-url');
    });

    it('returns safely if document is missing', () => {
      delete global.document;
      const summary = buildReceiptSummary(sampleApp);
      expect(() => downloadReceiptTextFile(summary)).not.toThrow();
    });
  });
});
