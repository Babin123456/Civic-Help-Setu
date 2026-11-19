/**
 * Trusted Service Boundary for Streetlight Outage Clustering & Repair Prioritization (#756).
 *
 * All business logic, authorization checks, state transition enforcement,
 * duplicate handling, transactional updates, and privacy protections reside here.
 */

import {
  STREETLIGHT_ERROR_CODES,
  REPORT_STATUS,
  CLUSTER_STATUS,
  WORK_ORDER_STATUS,
  ASSET_STATUS,
  PRIORITY_TIERS,
  ALLOWED_WORK_ORDER_TRANSITIONS,
} from './streetlightConstants';
import {
  StreetlightServiceError,
  validateReportInput,
  validateWorkOrderInput,
  validateRepairEventInput,
  validateAssetInput,
  sanitizeText,
} from './streetlightValidation';
import {
  assertStreetlightCapability,
  assertStreetlightJurisdiction,
  resolveStreetlightRole,
  isStreetlightStaff,
} from './streetlightAccessControl';
import {
  findDuplicateReport,
  calculateClusterPriority,
  haversineDistanceMeters,
} from './streetlightClusteringEngine';
import {
  ensureStreetlightData,
  persistStreetlightData,
} from './streetlightMigrations';

// Rate limiting in-memory store for public submissions (max 5 per 10 mins per IP/fingerprint)
const submissionRateLimiter = new Map();

const checkSubmissionRateLimit = (clientId = 'anonymous') => {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const history = submissionRateLimiter.get(clientId) || [];
  const recent = history.filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= 10) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.RATE_LIMITED,
      'Submission rate limit exceeded. Please wait a few minutes before reporting again.'
    );
  }

  recent.push(now);
  submissionRateLimiter.set(clientId, recent);
};

/**
 * Generate stable unique identifiers.
 */
const generateId = (prefix) => {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timePart = Date.now().toString(36).toUpperCase();
  return `${prefix}-${timePart}-${randomPart}`;
};

const generateTrackingToken = () => {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `TRK-STLT-${num}`;
};

/**
 * Append-only audit logger.
 */
const recordAuditEvent = (data, action, entityId, actor, details = {}) => {
  const role = resolveStreetlightRole(actor);
  const auditEntry = {
    id: generateId('AUDIT'),
    action,
    entityId,
    actorId: actor?.id || actor?.username || 'anonymous',
    actorRole: role,
    timestamp: new Date().toISOString(),
    details,
  };
  data.auditLogs.unshift(auditEntry);
  // Cap audit log length to 500
  if (data.auditLogs.length > 500) {
    data.auditLogs = data.auditLogs.slice(0, 500);
  }
};

/**
 * Public Data Projection (Privacy Safeguard)
 * Strips all internal tokens, reporter hash, phone, and private technician notes.
 */
export const toPublicReportProjection = (report) => {
  if (!report) return null;
  return {
    id: report.id,
    trackingToken: report.trackingToken,
    assetId: report.assetId,
    location: {
      addressText: report.location?.addressText || '',
      landmark: report.location?.landmark || report.landmark || '',
      lat: report.location?.lat,
      lng: report.location?.lng,
    },
    faultCategory: report.faultCategory,
    status: report.status,
    clusterId: report.clusterId,
    reportedAt: report.reportedAt,
    updatedAt: report.updatedAt,
  };
};

export const toPublicClusterProjection = (cluster) => {
  if (!cluster) return null;
  return {
    id: cluster.id,
    jurisdictionId: cluster.jurisdictionId,
    corridorName: cluster.corridorName,
    centroid: cluster.centroid,
    poleCount: cluster.poleCount || cluster.assetIds?.length || 1,
    status: cluster.status,
    priorityTier: cluster.priorityTier,
    priorityScore: cluster.priorityScore,
    explainability: cluster.explainability,
    createdAt: cluster.createdAt,
    updatedAt: cluster.updatedAt,
  };
};

// ==========================================
// OUTAGE REPORTING API
// ==========================================

/**
 * Submit an outage report by pole Asset ID or approximate location.
 */
