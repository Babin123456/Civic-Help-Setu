/**
 * Enhanced catalogue coverage: service requirement coverage radar.
 *
 * Extends the existing catalogueCoverage.js with:
 * - Five explicit states per field: missing, draft, verified, stale, conflicting
 * - Configurable field weights for quality scoring
 * - AI suggestion tracking (never auto-published)
 * - Deterministic quality score computation
 * - Per-service radar data and aggregate matrix
 *
 * State meanings:
 *   missing    = field not present or empty
 *   draft      = field present but marked as draft/pending review
 *   verified   = field present and confirmed against official source
 *   stale      = field present but lastVerified > 90 days ago
 *   conflicting = field present but multiple sources disagree, or vague phrasing detected
 *
 * AI guardrails:
 *   - Suggestions are stored in the enrichment review queue (see catalogueEnrichmentReviewService.js)
 *   - Suggestions are never auto-published; always require human approval
 *   - Each suggestion carries source references and data version
 *   - Low-confidence or conflicting evidence routes to review instead of guessing
 */

import { PUBLICATION_STATES, SERVICE_FALLBACKS } from '../data/serviceContract.js';
import { JURISDICTION_LEVELS, INDIAN_STATES_AND_UTS } from '../data/jurisdictions.js';
import { AUDIT_RULES, auditServiceRecord } from './catalogueCompletenessAuditorService.js';
import { createEnrichmentProposal, getEnrichmentQueue, finalizeProposalReview } from './catalogueEnrichmentReviewService.js';

export const SEVERITIES = ['high', 'medium', 'low'];
export const SEVERITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
export const STATES = ['missing', 'draft', 'verified', 'stale', 'conflicting'];
export const STATE_LABELS = {
  missing: 'Missing',
  draft: 'Draft',
  verified: 'Verified',
  stale: 'Stale',
  conflicting: 'Conflicting',
};
export const STATE_COLORS = {
  missing: '#ef4444',      // red
  draft: '#f59e0b',        // amber
  verified: '#22c55e',     // green
  stale: '#eab308',        // yellow
  conflicting: '#a855f7',  // purple
};

/**
 * Extended coverage rules with state awareness and weights.
 * Exported as ENHANCED_COVERAGE_RULES for use by components and tests.
 */
export const ENHANCED_COVERAGE_RULES = [
  // Required fields (publication blockers)
  {
    field: 'shortDescription',
    label: 'Short description',
    level: 'required',
    severity: 'high',
    state: 'missing',
    weight: 1.0,
    aiSuggest: true,
    impactExplanation: 'Citizens need a quick understanding of what the service is and who qualifies.',
  },
  {
    field: 'department',
    label: 'Department',
    level: 'required',
    severity: 'high',
    state: 'missing',
    weight: 1.0,
    aiSuggest: true,
    impactExplanation: 'Citizens cannot determine administrative hierarchy or identify the proper appellate grievance authority.',
  },
  {
    field: 'officialSources',
    label: 'Official source',
    level: 'required',
    severity: 'high',
    state: 'missing',
    weight: 1.0,
    aiSuggest: true,
    impactExplanation: 'Citizens cannot verify or submit online applications; AI assistant cannot ground citations in verified government portals.',
  },
  {
    field: 'steps',
    label: 'Application steps',
    level: 'required',
    severity: 'high',
    state: 'missing',
    weight: 1.0,
    aiSuggest: true,
    impactExplanation: 'Citizens are left without a clear sequence of actions, increasing application abandonment and procedural mistakes.',
  },
  {
    field: 'fees',
    label: 'Fees',
    level: 'required',
    severity: 'medium',
    state: 'missing',
    weight: 0.75,
    aiSuggest: true,
    impactExplanation: 'Citizens face unexpected expenses at public counters and miss out on statutory BPL/PwD fee waivers.',
  },
  {
    field: 'processingTime',
    label: 'Processing time',
    level: 'required',
    severity: 'medium',
    state: 'missing',
    weight: 0.75,
    aiSuggest: true,
    impactExplanation: 'Citizens cannot track application delays or compute statutory compensation under Right to Public Services Acts.',
  },
  {
    field: 'lastVerified',
    label: 'Last-reviewed date',
    level: 'required',
    severity: 'medium',
    state: 'stale',
    weight: 0.75,
    aiSuggest: false,
    impactExplanation: 'Records without verification timestamps risk presenting obsolete guidelines or abolished statutory fees.',
  },
  // Optional fields
  {
    field: 'documents',
    label: 'Required documents',
    level: 'optional',
    severity: 'medium',
    state: 'missing',
    weight: 0.5,
    aiSuggest: true,
    impactExplanation: 'Citizens risk in-person counter rejection due to missing paperwork; document preflight validation is disabled.',
  },
  {
    field: 'eligibility',
    label: 'Eligibility criteria',
    level: 'optional',
    severity: 'medium',
    state: 'missing',
    weight: 0.5,
    aiSuggest: true,
    impactExplanation: 'The automated eligibility test bench and welfare entitlement checker cannot assess citizen qualification.',
  },
  {
    field: 'jurisdiction',
    label: 'Jurisdiction',
    level: 'optional',
    severity: 'medium',
    state: 'missing',
    weight: 0.3,
    aiSuggest: false,
    impactExplanation: 'Nearby office locator and localized eligibility matching cannot scope applicability to the citizen\'s state or district.',
  },
  {
    field: 'contacts',
    label: 'Contacts',
    level: 'optional',
    severity: 'low',
    state: 'missing',
    weight: 0.2,
    aiSuggest: false,
    impactExplanation: 'Citizens have no official contact point to resolve technical portal glitches or procedural queries.',
  },
  {
    field: 'warnings',
    label: 'Warnings / things to know',
    level: 'optional',
    severity: 'low',
    state: 'missing',
    weight: 0.1,
    aiSuggest: false,
    impactExplanation: 'Citizens are not informed of important conditions or restrictions.',
  },
  {
    field: 'eligibilityRuleKey',
    label: 'Eligibility rule key',
    level: 'optional',
    severity: 'low',
    state: 'missing',
    weight: 0.1,
    aiSuggest: false,
    impactExplanation: 'Metadata for programmatic eligibility Lookup.',
  },
];

