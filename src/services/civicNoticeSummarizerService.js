import { safeHttpUrl } from '../utils/safeContent';

/**
 * Civic Notice Plain-Language Summarizer with Clause-Level Sources
 *
 * Extracts key dates, jurisdiction, required action and contact route from
 * public notices. Every generated statement links to a source passage/page.
 * Uncertain fields are marked unknown rather than guessed.
 *
 * Accepts: plain text or PDF-extracted text with privacy/copyright guidance.
 *
 * Rules:
 * 1. Extract dates, jurisdiction, actions only when explicitly present.
 * 2. Mark missing/low-confidence fields as "unknown" rather than guessing.
 * 3. Surface date ambiguity explicitly; never silently resolve.
 * 4. Track clause-level source references (paragraph/page) for each field.
 * 5. Retain validated links to the original notice.
 * 6. Do not infer that a notice applies to every citizen.
 * 7. Require user confirmation before creating reminders or drafts.
 */

/* Common date regex patterns in Indian administrative notices (e.g. 15/11/2026, 15-11-2026, 15th November 2026) */
const DATE_PATTERNS = [
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}\b/gi,
  /\b\d{4}-\d{2}-\d{2}\b/g
];

// Imperative civic action verbs
const ACTION_KEYWORDS = [
  'submit',
  'apply',
  'upload',
  'verify',
  'link',
  'pay',
  'register',
  'renew',
  'attend',
  'appear',
  'collect',
  'download',
  'furnish',
  'update'
];

// Jurisdiction signifiers (state/UT and ministry keywords)
const JURISDICTION_KEYWORDS = [
  { key: 'maharashtra', label: 'Maharashtra', region: 'state' },
  { key: 'delhi', label: 'Delhi', region: 'state' },
  { key: 'government of india', label: 'Government of India', region: 'central' },
  { key: 'ministry of', label: 'Ministry', region: 'central' },
  { key: 'ministry of rural development', label: 'Ministry of Rural Development', region: 'central' },
  { key: 'ministry of agriculture', label: 'Ministry of Agriculture', region: 'central' },
  { key: ' municipal corporation', label: 'Municipal Corporation', region: 'local' },
  { key: 'panchayat', label: 'Panchayat', region: 'local' }
];

/**
 * Summarizes a civic public notice with plain-language extraction and
 * clause-level source tracking, confidence scoring, and uncertainty marking.
 *
 * @param {Object|string} input Notice object or raw notice text
 * @returns {Object} Structured notice summary with clause-level sources
 */