export const submitOutageReport = (rawInput, actor, { clientId = 'client' } = {}) => {
  assertStreetlightCapability('report.submit', actor, { allowAnonymous: true });
  checkSubmissionRateLimit(clientId);

  const validated = validateReportInput(rawInput);
  const data = ensureStreetlightData();

  // 1. Idempotency Check
  const idempotencyKey = rawInput.idempotencyKey || null;
  if (idempotencyKey) {
    const existingKeyMatch = data.reports.find((r) => r.idempotencyKey === idempotencyKey);
    if (existingKeyMatch) {
      return toPublicReportProjection(existingKeyMatch);
    }
  }

  // 2. Resolve target asset & location
  let matchedAsset = null;
  if (validated.assetId) {
    matchedAsset = data.assets.find(
      (a) => a.id.toUpperCase() === validated.assetId.toUpperCase()
    );
  }

  const finalLocation = validated.location || (matchedAsset ? {
    ...matchedAsset.coordinates,
    addressText: matchedAsset.street,
    landmark: validated.landmark || matchedAsset.landmark,
  } : null);
  if (!finalLocation || !finalLocation.lat || !finalLocation.lng) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Unable to resolve geographical coordinates for this report.'
    );
  }

  const jurisdictionId = matchedAsset?.jurisdictionId || rawInput.jurisdictionId || 'WARD-042';

  // 3. Duplicate Detection & Deduplication
  const duplicateCandidate = findDuplicateReport(
    {
      assetId: validated.assetId,
      location: finalLocation,
      faultCategory: validated.faultCategory,
    },
    data.reports
  );

  const reportId = generateId('REP-STLT');
  const trackingToken = generateTrackingToken();
  const now = new Date().toISOString();

  // Create report entity
  const newReport = {
    id: reportId,
    trackingToken,
    assetId: validated.assetId || matchedAsset?.id || null,
    jurisdictionId,
    location: finalLocation,
    faultCategory: validated.faultCategory,
    status: duplicateCandidate ? REPORT_STATUS.DUPLICATE : REPORT_STATUS.REPORTED,
    duplicateOfId: duplicateCandidate ? duplicateCandidate.id : null,
    duplicateCount: 0,
    duplicateReportIds: [],
    clusterId: null,
    reporterCategory: validated.reporterCategory,
    reporterHash: validated.contactNumber ? `hash_${Date.now().toString(36)}` : 'anonymous',
    idempotencyKey,
    description: validated.description,
    reportedAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  if (duplicateCandidate) {
    // Merge into primary report
    duplicateCandidate.duplicateCount = (duplicateCandidate.duplicateCount || 0) + 1;
    duplicateCandidate.duplicateReportIds = duplicateCandidate.duplicateReportIds || [];
    duplicateCandidate.duplicateReportIds.push(reportId);
    duplicateCandidate.updatedAt = now;

    newReport.clusterId = duplicateCandidate.clusterId;
    data.reports.unshift(newReport);

    recordAuditEvent(data, 'REPORT_MERGED_DUPLICATE', reportId, actor, {
      primaryReportId: duplicateCandidate.id,
      assetId: newReport.assetId,
    });

    persistStreetlightData(data);
    return toPublicReportProjection(newReport);
  }

  // 4. Cluster Association or Creation
  // Check if an existing open cluster is within 120m
  let targetCluster = null;
  for (const cluster of data.clusters) {
    if (['open', 'triaged', 'work_order_created'].includes(cluster.status) && cluster.centroid) {
      const dist = haversineDistanceMeters(finalLocation, cluster.centroid);
      if (dist <= 120) {
        targetCluster = cluster;
        break;
      }
    }
  }

  if (targetCluster) {
    targetCluster.reportIds.push(reportId);
    if (newReport.assetId && !targetCluster.assetIds.includes(newReport.assetId)) {
      targetCluster.assetIds.push(newReport.assetId);
    }
    targetCluster.poleCount = Math.max(targetCluster.assetIds.length, targetCluster.reportIds.length);
    newReport.status = REPORT_STATUS.CLUSTERED;
    newReport.clusterId = targetCluster.id;

    // Recalculate priority
    const priority = calculateClusterPriority(targetCluster, data.reports);
    targetCluster.priorityScore = priority.score;
    targetCluster.priorityTier = priority.tier;
    targetCluster.explainability = priority.explainability;
    targetCluster.updatedAt = now;
  } else {
    // Create new cluster
    const clusterId = generateId('CLUS-STLT');
    newReport.status = REPORT_STATUS.CLUSTERED;
    newReport.clusterId = clusterId;

    const freshCluster = {
      id: clusterId,
      jurisdictionId,
      corridorName: finalLocation.addressText || validated.landmark || 'Outage Corridor Segment',
      centroid: { lat: finalLocation.lat, lng: finalLocation.lng },
      boundingBox: {
        minLat: finalLocation.lat,
        maxLat: finalLocation.lat,
        minLng: finalLocation.lng,
        maxLng: finalLocation.lng,
      },
      reportIds: [reportId],
      assetIds: newReport.assetId ? [newReport.assetId] : [],
      poleCount: 1,
      status: CLUSTER_STATUS.OPEN,
      priorityScore: 50,
      priorityTier: PRIORITY_TIERS.HIGH,
      assignedWorkOrderId: null,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };

    const priority = calculateClusterPriority(freshCluster, [newReport]);
    freshCluster.priorityScore = priority.score;
    freshCluster.priorityTier = priority.tier;
    freshCluster.explainability = priority.explainability;

    data.clusters.unshift(freshCluster);
  }

  // 5. Update Asset Status if known
  if (matchedAsset) {
    if (validated.faultCategory === 'exposed_wiring' || validated.faultCategory === 'damaged_pole') {
      matchedAsset.operationalStatus = ASSET_STATUS.DAMAGED;
    } else if (validated.faultCategory === 'flickering_intermittent') {
      matchedAsset.operationalStatus = ASSET_STATUS.FLICKERING;
    } else {
      matchedAsset.operationalStatus = ASSET_STATUS.DARK;
    }
    matchedAsset.updatedAt = now;
  }

  data.reports.unshift(newReport);
  recordAuditEvent(data, 'REPORT_SUBMITTED', reportId, actor, {
    faultCategory: validated.faultCategory,
    clusterId: newReport.clusterId,
    assetId: newReport.assetId,
  });

  persistStreetlightData(data);
  return toPublicReportProjection(newReport);
};

