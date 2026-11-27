/**
 * src/services/agentApprovalInboxService.js
 *
 * Civic Agent Approval Inbox and Action Simulation Mode (#1446).
 *
 * Provides:
 * - Multi-step action proposal validation (tool calls, affected records, expected side effects)
 * - Deterministic dry-run simulation mode (no external writes or mutations)
 * - Policy checks & official rule provenance verification (unknown rules marked unverified)
 * - Explicit approval gate for write operations (approve / edit / reject)
 * - Server-side idempotency & immutable hash-chained decision log (zero PII)
 */

import { inspectStringForPII } from './piiLeakageGuardService.js';

export const APPROVAL_INBOX_SCHEMA_VERSION = '1.0.0';

export const ACTION_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  EDITED_APPROVED: 'edited_approved',
  REJECTED: 'rejected',
};

export const ACTION_DECISION = {
  APPROVE: 'approve',
  EDIT: 'edit',
  REJECT: 'reject',
};

export const APPROVAL_ORIGIN = {
  AI_PROPOSAL: 'ai_proposed_action',
  CITIZEN_CONTEXT: 'citizen_entered_fact',
  OFFICIAL_POLICY: 'official_verified_policy',
};

const SENSITIVE_KEY_REGEX = /^(aadhaar|pan|otp|password|biometric|fingerprint|iris|phone|mobile|email|secret|token)$/i;

export function sanitizeInboxText(val, maxLen = 500) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function validateInboxZeroPii(payload, path = 'proposal') {
  const violations = [];
  function walk(node, currentPath) {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      const check = inspectStringForPII(node);
      if (!check.clean) {
        for (const v of check.violations) {
          violations.push(`${currentPath}: prohibited PII (${v.type})`);
        }
      }
      if (/\b\d{6}\b/.test(node) && /otp/i.test(currentPath)) {
        violations.push(`${currentPath}: OTP value is prohibited`);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${currentPath}[${i}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node)) {
        if (SENSITIVE_KEY_REGEX.test(key.trim())) {
          violations.push(`${currentPath}.${key}: sensitive field is prohibited`);
        }
        walk(val, `${currentPath}.${key}`);
      }
    }
  }
  walk(payload, path);
  return { valid: violations.length === 0, violations };
}

export function evaluatePolicyRuleProvenance(rule = {}) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof rule?.[f] !== 'string' || rule[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && rule?.verified !== false;
  return {
    source: sanitizeInboxText(rule?.source || 'Unverified policy rule', 200),
    jurisdiction: sanitizeInboxText(rule?.jurisdiction || 'UNSPECIFIED', 64),
    effectiveDate: sanitizeInboxText(rule?.effectiveDate || '', 40),
    lastVerifiedAt: sanitizeInboxText(rule?.lastVerifiedAt || '', 64),
    verified,
    status: verified ? 'verified' : 'unverified',
    missingFields,
  };
}

/**
 * Deterministic dry-run simulator. Evaluates proposed tool calls, affected records,
 * policy checks, and expected side effects without mutating external state.
 */
export function simulateActionProposal(proposal) {
  const toolCalls = Array.isArray(proposal?.toolCalls) ? proposal.toolCalls : [];
  const affectedRecords = Array.isArray(proposal?.affectedRecords) ? proposal.affectedRecords : [];
  const piiCheck = validateInboxZeroPii({ toolCalls, affectedRecords }, 'simulation');
  const ruleProvenance = evaluatePolicyRuleProvenance(proposal?.officialRule || {});

  const writeCalls = toolCalls.filter((tc) => tc.operationType === 'write');
  const requiresExplicitApproval = writeCalls.length > 0;

  const policyChecks = [
    {
      id: 'policy-zero-pii',
      origin: APPROVAL_ORIGIN.OFFICIAL_POLICY,
      name: 'Zero PII & Credential Boundary',
      passed: piiCheck.valid,
      detail: piiCheck.valid ? 'No Aadhaar, PAN, OTP, password, or contact PII detected.' : piiCheck.violations[0],
    },
    {
      id: 'policy-explicit-write-gate',
      origin: APPROVAL_ORIGIN.OFFICIAL_POLICY,
      name: 'Explicit Operator Approval for Writes',
      passed: true,
      detail: requiresExplicitApproval
        ? `${writeCalls.length} write tool call(s) held pending explicit operator approval.`
        : 'Read-only action; no external state mutation.',
    },
    {
      id: 'policy-rule-provenance',
      origin: APPROVAL_ORIGIN.OFFICIAL_POLICY,
      name: 'Official Rule Provenance',
      passed: ruleProvenance.verified,
      detail: ruleProvenance.verified
        ? `Verified (${ruleProvenance.source}, ${ruleProvenance.jurisdiction})`
        : `Unverified rule (missing: ${ruleProvenance.missingFields.join(', ')})`,
    },
  ];

  const predictedSideEffects = writeCalls.map((tc, idx) => ({
    step: idx + 1,
    toolName: tc.toolName,
    targetEndpoint: tc.targetEndpoint || 'internal',
    effect: `Would mutate ${affectedRecords.length || 1} record(s) via ${tc.toolName}`,
  }));

  const blockingReasons = policyChecks.filter((p) => !p.passed && p.id === 'policy-zero-pii').map((p) => p.detail);

  return {
    dryRun: true,
    executedExternalWrites: false,
    requiresExplicitApproval,
    wouldMutateCount: writeCalls.length,
    policyPassed: blockingReasons.length === 0,
    blockingReasons,
    policyChecks,
    ruleProvenance,
    predictedSideEffects,
    simulatedAt: new Date().toISOString(),
  };
}

