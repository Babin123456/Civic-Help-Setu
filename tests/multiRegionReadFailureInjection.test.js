/**
 * Failure Injection Tests for Multi-Region Read Layer
 *
 * Tests system behavior under various failure conditions:
 * - Replica lag spikes
 * - Network partitions
 * - Primary unavailability (read-only)
 * - Token replay attacks
 * - Clock skew
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMultiRegionReadLayer } from '../src/services/multiRegionRead/index.js';
import { DEFAULT_CONFIG, shouldReplicateCollection } from '../src/services/multiRegionRead/types.js';
import { processHeartbeat, recordError, checkHeartbeatStaleness } from '../src/services/multiRegionRead/replicaHealthMonitor.js';

describe('Multi-Region Read Layer - Failure Injection', () => {
  let multiRegion;

  beforeEach(async () => {
    multiRegion = createMultiRegionReadLayer({
      config: { ...DEFAULT_CONFIG, ENABLED: true, ROLLOUT_PERCENT: 100 },
      tokenSecret: 'failure-test-secret',
    });

    // Set up healthy replicas for ALL replicas
    const now = Date.now();
    const lagMap = {
      'us-central1': 50,
      'europe-west1': 100,
      'asia-southeast1': 150,
      'australia-southeast1': 200,
    };
    for (const [regionId, lagMs] of Object.entries(lagMap)) {
      processHeartbeat(multiRegion.healthMonitor, {
        replicaId: regionId,
        regionId: regionId,
        lastReplicatedCommitTs: now,
        lagMs,
        healthy: true,
        errorRate5m: 0,
      });
    }
  });

  describe('Replica Lag Scenarios', () => {
    it('handles gradual lag increase', async () => {
      const decisions = [];

      // Simulate increasing lag on ALL replicas
      for (const lag of [100, 500, 1000, 2000, 5000, 10001]) {
        for (const regionId of multiRegion.healthMonitor.state.keys()) {
          processHeartbeat(multiRegion.healthMonitor, {
            replicaId: regionId,
            regionId: regionId,
            lastReplicatedCommitTs: Date.now() - lag,
            lagMs: lag,
            healthy: lag < 10000,
            errorRate5m: 0,
          });
        }

        const decision = await multiRegion.routeRead({
          collectionPath: 'services',
          clientContext: {},
        });

        decisions.push({ lag, decision });
      }

      // Initially routes to replica
      expect(decisions[0].decision.replicaId).toBe('us-central1');
      expect(decisions[0].decision.staleRead).toBe(true);

      // At degraded threshold (2000ms), still routes but degraded
      expect(decisions[3].decision.staleRead).toBe(true);

      // At unhealthy threshold (10001ms), fails over to primary
      expect(decisions[5].decision.replicaId).toBe('asia-south1');
      expect(decisions[5].decision.reason).toBe('failover_to_primary');
    });

    it('handles sudden lag spike', async () => {
      // Normal operation
      let decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });
      expect(decision.replicaId).toBe('us-central1');

      // Sudden spike on ALL replicas
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        processHeartbeat(multiRegion.healthMonitor, {
          replicaId: regionId,
          regionId: regionId,
          lastReplicatedCommitTs: Date.now() - 15000,
          lagMs: 15000,
          healthy: false,
          errorRate5m: 0,
        });
      }

      decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });
      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.failover).toBe(true);
    });

    it('recovers when lag returns to normal', async () => {
      // Spike on ALL replicas
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        processHeartbeat(multiRegion.healthMonitor, {
          replicaId: regionId,
          regionId: regionId,
          lastReplicatedCommitTs: Date.now() - 15000,
          lagMs: 15000,
          healthy: false,
          errorRate5m: 0,
        });
      }

      let decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });
      expect(decision.replicaId).toBe('asia-south1');

      // Recovery - restore ALL replicas
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        processHeartbeat(multiRegion.healthMonitor, {
          replicaId: regionId,
          regionId: regionId,
          lastReplicatedCommitTs: Date.now(),
          lagMs: regionId === 'us-central1' ? 50 : regionId === 'europe-west1' ? 100 : regionId === 'asia-southeast1' ? 150 : 200,
          healthy: true,
          errorRate5m: 0,
        });
      }

      // Trigger recovery for all replicas
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        multiRegion.manualRecovery(regionId);
        const state = multiRegion.healthMonitor.state.get(regionId);
        state.recoveringSince = Date.now() - 1000000;
      }
      const { advanceAllRecoveries } = await import('../src/services/multiRegionRead/failoverController.js');
      advanceAllRecoveries(multiRegion.failoverController);

      decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });
      expect(decision.replicaId).toBe('us-central1');
    });
  });

  describe('Error Rate Scenarios', () => {
    it('marks unhealthy when error rate exceeds threshold', async () => {
      processHeartbeat(multiRegion.healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: Date.now(),
        lagMs: 50,
        healthy: true,
        errorRate5m: 0.1, // 10% > 5% threshold
      });

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });

      expect(decision.replicaId).toBe('europe-west1'); // Fails over to other healthy replica
    });

    it('marks unhealthy after consecutive errors', async () => {
      for (let i = 0; i < 5; i++) {
        for (const regionId of multiRegion.healthMonitor.state.keys()) {
          recordError(multiRegion.healthMonitor, regionId);
        }
      }

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });

      // All replicas get errors, so all become unhealthy -> failover to primary
      expect(decision.replicaId).toBe('asia-south1');
    });
  });

  describe('Heartbeat Loss', () => {
    it('marks unhealthy when heartbeat stops', async () => {
      // Set heartbeat to old time for ALL replicas
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        const state = multiRegion.healthMonitor.state.get(regionId);
        state.lastHeartbeatAt = Date.now() - 70000; // Older than 60s TTL
      }

      checkHeartbeatStaleness(multiRegion.healthMonitor);

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });

      // All replicas have stale heartbeats -> failover to primary
      expect(decision.replicaId).toBe('asia-south1');
    });
  });

  describe('Read-Your-Writes Under Failure', () => {
    it('forces primary when replica lags behind write', async () => {
      const primaryCommitTs = Date.now();
      const { token } = await multiRegion.issueToken('user123', primaryCommitTs, 'write_123');

      // ALL replicas lag 5 seconds behind write (degraded but healthy)
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        processHeartbeat(multiRegion.healthMonitor, {
          replicaId: regionId,
          regionId: regionId,
          lastReplicatedCommitTs: primaryCommitTs - 5000,
          lagMs: 5000,
          healthy: true,
          errorRate5m: 0,
        });
      }

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: { userId: 'user123', sessionToken: token },
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.tokenValidated).toBe(true);
      expect(decision.reason).toBe('ryw_token_forced_primary');
    });

    it('allows replica read when caught up', async () => {
      const primaryCommitTs = Date.now();
      const { token } = await multiRegion.issueToken('user123', primaryCommitTs, 'write_123');

      // Replica caught up
      processHeartbeat(multiRegion.healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: primaryCommitTs + 100, // Ahead of write
        lagMs: 50,
        healthy: true,
        errorRate5m: 0,
      });

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: { userId: 'user123', sessionToken: token },
      });

      expect(decision.replicaId).toBe('us-central1');
      expect(decision.tokenValidated).toBe(true);
      expect(decision.reason).toBe('ryw_token_valid');
    });

    it('rejects replayed token', async () => {
      const { token } = await multiRegion.issueToken('user123', Date.now(), 'write_123');

      // Revoke token (simulate logout/password change)
      const tokenInfo = await multiRegion.tokenStore.getTokenInfo(token);
      multiRegion.revokeToken(tokenInfo.payload.nonce);

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: { userId: 'user123', sessionToken: token },
      });

      expect(decision.tokenValidated).toBe(false);
      expect(decision.reason).toBe('nearest_healthy');
    });

    it('rejects token for different user', async () => {
      const { token } = await multiRegion.issueToken('user123', Date.now(), 'write_123');

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: { userId: 'user456', sessionToken: token },
      });

      expect(decision.tokenValidated).toBe(false);
    });
  });

  describe('Clock Skew', () => {
    it('handles token issued in future (clock skew)', async () => {
      // Token with future issuedAt
      const futureStore = multiRegion.tokenStore;
      const futureToken = await futureStore.issueToken('user123', Date.now(), 'write_123', {
        now: Date.now() + 10000, // 10 seconds in future
      });

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: { userId: 'user123', sessionToken: futureToken.token },
      });

      // Token validation should fail due to future iat
      expect(decision.tokenValidated).toBe(false);
    });

    it('handles replica clock behind primary', async () => {
      const primaryCommitTs = Date.now();
      const { token } = await multiRegion.issueToken('user123', primaryCommitTs, 'write_123');

      // ALL replicas clock is 5 seconds behind (lastReplicatedCommitTs < actual)
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        processHeartbeat(multiRegion.healthMonitor, {
          replicaId: regionId,
          regionId: regionId,
          lastReplicatedCommitTs: primaryCommitTs - 5000,
          lagMs: 5000,
          healthy: true,
          errorRate5m: 0,
        });
      }

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: { userId: 'user123', sessionToken: token },
      });

      // Should force primary due to apparent lag
      expect(decision.reason).toBe('ryw_token_forced_primary');
    });
  });

  describe('Network Partition Simulation', () => {
    it('isolates single replica failure', async () => {
      // us-central1 fails
      multiRegion.manualFailover('us-central1', 'network_partition');

      // europe-west1 should still serve
      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: { explicitRegion: 'europe-west1' },
      });

      expect(decision.replicaId).toBe('europe-west1');
    });

    it('fails over to primary when all replicas partitioned', async () => {
      // Fail over ALL replicas
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        multiRegion.manualFailover(regionId, 'partition');
      }

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.failover).toBe(true);
    });
  });

  describe('Sensitive Data Never Leaks', () => {
    it('never routes sensitive collections to replicas even during failover', async () => {
      // All replicas fail
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        multiRegion.manualFailover(regionId, 'test');
      }

      // Sensitive collection still routes to primary (which is correct)
      const decision = await multiRegion.routeRead({
        collectionPath: 'users',
        clientContext: {},
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.consistencyLevel).toBe('strong');
    });

    it('rejects replication for sensitive collections', () => {
      const sensitiveCollections = [
        'users',
        'users/user123/vaultDocs',
        'applications',
        'grievanceTickets',
        'privacyExports',
        'auditLogs',
        'roles',
      ];

      for (const collection of sensitiveCollections) {
        expect(shouldReplicateCollection(collection)).toBe(false);
      }
    });
  });

  describe('Emergency Kill Switch', () => {
    it('disables multi-region reads instantly', async () => {
      // Normal operation
      let decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });
      expect(decision.replicaId).toBe('us-central1');

      // Emergency disable
      multiRegion.disableMultiRegionReads('emergency');

      decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });
      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.reason).toBe('primary_only');
    });

    it('re-enables after emergency', async () => {
      multiRegion.disableMultiRegionReads('emergency');

      let decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });
      expect(decision.replicaId).toBe('asia-south1');

      multiRegion.enableMultiRegionReads(100);

      decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });
      expect(decision.replicaId).toBe('us-central1');
    });
  });
});