/**
 * Tests for Failover Controller
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createFailoverController,
  initializeController,
  shutdownController,
  manualFailover,
  manualRecovery,
  disableMultiRegionReads,
  enableMultiRegionReads,
  setRolloutPercent,
  trackDrainingRequest,
  exportControllerMetrics,
  getFailoverStatus,
  advanceAllRecoveries,
} from '../failoverController.js';
import { REPLICA_HEALTH } from '../types.js';
import { createReplicaHealthMonitor, processHeartbeat } from '../replicaHealthMonitor.js';
import { createReadRouter, getRuntimeConfig } from '../readRouter.js';
import { createSessionTokenStore } from '../sessionTokenStore.js';
import { DEFAULT_CONFIG } from '../types.js';

describe('Failover Controller', () => {
  let controller;
  let healthMonitor;
  let router;
  let tokenStore;
  let alerts;
  let configChanges;
  let metrics;

  beforeEach(() => {
    alerts = [];
    configChanges = [];
    metrics = [];

    healthMonitor = createReplicaHealthMonitor({ config: DEFAULT_CONFIG });
    tokenStore = createSessionTokenStore({ secret: 'test', config: DEFAULT_CONFIG });
    router = createReadRouter({ healthMonitor, tokenStore, config: DEFAULT_CONFIG });

    // Set up healthy replicas
    processHeartbeat(healthMonitor, {
      replicaId: 'us-central1',
      regionId: 'us-central1',
      lastReplicatedCommitTs: Date.now(),
      lagMs: 50,
      healthy: true,
      errorRate5m: 0,
    });
    processHeartbeat(healthMonitor, {
      replicaId: 'europe-west1',
      regionId: 'europe-west1',
      lastReplicatedCommitTs: Date.now(),
      lagMs: 100,
      healthy: true,
      errorRate5m: 0,
    });

    controller = createFailoverController({
      healthMonitor,
      router,
      config: DEFAULT_CONFIG,
      onAlert: (alert) => alerts.push(alert),
      onConfigChange: (config) => configChanges.push(config),
      onMetrics: (m) => metrics.push(m),
    });
  });

  afterEach(() => {
    shutdownController(controller);
  });

  describe('Initialization', () => {
    it('starts timers on initialize', () => {
      initializeController(controller);
      expect(controller.recoveryTimer).toBeDefined();
      expect(controller.metricsTimer).toBeDefined();
      expect(controller.initialized).toBe(true);

      shutdownController(controller);
      expect(controller.initialized).toBe(false);
    });
  });

  describe('Automatic Failover', () => {
    beforeEach(() => {
      initializeController(controller);
    });

    it('initiates failover when replica becomes unhealthy', () => {
      // Make replica unhealthy
      processHeartbeat(healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: Date.now() - 15000,
        lagMs: 15000,
        healthy: false,
        errorRate5m: 0,
      });

      // Check failover initiated
      const failoverAlert = alerts.find((a) => a.type === 'failover_initiated');
      expect(failoverAlert).toBeDefined();
      expect(failoverAlert.regionId).toBe('us-central1');

      // Check replica is draining
      const state = healthMonitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.DRAINING);

      // Check weight set to 0
      const config = configChanges[configChanges.length - 1];
      expect(config.weightOverrides['us-central1']).toBe(0);
    });

    it('initiates recovery when replica becomes healthy after failover', () => {
      // First trigger failover (sets to DRAINING)
      processHeartbeat(healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: Date.now() - 15000,
        lagMs: 15000,
        healthy: false,
        errorRate5m: 0,
      });

      // Verify failover happened
      const failoverAlert = alerts.find((a) => a.type === 'failover_initiated');
      expect(failoverAlert).toBeDefined();

      alerts.length = 0;
      configChanges.length = 0;

      // Manually initiate recovery (simulates operator action or auto-recovery after observation)
      const result = manualRecovery(controller, 'us-central1');
      expect(result.success).toBe(true);

      // Check recovery initiated
      const recoveryAlert = alerts.find((a) => a.type === 'recovery_initiated');
      expect(recoveryAlert).toBeDefined();
      expect(recoveryAlert.regionId).toBe('us-central1');
      expect(recoveryAlert.initialWeight).toBe(10); // 10% of base 100

      // Verify state is RECOVERING
      const state = healthMonitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.RECOVERING);
    });
  });

  describe('Manual Operations', () => {
    beforeEach(() => {
      initializeController(controller);
    });

    it('manually triggers failover', () => {
      const result = manualFailover(controller, 'us-central1', 'manual_test');
      expect(result.success).toBe(true);

      const state = healthMonitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.DRAINING);
    });

    it('rejects failover on already unhealthy replica', () => {
      processHeartbeat(healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: Date.now() - 15000,
        lagMs: 15000,
        healthy: false,
        errorRate5m: 0,
      });
      const result = manualFailover(controller, 'us-central1', 'manual_test');
      expect(result.success).toBe(false);
    });

    it('manually triggers recovery', () => {
      processHeartbeat(healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: Date.now() - 15000,
        lagMs: 15000,
        healthy: false,
        errorRate5m: 0,
      });
      const result = manualRecovery(controller, 'us-central1');
      expect(result.success).toBe(true);

      const state = healthMonitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.RECOVERING);
    });

    it('rejects recovery on healthy replica', () => {
      const result = manualRecovery(controller, 'us-central1');
      expect(result.success).toBe(false);
    });

    it('disables multi-region reads', () => {
      const result = disableMultiRegionReads(controller, 'emergency');
      expect(result.success).toBe(true);

      const config = getRuntimeConfig(router);
      expect(config.enabled).toBe(false);

      const alert = alerts.find((a) => a.type === 'multi_region_disabled');
      expect(alert).toBeDefined();
    });

    it('enables multi-region reads', () => {
      disableMultiRegionReads(controller);
      alerts.length = 0;

      const result = enableMultiRegionReads(controller, 50);
      expect(result.success).toBe(true);

      const config = getRuntimeConfig(router);
      expect(config.enabled).toBe(true);
      expect(config.rolloutPercent).toBe(50);
    });

    it('sets rollout percentage', () => {
      const result = setRolloutPercent(controller, 25);
      expect(result.success).toBe(true);
      expect(result.rolloutPercent).toBe(25);

      const config = getRuntimeConfig(router);
      expect(config.rolloutPercent).toBe(25);
    });

    it('clamps rollout percentage', () => {
      setRolloutPercent(controller, 150);
      expect(getRuntimeConfig(router).rolloutPercent).toBe(100);

      setRolloutPercent(controller, -10);
      expect(getRuntimeConfig(router).rolloutPercent).toBe(0);
    });
  });

  describe('Drain Tracking', () => {
    beforeEach(() => {
      initializeController(controller);
    });

    it('tracks in-flight requests during drain', () => {
      processHeartbeat(healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: Date.now() - 15000,
        lagMs: 15000,
        healthy: false,
        errorRate5m: 0,
      });

      trackDrainingRequest(controller, 'us-central1', 1);
      trackDrainingRequest(controller, 'us-central1', 1);
      expect(controller.drainingRequests.get('us-central1')).toBe(2);

      trackDrainingRequest(controller, 'us-central1', -1);
      expect(controller.drainingRequests.get('us-central1')).toBe(1);
    });
  });

  describe('Metrics', () => {
    beforeEach(() => {
      initializeController(controller);
    });

    it('exports controller metrics', () => {
      const m = exportControllerMetrics(controller);
      expect(m.timestamp).toBeDefined();
      expect(m.controller.enabled).toBe(true);
      expect(m.health.replicas['us-central1']).toBeDefined();
    });

    it('gets failover status', () => {
      const status = getFailoverStatus(controller);
      expect(status.enabled).toBe(true);
      expect(status.primaryRegion).toBe('asia-south1');
      expect(status.replicas['us-central1']).toBeDefined();
    });
  });

  describe('Recovery Ramp', () => {
    beforeEach(() => {
      initializeController(controller);
    });

    it('advances recovery ramp over time', () => {
      // Start recovery
      processHeartbeat(healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: Date.now() - 15000,
        lagMs: 15000,
        healthy: false,
        errorRate5m: 0,
      });
      processHeartbeat(healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: Date.now(),
        lagMs: 50,
        healthy: true,
        errorRate5m: 0,
      });

      // Manually advance recovery time
      const state = healthMonitor.state.get('us-central1');
      state.recoveringSince = Date.now() - 200000; // Past first ramp step

      advanceAllRecoveries(controller);

      // Weight should increase
      const newState = healthMonitor.state.get('us-central1');
      expect(newState.weight).toBeGreaterThan(10);
    });

    it('completes recovery when fully ramped', () => {
      // Trigger failover
      processHeartbeat(healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: Date.now() - 15000,
        lagMs: 15000,
        healthy: false,
        errorRate5m: 0,
      });

      // Initiate recovery
      manualRecovery(controller, 'us-central1');
      alerts.length = 0;
      configChanges.length = 0;

      // Set recovery time far in past
      const state = healthMonitor.state.get('us-central1');
      state.recoveringSince = Date.now() - 1000000; // Past all ramp steps
      state.lagMs = 50;

      advanceAllRecoveries(controller);

      const newState = healthMonitor.state.get('us-central1');
      expect(newState.health).toBe(REPLICA_HEALTH.HEALTHY);
      expect(newState.weight).toBe(100); // Back to base

      // Check for recovery_complete alert (fired as replica_health_change with recovery_complete issue)
      const alert = alerts.find((a) => a.type === 'replica_health_change' && a.issues?.includes('recovery_complete'));
      expect(alert).toBeDefined();
    });
  });
});