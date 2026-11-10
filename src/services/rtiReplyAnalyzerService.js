/**
 * RTI Reply Analyzer and Appeal Preparation Workspace Service
 *
 * Implements structured analysis for Right to Information (RTI Act 2005) official responses:
 * 1. Classifies reply sections into recognized statutory categories:
 *    - 'FULL_DISCLOSURE'
 *    - 'PARTIAL_REFUSAL'
 *    - 'SECTION_6_3_TRANSFER' (Transferred to another public authority)
 *    - 'FEE_DEMAND_SECTION_7' (Additional inspection or copying charges requested)
 *    - 'THIRD_PARTY_NOTICE_SECTION_11' (Notice to third party with 10-day representation)
 *    - 'REJECTION_EXEMPTION_SECTION_8' (Information exempt under specific statutory clause)
 *    - 'DEEMED_REFUSAL_SECTION_7_2' (Failure to respond within statutory 30 days)
 * 2. Extracts statutory provisions, PIO details, appeal deadlines (30-day statutory window), and fee calculations.
 * 3. Highlights exact verbatim response passages grounding each finding.
 * 4. Grounded guidance: Distinguishes educational RTI Act explanations from professional legal advice.
 * 5. Does not speculate or automatically conclude that a PIO acted maliciously or unlawfully.
 * 6. Generates redacted chronological summaries and first appeal draft preparation templates.
 * 7. Provides structured redaction tools ensuring personal appellant identifiers are removed before export.
 */

export const RTI_SECTION_CATEGORY = {
  FULL_DISCLOSURE: 'FULL_DISCLOSURE',
  PARTIAL_REFUSAL: 'PARTIAL_REFUSAL',
  SECTION_6_3_TRANSFER: 'SECTION_6_3_TRANSFER',
  FEE_DEMAND_SECTION_7: 'FEE_DEMAND_SECTION_7',
  THIRD_PARTY_NOTICE_SECTION_11: 'THIRD_PARTY_NOTICE_SECTION_11',
  REJECTION_EXEMPTION_SECTION_8: 'REJECTION_EXEMPTION_SECTION_8',
  DEEMED_REFUSAL_SECTION_7_2: 'DEEMED_REFUSAL_SECTION_7_2',
  UNRESOLVED_NEEDS_REVIEW: 'UNRESOLVED_NEEDS_REVIEW',
};

export const RTI_DISCLAIMER =
  'This tool analyzes official RTI responses and outlines statutory appeal procedures under the RTI Act, 2005. It does not provide legal representation, nor does it establish official misconduct by a Public Information Officer (PIO).';

/**
 * Redacts personal identifiers (names, mobile numbers, Aadhaar, PAN) from an RTI text draft.
 * @param {string} text
 * @returns {string} Redacted text suitable for safe export
 */
export function redactRtiText(text = '') {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\b[2-9][0-9]{3}\s*[0-9]{4}\s*[0-9]{4}\b/g, '[REDACTED_AADHAAR]')
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, '[REDACTED_PAN]')
    .replace(/\b[6-9][0-9]{9}\b/g, '[REDACTED_PHONE]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
}

/**
 * Normalizes and splits text into paragraph/section segments.
 * @param {string} text
 * @returns {string[]}
 */
