/**
 * src/services/pedestrianBarrierService.js
 * Business logic and data management service layer for Accessible Pedestrian Route Barrier Map (#757).
 */

import {
  SCHEMA_VERSION,
  validateBarrierObservationPayload,
  validateVerificationEventPayload,
  validateRoutePreferences,
  canTransitionBarrierStatus,
  sanitizeText,
  checkForForbiddenPII,
} from '../data/pedestrianBarrierContract.js';
import {
  loadStoredNodes,
  loadStoredSegments,
  loadStoredCrossings,
  loadStoredObservations,
  saveStoredObservations,
  loadStoredObstructions,
  saveStoredObstructions,
  loadStoredAuditEvents,
  saveStoredAuditEvents,
  loadStoredRoutePreferences,
  saveStoredRoutePreferences,
  loadOfflineQueue,
  enqueueOfflineAction,
  clearOfflineQueue,
} from './pedestrianBarrierStorage.js';
import { calculateAccessibleRoute } from './pedestrianRouteEngine.js';

export const generateObservationId = (prefix = 'BAR') => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${rand}`;
};

export const generateEventId = (prefix = 'VE') => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${rand}`;
};

export const generateObstructionId = (prefix = 'OBST') => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${rand}`;
};

export const pedestrianBarrierService = {
  getNodes(filter = {}) {
    let nodes = loadStoredNodes();
    if (filter.ward && filter.ward !== 'all') {
      nodes = nodes.filter((n) => n.ward === filter.ward);
    }
    return nodes;
  },

  getSegments(filter = {}) {
    let segments = loadStoredSegments();
    if (filter.ward && filter.ward !== 'all') {
      segments = segments.filter((s) => s.ward === filter.ward);
    }
    if (filter.verificationStatus && filter.verificationStatus !== 'all') {
      segments = segments.filter((s) => s.verificationStatus === filter.verificationStatus);
    }
    return segments;
  },

  getCrossings(filter = {}) {
    let crossings = loadStoredCrossings();
    if (filter.ward && filter.ward !== 'all') {
      crossings = crossings.filter((c) => c.ward === filter.ward);
    }
    return crossings;
  },

  getObservations(filter = {}) {
    let observations = loadStoredObservations();
    if (filter.ward && filter.ward !== 'all') {
      observations = observations.filter((o) => o.ward === filter.ward);
    }
    if (filter.status && filter.status !== 'all') {
      observations = observations.filter((o) => o.status === filter.status);
    }
    if (filter.severity && filter.severity !== 'all') {
      observations = observations.filter((o) => o.severity === filter.severity);
    }
    if (filter.barrierType && filter.barrierType !== 'all') {
      observations = observations.filter((o) => o.barrierType === filter.barrierType);
    }
    return observations;
  },

  getObservationById(id) {
    const observations = loadStoredObservations();
    return observations.find((o) => o.id === id) || null;
  },

  getTemporaryObstructions(filter = {}) {
    let obstructions = loadStoredObstructions();
    const now = new Date();

    // Auto-update expired obstructions
    let updated = false;
    obstructions = obstructions.map((obs) => {
      if (obs.status === 'active' && obs.expiresAt && new Date(obs.expiresAt) < now) {
        updated = true;
        return { ...obs, status: 'expired' };
      }
      return obs;
    });

    if (updated) {
      saveStoredObstructions(obstructions);
    }

    if (filter.ward && filter.ward !== 'all') {
      obstructions = obstructions.filter((o) => o.ward === filter.ward);
    }
    if (filter.status && filter.status !== 'all') {
      obstructions = obstructions.filter((o) => o.status === filter.status);
    }
    return obstructions;
  },

  getAuditEvents(filter = {}) {
    let events = loadStoredAuditEvents();
    if (filter.observationId) {
      events = events.filter((e) => e.observationId === filter.observationId);
    }
    return events;
  },

  getRoutePreferences() {
    return loadStoredRoutePreferences();
  },

  saveRoutePreferences(prefs) {
    const { isValid, errors, sanitized } = validateRoutePreferences(prefs);
    if (!isValid) {
      throw new Error(`Invalid preferences: ${errors.join(', ')}`);
    }
    saveStoredRoutePreferences(sanitized);
    return sanitized;
  },

  reportBarrierObservation(payload, userContext = {}, isOnline = true) {
    // Check PII
    const piiDesc = checkForForbiddenPII(payload?.description);
    if (piiDesc) {
      throw new Error(`Privacy violation: ${piiDesc}. Please do not submit personal contact details.`);
    }

    const errors = validateBarrierObservationPayload(payload);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(' ')}`);
    }

    const observation = {
      id: payload.id || generateObservationId(),
      segmentId: payload.segmentId,
      coordinates: payload.coordinates || { lat: 12.915, lng: 77.67 },
      barrierType: payload.barrierType,
      severity: payload.severity,
      ward: sanitizeText(payload.ward, 60),
      description: sanitizeText(payload.description, 1000),
      confidenceScore: typeof payload.confidenceScore === 'number' ? payload.confidenceScore : 0.85,
      photoUrl: sanitizeText(payload.photoUrl || '', 500),
      reportedAt: new Date().toISOString(),
      status: 'reported',
      reportedBy: userContext.name ? sanitizeText(userContext.name, 40) : 'Citizen Contributor',
      schemaVersion: SCHEMA_VERSION,
    };

    if (!isOnline) {
      enqueueOfflineAction({
        type: 'report_barrier',
        payload: observation,
      });
      return {
        success: true,
        isQueuedOffline: true,
        observation,
      };
    }

    const currentObservations = loadStoredObservations();
    const updated = [observation, ...currentObservations];
    saveStoredObservations(updated);

    return {
      success: true,
      isQueuedOffline: false,
      observation,
    };
  },

  verifyBarrierObservation(observationId, decisionData, userContext = {}) {
    const userRole = userContext.role || 'citizen';
    if (!['operator', 'reviewer', 'admin'].includes(userRole)) {
      throw new Error('Permission denied: Only municipal operators, reviewers, or administrators can verify observations.');
    }

    const errors = validateVerificationEventPayload({ ...decisionData, observationId });
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(' ')}`);
    }

    const observations = loadStoredObservations();
    const obsIndex = observations.findIndex((o) => o.id === observationId);
    if (obsIndex === -1) {
      throw new Error(`Barrier observation ${observationId} not found.`);
    }

    const currentObs = observations[obsIndex];
    const targetStatus = decisionData.action === 'verify' ? 'verified' : 'rejected';

    if (!canTransitionBarrierStatus(currentObs.status, targetStatus, userRole)) {
      throw new Error(
        `Invalid status transition from "${currentObs.status}" to "${targetStatus}" for role "${userRole}".`
      );
    }

    const auditEvent = {
      id: generateEventId(),
      observationId,
      action: decisionData.action,
      reviewerId: userContext.id || 'OFFICER-BBMP-REV',
      reviewerRole: userRole,
      reasonCode: sanitizeText(decisionData.reasonCode, 100),
      notes: sanitizeText(decisionData.reviewerNotes || '', 1000),
      timestamp: new Date().toISOString(),
    };

    const updatedObs = {
      ...currentObs,
      status: targetStatus,
      updatedAt: new Date().toISOString(),
    };

    observations[obsIndex] = updatedObs;
    saveStoredObservations(observations);

    const auditEvents = loadStoredAuditEvents();
    saveStoredAuditEvents([auditEvent, ...auditEvents]);

    return {
      success: true,
      observation: updatedObs,
      auditEvent,
    };
  },

  resolveBarrierObservation(observationId, resolutionData, userContext = {}) {
    const userRole = userContext.role || 'citizen';
    if (!['operator', 'reviewer', 'admin'].includes(userRole)) {
      throw new Error('Permission denied: Only municipal operators, reviewers, or administrators can resolve observations.');
    }

    const observations = loadStoredObservations();
    const obsIndex = observations.findIndex((o) => o.id === observationId);
    if (obsIndex === -1) {
      throw new Error(`Barrier observation ${observationId} not found.`);
    }

    const currentObs = observations[obsIndex];
    if (!canTransitionBarrierStatus(currentObs.status, 'resolved', userRole)) {
      throw new Error(`Invalid status transition from "${currentObs.status}" to "resolved".`);
    }

    const auditEvent = {
      id: generateEventId(),
      observationId,
      action: 'resolve',
      reviewerId: userContext.id || 'OFFICER-BBMP-RESOLVE',
      reviewerRole: userRole,
      reasonCode: sanitizeText(resolutionData.reasonCode || 'defect_rectified', 100),
      notes: sanitizeText(resolutionData.reviewerNotes || 'Civil works completed and defect cleared.', 1000),
      timestamp: new Date().toISOString(),
    };

    const updatedObs = {
      ...currentObs,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    observations[obsIndex] = updatedObs;
    saveStoredObservations(observations);

    const auditEvents = loadStoredAuditEvents();
    saveStoredAuditEvents([auditEvent, ...auditEvents]);

    return {
      success: true,
      observation: updatedObs,
      auditEvent,
    };
  },

  calculateRoute(originNodeId, destinationNodeId, preferences = null) {
    const nodes = loadStoredNodes();
    const segments = loadStoredSegments();
    const crossings = loadStoredCrossings();
    const observations = loadStoredObservations();
    const temporaryObstructions = this.getTemporaryObstructions();
    const activePrefs = preferences || loadStoredRoutePreferences();

    return calculateAccessibleRoute({
      nodes,
      segments,
      crossings,
      observations,
      temporaryObstructions,
      originNodeId,
      destinationNodeId,
      preferences: activePrefs,
      now: new Date(),
    });
  },

  getNetworkMetrics(ward = 'all') {
    const segments = this.getSegments({ ward });
    const observations = this.getObservations({ ward });
    const obstructions = this.getTemporaryObstructions({ ward, status: 'active' });

    const totalDistance = segments.reduce((sum, s) => sum + (s.lengthMeters || 0), 0);
    const verifiedSegments = segments.filter((s) => s.verificationStatus === 'verified');
    const compliantCurbSegments = segments.filter((s) => s.curbRampStatus === 'present_compliant');
    const tactileSegments = segments.filter((s) => s.tactilePaving === 'continuous');

    const verifiedBarriers = observations.filter((o) => o.status === 'verified');
    const pendingBarriers = observations.filter((o) => o.status === 'reported' || o.status === 'under_review');
    const resolvedBarriers = observations.filter((o) => o.status === 'resolved');

    return {
      totalCorridors: segments.length,
      verifiedCorridors: verifiedSegments.length,
      totalDistanceMeters: totalDistance,
      curbRampCompliancePct: segments.length > 0 ? Math.round((compliantCurbSegments.length / segments.length) * 100) : 0,
      tactileCoveragePct: segments.length > 0 ? Math.round((tactileSegments.length / segments.length) * 100) : 0,
      verifiedBarriersCount: verifiedBarriers.length,
      pendingBarriersCount: pendingBarriers.length,
      resolvedBarriersCount: resolvedBarriers.length,
      activeObstructionsCount: obstructions.length,
    };
  },

  flushOfflineQueue() {
    const queue = loadOfflineQueue();
    if (!queue || queue.length === 0) return { flushed: 0 };

    let flushed = 0;
    const currentObservations = loadStoredObservations();
    const newObservations = [...currentObservations];

    for (const item of queue) {
      if (item.type === 'report_barrier' && item.payload) {
        // Idempotency check: don't insert duplicate ID
        if (!newObservations.some((o) => o.id === item.payload.id)) {
          newObservations.unshift(item.payload);
          flushed += 1;
        }
      }
    }

    saveStoredObservations(newObservations);
    clearOfflineQueue();
    return { flushed };
  },
};
