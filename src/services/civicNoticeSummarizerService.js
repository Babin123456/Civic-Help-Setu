import { safeHttpUrl } from '../utils/safeContent';

/**
 * Civic Notice Summarizer & Deadline Extractor
 *
 * Extracts explicit deadlines, procedural action instructions, target audience,
 * and official sources from administrative notifications and gazette circulars.
 *
 * Rules:
 * 1. Extract dates and actions only when explicitly present in the source text.
 * 2. Mark missing or ambiguous deadlines as "Not found in the supplied notice."
 * 3. Date ambiguity is surfaced explicitly rather than silently resolved.
 * 4. Retain validated links to the original notice.
 * 5. Do not infer that a notice applies to every citizen.
 */

// Common date regex patterns in Indian administrative notices (e.g. 15/11/2026, 15-11-2026, 15th November 2026)
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

/**
 * Summarizes a civic public notice text with date and action extraction.
 *
 * @param {Object|string} input Notice object or raw notice text
 * @returns {Object} Structured notice summary
 */
export function summarizeCivicNotice(input = {}) {
  const rawText = typeof input === 'string' ? input : (input.text || input.description || input.content || '');
  const title = (typeof input === 'object' && input.title) ? input.title.trim() : extractTitle(rawText);
  const rawSourceUrl = (typeof input === 'object' && (input.sourceUrl || input.url || input.link)) || '';
  const sourceUrl = safeHttpUrl(rawSourceUrl) || '';
  const referenceNumber = (typeof input === 'object' && input.referenceNumber)
    ? input.referenceNumber
    : extractReferenceNumber(rawText);

  if (!rawText || rawText.trim().length === 0) {
    return {
      title: title || 'Notice Document',
      purpose: 'No content provided for summarization.',
      deadlines: [],
      deadlineStatus: 'NO_DEADLINE',
      primaryDeadline: 'Not found in the supplied notice.',
      actions: [],
      audience: 'Notice scope unspecified; do not assume universal applicability.',
      isUniversal: false,
      sourceUrl,
      referenceNumber,
      hasDateAmbiguity: false,
      ambiguityNotice: null
    };
  }

  // 1. Extract Dates
  const extractedDates = extractDates(rawText);
  let deadlineStatus = 'NO_DEADLINE';
  let primaryDeadline = 'Not found in the supplied notice.';
  let hasDateAmbiguity = false;
  let ambiguityNotice = null;

  if (extractedDates.length === 1) {
    deadlineStatus = 'EXPLICIT_DEADLINE';
    primaryDeadline = extractedDates[0].dateString;
  } else if (extractedDates.length > 1) {
    // Check if dates represent conflicting deadlines or multi-phase schedules
    hasDateAmbiguity = true;
    deadlineStatus = 'AMBIGUOUS_DATES';
    primaryDeadline = 'Multiple dates found; inspect schedule details.';
    ambiguityNotice = `The supplied notice mentions ${extractedDates.length} distinct dates (${extractedDates.map((d) => d.dateString).join(', ')}). Stated dates are surfaced below without automated assumptions.`;
  }

  // 2. Extract Action Items
  const actions = extractActions(rawText);

  // 3. Extract Target Audience
  const audience = extractAudience(rawText);

  // 4. Synthesize Purpose
  const purpose = extractPurpose(rawText, title);

  return {
    title: title || 'Administrative Notice',
    purpose,
    deadlines: extractedDates,
    deadlineStatus,
    primaryDeadline,
    hasDateAmbiguity,
    ambiguityNotice,
    actions,
    audience: audience.text,
    isUniversal: audience.isUniversal,
    sourceUrl,
    referenceNumber,
    rawTextLength: rawText.length
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
 * Extracts action steps based on sentence-level imperative keywords.
 */
function extractActions(text) {
  const sentences = text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const actions = [];
  const seenActions = new Set();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const hasActionKeyword = ACTION_KEYWORDS.some((verb) => {
      const pattern = new RegExp(`\\b${verb}\\b`, 'i');
      return pattern.test(lower);
    });

    if (hasActionKeyword) {
      const cleaned = sentence.replace(/^[-*•\d.]+\s*/, '').trim();
      if (!seenActions.has(cleaned.toLowerCase()) && cleaned.length < 200) {
        seenActions.add(cleaned.toLowerCase());
        actions.push(cleaned);
      }
    }
  }

  return actions;
}

/**
 * Detects whether the notice targets a specific subgroup or is general.
 */
function extractAudience(text) {
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
        isUniversal: false
      };
    }
  }

  return {
    text: 'Audience not explicitly restricted in text; verify applicability before acting.',
    isUniversal: false
  };
}

/**
 * Extracts the primary purpose statement from the first 2-3 sentences.
 */
function extractPurpose(text, title) {
  const sentences = text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  if (sentences.length > 0) {
    return sentences[0];
  }
  return title ? `Notice regarding ${title}.` : 'Official administrative public notice.';
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