export function segmentRtiReply(text = '') {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

/**
 * Classifies a single section/paragraph from an RTI reply.
 *
 * @param {string} segmentText
 * @param {number} index
 * @returns {object} Classified segment
 */
export function classifyRtiSegment(segmentText, index = 0) {
  const lower = segmentText.toLowerCase();

  let category = RTI_SECTION_CATEGORY.UNRESOLVED_NEEDS_REVIEW;
  let citedProvision = null;
  let statutoryDeadlineDays = null;
  let nextAction = null;

  if (/section\s+6\s*\(\s*3\s*\)|transferred\s+under\s+section\s+6|transferred\s+to/i.test(lower)) {
    category = RTI_SECTION_CATEGORY.SECTION_6_3_TRANSFER;
    citedProvision = 'Section 6(3) of RTI Act 2005 (Transfer of Application)';
    nextAction = 'Track application with the transferee public authority; response window begins upon their receipt.';
  } else if (/section\s+8\s*\(\s*1\s*\)|exemption\s+under\s+section\s+8|exempt\s+from\s+disclosure|fiduciary|national\s+security|commercial\s+confidence/i.test(lower)) {
    category = RTI_SECTION_CATEGORY.REJECTION_EXEMPTION_SECTION_8;
    citedProvision = 'Section 8(1) of RTI Act 2005 (Exemption from Disclosure)';
    statutoryDeadlineDays = 30;
    nextAction = 'Examine if public interest outweighs protected harm; file First Appeal under Section 19(1) within 30 days.';
  } else if (/section\s+7\s*\(\s*3\s*\)|further\s+fees|cost\s+of\s+reproduction|rs\.?\s*\d+|deposit\s+an\s+amount/i.test(lower)) {
    category = RTI_SECTION_CATEGORY.FEE_DEMAND_SECTION_7;
    citedProvision = 'Section 7(3) of RTI Act 2005 (Additional Fees Calculation)';
    nextAction = 'Verify fee calculation basis (Rs 2/page or actual inspection charges); deposit fee or appeal if delayed past 30 days (free under Sec 7(6)).';
  } else if (/section\s+11|third\s+party|invited\s+third\s+party/i.test(lower)) {
    category = RTI_SECTION_CATEGORY.THIRD_PARTY_NOTICE_SECTION_11;
    citedProvision = 'Section 11 of RTI Act 2005 (Third Party Information)';
    nextAction = 'PIO has allowed 10 days for third party representation before deciding on disclosure.';
  } else if (/deemed\s+refusal|no\s+response\s+received|statutory\s+period\s+elapsed/i.test(lower)) {
    category = RTI_SECTION_CATEGORY.DEEMED_REFUSAL_SECTION_7_2;
    citedProvision = 'Section 7(2) of RTI Act 2005 (Deemed Refusal upon Expiry of 30 Days)';
    statutoryDeadlineDays = 30;
    nextAction = 'File First Appeal immediately under Section 19(1) citing deemed refusal and request free information under Section 7(6).';
  } else if (/enclosed|information\s+is\s+as\s+under|provided\s+herewith|point\s*no\.?\s*\d+\s*:/i.test(lower)) {
    category = RTI_SECTION_CATEGORY.FULL_DISCLOSURE;
    citedProvision = 'Section 7(1) of RTI Act 2005 (Information Access Granted)';
    nextAction = 'Review supplied documents against requested points to ensure no item was omitted.';
  }

  return {
    segmentIndex: index + 1,
    category,
    citedProvision,
    statutoryDeadlineDays,
    nextAction,
    supportingPassage: segmentText,
    confidence: category !== RTI_SECTION_CATEGORY.UNRESOLVED_NEEDS_REVIEW ? 0.9 : 0.35,
  };
}

/**
 * Extracts key dates (dispatch date, receipt date, appeal deadline) from an RTI reply text.
 *
 * @param {string} fullText
 * @param {string} [receiptDateStr]
 * @returns {object} Extracted chronology & deadlines
 */
export function extractRtiDatesAndDeadlines(fullText = '', receiptDateStr = null) {
  const dateRegex = /\b([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4})\b/g;
  const matches = fullText.match(dateRegex) || [];

  const dispatchDate = matches.length > 0 ? matches[0] : null;
  const effectiveReceiptDate = receiptDateStr || dispatchDate;

  let firstAppealDeadline = null;
  if (effectiveReceiptDate) {
    const rDate = new Date(effectiveReceiptDate);
    if (!isNaN(rDate.getTime())) {
      const deadline = new Date(rDate);
      deadline.setDate(deadline.getDate() + 30);
      firstAppealDeadline = deadline.toISOString().split('T')[0];
    }
  }

  return {
    dispatchDate,
    effectiveReceiptDate,
    firstAppealDeadline,
    statutoryAppealWindowDays: 30,
    appealSection: 'Section 19(1) of RTI Act 2005',
  };
}

/**
 * Generates an editable First Appeal draft structure under Section 19(1).
 *
 * @param {object} params
 * @param {string} params.appNumber
 * @param {string} params.faaAuthority
 * @param {string} params.groundText
 * @param {string} params.deadline
 * @returns {string} Text template for the First Appeal memorandum
 */
export function generateFirstAppealMemorandum({
  appNumber = 'RTI-APP-REF',
  faaAuthority = 'First Appellate Authority',
  groundText = 'Information refused without justified exemption under the RTI Act, 2005.',
  deadline = '',
}) {
  return `BEFORE THE FIRST APPELLATE AUTHORITY UNDER RTI ACT, 2005
To: ${faaAuthority}

Subject: First Appeal under Section 19(1) against RTI Application No: ${appNumber}

1. Particulars of Appellant:
   Name & Contact: [APPELLANT DETAILS]

2. Particulars of CPIO/SPIO:
   Designation: Central / State Public Information Officer

3. Date of RTI Application: [APPLICATION DATE]
4. Date of Receipt of Impugned Reply: [RECEIPT DATE] (Statutory Appeal Deadline: ${deadline})

5. Grounds of Appeal:
   ${groundText}

6. Relief Sought:
   - Direction to the CPIO to provide the requested certified records forthwith.
   - Supply of information free of charge under Section 7(6) due to delay or unwarranted refusal.

Verification:
I verify that the contents of this Appeal are true and correct to the best of my knowledge.
Dated: ${new Date().toISOString().split('T')[0]}
`;
}

/**
 * Performs full structured analysis of an RTI reply text.
 *
 * @param {object} params
 * @param {string} params.replyText Raw OCR or digital text of the PIO reply
 * @param {string} [params.receiptDate] Date citizen received the reply letter
 * @param {string} [params.originalApplicationNumber] Tracking reference
 * @returns {object} Complete RTI analysis and appeal preparation dossier
 */
export function analyzeRtiReply({
  replyText = '',
  receiptDate = null,
  originalApplicationNumber = 'RTI-APP-REF',
}) {
  const segments = segmentRtiReply(replyText);
  const classifiedSegments = segments.map((seg, idx) => classifyRtiSegment(seg, idx));
  const dates = extractRtiDatesAndDeadlines(replyText, receiptDate);

  const hasExemption = classifiedSegments.some(
    (s) => s.category === RTI_SECTION_CATEGORY.REJECTION_EXEMPTION_SECTION_8
  );
  const hasTransfer = classifiedSegments.some(
    (s) => s.category === RTI_SECTION_CATEGORY.SECTION_6_3_TRANSFER
  );
  const hasFeeDemand = classifiedSegments.some(
    (s) => s.category === RTI_SECTION_CATEGORY.FEE_DEMAND_SECTION_7
  );
  const hasDeemedRefusal = classifiedSegments.some(
    (s) => s.category === RTI_SECTION_CATEGORY.DEEMED_REFUSAL_SECTION_7_2
  );

  const overallOutcome = hasExemption
    ? 'PARTIAL_OR_FULL_EXEMPTION_REFUSAL'
    : hasDeemedRefusal
    ? 'DEEMED_REFUSAL'
    : hasTransfer
    ? 'TRANSFERRED_SECTION_6_3'
    : hasFeeDemand
    ? 'ADDITIONAL_FEE_DEMANDED'
    : 'DISCLOSURE_PROVIDED';

  const appealRecommended = hasExemption || hasFeeDemand || hasDeemedRefusal;

  const groundText = hasExemption
    ? 'Denial under Section 8 is unsubstantiated; public interest outweighs cited exemption.'
    : hasDeemedRefusal
    ? 'No information provided within 30 days under Section 7(1); constitutes deemed refusal under Section 7(2).'
    : 'Demanded fees are disproportionate or requested beyond the 30-day statutory timeline.';

  return {
    applicationNumber: originalApplicationNumber,
    overallOutcome,
    appealRecommended,
    dates,
    segments: classifiedSegments,
    unresolvedCount: classifiedSegments.filter(
      (s) => s.category === RTI_SECTION_CATEGORY.UNRESOLVED_NEEDS_REVIEW
    ).length,
    firstAppealDraftOutline: appealRecommended
      ? {
          forum: 'First Appellate Authority (FAA)',
          statutorySection: 'Section 19(1), RTI Act 2005',
          limitationDate: dates.firstAppealDeadline,
          grounds: groundText,
          memorandumDraft: generateFirstAppealMemorandum({
            appNumber: originalApplicationNumber,
            groundText,
            deadline: dates.firstAppealDeadline || 'Within 30 Days',
          }),
        }
      : null,
    disclaimer: RTI_DISCLAIMER,
  };
}
