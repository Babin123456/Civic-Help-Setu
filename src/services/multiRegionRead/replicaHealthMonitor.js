/**
 * Replica Health Monitor — Tracks per-replica lag, errors, and availability
 *
 * Pure in-memory state machine. No I/O in core logic.
 * Firestore heartbeat persistence is a separate adapter.
 */

import {
  REPLICA_HEALTH,
  DEFAULT_CONFIG,
  createReplicaState,
  createHealthCheckResult,
} from './types.js';
import { getReplicaRegions, getRegion, validateRegistry } from './regionRegistry.js';

// ============================================================================
// Health Monitor State
// ============================================================================

/** Create a new health monitor instance */
export const createReplicaHealthMonitor = ({ config = DEFAULT_CONFIG } = {}) => {
  const state = new Map(); // regionId -> ReplicaState
  const subscribers = new Set(); // Callbacks for health changes
  const registryValidation = validateRegistry();

  // Initialize from registry
  for (const region of getReplicaRegions()) {
    state.set(region.id, createReplicaState({ regionId: region.id }));
  }

  return {
    config,
    state,
    subscribers,
    registryValidation,
  };
};

// ============================================================================
// Core State Transitions
// ============================================================================

/** Update replica state from a heartbeat document */
export const processHeartbeat = (monitor, heartbeatDoc, { now = Date.now() } = {}) => {
  const { regionId, lastReplicatedCommitTs, lagMs, healthy, errorRate5m } = heartbeatDoc;
  const regionConfig = getRegion(regionId);

  if (!regionConfig) {
    return { success: false, reason: `Unknown region: ${regionId}` };
  }

  if (regionConfig.readOnly === false) {
    return { success: false, reason: `Primary region ${regionId} does not send heartbeats` };
  }

  let replicaState = monitor.state.get(regionId);
  if (!replicaState) {
    replicaState = createReplicaState({ regionId });
    monitor.state.set(regionId, replicaState);
  }

  const previousHealth = replicaState.health;
  const previousLag = replicaState.lagMs;

  // Update state
  replicaState.lastHeartbeatAt = now;
  replicaState.lastReplicatedCommitTs = lastReplicatedCommitTs;
  replicaState.lagMs = lagMs;
  replicaState.errorRate5m = errorRate5m;

  // Determine health based on thresholds
  const { maxLagMs, maxLagCriticalMs } = regionConfig;
  const { DEGRADED_LAG_MS, UNHEALTHY_LAG_MS, MAX_ERROR_RATE_5M } = monitor.config;

  let newHealth = REPLICA_HEALTH.HEALTHY;
  const issues = [];

  // Check lag
  const effectiveMaxLag = maxLagMs > 0 ? maxLagMs : DEGRADED_LAG_MS;
  const effectiveCriticalLag = maxLagCriticalMs > 0 ? maxLagCriticalMs : UNHEALTHY_LAG_MS;

  if (lagMs > effectiveCriticalLag) {
    newHealth = REPLICA_HEALTH.UNHEALTHY;
    issues.push(`lag_exceeds_critical: ${lagMs}ms > ${effectiveCriticalLag}ms`);
  } else if (lagMs > effectiveMaxLag) {
    newHealth = REPLICA_HEALTH.DEGRADED;
    issues.push(`lag_exceeds_threshold: ${lagMs}ms > ${effectiveMaxLag}ms`);
  }

  // Check error rate
  if (errorRate5m > MAX_ERROR_RATE_5M) {
    newHealth = REPLICA_HEALTH.UNHEALTHY;
    issues.push(`error_rate_exceeds: ${(errorRate5m * 100).toFixed(2)}% > ${(MAX_ERROR_RATE_5M * 100).toFixed(2)}%`);
  }

  // Check explicit healthy flag from heartbeat
  if (healthy === false) {
    newHealth = REPLICA_HEALTH.UNHEALTHY;
    issues.push('heartbeat_reported_unhealthy');
  }

  // Preserve draining/recovering states unless explicitly recovering
  if (replicaState.health === REPLICA_HEALTH.DRAINING) {
    newHealth = REPLICA_HEALTH.DRAINING;
  } else if (replicaState.health === REPLICA_HEALTH.RECOVERING) {
    // Only transition out of recovering if healthy and lag is low
    if (newHealth === REPLICA_HEALTH.HEALTHY && lagMs < 1000) {
      newHealth = REPLICA_HEALTH.RECOVERING; // Stay recovering until observation window passes
    } else {
      newHealth = REPLICA_HEALTH.UNHEALTHY; // Relapse
      replicaState.recoveringSince = null;
    }
  }

  replicaState.health = newHealth;

  // Notify subscribers on health change
  if (newHealth !== previousHealth) {
    notifySubscribers(monitor, {
      type: 'health_change',
      regionId,
      previousHealth,
      newHealth,
      lagMs,
      issues,
      timestamp: now,
    });
  }

  // Notify on significant lag change
  if (Math.abs(lagMs - previousLag) > 500) {
    notifySubscribers(monitor, {
      type: 'lag_change',
      regionId,
      previousLag,
      newLag: lagMs,
      timestamp: now,
    });
  }

  return { success: true, health: newHealth, issues };
};

