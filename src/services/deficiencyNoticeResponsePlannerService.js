/**
 * Civic Application Rejection and Deficiency Notice Response Planner Service
 *
 * Provides a structured, privacy-preserving workflow for citizens who have received
 * rejection notices, deficiency memos, or requests for additional information:
 *
 * 1. Notice Data Extraction & Traceability:
 *    - Parses key notice elements (notice date, application reference, issuing office,
 *      deficiency statements, deadlines) while recording source page / line references.
 *    - Assigns confidence scores to each extracted field and marks whether it was
 *      machine-extracted or confirmed by the user.
 * 2. Deadline Verification & Classification:
 *    - Classifies response deadlines into EXTRACTED (explicitly printed), CALCULATED
 *      (computed from notice date + statutory window), or UNVERIFIED (conflicting or ambiguous dates).
 * 3. Deficiency Separation & Verified Service Guidance Mapping:
 *    - Strictly separates exact quoted notice text from AI interpretation.
 *    - Maps identified deficiency categories (e.g. invalid proof of address, signature mismatch,
 *      missing revenue stamp, incomplete income certificate) to verified official resolution guidelines.
 * 4. User-Editable Action Checklist:
 *    - Creates an interactive correction checklist enabling citizens to confirm or correct
 *      extracted data, upload rectified documents, and select official redressal channels.
 * 5. Privacy & Data Minimization:
 *    - Redacts sensitive identifiers (Aadhaar, PAN, phone numbers, application IDs) prior to export.
 *    - Never performs automated submissions or promises guaranteed outcomes.
 */

export const DEADLINE_TYPE = {
  EXTRACTED: 'EXTRACTED',
  CALCULATED: 'CALCULATED',
  UNVERIFIED: 'UNVERIFIED',
};

export const DEFICIENCY_CHANNEL = {
  ONLINE_PORTAL: 'ONLINE_PORTAL',
  IN_PERSON_COUNTER: 'IN_PERSON_COUNTER',
  APPELLATE_AUTHORITY: 'APPELLATE_AUTHORITY',
  POSTAL_SUBMISSION: 'POSTAL_SUBMISSION',
};

export const DISCLAIMER_TEXT =
  'Notice: This response plan is an informational preparation aid. Civic-Help-Setu does not ' +
  'guarantee outcome approval or automatically submit responses on behalf of applicants. Please ' +
  'verify all details with the issuing authority before final submission.';

/**
 * Standard mapping of recognized civic deficiency categories to verified remediation guidance.
 */
export const VERIFIED_DEFICIENCY_GUIDANCE = {
  ADDRESS_PROOF_INVALID: {
    category: 'Address Proof',
    title: 'Rectify Invalid or Expired Proof of Address',
    guidance:
      'Ensure the address document is dated within the last 3 months and matches the applicant ' +
      'name exactly as stated in the application. Acceptable documents typically include electricity ' +
      'bills, registered rent agreements, or voter ID cards.',
    verifiedSourceUrl: 'https://uidai.gov.in/ecosystem/authentication-devices-documents.html',
    recommendedChannel: DEFICIENCY_CHANNEL.ONLINE_PORTAL,
    standardResponseWindowDays: 15,
  },
  INCOME_CERTIFICATE_EXPIRED: {
    category: 'Income Certificate',
    title: 'Provide Current Financial Year Income Certificate',
    guidance:
      'Income certificates issued for prior financial years must be renewed through the local ' +
      'Tehsildar or revenue portal before resubmitting.',
    verifiedSourceUrl: 'https://services.india.gov.in/service/detail/apply-for-income-certificate',
    recommendedChannel: DEFICIENCY_CHANNEL.ONLINE_PORTAL,
    standardResponseWindowDays: 30,
  },
  SIGNATURE_MISMATCH: {
    category: 'Signature Verification',
    title: 'Attest Physical Signature or Re-sign Declaration',
    guidance:
      'Submit a fresh self-attestation or visit the designated facilitation counter with original ' +
      'government photo identification for manual verification.',
    verifiedSourceUrl: 'https://indiapost.gov.in',
    recommendedChannel: DEFICIENCY_CHANNEL.IN_PERSON_COUNTER,
    standardResponseWindowDays: 15,
  },
  FEE_PAYMENT_UNVERIFIED: {
    category: 'Application Fee',
    title: 'Attach Treasury Challan or Transaction Reconciliation Slip',
    guidance:
      'Submit the bank transaction reference or e-treasury receipt number confirming payment ' +
      'clearance to avoid application closure.',
    verifiedSourceUrl: 'https://bharatkosh.gov.in',
    recommendedChannel: DEFICIENCY_CHANNEL.ONLINE_PORTAL,
    standardResponseWindowDays: 7,
  },
  INSUFFICIENT_PARTICULARS: {
    category: 'General Clarification',
    title: 'Submit Clarification Statement and Supporting Affidavit',
    guidance:
      'Review the specific numbered paragraphs cited in the deficiency memo and provide a point-by-point ' +
      'affidavit or written clarification.',
    verifiedSourceUrl: 'https://pgportal.gov.in',
    recommendedChannel: DEFICIENCY_CHANNEL.ONLINE_PORTAL,
    standardResponseWindowDays: 21,
  },
};

