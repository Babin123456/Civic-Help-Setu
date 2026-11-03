/**
 * rtiDraftReviewerService.js
 *
 * Pre-submission AI clarity reviewer for Right to Information (RTI) applications.
 * Audits questions for Section 2(f) statutory compliance (preventing rejection
 * for speculative "why" questions or opinion requests), checks for mandatory
 * particulars (public authority, time period, file numbers), and suggests
 * material record-based rewording alternatives.
 *
 * Legal Context:
 * Under Section 2(f) of the RTI Act 2005 (and CBSE v. Aditya Bandopadhyay 2011),
 * Public Information Officers are required to furnish only existing material
 * records, file notes, and circulars. They are NOT obligated to invent reasons,
 * explain "why" actions occurred, or give speculative advice.
 */

export const RTI_ISSUE_TYPES = {
  OPINION_OR_WHY_QUERY: 'OPINION_OR_WHY_QUERY',
  MISSING_TIME_PERIOD: 'MISSING_TIME_PERIOD',
  MISSING_PUBLIC_AUTHORITY: 'MISSING_PUBLIC_AUTHORITY',
  MISSING_FILE_OR_PROJECT_REF: 'MISSING_FILE_OR_PROJECT_REF',
  SECTION_8_EXEMPTION_RISK: 'SECTION_8_EXEMPTION_RISK',
};

/**
 * Rewording patterns to convert speculative opinion questions into material record requests.
 */
const OPINION_PATTERNS = [
  {
    regex: /^(why\s+was|why\s+is|why\s+did|explain\s+why|reasons?\s+for|what\s+is\s+the\s+reason\s+why)\s+(.+)/i,
    transform: (match, prefix, rest) =>
      `Please provide certified copies of file notings, internal memos, and reasons recorded in writing in the official file concerning: ${rest.replace(/\?$/, '')}.`,
  },
  {
    regex: /^(do\s+you\s+think|is\s+it\s+true\s+that|who\s+is\s+responsible\s+for|whose\s+fault\s+is)\s+(.+)/i,
    transform: (match, prefix, rest) =>
      `Please provide certified copies of the duty roster, inspection log, and official correspondence assigning administrative responsibility for: ${rest.replace(/\?$/, '')}.`,
  },
  {
    regex: /^(when\s+will|how\s+long\s+will\s+it\s+take\s+to|what\s+is\s+the\s+expected\s+date\s+of)\s+(.+)/i,
    transform: (match, prefix, rest) =>
      `Please provide certified copy of the project completion schedule, sanctioned milestone targets, and daily progress register for: ${rest.replace(/\?$/, '')}.`,
  },
];

/**
 * Evaluates an entire RTI application draft or an array of queries.
 *
 * @param {Object} input - RTI draft details
 * @param {string|Array<string>} input.questions - Array of questions or raw text
 * @param {string} [input.publicAuthority] - Name of public authority / PIO
 * @param {string} [input.timePeriod] - Specified time period (e.g., "Jan 2023 to Dec 2023")
 * @param {string} [input.fileReference] - Application / project reference ID
 * @returns {Object} Comprehensive compliance and clarity audit report
 */