/** Record a request error for a replica */
export const recordError = (monitor, regionId, { now = Date.now() } = {}) => {
  const replicaState = monitor.state.get(regionId);
  if (!replicaState) return { success: false, reason: 'Replica not tracked' };

  replicaState.consecutiveErrors += 1;
  replicaState.errorRate5m = Math.min(1, replicaState.errorRate5m + 0.01); // Approximate

  const { MAX_CONSECUTIVE_ERRORS } = monitor.config;
  if (replicaState.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    const previousHealth = replicaState.health;
    replicaState.health = REPLICA_HEALTH.UNHEALTHY;
    if (previousHealth !== REPLICA_HEALTH.UNHEALTHY) {
      notifySubscribers(monitor, {
        type: 'health_change',
        regionId,
        previousHealth,
        newHealth: REPLICA_HEALTH.UNHEALTHY,
        lagMs: replicaState.lagMs,
        issues: [`consecutive_errors: ${replicaState.consecutiveErrors}`],
        timestamp: now,
      });
    }
  }

  return { success: true, consecutiveErrors: replicaState.consecutiveErrors };
};

/** Record a successful request for a replica */
export const recordSuccess = (monitor, regionId) => {
  const replicaState = monitor.state.get(regionId);
  if (!replicaState) return { success: false };

  replicaState.consecutiveErrors = 0;
  // Error rate decays naturally via heartbeat updates
  return { success: true };
};

/** Check if heartbeat is stale (missing for too long) */
export const checkHeartbeatStaleness = (monitor, { now = Date.now() } = {}) => {
  const { HEARTBEAT_TTL_MS } = monitor.config;
  const results = [];

  for (const [regionId, replicaState] of monitor.state) {
    if (!replicaState.lastHeartbeatAt) continue;

    const age = now - replicaState.lastHeartbeatAt;
    if (age > HEARTBEAT_TTL_MS) {
      const previousHealth = replicaState.health;
      replicaState.health = REPLICA_HEALTH.UNHEALTHY;
      replicaState.issues = [`heartbeat_stale: ${age}ms > ${HEARTBEAT_TTL_MS}ms`];

      if (previousHealth !== REPLICA_HEALTH.UNHEALTHY) {
        notifySubscribers(monitor, {
          type: 'health_change',
          regionId,
          previousHealth,
          newHealth: REPLICA_HEALTH.UNHEALTHY,
          lagMs: replicaState.lagMs,
          issues: replicaState.issues,
          timestamp: now,
        });
      }
      results.push({ regionId, stale: true, age });
    }
  }

  return results;
};

// ============================================================================
// Health Queries
// ============================================================================

