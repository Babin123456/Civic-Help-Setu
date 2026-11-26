/**
 * src/services/complaintQualityCoachService.js
 *
 * Core Engine for Agentic Civic Complaint Quality & Completeness Coach (#1190).
 *
 * Design Principles:
 * - Deterministic schema-based checks outside LLM prompts.
 * - AI language suggestions marked as untrusted suggestions with provenance metadata.
 * - Full privacy preview and PII redactor before drafting.
 * - Prompt injection & instruction-override defense.
 * - Human-in-the-loop: Never auto-submits or claims official verification.
 */

import {
  COMPLAINT_COACH_SCHEMA_VERSION,
  COMPLAINT_CATEGORIES,
  CATEGORY_REQUIREMENTS,
  QUALITY_SCORE_THRESHOLDS,
  UNSUPPORTED_ALLEGATION_PATTERNS,
  AMBIGUOUS_DATE_PATTERNS,
  AMBIGUOUS_LOCATION_PATTERNS,
} from '../data/complaintQualityContract.js';
import {
  analyzeAndSanitizeQuery,
  detectPromptInjection,
  stripRedactionPlaceholders,
} from '../ai/aiGuardrailPipeline.js';

export const ERROR_CODES = Object.freeze({
  INVALID_INPUT: 'CQC_INVALID_INPUT',
  PAYLOAD_TOO_LARGE: 'CQC_PAYLOAD_TOO_LARGE',
  PROMPT_INJECTION_DETECTED: 'CQC_PROMPT_INJECTION_DETECTED',
  CATEGORY_UNSUPPORTED: 'CQC_CATEGORY_UNSUPPORTED',
  STORAGE_ERROR: 'CQC_STORAGE_ERROR',
  UNAUTHORIZED: 'CQC_UNAUTHORIZED',
});

const MAX_COMPLAINT_LENGTH = 5000;

/**
 * Validates input against schema boundaries.
 */
