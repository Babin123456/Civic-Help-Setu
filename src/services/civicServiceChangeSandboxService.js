/**
 * src/services/civicServiceChangeSandboxService.js
 *
 * Deterministic engine for the Civic Service Change Sandbox with Shadow Traffic
 * Evaluation (#1181).
 *
 * Design rules:
 * - Versioned staging snapshots capture proposed service changes before publish.
 * - Shadow-traffic replay uses synthetic journey patterns and a deterministic
 *   seed so the same inputs always produce the same comparison outcomes.
 * - Compares completion, validation and accessibility outcomes between a
 *   baseline and a proposed service version.
 * - Blocks writes to production during active shadow runs.
 * - Supports rollback of staging snapshots and deterministic replay.
 * - Deterministic rules outside LLM prompts; AI outputs are untrusted suggestions
 *   carrying full provenance.
 * - Aggregate-only results. No citizen records, credentials, raw documents or
 *   sensitive prompts are logged or returned.
 * - Explicit human approval is required to publish a staging snapshot to
 *   production. The sandbox never autonomously files applications, denies
 *   benefits or claims official verification.
 */

import {
  CIVIC_SERVICE_CHANGE_SANDBOX_SCHEMA_VERSION,
  CIVIC_SERVICE_CHANGE_SANDBOX_REVIEW_DATE,
  CIVIC_SERVICE_CHANGE_SANDBOX_STALE_AFTER_DAYS,
  CIVIC_SERVICE_CHANGE_SANDBOX_DISCLAIMER,
  getServiceVersion,
  getStagingSnapshot,
  getSyntheticJourneyPattern,
  getProductionWriteBlockState
} from '../data/civicServiceChangeSandboxData.js';

export const SERVICE_CHANGE_SANDBOX_STORAGE_KEY = 'civicbridge_service_change_sandbox_v1';

export const SNAPSHOT_STATUS = Object.freeze({
  DRAFTING: 'drafting',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  ROLLED_BACK: 'rolled-back'
});

export const COMPARISON_RECOMMENDATION = Object.freeze({
  PROCEED: 'proceed',
  PROCEED_WITH_CAUTION: 'proceed-with-caution',
  HOLD: 'hold',
  REJECT: 'reject'
});

export const SERVICE_CHANGE_ERRORS = Object.freeze({
  INVALID_REQUEST: 'SCS_INVALID_REQUEST',
  INVALID_TYPE: 'SCS_INVALID_TYPE',
  SNAPSHOT_NOT_FOUND: 'SCS_SNAPSHOT_NOT_FOUND',
  SERVICE_VERSION_NOT_FOUND: 'SCS_SERVICE_VERSION_NOT_FOUND',
  JOURNEY_PATTERN_NOT_FOUND: 'SCS_JOURNEY_PATTERN_NOT_FOUND',
  RUN_NOT_FOUND: 'SCS_RUN_NOT_FOUND',
  COMPARISON_NOT_FOUND: 'SCS_COMPARISON_NOT_FOUND',
  VALIDATION_FAILED: 'SCS_VALIDATION_FAILED',
  SENSITIVE_FIELD: 'SCS_SENSITIVE_FIELD',
  SENSITIVE_VALUE: 'SCS_SENSITIVE_VALUE',
  PERMISSION_DENIED: 'SCS_PERMISSION_DENIED',
  PRODUCTION_WRITE_BLOCKED: 'SCS_PRODUCTION_WRITE_BLOCKED',
  STALE_DATA: 'SCS_STALE_DATA',
  STORAGE_UNAVAILABLE: 'SCS_STORAGE_UNAVAILABLE'
});

const MAX_RUN_COUNT = 100000;
const MAX_DESCRIPTION = 2000;
const MAX_TITLE = 200;

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|otp|one.?time|token|secret|credential|api.?key|private.?key|aadhaar.?number|aadhaar.?no|pan.?number|document.?content|file.?content|file.?data|base64|biometric|passphrase|authorization|salary|income.?amount|mobile.?number|phone.?number)/i;