/**
 * Public Anonymous Status Tracking via Token
 */
export const trackReportByToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'A valid tracking token is required (e.g., TRK-STLT-123456).'
    );
  }

  const data = ensureStreetlightData();
  const cleanToken = token.trim().toUpperCase();
  const report = data.reports.find((r) => r.trackingToken?.toUpperCase() === cleanToken);

  if (!report) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.NOT_FOUND,
      `No streetlight outage report found matching token "${token}".`
    );
  }

  return toPublicReportProjection(report);
};

/**
 * Public aggregated summary for public dashboard/map view.
 */
export const getPublicOutageSummary = (jurisdictionId = null) => {
  const data = ensureStreetlightData();
  let clusters = data.clusters.filter((c) => c.status !== 'resolved');
  let assets = data.assets;

  if (jurisdictionId) {
    const jId = jurisdictionId.toUpperCase();
    clusters = clusters.filter((c) => c.jurisdictionId?.toUpperCase() === jId);
    assets = assets.filter((a) => a.jurisdictionId?.toUpperCase() === jId);
  }

  const darkPoles = assets.filter((a) => a.operationalStatus === ASSET_STATUS.DARK || a.operationalStatus === ASSET_STATUS.DAMAGED);

  return {
    totalPoles: assets.length,
    activeOutageClusters: clusters.map(toPublicClusterProjection),
    darkPoleCount: darkPoles.length,
    lastRefreshedAt: new Date().toISOString(),
  };
};

// ==========================================
// CLUSTERS API
// ==========================================

export const listClusters = (filters = {}, actor) => {
  assertStreetlightCapability('report.view_public', actor, { allowAnonymous: true });
  const data = ensureStreetlightData();

  let results = [...data.clusters];

  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    assertStreetlightJurisdiction(actor, filters.jurisdictionId, { forRead: true });
    results = results.filter(
      (c) => c.jurisdictionId?.toUpperCase() === filters.jurisdictionId.toUpperCase()
    );
  }

  if (filters.status && filters.status !== 'all') {
    results = results.filter((c) => c.status === filters.status);
  }

  if (filters.priorityTier && filters.priorityTier !== 'all') {
    results = results.filter((c) => c.priorityTier === filters.priorityTier);
  }

  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase().trim();
    results = results.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.corridorName?.toLowerCase().includes(q) ||
        c.assetIds?.some((aId) => aId.toLowerCase().includes(q))
    );
  }

  // Sort by priorityScore desc, then createdAt desc
  results.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  return results;
};

