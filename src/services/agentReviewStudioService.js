/**
 * Human-in-the-Loop Agent Review Studio Service (#1150)
 *
 * Implements the core domain model, versioned contracts, deterministic validation,
 * RBAC permission checks, optimistic concurrency control, retry idempotency,
 * and post-approval silent-regeneration prohibition for high-impact civic outputs.
 */

import { requirePermission, actorLabel, roleOf, getCurrentActor } from './accessControl.js';
import { CLAIM_RISK_CATEGORY } from './evidenceEntailmentVerificationService.js';
import { logDiagnostic } from '../utils/diagnostics.js';

export const REVIEW_CONTRACT_VERSION = '2026-11-v1';
export const REVIEW_STORAGE_KEY = 'civicbridge_agent_review_studio_v1';
export const REVIEW_AUDIT_KEY = 'civicbridge_agent_review_audit_v1';

export const REVIEW_STATUS = Object.freeze({
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  EDITED_APPROVED: 'edited_approved',
  REJECTED: 'rejected',
  ESCALATED: 'escalated',
  SUPERSEDED: 'superseded',
});

export const REVIEW_DECISION = Object.freeze({
  APPROVE: 'approve',
  EDIT: 'edit',
  REJECT: 'reject',
  ESCALATE: 'escalate',
});

export const REVIEW_EVENT_TYPE = Object.freeze({
  PROPOSAL_SUBMITTED: 'REVIEW_PROPOSAL_SUBMITTED',
  DECISION_RECORDED: 'REVIEW_DECISION_RECORDED',
  VERSION_FORKED: 'REVIEW_VERSION_FORKED',
  SILENT_REGEN_BLOCKED: 'REVIEW_SILENT_REGEN_BLOCKED',
});

const TERMINAL_APPROVED_STATUSES = new Set([
  REVIEW_STATUS.APPROVED,
  REVIEW_STATUS.EDITED_APPROVED,
  REVIEW_STATUS.SUPERSEDED,
]);

const HIGH_RISK_CATEGORIES = new Set([
  CLAIM_RISK_CATEGORY.HIGH_RISK_FEE,
  CLAIM_RISK_CATEGORY.HIGH_RISK_DEADLINE,
  CLAIM_RISK_CATEGORY.HIGH_RISK_PENALTY_LEGAL,
]);

const MAX_CLAIMS = 25;
const MAX_PASSAGES = 20;
const MAX_TEXT_LEN = 2000;
const MAX_QUEUE_SIZE = 500;

