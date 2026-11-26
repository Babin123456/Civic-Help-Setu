import {
  MUNICIPAL_WARDS,
  ISSUE_CATEGORIES,
  TIME_WINDOWS,
  EVENT_STATUSES,
  EVENT_STATUS_TRANSITIONS,
  RECOMMENDATION_TRANSITIONS,
  DEFAULT_PRIVACY_RULES,
  PUBLIC_FIELDS_WHITELIST,
  normalizeIssueCategory,
  normalizeWardId,
  validateEventPayload,
  validatePrivacyRulePayload,
  validateRecommendationReviewPayload,
  sanitizeText,
  containsPii,
} from '../data/wardIssueHeatmapContract.js';

import {
  WARD_HEATMAP_STORAGE_KEYS,
  readStore,
  writeStore,
  initializeWardHeatmapSeedData,
} from './wardIssueHeatmapStorage.js';

export class WardIssueHeatmapError extends Error {
  constructor(message, code = 'ERR_WARD_HEATMAP', status = 400) {
    super(message);
    this.name = 'WardIssueHeatmapError';
    this.code = code;
    this.status = status;
  }
}

export class PermissionDeniedError extends WardIssueHeatmapError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 'ERR_PERMISSION_DENIED', 403);
    this.name = 'PermissionDeniedError';
  }
}

export class InvalidStateTransitionError extends WardIssueHeatmapError {
  constructor(fromState, toState, entity = 'Event') {
    super(
      `Invalid ${entity} state transition from "${fromState}" to "${toState}".`,
      'ERR_INVALID_STATE_TRANSITION',
      422
    );
    this.name = 'InvalidStateTransitionError';
  }
}

