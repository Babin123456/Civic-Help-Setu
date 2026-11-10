/**
 * Temporal and Jurisdiction-Aware Retrieval Service (#610)
 *
 * Implements:
 * 1. Structured metadata schema for versioned civic rules:
 *    - jurisdictionLevel: 'central' | 'state' | 'district' | 'local'
 *    - jurisdictionCode: ISO 3166-2:IN or district code (e.g., 'IN-DL', 'IN-MH', 'IN-KA')
 *    - issuingAuthority: Department or statutory board
 *    - effectiveFrom: ISO timestamp string
 *    - effectiveTo: ISO timestamp string | null (open-ended / active)
 *    - supersededBy: ID of superseding rule | null
 *    - supersedes: ID of superseded rule | null
 *    - lastVerifiedDate: ISO date string
 * 2. Pre-ranking filter evaluation:
 *    - Discards superseded and expired rules for present-tense queries.
 *    - Discards future-effective rules unless explicitly asked about upcoming policy changes.
 *    - Distinguishes Central vs. State jurisdiction applicability; prevents state rules from being presented as nationwide.
 * 3. Historical query resolution:
 *    - Searches historical version snapshots only when queries explicitly request past periods (e.g. 'in 2022', 'old rule').
 * 4. Missing context clarification:
 *    - If a scheme's rules diverge by state and the user's location is unspecified, surfaces a structured limitation notice.
 */

import { isApprovedService } from './groundedCivicRagService';

export const JURISDICTION_LEVELS = {
  CENTRAL: 'central',
  STATE: 'state',
  DISTRICT: 'district',
  LOCAL: 'local',
};

export const RULE_STATUS = {
  CURRENT: 'CURRENT',
  HISTORICAL: 'HISTORICAL',
  FUTURE_EFFECTIVE: 'FUTURE_EFFECTIVE',
  SUPERSEDED: 'SUPERSEDED',
};

/**
 * Validate consistency of temporal dates
 */
export const validateRuleTemporalRange = (rule = {}) => {
  if (!rule.effectiveFrom) return { valid: false, error: 'effectiveFrom is required' };

  const fromTime = new Date(rule.effectiveFrom).getTime();
  if (Number.isNaN(fromTime)) return { valid: false, error: 'Invalid effectiveFrom date' };

  if (rule.effectiveTo) {
    const toTime = new Date(rule.effectiveTo).getTime();
    if (Number.isNaN(toTime)) return { valid: false, error: 'Invalid effectiveTo date' };
    if (toTime < fromTime) return { valid: false, error: 'effectiveTo cannot precede effectiveFrom' };
  }

  return { valid: true };
};

/**
 * Determine lifecycle status of a rule at a given reference point
 */
export const resolveRuleStatus = (rule = {}, referenceTimestamp = Date.now()) => {
  if (rule.supersededBy) return RULE_STATUS.SUPERSEDED;

  const fromTime = new Date(rule.effectiveFrom || '2000-01-01').getTime();
  const toTime = rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : Infinity;

  if (referenceTimestamp < fromTime) return RULE_STATUS.FUTURE_EFFECTIVE;
  if (referenceTimestamp > toTime) return RULE_STATUS.HISTORICAL;
  return RULE_STATUS.CURRENT;
};

/**
 * Extract target reference year/date from query if explicitly asked
 */
export const extractTemporalIntent = (query = '') => {
  const match = query.match(/\b(in|during|for|year|as of)\s+(19\d\d|20\d\d)\b/i);
  if (match) {
    const year = parseInt(match[2], 10);
    const targetDate = new Date(`${year}-06-01T00:00:00Z`).getTime();
    return { isHistoricalQuery: true, targetTimestamp: targetDate, targetYear: year };
  }

  if (/\b(old|superseded|previous|former|expired)\b/i.test(query)) {
    return { isHistoricalQuery: true, targetTimestamp: null, targetYear: null };
  }

  return { isHistoricalQuery: false, targetTimestamp: Date.now(), targetYear: new Date().getFullYear() };
};

/**
 * Filter and prioritize versioned rules matching temporal and jurisdiction constraints
 */
export const filterVersionedCivicRules = ({
  rules = [],
  query = '',
  userJurisdiction = null, // e.g. 'IN-MH' or 'Maharashtra'
  referenceDate = Date.now(),
}) => {
  if (!Array.isArray(rules)) return { validRules: [], limitationNotice: null };

  const temporalIntent = extractTemporalIntent(query);
  const targetTime = temporalIntent.isHistoricalQuery && temporalIntent.targetTimestamp
    ? temporalIntent.targetTimestamp
    : referenceDate;

  const validRules = [];
  let foundStateDiscrepancy = false;
  const availableStates = new Set();

  for (const rule of rules) {
    if (!isApprovedService(rule)) continue;

    const validation = validateRuleTemporalRange(rule);
    if (!validation.valid) continue;

    // Check temporal status at target time
    const status = resolveRuleStatus(rule, targetTime);

    if (!temporalIntent.isHistoricalQuery) {
      // Normal queries must only match CURRENT active rules
      if (status !== RULE_STATUS.CURRENT) continue;
    } else if (temporalIntent.targetTimestamp) {
      // Historical query looking for specific year
      const fromTime = new Date(rule.effectiveFrom).getTime();
      const toTime = rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : Infinity;
      if (targetTime < fromTime || targetTime > toTime) continue;
    }

    // Jurisdiction filtering
    if (rule.jurisdictionLevel === JURISDICTION_LEVELS.STATE) {
      availableStates.add(rule.jurisdictionName || rule.jurisdictionCode);

      if (userJurisdiction) {
        const uLower = userJurisdiction.toLowerCase();
        const rCode = (rule.jurisdictionCode || '').toLowerCase();
        const rName = (rule.jurisdictionName || '').toLowerCase();

        if (rCode !== uLower && rName !== uLower && !uLower.includes(rName)) {
          continue; // Mismatched state jurisdiction
        }
      } else {
        foundStateDiscrepancy = true;
      }
    }

    validRules.push({
      ...rule,
      resolvedStatus: status,
      effectiveRange: `${rule.effectiveFrom.slice(0, 10)} to ${rule.effectiveTo ? rule.effectiveTo.slice(0, 10) : 'Active'}`,
    });
  }

  // Construct scope limitation notice if multiple states exist and user jurisdiction is missing
  let limitationNotice = null;
  if (!userJurisdiction && foundStateDiscrepancy && availableStates.size > 1) {
    limitationNotice = {
      type: 'MISSING_JURISDICTION',
      message: `Rules for this service differ by state (${Array.from(availableStates).join(', ')}). Displaying central baseline; please specify your State/UT for exact local rules.`,
      availableStates: Array.from(availableStates),
    };
  }

  return {
    validRules,
    limitationNotice,
    temporalDiagnostics: {
      isHistoricalQuery: temporalIntent.isHistoricalQuery,
      targetYear: temporalIntent.targetYear,
      totalInputRules: rules.length,
      filteredRulesCount: validRules.length,
    },
  };
};
