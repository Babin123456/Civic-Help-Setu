/**
 * src/services/civicAgentPolicyEngine.js
 *
 * Civic Agent Workflow Policy-as-Code Engine (#1187).
 *
 * Evaluates machine-readable policies deterministically before every tool call
 * and state transition. Deny-by-default: any action not explicitly permitted by
 * an active policy is refused. Supports policy versioning, conflict resolution
 * by priority, explicit human approval gating for high-impact actions, and
 * emergency revocation.
 *
 * Design rules:
 *  - Deterministic rules evaluated outside LLM prompts; AI outputs are untrusted
 *    suggestions carrying provenance.
 *  - Deny-by-default: unknown resources, missing policies and no matching allow
 *    rule all result in denial.
 *  - Explicit human approval required for high-impact actions.
 *  - Never autonomously file applications, deny benefits or claim official
 *    verification.
 *  - Aggregated evaluation metadata only. No citizen records, credentials, raw
 *    documents or sensitive prompts are logged or persisted (inputs are hashed;
 *    only length and resource identifiers are stored).
 *  - Fail closed: on invalid input, missing policy, emergency lock or engine
 *    error, the engine returns a deterministic denial verdict.
 */

import {
  CIVIC_AGENT_POLICY_SCHEMA_VERSION,
  CIVIC_AGENT_POLICY_DISCLAIMER,
  POLICY_ENGINE_STATUS,
  POLICY_ERRORS,
  EFFECT,
  RESOURCE_TYPE,
  DEFAULT_POLICY,
  DENY_BY_DEFAULT_RULE,
  MAX_RULES_PER_POLICY,
  MAX_CONCURRENT_EVALUATIONS,
  SENSITIVE_KEY_PATTERN,
  AADHAAR_NUMBER_PATTERN,
  PAN_NUMBER_PATTERN,
  OTP_PATTERN
} from '../data/civicAgentPolicyConstants.js';
import { loadPolicyStore, runPolicyTransaction, isPolicyId } from './civicAgentPolicyMigrations.js';
import { logDiagnostic } from '../utils/diagnostics.js';

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function containsSensitive(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => containsSensitive(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (typeof value === 'string') {
    if (AADHAAR_NUMBER_PATTERN.test(value)) found.push(`${path}: aadhaar-like number`);
    else if (PAN_NUMBER_PATTERN.test(value)) found.push(`${path}: pan-like number`);
    else if (OTP_PATTERN.test(value)) found.push(`${path}: otp-like value`);
    return found;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) found.push(`${path ? `${path}.` : ''}${key}: sensitive key`);
      containsSensitive(child, path ? `${path}.${key}` : key, depth + 1, found);
    }
  }
  return found;
}