// Bounded deterministic hash for anonymized reporter identifier
export const generateSaltedAnonHash = (val, salt = 'CIVIC_HEATMAP_SALT_2026') => {
  const seed = `${val || 'anonymous'}|${salt}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `ANON-${((hash >>> 0) & 0xffff).toString(16).toUpperCase()}`;
};

// Spatial join: finds closest municipal ward based on coordinates
export const spatialJoinToWard = (lat, lon) => {
  if (typeof lat !== 'number' || typeof lon !== 'number') return MUNICIPAL_WARDS[0];

  // First check if inside bounding box
  for (const w of MUNICIPAL_WARDS) {
    if (
      lat <= w.bounds.north &&
      lat >= w.bounds.south &&
      lon <= w.bounds.east &&
      lon >= w.bounds.west
    ) {
      return w;
    }
  }

  // Fallback to minimum Euclidean distance to centroid
  let bestWard = MUNICIPAL_WARDS[0];
  let minDistance = Infinity;
  for (const w of MUNICIPAL_WARDS) {
    const d = Math.hypot(lat - w.center[0], lon - w.center[1]);
    if (d < minDistance) {
      minDistance = d;
      bestWard = w;
    }
  }
  return bestWard;
};

// Filter events by time window
export const filterEventsByTimeWindow = (events, timeWindow, referenceDate = new Date()) => {
  const refTime = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;

  let days = 30;
  if (timeWindow === TIME_WINDOWS.LAST_7_DAYS) days = 7;
  else if (timeWindow === TIME_WINDOWS.LAST_30_DAYS) days = 30;
  else if (timeWindow === TIME_WINDOWS.LAST_90_DAYS) days = 90;
  else if (timeWindow === TIME_WINDOWS.YEAR_TO_DATE) {
    const yearStart = new Date(new Date(refTime).getFullYear(), 0, 1).getTime();
    return events.filter((e) => {
      const t = new Date(e.createdAt).getTime();
      return t >= yearStart && t <= refTime;
    });
  }

  const cutoff = refTime - days * DAY_MS;
  return events.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return t >= cutoff && t <= refTime;
  });
};

// Record append-only audit event
export const recordAuditEvent = (action, details, actor = 'system', storage = null) => {
  const auditLogs = readStore(WARD_HEATMAP_STORAGE_KEYS.AUDIT_LOGS, [], storage);
  const entry = {
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    action,
    details: sanitizeText(details, 300),
    actor: typeof actor === 'object' ? (actor.username || actor.role || 'user') : String(actor),
    timestamp: new Date().toISOString(),
  };
  auditLogs.unshift(entry);
  if (auditLogs.length > 500) auditLogs.pop(); // Bounded buffer
  writeStore(WARD_HEATMAP_STORAGE_KEYS.AUDIT_LOGS, auditLogs, storage);
  return entry;
};

export const wardIssueHeatmapService = {
  /**
   * Bootstrap data if needed
   */
  ensureInitialized(storage = null) {
    initializeWardHeatmapSeedData(storage);
  },

  /**
   * Get active privacy rules
   */
  getPrivacyRules(storage = null) {
    this.ensureInitialized(storage);
    return readStore(WARD_HEATMAP_STORAGE_KEYS.PRIVACY_RULES, DEFAULT_PRIVACY_RULES, storage);
  },

  /**
   * Update privacy rules (Admin only)
   */
  updatePrivacyRules(updates, actor = null, storage = null) {
    if (!actor || actor.role !== 'admin') {
      throw new PermissionDeniedError('Only administrators can modify privacy thresholds.');
    }

    const current = this.getPrivacyRules(storage);
    const merged = { ...current, ...updates, updatedAt: new Date().toISOString(), updatedBy: actor.username || actor.id || 'admin' };

    const errors = validatePrivacyRulePayload(merged);
    if (errors.length > 0) {
      throw new WardIssueHeatmapError(errors.join(' '), 'ERR_INVALID_PRIVACY_RULE');
    }

    writeStore(WARD_HEATMAP_STORAGE_KEYS.PRIVACY_RULES, merged, storage);
    recordAuditEvent('UPDATE_PRIVACY_RULES', `Updated cohort threshold to k=${merged.minCohortThreshold}`, actor, storage);

    // Re-run aggregation to reflect updated privacy thresholds
    this.executeAggregationRun({ timeWindow: TIME_WINDOWS.LAST_30_DAYS }, actor, storage);

    return merged;
  },

  /**
   * Get list of all municipal wards
   */
  getWards(storage = null) {
    this.ensureInitialized(storage);
    return readStore(WARD_HEATMAP_STORAGE_KEYS.GEOMETRIES, MUNICIPAL_WARDS, storage);
  },

  /**
   * Get normalized categories
   */
  getCategories() {
    return ISSUE_CATEGORIES;
  },

  /**
   * Ingest an eligible civic issue event
   */
  ingestCivicIssueEvent(payload, actor = null, storage = null) {
    this.ensureInitialized(storage);

    if (containsPii(payload)) {
      throw new WardIssueHeatmapError(
        'Submission rejected: contains personal identifiable information (phone, Aadhaar, PAN, or email).',
        'ERR_PII_DETECTED',
        400
      );
    }

    const errors = validateEventPayload(payload);
    if (errors.length > 0) {
      throw new WardIssueHeatmapError(errors.join(' '), 'ERR_VALIDATION_FAILED', 400);
    }

    const events = readStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, [], storage);

    // Idempotency check
    if (payload.idempotencyKey) {
      const existing = events.find((e) => e.idempotencyKey === payload.idempotencyKey);
      if (existing) {
        return { event: existing, deduplicated: true };
      }
    }

    const ward = (payload.coordinates && Array.isArray(payload.coordinates) && payload.coordinates.length === 2)
      ? spatialJoinToWard(payload.coordinates[0], payload.coordinates[1])
      : (MUNICIPAL_WARDS.find((w) => w.id === normalizeWardId(payload.wardId || payload.ward)) || MUNICIPAL_WARDS[0]);

    const categoryKey = normalizeIssueCategory(payload.category);
    const categoryMeta = ISSUE_CATEGORIES[categoryKey];

    const timestamp = payload.createdAt || new Date().toISOString();
    const eventId = `EVT-${ward.code}-${categoryKey.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-5)}`;

    const newEvent = {
      id: eventId,
      idempotencyKey: payload.idempotencyKey || null,
      wardId: ward.id,
      wardName: ward.name,
      zone: ward.zone,
      category: categoryKey,
      severity: payload.severity || categoryMeta?.defaultSeverity || 'medium',
      status: payload.status || EVENT_STATUSES.REPORTED,
      source: payload.source || 'citizen_portal',
      coarseLocation: sanitizeText(payload.coarseLocation || `${ward.name} Public Sector`, 120),
      // Privacy safeguard: exact GPS is NEVER stored in the event record. Only coarse ward centroid.
      approximateCoords: ward.center,
      reporterIdHash: generateSaltedAnonHash(actor?.id || payload.reporterId || 'anon'),
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: SCHEMA_VERSION,
    };

    events.unshift(newEvent);
    writeStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, events, storage);

    recordAuditEvent(
      'INGEST_EVENT',
      `Ingested event ${newEvent.id} for ${ward.name} (${categoryKey})`,
      actor || 'citizen_intake',
      storage
    );

    return { event: newEvent, deduplicated: false };
  },

  /**
   * Transitions event status with domain verification (Operator / Admin only)
   */
  transitionEventStatus(eventId, newStatus, reason = '', actor = null, storage = null) {
    if (!actor || !['operator', 'admin'].includes(actor.role)) {
      throw new PermissionDeniedError('Only municipal operators or administrators can update event lifecycle states.');
    }

    const events = readStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, [], storage);
    const index = events.findIndex((e) => e.id === eventId);
    if (index === -1) {
      throw new WardIssueHeatmapError(`Event with id "${eventId}" not found.`, 'ERR_NOT_FOUND', 404);
    }

    const currentEvent = events[index];
    const allowed = EVENT_STATUS_TRANSITIONS[currentEvent.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidStateTransitionError(currentEvent.status, newStatus, 'Event');
    }

    const updatedEvent = {
      ...currentEvent,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: actor.username || actor.role,
      transitionReason: sanitizeText(reason, 200),
    };

    events[index] = updatedEvent;
    writeStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, events, storage);

    recordAuditEvent(
      'TRANSITION_EVENT_STATUS',
      `Transitioned ${eventId} from ${currentEvent.status} to ${newStatus}. Reason: ${reason}`,
      actor,
      storage
    );

    return updatedEvent;
  },

  /**
   * Computes aggregate metrics with small-cell privacy suppression for a cohort
   */
  computeCohortMetric(ward, categoryKey, currentEvents, previousEvents, privacyRules) {
    const rawCount = currentEvents.length;
    const previousCount = previousEvents.length;
    const minThreshold = privacyRules.minCohortThreshold || 5;
    const isSuppressed = privacyRules.suppressSparseCells && rawCount < minThreshold;

    const categoryMeta = ISSUE_CATEGORIES[categoryKey];

    // Calculate percentage change
    let percentChange = 0;
    if (previousCount > 0) {
      percentChange = Math.round(((rawCount - previousCount) / previousCount) * 100);
    } else if (rawCount > 0) {
      percentChange = 100;
    }

    let trendDirection = 'stable';
    if (percentChange >= 15) trendDirection = 'rising';
    else if (percentChange <= -15) trendDirection = 'falling';

    // Calculate anomaly score (0.0 to 1.0)
    const anomalyScore = rawCount >= minThreshold
      ? Math.min(1.0, Math.round(((rawCount / (ward.population / 10000)) * (1 + Math.max(0, percentChange / 100))) * 10) / 100)
      : 0.05;

    // Severity breakdown (only exposed if not suppressed)
    let severityBreakdown = null;
    if (!isSuppressed) {
      severityBreakdown = { low: 0, medium: 0, high: 0, critical: 0 };
      currentEvents.forEach((e) => {
        if (severityBreakdown[e.severity] !== undefined) {
          severityBreakdown[e.severity] += 1;
        }
      });
    }

    const metric = {
      metricId: `METRIC-${ward.id}-${categoryKey}`,
      wardId: ward.id,
      wardName: ward.name,
      zone: ward.zone,
      category: categoryKey,
      categoryLabel: categoryMeta?.label || categoryKey,
      timeWindow: TIME_WINDOWS.LAST_30_DAYS,
      rawCount, // Internal use
      displayCount: isSuppressed ? `< ${minThreshold} (Suppressed)` : rawCount,
      ratePer10kPopulation: isSuppressed ? null : Math.round((rawCount / (ward.population / 10000)) * 10) / 10,
      suppressed: isSuppressed,
      suppressionReason: isSuppressed
        ? `Count (< ${minThreshold}) is suppressed under k-anonymity privacy safeguards to prevent complainant identification.`
        : null,
      trendDirection,
      percentChange,
      severityBreakdown,
      anomalyScore,
      lastAggregatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
    };

    return metric;
  },

  /**
   * Public-facing filter to strip any internal or private fields
   */
  sanitizePublicMetric(metric) {
    const publicObj = {};
    PUBLIC_FIELDS_WHITELIST.forEach((field) => {
      if (metric[field] !== undefined) {
        publicObj[field] = metric[field];
      }
    });
    return publicObj;
  },

  /**
   * Get Ward Heatmap dataset
   */
  getHeatmapData({ timeWindow = TIME_WINDOWS.LAST_30_DAYS, category = null, actor = null, storage = null } = {}) {
    this.ensureInitialized(storage);
    const privacyRules = this.getPrivacyRules(storage);
    const allEvents = readStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, [], storage);
    const wards = this.getWards(storage);

    const isInternal = actor && ['operator', 'admin'].includes(actor.role);

    // Current time window events
    const currentEvents = filterEventsByTimeWindow(allEvents, timeWindow);

    // Calculate previous period for trend comparison
    const DAY_MS = 24 * 60 * 60 * 1000;
    let windowDays = 30;
    if (timeWindow === TIME_WINDOWS.LAST_7_DAYS) windowDays = 7;
    else if (timeWindow === TIME_WINDOWS.LAST_90_DAYS) windowDays = 90;
    const previousRef = new Date(Date.now() - windowDays * DAY_MS);
    const previousEvents = filterEventsByTimeWindow(allEvents, timeWindow, previousRef);

    const targetCategories = category
      ? [normalizeIssueCategory(category)]
      : Object.keys(ISSUE_CATEGORIES);

    const results = [];
    let totalSuppressedCohorts = 0;

    wards.forEach((ward) => {
      targetCategories.forEach((catKey) => {
        const wardCatEvents = currentEvents.filter(
          (e) => e.wardId === ward.id && e.category === catKey
        );
        const wardCatPrevEvents = previousEvents.filter(
          (e) => e.wardId === ward.id && e.category === catKey
        );

        const metric = this.computeCohortMetric(
          ward,
          catKey,
          wardCatEvents,
          wardCatPrevEvents,
          privacyRules
        );

        metric.timeWindow = timeWindow;

        if (metric.suppressed) {
          totalSuppressedCohorts += 1;
        }

        // Apply strict public whitelist if not internal authorized staff
        const finalMetric = isInternal ? metric : this.sanitizePublicMetric(metric);
        results.push(finalMetric);
      });
    });

    return {
      metrics: results,
      meta: {
        timeWindow,
        totalWards: wards.length,
        totalCohorts: results.length,
        suppressedCohortsCount: totalSuppressedCohorts,
        privacyThresholdK: privacyRules.minCohortThreshold,
        rulesetVersion: privacyRules.rulesetVersion,
        generatedAt: new Date().toISOString(),
      },
    };
  },

  /**
   * Get trend explorer data comparing specific wards or category velocities
   */
  getTrendExplorerData({ wardId = 'ward-101', compareWithWardId = null, category = null, timeWindow = TIME_WINDOWS.LAST_30_DAYS, storage = null } = {}) {
    this.ensureInitialized(storage);
    const privacyRules = this.getPrivacyRules(storage);
    const allEvents = readStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, [], storage);
    const wards = this.getWards(storage);

    const primaryWard = wards.find((w) => w.id === wardId) || wards[0];
    const compareWard = compareWithWardId ? wards.find((w) => w.id === compareWithWardId) : null;

    // Time slices: 4 consecutive time bins for velocity charting
    const DAY_MS = 24 * 60 * 60 * 1000;
    const slices = 4;
    const sliceDays = timeWindow === TIME_WINDOWS.LAST_7_DAYS ? 2 : timeWindow === TIME_WINDOWS.LAST_90_DAYS ? 22 : 7;

    const buildTrendSeries = (ward) => {
      const series = [];
      const now = Date.now();
      for (let s = slices - 1; s >= 0; s -= 1) {
        const start = now - (s + 1) * sliceDays * DAY_MS;
        const end = now - s * sliceDays * DAY_MS;
        const binEvents = allEvents.filter((e) => {
          if (e.wardId !== ward.id) return false;
          if (category && e.category !== normalizeIssueCategory(category)) return false;
          const t = new Date(e.createdAt).getTime();
          return t >= start && t <= end;
        });

        const count = binEvents.length;
        const isSuppressed = privacyRules.suppressSparseCells && count < privacyRules.minCohortThreshold;

        series.push({
          sliceIndex: slices - s,
          label: `T-${s * sliceDays}d`,
          startDate: new Date(start).toISOString().slice(0, 10),
          endDate: new Date(end).toISOString().slice(0, 10),
          count: isSuppressed ? null : count,
          displayCount: isSuppressed ? `< ${privacyRules.minCohortThreshold}` : count,
          suppressed: isSuppressed,
        });
      }
      return series;
    };

    return {
      primaryWard: {
        ward: primaryWard,
        series: buildTrendSeries(primaryWard),
      },
      compareWard: compareWard
        ? {
            ward: compareWard,
            series: buildTrendSeries(compareWard),
          }
        : null,
      meta: {
        timeWindow,
        category: category || 'all_categories',
        privacyThresholdK: privacyRules.minCohortThreshold,
      },
    };
  },

  /**
   * Execute an automated aggregation run (Admin only)
   */
  executeAggregationRun(config = {}, actor = null, storage = null) {
    if (!actor || actor.role !== 'admin') {
      throw new PermissionDeniedError('Only administrators can execute formal aggregation runs.');
    }

    const privacyRules = this.getPrivacyRules(storage);
    const timeWindow = config.timeWindow || TIME_WINDOWS.LAST_30_DAYS;
    const heatmap = this.getHeatmapData({ timeWindow, actor, storage });

    const runs = readStore(WARD_HEATMAP_STORAGE_KEYS.AGGREGATION_RUNS, [], storage);
    const newRun = {
      runId: `RUN-${Date.now()}`,
      timestamp: new Date().toISOString(),
      timeWindow,
      inputEventCount: readStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, [], storage).length,
      publishedMetricCount: heatmap.metrics.length,
      suppressedCohortCount: heatmap.meta.suppressedCohortsCount,
      rulesetVersion: privacyRules.rulesetVersion,
      differentialPrivacyEpsilon: privacyRules.differentialPrivacyEpsilon,
      minCohortThreshold: privacyRules.minCohortThreshold,
      executedBy: actor.username || actor.id || 'admin',
      status: 'completed',
    };

    runs.unshift(newRun);
    if (runs.length > 50) runs.pop();
    writeStore(WARD_HEATMAP_STORAGE_KEYS.AGGREGATION_RUNS, runs, storage);

    // Save precomputed metrics
    writeStore(WARD_HEATMAP_STORAGE_KEYS.METRICS, heatmap.metrics, storage);

    recordAuditEvent(
      'EXECUTE_AGGREGATION_RUN',
      `Triggered aggregation run ${newRun.runId} for window ${timeWindow}. Suppressed ${newRun.suppressedCohortCount} cohorts.`,
      actor,
      storage
    );

    return newRun;
  },

  /**
   * List aggregation run history
   */
  listAggregationRuns(storage = null) {
    this.ensureInitialized(storage);
    return readStore(WARD_HEATMAP_STORAGE_KEYS.AGGREGATION_RUNS, [], storage);
  },

  /**
   * Get explainable intervention recommendations
   */
  getRecommendations(filters = {}, storage = null) {
    this.ensureInitialized(storage);
    let recs = readStore(WARD_HEATMAP_STORAGE_KEYS.RECOMMENDATIONS, [], storage);

    if (filters.wardId) {
      recs = recs.filter((r) => r.wardId === filters.wardId);
    }
    if (filters.status) {
      recs = recs.filter((r) => r.status === filters.status);
    }
    if (filters.category) {
      recs = recs.filter((r) => r.category === normalizeIssueCategory(filters.category));
    }

    return recs;
  },

  /**
   * Review an explainable recommendation (Operator / Admin only)
   */
  reviewRecommendation(recId, payload, actor = null, storage = null) {
    if (!actor || !['operator', 'admin'].includes(actor.role)) {
      throw new PermissionDeniedError('Only authorized municipal staff can accept, edit, or reject recommendations.');
    }

    const errors = validateRecommendationReviewPayload(payload);
    if (errors.length > 0) {
      throw new WardIssueHeatmapError(errors.join(' '), 'ERR_INVALID_REVIEW_PAYLOAD');
    }

    const recs = readStore(WARD_HEATMAP_STORAGE_KEYS.RECOMMENDATIONS, [], storage);
    const index = recs.findIndex((r) => r.id === recId);
    if (index === -1) {
      throw new WardIssueHeatmapError(`Recommendation with id "${recId}" not found.`, 'ERR_NOT_FOUND', 404);
    }

    const current = recs[index];
    const allowed = RECOMMENDATION_TRANSITIONS[current.status] || [];
    if (!allowed.includes(payload.status)) {
      throw new InvalidStateTransitionError(current.status, payload.status, 'Recommendation');
    }

    const updated = {
      ...current,
      status: payload.status,
      recommendation: payload.modifiedIntervention ? sanitizeText(payload.modifiedIntervention, 300) : current.recommendation,
      reviewNotes: sanitizeText(payload.notes, 300),
      reviewedBy: actor.username || actor.role,
      reviewedAt: new Date().toISOString(),
    };

    recs[index] = updated;
    writeStore(WARD_HEATMAP_STORAGE_KEYS.RECOMMENDATIONS, recs, storage);

    recordAuditEvent(
      'REVIEW_RECOMMENDATION',
      `Recommendation ${recId} marked ${payload.status} by ${actor.username || actor.role}. Notes: ${payload.notes}`,
      actor,
      storage
    );

    return updated;
  },

  /**
   * List audit logs (Admin only)
   */
  getAuditLogs(actor = null, storage = null) {
    if (!actor || actor.role !== 'admin') {
      throw new PermissionDeniedError('Only administrators can inspect audit logs.');
    }
    this.ensureInitialized(storage);
    return readStore(WARD_HEATMAP_STORAGE_KEYS.AUDIT_LOGS, [], storage);
  },

  /**
   * List authorized underlying event records (Admin only)
   */
  getAuthorizedEvents({ wardId = null, category = null } = {}, actor = null, storage = null) {
    if (!actor || actor.role !== 'admin') {
      throw new PermissionDeniedError('Access denied: inspection of underlying event records requires administrative role.');
    }
    this.ensureInitialized(storage);
    let events = readStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, [], storage);

    if (wardId) {
      events = events.filter((e) => e.wardId === wardId);
    }
    if (category) {
      events = events.filter((e) => e.category === normalizeIssueCategory(category));
    }

    return events;
  },

  /**
   * Export anonymized metrics in JSON or CSV format
   */
  exportAnonymizedMetrics(format = 'json', filters = {}, storage = null) {
    const data = this.getHeatmapData({ ...filters, storage });
    if (format === 'csv') {
      const headers = ['Ward ID', 'Ward Name', 'Zone', 'Category', 'Time Window', 'Display Count', 'Rate per 10k', 'Suppressed', 'Trend'];
      const rows = data.metrics.map((m) => [
        `"${m.wardId}"`,
        `"${m.wardName}"`,
        `"${m.zone}"`,
        `"${m.categoryLabel}"`,
        `"${m.timeWindow}"`,
        `"${m.displayCount}"`,
        m.ratePer10kPopulation ?? 'N/A',
        m.suppressed ? 'TRUE' : 'FALSE',
        `"${m.trendDirection}"`,
      ]);
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }
    return JSON.stringify(data, null, 2);
  },

};