const PII_PATTERNS = [
  { label: 'Aadhaar number', regex: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/ },
  { label: 'PAN number', regex: /\b[A-Z]{5}\d{4}[A-Z]\b/i },
  { label: 'phone number', regex: /(?:\+91[\s-]?)?\b[6-9]\d{9}\b/ },
  { label: 'email address', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { label: 'IFSC code', regex: /\b[A-Za-z]{4}0[A-Za-z0-9]{6}\b/ },
  { label: 'bank account number', regex: /\b(?:bank\s+)?(?:account|acct|a\/c)\s*(?:no\.?|number|#|:|-)?\s*\d{9,18}\b/i },
  { label: 'UPI ID', regex: /\b[a-z0-9._-]{2,}@(?:oksbi|okaxis|okicici|okhdfcbank|ybl|ibl|axl|paytm|upi)\b/i },
  { label: 'secret or token', regex: /\b(?:Bearer\s+[A-Za-z0-9\-._~+/]+=*|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|sk_(?:live|test)_[A-Za-z0-9]{8,})\b/i },
];

const AUTONOMOUS_ACTION_PATTERNS = [
  /\b(?:i\s+have\s+)?(?:autonomously|automatically)\s+(?:filed|submitted|approved|denied|rejected)\s+(?:your|the)\s+(?:application|benefit|claim|petition)\b/i,
  /\byour\s+(?:benefit|claim|application|entitlement)\s+(?:is|has\s+been)\s+(?:officially\s+)?(?:denied|rejected|approved)\s+by\s+(?:this\s+agent|ai|civic-help-setu)\b/i,
  /\bofficial\s+government\s+(?:determination|ruling|verification|certification)\s+issued\b/i,
];

export class ReviewValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ReviewValidationError';
    this.code = 'VALIDATION_ERROR';
    this.status = 400;
    this.details = details;
  }
}

export class VersionConflictError extends Error {
  constructor(id, expectedVersion, actualVersion) {
    super(`Version conflict for ${id}: expected v${expectedVersion}, found v${actualVersion}.`);
    this.name = 'VersionConflictError';
    this.code = 'VERSION_CONFLICT';
    this.status = 409;
    this.id = id;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class SilentRegenerationForbiddenError extends Error {
  constructor(id, status) {
    super(`Silent regeneration is prohibited for ${id} in status "${status}". Fork a new version for human re-review instead.`);
    this.name = 'SilentRegenerationForbiddenError';
    this.code = 'SILENT_REGEN_FORBIDDEN';
    this.status = 409;
    this.id = id;
  }
}

export class ReviewNotFoundError extends Error {
  constructor(id) {
    super(`Review item "${id}" was not found.`);
    this.name = 'ReviewNotFoundError';
    this.code = 'NOT_FOUND';
    this.status = 404;
  }
}

export function sanitizeReviewText(value, maxLen = MAX_TEXT_LEN) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function detectPiiOrSecret(text) {
  if (!text || typeof text !== 'string') return null;
  for (const { label, regex } of PII_PATTERNS) {
    if (regex.test(text)) return label;
  }
  return null;
}

export function detectAutonomousClaim(text) {
  if (!text || typeof text !== 'string') return false;
  return AUTONOMOUS_ACTION_PATTERNS.some((pattern) => pattern.test(text));
}

function scanObjectForUnsafeContent(obj, errors) {
  const serialized = JSON.stringify(obj);
  const piiHit = detectPiiOrSecret(serialized);
  if (piiHit) {
    errors.push(`Untrusted payload contains prohibited ${piiHit}; citizen PII and secrets are forbidden.`);
  }
  if (detectAutonomousClaim(serialized)) {
    errors.push('Autonomous filing, benefit denial, or official government determination claims are prohibited.');
  }
}

/**
 * Validates an untrusted AI proposal before admitting it to the Review Studio.
 * @param {object} payload
 * @returns {{ valid: boolean, errors: string[], normalized: object|null }}
 */
export function validateReviewProposal(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Proposal payload must be a JSON object.'], normalized: null };
  }

  const title = sanitizeReviewText(payload.title, 200);
  if (!title || title.length < 4) {
    errors.push('title must be between 4 and 200 characters.');
  }

  const query = sanitizeReviewText(payload.query, 500);
  if (!query || query.length < 3) {
    errors.push('query must be between 3 and 500 characters.');
  }

  const serviceId = sanitizeReviewText(payload.serviceId || 'general-civic', 100);

  // Provenance validation
  const prov = payload.provenance;
  if (!prov || typeof prov !== 'object') {
    errors.push('provenance metadata object is required.');
  } else {
    if (!sanitizeReviewText(prov.agentId, 80)) errors.push('provenance.agentId is required.');
    if (!sanitizeReviewText(prov.modelId, 80)) errors.push('provenance.modelId is required.');
    if (!sanitizeReviewText(prov.promptVersion, 40)) errors.push('provenance.promptVersion is required.');
  }

  const confidenceScore = Number(payload.confidenceScore);
  if (!Number.isFinite(confidenceScore) || confidenceScore < 0 || confidenceScore > 1) {
    errors.push('confidenceScore must be a number between 0 and 1.');
  }

  // Source passages validation
  if (!Array.isArray(payload.sourcePassages) || payload.sourcePassages.length > MAX_PASSAGES) {
    errors.push(`sourcePassages must be an array with at most ${MAX_PASSAGES} entries.`);
  }

  const normalizedPassages = Array.isArray(payload.sourcePassages)
    ? payload.sourcePassages.map((p, idx) => {
        const chunkId = sanitizeReviewText(p?.chunkId || `chunk-${idx + 1}`, 80);
        const sectionTitle = sanitizeReviewText(p?.sectionTitle || 'Official Guidance', 160);
        const excerpt = sanitizeReviewText(p?.excerpt, MAX_TEXT_LEN);
        const sourceName = sanitizeReviewText(p?.sourceName || 'Official Portal', 160);
        const sourceUrl = typeof p?.sourceUrl === 'string' ? p.sourceUrl.trim() : '';
        if (!excerpt || excerpt.length < 10) {
          errors.push(`sourcePassages[${idx}].excerpt must be at least 10 characters.`);
        }
        if (sourceUrl && !isHttpsUrl(sourceUrl)) {
          errors.push(`sourcePassages[${idx}].sourceUrl must use https://.`);
        }
        return {
          chunkId,
          sectionTitle,
          excerpt,
          sourceName,
          sourceUrl: sourceUrl || 'https://services.india.gov.in',
          lastVerified: sanitizeReviewText(p?.lastVerified || '', 40) || null,
        };
      })
    : [];

  // Claims validation
  if (!Array.isArray(payload.claims) || payload.claims.length === 0 || payload.claims.length > MAX_CLAIMS) {
    errors.push(`claims must be a non-empty array with at most ${MAX_CLAIMS} items.`);
  }

  const passageIds = new Set(normalizedPassages.map((p) => p.chunkId));
  const normalizedClaims = Array.isArray(payload.claims)
    ? payload.claims.map((c, idx) => {
        const id = sanitizeReviewText(c?.id || `claim-${idx + 1}`, 60);
        const text = sanitizeReviewText(c?.text, MAX_TEXT_LEN);
        const riskCategory = Object.values(CLAIM_RISK_CATEGORY).includes(c?.riskCategory)
          ? c.riskCategory
          : CLAIM_RISK_CATEGORY.GENERAL_FACT;
        const sourceChunkIds = Array.isArray(c?.sourceChunkIds)
          ? c.sourceChunkIds.map((sid) => sanitizeReviewText(sid, 80)).filter(Boolean)
          : [];

        if (!text || text.length < 8) {
          errors.push(`claims[${idx}].text must be at least 8 characters.`);
        }
        if (HIGH_RISK_CATEGORIES.has(riskCategory) && sourceChunkIds.length === 0 && normalizedPassages.length === 0) {
          errors.push(`claims[${idx}] (${riskCategory}) requires at least one linked source passage.`);
        }
        for (const sid of sourceChunkIds) {
          if (!passageIds.has(sid)) {
            errors.push(`claims[${idx}] references unknown sourceChunkId "${sid}".`);
          }
        }
        return {
          id,
          text,
          riskCategory,
          entailmentStatus: sanitizeReviewText(c?.entailmentStatus || 'INSUFFICIENT_EVIDENCE', 40),
          sourceChunkIds:
            sourceChunkIds.length > 0
              ? sourceChunkIds
              : normalizedPassages.length > 0
                ? [normalizedPassages[0].chunkId]
                : [],
        };
      })
    : [];

  scanObjectForUnsafeContent(payload, errors);

  if (errors.length > 0) {
    return { valid: false, errors, normalized: null };
  }

  const nowIso = new Date().toISOString();
  return {
    valid: true,
    errors: [],
    normalized: {
      contractVersion: REVIEW_CONTRACT_VERSION,
      serviceId,
      title,
      query,
      confidenceScore: Number(confidenceScore.toFixed(3)),
      claims: normalizedClaims,
      sourcePassages: normalizedPassages,
      provenance: {
        agentId: sanitizeReviewText(prov.agentId, 80),
        modelId: sanitizeReviewText(prov.modelId, 80),
        promptVersion: sanitizeReviewText(prov.promptVersion, 40),
        generatedAt: sanitizeReviewText(prov.generatedAt || nowIso, 40),
      },
      idempotencyKey: sanitizeReviewText(payload.idempotencyKey || '', 120) || null,
    },
  };
}

/**
 * Validates a human reviewer's decision payload.
 */
export function validateReviewDecision(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Decision payload must be a JSON object.'], normalized: null };
  }

  const decision = payload.decision;
  if (!Object.values(REVIEW_DECISION).includes(decision)) {
    errors.push(`decision must be one of: ${Object.values(REVIEW_DECISION).join(', ')}.`);
  }

  const expectedVersion = Number(payload.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    errors.push('expectedVersion must be a positive integer.');
  }

  const rationale = sanitizeReviewText(payload.rationale, MAX_TEXT_LEN);
  if (!rationale || rationale.length < 8) {
    errors.push('rationale is required and must be at least 8 characters.');
  }

  let editedClaims = null;
  if (decision === REVIEW_DECISION.EDIT) {
    if (!Array.isArray(payload.editedClaims) || payload.editedClaims.length === 0) {
      errors.push('editedClaims must be a non-empty array when decision is "edit".');
    } else {
      editedClaims = payload.editedClaims.map((c, idx) => {
        const text = sanitizeReviewText(c?.text, MAX_TEXT_LEN);
        if (!text || text.length < 8) {
          errors.push(`editedClaims[${idx}].text must be at least 8 characters.`);
        }
        return {
          id: sanitizeReviewText(c?.id || `claim-${idx + 1}`, 60),
          text,
          riskCategory: Object.values(CLAIM_RISK_CATEGORY).includes(c?.riskCategory)
            ? c.riskCategory
            : CLAIM_RISK_CATEGORY.GENERAL_FACT,
          entailmentStatus: sanitizeReviewText(c?.entailmentStatus || 'SUPPORTED', 40),
          sourceChunkIds: Array.isArray(c?.sourceChunkIds)
            ? c.sourceChunkIds.map((sid) => sanitizeReviewText(sid, 80)).filter(Boolean)
            : [],
        };
      });
    }
  }

  scanObjectForUnsafeContent({ rationale, editedClaims }, errors);

  if (errors.length > 0) {
    return { valid: false, errors, normalized: null };
  }

  return {
    valid: true,
    errors: [],
    normalized: {
      decision,
      expectedVersion,
      rationale,
      editedClaims,
      idempotencyKey: sanitizeReviewText(payload.idempotencyKey || '', 120) || null,
    },
  };
}

/**
 * Enforces the invariant prohibiting silent regeneration or in-place mutation of approved outputs.
 */
export function assertCanRegenerateOrEdit(record) {
  if (!record) throw new ReviewNotFoundError('unknown');
  if (TERMINAL_APPROVED_STATUSES.has(record.status)) {
    throw new SilentRegenerationForbiddenError(record.id, record.status);
  }
}

/**
 * Builds a sanitized review proposal from an Assistant response payload.
 */
export function buildReviewProposalFromAssistantResponse(query, response) {
  const safeQuery = sanitizeReviewText(query, 500) || 'Civic guidance inquiry';
  const chunks = Array.isArray(response?.retrievedChunks) ? response.retrievedChunks : [];
  const entailmentClaims = Array.isArray(response?.entailment?.claims) ? response.entailment.claims : [];

  const sourcePassages = chunks.map((c, idx) => ({
    chunkId: c.chunkId || `chunk-${idx + 1}`,
    sectionTitle: c.sectionTitle || 'Verified Service Section',
    excerpt: c.excerpt || response?.data?.summary || 'Official guidance excerpt.',
    sourceName: c.sourceName || 'National Government Services Portal',
    sourceUrl: c.sourceUrl || 'https://services.india.gov.in',
    lastVerified: c.lastVerified || response?.data?.lastVerified || null,
  }));

  const fallbackPassageId = sourcePassages[0]?.chunkId || 'chunk-1';
  if (sourcePassages.length === 0 && response?.data?.summary) {
    sourcePassages.push({
      chunkId: fallbackPassageId,
      sectionTitle: response.data.title || 'Civic Guidance',
      excerpt: response.data.summary,
      sourceName: response.data.officialSources?.[0]?.name || 'National Government Services Portal',
      sourceUrl: response.data.officialSources?.[0]?.url || 'https://services.india.gov.in',
      lastVerified: response.data.lastVerified || null,
    });
  }

  const claims =
    entailmentClaims.length > 0
      ? entailmentClaims.map((c, idx) => ({
          id: c.id || `claim-${idx + 1}`,
          text: c.text,
          riskCategory: c.riskCategory || CLAIM_RISK_CATEGORY.GENERAL_FACT,
          entailmentStatus: c.status || 'INSUFFICIENT_EVIDENCE',
          sourceChunkIds:
            Array.isArray(c.supportingChunkIds) && c.supportingChunkIds.length > 0
              ? c.supportingChunkIds
              : [fallbackPassageId],
        }))
      : [
          {
            id: 'claim-1',
            text: response?.data?.summary || 'Civic guidance summary pending human verification.',
            riskCategory: CLAIM_RISK_CATEGORY.GENERAL_FACT,
            entailmentStatus: response?.grounded ? 'SUPPORTED' : 'INSUFFICIENT_EVIDENCE',
            sourceChunkIds: [fallbackPassageId],
          },
        ];

  return {
    serviceId: response?.serviceId || 'general-civic',
    title: response?.data?.title || 'Civic Guidance Output',
    query: safeQuery,
    confidenceScore: typeof response?.confidenceScore === 'number' ? response.confidenceScore : 0.5,
    claims,
    sourcePassages,
    provenance: {
      agentId: 'grounded-civic-assistant',
      modelId: 'bm25-entailment-v1',
      promptVersion: 'civic-grounding-2026.11',
      generatedAt: response?.timestamp || new Date().toISOString(),
    },
  };
}

/**
 * Creates an isolated or localStorage-backed Review Studio store.
 * Accepts an optional storage adapter for testing and server-side use.
 */
export function createReviewStudioStore(initialItems = [], storageAdapter = null) {
  const memoryFallback = new Map();

  const readJson = (key, defaultVal) => {
    if (storageAdapter) return storageAdapter.get(key) ?? defaultVal;
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defaultVal;
      } catch (err) {
        logDiagnostic('ReviewStudio storage read error', err);
        return defaultVal;
      }
    }
    return memoryFallback.get(key) ?? defaultVal;
  };

  const writeJson = (key, value) => {
    if (storageAdapter) {
      storageAdapter.set(key, value);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return;
      } catch (err) {
        logDiagnostic('ReviewStudio storage write error', err);
      }
    }
    memoryFallback.set(key, value);
  };

  if (initialItems.length > 0 && readJson(REVIEW_STORAGE_KEY, null) === null) {
    writeJson(REVIEW_STORAGE_KEY, initialItems);
  }

  const appendAudit = (event) => {
    const events = readJson(REVIEW_AUDIT_KEY, []);
    const next = [event, ...events].slice(0, 1000);
    writeJson(REVIEW_AUDIT_KEY, next);
  };

  return {
    listItems({ status = 'all' } = {}) {
      requirePermission('agentReview.read');
      const items = readJson(REVIEW_STORAGE_KEY, []);
      if (status === 'all') return items;
      return items.filter((item) => item.status === status);
    },

    getItem(id) {
      requirePermission('agentReview.read');
      const items = readJson(REVIEW_STORAGE_KEY, []);
      const found = items.find((item) => item.id === id);
      if (!found) throw new ReviewNotFoundError(id);
      return found;
    },

    listAuditEvents() {
      requirePermission('agentReview.read');
      return readJson(REVIEW_AUDIT_KEY, []);
    },

    submitProposal(rawProposal) {
      requirePermission('agentReview.submit');
      const { valid, errors, normalized } = validateReviewProposal(rawProposal);
      if (!valid) {
        throw new ReviewValidationError(errors[0] || 'Invalid proposal payload.', errors);
      }

      const items = readJson(REVIEW_STORAGE_KEY, []);
      if (normalized.idempotencyKey) {
        const existing = items.find((item) => item.idempotencyKey === normalized.idempotencyKey);
        if (existing) return existing;
      }

      const nowIso = new Date().toISOString();
      const record = {
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        rootId: null,
        version: 1,
        status: REVIEW_STATUS.PENDING_REVIEW,
        ...normalized,
        submittedByRole: roleOf(getCurrentActor()),
        createdAt: nowIso,
        updatedAt: nowIso,
        decisionHistory: [],
      };
      record.rootId = record.id;

      const nextItems = [record, ...items].slice(0, MAX_QUEUE_SIZE);
      writeJson(REVIEW_STORAGE_KEY, nextItems);

      appendAudit({
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        eventType: REVIEW_EVENT_TYPE.PROPOSAL_SUBMITTED,
        contractVersion: REVIEW_CONTRACT_VERSION,
        itemId: record.id,
        version: record.version,
        actorRole: record.submittedByRole,
        timestamp: nowIso,
      });

      return record;
    },

    submitDecision(id, rawDecision) {
      requirePermission('agentReview.decide');
      const { valid, errors, normalized } = validateReviewDecision(rawDecision);
      if (!valid) {
        throw new ReviewValidationError(errors[0] || 'Invalid decision payload.', errors);
      }

      const items = readJson(REVIEW_STORAGE_KEY, []);
      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) throw new ReviewNotFoundError(id);

      const current = items[idx];

      // Idempotent retry check before conflict checks
      if (normalized.idempotencyKey) {
        const alreadyApplied = current.decisionHistory.find(
          (entry) => entry.idempotencyKey === normalized.idempotencyKey
        );
        if (alreadyApplied) return current;
      }

      // Prohibit silent regeneration or un-forked overwrites after approval
      assertCanRegenerateOrEdit(current);

      // Optimistic concurrency check
      if (current.version !== normalized.expectedVersion) {
        throw new VersionConflictError(id, normalized.expectedVersion, current.version);
      }

      const statusMap = {
        [REVIEW_DECISION.APPROVE]: REVIEW_STATUS.APPROVED,
        [REVIEW_DECISION.EDIT]: REVIEW_STATUS.EDITED_APPROVED,
        [REVIEW_DECISION.REJECT]: REVIEW_STATUS.REJECTED,
        [REVIEW_DECISION.ESCALATE]: REVIEW_STATUS.ESCALATED,
      };

      const nowIso = new Date().toISOString();
      const reviewer = actorLabel('AdminReviewer');
      const nextStatus = statusMap[normalized.decision];

      const decisionEntry = {
        decision: normalized.decision,
        rationale: normalized.rationale,
        reviewer,
        reviewerRole: roleOf(getCurrentActor()),
        decidedAt: nowIso,
        fromVersion: current.version,
        toVersion: current.version + 1,
        idempotencyKey: normalized.idempotencyKey,
      };

      const updated = {
        ...current,
        status: nextStatus,
        version: current.version + 1,
        claims: normalized.decision === REVIEW_DECISION.EDIT ? normalized.editedClaims : current.claims,
        updatedAt: nowIso,
        lastDecision: decisionEntry,
        decisionHistory: [...current.decisionHistory, decisionEntry],
      };

      const nextItems = [...items];
      nextItems[idx] = updated;
      writeJson(REVIEW_STORAGE_KEY, nextItems);

      appendAudit({
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        eventType: REVIEW_EVENT_TYPE.DECISION_RECORDED,
        contractVersion: REVIEW_CONTRACT_VERSION,
        itemId: updated.id,
        version: updated.version,
        decision: normalized.decision,
        status: updated.status,
        actor: reviewer,
        actorRole: decisionEntry.reviewerRole,
        timestamp: nowIso,
      });

      return updated;
    },

    /**
     * Explicit version fork from an approved/rejected record so silent regeneration is never needed.
     */
    forkNewVersion(id, { rationale, claims = null, provenance = null } = {}) {
      requirePermission('agentReview.decide');
      const safeRationale = sanitizeReviewText(rationale, MAX_TEXT_LEN);
      if (!safeRationale || safeRationale.length < 8) {
        throw new ReviewValidationError('Forking a new version requires a rationale of at least 8 characters.');
      }

      const items = readJson(REVIEW_STORAGE_KEY, []);
      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) throw new ReviewNotFoundError(id);

      const current = items[idx];
      const nowIso = new Date().toISOString();
      const reviewer = actorLabel('AdminReviewer');

      const supersededCurrent = {
        ...current,
        status: REVIEW_STATUS.SUPERSEDED,
        updatedAt: nowIso,
      };

      const forked = {
        ...current,
        id: `${current.rootId || current.id}-v${current.version + 1}-${Math.random().toString(36).slice(2, 5)}`,
        rootId: current.rootId || current.id,
        parentVersionId: current.id,
        version: current.version + 1,
        status: REVIEW_STATUS.PENDING_REVIEW,
        claims: Array.isArray(claims) && claims.length > 0 ? claims : current.claims,
        provenance: provenance || current.provenance,
        forkRationale: safeRationale,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastDecision: null,
        decisionHistory: [],
      };

      const nextItems = [...items];
      nextItems[idx] = supersededCurrent;
      nextItems.unshift(forked);
      writeJson(REVIEW_STORAGE_KEY, nextItems.slice(0, MAX_QUEUE_SIZE));

      appendAudit({
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        eventType: REVIEW_EVENT_TYPE.VERSION_FORKED,
        contractVersion: REVIEW_CONTRACT_VERSION,
        itemId: forked.id,
        parentItemId: current.id,
        version: forked.version,
        actor: reviewer,
        actorRole: roleOf(getCurrentActor()),
        timestamp: nowIso,
      });

      return forked;
    },

    getMetrics() {
      requirePermission('agentReview.read');
      const items = readJson(REVIEW_STORAGE_KEY, []);
      const counts = {
        total: items.length,
        pending: 0,
        approved: 0,
        editedApproved: 0,
        rejected: 0,
        escalated: 0,
        superseded: 0,
      };
      let confidenceSum = 0;

      for (const item of items) {
        confidenceSum += Number(item.confidenceScore) || 0;
        if (item.status === REVIEW_STATUS.PENDING_REVIEW) counts.pending += 1;
        else if (item.status === REVIEW_STATUS.APPROVED) counts.approved += 1;
        else if (item.status === REVIEW_STATUS.EDITED_APPROVED) counts.editedApproved += 1;
        else if (item.status === REVIEW_STATUS.REJECTED) counts.rejected += 1;
        else if (item.status === REVIEW_STATUS.ESCALATED) counts.escalated += 1;
        else if (item.status === REVIEW_STATUS.SUPERSEDED) counts.superseded += 1;
      }

      return {
        ...counts,
        avgConfidence: items.length > 0 ? Number((confidenceSum / items.length).toFixed(3)) : 0,
      };
    },
  };
}