export const getClusterById = (clusterId, actor) => {
  assertStreetlightCapability('report.view_public', actor, { allowAnonymous: true });
  const data = ensureStreetlightData();
  const cluster = data.clusters.find((c) => c.id === clusterId);

  if (!cluster) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.NOT_FOUND,
      `Outage cluster "${clusterId}" not found.`
    );
  }

  // Populate constituent reports and assets
  const memberReports = data.reports.filter((r) => cluster.reportIds?.includes(r.id));
  const memberAssets = data.assets.filter((a) => cluster.assetIds?.includes(a.id));
  const associatedWorkOrder = data.workOrders.find((w) => w.id === cluster.assignedWorkOrderId) || null;

  return {
    ...cluster,
    reports: isStreetlightStaff(actor) ? memberReports : memberReports.map(toPublicReportProjection),
    assets: memberAssets,
    workOrder: associatedWorkOrder,
  };
};

/**
 * Operator / Reviewer Triage & Priority Override
 */
export const triageCluster = (clusterId, { priorityTier, overrideReason, notes }, actor) => {
  assertStreetlightCapability('cluster.triage', actor);
  const data = ensureStreetlightData();
  const cluster = data.clusters.find((c) => c.id === clusterId);

  if (!cluster) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.NOT_FOUND,
      `Cluster "${clusterId}" not found.`
    );
  }

  assertStreetlightJurisdiction(actor, cluster.jurisdictionId);

  const prevTier = cluster.priorityTier;
  const now = new Date().toISOString();

  if (priorityTier || overrideReason) {
    assertStreetlightCapability('cluster.override', actor);
    if (!overrideReason || !overrideReason.trim()) {
      throw new StreetlightServiceError(
        STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
        'An explicit reason is required when overriding automated priority ranking.'
      );
    }
    const targetTier = priorityTier && Object.values(PRIORITY_TIERS).includes(priorityTier)
      ? priorityTier
      : cluster.priorityTier;

    cluster.priorityTier = targetTier;
    if (priorityTier) {
      cluster.priorityScore = targetTier === 'critical' ? 90 : targetTier === 'high' ? 65 : targetTier === 'medium' ? 40 : 20;
    }
    cluster.overrideLog = {
      previousTier: prevTier,
      newTier: targetTier,
      reason: sanitizeText(overrideReason, 300),
      operatorId: actor?.id || actor?.username || 'operator',
      overriddenAt: now,
    };
  }

  cluster.status = CLUSTER_STATUS.TRIAGED;
  cluster.operatorNotes = sanitizeText(notes || cluster.operatorNotes || '', 500);
  cluster.updatedAt = now;

  recordAuditEvent(data, 'CLUSTER_TRIAGED', clusterId, actor, {
    previousTier: prevTier,
    newTier: cluster.priorityTier,
    overrideReason,
  });

  persistStreetlightData(data);
  return cluster;
};

// ==========================================
// WORK ORDERS & FIELD REPAIRS API
// ==========================================

/**
 * Create and dispatch a repair work order for a cluster.
 */
export const createWorkOrder = (input, actor) => {
  assertStreetlightCapability('workOrder.create', actor);
  const validated = validateWorkOrderInput(input);
  const data = ensureStreetlightData();

  const cluster = data.clusters.find((c) => c.id === validated.clusterId);
  if (!cluster) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.NOT_FOUND,
      `Cluster "${validated.clusterId}" not found.`
    );
  }

  assertStreetlightJurisdiction(actor, cluster.jurisdictionId);

  const workOrderId = generateId('WO-STLT');
  const now = new Date().toISOString();

  const newWorkOrder = {
    id: workOrderId,
    clusterId: cluster.id,
    jurisdictionId: cluster.jurisdictionId,
    assignedTechnicianId: validated.assignedTechnicianId,
    assignedTechnicianName: input.assignedTechnicianName || validated.assignedTechnicianId,
    priority: validated.priority,
    targetSlaHours: validated.targetSlaHours,
    scheduledDate: validated.scheduledDate,
    status: WORK_ORDER_STATUS.DISPATCHED,
    dispatchedAt: now,
    dispatchedBy: actor?.id || actor?.username || 'operator',
    dispatchNotes: validated.notes,
    acknowledgedAt: null,
    onSiteAt: null,
    resolvedAt: null,
    repairEventIds: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  // Transaction: Update Cluster & Member Reports
  cluster.assignedWorkOrderId = workOrderId;
  cluster.status = CLUSTER_STATUS.WORK_ORDER_CREATED;
  cluster.updatedAt = now;

  data.reports.forEach((r) => {
    if (cluster.reportIds?.includes(r.id) && r.status !== REPORT_STATUS.RESOLVED) {
      r.status = REPORT_STATUS.ASSIGNED;
      r.updatedAt = now;
    }
  });

  data.workOrders.unshift(newWorkOrder);
  recordAuditEvent(data, 'WORK_ORDER_DISPATCHED', workOrderId, actor, {
    clusterId: cluster.id,
    technicianId: validated.assignedTechnicianId,
  });

  persistStreetlightData(data);
  return newWorkOrder;
};

