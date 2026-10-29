import { requirePermission } from './accessControl';
/**
 * Civic Source Conflict and Confidence Review Queue Service (#149)
 *
 * Manages official source discrepancies, multi-source citations per key claim,
 * and auditable human reviewer verification workflows.
 *
 * Strict Compliance:
 * - Records multiple source citations per claim (URLs, publication dates, quotes).
 * - Triggers visible caution notice on service page for any unresolved conflict.
 * - Enforces human review: system NEVER auto-adjudicates conflicts based on scraped text.
 * - Changes to verification state are strictly auditable with an immutable log.
 */
import { logDiagnostic } from '../utils/diagnostics';

export const SOURCE_CONFLICTS_STORAGE_KEY = 'civicbridge_source_conflicts';
export const CONFLICT_AUDIT_LOGS_KEY = 'civicbridge_conflict_audit_logs';

export const CLAIM_FIELDS = {
  FEES: 'fees',
  PROCESSING_TIME: 'processing_time',
  ELIGIBILITY_CRITERIA: 'eligibility_criteria',
  MANDATORY_DOCUMENTS: 'mandatory_documents',
  DEADLINE_OR_RENEWAL: 'deadline_or_renewal',
  OFFICE_HOURS: 'office_hours',
};

export const CLAIM_FIELD_LABELS = {
  [CLAIM_FIELDS.FEES]: 'Statutory Application Fee Amount',
  [CLAIM_FIELDS.PROCESSING_TIME]: 'Official Processing SLA Timeline',
  [CLAIM_FIELDS.ELIGIBILITY_CRITERIA]: 'Statutory Eligibility / Age Rules',
  [CLAIM_FIELDS.MANDATORY_DOCUMENTS]: 'Mandatory Document List',
  [CLAIM_FIELDS.DEADLINE_OR_RENEWAL]: 'Application Deadline / Renewal Cutoff',
  [CLAIM_FIELDS.OFFICE_HOURS]: 'Office Counter Working Timings',
};

export const CONFLICT_STATUS = {
  UNRESOLVED: 'unresolved',
  RESOLVED: 'resolved',
};

const getStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/**
 * Read all stored source conflicts safely
 */