/**
 * Creates an action proposal in the approval inbox and runs initial dry-run simulation.
 */
export function createActionProposal(input, actorId = 'agent-orchestrator') {
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Proposal payload must be a JSON object.'], proposal: null };
  }

  const piiCheck = validateInboxZeroPii(input, 'proposal');
  if (!piiCheck.valid) {
    return { valid: false, errors: piiCheck.violations, proposal: null };
  }

  const errors = [];
  const title = sanitizeInboxText(input.title, 160);
  const summary = sanitizeInboxText(input.summary || '', 500);
  const jurisdiction = sanitizeInboxText(input.jurisdiction || 'IN-UP', 64);
  const toolCalls = Array.isArray(input.toolCalls) ? input.toolCalls : [];
  const affectedRecords = Array.isArray(input.affectedRecords) ? input.affectedRecords : [];

  if (!title || title.length < 4) errors.push('title must be at least 4 characters.');
  if (toolCalls.length === 0) errors.push('toolCalls must contain at least one proposed tool call.');

  toolCalls.forEach((tc, idx) => {
    if (!tc?.toolName || typeof tc.toolName !== 'string') {
      errors.push(`toolCalls[${idx}].toolName is required.`);
    }
    if (!['read', 'write'].includes(tc?.operationType)) {
      errors.push(`toolCalls[${idx}].operationType must be 'read' or 'write'.`);
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors, proposal: null };
  }

  const now = new Date().toISOString();
  const proposal = {
    schemaVersion: APPROVAL_INBOX_SCHEMA_VERSION,
    proposalId: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    idempotencyKey: sanitizeInboxText(input.idempotencyKey || '', 120) || null,
    origin: APPROVAL_ORIGIN.AI_PROPOSAL,
    citizenContextOrigin: APPROVAL_ORIGIN.CITIZEN_CONTEXT,
    title,
    summary,
    jurisdiction,
    submittedBy: sanitizeInboxText(actorId, 64),
    toolCalls: toolCalls.map((tc) => ({
      toolName: sanitizeInboxText(tc.toolName, 80),
      operationType: tc.operationType,
      targetEndpoint: sanitizeInboxText(tc.targetEndpoint || 'internal', 120),
      args: tc.args && typeof tc.args === 'object' ? tc.args : {},
    })),
    affectedRecords: affectedRecords.map((rec) => ({
      recordType: sanitizeInboxText(rec.recordType || 'civic_record', 64),
      recordId: sanitizeInboxText(rec.recordId || 'unknown', 80),
      changeSummary: sanitizeInboxText(rec.changeSummary || '', 200),
    })),
    expectedSideEffects: Array.isArray(input.expectedSideEffects)
      ? input.expectedSideEffects.map((s) => sanitizeInboxText(String(s), 200))
      : [],
    officialRule: input.officialRule || {},
    status: ACTION_STATUS.PENDING_APPROVAL,
    simulation: null,
    decisionRecord: null,
    createdAt: now,
    updatedAt: now,
  };

  proposal.simulation = simulateActionProposal(proposal);
  return { valid: true, errors: [], proposal };
}