export function validateComplaintInput(input = {}) {
  const errors = [];

  if (!input || typeof input !== 'object') {
    return { isValid: false, errors: ['Request body must be a valid JSON object.'] };
  }

  const { category, rawText, title } = input;

  if (!category || !COMPLAINT_CATEGORIES[category]) {
    errors.push(`Invalid or missing category. Allowed: ${Object.keys(COMPLAINT_CATEGORIES).join(', ')}`);
  }

  if (typeof rawText !== 'string' || !rawText.trim()) {
    errors.push('rawText is required and must be non-empty string.');
  } else if (rawText.length > MAX_COMPLAINT_LENGTH) {
    errors.push(`rawText exceeds maximum allowed length of ${MAX_COMPLAINT_LENGTH} characters.`);
  }

  if (title !== undefined && (typeof title !== 'string' || title.length > 200)) {
    errors.push('title if provided must be a string of at most 200 characters.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Deterministically extracts date occurrences or detects date ambiguity.
 */
export function detectDateCompleteness(text = '') {
  const specificDateRegex = /(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|दिनांक\s*[:\s]*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|दिनांक\s*\d{1,2}\s*(?:जनवरी|फ़रवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)\s*\d{4}|\d{1,2}\s*(?:जनवरी|फ़रवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)\s*\d{4})/i;

  const hasSpecificDate = specificDateRegex.test(text);
  const ambiguousFindings = [];

  for (const item of AMBIGUOUS_DATE_PATTERNS) {
    if (item.regex.test(text)) {
      ambiguousFindings.push(item.suggestion);
    }
  }

  return {
    hasSpecificDate,
    hasAmbiguousDate: ambiguousFindings.length > 0,
    suggestions: ambiguousFindings,
    foundDateMatch: hasSpecificDate ? (text.match(specificDateRegex)?.[0] || null) : null,
  };
}

/**
 * Deterministically checks for location specifics (landmarks, street, pin, ward, etc.).
 */
export function detectLocationCompleteness(text = '') {
  const specificLocationIndicators = [
    /\b(?:sector\s*\d+|ward\s*\d+|plot\s*\d+|road|street|nagar|colony|mohalla|enclave|marg|lane|block\s*[A-Z0-9]+|pin\s*code\s*[:\s]*\d{6}|\b\d{6}\b|गंगानगर|नगर|वार्ड|गली\s*नंबर)\b/i,
    /\b(?:opposite|near|behind|beside|adjacent\s+to|in\s+front\s+of)\s+[A-Za-z0-9\s]{3,30}\b/i,
  ];

  let hasSpecificLocation = false;
  for (const regex of specificLocationIndicators) {
    if (regex.test(text)) {
      hasSpecificLocation = true;
      break;
    }
  }

  const ambiguousFindings = [];
  for (const item of AMBIGUOUS_LOCATION_PATTERNS) {
    if (item.regex.test(text)) {
      ambiguousFindings.push(item.suggestion);
    }
  }

  return {
    hasSpecificLocation,
    hasAmbiguousLocation: ambiguousFindings.length > 0,
    suggestions: ambiguousFindings,
  };
}

/**
 * Extracts and validates prior reference / token / consumer numbers.
 */
export function detectReferenceNumbers(text = '', category = null) {
  const generalReferenceRegex = /\b(?:[A-Z]{2,6}-[A-Z0-9-]{4,20}|[A-Z]{2,4}\d{6,14})\b/i;
  const matches = text.match(new RegExp(generalReferenceRegex.source, 'gi')) || [];
  
  const categoryReq = category ? CATEGORY_REQUIREMENTS[category] : null;
  const validCategoryMatches = [];

  if (categoryReq?.referenceNumberPattern) {
    for (const match of matches) {
      if (categoryReq.referenceNumberPattern.test(match)) {
        validCategoryMatches.push(match);
      }
    }
  }

  return {
    hasReferenceNumber: matches.length > 0,
    extractedReferences: matches,
    categoryMatches: validCategoryMatches,
  };
}

/**
 * Detects evidence mentions (photos, receipts, video, bill, FIR, test report).
 */
export function detectEvidenceMentions(text = '') {
  const evidenceIndicators = [
    { type: 'PHOTOGRAPH', regex: /\b(?:photo|photograph|pic|picture|image|geo-tagged|तस्वीर|फोटो)\b/i },
    { type: 'RECEIPT_OR_BILL', regex: /\b(?:receipt|bill|slip|acknowledgement|token|रसीद|बिल)\b/i },
    { type: 'DOCUMENT_COPY', regex: /\b(?:copy|xerox|affidavit|letter|notice|दस्तावेज़|कागज़)\b/i },
    { type: 'VIDEO_AUDIO', regex: /\b(?:video|audio|recording|cctv|फुटेज|रिकॉर्डिंग)\b/i },
  ];

  const foundTypes = [];
  for (const item of evidenceIndicators) {
    if (item.regex.test(text)) {
      foundTypes.push(item.type);
    }
  }

  return {
    hasEvidenceMention: foundTypes.length > 0,
    foundTypes,
  };
}

/**
 * Detects unsupported allegations or high-risk subjective claims.
 */
export function detectUnsupportedAllegations(text = '') {
  const flagged = [];

  for (const pattern of UNSUPPORTED_ALLEGATION_PATTERNS) {
    if (pattern.regex.test(text)) {
      flagged.push({
        type: pattern.type,
        severity: pattern.severity,
        warning: pattern.warning,
      });
    }
  }

  return {
    hasUnsupportedAllegations: flagged.length > 0,
    allegations: flagged,
  };
}

/**
 * Generates an editable, polished, objective draft from raw text.
 * Deterministic template synthesis with provenance tags.
 */
export function generatePolishedDraft({
  category,
  dateInfo,
  locationInfo,
  refInfo,
  evidenceInfo,
  cleanedText,
  allegationInfo,
}) {
  const req = CATEGORY_REQUIREMENTS[category] || {};
  
  // Strip out detected defamatory or inflammatory phrases for the objective draft
  let sanitizedText = cleanedText;
  if (allegationInfo.hasUnsupportedAllegations) {
    for (const pattern of UNSUPPORTED_ALLEGATION_PATTERNS) {
      sanitizedText = sanitizedText.replace(pattern.regex, '[Objective statement of delay or grievance]');
    }
  }

  const dateSection = dateInfo.foundDateMatch
    ? `Date of Incident/Issue: ${dateInfo.foundDateMatch}`
    : `Date: [Please specify exact date of occurrence]`;

  const locationSection = locationInfo.hasSpecificLocation
    ? `Location & Landmark: Extracted from report`
    : `Location: [Please provide exact street/ward/landmark]`;

  const referenceSection = refInfo.extractedReferences.length > 0
    ? `Prior Reference / Token / Consumer ID: ${refInfo.extractedReferences.join(', ')}`
    : (req.requiredFields?.includes('priorReferenceNumber')
      ? `Prior Reference Number: [Required: Please supply previous token or application number]`
      : `Prior Reference Number: None provided (Optional)`);

  const evidenceSection = evidenceInfo.hasEvidenceMention
    ? `Enclosures: ${evidenceInfo.foundTypes.join(', ')} (attached by citizen)`
    : `Enclosures: None mentioned. Recommended: ${req.evidenceSuggestions?.join('; ') || 'Photographs or receipts'}`;

  const template = [
    `COMPLAINT SUMMARY: ${category.replace(/_/g, ' ')}`,
    `--------------------------------------------------`,
    dateSection,
    locationSection,
    referenceSection,
    `--------------------------------------------------`,
    `DETAILED STATEMENT OF FACTS:`,
    sanitizedText.trim(),
    `--------------------------------------------------`,
    `RELIEF REQUESTED:`,
    `1. Prompt field inspection and rectification by the competent authority.`,
    `2. Written acknowledgement and tracking ticket number under Citizens' Charter timeline.`,
    `--------------------------------------------------`,
    evidenceSection,
  ].join('\n');

  return {
    draftText: template,
    provenance: {
      generator: 'CivicHelpSetu-ComplaintCoach-Deterministic-v1',
      model: 'deterministic-rules-engine',
      disclaimer: 'This draft is an untrusted AI/algorithmic proposal. Review, adjust, and approve before submission.',
      timestamp: new Date().toISOString(),
      schemaVersion: COMPLAINT_COACH_SCHEMA_VERSION,
    },
  };
}

/**
 * Main Analysis Orchestrator.
 * Combines deterministic schema checks, safety analysis, privacy preview, and quality scoring.
 */
export function analyzeComplaintQuality(input = {}) {
  const validation = validateComplaintInput(input);
  if (!validation.isValid) {
    return {
      success: false,
      errorCode: ERROR_CODES.INVALID_INPUT,
      errors: validation.errors,
    };
  }

  const { category, rawText } = input;

  // 1. Prompt Injection Defense
  const injection = detectPromptInjection(rawText);
  if (injection.blocked) {
    return {
      success: false,
      errorCode: ERROR_CODES.PROMPT_INJECTION_DETECTED,
      error: 'Prompt injection or system prompt extraction attempt blocked.',
      injectionDetails: {
        category: injection.category,
        reason: injection.reason,
      },
    };
  }

  // 2. Privacy Preview & PII Redaction
  const piiSanitization = analyzeAndSanitizeQuery(rawText);
  const privacyPreview = {
    originalTextLength: rawText.length,
    redactedText: piiSanitization.sanitizedQuery,
    piiDetected: piiSanitization.wasRedacted,
    piiCategories: piiSanitization.redactedCategories || [],
    piiCount: piiSanitization.redactionCount || 0,
  };

  const textToAnalyze = piiSanitization.sanitizedQuery;

  // 3. Completeness & Schema Checks
  const dateInfo = detectDateCompleteness(textToAnalyze);
  const locationInfo = detectLocationCompleteness(textToAnalyze);
  const refInfo = detectReferenceNumbers(textToAnalyze, category);
  const evidenceInfo = detectEvidenceMentions(textToAnalyze);
  const allegationInfo = detectUnsupportedAllegations(textToAnalyze);

  const req = CATEGORY_REQUIREMENTS[category] || {};

  // 4. Quality Scoring Breakdown (0 - 100)
  let score = 0;
  const checklist = [];

  // Date Check (25 pts)
  if (dateInfo.hasSpecificDate) {
    score += 25;
    checklist.push({ field: 'date', status: 'PASS', label: 'Clear specific date provided (+25)' });
  } else if (dateInfo.hasAmbiguousDate) {
    score += 10;
    checklist.push({
      field: 'date',
      status: 'WARN',
      label: 'Vague date detected (+10)',
      advice: dateInfo.suggestions[0] || 'Provide an exact calendar date.',
    });
  } else {
    checklist.push({
      field: 'date',
      status: 'FAIL',
      label: 'Missing date of incident (0/25)',
      advice: 'Authorities require the exact date of occurrence to check rosters.',
    });
  }

  // Location Check (25 pts)
  if (locationInfo.hasSpecificLocation) {
    score += 25;
    checklist.push({ field: 'location', status: 'PASS', label: 'Verifiable location/landmark provided (+25)' });
  } else if (locationInfo.hasAmbiguousLocation) {
    score += 10;
    checklist.push({
      field: 'location',
      status: 'WARN',
      label: 'Vague location detected (+10)',
      advice: locationInfo.suggestions[0] || 'Provide exact landmark or street/ward.',
    });
  } else {
    checklist.push({
      field: 'location',
      status: 'FAIL',
      label: 'Missing location details (0/25)',
      advice: 'Include specific street, ward, sector, or nearby landmark.',
    });
  }

  // Reference Number Check (20 pts)
  const isRefRequired = req.requiredFields?.includes('priorReferenceNumber');
  if (refInfo.hasReferenceNumber) {
    score += 20;
    checklist.push({ field: 'reference', status: 'PASS', label: 'Prior reference / consumer ID identified (+20)' });
  } else if (isRefRequired) {
    checklist.push({
      field: 'reference',
      status: 'FAIL',
      label: 'Missing required prior reference number (0/20)',
      advice: 'This category requires an acknowledgement receipt or prior application number.',
    });
  } else {
    // Optional category, give neutral credit if text is descriptive
    score += 15;
    checklist.push({
      field: 'reference',
      status: 'INFO',
      label: 'No prior reference provided (Optional, +15)',
      advice: 'Add consumer number or previous ticket ID if available for faster resolution.',
    });
  }

  // Evidence Check (15 pts)
  if (evidenceInfo.hasEvidenceMention) {
    score += 15;
    checklist.push({ field: 'evidence', status: 'PASS', label: 'Evidence or attachments referenced (+15)' });
  } else {
    checklist.push({
      field: 'evidence',
      status: 'WARN',
      label: 'No supporting evidence referenced (0/15)',
      advice: `Recommended: ${req.evidenceSuggestions?.join(', ') || 'Photographs or documents.'}`,
    });
  }

  // Clarity / Description Length Check (15 pts)
  const minLen = req.minDescriptionLength || 25;
  const cleanCharCount = stripRedactionPlaceholders(textToAnalyze).trim().length;
  if (cleanCharCount >= minLen) {
    score += 15;
    checklist.push({ field: 'clarity', status: 'PASS', label: 'Sufficient factual detail (+15)' });
  } else {
    checklist.push({
      field: 'clarity',
      status: 'WARN',
      label: 'Brief or truncated description (0/15)',
      advice: `Provide at least ${minLen} characters of descriptive factual context.`,
    });
  }

  // Penalty for Unsupported Allegations (-20 pts)
  if (allegationInfo.hasUnsupportedAllegations) {
    score = Math.max(0, score - 20);
    checklist.push({
      field: 'allegations',
      status: 'WARN',
      label: 'Unsupported allegations detected (-20)',
      advice: allegationInfo.allegations.map((a) => a.warning).join(' '),
    });
  }

  // Grade Assessment
  let grade = 'POOR';
  if (score >= QUALITY_SCORE_THRESHOLDS.EXCELLENT) grade = 'EXCELLENT';
  else if (score >= QUALITY_SCORE_THRESHOLDS.GOOD) grade = 'GOOD';
  else if (score >= QUALITY_SCORE_THRESHOLDS.NEEDS_ATTENTION) grade = 'NEEDS_ATTENTION';

  // 5. Generate Polished Draft
  const draftResult = generatePolishedDraft({
    category,
    dateInfo,
    locationInfo,
    refInfo,
    evidenceInfo,
    cleanedText: textToAnalyze,
    allegationInfo,
  });

  return {
    success: true,
    schemaVersion: COMPLAINT_COACH_SCHEMA_VERSION,
    category,
    score,
    grade,
    checklist,
    privacyPreview,
    dateAnalysis: dateInfo,
    locationAnalysis: locationInfo,
    referenceAnalysis: refInfo,
    evidenceAnalysis: evidenceInfo,
    allegationAnalysis: allegationInfo,
    polishedDraft: draftResult.draftText,
    provenance: draftResult.provenance,
    humanApprovalRequired: true,
  };
}
