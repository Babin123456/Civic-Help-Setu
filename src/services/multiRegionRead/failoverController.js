/**
 * Failover Controller — Manages replica failover, draining, and recovery
 *
 * Coordinates between health monitor, router, and external alerting.
 * Pure logic; side effects (alerts, config updates) via callbacks.
 */

import {
  REPLICA_HEALTH,
  DEFAULT_CONFIG,
} from './types.js';
import {
  getRegion,
  setRegionWeightOverride,
} from './regionRegistry.js';
import {
  setDraining,
  setRecovering,
  advanceRecoveryRamp,
  forceUnhealthy,
  subscribe as subscribeHealth,
  exportMetrics as exportHealthMetrics,
} from './replicaHealthMonitor.js';
import { updateRuntimeConfig, getRuntimeConfig } from './readRouter.js';

// ============================================================================
// Failover Controller State
// ============================================================================

/** Create a failover controller */
export const createFailoverController = ({
  healthMonitor,
  router,
  config = DEFAULT_CONFIG,
  onAlert = null,          // (alert) => void — send to alerting system
  onConfigChange = null,   // (config) => void — persist runtime config
  onMetrics = null,        // (metrics) => void — send to metrics system
} = {}) => {
  const controller = {
    healthMonitor,
    router,
    config,
    callbacks: { onAlert, onConfigChange, onMetrics },
    timers: new Map(),     // regionId -> timer handles
    drainingRequests: new Map(), // regionId -> count
    initialized: false,
  };

  // Subscribe to health changes
  controller.healthUnsubscribe = subscribeHealth(healthMonitor, (event) => {
    handleHealthEvent(controller, event);
  });

  return controller;
};

/** Initialize controller (start periodic tasks) */
export const initializeController = (controller) => {
  if (controller.initialized) return;

  // Periodic recovery ramp advancement
  controller.recoveryTimer = setInterval(() => {
    advanceAllRecoveries(controller);
  }, 30000); // Every 30 seconds

  // Periodic metrics export
  controller.metricsTimer = setInterval(() => {
    exportControllerMetrics(controller);
  }, 60000); // Every minute

  controller.initialized = true;
};

/** Shutdown controller */
export const shutdownController = (controller) => {
  if (controller.healthUnsubscribe) controller.healthUnsubscribe();
  if (controller.recoveryTimer) clearInterval(controller.recoveryTimer);
  if (controller.metricsTimer) clearInterval(controller.metricsTimer);
  for (const timer of controller.timers.values()) {
    clearTimeout(timer);
  }
  controller.timers.clear();
  controller.initialized = false;
};

// ============================================================================
// Health Event Handling
// ============================================================================

/** Handle health change events from monitor */
const handleHealthEvent = (controller, event) => {
  const { type, regionId, newHealth, previousHealth } = event;

  if (type !== 'health_change') return;

  // Replica became unhealthy — initiate failover
  if (isUnhealthy(newHealth) && !isUnhealthy(previousHealth)) {
    initiateFailover(controller, regionId, event.issues || ['health_check_failed']);
  }

  // Replica recovered from unhealthy — start recovery
  if (newHealth === REPLICA_HEALTH.HEALTHY && isUnhealthy(previousHealth)) {
    initiateRecovery(controller, regionId);
  }

  // Replica entered draining — track in-flight requests
  if (newHealth === REPLICA_HEALTH.DRAINING) {
    controller.drainingRequests.set(regionId, 0);
    // Auto-complete drain after timeout
    scheduleDrainTimeout(controller, regionId);
  }

  // Emit alert
  if (controller.callbacks.onAlert) {
    controller.callbacks.onAlert({
      type: 'replica_health_change',
      regionId,
      previousHealth,
      newHealth,
      issues: event.issues,
      timestamp: event.timestamp,
    });
  }
};

/** Check if health state is unhealthy */
const isUnhealthy = (health) => health === REPLICA_HEALTH.UNHEALTHY || health === REPLICA_HEALTH.DRAINING;

// ============================================================================
// Failover Actions
// ============================================================================

