/**
 * Civic Data Residency Policy Engine
 * Enforces territorial boundaries and data protection rules (DPDPA 2023 compliant).
 */

import { RESIDENCY_TIER, TASK_RISK, GATEWAY_ERROR_CODES } from './gatewayTypes.js';

const STORAGE_KEY = 'civicbridge_model_residency_policy';

// In-memory fallback ensuring consistent behavior in Node/SSR environments
let inMemoryActivePolicy = RESIDENCY_TIER.LOCAL_ONLY;

// Categories considered high risk from a data privacy and statutory perspective
const HIGH_RISK_CATEGORIES = new Set([
  'caste-certificate',
  'income-certificate',
  'disability-certificate',
  'legal-heir',
  'deficiency-notice',
  'grievance',
  'vault',
]);

/**
 * Gets the current active residency policy preference.
 * Defaults to LOCAL_ONLY for safety.
 *
 * @returns {string} One of RESIDENCY_TIER
 */
export function getActiveResidencyPolicy() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && Object.values(RESIDENCY_TIER).includes(stored)) {
        return stored;
      }
    } catch {
      // Fall through to in-memory policy
    }
  }
  return inMemoryActivePolicy;
}

/**
 * Sets the user or administrator residency policy preference.
 *
 * @param {string} tier - One of RESIDENCY_TIER
 * @returns {string} The active tier
 */
export function setActiveResidencyPolicy(tier) {
  if (!Object.values(RESIDENCY_TIER).includes(tier)) {
    throw new Error(`Invalid residency tier: "${tier}"`);
  }
  inMemoryActivePolicy = tier;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, tier);
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }
  return tier;
}

/**
 * Assesses whether a category represents high-risk citizen data.
 *
 * @param {string} categoryId - Service or query category
 * @returns {boolean}
 */
export function isHighRiskCategory(categoryId) {
  if (!categoryId) return false;
  const normalized = categoryId.toLowerCase().trim();
  return HIGH_RISK_CATEGORIES.has(normalized);
}

/**
 * Evaluates whether a requested model execution conforms to civic residency rules.
 *
 * @param {Object} options
 * @param {string} [options.requestedTier] - Explicit tier requested by caller
 * @param {string} [options.taskRisk] - Risk level of the task (low, medium, high)
 * @param {string} [options.categoryId] - Domain or service category
 * @param {boolean} [options.piiScrubbed] - Whether pre-inference scrubbing has run
 * @returns {{
 *   allowed: boolean,
 *   effectiveTier: string,
 *   downgraded: boolean,
 *   reason: string,
 *   errorCode: string|null
 * }}
 */
export function evaluateResidencyPolicy({
  requestedTier = null,
  taskRisk = TASK_RISK.LOW,
  categoryId = null,
  piiScrubbed = false,
} = {}) {
  const currentPolicy = getActiveResidencyPolicy();
  const targetTier = requestedTier || currentPolicy;
  const isHighRisk = taskRisk === TASK_RISK.HIGH || isHighRiskCategory(categoryId);

  // 1. High-risk tasks are strictly forbidden from cross-border transmission
  if (isHighRisk && targetTier === RESIDENCY_TIER.CROSS_BORDER_SCRUBBED) {
    return {
      allowed: false,
      effectiveTier: RESIDENCY_TIER.LOCAL_ONLY,
      downgraded: true,
      reason: 'High-risk civic data (identity, caste, income, or dispute) is forbidden from cross-border transmission under civic residency policy.',
      errorCode: GATEWAY_ERROR_CODES.RESIDENCY_POLICY_VIOLATION,
    };
  }

  // 2. Cross-border requests MUST have verified pre-inference PII scrubbing
  if (targetTier === RESIDENCY_TIER.CROSS_BORDER_SCRUBBED && !piiScrubbed) {
    return {
      allowed: false,
      effectiveTier: RESIDENCY_TIER.LOCAL_ONLY,
      downgraded: true,
      reason: 'Pre-inference PII scrubbing certification missing. Falling back to local execution to prevent data leakage.',
      errorCode: GATEWAY_ERROR_CODES.RESIDENCY_POLICY_VIOLATION,
    };
  }

  // 3. If explicit target is LOCAL_ONLY, honor local only
  if (targetTier === RESIDENCY_TIER.LOCAL_ONLY) {
    return {
      allowed: true,
      effectiveTier: RESIDENCY_TIER.LOCAL_ONLY,
      downgraded: false,
      reason: 'Enforcing strictly local in-browser processing for civic data sovereignty.',
      errorCode: null,
    };
  }

  // 4. If global system policy is locked to LOCAL_ONLY, downgrade non-local targets to LOCAL_ONLY
  if (currentPolicy === RESIDENCY_TIER.LOCAL_ONLY && targetTier !== RESIDENCY_TIER.LOCAL_ONLY) {
    return {
      allowed: true,
      effectiveTier: RESIDENCY_TIER.LOCAL_ONLY,
      downgraded: true,
      reason: 'System policy is set to LOCAL_ONLY. Downgrading request to local in-browser execution.',
      errorCode: null,
    };
  }

  // 5. Sovereign Domestic tier approved
  if (targetTier === RESIDENCY_TIER.SOVEREIGN_DOMESTIC) {
    return {
      allowed: true,
      effectiveTier: RESIDENCY_TIER.SOVEREIGN_DOMESTIC,
      downgraded: false,
      reason: 'Approved for processing within domestic sovereign cloud infrastructure.',
      errorCode: null,
    };
  }

  // 6. Cross-border allowed for low/medium risk with verified scrubbing
  return {
    allowed: true,
    effectiveTier: RESIDENCY_TIER.CROSS_BORDER_SCRUBBED,
    downgraded: false,
    reason: 'Approved for external model processing with certified PII scrubbed query.',
    errorCode: null,
  };
}