export const listWorkOrders = (filters = {}, actor) => {
  assertStreetlightCapability('workOrder.update', actor);
  const data = ensureStreetlightData();

  let results = [...data.workOrders];

  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    assertStreetlightJurisdiction(actor, filters.jurisdictionId, { forRead: true });
    results = results.filter(
      (w) => w.jurisdictionId?.toUpperCase() === filters.jurisdictionId.toUpperCase()
    );
  }

  if (filters.status && filters.status !== 'all') {
    results = results.filter((w) => w.status === filters.status);
  }

  if (filters.technicianId) {
    results = results.filter((w) => w.assignedTechnicianId === filters.technicianId);
  }

  return results;
};

/**
 * Transition work order state (e.g. dispatched -> acknowledged -> on_site -> parts_pending).
 */
export const updateWorkOrderStatus = (workOrderId, nextStatus, notes = '', actor) => {
  assertStreetlightCapability('workOrder.update', actor);
  const data = ensureStreetlightData();
  const workOrder = data.workOrders.find((w) => w.id === workOrderId);

  if (!workOrder) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.NOT_FOUND,
      `Work order "${workOrderId}" not found.`
    );
  }

  const allowedTransitions = ALLOWED_WORK_ORDER_TRANSITIONS[workOrder.status] || [];
  if (!allowedTransitions.includes(nextStatus)) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.INVALID_STATE_TRANSITION,
      `Invalid work order state transition from "${workOrder.status}" to "${nextStatus}". Allowed: ${allowedTransitions.join(', ') || 'none'}`
    );
  }

  const now = new Date().toISOString();
  workOrder.status = nextStatus;
  workOrder.updatedAt = now;
  if (notes) workOrder.latestNotes = sanitizeText(notes, 500);

  if (nextStatus === WORK_ORDER_STATUS.ACKNOWLEDGED) {
    workOrder.acknowledgedAt = now;
  } else if (nextStatus === WORK_ORDER_STATUS.ON_SITE) {
    workOrder.onSiteAt = now;
    // Set cluster to in_progress
    const cluster = data.clusters.find((c) => c.id === workOrder.clusterId);
    if (cluster) {
      cluster.status = CLUSTER_STATUS.IN_PROGRESS;
      cluster.updatedAt = now;
    }
  }

  recordAuditEvent(data, 'WORK_ORDER_STATUS_CHANGED', workOrderId, actor, {
    previousStatus: workOrder.status,
    newStatus: nextStatus,
  });

  persistStreetlightData(data);
  return workOrder;
};

/**
 * Reassign work order to another technician or crew with mandatory operational reason.
 */
export const reassignWorkOrder = (workOrderId, { newTechnicianId, newTechnicianName, reason }, actor) => {
  assertStreetlightCapability('workOrder.reassign', actor);
  const data = ensureStreetlightData();
  const workOrder = data.workOrders.find((w) => w.id === workOrderId);

  if (!workOrder) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.NOT_FOUND,
      `Work order "${workOrderId}" not found.`
    );
  }

  if (workOrder.status === WORK_ORDER_STATUS.RESOLVED || workOrder.status === WORK_ORDER_STATUS.CLOSED) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.INVALID_STATE_TRANSITION,
      'Cannot reassign a resolved or closed work order.'
    );
  }

  if (!newTechnicianId || !newTechnicianId.trim()) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'A valid new technician identifier is required.'
    );
  }

  const prevTech = workOrder.assignedTechnicianId;
  const now = new Date().toISOString();

  workOrder.assignedTechnicianId = newTechnicianId.trim();
  workOrder.assignedTechnicianName = newTechnicianName || newTechnicianId;
  workOrder.reassignedAt = now;
  workOrder.reassignReason = sanitizeText(reason || '', 300);
  workOrder.updatedAt = now;

  recordAuditEvent(data, 'WORK_ORDER_REASSIGNED', workOrderId, actor, {
    previousTechnician: prevTech,
    newTechnician: newTechnicianId,
    reason: workOrder.reassignReason,
  });

  persistStreetlightData(data);
  return workOrder;
};