/** Initiate failover for a replica */
const initiateFailover = (controller, regionId, issues) => {
  // 1. Mark as draining (stops new requests)
  setDraining(controller.healthMonitor, regionId);

  // 2. Set weight to 0 in router (immediate routing exclusion)
  const runtimeConfig = getRuntimeConfig(controller.router);
  const newOverrides = setRegionWeightOverride({ ...runtimeConfig.weightOverrides }, regionId, 0);
  updateRuntimeConfig(controller.router, { weightOverrides: newOverrides });

  // 3. Notify config change callback
  if (controller.callbacks.onConfigChange) {
    controller.callbacks.onConfigChange(getRuntimeConfig(controller.router));
  }

  // 4. Emit alert
  if (controller.callbacks.onAlert) {
    controller.callbacks.onAlert({
      type: 'failover_initiated',
      regionId,
      reason: issues.join('; '),
      action: 'draining_and_weight_zero',
      timestamp: Date.now(),
    });
  }
};

/** Initiate recovery for a replica */
const initiateRecovery = (controller, regionId) => {
  // 1. Mark as recovering (starts at 10% weight)
  setRecovering(controller.healthMonitor, regionId);

  // 2. Update router weight to 10%
  const regionConfig = getRegion(regionId);
  const baseWeight = regionConfig?.weight || 100;
  const recoveryWeight = Math.floor(baseWeight * 0.1);

  const runtimeConfig = getRuntimeConfig(controller.router);
  const newOverrides = setRegionWeightOverride({ ...runtimeConfig.weightOverrides }, regionId, recoveryWeight);
  updateRuntimeConfig(controller.router, { weightOverrides: newOverrides });

  // 3. Notify config change
  if (controller.callbacks.onConfigChange) {
    controller.callbacks.onConfigChange(getRuntimeConfig(controller.router));
  }

  // 4. Emit alert
  if (controller.callbacks.onAlert) {
    controller.callbacks.onAlert({
      type: 'recovery_initiated',
      regionId,
      initialWeight: recoveryWeight,
      baseWeight,
      timestamp: Date.now(),
    });
  }
};

/** Advance recovery ramp for all recovering replicas */
export const advanceAllRecoveries = (controller) => {
  for (const [regionId, state] of controller.healthMonitor.state) {
    if (state.health === REPLICA_HEALTH.RECOVERING) {
      const result = advanceRecoveryRamp(controller.healthMonitor, regionId);

      if (result.success && result.weight !== undefined) {
        // Update router weight
        const runtimeConfig = getRuntimeConfig(controller.router);
        const newOverrides = setRegionWeightOverride({ ...runtimeConfig.weightOverrides }, regionId, result.weight);
        updateRuntimeConfig(controller.router, { weightOverrides: newOverrides });

        if (controller.callbacks.onConfigChange) {
          controller.callbacks.onConfigChange(getRuntimeConfig(controller.router));
        }

        // Check if fully recovered
        if (result.recovered) {
          if (controller.callbacks.onAlert) {
            controller.callbacks.onAlert({
              type: 'recovery_complete',
              regionId,
              finalWeight: result.weight,
              timestamp: Date.now(),
            });
          }
        }
      }
    }
  }
};

/** Schedule drain timeout — force unhealthy if not drained in time */
const scheduleDrainTimeout = (controller, regionId) => {
  const { DRAIN_TIMEOUT_MS } = controller.config;

  const timer = setTimeout(() => {
    controller.timers.delete(regionId);
    const drainingCount = controller.drainingRequests.get(regionId) || 0;

    if (drainingCount > 0) {
      // Still has in-flight requests — log warning but continue
      if (controller.callbacks.onAlert) {
        controller.callbacks.onAlert({
          type: 'drain_timeout',
          regionId,
          remainingRequests: drainingCount,
          action: 'continuing_drain',
          timestamp: Date.now(),
        });
      }
      // Reschedule
      scheduleDrainTimeout(controller, regionId);
    } else {
      // Fully drained — mark unhealthy
      forceUnhealthy(controller.healthMonitor, regionId, 'drain_complete');
      controller.drainingRequests.delete(regionId);

      if (controller.callbacks.onAlert) {
        controller.callbacks.onAlert({
          type: 'drain_complete',
          regionId,
          action: 'marked_unhealthy',
          timestamp: Date.now(),
        });
      }
    }
  }, DRAIN_TIMEOUT_MS);

  controller.timers.set(regionId, timer);
};

/** Track in-flight request on a draining replica */
export const trackDrainingRequest = (controller, regionId, delta) => {
  if (!controller.drainingRequests.has(regionId)) return;

  const count = Math.max(0, (controller.drainingRequests.get(regionId) || 0) + delta);
  controller.drainingRequests.set(regionId, count);
};