export function summarizeCivicNotice(input = {}) {
  const rawText = typeof input === 'string' ? input : (input.text || input.description || input.content || '');
  const title = (typeof input === 'object' && input.title) ? input.title.trim() : extractTitle(rawText);
  const rawSourceUrl = (typeof input === 'object' && (input.sourceUrl || input.url || input.link)) || '';
  const sourceUrl = safeHttpUrl(rawSourceUrl) || '';
  const referenceNumber = (typeof input === 'object' && input.referenceNumber)
    ? input.referenceNumber
    : extractReferenceNumber(rawText);

  // Privacy & copyright guidance notice
  const privacyNotice = 'This summary is auto-generated from the supplied notice text. ' +
    'Fields not explicitly present are marked "unknown." Do not rely as a legal decision. ' +
    'Verify all dates, deadlines, and action instructions against the original source.';

  // Initialize uncertainties array early
  const uncertainties = [];

  if (!rawText || rawText.trim().length === 0) {
    return {
      title: title || 'Notice Document',
      purpose: 'No content provided for summarization.',
      deadlines: [],
      deadlineStatus: 'NO_DEADLINE',
      primaryDeadline: 'Not found in the supplied notice.',
      hasDateAmbiguity: false,
      ambiguityNotice: null,
      actions: [],
      audience: 'Notice scope unspecified; do not assume universal applicability.',
      isUniversal: false,
      sourceUrl,
      referenceNumber,
      rawTextLength: 0,
      jurisdiction: {
        label: 'Unknown',
        region: 'unknown',
        confidence: 0,
        clauseReference: null
      },
      fieldConfidence: {
        dates: 0,
        jurisdiction: 0,
        actions: 0,
        audience: 0,
        purpose: 0
      },
      uncertainties,
      clauseReferences: {},
      privacyNotice
    };
  }

  // 1. Extract Dates with clause-level references
  const extractedDates = extractDates(rawText);
  let deadlineStatus = 'NO_DEADLINE';
  let primaryDeadline = 'Not found in the supplied notice.';
  let hasDateAmbiguity = false;
  let ambiguityNotice = null;
  let dateConfidence = 0;
  let dateClauses = [];

  if (extractedDates.length === 1) {
    deadlineStatus = 'EXPLICIT_DEADLINE';
    primaryDeadline = extractedDates[0].dateString;
    dateConfidence = 100;
    dateClauses = [{ paragraph: 1, source: extractedDates[0].context, confidence: 100 }];
  } else if (extractedDates.length > 1) {
    hasDateAmbiguity = true;
    deadlineStatus = 'AMBIGUOUS_DATES';
    primaryDeadline = 'Multiple dates found; inspect schedule details.';
    dateConfidence = 50;
    ambiguityNotice = `The supplied notice mentions ${extractedDates.length} distinct dates (${extractedDates.map((d) => d.dateString).join(', ')}). Stated dates are surfaced below without automated assumptions.`;
    dateClauses = extractedDates.map((d, i) => ({
      paragraph: i + 1,
      source: d.context,
      confidence: 80
    }));
  } else {
    dateConfidence = 0;
    uncertainties.push('No explicit deadline date found in the notice text.');
  }

  // 2. Extract Action Items with clause-level references and confidence
  const actionsWithClauses = extractActionsWithClauses(rawText);

  // 3. Extract Jurisdiction with clause-level reference and confidence
  const jurisdictionInfo = extractJurisdictionWithClauses(rawText);

  // 4. Extract Target Audience with confidence and clause reference
  const audienceInfo = extractAudienceWithClauses(rawText);

  // 5. Synthesize Purpose with confidence and clause reference
  const purposeInfo = extractPurposeWithClauses(rawText, title);

  // 6. Compile additional uncertainties
  const moreUncertainties = compileUncertainties(
    dateConfidence,
    extractedDates.length === 0,
    actionsWithClauses.length === 0,
    audienceInfo.isUniversal === false && audienceInfo.text.includes('not explicitly restricted'),
    jurisdictionInfo.confidence === 0
  );
  uncertainties.push(...moreUncertainties);

  const fieldConfidence = computeFieldConfidence(
    dateConfidence,
    jurisdictionInfo.confidence,
    actionsWithClauses.length > 0 ? 80 : 50,
    audienceInfo.isUniversal ? 70 : 50,
    purposeInfo.text ? 80 : 30
  );

  const clauseReferences = buildClauseReferences(
    dateClauses,
    actionsWithClauses,
    jurisdictionInfo.clauseReference,
    audienceInfo.clauseReference,
    purposeInfo.clauseReference
  );

  return {
    title: title || 'Administrative Notice',
    purpose: purposeInfo.text,
    deadlines: extractedDates,
    deadlineStatus,
    primaryDeadline,
    hasDateAmbiguity,
    ambiguityNotice,
    actions: actionsWithClauses.map((a) => a.text),
    audience: audienceInfo.text,
    isUniversal: audienceInfo.isUniversal,
    sourceUrl,
    referenceNumber,
    rawTextLength: rawText.length,
    jurisdiction: {
      label: jurisdictionInfo.label,
      region: jurisdictionInfo.region,
      confidence: jurisdictionInfo.confidence,
      clauseReference: jurisdictionInfo.clauseReference
    },
    fieldConfidence,
    uncertainties,
    clauseReferences,
    privacyNotice
  };
}

/**
 * Extracts date mentions and context snippets from the text.
 */
function extractDates(text) {
  const matches = [];
  const seen = new Set();

  for (const regex of DATE_PATTERNS) {
    const found = text.match(regex) || [];
    for (const match of found) {
      const normalized = match.trim();
      if (!seen.has(normalized.toLowerCase())) {
        seen.add(normalized.toLowerCase());
        const snippet = extractSurroundingContext(text, match);
        matches.push({
          dateString: normalized,
          context: snippet
        });
      }
    }
  }

  return matches;
}