const AADHAAR_NUMBER_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_NUMBER_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const OTP_PATTERN = /\b(?:otp|one[- ]time password)\b\s*[:#-]?\s*\d{4,8}\b/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isSlug = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && SLUG_PATTERN.test(value);

const unique = (items) => Array.from(new Set(items));

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

export function validateServiceChangeRequest(input = {}, { requireSnapshot = false } = {}) {
  const errors = [];
  const fail = (field, code, message) => errors.push({ field, code, message });

  if (!isObject(input)) {
    return {
      valid: false,
      errors: [{ field: '(request)', code: SERVICE_CHANGE_ERRORS.INVALID_TYPE, message: 'Request must be a JSON object.' }]
    };
  }

  const sensitiveKeys = findSensitiveKeys(input);
  for (const where of sensitiveKeys) {
    fail(where, SERVICE_CHANGE_ERRORS.SENSITIVE_FIELD, 'Do not send passwords, OTPs, document numbers, income amounts or phone numbers.');
  }
  const sensitiveText = collectSensitiveText(input);
  for (const where of sensitiveText) {
    fail(where, SERVICE_CHANGE_ERRORS.SENSITIVE_VALUE, 'Remove identity numbers, OTPs, income amounts and phone numbers from the request.');
  }

  if (input.snapshotId !== undefined && !isSlug(input.snapshotId)) {
    fail('snapshotId', SERVICE_CHANGE_ERRORS.INVALID_TYPE, 'snapshotId must be a lowercase slug.');
  }
  if (requireSnapshot && input.snapshotId && !getStagingSnapshot(input.snapshotId)) {
    fail('snapshotId', SERVICE_CHANGE_ERRORS.SNAPSHOT_NOT_FOUND, 'No staging snapshot exists for this snapshot id.');
  }

  if (input.serviceVersionId !== undefined && !isSlug(input.serviceVersionId)) {
    fail('serviceVersionId', SERVICE_CHANGE_ERRORS.INVALID_TYPE, 'serviceVersionId must be a lowercase slug.');
  }
  if (input.serviceVersionId && !getServiceVersion(input.serviceVersionId)) {
    fail('serviceVersionId', SERVICE_CHANGE_ERRORS.SERVICE_VERSION_NOT_FOUND, `Unknown service version id "${input.serviceVersionId}".`);
  }

  if (input.journeyPatternId !== undefined && !isSlug(input.journeyPatternId)) {
    fail('journeyPatternId', SERVICE_CHANGE_ERRORS.INVALID_TYPE, 'journeyPatternId must be a lowercase slug.');
  }
  if (input.journeyPatternId && !getSyntheticJourneyPattern(input.journeyPatternId)) {
    fail('journeyPatternId', SERVICE_CHANGE_ERRORS.JOURNEY_PATTERN_NOT_FOUND, `Unknown journey pattern id "${input.journeyPatternId}".`);
  }

  if (input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim().length === 0 || input.title.length > MAX_TITLE) {
      fail('title', SERVICE_CHANGE_ERRORS.INVALID_TYPE, `title must be a non-empty string up to ${MAX_TITLE} characters.`);
    }
  }

  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.length > MAX_DESCRIPTION) {
      fail('description', SERVICE_CHANGE_ERRORS.INVALID_TYPE, `description must be a string up to ${MAX_DESCRIPTION} characters.`);
    }
  }

  if (input.replayCount !== undefined) {
    if (!Number.isInteger(input.replayCount) || input.replayCount < 1 || input.replayCount > MAX_RUN_COUNT) {
      fail('replayCount', SERVICE_CHANGE_ERRORS.INVALID_TYPE, `replayCount must be an integer between 1 and ${MAX_RUN_COUNT}.`);
    }
  }

  if (input.humanApproved !== undefined && typeof input.humanApproved !== 'boolean') {
    fail('humanApproved', SERVICE_CHANGE_ERRORS.INVALID_TYPE, 'humanApproved must be a boolean.');
  }

  return { valid: errors.length === 0, errors };
}