export const getAllSourceConflicts = (storage = getStorage()) => {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SOURCE_CONFLICTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Save conflicts array to storage
 */
const saveAllSourceConflicts = (conflicts, storage = getStorage()) => {
  if (!storage) return false;
  try {
    storage.setItem(SOURCE_CONFLICTS_STORAGE_KEY, JSON.stringify(conflicts));
    return true;
  } catch {
    return false;
  }
};

/**
 * Read audit log entries
 */
export const getConflictAuditLogs = (storage = getStorage()) => {
  if (!storage) return [];
  try {
    const raw = storage.getItem(CONFLICT_AUDIT_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Append an immutable entry to the conflict audit log
 */
const appendAuditLog = (entry, storage = getStorage()) => {
  if (!storage) return;
  try {
    const logs = getConflictAuditLogs(storage);
    logs.unshift({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
    storage.setItem(CONFLICT_AUDIT_LOGS_KEY, JSON.stringify(logs));
  } catch (err) {
    logDiagnostic('Failed to append conflict audit log', err);
  }
};

/**
 * Returns all unresolved conflicts for a specific service ID
 */
export const getUnresolvedConflictsForService = (serviceId, storage = getStorage()) => {
  if (!serviceId) return [];
  const all = getAllSourceConflicts(storage);
  return all.filter(
    (c) => c.serviceId === serviceId && c.status === CONFLICT_STATUS.UNRESOLVED
  );
};

/**
 * Records a new conflicting claim between two or more official sources.
 */
export const recordSourceConflict = (
  {
    serviceId,
    serviceName,
    claimField,
    description = '',
    sources = [],
    actor = 'System Reviewer',
  },
  storage = getStorage()
) => {
  if (!serviceId || typeof serviceId !== 'string' || !serviceId.trim()) {
    throw new Error('Service ID is required to record a source conflict.');
  }

  const validFields = Object.values(CLAIM_FIELDS);
  if (!claimField || !validFields.includes(claimField)) {
    throw new Error('Please select a valid claim field.');
  }

  if (!Array.isArray(sources) || sources.length < 2) {
    throw new Error('A conflict requires at least two conflicting source references to compare.');
  }

  // Validate each source entry
  const sanitizedSources = sources.map((s, idx) => {
    if (!s.sourceName || !s.claimedValue) {
      throw new Error(`Source #${idx + 1} must include a source name and claimed value.`);
    }
    return {
      id: s.id || `src_${idx + 1}`,
      sourceName: s.sourceName.trim(),
      sourceUrl: s.sourceUrl ? s.sourceUrl.trim() : '',
      publicationDate: s.publicationDate || null,
      claimedValue: s.claimedValue.trim(),
      confidenceTier: s.confidenceTier || 'medium', // 'high' (Gazette) | 'medium' (Department Portal) | 'low' (Press FAQ)
      isScraped: Boolean(s.isScraped),
    };
  });

  const conflicts = getAllSourceConflicts(storage);

  const conflictRecord = {
    id: `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    serviceId: serviceId.trim(),
    serviceName: serviceName || serviceId.trim(),
    claimField,
    description: description.trim(),
    sources: sanitizedSources,
    status: CONFLICT_STATUS.UNRESOLVED,
    requiresManualReview: true, // Strict human review policy
    resolvedValue: null,
    resolutionNotes: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
    createdBy: actor,
  };

  conflicts.unshift(conflictRecord);
  saveAllSourceConflicts(conflicts, storage);

  appendAuditLog(
    {
      action: 'CONFLICT_RECORDED',
      conflictId: conflictRecord.id,
      serviceId: conflictRecord.serviceId,
      claimField,
      sourceCount: sanitizedSources.length,
      actor,
      notes: `Recorded conflict across ${sanitizedSources.length} sources for "${CLAIM_FIELD_LABELS[claimField]}".`,
    },
    storage
  );

  return conflictRecord;
};

/**
 * Resolves a conflict after human reviewer comparison.
 * The system enforces manual human resolution; automated AI scraping resolution is blocked.
 */
export const resolveSourceConflict = (
  {
    conflictId,
    chosenValue,
    resolutionNotes,
    reviewerName = 'Administrator',
    reviewerRole = 'admin',
    isAutomatedScraper = false,
  },
  storage = getStorage()
) => {
  requirePermission('sourceConflicts.review');
  // CRITICAL ACCEPTANCE CRITERIA:
  // "The system does not automatically choose a source solely based on scraped text."
  if (isAutomatedScraper) {
    const err = new Error(
      'Policy Violation: Automated resolution based solely on scraped text is strictly prohibited. Conflicts require deliberate human reviewer adjudication.'
    );
    err.code = 'AUTO_RESOLUTION_PROHIBITED';
    throw err;
  }

  if (!conflictId) {
    throw new Error('Conflict ID is required to resolve.');
  }

  if (!chosenValue || typeof chosenValue !== 'string' || !chosenValue.trim()) {
    throw new Error('You must provide the verified, adjudicated claim value.');
  }

  if (!resolutionNotes || typeof resolutionNotes !== 'string' || resolutionNotes.trim().length < 5) {
    throw new Error('Reviewer resolution notes explaining the decision rationale are mandatory.');
  }

  const conflicts = getAllSourceConflicts(storage);
  const index = conflicts.findIndex((c) => c.id === conflictId);
  if (index === -1) {
    throw new Error(`Source conflict with ID "${conflictId}" was not found.`);
  }

  const target = conflicts[index];
  const resolvedAt = new Date().toISOString();

  conflicts[index] = {
    ...target,
    status: CONFLICT_STATUS.RESOLVED,
    resolvedValue: chosenValue.trim(),
    resolutionNotes: resolutionNotes.trim(),
    resolvedBy: `${reviewerName} (${reviewerRole})`,
    resolvedAt,
  };

  saveAllSourceConflicts(conflicts, storage);

  appendAuditLog(
    {
      action: 'CONFLICT_RESOLVED',
      conflictId: target.id,
      serviceId: target.serviceId,
      claimField: target.claimField,
      previousStatus: target.status,
      newStatus: CONFLICT_STATUS.RESOLVED,
      chosenValue: chosenValue.trim(),
      resolutionNotes: resolutionNotes.trim(),
      actor: reviewerName,
    },
    storage
  );

  return conflicts[index];
};

/**
 * Re-opens a conflict if new contradictory official evidence emerges.
 */
export const reopenSourceConflict = (
  { conflictId, reopenReason, actor = 'Administrator' },
  storage = getStorage()
) => {
  requirePermission('sourceConflicts.review');
  if (!conflictId || !reopenReason) {
    throw new Error('Conflict ID and reason are required to re-open a conflict.');
  }

  const conflicts = getAllSourceConflicts(storage);
  const index = conflicts.findIndex((c) => c.id === conflictId);
  if (index === -1) throw new Error('Conflict not found.');

  const target = conflicts[index];
  conflicts[index] = {
    ...target,
    status: CONFLICT_STATUS.UNRESOLVED,
    requiresManualReview: true,
  };

  saveAllSourceConflicts(conflicts, storage);

  appendAuditLog(
    {
      action: 'CONFLICT_REOPENED',
      conflictId: target.id,
      serviceId: target.serviceId,
      actor,
      notes: reopenReason.trim(),
    },
    storage
  );

  return conflicts[index];
};