/**
 * Extracts action steps based on sentence-level imperative keywords
 * with clause-level paragraph references and confidence scores.
 */
function extractActionsWithClauses(text) {
  const sentences = text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const actions = [];
  const seenActions = new Set();

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const lower = sentence.toLowerCase();
    const hasActionKeyword = ACTION_KEYWORDS.some((verb) => {
      const pattern = new RegExp(`\\b${verb}\\b`, 'i');
      return pattern.test(lower);
    });

    if (hasActionKeyword) {
      const cleaned = sentence.replace(/^[-*•\d.]+\s*/, '').trim();
      if (!seenActions.has(cleaned.toLowerCase()) && cleaned.length < 200) {
        seenActions.add(cleaned.toLowerCase());
        const clauseRef = {
          paragraph: i + 1,
          source: extractSurroundingContext(sentence, sentence),
          confidence: ACTION_KEYWORDS.some((v) => lower.includes(v)) ? 90 : 60
        };
        actions.push({
          text: cleaned,
          clauseReference: clauseRef
        });
      }
    }
  }

  return actions;
}

/**
 * Extracts jurisdiction signifiers with clause-level reference and confidence.
 */
function extractJurisdictionWithClauses(text) {
  const lower = text.toLowerCase();
  let bestMatch = null;
  let bestConfidence = 0;

  for (const jk of JURISDICTION_KEYWORDS) {
    if (lower.includes(jk.key)) {
      const confidence = jk.key.length <= 5 ? 95 : 85;
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = {
          label: jk.label,
          region: jk.region,
          confidence,
          clauseReference: {
            paragraph: 1,
            source: extractJurisdictionContext(text, jk.key),
            confidence
          }
        };
      }
    }
  }

  if (bestMatch) {
    return {
      label: bestMatch.label,
      region: bestMatch.region,
      confidence: bestConfidence,
      clauseReference: bestMatch.clauseReference
    };
  }

  return {
    label: 'Unknown',
    region: 'unknown',
    confidence: 0,
    clauseReference: {
      paragraph: 0,
      source: 'Jurisdiction not explicitly stated in the notice text.',
      confidence: 0
    }
  };
}

/**
 * Extracts jurisdiction context snippet for a given keyword.
 */
function extractJurisdictionContext(text, key) {
  const idx = text.toLowerCase().indexOf(key);
  if (idx === -1) return 'Jurisdiction not explicitly stated.';
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + key.length + 30);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

/**
 * Extracts target audience with clause-level reference and confidence.
 */
function extractAudienceWithClauses(text) {
  const lower = text.toLowerCase();

  const groupSignifiers = [
    { key: 'farmer', label: 'Agricultural landholders and farmer beneficiaries' },
    { key: 'student', label: 'Students, scholarship applicants, and educational institutions' },
    { key: 'pensioner', label: 'Senior citizens and welfare pension beneficiaries' },
    { key: 'bpl', label: 'Below Poverty Line (BPL) and Antyodaya ration cardholders' },
    { key: 'differently-abled', label: 'Persons with Disabilities (PwD) / Divyangjan' },
    { key: 'sc/st', label: 'Scheduled Caste (SC) and Scheduled Tribe (ST) applicants' },
    { key: 'vehicle', label: 'Commercial and private motor vehicle license holders' },
    { key: 'taxpayer', label: 'Registered property and municipal tax payers' }
  ];

  for (const group of groupSignifiers) {
    if (lower.includes(group.key)) {
      return {
        text: `Target Audience: ${group.label}`,
        isUniversal: false,
        clauseReference: {
          paragraph: 1,
          source: extractSurroundingContext(text, group.key),
          confidence: 95
        }
      };
    }
  }

  // No specific audience signifier found - mark as uncertain
  return {
    text: 'Audience not explicitly restricted in text; verify applicability before acting.',
    isUniversal: false,
    clauseReference: {
      paragraph: 1,
      source: 'Audience scope not explicitly stated in the notice text.',
      confidence: 20
    }
  };
}

/**
 * Extracts purpose with clause-level reference and confidence.
 */