// ============================================================================
// Manual Operations
// ============================================================================

/** Manually trigger failover for a replica (emergency) */
export const manualFailover = (controller, regionId, reason = 'manual_failover') => {
  const state = controller.healthMonitor.state.get(regionId);
  if (!state) return { success: false, reason: 'Replica not found' };

  if (state.health === REPLICA_HEALTH.UNHEALTHY || state.health === REPLICA_HEALTH.DRAINING) {
    return { success: false, reason: 'Already failing over' };
  }

  initiateFailover(controller, regionId, [reason]);
  return { success: true };
};

/** Manually trigger recovery for a replica */
export const manualRecovery = (controller, regionId) => {
  const state = controller.healthMonitor.state.get(regionId);
  if (!state) return { success: false, reason: 'Replica not found' };

  // Allow recovery from both UNHEALTHY and DRAINING states
  if (state.health !== REPLICA_HEALTH.UNHEALTHY && state.health !== REPLICA_HEALTH.DRAINING) {
    return { success: false, reason: 'Replica not in unhealthy or draining state' };
  }

  initiateRecovery(controller, regionId);
  return { success: true };
};

/** Disable multi-region reads entirely (emergency kill switch) */
export const disableMultiRegionReads = (controller, reason = 'emergency_disable') => {
  updateRuntimeConfig(controller.router, { enabled: false });

  if (controller.callbacks.onConfigChange) {
    controller.callbacks.onConfigChange(getRuntimeConfig(controller.router));
  }

  if (controller.callbacks.onAlert) {
    controller.callbacks.onAlert({
      type: 'multi_region_disabled',
      reason,
      timestamp: Date.now(),
    });
  }

  return { success: true };
};

/** Re-enable multi-region reads */
export const enableMultiRegionReads = (controller, rolloutPercent = 100) => {
  updateRuntimeConfig(controller.router, { enabled: true, rolloutPercent });

  if (controller.callbacks.onConfigChange) {
    controller.callbacks.onConfigChange(getRuntimeConfig(controller.router));
  }

  if (controller.callbacks.onAlert) {
    controller.callbacks.onAlert({
      type: 'multi_region_enabled',
      rolloutPercent,
      timestamp: Date.now(),
    });
  }

  return { success: true };
};

/** Set rollout percentage */
export const setRolloutPercent = (controller, percent) => {
  const clamped = Math.max(0, Math.min(100, percent));
  updateRuntimeConfig(controller.router, { rolloutPercent: clamped });

  if (controller.callbacks.onConfigChange) {
    controller.callbacks.onConfigChange(getRuntimeConfig(controller.router));
  }

  return { success: true, rolloutPercent: clamped };
};

// ============================================================================
// Metrics Export
// ============================================================================

/** Export controller metrics */
export const exportControllerMetrics = (controller) => {
  const healthMetrics = exportHealthMetrics(controller.healthMonitor);
  const routerConfig = getRuntimeConfig(controller.router);

  const metrics = {
    timestamp: Date.now(),
    controller: {
      enabled: routerConfig.enabled,
      rolloutPercent: routerConfig.rolloutPercent,
      primaryRegionId: routerConfig.primaryRegionId,
      weightOverrides: routerConfig.weightOverrides,
      drainingReplicas: controller.drainingRequests.size,
    },
    health: healthMetrics,
  };

  if (controller.callbacks.onMetrics) {
    controller.callbacks.onMetrics(metrics);
  }

  return metrics;
};

/** Get failover status summary */
export const getFailoverStatus = (controller) => {
  const healthMetrics = exportHealthMetrics(controller.healthMonitor);
  const routerConfig = getRuntimeConfig(controller.router);

  return {
    enabled: routerConfig.enabled,
    rolloutPercent: routerConfig.rolloutPercent,
    primaryRegion: routerConfig.primaryRegionId,
    replicas: healthMetrics.replicas,
    summary: healthMetrics.summary,
    draining: Object.fromEntries(controller.drainingRequests),
    weightOverrides: routerConfig.weightOverrides,
  };
};

// ============================================================================
// Test Helpers
// ============================================================================

export const __testExports = {
  initiateFailover,
  initiateRecovery,
  advanceAllRecoveries,
  scheduleDrainTimeout,
  handleHealthEvent,
};