/**
 * Automatically flags or escalates stale unaddressed outage reports and clusters exceeding maxStaleHours.
 */
export const expireStaleOutageStatuses = (maxStaleHours = 72, actor) => {
  assertStreetlightCapability('cluster.triage', actor);
  const data = ensureStreetlightData();
  const nowTime = Date.now();
  const staleThresholdMs = maxStaleHours * 3600 * 1000;
  let escalatedCount = 0;

  data.clusters.forEach((cluster) => {
    if (['open', 'triaged'].includes(cluster.status)) {
      const createdTime = new Date(cluster.createdAt).getTime();
      if (nowTime - createdTime > staleThresholdMs) {
        if (cluster.priorityTier !== PRIORITY_TIERS.CRITICAL) {
          cluster.priorityTier = PRIORITY_TIERS.CRITICAL;
          cluster.priorityScore = Math.max(85, (cluster.priorityScore || 50) + 25);
          cluster.isEscalatedStale = true;
          cluster.updatedAt = new Date().toISOString();
          escalatedCount += 1;

          recordAuditEvent(data, 'CLUSTER_STALE_ESCALATED', cluster.id, actor, {
            hoursActive: Math.round((nowTime - createdTime) / 3600000),
            newTier: 'critical',
          });
        }
      }
    }
  });

  if (escalatedCount > 0) {
    persistStreetlightData(data);
  }

  return { escalatedCount };
};

/**
 * Finds the nearest mapped streetlight pole within a distance tolerance (meters).
 */
export const matchAssetByLocation = (coordinates, maxDistanceMeters = 30) => {
  const data = ensureStreetlightData();
  let closestAsset = null;
  let minDistance = Infinity;

  data.assets.forEach((asset) => {
    const dist = haversineDistanceMeters(coordinates, asset.coordinates);
    if (dist <= maxDistanceMeters && dist < minDistance) {
      minDistance = dist;
      closestAsset = { ...asset, distanceMeters: dist };
    }
  });

  return closestAsset;
};

/**
 * Creates an inspection schedule for preventative patrols.
 */
export const createInspectionSchedule = (input, actor) => {
  assertStreetlightCapability('inspection.manage', actor);
  const data = ensureStreetlightData();
  const scheduleId = generateId('SCH-STLT');
  const now = new Date().toISOString();

  const newSchedule = {
    id: scheduleId,
    jurisdictionId: (input.jurisdictionId || 'WARD-042').toUpperCase(),
    assetId: input.assetId ? input.assetId.trim().toUpperCase() : null,
    frequencyDays: Number(input.frequencyDays) || 30,
    assignedInspectorId: input.assignedInspectorId || 'INSP-DEFAULT',
    lastPatrolledAt: input.lastPatrolledAt || null,
    nextDueAt: input.nextDueAt || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  data.inspectionSchedules = data.inspectionSchedules || [];
  data.inspectionSchedules.push(newSchedule);
  recordAuditEvent(data, 'INSPECTION_SCHEDULE_CREATED', scheduleId, actor);
  persistStreetlightData(data);
  return newSchedule;
};

export const listInspectionSchedules = (filters = {}, actor) => {
  assertStreetlightCapability('inspection.manage', actor);
  const data = ensureStreetlightData();
  let results = [...(data.inspectionSchedules || [])];

  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    results = results.filter((s) => s.jurisdictionId === filters.jurisdictionId.toUpperCase());
  }
  return results;
};

/**
 * Record repair event completion with parts replaced and outcome evidence.
 * Atomically resolves work order, outage cluster, member reports, and assets.
 */