function extractPurposeWithClauses(text, title) {
  const sentences = text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  if (sentences.length > 0) {
    const firstSentence = sentences[0];
    return {
      text: firstSentence,
      clauseReference: {
        paragraph: 1,
        source: extractSurroundingContext(text, firstSentence),
        confidence: 90
      }
    };
  }

  // Fall back to title
  if (title) {
    return {
      text: `Notice regarding ${title}.`,
      clauseReference: {
        paragraph: 1,
        source: 'Purpose derived from notice title.',
        confidence: 50
      }
    };
  }

  return {
    text: 'Official administrative public notice.',
    clauseReference: {
      paragraph: 1,
      source: 'Purpose not explicitly stated in the notice text.',
      confidence: 10
    }
  };
}

/**
 * Compiles a list of uncertainty warnings based on extraction confidence.
 */
function compileUncertainties(dateConfidence, noDatesFound, noActionsFound, noAudienceSignifier, noJurisdictionFound) {
  const uncertainties = [];

  if (noDatesFound) {
    uncertainties.push('No explicit dates/deadlines found in the notice text.');
  }
  if (noActionsFound) {
    uncertainties.push('No explicit action instructions (e.g., submit, apply, register) found in the notice text.');
  }
  if (noAudienceSignifier) {
    uncertainties.push('Audience scope not explicitly restricted; verify applicability before acting.');
  }
  if (noJurisdictionFound) {
    uncertainties.push('Jurisdiction (state/central/local) not explicitly stated in the notice text.');
  }
  if (dateConfidence < 50) {
    uncertainties.push('Date confidence is low; multiple or ambiguous dates detected. Inspect schedule details manually.');
  }

  return uncertainties;
}

/**
 * Computes confidence scores for each extracted field.
 */
function computeFieldConfidence(dateConfidence, jurisdictionConfidence, actionsConfidence, audienceConfidence, purposeConfidence) {
  return {
    dates: dateConfidence,
    jurisdiction: jurisdictionConfidence,
    actions: actionsConfidence,
    audience: audienceConfidence,
    purpose: purposeConfidence
  };
}

/**
 * Builds a mapping of field clause references for side-by-side review.
 */
function buildClauseReferences(dateClauses, actions, jurisdictionClause, audienceClause, purposeClause) {
  const references = {};

  if (dateClauses && dateClauses.length > 0) {
    references.dates = dateClauses.map((c, i) => ({
      paragraph: c.paragraph,
      source: c.source,
      confidence: c.confidence
    }));
  }

  if (actions && actions.length > 0) {
    references.actions = actions.map((a) => ({
      paragraph: a.clauseReference.paragraph,
      source: a.clauseReference.source,
      confidence: a.clauseReference.confidence
    }));
  }

  if (jurisdictionClause && jurisdictionClause.paragraph > 0) {
    references.jurisdiction = {
      paragraph: jurisdictionClause.paragraph,
      source: jurisdictionClause.source,
      confidence: jurisdictionClause.confidence
    };
  }

  if (audienceClause && audienceClause.paragraph > 0) {
    references.audience = {
      paragraph: audienceClause.paragraph,
      source: audienceClause.source,
      confidence: audienceClause.confidence
    };
  }

  if (purposeClause && purposeClause.clauseReference && purposeClause.clauseReference.paragraph > 0) {
    references.purpose = {
      paragraph: purposeClause.clauseReference.paragraph,
      source: purposeClause.clauseReference.source,
      confidence: purposeClause.clauseReference.confidence
    };
  }

  return references;
}

/**
 * Extracts a fallback title if none provided.
 */
function extractTitle(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length > 0 && lines[0].length < 120) {
    return lines[0];
  }
  return 'Administrative Notification';
}

/**
 * Extracts reference numbers (e.g., F.No. 12-34/2026-IT, No. RT-1102).
 */
function extractReferenceNumber(text) {
  const match = text.match(/\b(?:F\.\s*No\.?|Ref\.?\s*No\.?|Order\s*No\.?|Notification\s*No\.?)\s*[:.-]?\s*([A-Za-z0-9/_-]+)/i);
  return match ? match[1].trim() : 'N/A';
}

/**
 * Extracts surrounding context around a target match in the text.
 */
function extractSurroundingContext(text, target) {
  const index = text.indexOf(target);
  if (index === -1) return '';
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + target.length + 40);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}