function seededRandom(seed) {
  let state = ((seed >>> 0) || 0) + 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state >>> 0) / 0xffffffff;
  };
}

function replayJourneyPattern({ journeyPatternId, serviceVersionId, replayCount, seed }) {
  const pattern = getSyntheticJourneyPattern(journeyPatternId);
  const version = getServiceVersion(serviceVersionId);
  if (!pattern || !version) return null;

  const rand = seededRandom(String(seed) + journeyPatternId + serviceVersionId);
  const jitter = (rand() - 0.5) * 0.02;

  const stepPenalty = Math.max(0, (version.steps.length - 5) * 0.005);
  const rulePenalty = Math.max(0, (version.validationRules.length - 2) * 0.003);
  const docPenalty = Math.max(0, (version.documentRequirements.length - 3) * 0.004);

  const completionRate = Math.min(0.99, Math.max(0.01, pattern.completionRate + jitter - stepPenalty - docPenalty));
  const validationFailureRate = Math.min(0.99, Math.max(0.00, pattern.validationFailureRate - jitter + stepPenalty + rulePenalty));
  const accessibilityIssues = Math.max(0, pattern.accessibilityIssues + (version.accessibilityMetadata.ariaLabelsPresent ? 0 : 1));
  const documentDropOffRate = Math.min(0.99, Math.max(0.00, pattern.documentDropOffRate + jitter + docPenalty));
  const averageCompletionTimeSeconds = Math.round(
    pattern.averageCompletionTimeSeconds + (stepPenalty * 500) + (jitter * 100)
  );

  return {
    journeyPatternId,
    serviceVersionId,
    replayCount,
    completionRate: Number(completionRate.toFixed(4)),
    validationFailureRate: Number(validationFailureRate.toFixed(4)),
    accessibilityIssues,
    documentDropOffRate: Number(documentDropOffRate.toFixed(4)),
    averageCompletionTimeSeconds,
    errors: [],
    illustrative: true,
    noCitizenData: true
  };
}

