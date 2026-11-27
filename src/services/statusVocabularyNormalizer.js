/**
 * statusVocabularyNormalizer.js
 *
 * Deterministic status vocabulary mapping and channel provenance weighting
 * for the Cross-Portal Application Status Reconciliation Assistant (#1158).
 * Maps disparate Indian state and central portal phrases into a unified taxonomy.
 */

export const CANONICAL_STATUS = {
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DISPATCHED: 'DISPATCHED',
  COMPLETED: 'COMPLETED',
};

export const CANONICAL_STATUS_META = {
  [CANONICAL_STATUS.SUBMITTED]: {
    label: 'Submitted',
    color: '#64748b',
    background: 'rgba(100, 116, 139, 0.15)',
    description: 'Application successfully registered in the system.',
    isTerminal: false,
    lifecycleOrder: 0,
  },
  [CANONICAL_STATUS.UNDER_REVIEW]: {
    label: 'Under Review / Scrutiny',
    color: '#0284c7',
    background: 'rgba(2, 132, 199, 0.15)',
    description: 'Under departmental verification or field enquiry.',
    isTerminal: false,
    lifecycleOrder: 1,
  },
  [CANONICAL_STATUS.ACTION_REQUIRED]: {
    label: 'Action Required / Query Raised',
    color: '#dc2626',
    background: 'rgba(220, 38, 38, 0.15)',
    description: 'Applicant action needed to cure a deficiency or reply to query.',
    isTerminal: false,
    lifecycleOrder: 2,
  },
  [CANONICAL_STATUS.APPROVED]: {
    label: 'Approved / Sanctioned',
    color: '#16a34a',
    background: 'rgba(22, 163, 74, 0.15)',
    description: 'Application accepted and sanctioned by the competent authority.',
    isTerminal: true,
    lifecycleOrder: 3,
  },
  [CANONICAL_STATUS.DISPATCHED]: {
    label: 'Dispatched / In Transit',
    color: '#7c3aed',
    background: 'rgba(124, 58, 237, 0.15)',
    description: 'Document, certificate, or card printed and out for postal delivery.',
    isTerminal: false,
    lifecycleOrder: 4,
  },
  [CANONICAL_STATUS.COMPLETED]: {
    label: 'Completed / Delivered',
    color: '#059669',
    background: 'rgba(5, 150, 105, 0.15)',
    description: 'Service fully delivered, certificate downloaded or delivered.',
    isTerminal: true,
    lifecycleOrder: 5,
  },
  [CANONICAL_STATUS.REJECTED]: {
    label: 'Rejected / Refused',
    color: '#b91c1c',
    background: 'rgba(185, 28, 28, 0.15)',
    description: 'Application rejected. May be eligible for administrative appeal.',
    isTerminal: true,
    lifecycleOrder: 3,
  },
};

export const SOURCE_TYPE_WEIGHTS = {
  PORTAL_EXPORT: {
    label: 'Official Web Portal',
    weight: 0.95,
  },
  PAPER_RECEIPT: {
    label: 'Physical Counter Receipt / Akshaya / CSC',
    weight: 0.90,
  },
  SMS: {
    label: 'Official SMS Alert Gateway',
    weight: 0.85,
  },
  EMAIL: {
    label: 'Official Departmental Email',
    weight: 0.80,
  },
  USER_NOTE: {
    label: 'Applicant Manual Note',
    weight: 0.50,
  },
};

/**
 * Deterministic mapping dictionary.
 * Each entry holds regex patterns and canonical status target.
 */
