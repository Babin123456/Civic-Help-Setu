/**
 * src/data/civicAgentPolicyConstants.js
 *
 * Versioned schema, enums, error codes, storage keys and default policy for
 * the Civic Agent Workflow Policy-as-Code Engine (#1187).
 *
 * All policies are machine-readable, versioned and evaluated deterministically
 * before every tool call and state transition. Deny-by-default: any action not
 * explicitly permitted by an active policy is refused.
 *
 * No citizen records, credentials, raw documents or sensitive prompts are
 * referenced in this module.
 */

export const CIVIC_AGENT_POLICY_SCHEMA_VERSION = 1;
export const CIVIC_AGENT_POLICY_STORAGE_KEY = 'civicbridge_agent_policy_engine_v1';
export const CIVIC_AGENT_POLICY_REVIEW_DATE = '2026-11-24';
export const CIVIC_AGENT_POLICY_STALE_AFTER_DAYS = 90;
export const CIVIC_AGENT_POLICY_DISCLAIMER =
  'Policy decisions are deterministic and derived solely from machine-readable ' +
  'policy documents. They are access-control decisions, not legal advice and ' +
  'do not constitute official verification, benefit denial or application filing.';

export const POLICY_ENGINE_STATUS = Object.freeze({
  ACTIVE: 'active',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
  REVOKED: 'revoked',
  EMERGENCY_LOCKED: 'emergency_locked'
});

export const POLICY_ERRORS = Object.freeze({
  INVALID_REQUEST: 'CP_INVALID_REQUEST',
  INVALID_TYPE: 'CP_INVALID_TYPE',
  POLICY_NOT_FOUND: 'CP_POLICY_NOT_FOUND',
  POLICY_VERSION_NOT_FOUND: 'CP_POLICY_VERSION_NOT_FOUND',
  POLICY_CONFLICT: 'CP_POLICY_CONFLICT',
  DECISION_DENIED: 'CP_DECISION_DENIED',
  DECISION_REQUIRES_APPROVAL: 'CP_DECISION_REQUIRES_APPROVAL',
  VALIDATION_FAILED: 'CP_VALIDATION_FAILED',
  EMERGENCY_REVOKED: 'CP_EMERGENCY_REVOKED',
  PERMISSION_DENIED: 'CP_PERMISSION_DENIED',
  RESOURCE_LIMIT_EXCEEDED: 'CP_RESOURCE_LIMIT_EXCEEDED',
  STORAGE_UNAVAILABLE: 'CP_STORAGE_UNAVAILABLE',
  CONCURRENT_WRITE: 'CP_CONCURRENT_WRITE',
  STALE_DATA: 'CP_STALE_DATA',
  SIMULATION_FAILED: 'CP_SIMULATION_FAILED',
  BYPASS_DETECTED: 'CP_BYPASS_DETECTED'
});

export const EFFECT = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
  REQUIRE_APPROVAL: 'require_approval'
});

export const RESOURCE_TYPE = Object.freeze({
  TOOL: 'tool',
  AGENT: 'agent',
  SOURCE: 'source',
  STATE_TRANSITION: 'state_transition',
  WORKFLOW: 'workflow'
});

export const DEFAULT_POLICY = Object.freeze({
  id: 'default-civic-agent-policy-v1',
  name: 'Default civic agent policy',
  version: CIVIC_AGENT_POLICY_SCHEMA_VERSION,
  description: 'Deny-by-default baseline policy for civic agent workflows.',
  status: POLICY_ENGINE_STATUS.ACTIVE,
  denyByDefault: true,
  rules: [],
  emergencyLocked: false,
  requireHumanApprovalForHighImpact: true,
  createdBy: 'system',
  createdAt: CIVIC_AGENT_POLICY_REVIEW_DATE,
  updatedAt: CIVIC_AGENT_POLICY_REVIEW_DATE,
  disclaimer: CIVIC_AGENT_POLICY_DISCLAIMER,
  noCitizenData: true,
  untrusted: true,
  requiresHumanReview: true
});

/**
 * A policy rule. Machine-readable and deterministic.
 * @typedef {Object} PolicyRule
 * @property {string} id - lowercase slug
 * @property {string} description - human-readable explanation
 * @property {string} resourceType - one of RESOURCE_TYPE
 * @property {string} resourceId - the resource the rule applies to
 * @property {string} effect - one of EFFECT
 * @property {string[]} conditions - ordered condition slugs evaluated deterministically
 * @property {Object} conditionParams - parameters for conditions
 * @property {boolean} requiresApproval - explicit human approval required
 * @property {string[]} appliesToRoles - roles this rule applies to
 * @property {number} priority - higher wins on conflict
 * @property {string} expiresAt - optional ISO-8601 expiry
 */

export const MAX_INPUT_BYTES = 64 * 1024;
export const MAX_POLICIES = 200;
export const MAX_RULES_PER_POLICY = 500;
export const MAX_CONCURRENT_EVALUATIONS = 50;
export const POLICY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RULE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CONDITION_PATTERN = /^[a-z0-9_]+$/;

export const SENSITIVE_KEY_PATTERN =
  /(password|passwd|otp|one.?time|token|secret|credential|api.?key|private.?key|aadhaar.?number|aadhaar.?no|pan.?number|document.?content|file.?content|file.?data|base64|biometric|passphrase|authorization|salary|income.?amount|mobile.?number|phone.?number)/i;

export const AADHAAR_NUMBER_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
export const PAN_NUMBER_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
export const OTP_PATTERN = /\b(?:otp|one[- ]time password)\b\s*[:#-]?\s*\d{4,8}\b/i;

/** Default built-in deny-by-default fallback rule applied when no rule matches. */
export const DENY_BY_DEFAULT_RULE = Object.freeze({
  id: 'deny-by-default',
  description: 'Deny any action not explicitly permitted by an active policy.',
  resourceType: RESOURCE_TYPE.WORKFLOW,
  resourceId: '*',
  effect: EFFECT.DENY,
  conditions: [],
  conditionParams: {},
  requiresApproval: false,
  appliesToRoles: ['*'],
  priority: 0,
  expiresAt: null
});

export const __testables = {
  CIVIC_AGENT_POLICY_SCHEMA_VERSION,
  DEFAULT_POLICY,
  POLICY_ENGINE_STATUS,
  POLICY_ERRORS,
  EFFECT,
  RESOURCE_TYPE,
  DENY_BY_DEFAULT_RULE,
  POLICY_ID_PATTERN,
  RULE_ID_PATTERN,
  CONDITION_PATTERN,
  MAX_INPUT_BYTES,
  MAX_POLICIES,
  MAX_RULES_PER_POLICY,
  MAX_CONCURRENT_EVALUATIONS
};