export function runShadowTraffic({
  snapshotId,
  journeyPatternIds,
  replayCount = 1000,
  seed = null,
  today = new Date()
} = {}) {
  const validation = validateServiceChangeRequest({ snapshotId, journeyPatternIds, replayCount });
  if (!validation.valid) {
    return {
      ok: false,
      error: { code: SERVICE_CHANGE_ERRORS.VALIDATION_FAILED, message: 'The shadow traffic request is not valid.' },
      errors: validation.errors
    };
  }

  const snapshot = getStagingSnapshot(snapshotId);
  if (!snapshot) {
    return {
      ok: false,
      error: { code: SERVICE_CHANGE_ERRORS.SNAPSHOT_NOT_FOUND, message: 'Unknown snapshot id.' },
      errors: [{ field: 'snapshotId', code: SERVICE_CHANGE_ERRORS.SNAPSHOT_NOT_FOUND, message: 'Unknown snapshot id.' }]
    };
  }

  const usedSeed = seed != null ? Number(seed) : snapshot.deterministicSeed ?? 20261122;
  const effectiveJourneyPatternIds = unique(journeyPatternIds || []);
  const baselineVersion = getServiceVersion(snapshot.fromVersionId);
  const proposedVersion = getServiceVersion(snapshot.toVersionId);

  if (!baselineVersion || !proposedVersion) {
    return {
      ok: false,
      error: { code: SERVICE_CHANGE_ERRORS.SERVICE_VERSION_NOT_FOUND, message: 'Baseline or proposed service version not found.' },
      errors: [{ field: 'snapshotId', code: SERVICE_CHANGE_ERRORS.SERVICE_VERSION_NOT_FOUND, message: 'Service versions not found.' }]
    };
  }

  const baselineRuns = [];
  const proposedRuns = [];

  for (const jpId of effectiveJourneyPatternIds) {
    const baseline = replayJourneyPattern({ journeyPatternId: jpId, serviceVersionId: snapshot.fromVersionId, replayCount, seed: usedSeed });
    const proposed = replayJourneyPattern({ journeyPatternId: jpId, serviceVersionId: snapshot.toVersionId, replayCount, seed: usedSeed });
    if (baseline) baselineRuns.push(baseline);
    if (proposed) proposedRuns.push(proposed);
  }

  const aggregate = (runs) => {
    if (runs.length === 0) return { completionRate: 0, validationFailureRate: 0, accessibilityIssues: 0, documentDropOffRate: 0, averageCompletionTimeSeconds: 0 };
    return {
      completionRate: Number((runs.reduce((s, r) => s + r.completionRate, 0) / runs.length).toFixed(4)),
      validationFailureRate: Number((runs.reduce((s, r) => s + r.validationFailureRate, 0) / runs.length).toFixed(4)),
      accessibilityIssues: runs.reduce((s, r) => s + r.accessibilityIssues, 0),
      documentDropOffRate: Number((runs.reduce((s, r) => s + r.documentDropOffRate, 0) / runs.length).toFixed(4)),
      averageCompletionTimeSeconds: Math.round(runs.reduce((s, r) => s + r.averageCompletionTimeSeconds, 0) / runs.length)
    };
  };

  const baselineAgg = aggregate(baselineRuns);
  const proposedAgg = aggregate(proposedRuns);

  const completionDelta = Number((proposedAgg.completionRate - baselineAgg.completionRate).toFixed(4));
  const validationFailureDelta = Number((proposedAgg.validationFailureRate - baselineAgg.validationFailureRate).toFixed(4));
  const accessibilityIssuesDelta = proposedAgg.accessibilityIssues - baselineAgg.accessibilityIssues;
  const documentDropOffDelta = Number((proposedAgg.documentDropOffRate - baselineAgg.documentDropOffRate).toFixed(4));
  const completionTimeDeltaSeconds = proposedAgg.averageCompletionTimeSeconds - baselineAgg.averageCompletionTimeSeconds;

  let recommendation = COMPARISON_RECOMMENDATION.PROCEED;
  let reasoning = 'No significant change in completion, validation or accessibility outcomes.';
  if (accessibilityIssuesDelta > 0 || validationFailureDelta > 0.05) {
    recommendation = COMPARISON_RECOMMENDATION.HOLD;
    reasoning = 'Accessibility or validation regression detected; hold publication pending review.';
  } else if (completionDelta < -0.05 || completionTimeDeltaSeconds > 60) {
    recommendation = COMPARISON_RECOMMENDATION.PROCEED_WITH_CAUTION;
    reasoning = 'Notable completion or timing impact; proceed with caution and monitor after rollout.';
  }

  const comparisonId = `comparison-${snapshotId}-${usedSeed}`;
  const comparison = {
    id: comparisonId,
    snapshotId,
    serviceId: snapshot.serviceId,
    baselineRunId: `run-${snapshotId}-baseline`,
    shadowRunId: `run-${snapshotId}-shadow`,
    label: `${snapshot.title} - shadow traffic comparison`,
    completionDelta,
    validationFailureDelta,
    accessibilityIssuesDelta,
    completionTimeDeltaSeconds,
    documentDropOffDelta,
    recommendation,
    reasoning,
    isSynthetic: true,
    noCitizenData: true,
    illustrative: true,
    dataVersion: CIVIC_SERVICE_CHANGE_SANDBOX_REVIEW_DATE
  };

  const isStale = isServiceChangeDataStale(today);

  return {
    ok: true,
    snapshot: {
      id: snapshot.id,
      title: snapshot.title,
      status: snapshot.status,
      fromVersionId: snapshot.fromVersionId,
      toVersionId: snapshot.toVersionId,
      productionWriteBlocked: snapshot.productionWriteBlocked,
      humanApproved: snapshot.humanApproved
    },
    baseline: baselineAgg,
    proposed: proposedAgg,
    comparison,
    journeyRuns: {
      baseline: baselineRuns,
      proposed: proposedRuns
    },
    reproducibility: {
      seed: usedSeed,
      schemaVersion: CIVIC_SERVICE_CHANGE_SANDBOX_SCHEMA_VERSION,
      dataVersion: CIVIC_SERVICE_CHANGE_SANDBOX_REVIEW_DATE
    },
    isStale,
    disclaimer: CIVIC_SERVICE_CHANGE_SANDBOX_DISCLAIMER,
    untrusted: true,
    requiresHumanReview: true,
    noCitizenData: true,
    illustrative: true
  };
}