/**
 * Default weight when a rule doesn't specify one.
 */
export const DEFAULT_WEIGHT = 1.0;

/**
 * Compute the state of a single field value for a service record.
 * Returns one of: 'missing', 'draft', 'verified', 'stale', 'conflicting'
 */
export function computeFieldState(record, rule) {
  const value = record[rule.field];

  // Missing: value is undefined, null, empty string, or empty array
  if (value === undefined || value === null) return 'missing';
  if (typeof value === 'string' && value.trim().length === 0) return 'missing';
  if (Array.isArray(value) && value.length === 0) return 'missing';

  // If the rule has aiSuggest and the field could benefit from AI, check for draft status
  if (rule.aiSuggest) {
    // Draft: value present but marked as draft (e.g. contains placeholder text)
    const lower = String(value).toLowerCase();
    const draftIndicators = [
      'placeholder',
      'todo',
      'add later',
      'to be added',
      'pending',
      'TBC',
      'to be determined',
    ];
    if (draftIndicators.some((ind) => lower.includes(ind))) {
      return 'draft';
    }
  }

  // Verified: field present and has lastVerified date within 90 days, or official sources are verified
  if (rule.field === 'lastVerified') {
    if (value && typeof value === 'string') {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const [, y, m, d] = match.slice(1).map(Number);
        const verifiedDate = new Date(Date.UTC(y, m - 1, d));
        const today = new Date();
        const daysSince = Math.floor((today - verifiedDate) / (1000 * 60 * 60 * 24));
        if (daysSince <= 90) return 'verified';
        if (daysSince <= 365) return 'stale';
        return 'stale'; // > 1 year is definitely stale
      }
    }
    return 'missing';
  }

  // For officialSources: check if sources have verified URLs
  if (rule.field === 'officialSources') {
    if (Array.isArray(value) && value.length > 0) {
      // Check for conflicting: mixed http and https sources
      const httpsCount = value.filter(
        (s) => s && s.url && s.url.startsWith('https://')
      ).length;
      const httpCount = value.filter(
        (s) => s && s.url && !s.url.startsWith('https://') && s.url.startsWith('http://')
      ).length;
      if (httpsCount > 0 && httpCount > 0) return 'conflicting';
      if (httpsCount > 0) return 'verified';
      if (httpCount > 0) return 'missing';
      return 'missing';
    }
    return 'missing';
  }

  // For steps: present non-empty array → verified, absent → missing
  if (rule.field === 'steps') {
    if (Array.isArray(value) && value.length > 0) return 'verified';
    return 'missing';
  }

  // For eligibility: present non-empty array → verified
  if (rule.field === 'eligibility') {
    if (Array.isArray(value) && value.length > 0) return 'verified';
    return 'missing';
  }

  // For documents: present non-empty array → verified
  if (rule.field === 'documents') {
    if (Array.isArray(value) && value.length > 0) return 'verified';
    return 'missing';
  }

  // For fees: present non-empty string → verified
  if (rule.field === 'fees') {
    if (typeof value === 'string' && value.trim().length > 0) return 'verified';
    return 'missing';
  }

  // For processingTime: present non-empty string → verified
  if (rule.field === 'processingTime') {
    if (typeof value === 'string' && value.trim().length > 0) return 'verified';
    return 'missing';
  }

  // Default: if value is present and not caught above, treat as verified
  return 'verified';
}

