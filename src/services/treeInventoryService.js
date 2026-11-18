/**
 * Trusted service boundary for the Municipal Tree Health Inventory and
 * Preventive Maintenance Planner (#749).
 *
 * All business rules live here, not in React components:
 *  - role and jurisdiction checks for every protected read/write,
 *  - schema validation before a record is stored,
 *  - explicit state machines for trees, inspections, work orders and reports,
 *  - multi-record writes with rollback,
 *  - idempotency for retry-safe actions,
 *  - append-only, hash-chained audit events,
 *  - public projections that contain no internal ids, private notes or precise
 *    coordinates.
 */

import { TREE_JURISDICTIONS } from '../data/treeInventoryData';
import { getCurrentActor } from './accessControl';
import {
  assertTreeCapability,
  assertTreeJurisdiction,
  actorIdentity,
  resolveTreeRole,
  getScopedJurisdictions,
  canTree,
  isTreeStaff,
  listTreeCapabilities,
} from './treeAccessControl';
import {
  AUDIT_ACTIONS,
  CITIZEN_REPORT_CATEGORIES,
  CITIZEN_REPORT_CATEGORY_LABELS,
  CITIZEN_REPORT_STATES,
  CITIZEN_REPORT_STATE_LABELS,
  INSPECTION_STATES,
  INSPECTION_STATE_LABELS,
  INSPECTION_TYPES,
  INSPECTION_TYPE_LABELS,
  PLANTING_SITE_STATES,
  PLANTING_SITE_STATE_LABELS,
  RISK_DESIGNATION_STATES,
  RISK_LEVELS,
  RISK_LEVEL_LABELS,
  TREE_API_LIMITS,
  TREE_CONDITIONS,
  TREE_CONDITION_LABELS,
  TREE_ERROR_CODES,
  TREE_INVENTORY_SCHEMA_VERSION,
  TREE_ROLES,
  TREE_ROLE_LABELS,
  TREE_STATUS,
  TREE_STATUS_LABELS,
  TREE_STORAGE_KEYS,
  TRIAGE_DECISIONS,
  TRIAGE_DECISION_LABELS,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATES,
  WORK_ORDER_STATE_LABELS,
  WORK_ORDER_TYPES,
  WORK_ORDER_TYPE_LABELS,
  allowedNextStates,
  canTransition,
  isKnownValue,
} from './treeInventoryConstants';
import {
  analyzeTreeImage,
  reviewTriageSuggestion,
  toSafeTriageAudit,
  TREE_SYMPTOM_LABELS,
} from './treeImageTriageService';
import {
  buildTreeInventoryIndexes,
  ensureTreeInventoryData,
  getTreeInventoryMigrationStatus,
  migrateTreeInventory,
  rollbackTreeInventoryMigration,
} from './treeInventoryMigrations';
import {
  TreeServiceError,
  changeSummary,
  cloneJson,
  createTreeError,
  getTreeStorage,
  gridBucketFor,
  haversineMeters,
  hashString,
  newTreeId,
  normalizeSearch,
  nowIso,
  optionalIsoDate,
  optionalString,
  paginate,
  requireEnum,
  requireIsoDate,
  requireString,
  runTreeTransaction,
  safeReadJson,
  sanitizePlain,
  sanitizePublicNarrative,
  validateApproxCoordinates,
  validateAttachments,
  validatePreciseCoordinates,
} from './treeInventoryValidation';

export {
  TREE_CONDITIONS,
  TREE_CONDITION_LABELS,
  TREE_STATUS,
  TREE_STATUS_LABELS,
  TREE_STORAGE_KEYS,
  TREE_ERROR_CODES,
  TREE_ROLES,
  TREE_ROLE_LABELS,
  TREE_API_LIMITS,
  INSPECTION_STATES,
  INSPECTION_STATE_LABELS,
  INSPECTION_TYPES,
  INSPECTION_TYPE_LABELS,
  WORK_ORDER_STATES,
  WORK_ORDER_STATE_LABELS,
  WORK_ORDER_TYPES,
  WORK_ORDER_TYPE_LABELS,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_PRIORITY_LABELS,
  CITIZEN_REPORT_STATES,
  CITIZEN_REPORT_STATE_LABELS,
  CITIZEN_REPORT_CATEGORIES,
  CITIZEN_REPORT_CATEGORY_LABELS,
  RISK_LEVELS,
  RISK_LEVEL_LABELS,
  PLANTING_SITE_STATES,
  PLANTING_SITE_STATE_LABELS,
  TRIAGE_DECISIONS,
  TRIAGE_DECISION_LABELS,
  TREE_SYMPTOM_LABELS,
  TreeServiceError,
  getTreeInventoryMigrationStatus,
  migrateTreeInventory,
  rollbackTreeInventoryMigration,
  buildTreeInventoryIndexes,
  ensureTreeInventoryData,
  resolveTreeRole,
  getScopedJurisdictions,
  canTree,
  isTreeStaff,
  listTreeCapabilities,
};

const readCollection = (storage, key) => {
  const value = safeReadJson(storage, key, []);
  return Array.isArray(value) ? value : [];
};

const findById = (items, id) => items.find((item) => item.id === id) || null;
const findByPublicId = (items, publicId) => items.find((item) => item.publicId === publicId) || null;

const getJurisdiction = (jurisdictionId) =>
  TREE_JURISDICTIONS.find((jurisdiction) => jurisdiction.id === jurisdictionId) || null;

const requireJurisdiction = (jurisdictionId) => {
  const jurisdiction = getJurisdiction(jurisdictionId);
  if (!jurisdiction) {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, `Unknown jurisdiction: ${jurisdictionId}.`, {
      fieldErrors: { jurisdictionId: 'Choose a supported municipal jurisdiction.' },
    });
  }
  return jurisdiction;
};

const currentIdentity = () => {
  const identity = actorIdentity(getCurrentActor());
  if (!identity) throw createTreeError(TREE_ERROR_CODES.UNAUTHENTICATED);
  return identity;
};

/** Scope an array to the actor's assigned jurisdictions. null means all. */
const scopeRecords = (records, scopedJurisdictions) => {
  if (scopedJurisdictions === null) return records;
  const allowed = new Set(scopedJurisdictions);
  return records.filter((record) => allowed.has(record.jurisdictionId));
};

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
};

const payloadHash = (payload) => hashString(stableStringify(payload));

const normalizeIdempotencyKey = (key) => {
  if (key === undefined || key === null || key === '') return null;
  const text = String(key).trim();
  if (text.length < 6 || text.length > 160) {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Idempotency key must be between 6 and 160 characters.');
  }
  return text;
};

const idempotencySlot = (actor, key) => (key ? `${actor.id}:${key}` : null);

const checkIdempotency = (storage, actor, key, scope, payload) => {
  if (!key) return null;
  const store = safeReadJson(storage, TREE_STORAGE_KEYS.idempotency, {});
  const slot = idempotencySlot(actor, key);
  const existing = store[slot];
  if (!existing) return null;
  const hash = payloadHash({ scope, payload });
  if (existing.payloadHash !== hash) {
    throw createTreeError(TREE_ERROR_CODES.IDEMPOTENCY_CONFLICT);
  }
  return { ...cloneJson(existing.result), replayed: true };
};

const saveIdempotency = (draft, actor, key, scope, payload, result) => {
  if (!key) return;
  const slot = idempotencySlot(actor, key);
  const storeKey = TREE_STORAGE_KEYS.idempotency;
  const current = draft.get(storeKey);
  // A missing key is initialised as [] by runTreeTransaction. Treat an array
  // as "empty object" so the idempotency record is actually serialised.
  const store = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  store[slot] = {
    payloadHash: payloadHash({ scope, payload }),
    scope,
    result: cloneJson(result),
    createdAt: nowIso(),
  };
  draft.set(storeKey, store);
};

const appendAuditEvent = (draft, event) => {
  const key = TREE_STORAGE_KEYS.audit;
  const events = Array.isArray(draft.get(key)) ? draft.get(key) : [];
  const previousHash = events.length > 0 ? events[events.length - 1].hash : 'GENESIS';
  const base = {
    id: newTreeId('audit'),
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    actorId: event.actor?.id || 'system',
    actorLabel: event.actor?.label || 'System',
    actorRole: event.actor?.role || TREE_ROLES.CITIZEN,
    jurisdictionId: event.jurisdictionId || null,
    reason: sanitizePlain(event.reason || '', { max: TREE_API_LIMITS.maxReasonLength, multiline: false }),
    changes: event.changes || null,
    details: event.details || null,
    createdAt: event.createdAt || nowIso(),
    previousHash,
  };
  const auditEvent = { ...base, hash: hashString(stableStringify(base)) };
  events.push(auditEvent);
  draft.set(key, events);
  return auditEvent;
};

export const verifyTreeAuditChain = (events = []) => {
  let previousHash = 'GENESIS';
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const { hash, ...base } = event || {};
    if (!event || event.previousHash !== previousHash || hashString(stableStringify(base)) !== hash) {
      return { valid: false, brokenAt: index, checked: index + 1, total: events.length };
    }
    previousHash = hash;
  }
  return { valid: true, brokenAt: null, checked: events.length, total: events.length };
};

const sequenceId = (items, prefix, width = 4) => {
  let next = items.length + 1;
  const existing = new Set(items.map((item) => item.publicId));
  let candidate = `${prefix}-${String(next).padStart(width, '0')}`;
  while (existing.has(candidate)) {
    next += 1;
    candidate = `${prefix}-${String(next).padStart(width, '0')}`;
  }
  return candidate;
};

const treePublicCode = (trees, jurisdictionId) => {
  const prefix = jurisdictionId.toUpperCase();
  return sequenceId(trees.filter((tree) => tree.jurisdictionId === jurisdictionId), `${prefix}-TREE`);
};

const inspectionPublicCode = (inspections, jurisdictionId) =>
  sequenceId(
    inspections.filter((item) => item.jurisdictionId === jurisdictionId),
    `${jurisdictionId.toUpperCase()}-INS`
  );

const orderPublicCode = (orders, jurisdictionId) =>
  sequenceId(
    orders.filter((item) => item.jurisdictionId === jurisdictionId),
    `${jurisdictionId.toUpperCase()}-WO`
  );

const trackingCode = (reports) => {
  let candidate = `TREE-REP-${hashString(`${Date.now()}|${reports.length}|${Math.random()}`).slice(0, 4).toUpperCase()}`;
  const existing = new Set(reports.map((report) => report.trackingCode));
  while (existing.has(candidate)) {
    candidate = `TREE-REP-${hashString(`${candidate}|${Math.random()}`).slice(0, 4).toUpperCase()}`;
  }
  return candidate;
};

const computeInspectionDueAt = (plantedOn, species, fromMs = Date.now(), intervalOverride = null) => {
  const interval = Number(intervalOverride || species?.inspectionIntervalDays || 180);
  const start = plantedOn ? Date.parse(plantedOn) : fromMs;
  if (!Number.isFinite(start)) return null;
  return new Date(start + interval * 24 * 60 * 60 * 1000).toISOString();
};