export function publishSnapshot({ snapshotId, humanApproved = false, actor = null, today = new Date() } = {}) {
  const validation = validateServiceChangeRequest({ snapshotId });
  if (!validation.valid) {
    return { ok: false, error: { code: SERVICE_CHANGE_ERRORS.VALIDATION_FAILED, message: 'The publish request is not valid.' }, errors: validation.errors };
  }

  const snapshot = getStagingSnapshot(snapshotId);
  if (!snapshot) {
    return { ok: false, error: { code: SERVICE_CHANGE_ERRORS.SNAPSHOT_NOT_FOUND, message: 'Unknown snapshot id.' }, errors: [{ field: 'snapshotId', code: SERVICE_CHANGE_ERRORS.SNAPSHOT_NOT_FOUND, message: 'Unknown snapshot id.' }] };
  }

  if (!humanApproved) {
    return {
      ok: false,
      error: { code: SERVICE_CHANGE_ERRORS.PERMISSION_DENIED, message: 'Publishing to production requires explicit human approval.' },
      errors: [{ field: 'humanApproved', code: SERVICE_CHANGE_ERRORS.PERMISSION_DENIED, message: 'Explicit human approval required to publish.' }]
    };
  }

  const writeBlock = getProductionWriteBlockState();
  if (writeBlock.blocked && snapshot.status === SNAPSHOT_STATUS.REVIEWING) {
    return {
      ok: false,
      error: { code: SERVICE_CHANGE_ERRORS.PRODUCTION_WRITE_BLOCKED, message: 'Production writes are blocked during an active shadow run.' },
      blocked: true,
      writeBlock
    };
  }

  return {
    ok: true,
    snapshotId,
    status: SNAPSHOT_STATUS.PUBLISHED,
    publishedAt: today.toISOString(),
    approvedBy: actor ? (actor.username || actor.fullName || actor.email || 'maintainer') : 'maintainer',
    message: 'Staging snapshot published to production. No citizen data was written during shadow runs.'
  };
}

export function rollbackSnapshot({ snapshotId, humanApproved = false, actor = null, today = new Date() } = {}) {
  const validation = validateServiceChangeRequest({ snapshotId });
  if (!validation.valid) {
    return { ok: false, error: { code: SERVICE_CHANGE_ERRORS.VALIDATION_FAILED, message: 'The rollback request is not valid.' }, errors: validation.errors };
  }

  const snapshot = getStagingSnapshot(snapshotId);
  if (!snapshot) {
    return { ok: false, error: { code: SERVICE_CHANGE_ERRORS.SNAPSHOT_NOT_FOUND, message: 'Unknown snapshot id.' }, errors: [{ field: 'snapshotId', code: SERVICE_CHANGE_ERRORS.SNAPSHOT_NOT_FOUND, message: 'Unknown snapshot id.' }] };
  }

  if (!humanApproved) {
    return {
      ok: false,
      error: { code: SERVICE_CHANGE_ERRORS.PERMISSION_DENIED, message: 'Rolling back a snapshot requires explicit human approval.' },
      errors: [{ field: 'humanApproved', code: SERVICE_CHANGE_ERRORS.PERMISSION_DENIED, message: 'Explicit human approval required to roll back.' }]
    };
  }

  return {
    ok: true,
    snapshotId,
    status: SNAPSHOT_STATUS.ROLLED_BACK,
    rolledBackAt: today.toISOString(),
    rolledBackBy: actor ? (actor.username || actor.fullName || actor.email || 'maintainer') : 'maintainer',
    message: 'Staging snapshot rolled back. Production was not modified during shadow runs.'
  };
}