function computeDecisionHash(payload, prevHash = '0'.repeat(64)) {
  const str = `${prevHash}|${JSON.stringify(payload)}`;
  let h1 = 2166136261;
  let h2 = 33554467;
  for (let i = 0; i < str.length; i += 1) {
    h1 ^= str.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
    h2 ^= str.charCodeAt(i);
    h2 = Math.imul(h2, 16777619);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Records an immutable operator decision (approve / edit / reject) for a pending proposal.
 */
export function decideActionProposal(
  proposal,
  {
    actorId,
    role = 'admin',
    decision,
    rationale = '',
    editedToolCalls = null,
    idempotencyKey = null,
    prevLogHash = '0'.repeat(64),
  } = {}
) {
  if (!proposal) throw new Error('Proposal not found.');
  if (role !== 'admin') throw new Error('Forbidden: admin operator role required.');
  if (!Object.values(ACTION_DECISION).includes(decision)) {
    throw new Error(`Invalid decision '${decision}'.`);
  }

  // Idempotent replay check
  if (
    idempotencyKey &&
    proposal.decisionRecord &&
    proposal.decisionRecord.idempotencyKey === idempotencyKey
  ) {
    return { proposal, logEntry: null, idempotentReplay: true };
  }

  if (proposal.status !== ACTION_STATUS.PENDING_APPROVAL) {
    throw new Error(`Proposal '${proposal.proposalId}' is already finalized (${proposal.status}).`);
  }

  const piiCheck = validateInboxZeroPii({ rationale, editedToolCalls }, 'decision');
  if (!piiCheck.valid) {
    throw new Error(piiCheck.violations[0]);
  }

  const cleanRationale = sanitizeInboxText(rationale, 400);
  if (decision === ACTION_DECISION.REJECT && cleanRationale.length < 4) {
    throw new Error('Rejection rationale (min 4 chars) is required.');
  }

  let nextToolCalls = proposal.toolCalls;
  let nextStatus = ACTION_STATUS.APPROVED;
  if (decision === ACTION_DECISION.REJECT) {
    nextStatus = ACTION_STATUS.REJECTED;
  } else if (decision === ACTION_DECISION.EDIT) {
    if (!Array.isArray(editedToolCalls) || editedToolCalls.length === 0) {
      throw new Error('editedToolCalls must be a non-empty array when decision is edit.');
    }
    nextToolCalls = editedToolCalls;
    nextStatus = ACTION_STATUS.EDITED_APPROVED;
  }

  const now = new Date().toISOString();
  const decisionRecord = {
    decision,
    status: nextStatus,
    rationale: cleanRationale,
    operatorId: sanitizeInboxText(actorId, 64),
    idempotencyKey: idempotencyKey ? sanitizeInboxText(idempotencyKey, 120) : null,
    decidedAt: now,
  };

  const updatedProposal = {
    ...proposal,
    toolCalls: nextToolCalls,
    status: nextStatus,
    simulation: simulateActionProposal({ ...proposal, toolCalls: nextToolCalls }),
    decisionRecord,
    updatedAt: now,
  };

  const logCore = {
    proposalId: proposal.proposalId,
    jurisdiction: proposal.jurisdiction,
    decision,
    status: nextStatus,
    operatorId: decisionRecord.operatorId,
    rationale: cleanRationale,
    decidedAt: now,
  };
  const hash = computeDecisionHash(logCore, prevLogHash);
  const logEntry = Object.freeze({
    id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...logCore,
    prevHash: prevLogHash,
    hash,
  });

  return { proposal: updatedProposal, logEntry, idempotentReplay: false };
}

export function verifyDecisionLogChain(entries = []) {
  // Entries are stored newest-first or oldest-first; verify chronological order (oldest -> newest)
  const chronological = [...entries].sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt));
  let expectedPrev = '0'.repeat(64);
  for (const entry of chronological) {
    if (entry.prevHash !== expectedPrev) return false;
    const core = {
      proposalId: entry.proposalId,
      jurisdiction: entry.jurisdiction,
      decision: entry.decision,
      status: entry.status,
      operatorId: entry.operatorId,
      rationale: entry.rationale,
      decidedAt: entry.decidedAt,
    };
    if (computeDecisionHash(core, expectedPrev) !== entry.hash) return false;
    expectedPrev = entry.hash;
  }
  return true;
}

export function getBuiltInApprovalProposals() {
  const now = '2026-11-20T10:00:00.000Z';
  const base = {
    schemaVersion: APPROVAL_INBOX_SCHEMA_VERSION,
    proposalId: 'apr-seed-ration-update',
    idempotencyKey: 'seed-ration-1',
    origin: APPROVAL_ORIGIN.AI_PROPOSAL,
    citizenContextOrigin: APPROVAL_ORIGIN.CITIZEN_CONTEXT,
    title: 'Update Ration Card Fair-Price Shop Mapping',
    summary: 'Assistant prepared a multi-step update to link Ward 14 citizens to FPS Shop #204.',
    jurisdiction: 'IN-UP',
    submittedBy: 'civic-assistant-agent',
    toolCalls: [
      { toolName: 'lookupFpsDirectory', operationType: 'read', targetEndpoint: '/api/pds-observations', args: { ward: 'ward-14' } },
      { toolName: 'proposeShopMapping', operationType: 'write', targetEndpoint: '/api/pds-observations', args: { ward: 'ward-14', shopId: 'FPS-204' } },
    ],
    affectedRecords: [
      { recordType: 'fps_mapping', recordId: 'ward-14-fps', changeSummary: 'Assign primary shop FPS-204' },
    ],
    expectedSideEffects: ['Updates Ward 14 FPS directory draft pending operator sign-off'],
    officialRule: {
      source: 'UP Food & Civil Supplies Ward Allocation Order',
      jurisdiction: 'IN-UP',
      effectiveDate: '2026-10-01',
      lastVerifiedAt: now,
    },
    status: ACTION_STATUS.PENDING_APPROVAL,
    decisionRecord: null,
    createdAt: now,
    updatedAt: now,
  };
  base.simulation = simulateActionProposal(base);
  return [base];
}

export function migrateApprovalInboxState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: APPROVAL_INBOX_SCHEMA_VERSION,
    proposals: Array.isArray(safe.proposals) ? safe.proposals : getBuiltInApprovalProposals(),
    decisionLog: Array.isArray(safe.decisionLog) ? safe.decisionLog : [],
  };
}