export function reviewRtiDraft({
  questions = [],
  publicAuthority = '',
  timePeriod = '',
  fileReference = '',
} = {}) {
  // Normalize questions input
  const rawQuestions = Array.isArray(questions)
    ? questions
    : typeof questions === 'string'
      ? questions.split(/\n+/).filter((line) => line.trim().length > 0)
      : [];

  const queryIssues = [];
  const suggestions = [];

  rawQuestions.forEach((q, idx) => {
    const text = String(q).trim();
    if (!text) return;

    // 1. Section 2(f) "Why" / Opinion Query detection
    let isOpinion = false;
    for (const pattern of OPINION_PATTERNS) {
      const match = text.match(pattern.regex);
      if (match) {
        isOpinion = true;
        const suggestedRewording = pattern.transform(match, match[1], match[2]);
        queryIssues.push({
          questionIndex: idx + 1,
          originalQuestion: text,
          type: RTI_ISSUE_TYPES.OPINION_OR_WHY_QUERY,
          severity: 'HIGH',
          title: 'Section 2(f) Risk: Asking for Reasons / Opinions instead of Records',
          explanation:
            'The Supreme Court has ruled that PIOs are not required to answer "Why" or create explanations. Rephrase to demand certified file notes or written orders.',
          suggestedRewording,
        });
        suggestions.push({
          questionIndex: idx + 1,
          original: text,
          suggested: suggestedRewording,
        });
        break;
      }
    }

    // 2. Section 8 Exemption Warning (Cabinet papers, national security, raw intelligence)
    if (/cabinet\s+papers|secret\s+service|military\s+deployment|raw\s+intelligence/i.test(text)) {
      queryIssues.push({
        questionIndex: idx + 1,
        originalQuestion: text,
        type: RTI_ISSUE_TYPES.SECTION_8_EXEMPTION_RISK,
        severity: 'HIGH',
        title: 'Section 8(1) Exemption Hazard',
        explanation:
          'This query touches upon subjects normally exempt under Section 8(1)(a) or 8(1)(i). Ensure you specify "after cabinet decision" or public interest overrides.',
      });
    }
  });

  // Structural details checks
  const structuralDeficiencies = [];

  // Check 1: Public Authority specified
  const hasAuthority = Boolean(publicAuthority && publicAuthority.trim().length > 2);
  if (!hasAuthority) {
    structuralDeficiencies.push({
      field: 'publicAuthority',
      type: RTI_ISSUE_TYPES.MISSING_PUBLIC_AUTHORITY,
      title: 'Public Authority / Department Not Specified',
      guidance: 'Address the application to a specific Public Information Officer (e.g., PIO, Municipal Corporation of Greater Mumbai).',
    });
  }

  // Check 2: Specified time period
  const hasTimePeriod = Boolean(
    timePeriod && timePeriod.trim().length > 3 ||
    rawQuestions.some((q) => /\b(20\d{2}|19\d{2}|financial year|month|from\s+\w+\s+to\s+\w+)\b/i.test(q))
  );
  if (!hasTimePeriod) {
    structuralDeficiencies.push({
      field: 'timePeriod',
      type: RTI_ISSUE_TYPES.MISSING_TIME_PERIOD,
      title: 'Time Period / Date Range Missing',
      guidance: 'RTI applications without a date range are often rejected for being overly voluminous. Specify a bracket like "Preceding 12 months" or "FY 2023-24".',
    });
  }

  // Check 3: File / Project Reference
  const hasReference = Boolean(
    fileReference && fileReference.trim().length > 2 ||
    rawQuestions.some((q) => /\b(file\s+no|token\s+no|application\s+id|tender\s+id|ref|ward\s+\d+)\b/i.test(q))
  );
  if (!hasReference) {
    structuralDeficiencies.push({
      field: 'fileReference',
      type: RTI_ISSUE_TYPES.MISSING_FILE_OR_PROJECT_REF,
      title: 'Specific File / Work Order Reference Missing',
      guidance: 'Include exact file number, tender reference, or ward locality to prevent the PIO from claiming information is unidentifiable.',
    });
  }

  // Calculate compliance score (0 - 100)
  let score = 100;
  score -= queryIssues.filter((i) => i.severity === 'HIGH').length * 20;
  score -= structuralDeficiencies.length * 15;
  const finalScore = Math.max(10, Math.min(100, score));

  let status = 'READY_TO_SUBMIT';
  if (finalScore < 50 || queryIssues.some((i) => i.severity === 'HIGH')) {
    status = 'NEEDS_REWORDING';
  } else if (finalScore < 80 || structuralDeficiencies.length > 0) {
    status = 'CAUTION_IMPERFECT';
  }

  return {
    isValid: rawQuestions.length > 0,
    complianceScore: finalScore,
    status,
    totalQuestions: rawQuestions.length,
    queryIssues,
    structuralDeficiencies,
    suggestions,
    isCompliant: status === 'READY_TO_SUBMIT',
    statutoryDisclaimer:
      'This AI review is an informational aid to help structure RTI requests under Section 6(1). The applicant must review and approve all edits before submission. Antigravity does not submit RTI applications automatically.',
  };
}

/**
 * Curated realistic sample RTI queries for interactive demonstration.
 */
export const SAMPLE_RTI_DRAFTS = [
  {
    id: 'sample-pothole-rti',
    title: 'Poorly Formed: Road Repair Delay (Contains "Why")',
    authority: 'Public Works Department',
    timePeriod: '',
    questions: [
      'Why was the road repair in Ward 42 delayed for 6 months?',
      'Who is responsible for the bad quality of asphalt laid last week?',
    ],
  },
  {
    id: 'sample-ration-card-rti',
    title: 'Well Formed: Certified File Notes on Ration Application',
    authority: 'Food & Civil Supplies Department',
    timePeriod: '01/01/2023 to 31/12/2023',
    questions: [
      'Please provide certified copy of the scrutiny sheet and file notings on Ration Card Application #RC-98124.',
      'Certified copy of the citizen charter timeline prescribed for disposal of Form 4.',
    ],
  },
  {
    id: 'sample-unbounded-rti',
    title: 'Vague & Missing Time Period',
    authority: '',
    timePeriod: '',
    questions: [
      'Give all details of funds spent on city cleanliness.',
      'Explain why garbage bins were removed from our colony.',
    ],
  },
];
