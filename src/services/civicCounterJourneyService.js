/**
 * Civic Service Counter Journey Simulator Service (#843)
 *
 * Deterministic engine behind the counter simulator. It resolves a reviewed
 * counter sequence, evaluates document checkpoints, explains missing-document
 * branches, compares a complete visit with an incomplete one, and exports a
 * preparation checklist.
 *
 * Design rules:
 * - Calculations, ordering, status transitions and comparisons are plain code,
 *   never delegated to an AI model.
 * - An AI explanation is a labelled suggestion built only from approved office
 *   guidance. Low-confidence or conflicting evidence is routed to review.
 * - The simulator never invents queue durations, token numbers or live waiting
 *   times, and never claims an official application status.
 * - Only document *types* are stored for resume. No document numbers, contents,
 *   passwords, OTPs or credentials are collected or logged.
 */

import { MOCK_SERVICES } from '../data/services';
import { CIVIC_OFFICES } from '../data/locationOffices';
import {
  COUNTER_JOURNEY_DATA_VERSION,
  COUNTER_JOURNEY_DISCLAIMER,
  COUNTER_JOURNEY_REVIEW_DATE,
  COUNTER_JOURNEY_STALE_AFTER_DAYS,
  COUNTER_JOURNEYS,
  COUNTER_JOURNEY_OFFICES,
  COUNTER_SOURCES,
  JOURNEY_DOCUMENTS,
  getCounterDocument,
  getCounterJourneyById,
  getCounterSource,
  getJourneyOffice,
} from '../data/civicCounterJourneyData.js';

export const JOURNEY_PROGRESS_KEY = 'civicbridge_counter_journey_progress_v1';

export const CHECKPOINT_REQUIREMENT = Object.freeze({
  REQUIRED: 'REQUIRED',
  CONDITIONAL: 'CONDITIONAL',
  OPTIONAL: 'OPTIONAL',
});

export const COUNTER_STATUS = Object.freeze({
  COMPLETE: 'COMPLETE',
  READY: 'READY',
  BLOCKED: 'BLOCKED',
  BRANCH_REQUIRED: 'BRANCH_REQUIRED',
  UPCOMING: 'UPCOMING',
});

export const JOURNEY_STATUS = Object.freeze({
  COMPLETE: 'COMPLETE',
  BLOCKED: 'BLOCKED',
  PARTIAL: 'PARTIAL',
  EMPTY: 'EMPTY',
});

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|otp|one.?time|token|secret|credential|api.?key|private.?key|aadhaar.?number|aadhaar.?no|pan.?number|document.?content|file.?content|file.?data|base64|biometric|passphrase|authorization)/i;

const AADHAAR_NUMBER_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_NUMBER_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const OTP_PATTERN = /\b(?:otp|one[- ]time password)\b\s*[:#-]?\s*\d{4,8}\b/i;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_DOCUMENTS = 100;
const MAX_PAGE_SIZE = 50;

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isSlug = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && SLUG_PATTERN.test(value);

const unique = (items) => Array.from(new Set(items));

const todayIso = (today) => {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return today.toISOString().slice(0, 10);
  }
  if (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)) return today;
  return new Date().toISOString().slice(0, 10);
};

const daysBetween = (fromIso, toIsoValue) => {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIsoValue}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / 86400000);
};

