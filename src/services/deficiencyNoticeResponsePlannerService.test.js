import { describe, it, expect } from 'vitest';
import {
  DEADLINE_TYPE,
  DEFICIENCY_CHANNEL,
  DISCLAIMER_TEXT,
  extractNoticeDetails,
  generateCorrectionChecklist,
  parseDeficienciesFromText,
  redactNoticePlan,
} from './deficiencyNoticeResponsePlannerService.js';

describe('deficiencyNoticeResponsePlannerService', () => {
  it('extracts notice details from a clean single-deficiency notice', () => {
    const rawNotice = `
      Office of the Tahsildar, Revenue Department
      Ref No: TN/REV/2026/88921
      Date: 12/03/2026

      Subject: Rejection / Deficiency Memo for Caste Certificate Application

      Upon scrutiny, it is found that the electricity bill submitted as residence proof is older than 6 months.
      Please rectify the defect and submit the corrected document on or before 28/03/2026.
    `;

    const extracted = extractNoticeDetails({ rawText: rawNotice, pageCount: 1 });

    expect(extracted.applicationReference.value).toBe('TN/REV/2026/88921');
    expect(extracted.applicationReference.confidence).toBeGreaterThan(0.8);
    expect(extracted.noticeDate.value).toBe('12/03/2026');
    expect(extracted.deficiencies.length).toBe(1);
    expect(extracted.deficiencies[0].code).toBe('ADDRESS_PROOF_INVALID');
    expect(extracted.deficiencies[0].category).toBe('Address Proof');
    expect(extracted.deficiencies[0].verifiedSourceUrl).toContain('uidai.gov.in');

    // Deadline is explicitly printed
    expect(extracted.deadline.type).toBe(DEADLINE_TYPE.EXTRACTED);
    expect(extracted.deadline.deadlineDate).toBe('28/03/2026');

    // Contains disclaimer and no auto submission
    expect(extracted.disclaimer).toBe(DISCLAIMER_TEXT);
  });

  it('handles multiple deficiencies present in the same notice', () => {
    const multiNotice = `
      Collectorate Office, Public Grievance Cell
      Memo No: MH/PUD/4412
      Date: 01/04/2026

      Deficiencies identified:
      1. Signature mismatch observed between Form A and submitted affidavit.
      2. Challan for statutory fee payment was unverified in treasury records.
      3. The submitted annual income certificate is expired for the current financial year.
      Submit rectification within 15 days of notice date.
    `;

    const extracted = extractNoticeDetails({ rawText: multiNotice });

    expect(extracted.deficiencies.length).toBe(3);
    const codes = extracted.deficiencies.map((d) => d.code);
    expect(codes).toContain('SIGNATURE_MISMATCH');
    expect(codes).toContain('FEE_PAYMENT_UNVERIFIED');
    expect(codes).toContain('INCOME_CERTIFICATE_EXPIRED');

    // Relative deadline calculated from notice date
    expect(extracted.deadline.type).toBe(DEADLINE_TYPE.CALCULATED);
    expect(extracted.deadline.windowDays).toBe(15);
    expect(extracted.deadline.calculatedFrom).toBe('01/04/2026');

    // Checklist generation
    const checklist = generateCorrectionChecklist(extracted);
    expect(checklist.length).toBe(3);
    expect(checklist[0].stepNumber).toBe(1);
    expect(checklist[0].isCompleted).toBe(false);
  });

  it('flags conflicting dates as unverified to prevent misleading statutory calculations', () => {
    const conflictingNotice = `
      Municipal Corporation Office
      Ref: DL/MC/99128
      Notice Date: 10/01/2026
      Dispatch Date: 25/02/2026
      Please supply missing electricity bill residence proof within 15 days.
    `;

    const extracted = extractNoticeDetails({ rawText: conflictingNotice });
    expect(extracted.hasConflictingDates).toBe(true);
    expect(extracted.deadline.type).toBe(DEADLINE_TYPE.UNVERIFIED);
    expect(extracted.deadline.explanation).toContain('Conflicting dates detected');
  });

  it('handles poor scans or degraded OCR text with fallback guidance', () => {
    const degradedScan = `
      ... [GARBLED TEXT] ...
      Doc req clarification for applicant.
    `;

    const extracted = extractNoticeDetails({ rawText: degradedScan });
    expect(extracted.applicationReference.value).toBe('UNIDENTIFIED');
    expect(extracted.deficiencies.length).toBeGreaterThanOrEqual(1);
    expect(extracted.deficiencies[0].code).toBe('INSUFFICIENT_PARTICULARS');
    expect(extracted.deadline.type).toBe(DEADLINE_TYPE.UNVERIFIED);
  });

  it('redacts sensitive personal identifiers from notice plan prior to export', () => {
    const plan = {
      applicantName: 'Ramesh Sharma',
      contactEmail: 'ramesh.sharma@example.com',
      mobileNumber: '9876543210',
      aadhaarNumber: '1234 5678 9012',
      panNumber: 'ABCDE1234F',
      applicationReference: { value: 'REF-789' },
      deficiencies: [
        {
          code: 'ADDRESS_PROOF_INVALID',
          quotedReason: 'Document submitted for Ramesh Sharma does not match electricity bill.',
        },
      ],
    };

    const redacted = redactNoticePlan(plan, ['Ramesh Sharma']);

    expect(redacted.aadhaarNumber).toBe('[REDACTED_AADHAAR]');
    expect(redacted.panNumber).toBe('[REDACTED_PAN]');
    expect(redacted.mobileNumber).toBe('[REDACTED_PHONE]');
    expect(redacted.contactEmail).toBe('[REDACTED_EMAIL]');
    expect(redacted.applicantName).toBe('[REDACTED_USER_ID]');
    expect(redacted.deficiencies[0].quotedReason).toContain('[REDACTED_USER_ID]');
  });
});
