/**
 * Trusted service boundary for the Local Government Greenhouse-Gas Inventory (#753).
 *
 * Presentation components never calculate emissions or decide permissions. This module:
 *  - validates every write on the trusted boundary;
 *  - enforces role and jurisdiction scope;
 *  - manages submission, period, factor and recommendation state machines;
 *  - runs the deterministic calculation through the pure contract;
 *  - writes append-only audit events for sensitive actions;
 *  - returns stable error codes that the UI translates into plain-language guidance.
 */

import { getCurrentActor } from './accessControl.js';
import {
  ACTIVITY_STATUS,
  CALCULATION_STATUS,
  DATA_QUALITY,
  EMISSION_CATEGORIES,
  EMISSION_CATEGORY_LABELS,
  FACTOR_STATUS,
  GHG_ERROR_CODES,
  GHG_LIMITS,
  GHG_METHODOLOGY_VERSION,
  INVENTORY_EXPORT_SCHEMA_VERSION,
  PERIOD_STATUS,
  RECOMMENDATION_STATUS,
  SOURCE_STATUS,
  SUBMISSION_ACTION,
  SUBMISSION_ACTION_TARGET,
  SUBMISSION_STATUS,
} from './ghgInventoryConstants.js';
import {
  assertGhgCapability,
  assertGhgJurisdiction,
  describeActorScope,
  filterByJurisdiction,
  resolveActorJurisdictions,
  resolveGhgRole,
} from './ghgInventoryAccessControl.js';
import {
  GhgInventoryError,
  sanitizeText,
  validateEmissionSourceInput,
  validateFactorVersionInput,
  validatePagination,
  validatePeriodInput,
  validateReason,
  validateSubmissionInput,
  validateSubmissionStatusFilter,
} from './ghgInventoryValidation.js';
import {
  assertTransition,
  buildInventoryExport,
  buildMissingDataRecommendation,
  buildPublicSummary,
  calculateEmission,
  compareCategoryTotals,
  computePeriodTotals,
  contentDigest,
  resolveFactorVersion,
  roundTo,
} from '../data/ghgInventoryContract.js';
import {
  applyGhgRetentionPolicy,
  ensureGhgInventory,
  loadGhgInventory,
  resetGhgStorageToEmpty,
  rollbackGhgStorage,
  runGhgTransaction,
} from './ghgInventoryMigrations.js';
import { GHG_JURISDICTIONS } from '../data/ghgInventorySeed.js';
import {
  PERIOD_TRANSITIONS,
  RECOMMENDATION_TRANSITIONS,
  SUBMISSION_TRANSITIONS,
} from './ghgInventoryConstants.js';

const APPROVED_SUBMISSION_STATUSES = [SUBMISSION_STATUS.APPROVED, SUBMISSION_STATUS.LOCKED];
const CALCULABLE_ACTIVITY_STATUSES = [ACTIVITY_STATUS.VALIDATED, ACTIVITY_STATUS.LOCKED];
const PUBLIC_PERIOD_STATUSES = [PERIOD_STATUS.APPROVED, PERIOD_STATUS.LOCKED, PERIOD_STATUS.ARCHIVED];

const nowIso = () => new Date().toISOString();

