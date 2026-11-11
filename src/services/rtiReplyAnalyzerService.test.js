import { describe, it, expect } from 'vitest';
import {
  segmentRtiReply,
  classifyRtiSegment,
  extractRtiDatesAndDeadlines,
  analyzeRtiReply,
  redactRtiText,
  RTI_SECTION_CATEGORY,
  RTI_DISCLAIMER,
} from './rtiReplyAnalyzerService.js';

describe('RTI Reply Analyzer and Appeal Preparation Service', () => {
  it('segments multi-paragraph RTI responses cleanly', () => {
    const raw = `
    With reference to your application dated 01/02/2025 under the RTI Act 2005.

    Point No. 1: The information requested is enclosed herewith as Annexure A.

    Point No. 2: Information cannot be provided as it is exempt from disclosure under Section 8(1)(j) relating to personal information.
    `;

    const segments = segmentRtiReply(raw);
    expect(segments.length).toBe(3);
  });

  it('classifies Section 6(3) transfer correctly with statutory citations', () => {
    const text = 'Your application has been transferred under Section 6(3) of RTI Act 2005 to Public Information Officer, Revenue Department.';
    const res = classifyRtiSegment(text);

    expect(res.category).toBe(RTI_SECTION_CATEGORY.SECTION_6_3_TRANSFER);
    expect(res.citedProvision).toContain('Section 6(3)');
    expect(res.nextAction).toContain('transferee public authority');
  });

  it('classifies Section 8 exemption refusals and attaches appeal window', () => {
    const text = 'The requested files contain third party commercial confidence exempt under Section 8(1)(d) of the Act.';
    const res = classifyRtiSegment(text);

    expect(res.category).toBe(RTI_SECTION_CATEGORY.REJECTION_EXEMPTION_SECTION_8);
    expect(res.statutoryDeadlineDays).toBe(30);
    expect(res.nextAction).toContain('Section 19(1)');
  });

  it('classifies Section 7(3) fee demand notices', () => {
    const text = 'You are requested to deposit an amount of Rs 240 towards photocopying charges for 120 pages under Section 7(3).';
    const res = classifyRtiSegment(text);

    expect(res.category).toBe(RTI_SECTION_CATEGORY.FEE_DEMAND_SECTION_7);
    expect(res.citedProvision).toContain('Section 7(3)');
  });

  it('extracts dates and calculates 30-day First Appeal limitation deadline', () => {
    const fullText = 'Letter issued on 10/03/2025 by CPIO.';
    const dates = extractRtiDatesAndDeadlines(fullText, '2025-03-12');

    expect(dates.dispatchDate).toBe('10/03/2025');
    expect(dates.effectiveReceiptDate).toBe('2025-03-12');
    expect(dates.firstAppealDeadline).toBe('2025-04-11');
    expect(dates.appealSection).toContain('Section 19(1)');
  });

  it('redacts sensitive personal identifiers from RTI draft text', () => {
    const raw = 'Appellant phone is 9876543210 and Aadhaar is 5432 1234 9876 with PAN ABCDE1234F.';
    const redacted = redactRtiText(raw);
    expect(redacted).toContain('[REDACTED_PHONE]');
    expect(redacted).toContain('[REDACTED_AADHAAR]');
    expect(redacted).toContain('[REDACTED_PAN]');
  });

  it('runs full analysis end-to-end and structures appeal outline', () => {
    const sampleReply = `
    OFFICE OF THE CENTRAL PUBLIC INFORMATION OFFICER
    Dated: 05/04/2025

    With reference to application no. RTI/2025/9981:

    Point 1: Information is enclosed herewith.

    Point 2: Minutes of the meeting are exempt under Section 8(1)(a) of the RTI Act.
    `;

    const report = analyzeRtiReply({
      replyText: sampleReply,
      receiptDate: '2025-04-08',
      originalApplicationNumber: 'RTI/2025/9981',
    });

    expect(report.overallOutcome).toBe('PARTIAL_OR_FULL_EXEMPTION_REFUSAL');
    expect(report.appealRecommended).toBe(true);
    expect(report.firstAppealDraftOutline.statutorySection).toContain('Section 19(1)');
    expect(report.disclaimer).toBe(RTI_DISCLAIMER);
  });
});