function findSensitiveKeys(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSensitiveKeys(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (!isObject(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    const where = path ? `${path}.${key}` : key;
    if (SENSITIVE_KEY_PATTERN.test(key)) found.push(where);
    findSensitiveKeys(child, where, depth + 1, found);
  }
  return found;
}

function collectSensitiveText(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (typeof value === 'string') {
    if (AADHAAR_NUMBER_PATTERN.test(value)) found.push(`${path}: Aadhaar-like number`);
    else if (PAN_NUMBER_PATTERN.test(value)) found.push(`${path}: PAN-like number`);
    else if (OTP_PATTERN.test(value)) found.push(`${path}: OTP-like value`);
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitiveText(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectSensitiveText(child, path ? `${path}.${key}` : key, depth + 1, found);
    }
  }
  return found;
}

/**
 * Validate a client or server request. Both sides call this so a malformed or
 * unsafe request fails the same way and returns the same structured error list.
 */
export function validateJourneyRequest(input = {}, { requireJourney = true } = {}) {
  const errors = [];
  const fail = (field, code, message) => errors.push({ field, code, message });

  if (!isObject(input)) {
    return {
      valid: false,
      errors: [{ field: '(request)', code: 'INVALID_TYPE', message: 'Request must be a JSON object.' }],
    };
  }

  const sensitiveKeys = findSensitiveKeys(input);
  for (const where of sensitiveKeys) {
    fail(where, 'SENSITIVE_FIELD', 'Do not send passwords, OTPs, document numbers or document contents.');
  }
  const sensitiveText = collectSensitiveText(input);
  for (const where of sensitiveText) {
    fail(where, 'SENSITIVE_VALUE', 'Remove identity numbers and OTPs from the request.');
  }

  if (requireJourney) {
    if (!isSlug(input.journeyId)) {
      fail('journeyId', 'INVALID_JOURNEY_ID', 'A journey id such as "income-certificate-delhi-south" is required.');
    } else if (!getCounterJourneyById(input.journeyId)) {
      fail('journeyId', 'JOURNEY_NOT_FOUND', 'No reviewed counter sequence exists for this journey id.');
    }
  }

  if (input.serviceId !== undefined && !isSlug(input.serviceId)) {
    fail('serviceId', 'INVALID_SERVICE_ID', 'serviceId must be a lowercase slug.');
  }

  if (input.officeId !== undefined && !isSlug(input.officeId)) {
    fail('officeId', 'INVALID_OFFICE_ID', 'officeId must be a lowercase slug.');
  }

  if (input.availableDocumentIds !== undefined) {
    if (!Array.isArray(input.availableDocumentIds)) {
      fail('availableDocumentIds', 'INVALID_DOCUMENT_LIST', 'availableDocumentIds must be an array.');
    } else if (input.availableDocumentIds.length > MAX_DOCUMENTS) {
      fail('availableDocumentIds', 'TOO_MANY_DOCUMENTS', `At most ${MAX_DOCUMENTS} document ids may be sent.`);
    } else {
      input.availableDocumentIds.forEach((documentId, index) => {
        if (typeof documentId !== 'string' || !JOURNEY_DOCUMENTS[documentId]) {
          fail(
            `availableDocumentIds[${index}]`,
            'UNKNOWN_DOCUMENT',
            'Only document types listed by the simulator may be marked available.'
          );
        }
      });
    }
  }

  if (input.context !== undefined) {
    if (!isObject(input.context)) {
      fail('context', 'INVALID_CONTEXT', 'context must be an object of boolean branch answers.');
    } else {
      for (const [key, value] of Object.entries(input.context)) {
        if (!/^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(key)) {
          fail(`context.${key}`, 'INVALID_CONTEXT_KEY', 'Context keys must be simple identifiers.');
        } else if (typeof value !== 'boolean') {
          fail(`context.${key}`, 'INVALID_CONTEXT_VALUE', 'Context answers must be true or false.');
        }
      }
    }
  }

  if (input.page !== undefined && (!Number.isInteger(input.page) || input.page < 1)) {
    fail('page', 'INVALID_PAGE', 'page must be a positive integer.');
  }
  if (
    input.pageSize !== undefined &&
    (!Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > MAX_PAGE_SIZE)
  ) {
    fail('pageSize', 'INVALID_PAGE_SIZE', `pageSize must be between 1 and ${MAX_PAGE_SIZE}.`);
  }

  return { valid: errors.length === 0, errors };
}

function resolveServiceName(serviceId) {
  const service = MOCK_SERVICES.find((item) => item.id === serviceId);
  return service ? service.name : serviceId;
}

function resolveOffice(officeId) {
  const journeyOffice = getJourneyOffice(officeId);
  const directoryOffice = CIVIC_OFFICES.find((office) => office.id === officeId);
  if (!journeyOffice && !directoryOffice) return null;
  return {
    id: officeId,
    name: journeyOffice?.name || directoryOffice?.name || officeId,
    city: journeyOffice?.city || directoryOffice?.city || '',
    state: journeyOffice?.state || directoryOffice?.state || '',
    officeType: journeyOffice?.officeType || directoryOffice?.type || 'Service office',
    sourceId: journeyOffice?.sourceId || null,
  };
}

export function getJourneyCoverage(today = new Date()) {
  return {
    dataVersion: COUNTER_JOURNEY_DATA_VERSION,
    reviewDate: COUNTER_JOURNEY_REVIEW_DATE,
    serviceCount: unique(COUNTER_JOURNEYS.map((journey) => journey.serviceId)).length,
    journeyCount: COUNTER_JOURNEYS.length,
    sourceCount: Object.keys(COUNTER_SOURCES).length,
    isStale: isJourneyDataStale(today),
    staleAfterDays: COUNTER_JOURNEY_STALE_AFTER_DAYS,
  };
}

export function isJourneyDataStale(today = new Date()) {
  const age = daysBetween(COUNTER_JOURNEY_REVIEW_DATE, todayIso(today));
  return age !== null && age > COUNTER_JOURNEY_STALE_AFTER_DAYS;
}

function summariseJourney(journey) {
  const office = resolveOffice(journey.officeId);
  const sourceIds = unique([
    ...(journey.sourceIds || []),
    ...journey.counters.flatMap((counter) => [
      ...(counter.sourceIds || []),
      ...counter.checkpoints.flatMap((item) => item.sourceIds || []),
    ]),
  ]);
  return {
    id: journey.id,
    serviceId: journey.serviceId,
    serviceName: resolveServiceName(journey.serviceId),
    officeId: journey.officeId,
    officeName: office?.name || journey.officeId,
    city: office?.city || '',
    state: office?.state || '',
    title: journey.title,
    counterCount: journey.counters.length,
    documentTypeCount: unique(journey.counters.flatMap((counter) => counter.checkpoints.map((cp) => cp.documentId))).length,
    sourceCount: sourceIds.length,
    reviewedAt: journey.reviewedAt,
    dataVersion: journey.dataVersion,
    processNote: journey.processNote,
  };
}

/**
 * Paginated catalogue of reviewed counter sequences. The UI never downloads the
 * whole catalogue and never needs the full counter boards for a list view.
 */
export function getCounterJourneyCatalogue({ serviceId, page = 1, pageSize = 12, today = new Date() } = {}) {
  const validation = validateJourneyRequest(
    { serviceId, page, pageSize },
    { requireJourney: false }
  );
  if (!validation.valid) {
    return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid catalogue request.' }, errors: validation.errors };
  }

  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, MAX_PAGE_SIZE) : 12;

  const filtered = serviceId
    ? COUNTER_JOURNEYS.filter((journey) => journey.serviceId === serviceId)
    : COUNTER_JOURNEYS;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const start = (safePage - 1) * safePageSize;

  return {
    ok: true,
    items: filtered.slice(start, start + safePageSize).map(summariseJourney),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasMore: start + safePageSize < total,
    dataVersion: COUNTER_JOURNEY_DATA_VERSION,
    reviewDate: COUNTER_JOURNEY_REVIEW_DATE,
    isStale: isJourneyDataStale(today),
    disclaimer: COUNTER_JOURNEY_DISCLAIMER,
  };
}

export function listSimulatorServices(today = new Date()) {
  const catalogue = getCounterJourneyCatalogue({ pageSize: MAX_PAGE_SIZE, today });
  if (!catalogue.ok) return [];
  const byService = new Map();
  for (const item of catalogue.items) {
    if (!byService.has(item.serviceId)) {
      byService.set(item.serviceId, {
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        journeys: [],
      });
    }
    byService.get(item.serviceId).journeys.push({
      id: item.id,
      officeId: item.officeId,
      officeName: item.officeName,
      city: item.city,
      state: item.state,
    });
  }
  return Array.from(byService.values());
}

/**
 * Deterministic dependency ordering. A counter's `dependsOn` ids must exist and
 * the graph must be acyclic; otherwise the journey is refused rather than
 * guessed at.
 */
export function orderCountersDeterministically(counters = []) {
  const errors = [];
  if (!Array.isArray(counters) || counters.length === 0) {
    return { ordered: [], errors: [{ code: 'EMPTY_SEQUENCE', message: 'The journey has no counters.' }] };
  }
  const ids = new Set(counters.map((counter) => counter.id));
  if (ids.size !== counters.length) {
    errors.push({ code: 'DUPLICATE_COUNTER', message: 'The journey has duplicate counter ids.' });
  }
  for (const counter of counters) {
    for (const dependency of counter.dependsOn || []) {
      if (!ids.has(dependency)) {
        errors.push({
          code: 'MISSING_DEPENDENCY',
          message: `Counter "${counter.id}" depends on unknown counter "${dependency}".`,
        });
      }
      if (dependency === counter.id) {
        errors.push({ code: 'SELF_DEPENDENCY', message: `Counter "${counter.id}" depends on itself.` });
      }
    }
  }
  if (errors.length > 0) return { ordered: [], errors };

  const byId = new Map(counters.map((counter) => [counter.id, counter]));
  const sorted = [...counters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
  const state = new Map();
  const ordered = [];

  const visit = (counter, stack) => {
    if (state.get(counter.id) === 'done') return true;
    if (state.get(counter.id) === 'visiting') {
      errors.push({
        code: 'CYCLIC_DEPENDENCY',
        message: `Circular counter dependency: ${[...stack, counter.id].join(' -> ')}.`,
      });
      return false;
    }
    state.set(counter.id, 'visiting');
    for (const dependency of counter.dependsOn || []) {
      if (!visit(byId.get(dependency), [...stack, counter.id])) return false;
    }
    state.set(counter.id, 'done');
    ordered.push(counter);
    return true;
  };

  for (const counter of sorted) {
    if (!visit(counter, [])) return { ordered: [], errors };
  }
  return { ordered, errors };
}

function isCheckpointApplicable(checkpoint, context) {
  if (checkpoint.requirement === CHECKPOINT_REQUIREMENT.REQUIRED) return true;
  if (checkpoint.requirement === CHECKPOINT_REQUIREMENT.CONDITIONAL) {
    const key = checkpoint.conditionKey;
    return Boolean(key && context && context[key] === true);
  }
  return false;
}

function buildBranchCounter(branch, parentCounter, context) {
  if (!branch) return null;
  const documents = (branch.requires || []).map((documentId) => {
    const document = getCounterDocument(documentId);
    return {
      id: documentId,
      label: document?.label || documentId,
      note: document?.note || '',
      sourceIds: document ? [document.sourceId] : [],
      available: false,
    };
  });
  return {
    id: branch.id,
    parentCounterId: parentCounter.id,
    title: branch.title,
    purpose: branch.purpose,
    guidance: branch.guidance,
    repeatVisit: Boolean(branch.repeatVisit),
    isBranch: true,
    sourceIds: branch.sourceIds || [],
    documents,
    context,
  };
}

function resolveSources(sourceIds = []) {
  return unique(sourceIds)
    .map((id) => getCounterSource(id))
    .filter(Boolean);
}

function evaluateCounter(counter, availableSet, context) {
  const missing = [];
  const branchCounters = [];
  const checkpointResults = (counter.checkpoints || []).map((item) => {
    const applicable = isCheckpointApplicable(item, context);
    const available = availableSet.has(item.documentId);
    let status = 'AVAILABLE';
    if (!available) {
      if (!applicable) status = 'NOT_APPLICABLE';
      else if (item.missingBranch) status = 'BRANCH_AVAILABLE';
      else status = 'MISSING';
    }
    if (applicable && !available) {
      missing.push(item);
      if (item.missingBranch) {
        const branch = buildBranchCounter(item.missingBranch, counter, context);
        if (branch && !branchCounters.some((existing) => existing.id === branch.id)) {
          branchCounters.push(branch);
        }
      }
    }
    return {
      ...item,
      applicable,
      available,
      status,
      document: getCounterDocument(item.documentId),
    };
  });

  const requiredCheckpoints = checkpointResults.filter(
    (item) => item.applicable && item.requirement !== CHECKPOINT_REQUIREMENT.OPTIONAL
  );
  const hasRequired = requiredCheckpoints.length > 0;
  const hasMissing = missing.length > 0;
  const hasBranch = branchCounters.length > 0;

  let status;
  if (!hasRequired) status = COUNTER_STATUS.READY;
  else if (!hasMissing) status = COUNTER_STATUS.COMPLETE;
  else if (hasBranch) status = COUNTER_STATUS.BRANCH_REQUIRED;
  else status = COUNTER_STATUS.BLOCKED;

  return {
    ...counter,
    status,
    hasRequired,
    checkpoints: checkpointResults,
    missingCheckpoints: missing.map((item) => ({
      id: item.id,
      documentId: item.documentId,
      label: item.label,
      sourceIds: item.sourceIds || [],
    })),
    branchCounters,
  };
}

function buildBlockersForCounter(counter) {
  const blockers = [];
  for (const checkpoint of counter.missingCheckpoints) {
    const original = (counter.checkpoints || []).find((item) => item.id === checkpoint.id);
    const branch = original?.missingBranch || null;
    blockers.push({
      id: `${counter.id}:${checkpoint.id}`,
      counterId: counter.id,
      counterTitle: counter.title,
      documentId: checkpoint.documentId,
      documentLabel: checkpoint.label,
      kind: branch ? 'MISSING_DOCUMENT_BRANCH' : 'MISSING_DOCUMENT',
      repeatVisit: branch ? Boolean(branch.repeatVisit) : true,
      message: branch
        ? `${checkpoint.label} is missing. Ask the office about the "${branch.title}" route before leaving.`
        : `${checkpoint.label} is missing, so this counter may not proceed.`,
      branch: branch
        ? {
            id: branch.id,
            title: branch.title,
            purpose: branch.purpose,
            guidance: branch.guidance,
            requires: (branch.requires || []).map((documentId) => ({
              id: documentId,
              label: getCounterDocument(documentId)?.label || documentId,
            })),
            sourceIds: branch.sourceIds || [],
            sources: resolveSources(branch.sourceIds || []),
          }
        : null,
      sourceIds: checkpoint.sourceIds || original?.sourceIds || [],
      sources: resolveSources(checkpoint.sourceIds || original?.sourceIds || []),
    });
  }
  for (const branch of counter.branchCounters) {
    branch.documents.forEach((document) => {
      blockers.push({
        id: `${branch.id}:${document.id}`,
        counterId: counter.id,
        counterTitle: counter.title,
        documentId: document.id,
        documentLabel: document.label,
        kind: 'BRANCH_DOCUMENT',
        repeatVisit: branch.repeatVisit,
        message: `The branch counter "${branch.title}" also asks for ${document.label}.`,
        branch: {
          id: branch.id,
          title: branch.title,
          purpose: branch.purpose,
          guidance: branch.guidance,
          requires: branch.documents.map((item) => ({ id: item.id, label: item.label })),
          sourceIds: branch.sourceIds,
          sources: resolveSources(branch.sourceIds),
        },
        sourceIds: branch.sourceIds,
        sources: resolveSources(branch.sourceIds),
      });
    });
  }
  return blockers;
}

function buildLinearChecklist(counters, branchCounters) {
  const items = [];
  counters.forEach((counter, index) => {
    items.push({
      id: counter.id,
      order: counter.order ?? index + 1,
      type: 'COUNTER',
      title: counter.title,
      purpose: counter.purpose,
      status: counter.status,
      documents: counter.checkpoints
        .filter((item) => item.requirement !== CHECKPOINT_REQUIREMENT.OPTIONAL || item.available)
        .map((item) => ({
          id: item.id,
          documentId: item.documentId,
          label: item.label,
          requirement: item.requirement,
          available: item.available,
          applicable: item.applicable,
          sourceIds: item.sourceIds || [],
        })),
      sourceIds: counter.sourceIds || [],
      sources: resolveSources(counter.sourceIds || []),
    });
    branchCounters
      .filter((branch) => branch.parentCounterId === counter.id)
      .forEach((branch) => {
        items.push({
          id: branch.id,
          order: counter.order ?? index + 1,
          type: 'BRANCH',
          title: branch.title,
          purpose: branch.purpose,
          status: 'BRANCH_REQUIRED',
          documents: branch.documents.map((document) => ({
            id: document.id,
            documentId: document.id,
            label: document.label,
            requirement: CHECKPOINT_REQUIREMENT.REQUIRED,
            available: false,
            applicable: true,
            sourceIds: document.sourceIds,
          })),
          sourceIds: branch.sourceIds,
          sources: resolveSources(branch.sourceIds),
        });
      });
  });
  return items;
}

function buildComparison(counters, blockers) {
  const blockedCounters = counters.filter(
    (counter) =>
      counter.status === COUNTER_STATUS.BLOCKED || counter.status === COUNTER_STATUS.BRANCH_REQUIRED
  );
  const clearCounters = counters.filter(
    (counter) => counter.status === COUNTER_STATUS.COMPLETE || counter.status === COUNTER_STATUS.READY
  );
  const missingDocuments = unique(blockers.map((blocker) => blocker.documentId));
  const repeatVisits = blockers.filter((blocker) => blocker.repeatVisit).length;

  return {
    completeVisit: {
      label: 'If every checkpoint is ready',
      counterCount: counters.length,
      countersCleared: counters.length,
      blockedCounters: 0,
      missingDocuments: 0,
      repeatVisitRisk: 0,
      summary:
        'The process path can be followed in the reviewed order without a document-related repeat visit. Approval and timing still depend on the office.',
    },
    incompleteVisit: {
      label: 'With the documents marked today',
      counterCount: counters.length,
      countersCleared: clearCounters.length,
      blockedCounters: blockedCounters.length,
      missingDocuments: missingDocuments.length,
      repeatVisitRisk: repeatVisits,
      missingDocumentIds: missingDocuments,
      summary:
        blockedCounters.length === 0
          ? 'No document checkpoint currently blocks the reviewed path. This is not an official approval.'
          : `${blockedCounters.length} counter(s) need attention before the path can continue. Missing checkpoints can mean a repeat visit.`,
    },
    delta: {
      blockedCounters: blockedCounters.length,
      missingDocuments: missingDocuments.length,
      repeatVisitRisk: repeatVisits,
    },
    isComplete: blockedCounters.length === 0,
  };
}

const NEGATION = /\b(no|not|never|without|does not|do not|did not|cannot|isn't|aren't)\b/i;
const QUEUE_CLAIM_PATTERNS = [
  /\blive\s+(queue|token|waiting|slot)/i,
  /\bqueue\s+(length|position|time|wait)/i,
  /\btoken\s+(number|no\.?|position|status)\b/i,
  /\bwait(?:ing)?\s*(?:time|period)?\s*(?:is|was|of|around|about)?\s*\d+\s*(?:min|minute|hour)/i,
  /\b\d+\s*(?:min|mins|minute|minutes|hour|hours)\s*(?:of\s*)?(?:wait|waiting|queue)/i,
  /\bcurrent\s+wait(?:ing)?\s*time\b/i,
];

/**
 * Detect a fabricated live queue or waiting-time claim. Negated statements such
 * as "this does not show waiting time" are not treated as claims.
 */
export function detectQueueClaim(text) {
  if (typeof text !== 'string' || text.trim() === '') return false;
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.some((sentence) => {
    if (NEGATION.test(sentence)) return false;
    return QUEUE_CLAIM_PATTERNS.some((pattern) => pattern.test(sentence));
  });
}

/**
 * Build a grounded, labelled AI suggestion from approved counter guidance.
 * The model never runs here; this function only selects reviewed text and
 * attaches provenance, confidence and a review decision.
 */
export function buildAICounterExplanation(counter, { confidence, dataVersion = COUNTER_JOURNEY_DATA_VERSION } = {}) {
  if (!counter || !counter.id) {
    return {
      counterId: null,
      label: 'SUGGESTION',
      text: 'No approved counter guidance is available, so no suggestion can be shown.',
      requiresReview: true,
      reviewReason: 'Missing counter record.',
      sourceRefs: [],
      dataVersion,
      containsQueueClaim: false,
      requiresConfirmation: true,
    };
  }

  const sourceIds = unique([
    ...(counter.sourceIds || []),
    ...(counter.checkpoints || []).flatMap((item) => item.sourceIds || []),
  ]);
  const sourceRefs = resolveSources(sourceIds);
  const officialSources = sourceRefs.filter((source) => source.official);
  const inferredConfidence =
    sourceRefs.length === 0 ? 0.2 : officialSources.length > 0 ? 0.9 : 0.55;
  const effectiveConfidence =
    typeof confidence === 'number' && confidence >= 0 && confidence <= 1 ? confidence : inferredConfidence;
  const hasGuidance = typeof counter.guidance === 'string' && counter.guidance.trim().length > 0;
  const missingSources = sourceIds.filter((id) => !getCounterSource(id));
  const conflicts = counter.conflictingEvidence === true || missingSources.length > 0;
  const requiresReview = !hasGuidance || conflicts || effectiveConfidence < 0.7;

  let text;
  if (requiresReview) {
    text = `Suggestion (unconfirmed, routed to review): the approved guidance for "${counter.title}" is missing, incomplete or conflicting, so it cannot be summarised safely. Please confirm the step with the office.`;
  } else {
    text = `Suggestion (unconfirmed): ${counter.guidance.trim()}`;
  }

  return {
    counterId: counter.id,
    counterTitle: counter.title,
    label: 'SUGGESTION',
    text,
    confidence: effectiveConfidence,
    requiresReview,
    reviewReason: requiresReview
      ? !hasGuidance
        ? 'No approved guidance text.'
        : conflicts
          ? 'Missing or conflicting source evidence.'
          : 'Confidence below the review threshold.'
      : null,
    sourceRefs,
    dataVersion,
    containsQueueClaim: detectQueueClaim(text),
    requiresConfirmation: true,
    confirmationPrompt: 'Confirm with the citizen or an authorized reviewer before treating this as guidance.',
  };
}

function buildDataQuality(today) {
  const current = todayIso(today);
  const age = daysBetween(COUNTER_JOURNEY_REVIEW_DATE, current);
  const stale = age !== null && age > COUNTER_JOURNEY_STALE_AFTER_DAYS;
  return {
    dataVersion: COUNTER_JOURNEY_DATA_VERSION,
    reviewDate: COUNTER_JOURNEY_REVIEW_DATE,
    ageDays: age,
    staleAfterDays: COUNTER_JOURNEY_STALE_AFTER_DAYS,
    isStale: stale,
    staleMessage: stale
      ? 'This counter sequence is past its review window. Confirm every step with the office before relying on it.'
      : null,
    disclaimer: COUNTER_JOURNEY_DISCLAIMER,
  };
}

/**
 * Evaluate a journey. This is the core deterministic transformation used by
 * both the browser and the API.
 */
export function evaluateCounterJourney({
  journeyId,
  availableDocumentIds = [],
  context = {},
  today = new Date(),
  includeAISuggestions = true,
} = {}) {
  const validation = validateJourneyRequest({ journeyId, availableDocumentIds, context });
  if (!validation.valid) {
    return {
      ok: false,
      error: { code: 'INVALID_REQUEST', message: 'The journey request is not valid.' },
      errors: validation.errors,
    };
  }

  const journey = getCounterJourneyById(journeyId);
  if (!journey) {
    return {
      ok: false,
      error: { code: 'JOURNEY_NOT_FOUND', message: 'No reviewed counter sequence exists for this journey.' },
      errors: [{ field: 'journeyId', code: 'JOURNEY_NOT_FOUND', message: 'Unknown journey id.' }],
    };
  }

  const ordering = orderCountersDeterministically(journey.counters);
  if (ordering.errors.length > 0) {
    return {
      ok: false,
      error: { code: 'INVALID_JOURNEY_SEQUENCE', message: 'The reviewed sequence has an invalid dependency graph.' },
      errors: ordering.errors,
    };
  }

  const availableSet = new Set(
    (Array.isArray(availableDocumentIds) ? availableDocumentIds : []).filter((id) => JOURNEY_DOCUMENTS[id])
  );
  const counters = [];
  const allBranchCounters = [];
  const blockers = [];
  let firstUnclearCounterId = null;

  ordering.ordered.forEach((counter, index) => {
    const blockedDependencies = (counter.dependsOn || []).filter((dependencyId) => {
      const dependency = counters.find((item) => item.id === dependencyId);
      return (
        dependency &&
        (dependency.status === COUNTER_STATUS.BLOCKED ||
          dependency.status === COUNTER_STATUS.BRANCH_REQUIRED)
      );
    });

    const evaluated = evaluateCounter(counter, availableSet, context);
    evaluated.sequenceIndex = index + 1;

    if (blockedDependencies.length > 0) {
      evaluated.status = COUNTER_STATUS.UPCOMING;
      evaluated.dependencyWarning =
        'An earlier counter in this path is not clear yet. Finish the blocker shown there before relying on this step.';
      evaluated.blockedDependencies = blockedDependencies;
    } else if (
      (evaluated.status === COUNTER_STATUS.BLOCKED ||
        evaluated.status === COUNTER_STATUS.BRANCH_REQUIRED) &&
      !firstUnclearCounterId
    ) {
      firstUnclearCounterId = counter.id;
    }

    counters.push(evaluated);
    allBranchCounters.push(...evaluated.branchCounters);
    blockers.push(...buildBlockersForCounter(evaluated));
  });

  const clearCount = counters.filter(
    (counter) => counter.status === COUNTER_STATUS.COMPLETE || counter.status === COUNTER_STATUS.READY
  ).length;
  const journeyStatus =
    counters.length === 0
      ? JOURNEY_STATUS.EMPTY
      : blockers.length === 0
        ? JOURNEY_STATUS.COMPLETE
        : clearCount === 0
          ? JOURNEY_STATUS.BLOCKED
          : JOURNEY_STATUS.PARTIAL;

  const serviceName = resolveServiceName(journey.serviceId);
  const office = resolveOffice(journey.officeId);
  const usedSourceIds = unique([
    ...(journey.sourceIds || []),
    ...counters.flatMap((counter) => [
      ...(counter.sourceIds || []),
      ...counter.checkpoints.flatMap((item) => item.sourceIds || []),
    ]),
    ...allBranchCounters.flatMap((branch) => branch.sourceIds || []),
  ]);
  const aiSuggestions = includeAISuggestions
    ? counters.map((counter) => buildAICounterExplanation(counter))
    : [];

  return {
    ok: true,
    journey: {
      id: journey.id,
      title: journey.title,
      serviceId: journey.serviceId,
      serviceName,
      officeId: journey.officeId,
      office,
      reviewedAt: journey.reviewedAt,
      dataVersion: journey.dataVersion,
      processNote: journey.processNote,
      disclaimer: COUNTER_JOURNEY_DISCLAIMER,
      isIllustrative: true,
      processOrderOnly: true,
      liveQueueAvailable: false,
    },
    availableDocumentIds: unique(Array.from(availableSet)),
    counters,
    branchCounters: allBranchCounters,
    blockers,
    firstUnclearCounterId,
    journeyStatus,
    linearChecklist: buildLinearChecklist(counters, allBranchCounters),
    comparison: buildComparison(counters, blockers),
    sources: resolveSources(usedSourceIds),
    aiSuggestions,
    dataQuality: buildDataQuality(today),
    officialStatus: {
      isOfficial: false,
      label: 'Private preparation progress',
      message:
        'These ticks are stored only in this browser for your own preparation. They are not an official government application status and are not sent to any department.',
    },
    progress: {
      clearedCounters: clearCount,
      totalCounters: counters.length,
      percent: counters.length === 0 ? 0 : Math.round((clearCount / counters.length) * 100),
    },
  };
}

export function buildJourneyChecklistText(evaluation) {
  if (!evaluation || evaluation.ok !== true) {
    return 'No journey was provided, so no preparation checklist can be generated.';
  }

  const lines = [];
  const { journey, counters, branchCounters, blockers, comparison, dataQuality, officialStatus } = evaluation;

  lines.push('CIVIC HELP SETU — COUNTER PREPARATION CHECKLIST');
  lines.push(`Service: ${journey.serviceName}`);
  lines.push(`Office: ${journey.office?.name || journey.officeId}${journey.office?.city ? `, ${journey.office.city}` : ''}`);
  lines.push(`Reviewed: ${journey.reviewedAt} | Data version: ${journey.dataVersion}`);
  lines.push('');
  lines.push('IMPORTANT');
  lines.push('This is an illustrative preparation aid. Confirm every step with the office.');
  lines.push('It shows process order only: no live queue, token number, waiting time or official status.');
  lines.push('');
  lines.push('VISIT PATH');

  counters.forEach((counter, index) => {
    const mark = counter.status === COUNTER_STATUS.COMPLETE || counter.status === COUNTER_STATUS.READY ? 'x' : ' ';
    lines.push(`${index + 1}. [${mark}] ${counter.title} (${counter.status.replace(/_/g, ' ')})`);
    lines.push(`   Purpose: ${counter.purpose}`);
    counter.checkpoints.forEach((item) => {
      if (item.requirement === CHECKPOINT_REQUIREMENT.OPTIONAL && !item.available) return;
      const tick = item.available ? 'x' : ' ';
      const applicability = item.applicable ? '' : ' [only if the office asks]';
      lines.push(`   - [${tick}] ${item.label} (${item.requirement.toLowerCase()})${applicability}`);
    });
    const branches = branchCounters.filter((branch) => branch.parentCounterId === counter.id);
    branches.forEach((branch) => {
      lines.push(`   ! Missing-document branch: ${branch.title}`);
      lines.push(`     ${branch.purpose}`);
      branch.documents.forEach((document) => {
        lines.push(`     - [ ] ${document.label}`);
      });
    });
    (counter.sourceIds || []).forEach((sourceId) => {
      const source = getCounterSource(sourceId);
      if (source) lines.push(`   Source: ${source.title} — ${source.url}`);
    });
  });

  lines.push('');
  lines.push('BLOCKERS AND REPEAT-VISIT RISK');
  if (blockers.length === 0) {
    lines.push('- No document checkpoint currently blocks the reviewed path.');
  } else {
    blockers.forEach((blocker) => {
      lines.push(
        `- ${blocker.counterTitle}: ${blocker.documentLabel} is missing.${blocker.repeatVisit ? ' This can cause a repeat visit.' : ''}`
      );
      if (blocker.branch) {
        lines.push(`  Ask about: ${blocker.branch.title}. ${blocker.branch.guidance}`);
      }
    });
  }

  lines.push('');
  lines.push('COMPLETE VS INCOMPLETE VISIT');
  lines.push(`- Complete path: ${comparison.completeVisit.countersCleared} of ${comparison.completeVisit.counterCount} counters clear.`);
  lines.push(
    `- Current ticks: ${comparison.incompleteVisit.countersCleared} of ${comparison.incompleteVisit.counterCount} counters clear, ${comparison.incompleteVisit.missingDocuments} missing document type(s), ${comparison.incompleteVisit.repeatVisitRisk} repeat-visit risk item(s).`
  );

  lines.push('');
  lines.push('OFFICIAL STATUS');
  lines.push(`${officialStatus.label}. ${officialStatus.message}`);
  if (dataQuality.isStale) lines.push(`DATA FRESHNESS: ${dataQuality.staleMessage}`);
  lines.push('');
  lines.push('Sources and links are shown in the simulator. Do not write Aadhaar, PAN, OTP or document contents into this checklist.');

  const text = lines.join('\n');
  return detectQueueClaim(text)
    ? `${text}\n\nA possible live-queue claim was removed because this tool cannot verify live queues.`
    : text;
}

export function saveJourneyProgress({ journeyId, availableDocumentIds = [] } = {}) {
  const validation = validateJourneyRequest({ journeyId, availableDocumentIds });
  if (!validation.valid) return { ok: false, errors: validation.errors };
  if (typeof localStorage === 'undefined') return { ok: false, errors: [{ code: 'NO_STORAGE', message: 'Browser storage is unavailable.' }] };

  try {
    const stored = readProgressMap();
    stored[journeyId] = {
      availableDocumentIds: unique(availableDocumentIds.filter((id) => JOURNEY_DOCUMENTS[id])),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(JOURNEY_PROGRESS_KEY, JSON.stringify(stored));
    return { ok: true };
  } catch {
    return { ok: false, errors: [{ code: 'STORAGE_WRITE_FAILED', message: 'Progress could not be saved.' }] };
  }
}

function readProgressMap() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(JOURNEY_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function loadJourneyProgress(journeyId) {
  if (typeof journeyId !== 'string' || !journeyId) return [];
  const stored = readProgressMap();
  const record = stored[journeyId];
  if (!isObject(record) || !Array.isArray(record.availableDocumentIds)) return [];
  return record.availableDocumentIds.filter((id) => JOURNEY_DOCUMENTS[id]);
}

export function clearJourneyProgress(journeyId) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const stored = readProgressMap();
    delete stored[journeyId];
    localStorage.setItem(JOURNEY_PROGRESS_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export const __testables = {
  resolveOffice,
  resolveServiceName,
  buildComparison,
  daysBetween,
  MAX_PAGE_SIZE,
};

export { isCheckpointApplicable };
export { COUNTER_JOURNEY_OFFICES };
export { getCounterJourneyById };
export { COUNTER_JOURNEY_STALE_AFTER_DAYS, COUNTER_JOURNEY_DISCLAIMER };