/** Get current health status for a replica */
export const getReplicaHealth = (monitor, regionId) => {
  const replicaState = monitor.state.get(regionId);
  if (!replicaState) return null;

  return createHealthCheckResult({
    replicaId: regionId,
    regionId,
    healthy: replicaState.health === REPLICA_HEALTH.HEALTHY,
    lagMs: replicaState.lagMs,
    errorRate5m: replicaState.errorRate5m,
    lastHeartbeatAgeMs: replicaState.lastHeartbeatAt
      ? Date.now() - replicaState.lastHeartbeatAt
      : null,
    issues: replicaState.issues || [],
  });
};

/** Get all replica health statuses */
export const getAllReplicaHealth = (monitor) => {
  const results = {};
  for (const regionId of monitor.state.keys()) {
    results[regionId] = getReplicaHealth(monitor, regionId);
  }
  return results;
};

/** Get healthy replicas (eligible for routing) */
export const getHealthyReplicas = (monitor) => {
  const healthy = [];
  for (const [regionId, state] of monitor.state) {
    if (state.health === REPLICA_HEALTH.HEALTHY || state.health === REPLICA_HEALTH.DEGRADED) {
      healthy.push({ regionId, state: { ...state } });
    }
  }
  // Sort by lag (ascending) then by weight (descending)
  healthy.sort((a, b) => a.state.lagMs - b.state.lagMs || b.state.weight - a.state.weight);
  return healthy;
};

/** Get the best healthy replica for a given region preference */
export const getBestReplica = (monitor, preferredRegionId = null) => {
  const healthy = getHealthyReplicas(monitor);
  if (healthy.length === 0) return null;

  if (preferredRegionId) {
    const preferred = healthy.find((h) => h.regionId === preferredRegionId);
    if (preferred) return preferred;
  }

  return healthy[0]; // Lowest lag, highest weight
};

/** Check if any healthy replica exists */
export const hasHealthyReplicas = (monitor) => getHealthyReplicas(monitor).length > 0;

// ============================================================================
// Failover State Management
// ============================================================================

/** Mark replica as draining (stop routing new requests) */
export const setDraining = (monitor, regionId, { now = Date.now() } = {}) => {
  const replicaState = monitor.state.get(regionId);
  if (!replicaState) return { success: false };

  const previousHealth = replicaState.health;
  replicaState.health = REPLICA_HEALTH.DRAINING;
  replicaState.drainingSince = now;

  notifySubscribers(monitor, {
    type: 'health_change',
    regionId,
    previousHealth,
    newHealth: REPLICA_HEALTH.DRAINING,
    lagMs: replicaState.lagMs,
    issues: ['manual_drain_or_failover'],
    timestamp: now,
  });

  return { success: true, drainingSince: now };
};

/** Mark replica as recovering (gradual re-enable) */
export const setRecovering = (monitor, regionId, { now = Date.now() } = {}) => {
  const replicaState = monitor.state.get(regionId);
  if (!replicaState) return { success: false };

  const previousHealth = replicaState.health;
  replicaState.health = REPLICA_HEALTH.RECOVERING;
  replicaState.recoveringSince = now;
  replicaState.drainingSince = null;
  replicaState.weight = Math.floor(replicaState.weight * 0.1); // Start at 10%

  notifySubscribers(monitor, {
    type: 'health_change',
    regionId,
    previousHealth,
    newHealth: REPLICA_HEALTH.RECOVERING,
    lagMs: replicaState.lagMs,
    issues: ['recovery_started'],
    timestamp: now,
  });

  return { success: true, recoveringSince: now, weight: replicaState.weight };
};