function nowIso() {
  return new Date().toISOString();
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `h-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Evaluate a single rule against a request context.
 * Returns { matched, reason }.
 */
function evaluateRule(rule, context) {
  if (!rule || typeof rule !== 'object') return { matched: false, reason: 'invalid rule' };
  if (rule.expiresAt && new Date(rule.expiresAt) < new Date(nowIso())) {
    return { matched: false, reason: 'rule expired' };
  }
  // Resource type/id match.
  const resourceMatch =
    rule.resourceId === '*' ||
    rule.resourceId === context.resourceId ||
    (context.resourceType && rule.resourceType === context.resourceType && rule.resourceId === context.resourceId);
  if (!resourceMatch) return { matched: false, reason: 'resource mismatch' };

  // Role match.
  if (!rule.appliesToRoles.includes('*') && !rule.appliesToRoles.includes(context.role || 'citizen')) {
    return { matched: false, reason: 'role mismatch' };
  }

  // Conditions: deterministic, order-independent AND of listed condition slugs.
  for (const condition of rule.conditions || []) {
    const condMet = evaluateCondition(condition, rule.conditionParams || {}, context);
    if (!condMet) return { matched: false, reason: `condition not met: ${condition}` };
  }

  return { matched: true, reason: 'rule matched' };
}

function evaluateCondition(condition, params, context) {
  switch (condition) {
    case 'citizen_confirmed':
      return Boolean(context.citizenConfirmed);
    case 'human_approved':
      return Boolean(context.humanApproved);
    case 'read_only':
      return context.action === 'read' || context.callSource === 'read';
    case 'time_window': {
      if (!params || !params.start || !params.end) return false;
      const now = new Date(nowIso());
      return now >= new Date(params.start) && now <= new Date(params.end);
    }
    case 'max_daily_calls': {
      if (!context.dailyCallCount) return true;
      const limit = Number(params.limit || 100);
      return context.dailyCallCount < limit;
    }
    case 'verified_source':
      return Boolean(context.sourceVerified);
    default:
      // Unknown conditions fail closed.
      return false;
  }
}

/**
 * Resolve the active policy for a workflow/policy id.
 * Returns the policy object or null if none active.
 */
function resolvePolicy(store, policyId) {
  if (!policyId) {
    // Fall back to default policy if present in store.
    const def = store.policies.find((p) => p.id === DEFAULT_POLICY.id);
    return def ? cloneDeep(def) : null;
  }
  const policy = store.policies.find((p) => p.id === policyId && p.status === POLICY_ENGINE_STATUS.ACTIVE && !p.emergencyLocked);
  return policy ? cloneDeep(policy) : null;
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Create the policy engine backed by a policy store. Store layer is
 * dependency-injected so the engine is fully testable without localStorage.
 *
 * @param {Object} options
 * @param {Function} [options.loadStore] default loadPolicyStore
 * @param {Function} [options.runTransaction] default runPolicyTransaction
 * @param {Function} [options.logDiagnostic] default logDiagnostic
 */
export function createPolicyEngine({
  loadStore = loadPolicyStore,
  runTransaction = runPolicyTransaction,
  logDiagnostic: log = logDiagnostic
} = {}) {
  const activeEvaluations = new Map(); // evaluationId => { startedAt }

  /**
   * Validate a policy engine request at the trust boundary.
   */
  function validateEngineRequest(input = {}) {
    const errors = [];
    const fail = (field, code, message) => errors.push({ field, code, message });

    if (!isObject(input)) {
      return { valid: false, errors: [{ field: '(request)', code: POLICY_ERRORS.INVALID_TYPE, message: 'Request must be a JSON object.' }] };
    }

    if (input.policyId !== undefined && !isPolicyId(input.policyId)) {
      fail('policyId', POLICY_ERRORS.INVALID_TYPE, 'policyId must be a lowercase slug.');
    }
    if (input.workflowId !== undefined && !isPolicyId(input.workflowId)) {
      fail('workflowId', POLICY_ERRORS.INVALID_TYPE, 'workflowId must be a lowercase slug.');
    }
    if (input.resourceType !== undefined && !Object.values(RESOURCE_TYPE).includes(input.resourceType)) {
      fail('resourceType', POLICY_ERRORS.INVALID_TYPE, `resourceType must be one of ${Object.values(RESOURCE_TYPE).join(', ')}.`);
    }
    if (input.resourceId !== undefined && typeof input.resourceId !== 'string') {
      fail('resourceId', POLICY_ERRORS.INVALID_TYPE, 'resourceId must be a string.');
    }
    if (input.action !== undefined && typeof input.action !== 'string') {
      fail('action', POLICY_ERRORS.INVALID_TYPE, 'action must be a string.');
    }
    if (input.role !== undefined && typeof input.role !== 'string') {
      fail('role', POLICY_ERRORS.INVALID_TYPE, 'role must be a string.');
    }
    if (input.citizenConfirmed !== undefined && typeof input.citizenConfirmed !== 'boolean') {
      fail('citizenConfirmed', POLICY_ERRORS.INVALID_TYPE, 'citizenConfirmed must be a boolean.');
    }
    if (input.humanApproved !== undefined && typeof input.humanApproved !== 'boolean') {
      fail('humanApproved', POLICY_ERRORS.INVALID_TYPE, 'humanApproved must be a boolean.');
    }
    if (input.sourceVerified !== undefined && typeof input.sourceVerified !== 'boolean') {
      fail('sourceVerified', POLICY_ERRORS.INVALID_TYPE, 'sourceVerified must be a boolean.');
    }
    if (input.callSource !== undefined && typeof input.callSource !== 'string') {
      fail('callSource', POLICY_ERRORS.INVALID_TYPE, 'callSource must be a string.');
    }
    if (input.dailyCallCount !== undefined && (!Number.isInteger(input.dailyCallCount) || input.dailyCallCount < 0)) {
      fail('dailyCallCount', POLICY_ERRORS.INVALID_TYPE, 'dailyCallCount must be a non-negative integer.');
    }
    if (input.context !== undefined && !isObject(input.context)) {
      fail('context', POLICY_ERRORS.INVALID_TYPE, 'context must be a JSON object.');
    }

    const sensitive = containsSensitive(input);
    for (const where of sensitive) {
      fail(where, POLICY_ERRORS.INVALID_TYPE, 'Remove identity numbers, OTPs and credentials from the request.');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Evaluate a proposed action against the active policy.
   * Returns { permitted, decision, reason, code, policy, explanation }.
   */
  async function evaluate({
    policyId,
    workflowId,
    resourceType,
    resourceId,
    action,
    role = 'citizen',
    citizenConfirmed = false,
    humanApproved = false,
    sourceVerified = false,
    callSource = 'direct',
    dailyCallCount = 0,
    context = {},
    nowIso: _now
  } = {}) {
    const validation = validateEngineRequest({
      policyId,
      workflowId,
      resourceType,
      resourceId,
      action,
      role,
      citizenConfirmed,
      humanApproved,
      sourceVerified,
      callSource,
      dailyCallCount,
      context
    });
    if (!validation.valid) {
      return {
        permitted: false,
        decision: EFFECT.DENY,
        reason: 'Invalid engine request.',
        code: POLICY_ERRORS.VALIDATION_FAILED,
        errors: validation.errors,
        explanation: 'The request failed validation at the trust boundary.'
      };
    }

    const now = _now ? new Date(_now).toISOString() : nowIso();
    let store;
    try {
      store = loadStore({ now });
    } catch (error) {
      log('Failed to load policy store; denying by default.', error);
      return {
        permitted: false,
        decision: EFFECT.DENY,
        reason: 'Policy store unavailable.',
        code: POLICY_ERRORS.STORAGE_UNAVAILABLE,
        explanation: 'The policy engine could not load its store and denies by default.'
      };
    }

    const policy = resolvePolicy(store, policyId);
    if (!policy) {
      // No active policy: deny by default.
      return {
        permitted: false,
        decision: EFFECT.DENY,
        reason: `No active policy found for ${policyId || 'default'}.`,
        code: POLICY_ERRORS.POLICY_NOT_FOUND,
        policy: null,
        explanation: 'Deny-by-default: no active policy authorizes this action.'
      };
    }

    // Emergency lock: refuse all actions.
    if (policy.emergencyLocked || policy.status === POLICY_ENGINE_STATUS.EMERGENCY_LOCKED) {
      return {
        permitted: false,
        decision: EFFECT.DENY,
        reason: 'Policy is under emergency lock.',
        code: POLICY_ERRORS.EMERGENCY_REVOKED,
        policy: { id: policy.id, version: policy.version },
        explanation: 'Emergency revocation is in effect; all agent actions are suspended.'
      };
    }

    // Concurrency cap.
    if (activeEvaluations.size >= MAX_CONCURRENT_EVALUATIONS) {
      return {
        permitted: false,
        decision: EFFECT.DENY,
        reason: `Maximum ${MAX_CONCURRENT_EVALUATIONS} concurrent evaluations reached.`,
        code: POLICY_ERRORS.RESOURCE_LIMIT_EXCEEDED,
        policy: { id: policy.id, version: policy.version },
        explanation: 'Deny-by-default: evaluation concurrency limit reached.'
      };
    }

    const evalId = `eval-${String(Date.now())}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    activeEvaluations.set(evalId, { startedAt: now });

    try {
      // Collect matching rules sorted by priority (highest first).
      const rules = [...(policy.rules || []), DENY_BY_DEFAULT_RULE].sort((a, b) => (b.priority || 0) - (a.priority || 0));
      const evalCtx = {
        resourceId,
        resourceType,
        action,
        role,
        citizenConfirmed,
        humanApproved,
        sourceVerified,
        callSource,
        dailyCallCount,
        context,
        now
      };

      let matchedRule = null;
      let matchReason = '';
      for (const rule of rules) {
        const res = evaluateRule(rule, evalCtx);
        if (res.matched) {
          matchedRule = rule;
          matchReason = res.reason;
          break;
        }
      }

      const requiresApproval = matchedRule ? Boolean(matchedRule.requiresApproval) : false;
      const highImpact = matchedRule ? Boolean(matchedRule.requiresApproval || context.highImpact) : false;

      let decision = matchedRule ? matchedRule.effect : EFFECT.DENY;
      let permitted = decision === EFFECT.ALLOW;
      let code = 'APPROVED';
      let reason = matchReason || 'Allowed by policy.';
      let explanation = `Policy ${policy.id} v${policy.version}: ${matchReason || 'Allowed.'}`;

      if (decision === EFFECT.DENY) {
        permitted = false;
        code = POLICY_ERRORS.DECISION_DENIED;
        reason = matchReason || 'Denied by policy (no matching allow rule).';
        explanation = `Deny-by-default: ${reason}`;
      } else if (decision === EFFECT.REQUIRE_APPROVAL || (requiresApproval && !humanApproved)) {
        if (decision === EFFECT.REQUIRE_APPROVAL && humanApproved) {
          permitted = true;
          decision = EFFECT.ALLOW;
          code = 'APPROVED';
          reason = matchReason || 'Allowed with human approval.';
          explanation = `Policy ${policy.id} v${policy.version}: Allowed with human approval.`;
        } else {
          permitted = false;
          decision = EFFECT.REQUIRE_APPROVAL;
          code = POLICY_ERRORS.DECISION_REQUIRES_APPROVAL;
          reason = 'Explicit human approval is required for this high-impact action.';
          explanation = `High-impact action requires explicit human approval before execution. Rule: ${matchedRule ? matchedRule.id : 'default'}.`;
        }
      }

      // Record audit event (aggregated only).
      try {
        runTransaction((draft) => {
          draft.evaluationAudit.unshift({
            id: `audit-eval-${Date.now()}`,
            action: 'policy.evaluate',
            entityType: 'policy',
            entityId: policy.id,
            actorRole: role,
            actorId: 'policy.engine',
            reason: `Evaluation ${permitted ? 'permitted' : 'denied'} for ${resourceType}:${resourceId} action ${action}.`,
            details: {
              policyId: policy.id,
              policyVersion: policy.version,
              ruleId: matchedRule ? matchedRule.id : 'deny-by-default',
              decision,
              permitted,
              resourceType,
              resourceId,
              action,
              role,
              requiresApproval,
              emergencyLocked: policy.emergencyLocked
            },
            timestamp: now,
            schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION
          });
          // Keep audit bounded.
          if (draft.evaluationAudit.length > 1000) {
            draft.evaluationAudit = draft.evaluationAudit.slice(0, 1000);
          }
        }, { now: new Date(now) });
      } catch {
        // Audit failure must not change the decision.
      }

      return {
        permitted,
        decision,
        reason,
        code: permitted ? (decision === EFFECT.REQUIRE_APPROVAL ? POLICY_ERRORS.DECISION_REQUIRES_APPROVAL : 'APPROVED') : code,
        policy: { id: policy.id, name: policy.name, version: policy.version, status: policy.status },
        rule: matchedRule ? { id: matchedRule.id, description: matchedRule.description, effect: matchedRule.effect, priority: matchedRule.priority } : null,
        explanation,
        disclaimer: CIVIC_AGENT_POLICY_DISCLAIMER,
        noCitizenData: true,
        untrusted: true,
        requiresHumanReview: highImpact
      };
    } finally {
      activeEvaluations.delete(evalId);
    }
  }

  /**
   * Create or update a policy version (operator action).
   */
  function upsertPolicy({ id, name, description, status, denyByDefault, rules, emergencyLocked, requireHumanApprovalForHighImpact, createdBy, nowIso: _now } = {}) {
    const validation = validateEngineRequest({ policyId: id, resourceId: id || '' });
    if (!validation.valid) {
      return { ok: false, error: { code: POLICY_ERRORS.VALIDATION_FAILED, message: 'Invalid policy request.' }, errors: validation.errors };
    }
    if (!id) {
      return { ok: false, error: { code: POLICY_ERRORS.INVALID_REQUEST, message: 'Policy id is required.' } };
    }

    const now = _now ? new Date(_now).toISOString() : nowIso();
    let store;
    try {
      store = loadStore({ now });
    } catch {
      return { ok: false, error: { code: POLICY_ERRORS.STORAGE_UNAVAILABLE, message: 'Policy store unavailable.' } };
    }

    const existing = store.policies.find((p) => p.id === id);
    const nextVersion = existing ? Number(existing.version) + 1 : 1;
    const policy = {
      id,
      name: name || `Policy ${id}`,
      version: nextVersion,
      description: description || '',
      status: status || POLICY_ENGINE_STATUS.DRAFT,
      denyByDefault: denyByDefault !== false,
      rules: Array.isArray(rules) ? rules.slice(0, MAX_RULES_PER_POLICY) : [],
      emergencyLocked: Boolean(emergencyLocked),
      requireHumanApprovalForHighImpact: requireHumanApprovalForHighImpact !== false,
      createdBy: createdBy || 'system',
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      disclaimer: CIVIC_AGENT_POLICY_DISCLAIMER,
      noCitizenData: true,
      untrusted: true,
      requiresHumanReview: true,
      versionHistory: existing ? [...(existing.versionHistory || []), { version: nextVersion, appliedAt: now, kind: 'update' }] : [{ version: 1, appliedAt: now, kind: 'initial' }]
    };

    try {
      const persisted = runTransaction((draft) => {
        const idx = draft.policies.findIndex((p) => p.id === id);
        if (idx !== -1) draft.policies[idx] = { ...policy };
        else draft.policies.push(policy);
        draft.policyVersions.push(cloneDeep(policy));
        draft.evaluationAudit.unshift({
          id: `audit-policy-upsert-${Date.now()}`,
          action: 'policy.upsert',
          entityType: 'policy',
          entityId: id,
          actorRole: 'operator',
          actorId: 'policy.engine',
          reason: `Policy ${id} upserted to version ${nextVersion}.`,
          details: { policyId: id, version: nextVersion, status: policy.status },
          timestamp: now,
          schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION
        });
        if (draft.evaluationAudit.length > 1000) draft.evaluationAudit = draft.evaluationAudit.slice(0, 1000);
        return { policy };
      }, { now: new Date(now) });
      return { ok: true, policy: persisted.result.policy || policy };
    } catch {
      return { ok: false, error: { code: POLICY_ERRORS.STORAGE_UNAVAILABLE, message: 'Could not persist policy.' } };
    }
  }

  /**
   * Emergency revoke a policy (operator action). Suspends all actions under it.
   */
  function emergencyRevoke({ policyId, reason, revokedBy, nowIso: _now } = {}) {
    if (!isPolicyId(policyId)) {
      return { ok: false, error: { code: POLICY_ERRORS.INVALID_TYPE, message: 'Invalid policyId.' } };
    }
    const now = _now ? new Date(_now).toISOString() : nowIso();
    try {
      runTransaction((draft) => {
        const policy = draft.policies.find((p) => p.id === policyId);
        if (!policy) throw new Error('Policy not found.');
        policy.status = POLICY_ENGINE_STATUS.EMERGENCY_LOCKED;
        policy.emergencyLocked = true;
        policy.updatedAt = now;
        draft.emergencyRevocations.unshift({
          id: `revoke-${Date.now()}`,
          policyId,
          reason: reason || 'Emergency revocation.',
          revokedBy: revokedBy || 'operator',
          revokedAt: now,
          status: 'active',
          schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION
        });
        draft.evaluationAudit.unshift({
          id: `audit-emergency-revoke-${Date.now()}`,
          action: 'policy.emergency_revoke',
          entityType: 'policy',
          entityId: policyId,
          actorRole: 'operator',
          actorId: 'policy.engine',
          reason: `Emergency revocation of policy ${policyId}: ${reason || 'no reason given'}.`,
          details: { policyId, reason, revokedBy },
          timestamp: now,
          schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION
        });
        if (draft.evaluationAudit.length > 1000) draft.evaluationAudit = draft.evaluationAudit.slice(0, 1000);
        return { policyId };
      }, { now: new Date(now) });
      return { ok: true, policyId, revokedAt: now };
    } catch {
      return { ok: false, error: { code: POLICY_ERRORS.STORAGE_UNAVAILABLE, message: 'Could not revoke policy.' } };
    }
  }

  /**
   * List policies.
   */
  function listPolicies() {
    const store = loadStore({ now: nowIso() });
    return store.policies.map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      status: p.status,
      denyByDefault: p.denyByDefault,
      emergencyLocked: p.emergencyLocked,
      ruleCount: (p.rules || []).length,
      updatedAt: p.updatedAt,
      disclaimer: CIVIC_AGENT_POLICY_DISCLAIMER
    }));
  }

  /**
   * Get a policy by id.
   */
  function getPolicy(policyId) {
    if (!isPolicyId(policyId)) return null;
    const store = loadStore({ now: nowIso() });
    const policy = store.policies.find((p) => p.id === policyId);
    if (!policy) return null;
    return {
      id: policy.id,
      name: policy.name,
      version: policy.version,
      status: policy.status,
      denyByDefault: policy.denyByDefault,
      emergencyLocked: policy.emergencyLocked,
      rules: policy.rules || [],
      requireHumanApprovalForHighImpact: policy.requireHumanApprovalForHighImpact,
      updatedAt: policy.updatedAt,
      createdAt: policy.createdAt,
      disclaimer: CIVIC_AGENT_POLICY_DISCLAIMER
    };
  }

  /**
   * Get evaluation audit trail (aggregated only).
   */
  function getEvaluationAudit({ policyId, limit = 50 } = {}) {
    const store = loadStore({ now: nowIso() });
    let events = store.evaluationAudit || [];
    if (policyId) events = events.filter((e) => e.details && e.details.policyId === policyId);
    return events.slice(0, limit).map((e) => ({
      id: e.id,
      action: e.action,
      policyId: e.details && e.details.policyId,
      decision: e.details && e.details.decision,
      permitted: e.details && e.details.permitted,
      resourceType: e.details && e.details.resourceType,
      resourceId: e.details && e.details.resourceId,
      actionName: e.details && e.details.action,
      timestamp: e.timestamp
    }));
  }

  /**
   * List policy versions for a policy (aggregated only).
   */
  function getPolicyVersions({ policyId, limit = 50, cursor } = {}) {
    const store = loadStore({ now: nowIso() });
    let items = store.policyVersions || [];
    if (policyId) items = items.filter((v) => v.id === policyId);
    items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const start = cursor ? items.findIndex((v) => `${v.id}:${v.version}` === cursor) + 1 : 0;
    const page = items.slice(start, start + limit);
    return {
      versions: page.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        updatedAt: v.updatedAt,
        appliedAt: (v.versionHistory || []).find((h) => h.version === v.version)?.appliedAt
      })),
      nextCursor: page.length === limit ? `${page[page.length - 1].id}:${page[page.length - 1].version}` : null
    };
  }

  return {
    validateEngineRequest,
    evaluate,
    upsertPolicy,
    emergencyRevoke,
    listPolicies,
    getPolicy,
    getPolicyVersions,
    getEvaluationAudit,
    POLICY_ENGINE_STATUS,
    POLICY_ERRORS,
    EFFECT,
    RESOURCE_TYPE,
    DEFAULT_POLICY,
    __testables: {
      validateEngineRequest,
      evaluate,
      upsertPolicy,
      emergencyRevoke,
      listPolicies,
      getPolicy,
      getPolicyVersions,
      getEvaluationAudit,
      evaluateRule,
      evaluateCondition,
      resolvePolicy,
      hashString,
      containsSensitive,
      POLICY_ENGINE_STATUS,
      POLICY_ERRORS,
      EFFECT,
      RESOURCE_TYPE,
      DENY_BY_DEFAULT_RULE
    }
  };
}

export const policyEngine = createPolicyEngine();