export function createSnapshot({ snapshotId, serviceId, fromVersionId, toVersionId, title, description, deterministicSeed } = {}) {
  const validation = validateServiceChangeRequest({ snapshotId, title, description });
  if (!validation.valid) {
    return { ok: false, error: { code: SERVICE_CHANGE_ERRORS.VALIDATION_FAILED, message: 'The create request is not valid.' }, errors: validation.errors };
  }

  if (getStagingSnapshot(snapshotId)) {
    return {
      ok: false,
      error: { code: SERVICE_CHANGE_ERRORS.VALIDATION_FAILED, message: 'A snapshot with this id already exists.' },
      errors: [{ field: 'snapshotId', code: SERVICE_CHANGE_ERRORS.VALIDATION_FAILED, message: 'Snapshot id already exists.' }]
    };
  }

  if (!getServiceVersion(fromVersionId) || !getServiceVersion(toVersionId)) {
    return {
      ok: false,
      error: { code: SERVICE_CHANGE_ERRORS.SERVICE_VERSION_NOT_FOUND, message: 'From or to service version not found.' },
      errors: [{ field: 'snapshotId', code: SERVICE_CHANGE_ERRORS.SERVICE_VERSION_NOT_FOUND, message: 'Service versions not found.' }]
    };
  }

  const usedSeed = deterministicSeed != null ? Number(deterministicSeed) : 20261122;

  return {
    ok: true,
    snapshot: {
      id: snapshotId,
      serviceId,
      fromVersionId,
      toVersionId,
      title,
      description: description || '',
      status: SNAPSHOT_STATUS.DRAFTING,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      approvedBy: null,
      humanApproved: false,
      productionWriteBlocked: true,
      deterministicSeed: usedSeed,
      shadowTrafficEnabled: true,
      isSynthetic: true
    }
  };
}

export function saveSandboxRun({ runId, snapshotId, status, summary } = {}) {
  const validation = validateServiceChangeRequest({ snapshotId });
  if (!validation.valid) return { ok: false, errors: validation.errors };
  if (snapshotId && !getStagingSnapshot(snapshotId)) {
    return { ok: false, errors: [{ code: SERVICE_CHANGE_ERRORS.SNAPSHOT_NOT_FOUND, message: 'Unknown snapshot id.' }] };
  }
  if (typeof localStorage === 'undefined') {
    return { ok: false, errors: [{ code: SERVICE_CHANGE_ERRORS.STORAGE_UNAVAILABLE, message: 'Browser storage is unavailable.' }] };
  }
  try {
    const stored = readSandboxRuns();
    stored[runId] = {
      runId,
      snapshotId,
      status: status || SNAPSHOT_STATUS.DRAFTING,
      summary: summary || '',
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(SERVICE_CHANGE_SANDBOX_STORAGE_KEY, JSON.stringify(stored));
    return { ok: true };
  } catch {
    return { ok: false, errors: [{ code: SERVICE_CHANGE_ERRORS.STORAGE_UNAVAILABLE, message: 'Run record could not be saved.' }] };
  }
}

function readSandboxRuns() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SERVICE_CHANGE_SANDBOX_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function loadSandboxRun(runId) {
  if (!isSlug(runId)) return null;
  return readSandboxRuns()[runId] || null;
}

export function listSandboxRuns() {
  return Object.values(readSandboxRuns());
}

function isServiceChangeDataStale(today = new Date()) {
  const age = daysBetween(CIVIC_SERVICE_CHANGE_SANDBOX_REVIEW_DATE, todayIso(today));
  return age !== null && age > CIVIC_SERVICE_CHANGE_SANDBOX_STALE_AFTER_DAYS;
}

function daysBetween(fromIso, toIsoValue) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIsoValue}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / 86400000);
}

function todayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) return today.toISOString().slice(0, 10);
  if (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)) return today;
  return new Date().toISOString().slice(0, 10);
}

export function buildShadowTrafficReport(result) {
  if (!result || result.ok !== true) return 'No shadow traffic result to report.';
  const { snapshot, baseline, proposed, comparison, reproducibility } = result;
  const lines = [];
  lines.push('SERVICE CHANGE SANDBOX SHADOW TRAFFIC REPORT (illustrative, untrusted)');
  lines.push(`Snapshot: ${snapshot.title} (${snapshot.id})`);
  lines.push(`From version: ${snapshot.fromVersionId} | To version: ${snapshot.toVersionId}`);
  lines.push(`Seed: ${reproducibility.seed} | Schema: ${reproducibility.schemaVersion}`);
  lines.push('');
  lines.push('BASELINE (current production behavior)');
  lines.push(`- Completion rate: ${baseline.completionRate}`);
  lines.push(`- Validation failure rate: ${baseline.validationFailureRate}`);
  lines.push(`- Accessibility issues: ${baseline.accessibilityIssues}`);
  lines.push(`- Document drop-off rate: ${baseline.documentDropOffRate}`);
  lines.push(`- Average completion time: ${baseline.averageCompletionTimeSeconds}s`);
  lines.push('');
  lines.push('PROPOSED (staging version under shadow traffic)');
  lines.push(`- Completion rate: ${proposed.completionRate}`);
  lines.push(`- Validation failure rate: ${proposed.validationFailureRate}`);
  lines.push(`- Accessibility issues: ${proposed.accessibilityIssues}`);
  lines.push(`- Document drop-off rate: ${proposed.documentDropOffRate}`);
  lines.push(`- Average completion time: ${proposed.averageCompletionTimeSeconds}s`);
  lines.push('');
  lines.push('COMPARISON (proposed minus baseline)');
  lines.push(`- Completion delta: ${comparison.completionDelta}`);
  lines.push(`- Validation failure delta: ${comparison.validationFailureDelta}`);
  lines.push(`- Accessibility issues delta: ${comparison.accessibilityIssuesDelta}`);
  lines.push(`- Completion time delta: ${comparison.completionTimeDeltaSeconds}s`);
  lines.push(`- Document drop-off delta: ${comparison.documentDropOffDelta}`);
  lines.push(`- Recommendation: ${comparison.recommendation}`);
  lines.push(`- Reasoning: ${comparison.reasoning}`);
  lines.push('');
  lines.push(result.disclaimer);
  return lines.join('\n');
}

export const __testables = {
  validateServiceChangeRequest,
  replayJourneyPattern,
  runShadowTraffic,
  publishSnapshot,
  rollbackSnapshot,
  createSnapshot,
  isServiceChangeDataStale,
  computeDigest: (inputs) => {
    let hash = 0;
    const canonical = JSON.stringify(inputs);
    for (let i = 0; i < canonical.length; i++) {
      hash = (hash << 5) - hash + canonical.charCodeAt(i);
      hash = hash & hash;
    }
    return `scs-${Math.abs(hash).toString(16).padStart(8, '0')}`;
  },
  SNAPSHOT_STATUS,
  COMPARISON_RECOMMENDATION,
  SERVICE_CHANGE_ERRORS
};