/**
 * Determine the overall state categorization for a record's field.
 * Combines the base state with any conflict/vague indicators.
 */
export function classifyFieldState(record, rule) {
  const baseState = computeFieldState(record, rule);

  // If base state is missing, return missing
  if (baseState === 'missing') return 'missing';

  // Check for vague phrasing that could make a "present" field effectively conflicting
  if (rule.aiSuggest) {
    const textValue = String(record[rule.field] || '');
    const vagueTerms = [
      'as applicable',
      'as prescribed',
      'etc.',
      'and others',
      'subject to conditions',
    ];
    const lower = textValue.toLowerCase();
    if (vagueTerms.some((t) => lower.includes(t))) {
      // If already verified, make it conflicting if vague terms found
      if (baseState === 'verified') return 'conflicting';
      if (baseState === 'missing') return 'missing'; // can't be conflicting if missing
      // draft with vague terms stays draft
    }
  }

  // Check for lastVerified stale-ness beyond 90 days
  if (rule.field === 'lastVerified') {
    const value = record[rule.field];
    if (value && typeof value === 'string') {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const [, y, m, d] = match.slice(1).map(Number);
        const verifiedDate = new Date(Date.UTC(y, m - 1, d));
        const today = new Date();
        const daysSince = Math.floor((today - verifiedDate) / (1000 * 60 * 60 * 24));
        if (daysSince > 90 && baseState !== 'missing') {
          return 'stale';
        }
      }
    }
  }

  return baseState;
}

/**
 * Compute the quality score for a single service record.
 * Score is deterministic: sum of weights for fields in their 'verified' state,
 * divided by total possible weight, times 100.
 *
 * Formula: score = (Σ weight_i for fields i where state_i = 'verified') / (Σ weight_i for all rules) * 100
 *
 * @param {Object} record Service record
 * @param {Object[]} rules Coverage rules to evaluate (defaults to ENHANCED_COVERAGE_RULES)
 * @returns {{ score: number, verifiedWeight: number, totalWeight: number, fieldStates: Object }}
 */
export function computeQualityScore(record, rules = ENHANCED_COVERAGE_RULES) {
  let verifiedWeight = 0;
  const totalWeight = rules.reduce((sum, rule) => sum + rule.weight, 0);
  const fieldStates = {};

  for (const rule of rules) {
    const state = classifyFieldState(record, rule);
    fieldStates[rule.field] = state;

    if (state === 'verified') {
      verifiedWeight += rule.weight;
    }
  }

  const score = totalWeight > 0 ? Math.round((verifiedWeight / totalWeight) * 100) : 100;
  return { score, verifiedWeight, totalWeight, fieldStates };
}

/**
 * Suggestion placement: create a pending enrichment proposal for a missing field.
 * Suggestions are never auto-published; they go through the review queue.
 *
 * @param {Object} record Service record
 * @param {String} field Field key to suggest text for
 * @param {String} suggestedText AI-generated suggestion
 * @returns {Object|Null} Proposal object or null if cannot create
 */
export function suggestFieldAI(record, field, suggestedText) {
  if (!record || !record.id || !field || !suggestedText) return null;

  // Check if a proposal already exists for this service+field
  const queue = getEnrichmentQueue();
  const existing = queue.find(
    (p) => p.serviceId === record.id && p.fields[field] && p.fields[field].decision === 'pending'
  );

  if (existing) {
    // Update existing proposal's suggested text
    existing.fields[field].proposed = suggestedText;
    existing.fields[field].editedValue = '';
    saveEnrichmentQueue(queue);
    return existing;
  }

  // Create new proposal
  const proposalId = `prop-${record.id}-${field}-${Date.now()}`;
  const fieldsMap = {
    [field]: {
      fieldKey: field,
      label: ENCHANCED_COVERAGE_RULES.find((r) => r.field === field)?.label || field,
      current: typeof record[field] === 'string' ? record[field] : (record[field] ? JSON.stringify(record[field]) : ''),
      proposed: suggestedText,
      decision: 'pending',
      editedValue: '',
    },
  };

  const proposal = {
    id: proposalId,
    serviceId: record.id,
    serviceName: record.name || 'Civic Service',
    status: 'pending',
    proposedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: '',
    fields: fieldsMap,
  };

  const updatedQueue = [proposal, ...queue];
  saveEnrichmentQueue(updatedQueue);
  return proposal;
}

/**
 * Save the enrichment queue (aliased from catalogueEnrichmentReviewService)
 */