const VOCABULARY_RULES = [
  // 1. ACTION REQUIRED / DEFICIENCY / QUERY
  {
    target: CANONICAL_STATUS.ACTION_REQUIRED,
    patterns: [
      /\bquery\s+raised\b/i,
      /\bdeficiency\b/i,
      /\bobjection\s+(?:raised|found)\b/i,
      /\bdocument(?:\s+re-?upload|\s+required|\s+missing|\s+incomplete)\b/i,
      /\bclarification\s+sought\b/i,
      /\baction\s+required\b/i,
      /\bapplicant\s+(?:response|action)\s+pending\b/i,
      /\bdefect\s+notice\b/i,
      /\bmarked\s+for\s+correction\b/i,
      /\bfee\s+(?:pending|due|unpaid)\b/i,
    ],
  },
  // 2. REJECTED / DISMISSED
  {
    target: CANONICAL_STATUS.REJECTED,
    patterns: [
      /\brejected\b/i,
      /\bdisposed\s+(?:off\s+)?with\s+rejection\b/i,
      /\bdismissed\b/i,
      /\bdeclined\b/i,
      /\brefused\b/i,
      /\bcancelled\b/i,
      /\binvalid\s+application\b/i,
      /\bnot\s+recommended\b/i,
      /\basvikrit\b/i, // Hindi for rejected
      /\bradd\b/i, // Hindi for cancelled
    ],
  },
  // 3. DISPATCHED / IN TRANSIT
  {
    target: CANONICAL_STATUS.DISPATCHED,
    patterns: [
      /\bdispatched\b/i,
      /\bsent\s+(?:by|via)\s+(?:speed\s*post|post|courier)\b/i,
      /\bconsignment\s+(?:booked|generated)\b/i,
      /\bout\s+for\s+delivery\b/i,
      /\bin\s+transit\b/i,
      /\bprinted\s+and\s+dispatched\b/i,
      /\bconsignment\s+no\b/i,
    ],
  },
  // 4. COMPLETED / DELIVERED
  {
    target: CANONICAL_STATUS.COMPLETED,
    patterns: [
      /\bdelivered\b/i,
      /\bcertificate\s+(?:generated|downloaded|ready|issued)\b/i,
      /\bdisposed\s+(?:off\s+)?with\s+issuance\b/i,
      /\bclosed\s+successfully\b/i,
      /\bservice\s+delivered\b/i,
      /\bcompleted\b/i,
      /\bcollected\s+by\s+applicant\b/i,
    ],
  },
  // 5. APPROVED / SANCTIONED
  {
    target: CANONICAL_STATUS.APPROVED,
    patterns: [
      /\bapproved\b/i,
      /\bsanctioned\b/i,
      /\bgranted\b/i,
      /\baccepted\b/i,
      /\bapproval\s+granted\b/i,
      /\bsvikrit\b/i, // Hindi for approved
      /\bpassed\b/i,
      /\border\s+passed\b/i,
    ],
  },
  // 6. UNDER REVIEW / IN PROGRESS
  {
    target: CANONICAL_STATUS.UNDER_REVIEW,
    patterns: [
      /\bunder\s+(?:scrutiny|review|process|verification|enquiry|investigation)\b/i,
      /\bprocessing\b/i,
      /\bin\s+progress\b/i,
      /\bfield\s+(?:inspection|verification)\s+pending\b/i,
      /\bforwarded\s+to\b/i,
      /\bpending\s+with\s+(?:officer|clerk|tahsildar|inspector|revenue\s+inspector)\b/i,
      /\bstage\s+\d+\b/i,
      /\bscrutiny\s+pending\b/i,
      /\bpending\b/i,
    ],
  },
  // 7. SUBMITTED / ACKNOWLEDGED
  {
    target: CANONICAL_STATUS.SUBMITTED,
    patterns: [
      /\bsubmitted\b/i,
      /\backnowledg\w*\b/i,
      /\breceived\s+at\s+counter\b/i,
      /\bapplication\s+received\b/i,
      /\bdraft\s+submitted\b/i,
      /\btoken\s+generated\b/i,
      /\bchallan\s+generated\b/i,
      /\bfiled\b/i,
    ],
  },
];

/**
 * Normalizes an arbitrary status string from any portal or notification
 * into the canonical status taxonomy with rule matching explanation.
 *
 * @param {string} rawPhrase - Status text as reported by portal, SMS, or receipt
 * @returns {{ canonicalStatus: string, confidence: number, matchedRule: string }}
 */
export function normalizeStatusPhrase(rawPhrase) {
  if (!rawPhrase || typeof rawPhrase !== 'string') {
    return {
      canonicalStatus: CANONICAL_STATUS.UNDER_REVIEW,
      confidence: 0.2,
      matchedRule: 'empty_or_invalid_input',
    };
  }

  const cleanPhrase = rawPhrase.trim().toLowerCase();

  for (const rule of VOCABULARY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(cleanPhrase)) {
        return {
          canonicalStatus: rule.target,
          confidence: 0.95,
          matchedRule: pattern.toString(),
        };
      }
    }
  }

  // Fallback heuristic: check if any canonical key is directly contained
  const upper = cleanPhrase.toUpperCase();
  for (const key of Object.keys(CANONICAL_STATUS)) {
    if (upper.includes(key)) {
      return {
        canonicalStatus: CANONICAL_STATUS[key],
        confidence: 0.75,
        matchedRule: `substring_match_${key}`,
      };
    }
  }

  // Default unrecognized status safely to UNDER_REVIEW with low confidence
  return {
    canonicalStatus: CANONICAL_STATUS.UNDER_REVIEW,
    confidence: 0.4,
    matchedRule: 'fallback_unrecognized_default',
  };
}

/**
 * Returns metadata for a canonical status code.
 */
export function getCanonicalStatusMeta(status) {
  return (
    CANONICAL_STATUS_META[status] ||
    CANONICAL_STATUS_META[CANONICAL_STATUS.UNDER_REVIEW]
  );
}

/**
 * Returns channel weight for a source type.
 */
export function getSourceWeight(sourceType) {
  return SOURCE_TYPE_WEIGHTS[sourceType]?.weight || 0.6;
}
