/**
 * Tests for Replica Health Monitor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createReplicaHealthMonitor,
  processHeartbeat,
  recordError,
  recordSuccess,
  checkHeartbeatStaleness,
  getReplicaHealth,
  getAllReplicaHealth,
  getHealthyReplicas,
  getBestReplica,
  hasHealthyReplicas,
  setDraining,
  setRecovering,
  advanceRecoveryRamp,
  forceUnhealthy,
  subscribe,
  exportMetrics,
  resetMonitor,
} from '../replicaHealthMonitor.js';
import { DEFAULT_CONFIG, REPLICA_HEALTH } from '../types.js';

describe('Replica Health Monitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = createReplicaHealthMonitor({ config: DEFAULT_CONFIG });
  });

  // Helper to set up healthy heartbeats for all replicas
  const setupHealthyReplicas = (monitor) => {
    const now = Date.now();
    for (const regionId of monitor.state.keys()) {
      processHeartbeat(monitor, {
        replicaId: regionId,
        regionId: regionId,
        lastReplicatedCommitTs: now,
        lagMs: regionId === 'us-central1' ? 50 : regionId === 'europe-west1' ? 100 : regionId === 'asia-southeast1' ? 150 : 200,
        healthy: true,
        errorRate5m: 0,
      });
    }
  };

  describe('Initialization', () => {
    it('initializes with replica regions from registry', () => {
      const states = Array.from(monitor.state.values());
      expect(states.length).toBeGreaterThan(0);
      for (const state of states) {
        expect(state.health).toBe(REPLICA_HEALTH.HEALTHY);
        expect(state.lagMs).toBe(0);
      }
    });
  });

  describe('Heartbeat Processing', () => {
    it('updates replica state from heartbeat', () => {
      const result = processHeartbeat(monitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 100,
        healthy: true,
        errorRate5m: 0.0,
      });

      expect(result.success).toBe(true);
      expect(result.health).toBe(REPLICA_HEALTH.HEALTHY);

      const state = monitor.state.get('us-central1');
      expect(state.lastReplicatedCommitTs).toBe(1000000);
      expect(state.lagMs).toBe(100);
    });

    it('marks degraded when lag exceeds threshold', () => {
      processHeartbeat(monitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 3000, // > DEGRADED_LAG_MS (2000)
        healthy: true,
        errorRate5m: 0.0,
      });

      const state = monitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.DEGRADED);
    });

    it('marks unhealthy when lag exceeds critical threshold', () => {
      processHeartbeat(monitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 15000, // > UNHEALTHY_LAG_MS (10000)
        healthy: true,
        errorRate5m: 0.0,
      });

      const state = monitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.UNHEALTHY);
    });

    it('marks unhealthy when error rate exceeds threshold', () => {
      processHeartbeat(monitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 100,
        healthy: true,
        errorRate5m: 0.1, // > MAX_ERROR_RATE_5M (0.05)
      });

      const state = monitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.UNHEALTHY);
    });

    it('marks unhealthy when heartbeat reports unhealthy', () => {
      processHeartbeat(monitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 100,
        healthy: false, // Explicit unhealthy
        errorRate5m: 0.0,
      });

      const state = monitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.UNHEALTHY);
    });

    it('ignores heartbeats for primary region', () => {
      const result = processHeartbeat(monitor, {
        replicaId: 'asia-south1',
        regionId: 'asia-south1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 0,
        healthy: true,
        errorRate5m: 0.0,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Primary region');
    });

    it('ignores heartbeats for unknown regions', () => {
      const result = processHeartbeat(monitor, {
        replicaId: 'unknown-region',
        regionId: 'unknown-region',
        lastReplicatedCommitTs: 1000000,
        lagMs: 100,
        healthy: true,
        errorRate5m: 0.0,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Unknown region');
    });
  });

  describe('Error Recording', () => {
    it('increments consecutive errors', () => {
      recordError(monitor, 'us-central1');
      recordError(monitor, 'us-central1');

      const state = monitor.state.get('us-central1');
      expect(state.consecutiveErrors).toBe(2);
    });

    it('marks unhealthy after max consecutive errors', () => {
      const { MAX_CONSECUTIVE_ERRORS } = DEFAULT_CONFIG;
      for (let i = 0; i < MAX_CONSECUTIVE_ERRORS; i++) {
        recordError(monitor, 'us-central1');
      }

      const state = monitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.UNHEALTHY);
    });

    it('resets consecutive errors on success', () => {
      recordError(monitor, 'us-central1');
      recordError(monitor, 'us-central1');
      recordSuccess(monitor, 'us-central1');

      const state = monitor.state.get('us-central1');
      expect(state.consecutiveErrors).toBe(0);
    });
  });

  describe('Heartbeat Staleness', () => {
    it('marks unhealthy when heartbeat is stale', () => {
      // Set a heartbeat in the past
      processHeartbeat(monitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 100,
        healthy: true,
        errorRate5m: 0.0,
      });

      // Manually set lastHeartbeatAt to old timestamp
      const state = monitor.state.get('us-central1');
      state.lastHeartbeatAt = Date.now() - 70000; // Older than HEARTBEAT_TTL_MS (60000)

      const results = checkHeartbeatStaleness(monitor);
      expect(results.length).toBe(1);
      expect(results[0].stale).toBe(true);
      expect(state.health).toBe(REPLICA_HEALTH.UNHEALTHY);
    });
  });

  describe('Health Queries', () => {
    beforeEach(() => {
      setupHealthyReplicas(monitor);
    });

    it('gets health for a replica', () => {
      const health = getReplicaHealth(monitor, 'us-central1');
      expect(health.regionId).toBe('us-central1');
      expect(health.healthy).toBe(true);
      expect(health.lagMs).toBe(50);
    });

    it('returns null for unknown replica', () => {
      expect(getReplicaHealth(monitor, 'unknown')).toBeNull();
    });

    it('gets all replica health', () => {
      const all = getAllReplicaHealth(monitor);
      expect(all['us-central1']).toBeDefined();
      expect(all['europe-west1']).toBeDefined();
    });

    it('gets healthy replicas sorted by lag', () => {
      const healthy = getHealthyReplicas(monitor);
      // All 4 replicas are healthy with different lags
      expect(healthy.length).toBe(4);
      // us-central1 has lowest lag (50)
      expect(healthy[0].regionId).toBe('us-central1');
      expect(healthy[1].regionId).toBe('europe-west1');
      expect(healthy[2].regionId).toBe('asia-southeast1');
      expect(healthy[3].regionId).toBe('australia-southeast1');
    });

    it('gets best replica', () => {
      const best = getBestReplica(monitor);
      expect(best.regionId).toBe('us-central1');
    });

    it('prefers explicit region if healthy', () => {
      const best = getBestReplica(monitor, 'europe-west1');
      expect(best.regionId).toBe('europe-west1');
    });

    it('returns null when no healthy replicas', () => {
      // Mark all unhealthy
      for (const regionId of monitor.state.keys()) {
        forceUnhealthy(monitor, regionId, 'test');
      }
      expect(getBestReplica(monitor)).toBeNull();
      expect(hasHealthyReplicas(monitor)).toBe(false);
    });
  });

  describe('Failover State Management', () => {
    beforeEach(() => {
      setupHealthyReplicas(monitor);
    });

    it('sets draining state', () => {
      const result = setDraining(monitor, 'us-central1');
      expect(result.success).toBe(true);

      const state = monitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.DRAINING);
      expect(state.drainingSince).toBeDefined();
    });

    it('sets recovering state', () => {
      setDraining(monitor, 'us-central1');
      const result = setRecovering(monitor, 'us-central1');
      expect(result.success).toBe(true);

      const state = monitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.RECOVERING);
      expect(state.recoveringSince).toBeDefined();
      expect(state.weight).toBeLessThan(100); // Reduced weight
    });

    it('advances recovery ramp', () => {
      setDraining(monitor, 'us-central1');
      setRecovering(monitor, 'us-central1');

      // Manually set lag low and advance time
      const state = monitor.state.get('us-central1');
      state.lagMs = 50;
      state.recoveringSince = Date.now() - 200000; // Past observation window

      const result = advanceRecoveryRamp(monitor, 'us-central1');
      expect(result.success).toBe(true);
      // When not fully recovered, result.weight should be defined and > state.weight
      if (!result.recovered) {
        expect(result.weight).toBeGreaterThan(state.weight);
      }
    });

    it('completes recovery when fully ramped', () => {
      setDraining(monitor, 'us-central1');
      setRecovering(monitor, 'us-central1');

      const state = monitor.state.get('us-central1');
      state.lagMs = 50;
      state.recoveringSince = Date.now() - 1000000; // Far past all ramp steps

      const result = advanceRecoveryRamp(monitor, 'us-central1');
      expect(result.success).toBe(true);
      expect(result.recovered).toBe(true);
      expect(state.health).toBe(REPLICA_HEALTH.HEALTHY);
      expect(state.weight).toBe(100); // Back to base weight
    });

    it('forces unhealthy', () => {
      const result = forceUnhealthy(monitor, 'us-central1', 'manual_override');
      expect(result.success).toBe(true);

      const state = monitor.state.get('us-central1');
      expect(state.health).toBe(REPLICA_HEALTH.UNHEALTHY);
      expect(state.issues).toContain('manual_override');
    });
  });

  describe('Subscriptions', () => {
    it('notifies subscribers on health change', () => {
      const callback = vi.fn();
      const unsubscribe = subscribe(monitor, callback);

      processHeartbeat(monitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 3000, // Triggers degraded
        healthy: true,
        errorRate5m: 0.0,
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'health_change',
          regionId: 'us-central1',
          newHealth: REPLICA_HEALTH.DEGRADED,
        })
      );

      unsubscribe();
      callback.mockClear();

      processHeartbeat(monitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 100,
        healthy: true,
        errorRate5m: 0.0,
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Metrics Export', () => {
    it('exports metrics with summary', () => {
      processHeartbeat(monitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 50,
        healthy: true,
        errorRate5m: 0.0,
      });

      const metrics = exportMetrics(monitor);
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.replicas['us-central1']).toBeDefined();
      expect(metrics.summary.healthy).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    it('resets monitor state', () => {
      processHeartbeat(monitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 50,
        healthy: true,
        errorRate5m: 0.0,
      });

      resetMonitor(monitor);

      const state = monitor.state.get('us-central1');
      expect(state.lagMs).toBe(0);
      expect(state.health).toBe(REPLICA_HEALTH.HEALTHY);
    });
  });
});