const generateId = (prefix) => {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  const random =
    cryptoApi && typeof cryptoApi.randomUUID === 'function'
      ? cryptoApi.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${random.toUpperCase()}`;
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const paginate = (items, { page, pageSize }) => {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    hasMore: start + pageSize < total,
  };
};

const audit = (draft, { action, entityType, entityId, actor, reason = '', details = {}, now = nowIso() }) => {
  const role = resolveGhgRole(actor);
  const actorId =
    (actor && (actor.username || actor.email || actor.id)) ||
    (role === 'public' ? 'anonymous' : role);
  const event = {
    id: generateId('AUD'),
    action,
    entityType,
    entityId,
    actorRole: role,
    actorId: sanitizeText(String(actorId), 80),
    reason: sanitizeText(reason, 500),
    details,
    timestamp: now,
    schemaVersion: 1,
  };
  draft.auditEvents.unshift(event);
  if (draft.auditEvents.length > 2000) draft.auditEvents.length = 2000;
  return event;
};

const findSubmission = (data, id) => {
  const submission = data.departmentSubmissions.find((item) => item.id === id);
  if (!submission) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.NOT_FOUND,
      'That department submission no longer exists. Refresh the list and try again.'
    );
  }
  return submission;
};

const findPeriod = (data, id) => {
  const period = data.reportingPeriods.find((item) => item.id === id);
  if (!period) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.NOT_FOUND,
      'That reporting period does not exist. Choose another period.'
    );
  }
  return period;
};

const findSource = (data, id) => {
  const source = data.emissionSources.find((item) => item.id === id);
  if (!source) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.NOT_FOUND,
      'That emission source does not exist. Ask an operator to add it first.'
    );
  }
  return source;
};

const findFactor = (data, id) => {
  const factor = data.emissionFactors.find((item) => item.id === id);
  if (!factor) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.FACTOR_UNAVAILABLE,
      'The emission factor for this source is missing. A reviewer must publish a factor version before calculations can run.'
    );
  }
  return factor;
};

const submissionRecords = (data, submissionId) =>
  data.activityRecords.filter((record) => record.submissionId === submissionId);

const approvedRecordsForPeriod = (data, periodId) => {
  const approvedSubmissionIds = new Set(
    data.departmentSubmissions
      .filter(
        (submission) =>
          submission.periodId === periodId && APPROVED_SUBMISSION_STATUSES.includes(submission.status)
      )
      .map((submission) => submission.id)
  );
  return data.activityRecords.filter(
    (record) =>
      record.periodId === periodId &&
      approvedSubmissionIds.has(record.submissionId) &&
      CALCULABLE_ACTIVITY_STATUSES.includes(record.status)
  );
};

const latestRun = (data, periodId) =>
  data.calculationRuns
    .filter((run) => run.periodId === periodId && run.status === CALCULATION_STATUS.COMPLETED)
    .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))[0] || null;

const latestApprovedAt = (data, periodId) => {
  const submissionTimes = data.departmentSubmissions
    .filter(
      (submission) =>
        submission.periodId === periodId && APPROVED_SUBMISSION_STATUSES.includes(submission.status)
    )
    .map((submission) => new Date(submission.reviewedAt || submission.updatedAt).getTime());
  if (!submissionTimes.length) return null;
  return new Date(Math.max(...submissionTimes)).toISOString();
};

export const evaluateCalculationStaleness = (data, periodId) => {
  const run = latestRun(data, periodId);
  if (!run) {
    return {
      isStale: true,
      reason: 'No calculation has been run for this period yet.',
      latestRun: null,
    };
  }
  const runTime = new Date(run.executedAt).getTime();
  const approvedSubmissionIds = new Set(
    data.departmentSubmissions
      .filter(
        (submission) =>
          submission.periodId === periodId && APPROVED_SUBMISSION_STATUSES.includes(submission.status)
      )
      .map((submission) => submission.id)
  );
  const approvedTimes = data.departmentSubmissions
    .filter((submission) => approvedSubmissionIds.has(submission.id))
    .map((submission) => new Date(submission.updatedAt).getTime());
  const recordTimes = data.activityRecords
    .filter(
      (record) =>
        record.periodId === periodId && approvedSubmissionIds.has(record.submissionId)
    )
    .map((record) => new Date(record.updatedAt).getTime());
  const newest = Math.max(0, ...approvedTimes, ...recordTimes);
  if (newest > runTime) {
    return {
      isStale: true,
      reason:
        'Approved activity data changed after this calculation. Run the calculation again before publishing or exporting.',
      latestRun: run,
    };
  }
  return { isStale: false, reason: null, latestRun: run };
};

const computeLiveTotals = (data, period, records) =>
  computePeriodTotals({
    period,
    records,
    sources: data.emissionSources,
    factors: data.emissionFactors,
    versions: data.factorVersions,
    computedAt: nowIso(),
  });

const enrichRecord = (data, record) => {
  const source = data.emissionSources.find((item) => item.id === record.sourceId) || null;
  const factorId = record.factorId || source?.defaultFactorId;
  const factor = data.emissionFactors.find((item) => item.id === factorId) || null;
  let version = null;
  let emission = null;
  let error = null;
  try {
    version = resolveFactorVersion(
      data.factorVersions,
      factorId,
      record.factorAsOf || null,
      record.factorVersionId
    );
    emission = calculateEmission({
      quantity: record.quantity,
      unit: record.unit,
      factorValue: version.factorValue,
      factorUnit: version.activityUnit || factor?.activityUnit,
      dataQuality: record.dataQuality,
    });
  } catch (caught) {
    error = { code: caught.code || GHG_ERROR_CODES.FACTOR_UNAVAILABLE, message: caught.message };
  }
  return {
    ...record,
    sourceName: source?.name || 'Unknown source',
    department: source?.department || '',
    categoryLabel: EMISSION_CATEGORY_LABELS[record.category] || record.category,
    factorName: factor?.name || null,
    factorSource: factor?.sourceName || null,
    factorVersionNumber: version?.versionNumber ?? null,
    factorValue: version?.factorValue ?? null,
    factorUnit: version?.activityUnit || factor?.activityUnit || null,
    uncertaintyPercent: version?.uncertaintyPercent ?? null,
    tCO2e: emission?.tCO2e ?? null,
    grossTCO2e: emission?.grossTCO2e ?? null,
    formula: emission?.formula ?? null,
    calculationError: error,
  };
};

const toSubmissionSummary = (data, submission) => {
  const records = submissionRecords(data, submission.id);
  const measured = records.filter((record) => record.dataQuality === DATA_QUALITY.MEASURED).length;
  const estimated = records.filter((record) => record.dataQuality === DATA_QUALITY.ESTIMATED).length;
  const excluded = records.filter((record) => record.dataQuality === DATA_QUALITY.EXCLUDED).length;
  return {
    id: submission.id,
    title: submission.title,
    department: submission.department,
    periodId: submission.periodId,
    jurisdictionId: submission.jurisdictionId,
    status: submission.status,
    submittedAt: submission.submittedAt,
    reviewedAt: submission.reviewedAt,
    reviewedBy: submission.reviewedBy,
    recordCount: records.length,
    measuredCount: measured,
    estimatedCount: estimated,
    excludedCount: excluded,
    correctionNotes: submission.correctionNotes,
    reviewNotes: submission.reviewNotes,
    updatedAt: submission.updatedAt,
    createdAt: submission.createdAt,
  };
};

const assertSubmissionWritable = (submission) => {
  if (![SUBMISSION_STATUS.DRAFT, SUBMISSION_STATUS.CHANGES_REQUESTED].includes(submission.status)) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.INVALID_STATE_TRANSITION,
      `Only draft or returned submissions can be edited. This submission is "${submission.status}". Ask the reviewer to return it first.`
    );
  }
};

const assertNoDuplicateSourceRows = (records) => {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.sourceId)) {
      throw new GhgInventoryError(
        GHG_ERROR_CODES.VALIDATION_ERROR,
        'The same emission source appears twice. Combine the values into one row so the total cannot double-count.'
      );
    }
    seen.add(record.sourceId);
  }
};

const assertNoConflictingActiveRecord = (data, { sourceId, periodId, ignoreSubmissionId = null }) => {
  const conflict = data.activityRecords.find(
    (record) =>
      record.sourceId === sourceId &&
      record.periodId === periodId &&
      record.submissionId !== ignoreSubmissionId &&
      ![ACTIVITY_STATUS.REJECTED, ACTIVITY_STATUS.DRAFT].includes(record.status)
  );
  if (conflict) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      `An active activity record already exists for this source in the selected period. Edit the existing submission or ask the reviewer to return it instead of creating a second record.`,
      { conflictRecordId: conflict.id, conflictSubmissionId: conflict.submissionId }
    );
  }
};

const buildRecordsForSubmission = (data, submission, validated, now) => {
  const period = findPeriod(data, submission.periodId);
  return validated.records.map((record) => {
    const source = findSource(data, record.sourceId);
    const factorId = record.factorId || source.defaultFactorId;
    const factor = findFactor(data, factorId);
    const version = resolveFactorVersion(
      data.factorVersions,
      factorId,
      record.factorAsOf || period.endDate,
      record.factorVersionId
    );
    // Refuse a unit/factor mismatch at write time, before an approved record exists.
    calculateEmission({
      quantity: record.quantity,
      unit: record.unit,
      factorValue: version.factorValue,
      factorUnit: version.activityUnit || factor.activityUnit,
      dataQuality: record.dataQuality,
    });
    return {
      id: generateId('ACT'),
      submissionId: submission.id,
      periodId: submission.periodId,
      jurisdictionId: submission.jurisdictionId,
      sourceId: record.sourceId,
      category: source.category,
      quantity: record.quantity,
      unit: record.unit,
      dataQuality: record.dataQuality,
      factorId,
      factorVersionId: version.id,
      factorAsOf: null,
      status: ACTIVITY_STATUS.DRAFT,
      correctionNotes: record.correctionNotes,
      sourceDocument: record.sourceDocument,
      createdBy: submission.createdBy,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
      factorUnitAtEntry: factor.activityUnit,
    };
  });
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const listJurisdictions = () => clone(GHG_JURISDICTIONS);

export const getActorScope = (actor = getCurrentActor()) => describeActorScope(actor);

export const listReportingPeriods = (actor = getCurrentActor(), { includeAll = false } = {}) => {
  assertGhgCapability('inventory.view_staff', actor);
  const data = ensureGhgInventory();
  let periods = data.reportingPeriods;
  if (!includeAll) {
    periods = filterByJurisdiction(periods, actor);
  }
  return periods
    .slice()
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
    .map((period) => {
      const submissionCount = data.departmentSubmissions.filter(
        (submission) => submission.periodId === period.id
      ).length;
      const pendingReviews = data.departmentSubmissions.filter(
        (submission) =>
          submission.periodId === period.id &&
          [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(submission.status)
      ).length;
      return { ...period, submissionCount, pendingReviews };
    });
};

export const getReportingPeriod = (periodId, actor = getCurrentActor()) => {
  assertGhgCapability('inventory.view_staff', actor);
  const data = ensureGhgInventory();
  const period = findPeriod(data, periodId);
  assertGhgJurisdiction(actor, period.jurisdictionId);
  return clone(period);
};

export const listEmissionSources = (
  { jurisdictionId = null, category = null, status = null, search = '', page = 1, pageSize = 25 } = {},
  actor = getCurrentActor()
) => {
  assertGhgCapability('inventory.view_staff', actor);
  const data = ensureGhgInventory();
  const pagination = validatePagination({ page, pageSize });
  let items = filterByJurisdiction(data.emissionSources, actor);
  if (jurisdictionId && jurisdictionId !== 'all') {
    assertGhgJurisdiction(actor, jurisdictionId);
    items = items.filter((source) => source.jurisdictionId === jurisdictionId);
  }
  if (category && category !== 'all') {
    items = items.filter((source) => source.category === category);
  }
  if (status && status !== 'all') {
    items = items.filter((source) => source.status === status);
  }
  if (search && search.trim()) {
    const query = search.trim().toLowerCase();
    items = items.filter(
      (source) =>
        source.name.toLowerCase().includes(query) ||
        source.department.toLowerCase().includes(query) ||
        source.location.toLowerCase().includes(query)
    );
  }
  items = items
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((source) => ({
      ...source,
      recordCount: data.activityRecords.filter((record) => record.sourceId === source.id).length,
    }));
  return paginate(items, pagination);
};

export const listFactorCatalog = (actor = getCurrentActor()) => {
  assertGhgCapability('inventory.view_staff', actor);
  const data = ensureGhgInventory();
  return {
    factors: data.emissionFactors
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((factor) => ({
        ...factor,
        versions: data.factorVersions
          .filter((version) => version.factorId === factor.id)
          .sort((a, b) => b.versionNumber - a.versionNumber),
      })),
    currentVersionIds: data.emissionFactors.map((factor) => factor.currentVersionId),
  };
};

export const getInventorySummary = (periodId, actor = getCurrentActor()) => {
  assertGhgCapability('inventory.view_staff', actor);
  const data = ensureGhgInventory();
  const period = findPeriod(data, periodId);
  assertGhgJurisdiction(actor, period.jurisdictionId);

  const approvedRecords = approvedRecordsForPeriod(data, periodId);
  const live = computeLiveTotals(data, period, approvedRecords);
  const staleness = evaluateCalculationStaleness(data, periodId);
  const submissions = data.departmentSubmissions.filter(
    (submission) => submission.periodId === periodId
  );
  const represented = new Set(approvedRecords.map((record) => record.sourceId));
  const missingSources = data.emissionSources
    .filter(
      (source) =>
        source.jurisdictionId === period.jurisdictionId &&
        source.status === SOURCE_STATUS.ACTIVE &&
        !represented.has(source.id)
    )
    .map((source) => ({
      id: source.id,
      name: source.name,
      department: source.department,
      category: source.category,
    }));

  return {
    period: clone(period),
    calculation: staleness.latestRun ? clone(staleness.latestRun) : null,
    totals: live.totals,
    byCategory: live.byCategory,
    warnings: live.warnings,
    lines: live.lines,
    isStale: staleness.isStale,
    staleReason: staleness.reason,
    approvedSubmissionCount: submissions.filter((submission) =>
      APPROVED_SUBMISSION_STATUSES.includes(submission.status)
    ).length,
    pendingSubmissionCount: submissions.filter((submission) =>
      [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(submission.status)
    ).length,
    draftSubmissionCount: submissions.filter(
      (submission) =>
        [SUBMISSION_STATUS.DRAFT, SUBMISSION_STATUS.CHANGES_REQUESTED].includes(submission.status)
    ).length,
    missingSources,
    lastApprovedAt: latestApprovedAt(data, periodId),
    methodologyVersion: GHG_METHODOLOGY_VERSION,
  };
};

export const listSubmissions = (
  { periodId = null, status = 'all', department = 'all', search = '', page = 1, pageSize = 25 } = {},
  actor = getCurrentActor()
) => {
  assertGhgCapability('inventory.view_staff', actor);
  const data = ensureGhgInventory();
  const pagination = validatePagination({ page, pageSize });
  const safeStatus = validateSubmissionStatusFilter(status);

  let items = filterByJurisdiction(data.departmentSubmissions, actor);
  if (periodId && periodId !== 'all') {
    const period = findPeriod(data, periodId);
    assertGhgJurisdiction(actor, period.jurisdictionId);
    items = items.filter((submission) => submission.periodId === periodId);
  }
  if (safeStatus) items = items.filter((submission) => submission.status === safeStatus);
  if (department && department !== 'all') {
    items = items.filter((submission) => submission.department === department);
  }
  if (search && search.trim()) {
    const query = search.trim().toLowerCase();
    items = items.filter(
      (submission) =>
        submission.title.toLowerCase().includes(query) ||
        submission.department.toLowerCase().includes(query)
    );
  }

  const summaries = items
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((submission) => toSubmissionSummary(data, submission));

  return paginate(summaries, pagination);
};

export const getSubmissionDetail = (submissionId, actor = getCurrentActor()) => {
  assertGhgCapability('inventory.view_staff', actor);
  const data = ensureGhgInventory();
  const submission = findSubmission(data, submissionId);
  assertGhgJurisdiction(actor, submission.jurisdictionId);
  const records = submissionRecords(data, submission.id)
    .slice()
    .sort((a, b) => String(a.sourceId).localeCompare(String(b.sourceId)))
    .map((record) => enrichRecord(data, record));
  const period = findPeriod(data, submission.periodId);
  return {
    ...toSubmissionSummary(data, submission),
    periodLabel: period.label,
    periodStatus: period.status,
    records,
    allowedActions: submissionActionsFor(actor, submission.status),
  };
};

export const listActivityRecords = (
  {
    periodId = null,
    submissionId = null,
    sourceId = null,
    category = 'all',
    dataQuality = 'all',
    page = 1,
    pageSize = 25,
  } = {},
  actor = getCurrentActor()
) => {
  assertGhgCapability('inventory.view_staff', actor);
  const data = ensureGhgInventory();
  const pagination = validatePagination({ page, pageSize });
  let records = filterByJurisdiction(data.activityRecords, actor);
  if (periodId && periodId !== 'all') records = records.filter((record) => record.periodId === periodId);
  if (submissionId) records = records.filter((record) => record.submissionId === submissionId);
  if (sourceId) records = records.filter((record) => record.sourceId === sourceId);
  if (category && category !== 'all') records = records.filter((record) => record.category === category);
  if (dataQuality && dataQuality !== 'all') {
    records = records.filter((record) => record.dataQuality === dataQuality);
  }
  const items = records
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((record) => enrichRecord(data, record));
  return paginate(items, pagination);
};

export const getPeriodComparison = (
  { periodId, comparisonPeriodId },
  actor = getCurrentActor()
) => {
  assertGhgCapability('inventory.view_staff', actor);
  const data = ensureGhgInventory();
  const currentPeriod = findPeriod(data, periodId);
  const previousPeriod = findPeriod(data, comparisonPeriodId);
  assertGhgJurisdiction(actor, currentPeriod.jurisdictionId);
  assertGhgJurisdiction(actor, previousPeriod.jurisdictionId);

  const current = computeLiveTotals(
    data,
    currentPeriod,
    approvedRecordsForPeriod(data, currentPeriod.id)
  );
  const previous = computeLiveTotals(
    data,
    previousPeriod,
    approvedRecordsForPeriod(data, previousPeriod.id)
  );

  return {
    current: {
      period: clone(currentPeriod),
      totals: current.totals,
      byCategory: current.byCategory,
      warnings: current.warnings,
    },
    previous: {
      period: clone(previousPeriod),
      totals: previous.totals,
      byCategory: previous.byCategory,
      warnings: previous.warnings,
    },
    comparison: compareCategoryTotals(current, previous),
    totalChange: {
      currentTCO2e: current.totals.tCO2e,
      previousTCO2e: previous.totals.tCO2e,
      deltaTCO2e: roundTo(current.totals.tCO2e - previous.totals.tCO2e),
      percentChange:
        previous.totals.tCO2e > 0
          ? roundTo(((current.totals.tCO2e - previous.totals.tCO2e) / previous.totals.tCO2e) * 100, 1)
          : null,
    },
    methodologyVersion: GHG_METHODOLOGY_VERSION,
  };
};

export const listCalculationRuns = (periodId, actor = getCurrentActor()) => {
  assertGhgCapability('inventory.view_staff', actor);
  const data = ensureGhgInventory();
  const period = findPeriod(data, periodId);
  assertGhgJurisdiction(actor, period.jurisdictionId);
  return data.calculationRuns
    .filter((run) => run.periodId === periodId)
    .slice()
    .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
    .map((run) => structureRunForDisplay(data, run));
};

const structureRunForDisplay = (data, run) => ({
  ...run,
  lines: (run.activityRecordIds || [])
    .map((recordId) => data.activityRecords.find((record) => record.id === recordId))
    .filter(Boolean)
    .map((record) => enrichRecord(data, record)),
});

export const listRecommendations = (
  { periodId = null, status = 'all', page = 1, pageSize = 25 } = {},
  actor = getCurrentActor()
) => {
  assertGhgCapability('recommendation.review', actor);
  const data = ensureGhgInventory();
  const pagination = validatePagination({ page, pageSize });
  let items = filterByJurisdiction(data.recommendations, actor);
  if (periodId && periodId !== 'all') items = items.filter((item) => item.periodId === periodId);
  if (status && status !== 'all') items = items.filter((item) => item.status === status);
  items = items
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((recommendation) => {
      const source = data.emissionSources.find((item) => item.id === recommendation.sourceId);
      return {
        ...recommendation,
        sourceName: source?.name || 'Unknown source',
        department: source?.department || '',
        categoryLabel: EMISSION_CATEGORY_LABELS[recommendation.category] || recommendation.category,
        allowedDecisions:
          recommendation.status === RECOMMENDATION_STATUS.PENDING ||
          recommendation.status === RECOMMENDATION_STATUS.EDITED,
      };
    });
  return paginate(items, pagination);
};

export const listAuditEvents = ({ page = 1, pageSize = 25 } = {}, actor = getCurrentActor()) => {
  assertGhgCapability('audit.read', actor);
  const data = ensureGhgInventory();
  const pagination = validatePagination({ page, pageSize });
  return paginate(
    data.auditEvents.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    pagination
  );
};

export const listPublicPeriods = (jurisdictionId = 'WARD-042') => {
  const data = ensureGhgInventory();
  return data.reportingPeriods
    .filter(
      (period) =>
        period.jurisdictionId === jurisdictionId.toUpperCase() &&
        PUBLIC_PERIOD_STATUSES.includes(period.status)
    )
    .slice()
    .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))
    .map((period) => {
      const run = latestRun(data, period.id);
      return {
        id: period.id,
        label: period.label,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
        publishedAt: period.publishedAt || latestApprovedAt(data, period.id),
        totals: run?.totals || null,
      };
    });
};

/**
 * Public projection. Only approved/locked/archived periods and approved activity records are
 * aggregated. Internal ids, notes, actors and source documents never leave this function.
 */
export const getPublicInventorySummary = ({ periodId = null, jurisdictionId = 'WARD-042' } = {}) => {
  const data = ensureGhgInventory();
  const jurisdiction = GHG_JURISDICTIONS.find(
    (item) => item.id === String(jurisdictionId).toUpperCase()
  );
  if (!jurisdiction) {
    throw new GhgInventoryError(GHG_ERROR_CODES.NOT_FOUND, 'That jurisdiction is not configured.');
  }

  const periods = data.reportingPeriods
    .filter(
      (period) =>
        period.jurisdictionId === jurisdiction.id && PUBLIC_PERIOD_STATUSES.includes(period.status)
    )
    .sort((a, b) => new Date(b.endDate) - new Date(a.endDate));

  const period = periodId
    ? periods.find((item) => item.id === periodId)
    : periods[0];

  if (!period) {
    return {
      available: false,
      reason:
        'No approved inventory has been published for this jurisdiction yet. Public totals appear after a reviewer approves the period.',
      periods: periods.map((item) => ({ id: item.id, label: item.label })),
    };
  }

  const approvedRecords = approvedRecordsForPeriod(data, period.id);
  if (approvedRecords.length === 0) {
    return {
      available: false,
      reason: 'The approved period has no approved activity records yet.',
      periods: periods.map((item) => ({ id: item.id, label: item.label })),
    };
  }

  const totals = computeLiveTotals(data, period, approvedRecords);
  const calculationRun = {
    methodologyVersion: totals.methodologyVersion,
    totals: totals.totals,
    byCategory: totals.byCategory,
    warnings: totals.warnings,
  };
  const summary = buildPublicSummary({ period, jurisdiction, calculationRun, generatedAt: nowIso() });
  return {
    available: true,
    summary,
    periods: periods.map((item) => ({
      id: item.id,
      label: item.label,
      status: item.status,
      publishedAt: item.publishedAt || latestApprovedAt(data, item.id),
    })),
  };
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const createEmissionSource = (payload, actor = getCurrentActor()) => {
  assertGhgCapability('source.manage', actor);
  const jurisdictionId = String(payload?.jurisdictionId || '').toUpperCase();
  assertGhgJurisdiction(actor, jurisdictionId);
  const validated = validateEmissionSourceInput(payload);
  const data = ensureGhgInventory();
  findFactor(data, validated.defaultFactorId);
  const now = nowIso();
  const source = {
    id: generateId('SRC'),
    jurisdictionId,
    ...validated,
    ownerRole: 'operator',
    createdBy: actor?.username || actor?.id || 'operator',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
  const { data: next, result } = runGhgTransaction(
    (draft) => {
      draft.emissionSources.push(source);
      const event = audit(draft, {
        action: 'source.created',
        entityType: 'emission_source',
        entityId: source.id,
        actor,
        reason: 'New municipal emission source added.',
        details: { jurisdictionId, category: source.category },
        now,
      });
      return { source, event };
    },
    { now }
  );
  return { source: clone(result.source), auditEventId: result.event.id, schemaVersion: next.schemaVersion };
};

export const updateEmissionSource = (sourceId, payload, actor = getCurrentActor()) => {
  assertGhgCapability('source.manage', actor);
  const data = ensureGhgInventory();
  const existing = findSource(data, sourceId);
  assertGhgJurisdiction(actor, existing.jurisdictionId);
  const validated = validateEmissionSourceInput({ ...existing, ...payload });
  findFactor(data, validated.defaultFactorId);
  const now = nowIso();
  const { result } = runGhgTransaction(
    (draft) => {
      const target = findSource(draft, sourceId);
      Object.assign(target, validated, { updatedAt: now });
      const event = audit(draft, {
        action: 'source.updated',
        entityType: 'emission_source',
        entityId: sourceId,
        actor,
        reason: payload?.reason || 'Emission source metadata updated.',
        details: { defaultFactorId: target.defaultFactorId },
        now,
      });
      return { source: target, event };
    },
    { now }
  );
  return { source: clone(result.source), auditEventId: result.event.id };
};

export const createSubmission = (payload, actor = getCurrentActor()) => {
  assertGhgCapability('submission.create', actor);
  const data = ensureGhgInventory();
  const period = findPeriod(data, payload?.periodId);
  assertGhgJurisdiction(actor, period.jurisdictionId);
  if (
    payload?.jurisdictionId &&
    String(payload.jurisdictionId).toUpperCase() !== period.jurisdictionId
  ) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.JURISDICTION_DENIED,
      `This reporting period belongs to ${period.jurisdictionId}; activity data cannot be filed under another jurisdiction.`
    );
  }
  if (![PERIOD_STATUS.OPEN, PERIOD_STATUS.DRAFT].includes(period.status)) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.INVALID_STATE_TRANSITION,
      `The reporting period is "${period.status}" and is not accepting department data. Ask an administrator to open it.`
    );
  }

  const idempotencyKey = String(payload?.idempotencyKey || '');
  const existing = data.departmentSubmissions.find(
    (submission) =>
      submission.idempotencyKey === idempotencyKey &&
      submission.periodId === period.id &&
      submission.jurisdictionId === period.jurisdictionId
  );
  if (existing) {
    return { ...getSubmissionDetail(existing.id, actor), idempotent: true };
  }

  const scopedSources = data.emissionSources.filter(
    (source) => source.jurisdictionId === period.jurisdictionId
  );
  const validated = validateSubmissionInput(payload, {
    sources: scopedSources,
    jurisdictionId: period.jurisdictionId,
  });
  assertNoDuplicateSourceRows(validated.records);
  for (const record of validated.records) {
    assertNoConflictingActiveRecord(data, {
      sourceId: record.sourceId,
      periodId: period.id,
    });
  }

  const now = nowIso();
  const submission = {
    id: generateId('SUB'),
    periodId: period.id,
    jurisdictionId: period.jurisdictionId,
    department: validated.department,
    title: validated.title,
    status: SUBMISSION_STATUS.DRAFT,
    submittedBy: actor?.username || actor?.id || 'operator',
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: '',
    correctionNotes: validated.correctionNotes,
    idempotencyKey,
    activityRecordIds: [],
    createdBy: actor?.username || actor?.id || 'operator',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  const { result } = runGhgTransaction(
    (draft) => {
      const records = buildRecordsForSubmission(draft, submission, validated, now);
      if (!records.length) {
        throw new GhgInventoryError(
          GHG_ERROR_CODES.VALIDATION_ERROR,
          'At least one valid activity record is required.'
        );
      }
      submission.activityRecordIds = records.map((record) => record.id);
      draft.departmentSubmissions.unshift(submission);
      draft.activityRecords.unshift(...records);
      const event = audit(draft, {
        action: 'submission.created',
        entityType: 'department_submission',
        entityId: submission.id,
        actor,
        reason: 'Department activity data saved as a draft.',
        details: {
          periodId: period.id,
          recordCount: records.length,
          dataQuality: records.map((record) => record.dataQuality),
        },
        now,
      });
      return { submission, records, event };
    },
    { now }
  );

  return {
    ...getSubmissionDetail(result.submission.id, actor),
    auditEventId: result.event.id,
    idempotent: false,
  };
};

export const updateSubmission = (submissionId, payload, actor = getCurrentActor(), { storage = null } = {}) => {
  assertGhgCapability('submission.update', actor);
  const data = loadGhgInventory({ storage });
  const submission = findSubmission(data, submissionId);
  assertGhgJurisdiction(actor, submission.jurisdictionId);
  assertSubmissionWritable(submission);
  if (payload?.expectedUpdatedAt && payload.expectedUpdatedAt !== submission.updatedAt) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'This submission changed in another tab or by another operator. Reload it before saving so one edit does not overwrite the other.'
    );
  }
  const period = findPeriod(data, submission.periodId);
  const scopedSources = data.emissionSources.filter(
    (source) => source.jurisdictionId === submission.jurisdictionId
  );
  const validated = validateSubmissionInput(
    {
      ...payload,
      department: payload.department || submission.department,
      title: payload.title || submission.title,
      idempotencyKey: submission.idempotencyKey,
      records: payload.records || submissionRecords(data, submission.id),
    },
    { sources: scopedSources, jurisdictionId: submission.jurisdictionId }
  );
  assertNoDuplicateSourceRows(validated.records);
  for (const record of validated.records) {
    assertNoConflictingActiveRecord(data, {
      sourceId: record.sourceId,
      periodId: submission.periodId,
      ignoreSubmissionId: submission.id,
    });
  }

  const now = nowIso();
  const { result } = runGhgTransaction(
    (draft) => {
      const target = findSubmission(draft, submissionId);
      target.title = validated.title;
      target.department = validated.department;
      target.correctionNotes = validated.correctionNotes;
      target.updatedAt = now;

      draft.activityRecords = draft.activityRecords.filter(
        (record) => record.submissionId !== submissionId
      );
      const records = buildRecordsForSubmission(draft, target, validated, now).map((record) => ({
        ...record,
        status:
          target.status === SUBMISSION_STATUS.CHANGES_REQUESTED
            ? ACTIVITY_STATUS.NEEDS_CORRECTION
            : ACTIVITY_STATUS.DRAFT,
      }));
      target.activityRecordIds = records.map((record) => record.id);
      draft.activityRecords.unshift(...records);
      const event = audit(draft, {
        action: 'submission.updated',
        entityType: 'department_submission',
        entityId: submissionId,
        actor,
        reason: payload?.reason || 'Department corrected its draft activity data.',
        details: { periodId: period.id, recordCount: records.length },
        now,
      });
      return { submission: target, records, event };
    },
    { now }
  );

  return {
    ...getSubmissionDetail(result.submission.id, actor),
    auditEventId: result.event.id,
  };
};

export const submitSubmission = (submissionId, actor = getCurrentActor(), { storage = null } = {}) => {
  assertGhgCapability('submission.submit', actor);
  const data = loadGhgInventory({ storage });
  const submission = findSubmission(data, submissionId);
  assertGhgJurisdiction(actor, submission.jurisdictionId);
  assertTransition(SUBMISSION_TRANSITIONS, submission.status, SUBMISSION_STATUS.SUBMITTED, 'Submission');
  const records = submissionRecords(data, submission.id);
  if (!records.length) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'This submission has no activity records. Add at least one value before submitting.'
    );
  }
  for (const record of records) {
    const enriched = enrichRecord(data, record);
    if (enriched.calculationError) {
      throw new GhgInventoryError(
        enriched.calculationError.code,
        `Activity row for ${enriched.sourceName} cannot be submitted: ${enriched.calculationError.message}`
      );
    }
  }
  const now = nowIso();
  const { result } = runGhgTransaction(
    (draft) => {
      const target = findSubmission(draft, submissionId);
      target.status = SUBMISSION_STATUS.SUBMITTED;
      target.submittedAt = now;
      target.submittedBy = actor?.username || actor?.id || 'operator';
      target.updatedAt = now;
      draft.activityRecords = draft.activityRecords.map((record) =>
        record.submissionId === submissionId
          ? { ...record, status: ACTIVITY_STATUS.SUBMITTED, updatedAt: now }
          : record
      );
      const event = audit(draft, {
        action: 'submission.submitted',
        entityType: 'department_submission',
        entityId: submissionId,
        actor,
        reason: 'Department submitted activity data for review.',
        details: { recordCount: records.length, periodId: submission.periodId },
        now,
      });
      return { event };
    },
    { now }
  );
  return {
    ...getSubmissionDetail(submissionId, actor),
    auditEventId: result.event.id,
  };
};

export const submissionActionsFor = (actor, status) => {
  const role = resolveGhgRole(actor);
  const actions = [];
  if (['operator', 'admin'].includes(role)) {
    if ([SUBMISSION_STATUS.DRAFT, SUBMISSION_STATUS.CHANGES_REQUESTED].includes(status)) {
      actions.push('edit', 'submit');
    }
  }
  if (['reviewer', 'admin'].includes(role)) {
    if (status === SUBMISSION_STATUS.SUBMITTED) actions.push('start_review', 'request_changes', 'reject');
    if (status === SUBMISSION_STATUS.UNDER_REVIEW) actions.push('approve', 'request_changes', 'reject');
    if (status === SUBMISSION_STATUS.APPROVED) actions.push('lock', 'reopen');
  }
  return actions;
};

export const reviewSubmission = (
  submissionId,
  action,
  payload = {},
  actor = getCurrentActor(),
  { storage = null } = {}
) => {
  assertGhgCapability('submission.review', actor);
  const data = loadGhgInventory({ storage });
  const submission = findSubmission(data, submissionId);
  assertGhgJurisdiction(actor, submission.jurisdictionId);

  const targetStatus = SUBMISSION_ACTION_TARGET[action];
  if (!targetStatus) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `Unknown review action "${action}". Allowed actions: ${Object.values(SUBMISSION_ACTION).join(', ')}.`
    );
  }
  assertTransition(SUBMISSION_TRANSITIONS, submission.status, targetStatus, 'Submission');

  const reasonRequired = [
    SUBMISSION_ACTION.REQUEST_CHANGES,
    SUBMISSION_ACTION.REJECT,
    SUBMISSION_ACTION.REOPEN,
  ].includes(action);
  const reason = validateReason(payload.reason, {
    required: reasonRequired,
    fieldLabel: 'review reason',
  });

  const now = nowIso();
  const { result } = runGhgTransaction(
    (draft) => {
      const target = findSubmission(draft, submissionId);
      target.status = targetStatus;
      target.reviewedBy = actor?.username || actor?.id || 'reviewer';
      target.reviewedAt = now;
      target.updatedAt = now;
      if (reason) target.reviewNotes = reason;
      if (payload.correctionNotes) {
        target.correctionNotes = sanitizeText(payload.correctionNotes, GHG_LIMITS.MAX_NOTE_LENGTH);
      }

      const recordTarget =
        targetStatus === SUBMISSION_STATUS.APPROVED
          ? ACTIVITY_STATUS.VALIDATED
          : targetStatus === SUBMISSION_STATUS.LOCKED
            ? ACTIVITY_STATUS.LOCKED
            : targetStatus === SUBMISSION_STATUS.CHANGES_REQUESTED
              ? ACTIVITY_STATUS.NEEDS_CORRECTION
              : targetStatus === SUBMISSION_STATUS.REJECTED
                ? ACTIVITY_STATUS.REJECTED
                : null;

      if (recordTarget) {
        draft.activityRecords = draft.activityRecords.map((record) =>
          record.submissionId === submissionId
            ? {
                ...record,
                status: recordTarget,
                correctionNotes:
                  targetStatus === SUBMISSION_STATUS.CHANGES_REQUESTED && reason
                    ? sanitizeText(
                        `${record.correctionNotes ? `${record.correctionNotes} ` : ''}Reviewer: ${reason}`,
                        GHG_LIMITS.MAX_NOTE_LENGTH
                      )
                    : record.correctionNotes,
                updatedAt: now,
              }
            : record
        );
      }

      const event = audit(draft, {
        action: `submission.${action}`,
        entityType: 'department_submission',
        entityId: submissionId,
        actor,
        reason,
        details: {
          fromStatus: submission.status,
          toStatus: targetStatus,
          periodId: submission.periodId,
        },
        now,
      });
      return { event, targetStatus };
    },
    { now }
  );

  return {
    ...getSubmissionDetail(submissionId, actor),
    auditEventId: result.event.id,
    previousStatus: submission.status,
  };
};

export const runPeriodCalculation = (
  { periodId, idempotencyKey = null, reason = '' } = {},
  actor = getCurrentActor(),
  { storage = null } = {}
) => {
  assertGhgCapability('calculation.run', actor);
  const data = loadGhgInventory({ storage });
  const period = findPeriod(data, periodId);
  assertGhgJurisdiction(actor, period.jurisdictionId);

  if (idempotencyKey) {
    const existingRun = data.calculationRuns.find(
      (run) => run.periodId === periodId && run.idempotencyKey === idempotencyKey
    );
    if (existingRun) {
      return { ...structureRunForDisplay(data, existingRun), idempotent: true };
    }
  }

  const records = approvedRecordsForPeriod(data, period.id);
  if (records.length === 0) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'There are no approved activity records to calculate. Approve at least one department submission first.'
    );
  }

  const totals = computeLiveTotals(data, period, records);
  const now = nowIso();
  const runId = generateId('RUN');
  const outputHash = contentDigest({
    periodId: period.id,
    methodologyVersion: totals.methodologyVersion,
    activityRecordIds: totals.activityRecordIds,
    factorVersionIds: totals.factorVersionIds,
    totals: totals.totals,
  });

  const { result } = runGhgTransaction(
    (draft) => {
      draft.calculationRuns = draft.calculationRuns.map((run) =>
        run.periodId === period.id && run.status === CALCULATION_STATUS.COMPLETED
          ? { ...run, status: CALCULATION_STATUS.SUPERSEDED, supersededAt: now }
          : run
      );
      const run = {
        id: runId,
        periodId: period.id,
        jurisdictionId: period.jurisdictionId,
        status: CALCULATION_STATUS.COMPLETED,
        methodologyVersion: totals.methodologyVersion,
        rulesetVersion: null,
        executedAt: now,
        executedBy: actor?.username || actor?.id || 'operator',
        idempotencyKey,
        activityRecordIds: totals.activityRecordIds,
        factorVersionIds: totals.factorVersionIds,
        outputHash,
        warnings: totals.warnings.map((warning) => warning.message),
        lineWarnings: totals.warnings,
        lines: totals.lines,
        totals: totals.totals,
        byCategory: totals.byCategory,
        approvedSubmissionIds: draft.departmentSubmissions
          .filter(
            (submission) =>
              submission.periodId === period.id &&
              APPROVED_SUBMISSION_STATUSES.includes(submission.status)
          )
          .map((submission) => submission.id),
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
        createdBy: actor?.username || actor?.id || 'operator',
      };
      draft.calculationRuns.unshift(run);
      const event = audit(draft, {
        action: 'calculation.completed',
        entityType: 'calculation_run',
        entityId: runId,
        actor,
        reason: reason || 'Deterministic emission totals calculated from approved activity data.',
        details: {
          periodId: period.id,
          recordCount: totals.lines.length,
          tCO2e: totals.totals.tCO2e,
          factorVersionIds: totals.factorVersionIds,
          outputHash,
        },
        now,
      });
      return { run, event };
    },
    { now }
  );

  return {
    ...structureRunForDisplay({ ...data, activityRecords: data.activityRecords }, result.run),
    auditEventId: result.event.id,
    idempotent: false,
  };
};

export const publishFactorVersion = (factorId, payload, actor = getCurrentActor(), { storage = null } = {}) => {
  assertGhgCapability('factor.publish', actor);
  const data = loadGhgInventory({ storage });
  const factor = findFactor(data, factorId);
  const validated = validateFactorVersionInput(payload, { factor });
  const now = nowIso();
  const versionId = generateId('EFV');

  const { result } = runGhgTransaction(
    (draft) => {
      const targetFactor = findFactor(draft, factorId);
      const previousVersions = draft.factorVersions.filter(
        (version) => version.factorId === factorId
      );
      const nextVersionNumber =
        Math.max(0, ...previousVersions.map((version) => version.versionNumber || 0)) + 1;
      for (const version of previousVersions) {
        if (
          !version.effectiveTo &&
          new Date(version.effectiveFrom) < new Date(validated.effectiveFrom)
        ) {
          const dayBefore = new Date(validated.effectiveFrom);
          dayBefore.setDate(dayBefore.getDate() - 1);
          version.effectiveTo = dayBefore.toISOString().slice(0, 10);
          version.updatedAt = now;
        }
      }
      const version = {
        id: versionId,
        factorId,
        versionNumber: nextVersionNumber,
        factorValue: validated.factorValue,
        activityUnit: validated.activityUnit,
        effectiveFrom: validated.effectiveFrom,
        effectiveTo: validated.effectiveTo,
        publishedAt: now,
        publishedBy: actor?.username || actor?.id || 'admin',
        status: FACTOR_STATUS.PUBLISHED,
        changeNote: validated.changeNote,
        uncertaintyPercent: validated.uncertaintyPercent,
        methodology: validated.methodology,
        createdAt: now,
        updatedAt: now,
        createdBy: actor?.username || actor?.id || 'admin',
        schemaVersion: 1,
      };
      draft.factorVersions.push(version);
      targetFactor.currentVersionId = version.id;
      targetFactor.updatedAt = now;
      const event = audit(draft, {
        action: 'factor.version_published',
        entityType: 'factor_version',
        entityId: version.id,
        actor,
        reason: validated.changeNote,
        details: {
          factorId,
          factorValue: version.factorValue,
          effectiveFrom: version.effectiveFrom,
          previousVersionId: previousVersions.sort((a, b) => b.versionNumber - a.versionNumber)[0]?.id || null,
        },
        now,
      });
      return { version, event };
    },
    { now }
  );

  return { version: clone(result.version), auditEventId: result.event.id };
};

export const createReportingPeriod = (payload, actor = getCurrentActor()) => {
  assertGhgCapability('period.manage', actor);
  const jurisdictionId = String(payload?.jurisdictionId || '').toUpperCase();
  assertGhgJurisdiction(actor, jurisdictionId);
  const validated = validatePeriodInput(payload);
  const now = nowIso();
  const period = {
    id: generateId('PER'),
    jurisdictionId,
    ...validated,
    publishedAt: null,
    createdBy: actor?.username || actor?.id || 'admin',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
  const { result } = runGhgTransaction(
    (draft) => {
      const overlap = draft.reportingPeriods.find(
        (item) =>
          item.jurisdictionId === jurisdictionId &&
          new Date(item.startDate) <= new Date(validated.endDate) &&
          new Date(item.endDate) >= new Date(validated.startDate)
      );
      if (overlap) {
        throw new GhgInventoryError(
          GHG_ERROR_CODES.VALIDATION_ERROR,
          `This period overlaps "${overlap.label}". Use a separate, non-overlapping reporting window.`
        );
      }
      draft.reportingPeriods.push(period);
      const event = audit(draft, {
        action: 'period.created',
        entityType: 'reporting_period',
        entityId: period.id,
        actor,
        reason: payload?.reason || 'New reporting period created.',
        details: { jurisdictionId, startDate: period.startDate, endDate: period.endDate },
        now,
      });
      return { event };
    },
    { now }
  );
  return { period: clone(period), auditEventId: result.event.id };
};

export const changePeriodStatus = (periodId, targetStatus, payload = {}, actor = getCurrentActor()) => {
  assertGhgCapability('period.manage', actor);
  const data = ensureGhgInventory();
  const period = findPeriod(data, periodId);
  assertGhgJurisdiction(actor, period.jurisdictionId);
  assertTransition(PERIOD_TRANSITIONS, period.status, targetStatus, 'Reporting period');
  const reason = validateReason(payload.reason, {
    required: [PERIOD_STATUS.APPROVED, PERIOD_STATUS.LOCKED, PERIOD_STATUS.ARCHIVED].includes(
      targetStatus
    ),
    fieldLabel: 'period decision reason',
  });
  const now = nowIso();
  const { result } = runGhgTransaction(
    (draft) => {
      const target = findPeriod(draft, periodId);
      target.status = targetStatus;
      target.updatedAt = now;
      if (targetStatus === PERIOD_STATUS.APPROVED || targetStatus === PERIOD_STATUS.LOCKED) {
        target.publishedAt = target.publishedAt || now;
      }
      if (targetStatus === PERIOD_STATUS.ARCHIVED) target.archivedAt = now;
      const event = audit(draft, {
        action: `period.${targetStatus}`,
        entityType: 'reporting_period',
        entityId: periodId,
        actor,
        reason,
        details: { fromStatus: period.status, toStatus: targetStatus },
        now,
      });
      return { event };
    },
    { now }
  );
  return { period: { ...clone(period), status: targetStatus }, auditEventId: result.event.id };
};

/**
 * Deterministic estimation for missing sources. Only prior approved periods are used; accepted
 * recommendations become labelled estimated records and never overwrite measured data.
 */
export const generateRecommendations = ({ periodId, lookbackPeriods = 3 } = {}, actor = getCurrentActor()) => {
  assertGhgCapability('calculation.run', actor);
  const data = ensureGhgInventory();
  const period = findPeriod(data, periodId);
  assertGhgJurisdiction(actor, period.jurisdictionId);
  const now = nowIso();

  const periods = data.reportingPeriods
    .filter(
      (item) =>
        item.jurisdictionId === period.jurisdictionId &&
        new Date(item.endDate) < new Date(period.startDate) &&
        PUBLIC_PERIOD_STATUSES.includes(item.status)
    )
    .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))
    .slice(0, lookbackPeriods);

  const sources = data.emissionSources.filter(
    (source) =>
      source.jurisdictionId === period.jurisdictionId && source.status === SOURCE_STATUS.ACTIVE
  );

  const created = [];
  const skipped = [];
  for (const source of sources) {
    const currentRecords = data.activityRecords.filter(
      (record) =>
        record.periodId === period.id &&
        record.sourceId === source.id &&
        ![ACTIVITY_STATUS.REJECTED, ACTIVITY_STATUS.DRAFT].includes(record.status)
    );
    if (currentRecords.length > 0) {
      skipped.push({ sourceId: source.id, reason: 'measured_or_submitted_data_present' });
      continue;
    }
    const alreadyPending = data.recommendations.find(
      (recommendation) =>
        recommendation.periodId === period.id &&
        recommendation.sourceId === source.id &&
        [RECOMMENDATION_STATUS.PENDING, RECOMMENDATION_STATUS.EDITED].includes(recommendation.status)
    );
    if (alreadyPending) {
      skipped.push({ sourceId: source.id, reason: 'recommendation_already_pending' });
      continue;
    }

    const history = [];
    for (const historyPeriod of periods) {
      const records = approvedRecordsForPeriod(data, historyPeriod.id).filter(
        (record) => record.sourceId === source.id
      );
      if (!records.length) continue;
      const factorId = records[0].factorId || source.defaultFactorId;
      const version = resolveFactorVersion(
        data.factorVersions,
        factorId,
        historyPeriod.endDate,
        records[0].factorVersionId
      );
      const totalQuantity = records.reduce((sum, record) => {
        const emission = calculateEmission({
          quantity: record.quantity,
          unit: record.unit,
          factorValue: version.factorValue,
          factorUnit: version.activityUnit,
          dataQuality: record.dataQuality,
        });
        return sum + emission.factorQuantity;
      }, 0);
      history.push({
        periodId: historyPeriod.id,
        periodLabel: historyPeriod.label,
        quantity: roundTo(totalQuantity, 6),
      });
    }

    if (!history.length) {
      skipped.push({ sourceId: source.id, reason: 'no_historical_activity' });
      continue;
    }

    try {
      const version = resolveFactorVersion(
        data.factorVersions,
        source.defaultFactorId,
        period.endDate
      );
      const recommendation = buildMissingDataRecommendation({
        source,
        period,
        history,
        factorVersion: version,
        lookbackPeriods,
        executionTimestamp: now,
        createdBy: actor?.username || actor?.id || 'inventory.rules',
      });
      recommendation.id = generateId('REC');
      created.push(recommendation);
    } catch (error) {
      skipped.push({ sourceId: source.id, reason: error.message });
    }
  }

  if (!created.length) {
    return {
      created: [],
      skipped,
      message:
        'No new estimates were generated. Every active source already has activity data, a pending recommendation or no historical basis for an estimate.',
    };
  }

  const { result } = runGhgTransaction(
    (draft) => {
      draft.recommendations.unshift(...created);
      const event = audit(draft, {
        action: 'recommendations.generated',
        entityType: 'inventory',
        entityId: period.id,
        actor,
        reason: 'Deterministic missing-data estimates generated for human review.',
        details: {
          periodId: period.id,
          created: created.map((item) => item.id),
          rulesetVersion: created[0].rulesetVersion,
          featureWindow: created[0].featureWindow,
        },
        now,
      });
      return { event };
    },
    { now }
  );

  return {
    created: created.map((item) => ({
      ...item,
      sourceName: sources.find((source) => source.id === item.sourceId)?.name || item.sourceId,
      categoryLabel: EMISSION_CATEGORY_LABELS[item.category] || item.category,
    })),
    skipped,
    auditEventId: result.event.id,
  };
};

export const decideRecommendation = (
  recommendationId,
  action,
  payload = {},
  actor = getCurrentActor(),
  { storage = null } = {}
) => {
  assertGhgCapability('recommendation.review', actor);
  const data = loadGhgInventory({ storage });
  const recommendation = data.recommendations.find((item) => item.id === recommendationId);
  if (!recommendation) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.NOT_FOUND,
      'That recommendation no longer exists. Refresh the list.'
    );
  }
  assertGhgJurisdiction(actor, recommendation.jurisdictionId);

  const targetStatus =
    action === 'accept'
      ? RECOMMENDATION_STATUS.ACCEPTED
      : action === 'edit'
        ? RECOMMENDATION_STATUS.EDITED
        : action === 'reject'
          ? RECOMMENDATION_STATUS.REJECTED
          : null;
  if (!targetStatus) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Recommendation decision must be accept, edit or reject.'
    );
  }
  assertTransition(RECOMMENDATION_TRANSITIONS, recommendation.status, targetStatus, 'Recommendation');
  const reason = validateReason(payload.reason, {
    required: true,
    fieldLabel: 'recommendation decision reason',
  });

  const now = nowIso();
  const { result } = runGhgTransaction(
    (draft) => {
      const target = draft.recommendations.find((item) => item.id === recommendationId);
      const previousStatus = target.status;
      let estimatedQuantity = target.estimatedQuantity;
      if (action === 'edit') {
        const quantity = Number(payload.estimatedQuantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new GhgInventoryError(
            GHG_ERROR_CODES.VALIDATION_ERROR,
            'Edited estimate must be a positive activity quantity.'
          );
        }
        estimatedQuantity = roundTo(quantity, 6);
      }
      const version = resolveFactorVersion(
        draft.factorVersions,
        draft.emissionSources.find((item) => item.id === target.sourceId)?.defaultFactorId,
        findPeriod(draft, target.periodId).endDate,
        target.factorVersionId
      );
      const estimateTCO2e = roundTo(estimatedQuantity * version.factorValue);
      target.estimatedQuantity = estimatedQuantity;
      target.estimateTCO2e = estimateTCO2e;
      target.status = targetStatus;
      target.updatedAt = now;
      target.decision = {
        action,
        reason,
        actorRole: resolveGhgRole(actor),
        decidedAt: now,
        previousStatus,
        editedFrom:
          action === 'edit' ? { estimatedQuantity: recommendation.estimatedQuantity } : null,
      };

      if (action === 'accept') {
        const existingRecord = draft.activityRecords.find(
          (record) =>
            record.periodId === target.periodId &&
            record.sourceId === target.sourceId &&
            ![ACTIVITY_STATUS.REJECTED].includes(record.status)
        );
        if (existingRecord) {
          throw new GhgInventoryError(
            GHG_ERROR_CODES.MEASURED_DATA_PROTECTED,
            'Measured or submitted activity already exists for this source. Estimated data cannot replace it. Reject this recommendation instead.'
          );
        }
        const source = findSource(draft, target.sourceId);
        const period = findPeriod(draft, target.periodId);
        const submission = {
          id: generateId('SUB'),
          periodId: target.periodId,
          jurisdictionId: target.jurisdictionId,
          department: source.department,
          title: `Estimated total accepted for ${source.name} — ${period.label}`,
          status: SUBMISSION_STATUS.APPROVED,
          submittedBy: 'inventory.rules',
          submittedAt: now,
          reviewedBy: actor?.username || actor?.id || 'reviewer',
          reviewedAt: now,
          reviewNotes: `Accepted recommendation ${target.id}: ${reason}`,
          correctionNotes:
            'Generated estimate accepted by a human reviewer. Labelled estimated; not measured data.',
          idempotencyKey: `recommendation-${target.id}`,
          activityRecordIds: [],
          createdBy: actor?.username || actor?.id || 'reviewer',
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        };
        const record = {
          id: generateId('ACT'),
          submissionId: submission.id,
          periodId: target.periodId,
          jurisdictionId: target.jurisdictionId,
          sourceId: source.id,
          category: source.category,
          quantity: estimatedQuantity,
          unit: version.activityUnit,
          dataQuality: DATA_QUALITY.ESTIMATED,
          factorId: source.defaultFactorId,
          factorVersionId: version.id,
          factorAsOf: null,
          status: ACTIVITY_STATUS.VALIDATED,
          correctionNotes: `Estimated from recommendation ${target.id}. ${reason}`,
          sourceDocument: null,
          createdBy: actor?.username || actor?.id || 'reviewer',
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        };
        submission.activityRecordIds = [record.id];
        draft.departmentSubmissions.unshift(submission);
        draft.activityRecords.unshift(record);
      }

      const event = audit(draft, {
        action: `recommendation.${action}`,
        entityType: 'recommendation',
        entityId: target.id,
        actor,
        reason,
        details: {
          periodId: target.periodId,
          sourceId: target.sourceId,
          rulesetVersion: target.rulesetVersion,
          featureWindow: target.featureWindow,
          estimateTCO2e: target.estimateTCO2e,
          previousStatus,
          toStatus: targetStatus,
        },
        now,
      });
      return { target: { ...target }, event };
    },
    { now }
  );

  return {
    recommendation: clone(result.target),
    auditEventId: result.event.id,
    message:
      action === 'accept'
        ? 'Estimate accepted and added as a labelled estimated record. Measured data was not replaced.'
        : action === 'edit'
          ? 'Estimate updated. It still needs acceptance before it enters the totals.'
          : 'Estimate rejected. No activity record was created.',
  };
};

export const exportInventory = (periodId, actor = getCurrentActor()) => {
  assertGhgCapability('export.approved', actor);
  const data = ensureGhgInventory();
  const period = findPeriod(data, periodId);
  assertGhgJurisdiction(actor, period.jurisdictionId);
  if (!PUBLIC_PERIOD_STATUSES.includes(period.status)) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.INVALID_STATE_TRANSITION,
      'Only approved, locked or archived periods can be exported. Approve the period after reviewing the calculated totals.'
    );
  }
  const records = approvedRecordsForPeriod(data, period.id);
  if (!records.length) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'This period has no approved activity records to export.'
    );
  }
  const totals = computeLiveTotals(data, period, records);
  const jurisdiction = GHG_JURISDICTIONS.find((item) => item.id === period.jurisdictionId);
  const submissionById = new Map(
    data.departmentSubmissions.map((submission) => [submission.id, submission])
  );
  return buildInventoryExport({
    period,
    jurisdiction,
    sources: data.emissionSources,
    records,
    factors: data.emissionFactors,
    versions: data.factorVersions,
    submissionById,
    calculationRun: {
      id: latestRun(data, period.id)?.id || null,
      executedAt: latestRun(data, period.id)?.executedAt || null,
      methodologyVersion: totals.methodologyVersion,
      totals: totals.totals,
      byCategory: totals.byCategory,
      warnings: totals.warnings.map((warning) => warning.message),
      factorVersionIds: totals.factorVersionIds,
      outputHash: latestRun(data, period.id)?.outputHash || null,
      rulesetVersion: null,
    },
    generatedAt: nowIso(),
    generatedByRole: resolveGhgRole(actor),
  });
};

export const exportInventoryCsv = (exportPayload) => {
  if (!exportPayload || !Array.isArray(exportPayload.lines)) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Import or build an inventory export before requesting CSV.'
    );
  }
  const header = [
    'record_id',
    'source',
    'department',
    'category',
    'quantity',
    'unit',
    'data_quality',
    'factor_version',
    'factor_value',
    'tCO2e',
  ];
  const escape = (value) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = exportPayload.lines.map((line) => {
    const record = line.activity || {};
    return [
      line.recordId,
      line.source?.name,
      line.source?.department,
      line.source?.category,
      record.quantity,
      record.unit,
      record.dataQuality,
      line.factor?.versionNumber,
      line.factor?.factorValue,
      line.emission?.tCO2e ?? '',
    ];
  });
  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
};

export const getAuditTrail = (actor = getCurrentActor()) => {
  assertGhgCapability('audit.read', actor);
  return ensureGhgInventory().auditEvents.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

export const runRetentionPolicy = (options = {}, actor = getCurrentActor()) => {
  assertGhgCapability('migration.run', actor);
  const { result } = applyGhgRetentionPolicy(options);
  return { ...result.data.meta, counts: result.result };
};

export const runMigrationRollback = (actor = getCurrentActor()) => {
  assertGhgCapability('migration.run', actor);
  const data = rollbackGhgStorage();
  return { schemaVersion: data.schemaVersion, restored: true, meta: data.meta };
};

export const resetInventoryToEmpty = (actor = getCurrentActor()) => {
  assertGhgCapability('migration.run', actor);
  const data = resetGhgStorageToEmpty();
  return { schemaVersion: data.schemaVersion, empty: true, meta: data.meta };
};

export const GHG_ERROR_HELP = Object.freeze({
  [GHG_ERROR_CODES.VALIDATION_ERROR]: 'Check the highlighted values. The message explains what to correct.',
  [GHG_ERROR_CODES.PERMISSION_DENIED]: 'Your role does not allow this action. Ask a municipal administrator.',
  [GHG_ERROR_CODES.UNAUTHENTICATED]: 'Sign in with a municipal staff account to continue.',
  [GHG_ERROR_CODES.JURISDICTION_DENIED]: 'This record belongs to a different jurisdiction. Switch account or ask for access.',
  [GHG_ERROR_CODES.INVALID_STATE_TRANSITION]: 'Refresh the record. Its state changed, so this action is no longer allowed.',
  [GHG_ERROR_CODES.UNIT_MISMATCH]: 'The activity unit does not match the emission factor. Submit the value in the original unit.',
  [GHG_ERROR_CODES.FACTOR_UNAVAILABLE]: 'A published emission factor is needed. Ask a reviewer to publish one.',
  [GHG_ERROR_CODES.IDEMPOTENCY_CONFLICT]: 'This action was already recorded or conflicts with existing data. Refresh to see the current record.',
  [GHG_ERROR_CODES.MEASURED_DATA_PROTECTED]: 'Measured data cannot be replaced by an estimate. Reject the estimate instead.',
  [GHG_ERROR_CODES.STALE_CALCULATION]: 'Run the calculation again; approved data changed after the last run.',
  [GHG_ERROR_CODES.NOT_FOUND]: 'The record could not be found. Refresh the list.',
  [GHG_ERROR_CODES.UNSUPPORTED_FILE]: 'Use a PDF, CSV or XLSX source document within the size limit.',
  [GHG_ERROR_CODES.RATE_LIMITED]: 'Too many submissions. Wait a few minutes and try again.',
});

export const toUserMessage = (error) => {
  if (!error) return 'Something went wrong. Try again.';
  const help = GHG_ERROR_HELP[error.code];
  return help ? `${error.message} ${help}` : error.message || 'Something went wrong. Try again.';
};

export const getInventoryMetadata = () => ({
  schemaVersion: 1,
  methodologyVersion: GHG_METHODOLOGY_VERSION,
  exportSchemaVersion: INVENTORY_EXPORT_SCHEMA_VERSION,
  roundingDecimals: 4,
  categories: EMISSION_CATEGORIES,
  jurisdictions: clone(GHG_JURISDICTIONS),
  actorJurisdictions: resolveActorJurisdictions(getCurrentActor()),
});