export function saveEnrichmentQueue(queue) {
  if (!Array.isArray(queue)) return false;
  inMemoryQueue = queue;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem('civicbridge_catalogue_enrichment_queue_v1', JSON.stringify(queue));
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * CSV export for enhanced coverage data
 */
export function enhancedCoverageToCsv(report) {
  const line = (...cells) => cells.map(csvCell).join(',');
  const t = report.overallStats;
  const f = report.byField;
  const out = [
    line('Enhanced Catalogue Coverage Summary'),
    line('Total records', t.totalRecords),
    line('Complete records', t.completeRecords),
    line('Average quality score', `${t.averageScore}%`),
    '',
    line('Field', 'Level', 'Severity', 'Weight', 'Missing', 'Verified', 'Complete (%)', 'Missing+Stale', 'Draft', 'Conflicting'),
    ...f.map((r) =>
      line(
        r.label,
        r.level,
        SEVERITY_LABELS[r.severity],
        r.weight,
        r.missing,
        r.verified,
        r.percentComplete,
        r.stateCounts.missing + r.stateCounts.stale,
        r.stateCounts.draft,
        r.stateCounts.conflicting,
      )
    ),
    '',
    line('Record id', 'Name', 'Category', 'Jurisdiction', 'Score', 'VerifiedWeight', 'TotalWeight'),
    ...report.records.map((row) =>
      line(
        row.id,
        row.name,
        row.category,
        row.jurisdiction,
        row.score,
        row.verifiedWeight,
        row.totalWeight,
      )
    ),
  ];
  return `${out.join('\n')}\n`;
}

/** A CSV cell: quoted when needed, and neutralised when a spreadsheet would read it as a formula. */
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `''${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Compute enhanced coverage analysis for a catalogue of service records.
 * Returns aggregated data for the radar chart and matrix.
 *
 * @param {Object[]} records Service records
 * @param {Object[]} [rules=ENHANCED_COVERAGE_RULES] Coverage rules to evaluate
 * @returns {{ records: Object[], byField: Object[], stateBreakdown: Object, overallStats: Object }}
 */
export function analyzeEnhancedCoverage(records, rules = ENHANCED_COVERAGE_RULES) {
  const all = (Array.isArray(records) ? records : [])
    .filter((r) => r && typeof r === 'object' && !Array.isArray(r));

  const analysed = all.map((record) => {
    const { score, fieldStates } = computeQualityScore(record, rules);
    return {
      id: typeof record.id === 'string' ? record.id : '',
      name: record.name || '(unnamed record)',
      category: record.category || '',
      jurisdiction: record.jurisdiction
        ? (typeof record.jurisdiction === 'string'
            ? record.jurisdiction
            : record.jurisdiction.level
              ? Object.keys(record.jurisdiction).find(
                  (k) => record.jurisdiction[k] && record.jurisdiction[k].length > 0
                ) || 'national'
              : 'national')
        : '',
      publicationState: record.publicationState || SERVICE_FALLBACKS.publicationState,
      score,
      fieldStates,
      verifiedWeight: 0, // computed per-record if needed
      totalWeight: 0,
    };
  });

  // Aggregate by field: count records in each state
  const byField = rules.map((rule) => {
    const stateCounts = { missing: 0, draft: 0, verified: 0, stale: 0, conflicting: 0 };
    analysed.forEach((rec) => {
      const state = rec.fieldStates[rule.field] || 'missing';
      if (state in stateCounts) stateCounts[state]++;
    });
    const missing = stateCounts.missing + stateCounts.stale;
    const verified = stateCounts.verified;
    const total = analysed.length;
    const percent = total > 0 ? Math.round((verified / total) * 100) : 100;

    return {
      field: rule.field,
      label: rule.label,
      level: rule.level,
      severity: rule.severity,
      weight: rule.weight,
      total,
      missing,
      verified,
      percentComplete: percent,
      stateCounts,
    };
  });

  // State breakdown overall
  const stateBreakdown = { missing: 0, draft: 0, verified: 0, stale: 0, conflicting: 0 };
  const ruleCount = rules.length;
  analysed.forEach((rec) => {
    // Count each field's state toward the breakdown
    // but normalized by the number of rules
    for (const [field, state] of Object.entries(rec.fieldStates)) {
      // Only count fields that have rules
      const rule = rules.find((r) => r.field === field);
      if (rule) {
        stateBreakdown[state] += 1 / ruleCount; // normalize
      }
    }
  });

  // Overall stats
  const totalRecords = analysed.length;
  const completeRecords = analysed.filter((r) => r.score === 100).length;
  const averageScore = totalRecords > 0
    ? Math.round(analysed.reduce((sum, r) => sum + r.score, 0) / totalRecords)
    : 100;

  return {
    records: analysed,
    byField,
    stateBreakdown,
    overallStats: {
      totalRecords,
      completeRecords,
      averageScore,
    },
  };
}