/** Advance recovery ramp (called periodically) */
export const advanceRecoveryRamp = (monitor, regionId, { now = Date.now() } = {}) => {
  const replicaState = monitor.state.get(regionId);
  if (!replicaState || replicaState.health !== REPLICA_HEALTH.RECOVERING) {
    return { success: false };
  }

  const { RECOVERY_OBSERVATION_MS, RECOVERY_RAMP_STEPS, RECOVERY_RAMP_INTERVAL_MS } = monitor.config;
  const regionConfig = getRegion(regionId);
  const baseWeight = regionConfig?.weight || 100;

  const elapsed = now - replicaState.recoveringSince;
  const stepIndex = Math.min(
    RECOVERY_RAMP_STEPS.length - 1,
    Math.floor(elapsed / RECOVERY_RAMP_INTERVAL_MS)
  );

  // Must pass observation window before first step
  if (elapsed < RECOVERY_OBSERVATION_MS && stepIndex === 0) {
    return { success: true, step: 0, weight: replicaState.weight, waiting: true };
  }

  const targetWeight = Math.floor(baseWeight * RECOVERY_RAMP_STEPS[stepIndex]);
  if (targetWeight !== replicaState.weight) {
    replicaState.weight = targetWeight;
    notifySubscribers(monitor, {
      type: 'weight_change',
      regionId,
      previousWeight: replicaState.weight,
      newWeight: targetWeight,
      step: stepIndex,
      timestamp: now,
    });
  }

  // Check if fully recovered
  if (stepIndex >= RECOVERY_RAMP_STEPS.length - 1 && replicaState.lagMs < 1000) {
    replicaState.health = REPLICA_HEALTH.HEALTHY;
    replicaState.recoveringSince = null;
    replicaState.weight = baseWeight;

    notifySubscribers(monitor, {
      type: 'health_change',
      regionId,
      previousHealth: REPLICA_HEALTH.RECOVERING,
      newHealth: REPLICA_HEALTH.HEALTHY,
      lagMs: replicaState.lagMs,
      issues: ['recovery_complete'],
      timestamp: now,
    });
    return { success: true, recovered: true };
  }

  return { success: true, step: stepIndex, weight: replicaState.weight };
};

/** Force replica unhealthy (emergency) */
export const forceUnhealthy = (monitor, regionId, reason, { now = Date.now() } = {}) => {
  const replicaState = monitor.state.get(regionId);
  if (!replicaState) return { success: false };

  const previousHealth = replicaState.health;
  replicaState.health = REPLICA_HEALTH.UNHEALTHY;
  replicaState.issues = [reason];

  notifySubscribers(monitor, {
    type: 'health_change',
    regionId,
    previousHealth,
    newHealth: REPLICA_HEALTH.UNHEALTHY,
    lagMs: replicaState.lagMs,
    issues: [reason],
    timestamp: now,
  });

  return { success: true };
};

// ============================================================================
// Subscription / Event System
// ============================================================================

/** Subscribe to health changes */
export const subscribe = (monitor, callback) => {
  monitor.subscribers.add(callback);
  return () => monitor.subscribers.delete(callback);
};

/** Notify all subscribers */
const notifySubscribers = (monitor, event) => {
  for (const callback of monitor.subscribers) {
    try {
      callback(event);
    } catch (error) {
      console.error('[ReplicaHealthMonitor] Subscriber error:', error);
    }
  }
};

// ============================================================================
// Metrics Export
// ============================================================================

/** Export current state for metrics/dashboards */
export const exportMetrics = (monitor) => {
  const metrics = {
    timestamp: Date.now(),
    replicas: {},
    summary: {
      total: monitor.state.size,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      draining: 0,
      recovering: 0,
    },
  };

  for (const [regionId, state] of monitor.state) {
    metrics.replicas[regionId] = {
      health: state.health,
      lagMs: state.lagMs,
      errorRate5m: state.errorRate5m,
      consecutiveErrors: state.consecutiveErrors,
      weight: state.weight,
      lastHeartbeatAgeMs: state.lastHeartbeatAt ? Date.now() - state.lastHeartbeatAt : null,
      drainingSince: state.drainingSince,
      recoveringSince: state.recoveringSince,
      lastReplicatedCommitTs: state.lastReplicatedCommitTs,
    };

    metrics.summary[state.health] = (metrics.summary[state.health] || 0) + 1;
  }

  return metrics;
};

/** Reset monitor state (for testing) */
export const resetMonitor = (monitor) => {
  monitor.state.clear();
  for (const region of getReplicaRegions()) {
    monitor.state.set(region.id, createReplicaState({ regionId: region.id }));
  }
  monitor.subscribers.clear();
};