const inspectionTiming = (dueAt, nowMs = Date.now()) => {
  if (!dueAt) return { status: 'unscheduled', label: 'No inspection scheduled', daysUntilDue: null, isOverdue: false };
  const due = Date.parse(dueAt);
  if (!Number.isFinite(due)) return { status: 'unscheduled', label: 'No inspection scheduled', daysUntilDue: null, isOverdue: false };
  const days = Math.ceil((due - nowMs) / (24 * 60 * 60 * 1000));
  if (days < 0) {
    return { status: 'overdue', label: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`, daysUntilDue: days, isOverdue: true };
  }
  if (days <= TREE_API_LIMITS.inspectionReminderDays) {
    return { status: 'due_soon', label: `Due in ${days} day${days === 1 ? '' : 's'}`, daysUntilDue: days, isOverdue: false };
  }
  return { status: 'scheduled', label: `Due ${new Date(due).toLocaleDateString('en-IN')}`, daysUntilDue: days, isOverdue: false };
};

const speciesFor = (storage, speciesId) =>
  readCollection(storage, TREE_STORAGE_KEYS.species).find((species) => species.id === speciesId) || null;

const requirePlantingSite = (draft, plantingSiteId, jurisdictionId) => {
  if (!plantingSiteId) return null;
  const sites = draft.get(TREE_STORAGE_KEYS.plantingSites) || [];
  const site = sites.find((item) => item.id === plantingSiteId);
  if (!site) {
    throw createTreeError(TREE_ERROR_CODES.REFERENCE_NOT_FOUND, `Unknown planting site: ${plantingSiteId}.`, {
      fieldErrors: { plantingSiteId: 'Choose an existing planting site.' },
    });
  }
  if (site.jurisdictionId !== jurisdictionId) {
    throw createTreeError(TREE_ERROR_CODES.JURISDICTION_FORBIDDEN, 'Planting site belongs to another jurisdiction.');
  }
  if (site.state === PLANTING_SITE_STATES.RETIRED) {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'A retired planting site cannot receive a tree.', {
      fieldErrors: { plantingSiteId: 'Choose an available planting site.' },
    });
  }
  return site;
};

const requireTree = (draft, treeId, scopedJurisdictions) => {
  const tree = findById(draft.get(TREE_STORAGE_KEYS.trees) || [], treeId);
  if (!tree) throw createTreeError(TREE_ERROR_CODES.NOT_FOUND, 'Tree asset was not found.');
  if (scopedJurisdictions !== null && !scopedJurisdictions.includes(tree.jurisdictionId)) {
    throw createTreeError(TREE_ERROR_CODES.JURISDICTION_FORBIDDEN);
  }
  return tree;
};

const requireInspection = (draft, inspectionId, scopedJurisdictions) => {
  const inspection = findById(draft.get(TREE_STORAGE_KEYS.inspections) || [], inspectionId);
  if (!inspection) throw createTreeError(TREE_ERROR_CODES.NOT_FOUND, 'Inspection was not found.');
  if (scopedJurisdictions !== null && !scopedJurisdictions.includes(inspection.jurisdictionId)) {
    throw createTreeError(TREE_ERROR_CODES.JURISDICTION_FORBIDDEN);
  }
  return inspection;
};

const requireOrder = (draft, orderId, scopedJurisdictions) => {
  const order = findById(draft.get(TREE_STORAGE_KEYS.workOrders) || [], orderId);
  if (!order) throw createTreeError(TREE_ERROR_CODES.NOT_FOUND, 'Maintenance order was not found.');
  if (scopedJurisdictions !== null && !scopedJurisdictions.includes(order.jurisdictionId)) {
    throw createTreeError(TREE_ERROR_CODES.JURISDICTION_FORBIDDEN);
  }
  return order;
};

const requireReport = (draft, reportId, scopedJurisdictions) => {
  const report = findById(draft.get(TREE_STORAGE_KEYS.citizenReports) || [], reportId);
  if (!report) throw createTreeError(TREE_ERROR_CODES.NOT_FOUND, 'Citizen report was not found.');
  if (scopedJurisdictions !== null && !scopedJurisdictions.includes(report.jurisdictionId)) {
    throw createTreeError(TREE_ERROR_CODES.JURISDICTION_FORBIDDEN);
  }
  return report;
};

const assertTransition = (kind, from, to) => {
  if (!canTransition(kind, from, to)) {
    throw createTreeError(
      TREE_ERROR_CODES.INVALID_TRANSITION,
      `Cannot move ${kind} from ${from} to ${to}. Allowed: ${allowedNextStates(kind, from).join(', ') || 'none'}.`,
      { details: { from, to, allowed: allowedNextStates(kind, from) } }
    );
  }
};

const storeAttachments = (draft, { entityType, entityId, attachments, actor, jurisdictionId }) => {
  const validated = validateAttachments(attachments);
  if (validated.length === 0) return [];
  const collection = Array.isArray(draft.get(TREE_STORAGE_KEYS.reportAttachments))
    ? draft.get(TREE_STORAGE_KEYS.reportAttachments)
    : [];
  const stored = validated.map((attachment) => ({
    ...attachment,
    entityType,
    entityId,
    jurisdictionId,
    uploadedBy: actor.id,
    accessScope: 'staff_and_approved_public',
  }));
  draft.set(TREE_STORAGE_KEYS.reportAttachments, collection.concat(stored));
  return stored.map((attachment) => attachment.id);
};

const resolveAttachments = (draft, ids = []) => {
  const collection = draft.get(TREE_STORAGE_KEYS.reportAttachments) || [];
  return ids
    .map((id) => collection.find((attachment) => attachment.id === id))
    .filter(Boolean)
    .map((attachment) => ({
      id: attachment.id,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      url: attachment.url,
      caption: attachment.caption,
      exifStripped: Boolean(attachment.exifStripped),
    }));
};

const publicTreeView = (tree, species) => ({
  publicId: tree.publicId,
  ward: tree.ward,
  locality: tree.locality || '',
  species: species
    ? {
        commonName: species.commonName,
        scientificName: species.scientificName,
        nativeStatus: species.nativeStatus,
      }
    : null,
  condition: tree.condition,
  conditionLabel: TREE_CONDITION_LABELS[tree.condition] || tree.condition,
  status: tree.status,
  statusLabel: TREE_STATUS_LABELS[tree.status] || tree.status,
  plantedYear: tree.plantedOn ? new Date(tree.plantedOn).getUTCFullYear() : null,
  lastInspectedAt: tree.lastInspectionAt,
  inspectionTiming: inspectionTiming(tree.inspectionDueAt),
  risk:
    tree.risk?.state === RISK_DESIGNATION_STATES.CONFIRMED
      ? { level: tree.risk.level, label: RISK_LEVEL_LABELS[tree.risk.level] || tree.risk.level, confirmedAt: tree.risk.confirmedAt }
      : {
          level: RISK_LEVELS.NONE,
          label: tree.risk?.state === RISK_DESIGNATION_STATES.PROPOSED ? 'Expert review in progress' : RISK_LEVEL_LABELS.none,
          confirmedAt: null,
        },
  approxLocation: {
    grid: gridBucketFor(tree.approxCoordinates),
    precision: 'approximately 1 km grid',
  },
  source: 'Municipal tree register',
  updatedAt: tree.updatedAt,
});

const staffTreeView = (tree, species, storage, nowMs = Date.now()) => ({
  ...tree,
  species: species
    ? { id: species.id, commonName: species.commonName, scientificName: species.scientificName, inspectionIntervalDays: species.inspectionIntervalDays }
    : null,
  conditionLabel: TREE_CONDITION_LABELS[tree.condition] || tree.condition,
  statusLabel: TREE_STATUS_LABELS[tree.status] || tree.status,
  inspectionTiming: inspectionTiming(tree.inspectionDueAt, nowMs),
  riskLabel: RISK_LEVEL_LABELS[tree.risk?.level] || tree.risk?.level || RISK_LEVEL_LABELS.none,
  privateCoordinates: tree.privateCoordinates || null,
  privateNotes: tree.privateNotes || '',
  publicView: publicTreeView(tree, species),
  inspectionCount: readCollection(storage, TREE_STORAGE_KEYS.inspections).filter((item) => item.treeId === tree.id).length,
  openOrderCount: readCollection(storage, TREE_STORAGE_KEYS.workOrders)
    .filter((order) => order.treeId === tree.id && !['verified', 'cancelled'].includes(order.state)).length,
});

const publicReportView = (report) => ({
  trackingCode: report.trackingCode,
  category: report.category,
  categoryLabel: CITIZEN_REPORT_CATEGORY_LABELS[report.category] || report.category,
  description: report.description,
  state: report.state,
  stateLabel: CITIZEN_REPORT_STATE_LABELS[report.state] || report.state,
  publicId: report.publicId || null,
  ward: report.ward,
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
  reviewedAt: report.reviewedAt,
  resolutionMessage:
    report.state === CITIZEN_REPORT_STATES.REJECTED
      ? 'A municipal reviewer assessed this report but did not record visible tree damage that required action.'
      : report.state === CITIZEN_REPORT_STATES.DUPLICATE
        ? 'This observation was linked to an existing report for the same tree.'
        : report.state === CITIZEN_REPORT_STATES.ACCEPTED
          ? 'An inspection has been scheduled for this observation.'
          : 'The municipal team has received this report.',
  source: 'Citizen report — not a verified municipal observation',
});

const staffReportView = (report) => {
  const { reporterKey, ...safeReport } = report;
  void reporterKey; // Internal dedupe key is intentionally not returned to the UI.
  return {
    ...safeReport,
    stateLabel: CITIZEN_REPORT_STATE_LABELS[report.state] || report.state,
    categoryLabel: CITIZEN_REPORT_CATEGORY_LABELS[report.category] || report.category,
    publicView: publicReportView(report),
  };
};

const staffInspectionView = (inspection) => ({
  ...inspection,
  stateLabel: INSPECTION_STATE_LABELS[inspection.state] || inspection.state,
  typeLabel: INSPECTION_TYPE_LABELS[inspection.type] || inspection.type,
  conditionLabel: TREE_CONDITION_LABELS[inspection.conditionAtInspection] || inspection.conditionAtInspection,
});

const staffOrderView = (order) => ({
  ...order,
  stateLabel: WORK_ORDER_STATE_LABELS[order.state] || order.state,
  typeLabel: WORK_ORDER_TYPE_LABELS[order.type] || order.type,
  priorityLabel: WORK_ORDER_PRIORITY_LABELS[order.priority] || order.priority,
});

const freshness = (storage) => {
  const meta = safeReadJson(storage, TREE_STORAGE_KEYS.meta, {}) || {};
  const trees = readCollection(storage, TREE_STORAGE_KEYS.trees);
  const latest = trees.reduce((max, tree) => {
    const time = Date.parse(tree.updatedAt || tree.createdAt || '');
    return Number.isFinite(time) && time > max ? time : max;
  }, 0);
  const lastUpdatedAt = latest ? new Date(latest).toISOString() : meta.demoSeededAt || meta.migratedAt || null;
  const ageDays = lastUpdatedAt ? Math.floor((Date.now() - Date.parse(lastUpdatedAt)) / (24 * 60 * 60 * 1000)) : null;
  return {
    lastUpdatedAt,
    ageDays,
    isStale: ageDays === null ? true : ageDays > 30,
    staleAfterDays: 30,
    source: 'Municipal tree register (local device store)',
  };
};

export const listTreeSpecies = (storage = getTreeStorage()) => {
  ensureTreeInventoryData({ storage });
  return readCollection(storage, TREE_STORAGE_KEYS.species);
};

export const listPlantingSites = (filters = {}, storage = getTreeStorage()) => {
  assertTreeCapability('tree.staff.read');
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const sites = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.plantingSites), scoped);
  const ward = normalizeSearch(filters.ward || '');
  return sites
    .filter((site) => (filters.state ? site.state === filters.state : true))
    .filter((site) => (ward ? normalizeSearch(site.ward).includes(ward) : true))
    .map((site) => ({ ...site, stateLabel: PLANTING_SITE_STATE_LABELS[site.state] || site.state }));
};

export const getPlanningJurisdictions = () =>
  TREE_JURISDICTIONS.map((jurisdiction) => ({ id: jurisdiction.id, name: jurisdiction.name, state: jurisdiction.state, wards: [...jurisdiction.wards] }));

export const getPublicInventory = (filters = {}, storage = getTreeStorage()) => {
  assertTreeCapability('tree.public.read', null, { allowAnonymous: true });
  ensureTreeInventoryData({ storage });
  const speciesList = readCollection(storage, TREE_STORAGE_KEYS.species);
  const speciesById = Object.fromEntries(speciesList.map((species) => [species.id, species]));
  const search = normalizeSearch(filters.search || '');
  // The public register is open to residents. Only signed-in staff are
  // narrowed to their assigned jurisdiction; a citizen is never scoped to an
  // empty list by the staff-only jurisdiction resolver.
  const scoped = isTreeStaff() ? getScopedJurisdictions() : null;
  const trees = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.trees), scoped)
    .filter((tree) => tree.isPubliclyListed !== false)
    .filter((tree) => [TREE_STATUS.ACTIVE, TREE_STATUS.PENDING_REVIEW, TREE_STATUS.REMOVAL_APPROVED].includes(tree.status))
    .filter((tree) => (filters.jurisdictionId ? tree.jurisdictionId === filters.jurisdictionId : true))
    .filter((tree) => (filters.ward ? tree.ward === filters.ward : true))
    .filter((tree) => (filters.speciesId ? tree.speciesId === filters.speciesId : true))
    .filter((tree) => (filters.condition ? tree.condition === filters.condition : true));

  const searched = search
    ? trees.filter((tree) => {
        const species = speciesById[tree.speciesId];
        return [tree.publicId, tree.ward, tree.locality, species?.commonName, species?.scientificName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search);
      })
    : trees;

  const publicTrees = searched.map((tree) => publicTreeView(tree, speciesById[tree.speciesId]));
  const paged = paginate(publicTrees, { page: filters.page, pageSize: filters.pageSize });

  const byWard = {};
  const bySpecies = {};
  const byCondition = {};
  for (const tree of searched) {
    byWard[tree.ward] = (byWard[tree.ward] || 0) + 1;
    bySpecies[tree.speciesId] = (bySpecies[tree.speciesId] || 0) + 1;
    byCondition[tree.condition] = (byCondition[tree.condition] || 0) + 1;
  }

  return {
    ...paged,
    items: paged.items,
    summary: {
      totalTrees: searched.length,
      byWard: Object.entries(byWard).map(([ward, count]) => ({ ward, count })),
      bySpecies: Object.entries(bySpecies).map(([id, count]) => ({
        speciesId: id,
        commonName: speciesById[id]?.commonName || id,
        count,
      })),
      byCondition: Object.entries(byCondition).map(([condition, count]) => ({
        condition,
        label: TREE_CONDITION_LABELS[condition] || condition,
        count,
      })),
      inspectionsDue: publicTrees.filter((tree) => tree.inspectionTiming.isOverdue).length,
    },
    freshness: freshness(storage),
    generatedAt: nowIso(),
    source: 'Municipal tree register — demonstration dataset',
  };
};

export const getPublicTreeByPublicId = (publicId, storage = getTreeStorage()) => {
  assertTreeCapability('tree.public.read', null, { allowAnonymous: true });
  ensureTreeInventoryData({ storage });
  const tree = findByPublicId(readCollection(storage, TREE_STORAGE_KEYS.trees), publicId);
  if (!tree || tree.isPubliclyListed === false || tree.status === TREE_STATUS.ARCHIVED) {
    throw createTreeError(TREE_ERROR_CODES.NOT_FOUND);
  }
  const species = speciesFor(storage, tree.speciesId);
  return publicTreeView(tree, species);
};

export const getPublicWardMap = (filters = {}, storage = getTreeStorage()) => {
  const result = getPublicInventory({ ...filters, page: 1, pageSize: TREE_API_LIMITS.maxTreesPerPage }, storage);
  const cells = result.summary.byWard.map((entry) => {
    const trees = result.items.filter((tree) => tree.ward === entry.ward);
    const conditions = trees.reduce((acc, tree) => {
      acc[tree.condition] = (acc[tree.condition] || 0) + 1;
      return acc;
    }, {});
    return {
      ward: entry.ward,
      count: entry.count,
      conditions,
      textAlternative: `${entry.ward}: ${entry.count} public tree${entry.count === 1 ? '' : 's'}, ${Object.entries(conditions)
        .map(([condition, count]) => `${count} ${TREE_CONDITION_LABELS[condition] || condition}`)
        .join(', ')}.`,
    };
  });
  return {
    cells,
    caption: 'Ward-level public tree summary. A text table follows for screen-reader and keyboard users.',
    generatedAt: result.generatedAt,
  };
};

export const getCitizenReportStatus = (tracking, storage = getTreeStorage()) => {
  assertTreeCapability('tree.public.read', null, { allowAnonymous: true });
  ensureTreeInventoryData({ storage });
  const code = sanitizePlain(tracking || '', { max: 40, multiline: false }).toUpperCase();
  const report = readCollection(storage, TREE_STORAGE_KEYS.citizenReports).find((item) => item.trackingCode === code);
  if (!report) throw createTreeError(TREE_ERROR_CODES.NOT_FOUND, 'No report matches that tracking code.');
  return publicReportView(report);
};

export const getTreeInspectionReminders = (filters = {}, storage = getTreeStorage()) => {
  assertTreeCapability('tree.staff.read');
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const nowMs = Number.isFinite(filters.nowMs) ? filters.nowMs : Date.now();
  const withinDays = Math.max(0, Math.min(365, Number(filters.dueWithinDays ?? TREE_API_LIMITS.inspectionReminderDays)));
  const speciesById = Object.fromEntries(readCollection(storage, TREE_STORAGE_KEYS.species).map((s) => [s.id, s]));
  const trees = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.trees), scoped)
    .filter((tree) => ![TREE_STATUS.REMOVED, TREE_STATUS.ARCHIVED].includes(tree.status))
    .filter((tree) => (filters.ward ? tree.ward === filters.ward : true));

  const reminders = trees
    .map((tree) => {
      const timing = inspectionTiming(tree.inspectionDueAt, nowMs);
      return {
        treeId: tree.id,
        publicId: tree.publicId,
        ward: tree.ward,
        condition: tree.condition,
        conditionLabel: TREE_CONDITION_LABELS[tree.condition] || tree.condition,
        species: speciesById[tree.speciesId]?.commonName || tree.speciesId,
        inspectionDueAt: tree.inspectionDueAt,
        lastInspectionAt: tree.lastInspectionAt,
        timing,
      };
    })
    .filter((item) => item.timing.isOverdue || (item.timing.daysUntilDue !== null && item.timing.daysUntilDue <= withinDays))
    .sort((a, b) => Date.parse(a.inspectionDueAt) - Date.parse(b.inspectionDueAt));

  return {
    overdue: reminders.filter((item) => item.timing.isOverdue),
    upcoming: reminders.filter((item) => !item.timing.isOverdue),
    dueWithinDays: withinDays,
    generatedAt: nowIso(nowMs),
  };
};

export const getTreeInventorySummary = (storage = getTreeStorage()) => {
  assertTreeCapability('tree.staff.read');
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const trees = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.trees), scoped);
  const orders = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.workOrders), scoped);
  const reports = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.citizenReports), scoped);
  const inspections = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.inspections), scoped);
  const nowMs = Date.now();
  const byCondition = Object.fromEntries(Object.values(TREE_CONDITIONS).map((condition) => [condition, 0]));
  for (const tree of trees) byCondition[tree.condition] = (byCondition[tree.condition] || 0) + 1;

  return {
    totalTrees: trees.length,
    byCondition,
    overdueInspections: trees.filter((tree) => inspectionTiming(tree.inspectionDueAt, nowMs).isOverdue).length,
    upcomingInspections: trees.filter((tree) => {
      const timing = inspectionTiming(tree.inspectionDueAt, nowMs);
      return !timing.isOverdue && timing.daysUntilDue !== null && timing.daysUntilDue <= TREE_API_LIMITS.inspectionReminderDays;
    }).length,
    openWorkOrders: orders.filter((order) => ![WORK_ORDER_STATES.VERIFIED, WORK_ORDER_STATES.CANCELLED].includes(order.state)).length,
    overdueWorkOrders: orders.filter(
      (order) => ![WORK_ORDER_STATES.VERIFIED, WORK_ORDER_STATES.CANCELLED].includes(order.state) && order.dueAt && Date.parse(order.dueAt) < nowMs
    ).length,
    pendingCitizenReports: reports.filter((report) =>
      [CITIZEN_REPORT_STATES.SUBMITTED, CITIZEN_REPORT_STATES.TRIAGED, CITIZEN_REPORT_STATES.UNDER_REVIEW].includes(report.state)
    ).length,
    pendingExpertVerification: inspections.filter((inspection) => inspection.state === INSPECTION_STATES.COMPLETED).length,
    pendingTriageReview: readCollection(storage, TREE_STORAGE_KEYS.triage).filter(
      (item) => item.decision === TRIAGE_DECISIONS.PENDING
    ).length,
    freshness: freshness(storage),
    indexes: buildTreeInventoryIndexes(storage).manifest,
    generatedAt: nowIso(nowMs),
  };
};

export const getTreeErrorMessage = (error) =>
  error?.userMessage || TREE_ERROR_CODES[error?.code] || 'The tree inventory could not complete that action. Please retry.';

export const listStaffTrees = (filters = {}, storage = getTreeStorage()) => {
  assertTreeCapability('tree.staff.read');
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const speciesList = readCollection(storage, TREE_STORAGE_KEYS.species);
  const speciesById = Object.fromEntries(speciesList.map((species) => [species.id, species]));
  const search = normalizeSearch(filters.search || '');
  const nowMs = Number.isFinite(filters.nowMs) ? filters.nowMs : Date.now();
  const dueFilter = filters.inspectionDue || 'all';

  let trees = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.trees), scoped)
    .filter((tree) => (filters.jurisdictionId ? tree.jurisdictionId === filters.jurisdictionId : true))
    .filter((tree) => (filters.ward ? tree.ward === filters.ward : true))
    .filter((tree) => (filters.speciesId ? tree.speciesId === filters.speciesId : true))
    .filter((tree) => (filters.condition ? tree.condition === filters.condition : true))
    .filter((tree) => (filters.status ? tree.status === filters.status : true));

  if (search) {
    trees = trees.filter((tree) => {
      const species = speciesById[tree.speciesId];
      return [tree.publicId, tree.ward, tree.locality, species?.commonName, species?.scientificName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
  }

  if (dueFilter !== 'all') {
    trees = trees.filter((tree) => {
      const timing = inspectionTiming(tree.inspectionDueAt, nowMs);
      if (dueFilter === 'overdue') return timing.isOverdue;
      if (dueFilter === 'due_7') return timing.daysUntilDue !== null && timing.daysUntilDue <= 7;
      if (dueFilter === 'due_30') return timing.daysUntilDue !== null && timing.daysUntilDue <= 30;
      if (dueFilter === 'unscheduled') return timing.status === 'unscheduled';
      return true;
    });
  }

  const sorted = [...trees].sort((a, b) => {
    if (filters.sort === 'due') {
      return Date.parse(a.inspectionDueAt || '9999-12-31') - Date.parse(b.inspectionDueAt || '9999-12-31');
    }
    if (filters.sort === 'condition') {
      const order = [TREE_CONDITIONS.CRITICAL, TREE_CONDITIONS.POOR, TREE_CONDITIONS.DEAD, TREE_CONDITIONS.FAIR, TREE_CONDITIONS.HEALTHY, TREE_CONDITIONS.UNKNOWN];
      return order.indexOf(a.condition) - order.indexOf(b.condition);
    }
    return Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0);
  });

  const paged = paginate(sorted, { page: filters.page, pageSize: filters.pageSize });
  return {
    ...paged,
    items: paged.items.map((tree) => staffTreeView(tree, speciesById[tree.speciesId], storage, nowMs)),
    filters: {
      jurisdictionId: filters.jurisdictionId || null,
      ward: filters.ward || null,
      speciesId: filters.speciesId || null,
      condition: filters.condition || null,
      status: filters.status || null,
      inspectionDue: dueFilter,
      search: filters.search || '',
    },
    freshness: freshness(storage),
    generatedAt: nowIso(nowMs),
  };
};

const findDuplicateTree = (trees, candidate) => {
  const duplicate = trees.find((tree) => {
    if (tree.id === candidate.id) return false;
    if (tree.jurisdictionId !== candidate.jurisdictionId) return false;
    if (tree.speciesId !== candidate.speciesId) return false;
    if ([TREE_STATUS.REMOVED, TREE_STATUS.ARCHIVED].includes(tree.status)) return false;

    if (candidate.plantingSiteId && tree.plantingSiteId === candidate.plantingSiteId) return true;

    if (candidate.privateCoordinates && tree.privateCoordinates) {
      const distance = haversineMeters(tree.privateCoordinates, candidate.privateCoordinates);
      if (distance <= TREE_API_LIMITS.duplicateTreeRadiusMeters) return true;
    }
    return false;
  });
  return duplicate || null;
};

export const createTreeAsset = (input = {}, { storage = getTreeStorage(), idempotencyKey = null, nowMs = Date.now() } = {}) => {
  const role = assertTreeCapability('tree.create');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'create_tree', input);
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [
      TREE_STORAGE_KEYS.trees,
      TREE_STORAGE_KEYS.species,
      TREE_STORAGE_KEYS.plantingSites,
      TREE_STORAGE_KEYS.audit,
      TREE_STORAGE_KEYS.idempotency,
    ],
    (draft, context) => {
      const now = context.now;
      const jurisdictionId = sanitizePlain(input.jurisdictionId || actor.jurisdictions[0] || '', {
        max: 40,
        multiline: false,
      });
      if (!jurisdictionId) {
        throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'A jurisdiction is required.', {
          fieldErrors: { jurisdictionId: 'Choose a municipal jurisdiction.' },
        });
      }
      assertTreeJurisdiction(getCurrentActor(), jurisdictionId);
      requireJurisdiction(jurisdictionId);

      const speciesId = requireString(input.speciesId, 'speciesId', { min: 2, max: 80 });
      const species = (draft.get(TREE_STORAGE_KEYS.species) || []).find((item) => item.id === speciesId);
      if (!species) {
        throw createTreeError(TREE_ERROR_CODES.REFERENCE_NOT_FOUND, `Unknown species: ${speciesId}.`, {
          fieldErrors: { speciesId: 'Choose a species from the municipal catalogue.' },
        });
      }

      const ward = requireString(input.ward, 'ward', { min: 2, max: 120 });
      const locality = optionalString(input.locality, 'locality', { max: 180 });
      const plantingSiteId = input.plantingSiteId || null;
      requirePlantingSite(draft, plantingSiteId, jurisdictionId);
      const condition = requireEnum(input.condition || TREE_CONDITIONS.UNKNOWN, TREE_CONDITIONS, 'condition');
      const plantedOn = optionalIsoDate(input.plantedOn, 'plantedOn', { notFuture: true, nowMs });
      const approx = validateApproxCoordinates(input.approxCoordinates || input.coordinates, { required: true });
      if (!approx) {
        throw createTreeError(TREE_ERROR_CODES.INVALID_COORDINATES, 'Approximate coordinates are required.');
      }
      const privateCoordinates = validatePreciseCoordinates(input.privateCoordinates);
      const privateNotes = optionalString(input.privateNotes, 'privateNotes', {
        max: TREE_API_LIMITS.maxNotesLength,
        multiline: true,
      });
      const isPubliclyListed = input.isPubliclyListed !== false;
      const plantedAtMs = plantedOn ? Date.parse(plantedOn) : nowMs;

      const trees = draft.get(TREE_STORAGE_KEYS.trees) || [];
      const candidate = {
        id: newTreeId('tree'),
        publicId: treePublicCode(trees, jurisdictionId),
        jurisdictionId,
        ward,
        locality,
        speciesId,
        plantingSiteId,
        condition,
        status: TREE_STATUS.ACTIVE,
        plantedOn,
        lastInspectionAt: null,
        inspectionDueAt: computeInspectionDueAt(plantedOn, species, plantedAtMs),
        approxCoordinates: approx,
        privateCoordinates,
        privateNotes,
        risk: { level: RISK_LEVELS.NONE, state: RISK_DESIGNATION_STATES.NONE, reason: '' },
        isPubliclyListed,
        conditionHistory: [],
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now,
        schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
      };

      const duplicate = findDuplicateTree(trees, candidate);
      if (duplicate && !input.duplicateOverrideReason) {
        throw createTreeError(TREE_ERROR_CODES.DUPLICATE_TREE, `Possible duplicate of ${duplicate.publicId}.`, {
          details: { duplicatePublicId: duplicate.publicId, duplicateTreeId: duplicate.id },
        });
      }
      if (duplicate && input.duplicateOverrideReason) {
        const overrideReason = requireString(input.duplicateOverrideReason, 'duplicateOverrideReason', { min: 10, max: 500 });
        appendAuditEvent(draft, {
          action: 'tree.duplicate_override',
          entityType: 'TreeAsset',
          entityId: candidate.id,
          actor,
          jurisdictionId,
          reason: overrideReason,
          details: { duplicatePublicId: duplicate.publicId },
          createdAt: now,
        });
      }

      trees.push(candidate);
      draft.set(TREE_STORAGE_KEYS.trees, trees);

      // An occupied planting site stays explicitly occupied.
      const sites = draft.get(TREE_STORAGE_KEYS.plantingSites) || [];
      if (plantingSiteId) {
        const siteIndex = sites.findIndex((site) => site.id === plantingSiteId);
        if (siteIndex >= 0 && sites[siteIndex].state !== PLANTING_SITE_STATES.OCCUPIED) {
          sites[siteIndex] = { ...sites[siteIndex], state: PLANTING_SITE_STATES.OCCUPIED, updatedAt: now };
          draft.set(TREE_STORAGE_KEYS.plantingSites, sites);
        }
      }

      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.TREE_CREATED,
        entityType: 'TreeAsset',
        entityId: candidate.id,
        actor,
        jurisdictionId,
        reason: input.reason || 'Tree asset registered',
        details: { publicId: candidate.publicId, speciesId, ward },
        createdAt: now,
      });

      const response = {
        tree: staffTreeView(candidate, species, storage, nowMs),
        publicTree: publicTreeView(candidate, species),
        replayed: false,
      };
      saveIdempotency(draft, actor, key, 'create_tree', input, response);
      return response;
    }
  );

  return { ...result, role };
};

export const updateTreeAsset = (
  treeId,
  updates = {},
  { storage = getTreeStorage(), idempotencyKey = null, nowMs = Date.now(), reason = 'Tree record corrected' } = {}
) => {
  const role = assertTreeCapability('tree.update');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'update_tree', { treeId, updates, reason });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [
      TREE_STORAGE_KEYS.trees,
      TREE_STORAGE_KEYS.species,
      TREE_STORAGE_KEYS.plantingSites,
      TREE_STORAGE_KEYS.audit,
      TREE_STORAGE_KEYS.idempotency,
    ],
    (draft, context) => {
      const now = context.now;
      const tree = requireTree(draft, treeId, scoped);
      assertTreeJurisdiction(getCurrentActor(), tree.jurisdictionId);
      const speciesList = draft.get(TREE_STORAGE_KEYS.species) || [];
      const before = cloneJson(tree);
      const speciesId = updates.speciesId !== undefined ? requireString(updates.speciesId, 'speciesId', { min: 2, max: 80 }) : tree.speciesId;
      const species = speciesList.find((item) => item.id === speciesId);
      if (!species) {
        throw createTreeError(TREE_ERROR_CODES.REFERENCE_NOT_FOUND, `Unknown species: ${speciesId}.`, {
          fieldErrors: { speciesId: 'Choose a species from the municipal catalogue.' },
        });
      }
      const ward = updates.ward !== undefined ? requireString(updates.ward, 'ward', { min: 2, max: 120 }) : tree.ward;
      const locality = updates.locality !== undefined ? optionalString(updates.locality, 'locality', { max: 180 }) : tree.locality;
      const condition =
        updates.condition !== undefined ? requireEnum(updates.condition, TREE_CONDITIONS, 'condition') : tree.condition;
      const conditionChanged = condition !== tree.condition;
      const plantingSiteId =
        updates.plantingSiteId !== undefined ? updates.plantingSiteId || null : tree.plantingSiteId;
      requirePlantingSite(draft, plantingSiteId, tree.jurisdictionId);
      const plantedOn =
        updates.plantedOn !== undefined ? optionalIsoDate(updates.plantedOn, 'plantedOn', { notFuture: true, nowMs }) : tree.plantedOn;
      const approxCoordinates =
        updates.approxCoordinates || updates.coordinates
          ? validateApproxCoordinates(updates.approxCoordinates || updates.coordinates, { required: true })
          : tree.approxCoordinates;
      const privateCoordinates =
        updates.privateCoordinates !== undefined ? validatePreciseCoordinates(updates.privateCoordinates) : tree.privateCoordinates;
      const privateNotes =
        updates.privateNotes !== undefined ? optionalString(updates.privateNotes, 'privateNotes', { max: TREE_API_LIMITS.maxNotesLength, multiline: true }) : tree.privateNotes;
      const isPubliclyListed =
        updates.isPubliclyListed !== undefined ? Boolean(updates.isPubliclyListed) : tree.isPubliclyListed;

      const candidate = {
        ...tree,
        speciesId,
        ward,
        locality,
        condition,
        conditionHistory: conditionChanged
          ? [
              ...(Array.isArray(tree.conditionHistory) ? tree.conditionHistory : []),
              { from: tree.condition, to: condition, changedBy: actor.id, changedAt: now, reason: sanitizePlain(reason, { max: 400 }) },
            ]
          : tree.conditionHistory || [],
        plantingSiteId,
        plantedOn,
        approxCoordinates,
        privateCoordinates,
        privateNotes,
        isPubliclyListed,
        inspectionDueAt:
          plantedOn !== tree.plantedOn || speciesId !== tree.speciesId
            ? computeInspectionDueAt(plantedOn, species, nowMs)
            : tree.inspectionDueAt,
        updatedAt: now,
        schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
        id: tree.id,
      };

      const duplicate = findDuplicateTree(
        (draft.get(TREE_STORAGE_KEYS.trees) || []).filter((item) => item.id !== tree.id),
        candidate
      );
      if (duplicate && candidate.speciesId !== before.speciesId && !updates.duplicateOverrideReason) {
        throw createTreeError(TREE_ERROR_CODES.DUPLICATE_TREE, `Possible duplicate of ${duplicate.publicId}.`, {
          details: { duplicatePublicId: duplicate.publicId },
        });
      }

      const trees = (draft.get(TREE_STORAGE_KEYS.trees) || []).map((item) => (item.id === tree.id ? candidate : item));
      draft.set(TREE_STORAGE_KEYS.trees, trees);
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.TREE_UPDATED,
        entityType: 'TreeAsset',
        entityId: tree.id,
        actor,
        jurisdictionId: tree.jurisdictionId,
        reason,
        changes: changeSummary(before, candidate, [
          'speciesId',
          'ward',
          'locality',
          'condition',
          'plantedOn',
          'plantingSiteId',
          'approxCoordinates',
          'privateCoordinates',
          'privateNotes',
          'isPubliclyListed',
          'inspectionDueAt',
        ]),
        createdAt: now,
      });

      const response = {
        tree: staffTreeView(candidate, species, storage, nowMs),
        publicTree: publicTreeView(candidate, species),
        replayed: false,
      };
      saveIdempotency(draft, actor, key, 'update_tree', { treeId, updates, reason }, response);
      return response;
    }
  );
  return { ...result, role };
};

export const proposeTreeRisk = (
  treeId,
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null, nowMs = Date.now() } = {}
) => {
  const role = assertTreeCapability('tree.risk.propose');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'propose_risk', { treeId, input });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [TREE_STORAGE_KEYS.trees, TREE_STORAGE_KEYS.inspections, TREE_STORAGE_KEYS.audit, TREE_STORAGE_KEYS.idempotency],
    (draft, context) => {
      const now = context.now;
      const tree = requireTree(draft, treeId, scoped);
      assertTreeJurisdiction(getCurrentActor(), tree.jurisdictionId);
      const level = requireEnum(input.level, RISK_LEVELS, 'level');
      if (level === RISK_LEVELS.NONE) {
        throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Choose a risk level above "none".', {
          fieldErrors: { level: 'A proposed risk must be low, moderate, high or critical.' },
        });
      }
      const reason = requireString(input.reason, 'reason', { min: 10, max: TREE_API_LIMITS.maxReasonLength });
      let inspectionId = null;
      if (input.inspectionId) {
        const inspection = requireInspection(draft, input.inspectionId, scoped);
        if (inspection.treeId !== tree.id) {
          throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Inspection does not belong to this tree.');
        }
        if ([INSPECTION_STATES.CANCELLED, INSPECTION_STATES.MISSED].includes(inspection.state)) {
          throw createTreeError(TREE_ERROR_CODES.INVALID_TRANSITION, 'A cancelled or missed inspection cannot support a risk proposal.');
        }
        inspectionId = inspection.id;
      }

      const before = cloneJson(tree);
      const updated = {
        ...tree,
        risk: {
          level,
          state: RISK_DESIGNATION_STATES.PROPOSED,
          reason,
          proposedBy: actor.id,
          proposedAt: now,
          inspectionId,
          confirmedBy: null,
          confirmedAt: null,
        },
        status: [RISK_LEVELS.HIGH, RISK_LEVELS.CRITICAL].includes(level) && tree.status === TREE_STATUS.ACTIVE
          ? TREE_STATUS.PENDING_REVIEW
          : tree.status,
        updatedAt: now,
      };
      draft.set(
        TREE_STORAGE_KEYS.trees,
        (draft.get(TREE_STORAGE_KEYS.trees) || []).map((item) => (item.id === tree.id ? updated : item))
      );
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.TREE_RISK_PROPOSED,
        entityType: 'TreeAsset',
        entityId: tree.id,
        actor,
        jurisdictionId: tree.jurisdictionId,
        reason,
        changes: changeSummary(before, updated, ['risk', 'status']),
        details: { inspectionId, requiresReviewerConfirmation: true },
        createdAt: now,
      });
      const response = {
        tree: staffTreeView(updated, speciesFor(storage, updated.speciesId), storage, nowMs),
        expertConfirmationRequired: true,
        nextStep: 'A risk reviewer must confirm or reject this proposal before removal can be approved.',
      };
      saveIdempotency(draft, actor, key, 'propose_risk', { treeId, input }, response);
      return response;
    }
  );
  return { ...result, role };
};

export const confirmTreeRisk = (
  treeId,
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null, nowMs = Date.now() } = {}
) => {
  const role = assertTreeCapability('tree.risk.confirm');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'confirm_risk', { treeId, input });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [TREE_STORAGE_KEYS.trees, TREE_STORAGE_KEYS.audit, TREE_STORAGE_KEYS.idempotency],
    (draft, context) => {
      const now = context.now;
      const tree = requireTree(draft, treeId, scoped);
      assertTreeJurisdiction(getCurrentActor(), tree.jurisdictionId);
      if (tree.risk?.state !== RISK_DESIGNATION_STATES.PROPOSED) {
        throw createTreeError(TREE_ERROR_CODES.INVALID_TRANSITION, 'Only a proposed risk designation can be reviewed.');
      }
      const decision = requireEnum(input.decision, { CONFIRM: 'confirm', REJECT: 'reject' }, 'decision');
      const reason = requireString(input.reason, 'reason', { min: 5, max: TREE_API_LIMITS.maxReasonLength });
      const confirmed = decision === 'confirm';
      const before = cloneJson(tree);
      const updated = {
        ...tree,
        risk: {
          ...tree.risk,
          state: confirmed ? RISK_DESIGNATION_STATES.CONFIRMED : RISK_DESIGNATION_STATES.REJECTED,
          level: confirmed ? tree.risk.level : RISK_LEVELS.NONE,
          rejectedLevel: confirmed ? null : tree.risk.level,
          confirmedBy: confirmed ? actor.id : null,
          confirmedAt: confirmed ? now : null,
          rejectedBy: confirmed ? null : actor.id,
          rejectedAt: confirmed ? null : now,
          reviewerReason: reason,
        },
        updatedAt: now,
      };
      draft.set(
        TREE_STORAGE_KEYS.trees,
        (draft.get(TREE_STORAGE_KEYS.trees) || []).map((item) => (item.id === tree.id ? updated : item))
      );
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.TREE_RISK_CONFIRMED,
        entityType: 'TreeAsset',
        entityId: tree.id,
        actor,
        jurisdictionId: tree.jurisdictionId,
        reason,
        changes: changeSummary(before, updated, ['risk']),
        details: { decision, expertConfirmation: true },
        createdAt: now,
      });
      const response = {
        tree: staffTreeView(updated, speciesFor(storage, updated.speciesId), storage, nowMs),
        expertConfirmed: confirmed,
      };
      saveIdempotency(draft, actor, key, 'confirm_risk', { treeId, input }, response);
      return response;
    }
  );
  return { ...result, role };
};

export const transitionTreeStatus = (
  treeId,
  nextStatus,
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null, nowMs = Date.now() } = {}
) => {
  const role = assertTreeCapability('tree.status.transition');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const target = requireEnum(nextStatus, TREE_STATUS, 'nextStatus');
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'transition_tree', { treeId, nextStatus, input });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [TREE_STORAGE_KEYS.trees, TREE_STORAGE_KEYS.audit, TREE_STORAGE_KEYS.idempotency],
    (draft, context) => {
      const now = context.now;
      const tree = requireTree(draft, treeId, scoped);
      assertTreeJurisdiction(getCurrentActor(), tree.jurisdictionId);
      assertTransition('tree', tree.status, target);
      const reason = requireString(input.reason, 'reason', { min: 5, max: TREE_API_LIMITS.maxReasonLength });
      if (target === TREE_STATUS.REMOVAL_APPROVED) {
        const risk = tree.risk;
        if (risk?.state !== RISK_DESIGNATION_STATES.CONFIRMED || ![RISK_LEVELS.HIGH, RISK_LEVELS.CRITICAL].includes(risk.level)) {
          throw createTreeError(
            TREE_ERROR_CODES.EXPERT_CONFIRMATION_REQUIRED,
            'Removal can only be approved after a reviewer confirms a high or critical risk designation.'
          );
        }
      }
      const before = cloneJson(tree);
      const updated = {
        ...tree,
        status: target,
        updatedAt: now,
        archivedAt: target === TREE_STATUS.ARCHIVED ? now : null,
        removalApprovedAt: target === TREE_STATUS.REMOVAL_APPROVED ? now : tree.removalApprovedAt || null,
        removedAt: target === TREE_STATUS.REMOVED ? now : tree.removedAt || null,
      };
      draft.set(
        TREE_STORAGE_KEYS.trees,
        (draft.get(TREE_STORAGE_KEYS.trees) || []).map((item) => (item.id === tree.id ? updated : item))
      );
      appendAuditEvent(draft, {
        action: target === TREE_STATUS.ARCHIVED ? AUDIT_ACTIONS.TREE_ARCHIVED : AUDIT_ACTIONS.TREE_STATUS_CHANGED,
        entityType: 'TreeAsset',
        entityId: tree.id,
        actor,
        jurisdictionId: tree.jurisdictionId,
        reason,
        changes: changeSummary(before, updated, ['status', 'archivedAt', 'removalApprovedAt', 'removedAt']),
        createdAt: now,
      });
      const response = {
        tree: staffTreeView(updated, speciesFor(storage, updated.speciesId), storage, nowMs),
      };
      saveIdempotency(draft, actor, key, 'transition_tree', { treeId, nextStatus, input }, response);
      return response;
    }
  );
  return { ...result, role };
};

const enforceReportRateLimit = (draft, reporterKey, nowMs) => {
  const current = draft.get(TREE_STORAGE_KEYS.rateLimit);
  // Missing keys start as [] in runTreeTransaction; using an array would drop
  // every string-keyed history entry during JSON serialisation.
  const store = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  const history = Array.isArray(store[reporterKey]) ? store[reporterKey] : [];
  const active = history.filter(
    (timestamp) => Number.isFinite(timestamp) && timestamp <= nowMs && nowMs - timestamp < TREE_API_LIMITS.reportRateWindowMs
  );
  if (active.length >= TREE_API_LIMITS.reportRateLimit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((Math.min(...active) + TREE_API_LIMITS.reportRateWindowMs - nowMs) / 1000));
    throw createTreeError(TREE_ERROR_CODES.RATE_LIMITED, 'Citizen report rate limit reached.', {
      details: { retryAfterSeconds },
      userMessage: `Too many reports from this device. Try again in ${retryAfterSeconds} seconds.`,
    });
  }
  active.push(nowMs);
  store[reporterKey] = active;
  draft.set(TREE_STORAGE_KEYS.rateLimit, store);
};

export const submitCitizenTreeReport = (
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null, reporterKey = null, nowMs = Date.now() } = {}
) => {
  assertTreeCapability('report.submit', getCurrentActor(), { allowAnonymous: true });
  ensureTreeInventoryData({ storage });
  const signedIn = actorIdentity(getCurrentActor());
  const deviceKey = sanitizePlain(
    reporterKey || input.reporterKey || signedIn?.id || 'anonymous_device',
    { max: 120, multiline: false }
  );
  const idemActor = signedIn || { id: deviceKey, label: 'Anonymous resident', role: TREE_ROLES.CITIZEN };
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, idemActor, key, 'submit_report', input);
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [
      TREE_STORAGE_KEYS.citizenReports,
      TREE_STORAGE_KEYS.trees,
      TREE_STORAGE_KEYS.reportAttachments,
      TREE_STORAGE_KEYS.rateLimit,
      TREE_STORAGE_KEYS.audit,
      TREE_STORAGE_KEYS.idempotency,
    ],
    (draft, context) => {
      const now = context.now;
      const category = requireEnum(input.category, CITIZEN_REPORT_CATEGORIES, 'category');
      const description = sanitizePublicNarrative(
        requireString(input.description, 'description', { min: 20, max: TREE_API_LIMITS.maxNotesLength, multiline: true }),
        { max: TREE_API_LIMITS.maxNotesLength, multiline: true }
      );
      if (description.length < 20) {
        throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Describe the visible damage in at least 20 characters.', {
          fieldErrors: { description: 'Describe what you can see in at least 20 characters.' },
        });
      }

      let tree = null;
      const reports = draft.get(TREE_STORAGE_KEYS.citizenReports) || [];
      if (input.treePublicId) {
        tree = findByPublicId(draft.get(TREE_STORAGE_KEYS.trees) || [], sanitizePlain(input.treePublicId, { max: 40 }));
        if (!tree) throw createTreeError(TREE_ERROR_CODES.NOT_FOUND, 'The selected public tree could not be found.');
      }

      const jurisdictionId = tree?.jurisdictionId || sanitizePlain(input.jurisdictionId || '', { max: 40, multiline: false });
      if (!jurisdictionId) {
        throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Choose a jurisdiction or a public tree.', {
          fieldErrors: { jurisdictionId: 'Choose a ward or tree.' },
        });
      }
      requireJurisdiction(jurisdictionId);
      const ward = tree?.ward || requireString(input.ward, 'ward', { min: 2, max: 120 });

      enforceReportRateLimit(draft, deviceKey, nowMs);

      const duplicate = reports.find(
        (report) =>
          report.reporterKey === deviceKey &&
          report.category === category &&
          report.description === description &&
          !['rejected', 'duplicate'].includes(report.state) &&
          nowMs - Date.parse(report.createdAt || '') < TREE_API_LIMITS.duplicateReportCooldownMs
      );
      if (duplicate) {
        const response = {
          duplicate: true,
          replayed: false,
          publicReport: publicReportView(duplicate),
          message: 'This observation is already in the municipal queue. Use the existing tracking code.',
        };
        saveIdempotency(draft, idemActor, key, 'submit_report', input, response);
        return response;
      }

      const attachmentIds = storeAttachments(draft, {
        entityType: 'CitizenReport',
        entityId: 'pending',
        attachments: input.attachments || [],
        actor: idemActor,
        jurisdictionId,
      });
      const report = {
        id: newTreeId('rep'),
        trackingCode: trackingCode(reports),
        treeId: tree?.id || null,
        publicId: tree?.publicId || null,
        jurisdictionId,
        ward,
        locality: tree?.locality || optionalString(input.locality, 'locality', { max: 180 }),
        category,
        description,
        state: CITIZEN_REPORT_STATES.SUBMITTED,
        reporterLabel: signedIn ? signedIn.label : 'Resident (not verified)',
        reporterKey: deviceKey,
        attachments: attachmentIds,
        triageNotes: '',
        duplicateOfTracking: null,
        reviewedBy: null,
        reviewedAt: null,
        inspectionId: null,
        createdAt: now,
        updatedAt: now,
        schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
      };
      if (attachmentIds.length > 0) {
        const collection = draft.get(TREE_STORAGE_KEYS.reportAttachments) || [];
        draft.set(
          TREE_STORAGE_KEYS.reportAttachments,
          collection.map((attachment) =>
            attachmentIds.includes(attachment.id) ? { ...attachment, entityId: report.id } : attachment
          )
        );
      }
      reports.push(report);
      draft.set(TREE_STORAGE_KEYS.citizenReports, reports);
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.REPORT_SUBMITTED,
        entityType: 'CitizenReport',
        entityId: report.id,
        actor: idemActor,
        jurisdictionId,
        reason: 'Citizen tree observation submitted',
        details: { trackingCode: report.trackingCode, category, treePublicId: tree?.publicId || null },
        createdAt: now,
      });
      const response = {
        duplicate: false,
        publicReport: publicReportView(report),
        message: 'Report received. Keep the tracking code to follow its status.',
      };
      saveIdempotency(draft, idemActor, key, 'submit_report', input, response);
      return response;
    }
  );
  return { ...result, role: TREE_ROLES.CITIZEN };
};

export const listCitizenReports = (filters = {}, storage = getTreeStorage()) => {
  assertTreeCapability('tree.staff.read');
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const search = normalizeSearch(filters.search || '');
  let reports = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.citizenReports), scoped)
    .filter((report) => (filters.state ? report.state === filters.state : true))
    .filter((report) => (filters.jurisdictionId ? report.jurisdictionId === filters.jurisdictionId : true))
    .filter((report) => (filters.category ? report.category === filters.category : true))
    .filter((report) => (filters.treeId ? report.treeId === filters.treeId : true));

  if (search) {
    reports = reports.filter((report) =>
      [report.trackingCode, report.publicId, report.ward, report.description, report.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search)
    );
  }

  reports = reports.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  const paged = paginate(reports, { page: filters.page, pageSize: filters.pageSize });
  return {
    ...paged,
    items: paged.items.map((report) => staffReportView(report)),
    pendingCount: reports.filter((report) =>
      [CITIZEN_REPORT_STATES.SUBMITTED, CITIZEN_REPORT_STATES.TRIAGED, CITIZEN_REPORT_STATES.UNDER_REVIEW].includes(report.state)
    ).length,
    generatedAt: nowIso(),
  };
};

export const triageCitizenReport = (
  reportId,
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null } = {}
) => {
  const role = assertTreeCapability('report.triage');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'triage_report', { reportId, input });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [TREE_STORAGE_KEYS.citizenReports, TREE_STORAGE_KEYS.trees, TREE_STORAGE_KEYS.audit, TREE_STORAGE_KEYS.idempotency],
    (draft, context) => {
      const now = context.now;
      const report = requireReport(draft, reportId, scoped);
      assertTreeJurisdiction(getCurrentActor(), report.jurisdictionId);
      if (![CITIZEN_REPORT_STATES.SUBMITTED, CITIZEN_REPORT_STATES.TRIAGED].includes(report.state)) {
        throw createTreeError(TREE_ERROR_CODES.INVALID_TRANSITION, 'This report is past triage.');
      }
      const decision = requireEnum(
        input.decision,
        { TRIAGED: 'triaged', ESCALATE: 'escalate', DUPLICATE: 'duplicate' },
        'decision'
      );
      const notes = requireString(input.triageNotes || input.reason, 'triageNotes', {
        min: 5,
        max: TREE_API_LIMITS.maxReasonLength,
      });
      let tree = report.treeId
        ? (draft.get(TREE_STORAGE_KEYS.trees) || []).find((item) => item.id === report.treeId)
        : null;
      if (input.treeId) {
        tree = requireTree(draft, input.treeId, scoped);
        assertTreeJurisdiction(getCurrentActor(), tree.jurisdictionId);
        if (tree.jurisdictionId !== report.jurisdictionId) {
          throw createTreeError(TREE_ERROR_CODES.JURISDICTION_FORBIDDEN, 'Report and tree belong to different jurisdictions.');
        }
      }
      const target =
        decision === 'duplicate'
          ? CITIZEN_REPORT_STATES.DUPLICATE
          : decision === 'escalate'
            ? CITIZEN_REPORT_STATES.UNDER_REVIEW
            : CITIZEN_REPORT_STATES.TRIAGED;
      assertTransition('citizenReport', report.state, target);
      const before = cloneJson(report);
      const updated = {
        ...report,
        state: target,
        treeId: tree?.id || report.treeId,
        publicId: tree?.publicId || report.publicId,
        ward: tree?.ward || report.ward,
        triageNotes: notes,
        duplicateOfTracking: target === CITIZEN_REPORT_STATES.DUPLICATE ? optionalString(input.duplicateOfTracking, 'duplicateOfTracking', { max: 40 }) : report.duplicateOfTracking,
        triagedBy: actor.id,
        triagedAt: now,
        updatedAt: now,
      };
      draft.set(
        TREE_STORAGE_KEYS.citizenReports,
        (draft.get(TREE_STORAGE_KEYS.citizenReports) || []).map((item) => (item.id === report.id ? updated : item))
      );
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.REPORT_TRIAGED,
        entityType: 'CitizenReport',
        entityId: report.id,
        actor,
        jurisdictionId: report.jurisdictionId,
        reason: notes,
        changes: changeSummary(before, updated, ['state', 'treeId', 'triageNotes']),
        createdAt: now,
      });
      const response = { report: staffReportView(updated) };
      saveIdempotency(draft, actor, key, 'triage_report', { reportId, input }, response);
      return response;
    }
  );
  return { ...result, role };
};

export const reviewCitizenReport = (
  reportId,
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null, nowMs = Date.now() } = {}
) => {
  const role = assertTreeCapability('report.review');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'review_report', { reportId, input });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [
      TREE_STORAGE_KEYS.citizenReports,
      TREE_STORAGE_KEYS.trees,
      TREE_STORAGE_KEYS.inspections,
      TREE_STORAGE_KEYS.audit,
      TREE_STORAGE_KEYS.idempotency,
    ],
    (draft, context) => {
      const now = context.now;
      const report = requireReport(draft, reportId, scoped);
      assertTreeJurisdiction(getCurrentActor(), report.jurisdictionId);
      const decision = requireEnum(input.decision, { ACCEPT: 'accept', REJECT: 'reject', DUPLICATE: 'duplicate' }, 'decision');
      const reason = requireString(input.reason, 'reason', { min: 5, max: TREE_API_LIMITS.maxReasonLength });
      const target =
        decision === 'accept'
          ? CITIZEN_REPORT_STATES.ACCEPTED
          : decision === 'duplicate'
            ? CITIZEN_REPORT_STATES.DUPLICATE
            : CITIZEN_REPORT_STATES.REJECTED;
      assertTransition('citizenReport', report.state, target);

      let tree = report.treeId ? (draft.get(TREE_STORAGE_KEYS.trees) || []).find((item) => item.id === report.treeId) : null;
      if (input.treeId) {
        tree = requireTree(draft, input.treeId, scoped);
        if (tree.jurisdictionId !== report.jurisdictionId) {
          throw createTreeError(TREE_ERROR_CODES.JURISDICTION_FORBIDDEN, 'Report and tree belong to different jurisdictions.');
        }
      }
      if (target === CITIZEN_REPORT_STATES.ACCEPTED && !tree) {
        throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Link the report to a tree before accepting it.', {
          fieldErrors: { treeId: 'Choose the tree this report refers to.' },
        });
      }

      let inspection = null;
      if (target === CITIZEN_REPORT_STATES.ACCEPTED && input.createInspection !== false) {
        const inspections = draft.get(TREE_STORAGE_KEYS.inspections) || [];
        const species = speciesFor(storage, tree.speciesId);
        inspection = {
          id: newTreeId('insp'),
          publicId: inspectionPublicCode(inspections, tree.jurisdictionId),
          jurisdictionId: tree.jurisdictionId,
          treeId: tree.id,
          type: INSPECTION_TYPES.CITIZEN_REPORT,
          state: INSPECTION_STATES.SCHEDULED,
          scheduledFor: input.inspectionDate
            ? requireIsoDate(input.inspectionDate, 'inspectionDate', { nowMs })
            : new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString(),
          performedAt: null,
          assignedTo: optionalString(input.assignedTo, 'assignedTo', { max: 120 }),
          inspectorName: '',
          conditionAtInspection: null,
          findings: '',
          notes: `Follow-up from citizen report ${report.trackingCode}. ${reason}`,
          evidence: [],
          triageSuggestionId: null,
          sourceReportId: report.id,
          verifiedBy: null,
          verifiedAt: null,
          createdBy: actor.id,
          createdAt: now,
          updatedAt: now,
          schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
          speciesContext: species?.commonName || null,
        };
        inspections.push(inspection);
        draft.set(TREE_STORAGE_KEYS.inspections, inspections);
      }

      const before = cloneJson(report);
      const updated = {
        ...report,
        state: target,
        treeId: tree?.id || report.treeId,
        publicId: tree?.publicId || report.publicId,
        ward: tree?.ward || report.ward,
        duplicateOfTracking: target === CITIZEN_REPORT_STATES.DUPLICATE ? optionalString(input.duplicateOfTracking, 'duplicateOfTracking', { max: 40 }) : report.duplicateOfTracking,
        inspectionId: inspection?.id || report.inspectionId,
        reviewReason: reason,
        reviewedBy: actor.id,
        reviewedAt: now,
        updatedAt: now,
      };
      draft.set(
        TREE_STORAGE_KEYS.citizenReports,
        (draft.get(TREE_STORAGE_KEYS.citizenReports) || []).map((item) => (item.id === report.id ? updated : item))
      );
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.REPORT_REVIEWED,
        entityType: 'CitizenReport',
        entityId: report.id,
        actor,
        jurisdictionId: report.jurisdictionId,
        reason,
        changes: changeSummary(before, updated, ['state', 'treeId', 'inspectionId']),
        details: { decision, inspectionPublicId: inspection?.publicId || null, expertReview: true },
        createdAt: now,
      });
      const response = {
        report: staffReportView(updated),
        inspection: inspection ? staffInspectionView(inspection) : null,
      };
      saveIdempotency(draft, actor, key, 'review_report', { reportId, input }, response);
      return response;
    }
  );
  return { ...result, role };
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((item) => item.some((cell) => String(cell).trim() !== ''));
};

const normalizeHeader = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const CSV_REQUIRED = ['ward', 'species_id', 'condition', 'latitude', 'longitude'];

const validateCsvRow = (row, index, headerMap, storage, nowMs) => {
  const errors = [];
  const get = (name) => {
    const headerIndex = headerMap[name];
    return headerIndex === undefined ? '' : String(row[headerIndex] ?? '').trim();
  };
  const push = (field, message) => errors.push({ row: index + 2, field, message });

  const ward = sanitizePlain(get('ward'), { max: 120, multiline: false });
  if (ward.length < 2) push('ward', 'Ward is required.');

  const speciesId = sanitizePlain(get('species_id'), { max: 80, multiline: false });
  const speciesList = readCollection(storage, TREE_STORAGE_KEYS.species);
  const species = speciesList.find((item) => item.id === speciesId);
  if (!species) push('species_id', 'Unknown species id.');

  const condition = sanitizePlain(get('condition'), { max: 40 }).toLowerCase();
  if (!isKnownValue(TREE_CONDITIONS, condition)) push('condition', `Condition must be one of ${Object.values(TREE_CONDITIONS).join(', ')}.`);

  let approx = null;
  try {
    approx = validateApproxCoordinates(
      { lat: get('latitude'), lng: get('longitude') },
      { required: true }
    );
  } catch {
    push('latitude/longitude', 'Latitude must be -90..90 and longitude -180..180.');
  }

  let plantedOn = null;
  try {
    plantedOn = optionalIsoDate(get('planted_on'), 'planted_on', { notFuture: true, nowMs });
  } catch {
    push('planted_on', 'Use YYYY-MM-DD and do not use a future date.');
  }

  let site = null;
  const plantingSiteId = sanitizePlain(get('planting_site_id'), { max: 80, multiline: false });
  if (plantingSiteId) {
    site = readCollection(storage, TREE_STORAGE_KEYS.plantingSites).find((item) => item.id === plantingSiteId);
    if (!site) push('planting_site_id', 'Unknown planting site id.');
  }

  const locality = sanitizePlain(get('locality'), { max: 180, multiline: false });
  const notes = sanitizePlain(get('notes'), { max: TREE_API_LIMITS.maxNotesLength, multiline: true });
  const publicId = sanitizePlain(get('public_id'), { max: 40, multiline: false });

  return {
    rowNumber: index + 2,
    errors,
    parsed: {
      ward,
      speciesId,
      species,
      condition,
      approxCoordinates: approx,
      plantedOn,
      plantingSiteId: site?.id || null,
      plantingSite: site,
      locality,
      notes,
      publicId: publicId || null,
    },
  };
};

export const previewTreeImport = (csvText, { storage = getTreeStorage(), nowMs = Date.now() } = {}) => {
  assertTreeCapability('inventory.import');
  ensureTreeInventoryData({ storage });
  if (typeof csvText !== 'string' || csvText.trim() === '') {
    throw createTreeError(TREE_ERROR_CODES.IMPORT_INVALID, 'Paste or choose a CSV file first.', {
      fieldErrors: { csv: 'The CSV file is empty.' },
    });
  }
  const bytes = new TextEncoder().encode(csvText).length;
  if (bytes > TREE_API_LIMITS.maxCsvBytes) {
    throw createTreeError(TREE_ERROR_CODES.IMPORT_INVALID, `CSV exceeds ${TREE_API_LIMITS.maxCsvBytes} bytes.`);
  }
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw createTreeError(TREE_ERROR_CODES.IMPORT_INVALID, 'CSV needs a header row and at least one data row.');
  }
  if (rows.length - 1 > TREE_API_LIMITS.maxCsvRows) {
    throw createTreeError(TREE_ERROR_CODES.IMPORT_INVALID, `CSV exceeds ${TREE_API_LIMITS.maxCsvRows} data rows.`);
  }
  const header = rows[0].map(normalizeHeader);
  const headerMap = Object.fromEntries(header.map((name, index) => [name, index]));
  if (headerMap.lat !== undefined && headerMap.latitude === undefined) headerMap.latitude = headerMap.lat;
  if (headerMap.lng !== undefined && headerMap.longitude === undefined) headerMap.longitude = headerMap.lng;
  const missing = CSV_REQUIRED.filter((field) => headerMap[field] === undefined);
  if (missing.length > 0) {
    throw createTreeError(TREE_ERROR_CODES.IMPORT_INVALID, `Missing CSV columns: ${missing.join(', ')}.`, {
      details: { missing },
    });
  }

  const trees = readCollection(storage, TREE_STORAGE_KEYS.trees);
  const seen = new Set();
  const validatedRows = rows.slice(1).map((row, index) => {
    const result = validateCsvRow(row, index, headerMap, storage, nowMs);
    const parsed = result.parsed;
    if (parsed.approxCoordinates) {
      const identity = `${parsed.speciesId}|${parsed.ward}|${parsed.approxCoordinates.lat}|${parsed.approxCoordinates.lng}`;
      if (seen.has(identity)) {
        result.errors.push({ row: result.rowNumber, field: 'row', message: 'Duplicate row in this file.' });
      }
      seen.add(identity);
      const existing = trees.find((tree) => {
        if ([TREE_STATUS.REMOVED, TREE_STATUS.ARCHIVED].includes(tree.status)) return false;
        if (tree.speciesId !== parsed.speciesId) return false;
        if (tree.publicId === parsed.publicId && parsed.publicId) return true;
        if (parsed.plantingSiteId && tree.plantingSiteId === parsed.plantingSiteId) return true;
        const approx = tree.approxCoordinates;
        return approx && Number(approx.lat) === parsed.approxCoordinates.lat && Number(approx.lng) === parsed.approxCoordinates.lng;
      });
      if (existing) {
        result.errors.push({
          row: result.rowNumber,
          field: 'row',
          message: `Possible duplicate of existing tree ${existing.publicId}.`,
        });
      }
    }
    return result;
  });

  const errors = validatedRows.flatMap((row) =>
    row.errors.map((error) => ({ ...error, rowNumber: row.rowNumber }))
  );
  const duplicates = validatedRows.filter((row) => row.errors.some((error) => /duplicate/i.test(error.message))).length;
  return {
    totalRows: validatedRows.length,
    validRows: validatedRows.length - new Set(validatedRows.filter((row) => row.errors.length > 0).map((row) => row.rowNumber)).size,
    invalidRows: new Set(validatedRows.filter((row) => row.errors.length > 0).map((row) => row.rowNumber)).size,
    duplicateRows: duplicates,
    errors,
    // Preview values are plain data; no raw CSV is echoed back into the page.
    previewRows: validatedRows.slice(0, 20).map((row) => ({
      rowNumber: row.rowNumber,
      ward: row.parsed.ward,
      speciesId: row.parsed.speciesId,
      species: row.parsed.species?.commonName || null,
      condition: row.parsed.condition,
      plantedOn: row.parsed.plantedOn,
      plantingSiteId: row.parsed.plantingSiteId,
      valid: row.errors.length === 0,
      messages: row.errors.map((error) => error.message),
    })),
    canApply: errors.length === 0,
    limits: {
      maxRows: TREE_API_LIMITS.maxCsvRows,
      maxBytes: TREE_API_LIMITS.maxCsvBytes,
    },
  };
};

export const importTreesCsv = (
  csvText,
  { idempotencyKey = null, reason = 'Bulk tree register import' } = {},
  { storage = getTreeStorage(), nowMs = Date.now() } = {}
) => {
  const role = assertTreeCapability('inventory.import');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const key = normalizeIdempotencyKey(idempotencyKey);
  const payload = { csvText, reason };
  const replayed = checkIdempotency(storage, actor, key, 'import_trees', payload);
  if (replayed) return replayed;

  const preview = previewTreeImport(csvText, { storage, nowMs });
  if (!preview.canApply) {
    throw createTreeError(TREE_ERROR_CODES.IMPORT_INVALID, 'The CSV has validation errors; nothing was imported.', {
      details: { errors: preview.errors.slice(0, 50), preview },
    });
  }
  const reasonClean = requireString(reason, 'reason', { min: 10, max: TREE_API_LIMITS.maxReasonLength });

  // Re-parse inside the transaction so concurrent edits to species/sites are seen.
  const rows = parseCsv(csvText);
  const header = rows[0].map(normalizeHeader);
  const headerMap = Object.fromEntries(header.map((name, index) => [name, index]));
  if (headerMap.lat !== undefined && headerMap.latitude === undefined) headerMap.latitude = headerMap.lat;
  if (headerMap.lng !== undefined && headerMap.longitude === undefined) headerMap.longitude = headerMap.lng;

  const result = runTreeTransaction(
    storage,
    [
      TREE_STORAGE_KEYS.trees,
      TREE_STORAGE_KEYS.plantingSites,
      TREE_STORAGE_KEYS.audit,
      TREE_STORAGE_KEYS.idempotency,
    ],
    (draft, context) => {
      const now = context.now;
      const trees = draft.get(TREE_STORAGE_KEYS.trees) || [];
      const sites = draft.get(TREE_STORAGE_KEYS.plantingSites) || [];
      const created = [];
      const occupiedSiteIds = new Set();
      rows.slice(1).forEach((row, index) => {
        const validated = validateCsvRow(row, index, headerMap, storage, nowMs);
        if (validated.errors.length > 0) {
          throw createTreeError(TREE_ERROR_CODES.IMPORT_INVALID, `Row ${validated.rowNumber} changed after preview.`, {
            details: { errors: validated.errors },
          });
        }
        const parsed = validated.parsed;
        const jurisdictionId = actor.jurisdictions[0] || 'blr';
        if (parsed.plantingSite && parsed.plantingSite.jurisdictionId !== jurisdictionId) {
          throw createTreeError(TREE_ERROR_CODES.JURISDICTION_FORBIDDEN, `Row ${validated.rowNumber}: planting site is outside your jurisdiction.`);
        }
        const tree = {
          id: newTreeId('tree'),
          publicId: parsed.publicId || treePublicCode(trees.concat(created), jurisdictionId),
          jurisdictionId,
          ward: parsed.ward,
          locality: parsed.locality,
          speciesId: parsed.speciesId,
          plantingSiteId: parsed.plantingSiteId,
          condition: parsed.condition,
          status: TREE_STATUS.ACTIVE,
          plantedOn: parsed.plantedOn,
          lastInspectionAt: null,
          inspectionDueAt: computeInspectionDueAt(parsed.plantedOn, parsed.species, nowMs),
          approxCoordinates: parsed.approxCoordinates,
          privateCoordinates: null,
          privateNotes: parsed.notes,
          risk: { level: RISK_LEVELS.NONE, state: RISK_DESIGNATION_STATES.NONE, reason: '' },
          isPubliclyListed: true,
          conditionHistory: [],
          importId: hashString(`${now}|${csvText.length}`),
          createdBy: actor.id,
          createdAt: now,
          updatedAt: now,
          schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
        };
        if (trees.concat(created).some((item) => item.publicId === tree.publicId)) {
          throw createTreeError(TREE_ERROR_CODES.IMPORT_INVALID, `Row ${validated.rowNumber}: public id already exists.`);
        }
        created.push(tree);
        if (parsed.plantingSiteId) occupiedSiteIds.add(parsed.plantingSiteId);
      });

      draft.set(TREE_STORAGE_KEYS.trees, trees.concat(created));
      if (occupiedSiteIds.size > 0) {
        draft.set(
          TREE_STORAGE_KEYS.plantingSites,
          sites.map((site) =>
            occupiedSiteIds.has(site.id) ? { ...site, state: PLANTING_SITE_STATES.OCCUPIED, updatedAt: now } : site
          )
        );
      }
      const importId = hashString(`${now}|${created.map((tree) => tree.publicId).join(',')}`);
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.IMPORT_APPLIED,
        entityType: 'TreeAsset',
        entityId: importId,
        actor,
        jurisdictionId: actor.jurisdictions[0] || null,
        reason: reasonClean,
        details: {
          importId,
          rowCount: created.length,
          publicIds: created.slice(0, 50).map((tree) => tree.publicId),
          fileChecksum: hashString(csvText),
        },
        createdAt: now,
      });
      const response = {
        imported: created.length,
        importId,
        publicIds: created.map((tree) => tree.publicId),
        replayed: false,
      };
      saveIdempotency(draft, actor, key, 'import_trees', payload, response);
      return response;
    }
  );
  return { ...result, role, preview };
};

export const getTreeAuditTrail = (filters = {}, storage = getTreeStorage()) => {
  assertTreeCapability('audit.read');
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const limit = Math.max(1, Math.min(500, Number(filters.limit) || 100));
  let events = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.audit), scoped)
    .filter((event) => (filters.entityId ? event.entityId === filters.entityId : true))
    .filter((event) => (filters.action ? event.action === filters.action : true))
    .filter((event) => (filters.jurisdictionId ? event.jurisdictionId === filters.jurisdictionId : true));
  const chainVerification = verifyTreeAuditChain(readCollection(storage, TREE_STORAGE_KEYS.audit));
  events = events.slice(-limit).reverse();
  return {
    events: events.map((event) => ({
      ...event,
      hasChanges: Boolean(event.changes && Object.keys(event.changes).length > 0),
    })),
    total: events.length,
    limit,
    chainValid: chainVerification.valid,
    chainVerification,
    note: 'Audit events are append-only and hash-chained. This view never edits or deletes an event.',
    generatedAt: nowIso(),
  };
};

export const runTreeInventoryMigration = ({ storage = getTreeStorage(), nowMs = Date.now() } = {}) => {
  const role = assertTreeCapability('inventory.migrate');
  const actor = currentIdentity();
  const result = migrateTreeInventory({ storage, nowMs });
  if (result.changed) {
    runTreeTransaction(storage, [TREE_STORAGE_KEYS.audit], (draft, context) => {
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.MIGRATION_RUN,
        entityType: 'TreeInventorySchema',
        entityId: result.toVersion,
        actor,
        reason: 'Schema migration applied',
        details: { fromVersion: result.fromVersion, toVersion: result.toVersion, preview: result.preview || null },
        createdAt: context.now,
      });
    });
  }
  return { ...result, role, status: getTreeInventoryMigrationStatus(storage) };
};

export const rollbackTreeInventory = ({ storage = getTreeStorage(), nowMs = Date.now() } = {}) => {
  const role = assertTreeCapability('inventory.migrate');
  const actor = currentIdentity();
  const result = rollbackTreeInventoryMigration({ storage, nowMs });
  runTreeTransaction(storage, [TREE_STORAGE_KEYS.audit], (draft, context) => {
    appendAuditEvent(draft, {
      action: AUDIT_ACTIONS.MIGRATION_ROLLED_BACK,
      entityType: 'TreeInventorySchema',
      entityId: String(result.restoredVersion),
      actor,
      reason: 'Schema migration rolled back',
      details: result,
      createdAt: context.now,
    });
  });
  return { ...result, role, status: getTreeInventoryMigrationStatus(storage) };
};

export const applyTreeRetentionPolicy = ({ storage = getTreeStorage(), nowMs = Date.now(), dryRun = false } = {}) => {
  const role = assertTreeCapability('retention.manage');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const retentionDays = 365;
  const cutoff = nowMs - retentionDays * 24 * 60 * 60 * 1000;
  const reports = readCollection(storage, TREE_STORAGE_KEYS.citizenReports);
  const eligible = reports.filter(
    (report) =>
      [CITIZEN_REPORT_STATES.ACCEPTED, CITIZEN_REPORT_STATES.REJECTED, CITIZEN_REPORT_STATES.DUPLICATE].includes(report.state) &&
      !report.retentionArchivedAt &&
      Date.parse(report.reviewedAt || report.updatedAt || report.createdAt || 0) < cutoff
  );
  if (dryRun) {
    return {
      dryRun: true,
      archivedReports: eligible.length,
      removedAttachments: eligible.reduce((count, report) => count + (report.attachments?.length || 0), 0),
      retentionDays,
      cutoff: new Date(cutoff).toISOString(),
    };
  }

  const result = runTreeTransaction(
    storage,
    [TREE_STORAGE_KEYS.citizenReports, TREE_STORAGE_KEYS.reportAttachments, TREE_STORAGE_KEYS.audit],
    (draft, context) => {
      const now = context.now;
      const ids = new Set(eligible.map((report) => report.id));
      if (ids.size === 0) return { archivedReports: 0, removedAttachments: 0 };
      const currentReports = draft.get(TREE_STORAGE_KEYS.citizenReports) || [];
      const attachments = draft.get(TREE_STORAGE_KEYS.reportAttachments) || [];
      const removedAttachments = attachments.filter((attachment) => ids.has(attachment.entityId)).length;
      draft.set(
        TREE_STORAGE_KEYS.citizenReports,
        currentReports.map((report) =>
          ids.has(report.id)
            ? {
                ...report,
                description: '[Archived after the 365-day public retention period]',
                attachments: [],
                reporterKey: null,
                reporterLabel: 'Retention policy applied',
                retentionArchivedAt: now,
                updatedAt: now,
              }
            : report
        )
      );
      draft.set(
        TREE_STORAGE_KEYS.reportAttachments,
        attachments.filter((attachment) => !ids.has(attachment.entityId))
      );
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.RETENTION_APPLIED,
        entityType: 'CitizenReport',
        entityId: 'retention-policy',
        actor,
        reason: '365-day public report retention policy applied',
        details: { archivedReports: ids.size, removedAttachments, retentionDays },
        createdAt: now,
      });
      return { archivedReports: ids.size, removedAttachments };
    }
  );
  return { ...result, role, retentionDays, cutoff: new Date(cutoff).toISOString() };
};

export const listTreeInspections = (filters = {}, storage = getTreeStorage()) => {
  assertTreeCapability('tree.staff.read');
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const trees = readCollection(storage, TREE_STORAGE_KEYS.trees);
  const speciesById = Object.fromEntries(readCollection(storage, TREE_STORAGE_KEYS.species).map((s) => [s.id, s]));
  const treeById = Object.fromEntries(trees.map((tree) => [tree.id, tree]));
  let inspections = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.inspections), scoped)
    .filter((inspection) => (filters.treeId ? inspection.treeId === filters.treeId : true))
    .filter((inspection) => (filters.state ? inspection.state === filters.state : true))
    .filter((inspection) => (filters.type ? inspection.type === filters.type : true))
    .filter((inspection) => (filters.ward ? treeById[inspection.treeId]?.ward === filters.ward : true));

  inspections = inspections.sort((a, b) => {
    const aDate = Date.parse(a.performedAt || a.scheduledFor || a.createdAt || 0);
    const bDate = Date.parse(b.performedAt || b.scheduledFor || b.createdAt || 0);
    return bDate - aDate;
  });

  const paged = paginate(inspections, { page: filters.page, pageSize: filters.pageSize });
  return {
    ...paged,
    items: paged.items.map((inspection) => {
      const tree = treeById[inspection.treeId];
      return {
        ...staffInspectionView(inspection),
        treePublicId: tree?.publicId || null,
        ward: tree?.ward || null,
        species: speciesById[tree?.speciesId]?.commonName || null,
      };
    }),
    generatedAt: nowIso(),
  };
};

export const scheduleTreeInspection = (
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null, nowMs = Date.now() } = {}
) => {
  const role = assertTreeCapability('inspection.schedule');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'schedule_inspection', input);
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [TREE_STORAGE_KEYS.inspections, TREE_STORAGE_KEYS.trees, TREE_STORAGE_KEYS.audit, TREE_STORAGE_KEYS.idempotency],
    (draft, context) => {
      const now = context.now;
      const tree = requireTree(draft, input.treeId, scoped);
      assertTreeJurisdiction(getCurrentActor(), tree.jurisdictionId);
      if ([TREE_STATUS.REMOVED, TREE_STATUS.ARCHIVED].includes(tree.status)) {
        throw createTreeError(TREE_ERROR_CODES.INVALID_TRANSITION, 'A removed or archived tree cannot receive a new inspection.');
      }
      const type = requireEnum(input.type || INSPECTION_TYPES.ROUTINE, INSPECTION_TYPES, 'type');
      const scheduledFor = requireIsoDate(input.scheduledFor, 'scheduledFor', { nowMs });
      const assignedTo = optionalString(input.assignedTo, 'assignedTo', { max: 120 });
      const notes = optionalString(input.notes, 'notes', { max: TREE_API_LIMITS.maxNotesLength, multiline: true });
      const inspections = draft.get(TREE_STORAGE_KEYS.inspections) || [];
      const inspection = {
        id: newTreeId('insp'),
        publicId: inspectionPublicCode(inspections, tree.jurisdictionId),
        jurisdictionId: tree.jurisdictionId,
        treeId: tree.id,
        type,
        state: INSPECTION_STATES.SCHEDULED,
        scheduledFor,
        performedAt: null,
        assignedTo,
        inspectorName: '',
        conditionAtInspection: null,
        findings: '',
        notes,
        evidence: [],
        triageSuggestionId: null,
        verifiedBy: null,
        verifiedAt: null,
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now,
        schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
      };
      inspections.push(inspection);
      draft.set(TREE_STORAGE_KEYS.inspections, inspections);
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.INSPECTION_SCHEDULED,
        entityType: 'TreeInspection',
        entityId: inspection.id,
        actor,
        jurisdictionId: tree.jurisdictionId,
        reason: input.reason || 'Inspection scheduled',
        details: { treePublicId: tree.publicId, scheduledFor, type },
        createdAt: now,
      });
      const response = {
        inspection: staffInspectionView(inspection),
        treePublicId: tree.publicId,
      };
      saveIdempotency(draft, actor, key, 'schedule_inspection', input, response);
      return response;
    }
  );
  return { ...result, role };
};

export const transitionTreeInspection = (
  inspectionId,
  nextState,
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null } = {}
) => {
  const role = assertTreeCapability('inspection.schedule');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const target = requireEnum(nextState, INSPECTION_STATES, 'nextState');
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'inspection_state', { inspectionId, nextState, input });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [TREE_STORAGE_KEYS.inspections, TREE_STORAGE_KEYS.audit, TREE_STORAGE_KEYS.idempotency],
    (draft, context) => {
      const now = context.now;
      const inspection = requireInspection(draft, inspectionId, scoped);
      assertTreeJurisdiction(getCurrentActor(), inspection.jurisdictionId);
      assertTransition('inspection', inspection.state, target);
      if (target !== INSPECTION_STATES.CANCELLED && target !== INSPECTION_STATES.MISSED && target !== INSPECTION_STATES.IN_PROGRESS) {
        throw createTreeError(TREE_ERROR_CODES.INVALID_TRANSITION, 'Use the completion or verification action for this state.');
      }
      const reason = requireString(input.reason, 'reason', { min: 5, max: TREE_API_LIMITS.maxReasonLength });
      const updated = {
        ...inspection,
        state: target,
        cancelledReason: target === INSPECTION_STATES.CANCELLED ? reason : inspection.cancelledReason || null,
        missedReason: target === INSPECTION_STATES.MISSED ? reason : inspection.missedReason || null,
        startedAt: target === INSPECTION_STATES.IN_PROGRESS ? now : inspection.startedAt || null,
        updatedAt: now,
      };
      draft.set(
        TREE_STORAGE_KEYS.inspections,
        (draft.get(TREE_STORAGE_KEYS.inspections) || []).map((item) => (item.id === inspection.id ? updated : item))
      );
      appendAuditEvent(draft, {
        action: 'inspection.state_changed',
        entityType: 'TreeInspection',
        entityId: inspection.id,
        actor,
        jurisdictionId: inspection.jurisdictionId,
        reason,
        changes: { state: { before: inspection.state, after: target } },
        createdAt: now,
      });
      const response = { inspection: staffInspectionView(updated) };
      saveIdempotency(draft, actor, key, 'inspection_state', { inspectionId, nextState, input }, response);
      return response;
    }
  );
  return { ...result, role };
};

export const completeTreeInspection = (
  inspectionId,
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null, nowMs = Date.now() } = {}
) => {
  const role = assertTreeCapability('inspection.complete');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'complete_inspection', { inspectionId, input });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [
      TREE_STORAGE_KEYS.inspections,
      TREE_STORAGE_KEYS.trees,
      TREE_STORAGE_KEYS.reportAttachments,
      TREE_STORAGE_KEYS.triage,
      TREE_STORAGE_KEYS.audit,
      TREE_STORAGE_KEYS.idempotency,
    ],
    (draft, context) => {
      const now = context.now;
      const inspection = requireInspection(draft, inspectionId, scoped);
      assertTreeJurisdiction(getCurrentActor(), inspection.jurisdictionId);
      if (![INSPECTION_STATES.SCHEDULED, INSPECTION_STATES.IN_PROGRESS].includes(inspection.state)) {
        throw createTreeError(TREE_ERROR_CODES.INVALID_TRANSITION, 'Only a scheduled or in-progress inspection can be completed.');
      }
      const findings = requireString(input.findings, 'findings', {
        min: 10,
        max: TREE_API_LIMITS.maxNotesLength,
        multiline: true,
      });
      const condition = requireEnum(input.conditionAtInspection || input.condition, TREE_CONDITIONS, 'conditionAtInspection');
      const performedAt = input.performedAt
        ? requireIsoDate(input.performedAt, 'performedAt', { notFuture: true, nowMs })
        : now;
      if (Date.parse(performedAt) < Date.parse(inspection.scheduledFor) - 24 * 60 * 60 * 1000) {
        // Completing an inspection before it was scheduled is possible only as
        // a documented early visit; keep the audit honest about it.
        if (!input.earlyVisitReason) {
          throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'A reason is required for an inspection completed before its scheduled date.', {
            fieldErrors: { earlyVisitReason: 'Explain why the visit happened early.' },
          });
        }
      }
      const attachmentIds = storeAttachments(draft, {
        entityType: 'TreeInspection',
        entityId: inspection.id,
        attachments: input.evidence || [],
        actor,
        jurisdictionId: inspection.jurisdictionId,
      });
      let triageSuggestionId = null;
      if (input.triageSuggestionId) {
        const suggestions = draft.get(TREE_STORAGE_KEYS.triage) || [];
        const suggestion = suggestions.find((item) => item.id === input.triageSuggestionId);
        if (!suggestion || suggestion.treeId !== inspection.treeId) {
          throw createTreeError(TREE_ERROR_CODES.REFERENCE_NOT_FOUND, 'Triage suggestion does not belong to this tree.');
        }
        triageSuggestionId = suggestion.id;
      }
      const trees = draft.get(TREE_STORAGE_KEYS.trees) || [];
      const tree = trees.find((item) => item.id === inspection.treeId);
      if (!tree) throw createTreeError(TREE_ERROR_CODES.REFERENCE_NOT_FOUND, 'Linked tree no longer exists.');
      const species = speciesFor(storage, tree.speciesId);
      const conditionChanged = tree.condition !== condition;
      const treeUpdated = {
        ...tree,
        condition,
        conditionHistory: conditionChanged
          ? [
              ...(Array.isArray(tree.conditionHistory) ? tree.conditionHistory : []),
              {
                from: tree.condition,
                to: condition,
                changedBy: actor.id,
                changedAt: now,
                reason: 'Condition recorded during inspection',
                inspectionId: inspection.id,
              },
            ]
          : tree.conditionHistory || [],
        lastInspectionAt: performedAt,
        inspectionDueAt: computeInspectionDueAt(tree.plantedOn || now, species, Date.parse(performedAt)),
        status: condition === TREE_CONDITIONS.CRITICAL && tree.status === TREE_STATUS.ACTIVE ? TREE_STATUS.PENDING_REVIEW : tree.status,
        updatedAt: now,
      };
      draft.set(
        TREE_STORAGE_KEYS.trees,
        trees.map((item) => (item.id === tree.id ? treeUpdated : item))
      );
      const updatedInspection = {
        ...inspection,
        state: INSPECTION_STATES.COMPLETED,
        performedAt,
        inspectorName: actor.label,
        inspectorId: actor.id,
        findings,
        conditionAtInspection: condition,
        evidence: attachmentIds,
        triageSuggestionId,
        earlyVisitReason: input.earlyVisitReason || null,
        updatedAt: now,
      };
      draft.set(
        TREE_STORAGE_KEYS.inspections,
        (draft.get(TREE_STORAGE_KEYS.inspections) || []).map((item) => (item.id === inspection.id ? updatedInspection : item))
      );

      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.INSPECTION_COMPLETED,
        entityType: 'TreeInspection',
        entityId: inspection.id,
        actor,
        jurisdictionId: inspection.jurisdictionId,
        reason: input.reason || 'Inspection findings recorded',
        changes: {
          state: { before: inspection.state, after: INSPECTION_STATES.COMPLETED },
          condition: { before: tree.condition, after: condition },
        },
        details: { treePublicId: tree.publicId, evidenceCount: attachmentIds.length, triageSuggestionId },
        createdAt: now,
      });

      const response = {
        inspection: staffInspectionView(updatedInspection),
        tree: staffTreeView(treeUpdated, species, storage, nowMs),
        evidenceAttachments: resolveAttachments(draft, attachmentIds),
      };
      saveIdempotency(draft, actor, key, 'complete_inspection', { inspectionId, input }, response);
      return response;
    }
  );
  return { ...result, role };
};

export const verifyTreeInspection = (
  inspectionId,
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null } = {}
) => {
  const role = assertTreeCapability('inspection.verify');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'verify_inspection', { inspectionId, input });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [TREE_STORAGE_KEYS.inspections, TREE_STORAGE_KEYS.audit, TREE_STORAGE_KEYS.idempotency],
    (draft, context) => {
      const now = context.now;
      const inspection = requireInspection(draft, inspectionId, scoped);
      assertTreeJurisdiction(getCurrentActor(), inspection.jurisdictionId);
      assertTransition('inspection', inspection.state, INSPECTION_STATES.VERIFIED);
      const reason = requireString(input.reason, 'reason', { min: 5, max: TREE_API_LIMITS.maxReasonLength });
      const updated = {
        ...inspection,
        state: INSPECTION_STATES.VERIFIED,
        verifiedBy: actor.id,
        verifiedAt: now,
        updatedAt: now,
      };
      draft.set(
        TREE_STORAGE_KEYS.inspections,
        (draft.get(TREE_STORAGE_KEYS.inspections) || []).map((item) => (item.id === inspection.id ? updated : item))
      );
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.INSPECTION_VERIFIED,
        entityType: 'TreeInspection',
        entityId: inspection.id,
        actor,
        jurisdictionId: inspection.jurisdictionId,
        reason,
        changes: { state: { before: inspection.state, after: INSPECTION_STATES.VERIFIED } },
        createdAt: now,
      });
      const response = { inspection: staffInspectionView(updated) };
      saveIdempotency(draft, actor, key, 'verify_inspection', { inspectionId, input }, response);
      return response;
    }
  );
  return { ...result, role };
};

export const createMaintenanceOrder = (
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null, nowMs = Date.now() } = {}
) => {
  const role = assertTreeCapability('order.manage');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'create_order', input);
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [
      TREE_STORAGE_KEYS.workOrders,
      TREE_STORAGE_KEYS.trees,
      TREE_STORAGE_KEYS.inspections,
      TREE_STORAGE_KEYS.audit,
      TREE_STORAGE_KEYS.idempotency,
    ],
    (draft, context) => {
      const now = context.now;
      const tree = requireTree(draft, input.treeId, scoped);
      assertTreeJurisdiction(getCurrentActor(), tree.jurisdictionId);
      const type = requireEnum(input.type, WORK_ORDER_TYPES, 'type');
      if (type === WORK_ORDER_TYPES.REMOVE && tree.status !== TREE_STATUS.REMOVAL_APPROVED) {
        throw createTreeError(
          TREE_ERROR_CODES.EXPERT_CONFIRMATION_REQUIRED,
          'A removal order can only be created after a reviewer-confirmed risk and an approved removal status.'
        );
      }
      const priority = requireEnum(input.priority || WORK_ORDER_PRIORITIES.MEDIUM, WORK_ORDER_PRIORITIES, 'priority');
      const dueAt = optionalIsoDate(input.dueAt, 'dueAt', { nowMs });
      const assignedTo = optionalString(input.assignedTo, 'assignedTo', { max: 120 });
      const instructions = optionalString(input.instructions, 'instructions', {
        max: TREE_API_LIMITS.maxNotesLength,
        multiline: true,
      });
      let inspectionId = null;
      if (input.inspectionId) {
        const inspection = requireInspection(draft, input.inspectionId, scoped);
        if (inspection.treeId !== tree.id) {
          throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Inspection does not belong to this tree.');
        }
        inspectionId = inspection.id;
      }
      const orders = draft.get(TREE_STORAGE_KEYS.workOrders) || [];
      const order = {
        id: newTreeId('wo'),
        publicId: orderPublicCode(orders, tree.jurisdictionId),
        jurisdictionId: tree.jurisdictionId,
        treeId: tree.id,
        inspectionId,
        type,
        priority,
        state: assignedTo ? WORK_ORDER_STATES.ASSIGNED : WORK_ORDER_STATES.DRAFT,
        assignedTo,
        assignedBy: assignedTo ? actor.id : null,
        assignedAt: assignedTo ? now : null,
        dueAt,
        instructions,
        completedAt: null,
        verifiedAt: null,
        verifiedBy: null,
        evidence: [],
        closureNotes: '',
        cancelledReason: null,
        createdAt: now,
        updatedAt: now,
        createdBy: actor.id,
        schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
      };
      orders.push(order);
      draft.set(TREE_STORAGE_KEYS.workOrders, orders);
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.WORK_ORDER_CREATED,
        entityType: 'MaintenanceOrder',
        entityId: order.id,
        actor,
        jurisdictionId: tree.jurisdictionId,
        reason: input.reason || 'Maintenance order created',
        details: { treePublicId: tree.publicId, type, priority, assignedTo },
        createdAt: now,
      });
      const response = { order: staffOrderView(order), treePublicId: tree.publicId };
      saveIdempotency(draft, actor, key, 'create_order', input, response);
      return response;
    }
  );
  return { ...result, role };
};

export const updateMaintenanceOrder = (
  orderId,
  updates = {},
  { storage = getTreeStorage(), idempotencyKey = null, nowMs = Date.now() } = {}
) => {
  const role = assertTreeCapability('order.manage');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'update_order', { orderId, updates });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [TREE_STORAGE_KEYS.workOrders, TREE_STORAGE_KEYS.audit, TREE_STORAGE_KEYS.idempotency],
    (draft, context) => {
      const now = context.now;
      const order = requireOrder(draft, orderId, scoped);
      assertTreeJurisdiction(getCurrentActor(), order.jurisdictionId);
      if ([WORK_ORDER_STATES.VERIFIED, WORK_ORDER_STATES.CANCELLED].includes(order.state)) {
        throw createTreeError(TREE_ERROR_CODES.INVALID_TRANSITION, 'A closed order cannot be edited.');
      }
      const before = cloneJson(order);
      const updated = {
        ...order,
        assignedTo: updates.assignedTo !== undefined ? optionalString(updates.assignedTo, 'assignedTo', { max: 120 }) : order.assignedTo,
        priority: updates.priority !== undefined ? requireEnum(updates.priority, WORK_ORDER_PRIORITIES, 'priority') : order.priority,
        dueAt: updates.dueAt !== undefined ? optionalIsoDate(updates.dueAt, 'dueAt', { nowMs }) : order.dueAt,
        instructions:
          updates.instructions !== undefined
            ? optionalString(updates.instructions, 'instructions', { max: TREE_API_LIMITS.maxNotesLength, multiline: true })
            : order.instructions,
        updatedAt: now,
        state:
          order.state === WORK_ORDER_STATES.DRAFT && updates.assignedTo
            ? WORK_ORDER_STATES.ASSIGNED
            : order.state,
      };
      draft.set(
        TREE_STORAGE_KEYS.workOrders,
        (draft.get(TREE_STORAGE_KEYS.workOrders) || []).map((item) => (item.id === order.id ? updated : item))
      );
      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.WORK_ORDER_UPDATED,
        entityType: 'MaintenanceOrder',
        entityId: order.id,
        actor,
        jurisdictionId: order.jurisdictionId,
        reason: updates.reason || 'Maintenance order updated',
        changes: changeSummary(before, updated, ['assignedTo', 'priority', 'dueAt', 'instructions', 'state']),
        createdAt: now,
      });
      const response = { order: staffOrderView(updated) };
      saveIdempotency(draft, actor, key, 'update_order', { orderId, updates }, response);
      return response;
    }
  );
  return { ...result, role };
};

export const transitionMaintenanceOrder = (
  orderId,
  nextState,
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null } = {}
) => {
  const target = requireEnum(nextState, WORK_ORDER_STATES, 'nextState');
  const capability = target === WORK_ORDER_STATES.VERIFIED ? 'order.close' : 'order.manage';
  const role = assertTreeCapability(capability);
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'order_state', { orderId, nextState, input });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [
      TREE_STORAGE_KEYS.workOrders,
      TREE_STORAGE_KEYS.trees,
      TREE_STORAGE_KEYS.pruningEvents,
      TREE_STORAGE_KEYS.reportAttachments,
      TREE_STORAGE_KEYS.audit,
      TREE_STORAGE_KEYS.idempotency,
    ],
    (draft, context) => {
      const now = context.now;
      const order = requireOrder(draft, orderId, scoped);
      assertTreeJurisdiction(getCurrentActor(), order.jurisdictionId);
      assertTransition('workOrder', order.state, target);
      const reason = requireString(input.reason, 'reason', { min: 5, max: TREE_API_LIMITS.maxReasonLength });
      const before = cloneJson(order);
      let evidenceIds = Array.isArray(order.evidence) ? [...order.evidence] : [];
      let closureNotes = order.closureNotes || '';

      if (target === WORK_ORDER_STATES.ASSIGNED && !input.assignedTo && !order.assignedTo) {
        throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Choose a crew or officer before assigning the order.', {
          fieldErrors: { assignedTo: 'Assignment is required.' },
        });
      }
      if (target === WORK_ORDER_STATES.COMPLETED || target === WORK_ORDER_STATES.VERIFIED) {
        closureNotes = requireString(input.closureNotes || order.closureNotes, 'closureNotes', {
          min: 10,
          max: TREE_API_LIMITS.maxNotesLength,
          multiline: true,
        });
        const newEvidenceIds = storeAttachments(draft, {
          entityType: 'MaintenanceOrder',
          entityId: order.id,
          attachments: input.evidence || [],
          actor,
          jurisdictionId: order.jurisdictionId,
        });
        evidenceIds = [...evidenceIds, ...newEvidenceIds];
        if (evidenceIds.length === 0) {
          throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Attach at least one completion photo before closing the order.', {
            fieldErrors: { evidence: 'Completion evidence is required.' },
          });
        }
      }

      const updated = {
        ...order,
        state: target,
        assignedTo:
          target === WORK_ORDER_STATES.ASSIGNED && input.assignedTo
            ? optionalString(input.assignedTo, 'assignedTo', { max: 120 })
            : order.assignedTo,
        assignedAt: target === WORK_ORDER_STATES.ASSIGNED ? now : order.assignedAt,
        assignedBy: target === WORK_ORDER_STATES.ASSIGNED ? actor.id : order.assignedBy,
        completedAt: target === WORK_ORDER_STATES.COMPLETED ? now : order.completedAt,
        verifiedAt: target === WORK_ORDER_STATES.VERIFIED ? now : order.verifiedAt,
        verifiedBy: target === WORK_ORDER_STATES.VERIFIED ? actor.id : order.verifiedBy,
        closureNotes,
        evidence: [...new Set(evidenceIds)],
        cancelledReason: target === WORK_ORDER_STATES.CANCELLED ? reason : order.cancelledReason || null,
        updatedAt: now,
      };
      draft.set(
        TREE_STORAGE_KEYS.workOrders,
        (draft.get(TREE_STORAGE_KEYS.workOrders) || []).map((item) => (item.id === order.id ? updated : item))
      );

      if (target === WORK_ORDER_STATES.VERIFIED && updated.type === WORK_ORDER_TYPES.PRUNE) {
        const pruningEvents = draft.get(TREE_STORAGE_KEYS.pruningEvents) || [];
        pruningEvents.push({
          id: newTreeId('prune'),
          treeId: order.treeId,
          orderId: order.id,
          jurisdictionId: order.jurisdictionId,
          performedAt: updated.completedAt || now,
          verifiedAt: now,
          method: optionalString(input.pruningMethod, 'pruningMethod', { max: 160 }) || 'Structural pruning as specified in the order',
          approvedBy: actor.id,
          evidence: [...new Set(evidenceIds)],
          notes: closureNotes,
          createdAt: now,
          schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
        });
        draft.set(TREE_STORAGE_KEYS.pruningEvents, pruningEvents);
      }

      appendAuditEvent(draft, {
        action: target === WORK_ORDER_STATES.VERIFIED ? AUDIT_ACTIONS.WORK_ORDER_CLOSED : AUDIT_ACTIONS.WORK_ORDER_UPDATED,
        entityType: 'MaintenanceOrder',
        entityId: order.id,
        actor,
        jurisdictionId: order.jurisdictionId,
        reason,
        changes: changeSummary(before, updated, ['state', 'assignedTo', 'completedAt', 'verifiedAt', 'closureNotes', 'evidence']),
        details: { treeId: order.treeId, evidenceCount: updated.evidence.length },
        createdAt: now,
      });

      const response = {
        order: staffOrderView(updated),
        evidenceAttachments: resolveAttachments(draft, updated.evidence),
      };
      saveIdempotency(draft, actor, key, 'order_state', { orderId, nextState, input }, response);
      return response;
    }
  );
  return { ...result, role };
};

export const listMaintenanceOrders = (filters = {}, storage = getTreeStorage()) => {
  assertTreeCapability('tree.staff.read');
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const trees = readCollection(storage, TREE_STORAGE_KEYS.trees);
  const treeById = Object.fromEntries(trees.map((tree) => [tree.id, tree]));
  const search = normalizeSearch(filters.search || '');
  let orders = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.workOrders), scoped)
    .filter((order) => (filters.state ? order.state === filters.state : true))
    .filter((order) => (filters.type ? order.type === filters.type : true))
    .filter((order) => (filters.priority ? order.priority === filters.priority : true))
    .filter((order) => (filters.treeId ? order.treeId === filters.treeId : true))
    .filter((order) => (filters.ward ? treeById[order.treeId]?.ward === filters.ward : true));

  if (search) {
    orders = orders.filter((order) =>
      [order.publicId, order.assignedTo, order.instructions, treeById[order.treeId]?.publicId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search)
    );
  }

  orders = orders.sort((a, b) => {
    const aDate = Date.parse(a.dueAt || a.createdAt || 0);
    const bDate = Date.parse(b.dueAt || b.createdAt || 0);
    return aDate - bDate;
  });
  const paged = paginate(orders, { page: filters.page, pageSize: filters.pageSize });
  return {
    ...paged,
    items: paged.items.map((order) => ({
      ...staffOrderView(order),
      treePublicId: treeById[order.treeId]?.publicId || null,
      ward: treeById[order.treeId]?.ward || null,
      isOverdue: order.dueAt && Date.parse(order.dueAt) < Date.now() && ![WORK_ORDER_STATES.VERIFIED, WORK_ORDER_STATES.CANCELLED].includes(order.state),
    })),
    generatedAt: nowIso(),
  };
};

export const recordTreeTriageSuggestion = (
  input = {},
  { storage = getTreeStorage(), nowMs = Date.now(), externalAdapter = undefined } = {}
) => {
  const role = assertTreeCapability('inspection.complete');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const tree = requireTree({ get: (key) => readCollection(storage, key) }, input.treeId, scoped);
  assertTreeJurisdiction(getCurrentActor(), tree.jurisdictionId);
  if (input.inspectionId) {
    const inspection = requireInspection({ get: (key) => readCollection(storage, key) }, input.inspectionId, scoped);
    if (inspection.treeId !== tree.id) {
      throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, 'Inspection does not belong to this tree.');
    }
  }

  const suggestion = analyzeTreeImage(
    {
      image: input.image,
      symptomTags: input.symptomTags,
      speciesId: tree.speciesId,
    },
    { nowMs, externalAdapter }
  );

  const record = {
    id: newTreeId('triage'),
    triageId: suggestion.triageId,
    jurisdictionId: tree.jurisdictionId,
    treeId: tree.id,
    treePublicId: tree.publicId,
    inspectionId: input.inspectionId || null,
    suggestion: cloneJson(suggestion),
    decision: TRIAGE_DECISIONS.PENDING,
    reviewedBy: null,
    reviewedAt: null,
    reviewReason: '',
    appliedCondition: null,
    createdBy: actor.id,
    createdAt: nowIso(nowMs),
    updatedAt: nowIso(nowMs),
    schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
  };

  runTreeTransaction(storage, [TREE_STORAGE_KEYS.triage, TREE_STORAGE_KEYS.audit], (draft, context) => {
    const suggestions = draft.get(TREE_STORAGE_KEYS.triage) || [];
    suggestions.push(record);
    draft.set(TREE_STORAGE_KEYS.triage, suggestions);
    appendAuditEvent(draft, {
      action: 'triage.suggested',
      entityType: 'TriageSuggestion',
      entityId: record.id,
      actor,
      jurisdictionId: tree.jurisdictionId,
      reason: 'Image-assisted triage suggestion created (requires expert review)',
      details: toSafeTriageAudit(suggestion),
      createdAt: context.now,
    });
  });

  return { suggestion: cloneJson(record), role, expertConfirmationRequired: true };
};

export const listTreeTriageSuggestions = (filters = {}, storage = getTreeStorage()) => {
  assertTreeCapability('tree.staff.read');
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  let suggestions = scopeRecords(readCollection(storage, TREE_STORAGE_KEYS.triage), scoped)
    .filter((item) => (filters.decision ? item.decision === filters.decision : true))
    .filter((item) => (filters.treeId ? item.treeId === filters.treeId : true))
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  const paged = paginate(suggestions, { page: filters.page, pageSize: filters.pageSize });
  return {
    ...paged,
    items: paged.items.map((item) => ({
      ...item,
      decisionLabel: TRIAGE_DECISION_LABELS[item.decision] || item.decision,
      explanation: item.suggestion?.explanations || [],
    })),
    generatedAt: nowIso(),
  };
};

export const reviewTreeTriageSuggestion = (
  suggestionRecordId,
  input = {},
  { storage = getTreeStorage(), idempotencyKey = null, nowMs = Date.now() } = {}
) => {
  const role = assertTreeCapability('triage.review');
  const actor = currentIdentity();
  ensureTreeInventoryData({ storage });
  const scoped = getScopedJurisdictions();
  const key = normalizeIdempotencyKey(idempotencyKey);
  const replayed = checkIdempotency(storage, actor, key, 'review_triage', { suggestionRecordId, input });
  if (replayed) return replayed;

  const result = runTreeTransaction(
    storage,
    [TREE_STORAGE_KEYS.triage, TREE_STORAGE_KEYS.trees, TREE_STORAGE_KEYS.audit, TREE_STORAGE_KEYS.idempotency],
    (draft, context) => {
      const now = context.now;
      const suggestions = draft.get(TREE_STORAGE_KEYS.triage) || [];
      const record = suggestions.find((item) => item.id === suggestionRecordId);
      if (!record) throw createTreeError(TREE_ERROR_CODES.NOT_FOUND, 'Triage suggestion was not found.');
      if (scoped !== null && !scoped.includes(record.jurisdictionId)) {
        throw createTreeError(TREE_ERROR_CODES.JURISDICTION_FORBIDDEN);
      }
      if (record.decision !== TRIAGE_DECISIONS.PENDING) {
        throw createTreeError(TREE_ERROR_CODES.INVALID_TRANSITION, 'This suggestion has already been reviewed.');
      }
      const review = reviewTriageSuggestion(record.suggestion, {
        decision: input.decision,
        editedCondition: input.editedCondition,
        reason: input.reason,
        reviewerId: actor.id,
        nowMs,
      });
      const updatedRecord = {
        ...record,
        decision: review.decision,
        reviewedBy: review.reviewedBy,
        reviewedAt: review.reviewedAt,
        reviewReason: review.reason,
        appliedCondition: review.appliedCondition,
        updatedAt: now,
      };
      draft.set(
        TREE_STORAGE_KEYS.triage,
        suggestions.map((item) => (item.id === record.id ? updatedRecord : item))
      );

      let treeUpdated = null;
      if (review.appliedCondition) {
        const trees = draft.get(TREE_STORAGE_KEYS.trees) || [];
        const tree = trees.find((item) => item.id === record.treeId);
        if (tree) {
          treeUpdated = {
            ...tree,
            condition: review.appliedCondition,
            conditionHistory: [
              ...(Array.isArray(tree.conditionHistory) ? tree.conditionHistory : []),
              {
                from: tree.condition,
                to: review.appliedCondition,
                changedBy: actor.id,
                changedAt: now,
                reason: `Expert ${review.decision} image triage suggestion`,
                triageSuggestionId: record.id,
              },
            ],
            updatedAt: now,
          };
          // Deliberately does not touch tree.status, risk, pruning or removal.
          draft.set(
            TREE_STORAGE_KEYS.trees,
            trees.map((item) => (item.id === tree.id ? treeUpdated : item))
          );
        }
      }

      appendAuditEvent(draft, {
        action: AUDIT_ACTIONS.TRIAGE_SUGGESTION_REVIEWED,
        entityType: 'TriageSuggestion',
        entityId: record.id,
        actor,
        jurisdictionId: record.jurisdictionId,
        reason: review.reason || 'Suggestion accepted without change',
        changes: {
          decision: { before: record.decision, after: review.decision },
          condition: treeUpdated ? { before: record.suggestion.suggestedCondition, after: review.appliedCondition } : null,
        },
        details: {
          ...toSafeTriageAudit(record.suggestion),
          appliedCondition: review.appliedCondition,
          requiresExpertConfirmation: true,
          automaticRiskChange: false,
          automaticRemoval: false,
        },
        createdAt: now,
      });

      const response = {
        suggestion: {
          ...updatedRecord,
          decisionLabel: TRIAGE_DECISION_LABELS[updatedRecord.decision],
          explanation: updatedRecord.suggestion?.explanations || [],
        },
        tree: treeUpdated ? staffTreeView(treeUpdated, speciesFor(storage, treeUpdated.speciesId), storage, nowMs) : null,
        expertConfirmationRequired: true,
      };
      saveIdempotency(draft, actor, key, 'review_triage', { suggestionRecordId, input }, response);
      return response;
    }
  );
  return { ...result, role };
};