/**
 * Parses raw text or OCR extracted blocks from a deficiency/rejection notice.
 *
 * @param {Object} noticeInput
 * @param {string} noticeInput.rawText
 * @param {number} [noticeInput.pageCount=1]
 * @param {Array<Object>} [noticeInput.ocrBlocks=[]]
 * @returns {Object} Structured notice extraction model
 */
export function extractNoticeDetails(noticeInput = {}) {
  const { rawText = '', ocrBlocks = [], pageCount = 1 } = noticeInput;
  const cleanText = String(rawText || '').trim();

  // 1. Extract Reference Number
  const refMatch = cleanText.match(/(?:ref(?:erence)?\s*(?:no\.?|id)?|memo\s*(?:no\.?|#)|file\s*no\.?)\s*[:\-]?\s*([A-Za-z0-9\/\-_]{5,30})/i);
  const applicationReference = refMatch
    ? {
        value: refMatch[1].trim(),
        confidence: 0.92,
        sourcePage: findSourcePage(refMatch[0], ocrBlocks, 1),
        isUserConfirmed: false,
      }
    : {
        value: 'UNIDENTIFIED',
        confidence: 0.2,
        sourcePage: 1,
        isUserConfirmed: false,
      };

  // 2. Extract Explicit Deadline Date first
  const explicitMatch = cleanText.match(/(?:on\s+or\s+before|last\s+date|deadline\s*is)\s*[:\-]?\s*([0-9\/\-\.]{8,12})/i);
  const explicitDeadlineDate = explicitMatch ? explicitMatch[1].replace(/[\.\,\;]+$/, '').trim() : null;

  // 3. Extract Notice Date(s)
  // Look specifically for notice date / dated header
  const noticeDateHeaderMatch = cleanText.match(/(?:notice\s*date|dated?)\s*[:\-]?\s*([0-9\/\-\.]{8,12}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{4})/i);
  const dispatchDateMatch = cleanText.match(/(?:dispatch\s*date|issued\s*on)\s*[:\-]?\s*([0-9\/\-\.]{8,12})/i);

  const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{4})\b/gi;
  const allFoundDates = [...cleanText.matchAll(dateRegex)].map((m) => m[0]);

  // Exclude explicit deadline date from notice dates pool
  const candidateNoticeDates = explicitDeadlineDate
    ? allFoundDates.filter((d) => d !== explicitDeadlineDate)
    : allFoundDates;

  let noticeDate = null;
  let hasConflictingDates = false;

  if (noticeDateHeaderMatch && dispatchDateMatch && noticeDateHeaderMatch[1] !== dispatchDateMatch[1]) {
    hasConflictingDates = true;
    noticeDate = {
      value: noticeDateHeaderMatch[1],
      secondaryDates: [dispatchDateMatch[1]],
      confidence: 0.6,
      sourcePage: 1,
      isUserConfirmed: false,
    };
  } else if (noticeDateHeaderMatch) {
    noticeDate = {
      value: noticeDateHeaderMatch[1],
      confidence: 0.9,
      sourcePage: 1,
      isUserConfirmed: false,
    };
  } else if (candidateNoticeDates.length === 1) {
    noticeDate = {
      value: candidateNoticeDates[0],
      confidence: 0.85,
      sourcePage: 1,
      isUserConfirmed: false,
    };
  } else if (candidateNoticeDates.length > 1) {
    noticeDate = {
      value: candidateNoticeDates[0],
      secondaryDates: candidateNoticeDates.slice(1),
      confidence: 0.65,
      sourcePage: 1,
      isUserConfirmed: false,
    };
    hasConflictingDates = true;
  } else {
    noticeDate = {
      value: null,
      confidence: 0.0,
      sourcePage: 1,
      isUserConfirmed: false,
    };
  }

  // 3. Extract Issuing Office / Authority
  const officeMatch = cleanText.match(/(?:office\s+of\s+the|department\s+of|ministry\s+of|tahsildar|collectorate|municipal\s+corporation)[^\n,\.]{4,60}/i);
  const issuingOffice = officeMatch
    ? {
        value: officeMatch[0].trim(),
        confidence: 0.85,
        sourcePage: findSourcePage(officeMatch[0], ocrBlocks, 1),
        isUserConfirmed: false,
      }
    : {
        value: 'Civic Authority / Competent Officer',
        confidence: 0.4,
        sourcePage: 1,
        isUserConfirmed: false,
      };

  // 4. Extract Stated Deficiencies
  const deficiencies = parseDeficienciesFromText(cleanText, ocrBlocks);

  // 5. Evaluate Deadline
  const deadline = evaluateNoticeDeadline(cleanText, noticeDate, hasConflictingDates);

  return {
    applicationReference,
    noticeDate,
    hasConflictingDates,
    issuingOffice,
    deficiencies,
    deadline,
    pageCount,
    disclaimer: DISCLAIMER_TEXT,
  };
}

/**
 * Searches OCR blocks for approximate page location of matched substring.
 */
function findSourcePage(substring, blocks = [], fallbackPage = 1) {
  if (!blocks || blocks.length === 0) return fallbackPage;
  const match = blocks.find((b) => b.text && b.text.includes(substring));
  return match ? match.page || fallbackPage : fallbackPage;
}

/**
 * Parses stated deficiency clauses, separating exact quote from AI interpretation.
 */
export function parseDeficienciesFromText(text, ocrBlocks = []) {
  const deficiencies = [];
  const lower = text.toLowerCase();

  // Pattern detection for standard civic notice defect keywords
  const patterns = [
    {
      code: 'ADDRESS_PROOF_INVALID',
      matchTerms: ['address proof', 'domicile certificate', 'electricity bill', 'rent agreement', 'residence proof'],
      interpretation: 'The authority stated that the submitted proof of residence is missing, invalid, or expired.',
    },
    {
      code: 'INCOME_CERTIFICATE_EXPIRED',
      matchTerms: ['income certificate', 'annual income', 'financial year', 'revenue statement'],
      interpretation: 'The authority found the income certificate expired or not corresponding to the required assessment year.',
    },
    {
      code: 'SIGNATURE_MISMATCH',
      matchTerms: ['signature mismatch', 'unsigned declaration', 'thumb impression', 'attestation missing'],
      interpretation: 'Application signatures or thumb impressions do not match master records or lack required attestation.',
    },
    {
      code: 'FEE_PAYMENT_UNVERIFIED',
      matchTerms: ['challan', 'fee payment', 'transaction failure', 'receipt missing', 'stamp duty'],
      interpretation: 'Statutory application fees or treasury challan could not be reconciled with payment gateways.',
    },
  ];

  for (const item of patterns) {
    for (const term of item.matchTerms) {
      const idx = lower.indexOf(term);
      if (idx !== -1) {
        // Extract surrounding sentence snippet as quoted notice text
        const start = Math.max(0, text.lastIndexOf('.', idx) + 1);
        let end = text.indexOf('.', idx);
        if (end === -1) end = Math.min(text.length, idx + 120);
        const quotedReason = text.substring(start, end + 1).trim() || term;

        const guidanceRecord = VERIFIED_DEFICIENCY_GUIDANCE[item.code] || VERIFIED_DEFICIENCY_GUIDANCE.INSUFFICIENT_PARTICULARS;

        deficiencies.push({
          id: `def_${item.code.toLowerCase()}_${deficiencies.length + 1}`,
          code: item.code,
          category: guidanceRecord.category,
          quotedReason,
          interpretedIssue: item.interpretation,
          sourcePage: findSourcePage(quotedReason, ocrBlocks, 1),
          confidence: quotedReason.length > 20 ? 0.89 : 0.65,
          correctionGuidance: guidanceRecord.guidance,
          verifiedSourceUrl: guidanceRecord.verifiedSourceUrl,
          recommendedChannel: guidanceRecord.recommendedChannel,
          resolved: false,
        });
        break; // matched pattern once, move to next
      }
    }
  }

  // Fallback if no specific pattern was matched but notice text exists
  if (deficiencies.length === 0 && text.trim().length > 0) {
    const defaultGuidance = VERIFIED_DEFICIENCY_GUIDANCE.INSUFFICIENT_PARTICULARS;
    deficiencies.push({
      id: 'def_general_1',
      code: 'INSUFFICIENT_PARTICULARS',
      category: defaultGuidance.category,
      quotedReason: text.substring(0, Math.min(text.length, 180)).trim(),
      interpretedIssue: 'General clarification or deficiency noted in notice text.',
      sourcePage: 1,
      confidence: 0.5,
      correctionGuidance: defaultGuidance.guidance,
      verifiedSourceUrl: defaultGuidance.verifiedSourceUrl,
      recommendedChannel: defaultGuidance.recommendedChannel,
      resolved: false,
    });
  }

  return deficiencies;
}

/**
 * Evaluates the statutory or extracted response deadline.
 */
export function evaluateNoticeDeadline(text, noticeDateObj, hasConflictingDates = false) {
  // Case A: Conflicting dates in notice body make the deadline unverified
  if (hasConflictingDates) {
    return {
      type: DEADLINE_TYPE.UNVERIFIED,
      deadlineDate: null,
      daysRemaining: null,
      explanation: 'Conflicting dates detected across notice header and text. Manual confirmation with office required.',
    };
  }

  // Case B: Explicit deadline stated (e.g. "submit on or before 25/04/2026")
  const explicitMatch = text.match(/(?:on\s+or\s+before|last\s+date|deadline\s*is)\s*[:\-]?\s*([0-9\/\-\.]{8,12})/i);
  if (explicitMatch) {
    const rawClean = explicitMatch[1].replace(/[\.\,\;]+$/, '').trim();
    return {
      type: DEADLINE_TYPE.EXTRACTED,
      deadlineDate: rawClean,
      explanation: `Explicit response deadline printed on notice: ${rawClean}`,
    };
  }

  // Case C: Relative window stated (e.g. "within 15 days of issue")
  const relativeMatch = text.match(/within\s+(\d{1,2})\s+days/i);
  if (relativeMatch && noticeDateObj && noticeDateObj.value) {
    const days = parseInt(relativeMatch[1], 10);
    return {
      type: DEADLINE_TYPE.CALCULATED,
      windowDays: days,
      calculatedFrom: noticeDateObj.value,
      explanation: `Calculated as ${days} calendar days from notice date (${noticeDateObj.value}).`,
    };
  }

  // Case D: Default unverified
  return {
    type: DEADLINE_TYPE.UNVERIFIED,
    deadlineDate: null,
    explanation: 'No explicit deadline found. Standard statutory response limit is typically 15 to 30 days.',
  };
}

/**
 * Creates an interactive, user-editable correction checklist based on the extracted plan.
 *
 * @param {Object} extractionModel Result from extractNoticeDetails
 * @returns {Array<Object>} User-editable action items
 */
export function generateCorrectionChecklist(extractionModel) {
  if (!extractionModel || !Array.isArray(extractionModel.deficiencies)) {
    return [];
  }

  return extractionModel.deficiencies.map((def, idx) => ({
    stepNumber: idx + 1,
    title: `Resolve ${def.category}: ${def.quotedReason.slice(0, 45)}...`,
    code: def.code,
    quotedReason: def.quotedReason,
    interpretedIssue: def.interpretedIssue,
    recommendedAction: def.correctionGuidance,
    officialLink: def.verifiedSourceUrl,
    submissionChannel: def.recommendedChannel,
    isCompleted: false,
    userNotes: '',
    sourcePage: def.sourcePage,
  }));
}

/**
 * Redacts personal identifiers from the notice plan prior to export or sharing.
 *
 * @param {Object} plan Full notice extraction and checklist model
 * @param {Array<string>} [customTerms=[]] Additional strings to mask
 * @returns {Object} Redacted copy of the plan
 */
export function redactNoticePlan(plan, customTerms = []) {
  const jsonStr = JSON.stringify(plan);

  // Redact standard sensitive patterns:
  // - Aadhaar (12 digits, often formatted as 4-4-4)
  // - PAN (5 letters, 4 digits, 1 letter)
  // - Phone (10 digits)
  // - Email addresses
  let redacted = jsonStr
    .replace(/\b\d{4}\s\d{4}\s\d{4}\b/g, '[REDACTED_AADHAAR]')
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/gi, '[REDACTED_PAN]')
    .replace(/\b[6-9]\d{9}\b/g, '[REDACTED_PHONE]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');

  // Redact any custom requested terms (e.g. applicant personal name)
  for (const term of customTerms) {
    if (term && term.trim().length > 2) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      redacted = redacted.replace(new RegExp(escaped, 'gi'), '[REDACTED_USER_ID]');
    }
  }

  return JSON.parse(redacted);
}