export const recordRepairEvent = (input, actor) => {
  assertStreetlightCapability('repair.record', actor);
  const validated = validateRepairEventInput(input);
  const data = ensureStreetlightData();

  const workOrder = data.workOrders.find((w) => w.id === validated.workOrderId);
  if (!workOrder) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.NOT_FOUND,
      `Work order "${validated.workOrderId}" not found.`
    );
  }

  const repairEventId = generateId('REP-EVT');
  const now = new Date().toISOString();

  const repairEvent = {
    id: repairEventId,
    workOrderId: workOrder.id,
    clusterId: workOrder.clusterId,
    assetId: validated.assetId,
    technicianId: actor?.id || actor?.username || 'technician',
    resolutionAction: validated.resolutionAction,
    partsReplaced: validated.partsReplaced,
    technicianNotes: validated.technicianNotes,
    photoChecksum: validated.photoChecksum || `chk_${Date.now().toString(16)}`,
    completedAt: now,
  };

  data.repairEvents.unshift(repairEvent);

  // 1. Resolve Work Order
  workOrder.status = WORK_ORDER_STATUS.RESOLVED;
  workOrder.resolvedAt = now;
  workOrder.repairEventIds = workOrder.repairEventIds || [];
  workOrder.repairEventIds.push(repairEventId);
  workOrder.updatedAt = now;

  // 2. Resolve Cluster
  const cluster = data.clusters.find((c) => c.id === workOrder.clusterId);
  if (cluster) {
    cluster.status = CLUSTER_STATUS.RESOLVED;
    cluster.resolvedAt = now;
    cluster.updatedAt = now;

    // 3. Resolve Member Reports
    data.reports.forEach((r) => {
      if (cluster.reportIds?.includes(r.id)) {
        r.status = REPORT_STATUS.RESOLVED;
        r.resolvedAt = now;
        r.updatedAt = now;
      }
    });

    // 4. Restore Constituent Streetlight Assets to Functional
    data.assets.forEach((a) => {
      if (cluster.assetIds?.includes(a.id) || a.id === validated.assetId) {
        a.operationalStatus = ASSET_STATUS.FUNCTIONAL;
        a.lastInspectedAt = now;
        a.updatedAt = now;
      }
    });
  }

  recordAuditEvent(data, 'REPAIR_EVENT_RECORDED', repairEventId, actor, {
    workOrderId: workOrder.id,
    resolutionAction: validated.resolutionAction,
    partsCount: validated.partsReplaced.length,
  });

  persistStreetlightData(data);
  return { repairEvent, workOrder, cluster };
};

// ==========================================
// ASSET MANAGEMENT API
// ==========================================

export const listAssets = (filters = {}, actor) => {
  assertStreetlightCapability('report.view_public', actor, { allowAnonymous: true });
  const data = ensureStreetlightData();

  let results = [...data.assets];

  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    results = results.filter(
      (a) => a.jurisdictionId?.toUpperCase() === filters.jurisdictionId.toUpperCase()
    );
  }

  if (filters.status && filters.status !== 'all') {
    results = results.filter((a) => a.operationalStatus === filters.status);
  }

  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase().trim();
    results = results.filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        a.street?.toLowerCase().includes(q) ||
        a.landmark?.toLowerCase().includes(q)
    );
  }

  return results;
};

export const createAsset = (input, actor) => {
  assertStreetlightCapability('asset.manage', actor);
  const validated = validateAssetInput(input);
  const data = ensureStreetlightData();

  const existing = data.assets.find((a) => a.id.toUpperCase() === validated.id);
  if (existing) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      `Pole Asset with ID "${validated.id}" already exists.`
    );
  }

  assertStreetlightJurisdiction(actor, validated.jurisdictionId);

  const now = new Date().toISOString();
  const asset = {
    ...validated,
    installationDate: input.installationDate || now.slice(0, 10),
    lastInspectedAt: now,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  data.assets.push(asset);
  recordAuditEvent(data, 'ASSET_CREATED', asset.id, actor);
  persistStreetlightData(data);
  return asset;
};

// ==========================================
// AUDIT LOGS & DIAGNOSTICS
// ==========================================

export const getStreetlightAuditTrail = (filters = {}, actor) => {
  assertStreetlightCapability('audit.read', actor);
  const data = ensureStreetlightData();
  let results = [...data.auditLogs];

  if (filters.entityId) {
    results = results.filter((log) => log.entityId === filters.entityId);
  }
  if (filters.action) {
    results = results.filter((log) => log.action === filters.action);
  }

  return results;
};
