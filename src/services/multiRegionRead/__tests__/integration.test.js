/**
 * Integration Tests for Multi-Region Read Layer
 *
 * Tests the complete flow: routing -> token validation -> failover -> recovery
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMultiRegionReadLayer } from '../index.js';
import { DEFAULT_CONFIG } from '../types.js';
import { processHeartbeat, getHealthyReplicas } from '../replicaHealthMonitor.js';
import { advanceAllRecoveries } from '../failoverController.js';

describe('Multi-Region Read Layer Integration', () => {
  let multiRegion;

  beforeEach(async () => {
    multiRegion = createMultiRegionReadLayer({
      config: {
        ...DEFAULT_CONFIG,
        ENABLED: true,
        ROLLOUT_PERCENT: 100,
      },
      tokenSecret: 'integration-test-secret',
    });

    // Set up healthy replicas with current timestamps for ALL replicas
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

  describe('Read-Your-Writes Consistency', () => {
    it('issues token on write and validates on subsequent read', async () => {
      // Simulate a write
      const writeOpId = 'write_123';
      const primaryCommitTs = Date.now();
      const { token } = await multiRegion.issueToken('user123', primaryCommitTs, writeOpId);

      // Ensure replica is caught up by updating its heartbeat to be ahead of the write
      processHeartbeat(multiRegion.healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: primaryCommitTs + 100, // Ahead of the write
        lagMs: 50,
        healthy: true,
        errorRate5m: 0,
      });

      // Debug: check replica state
      const replicaState = multiRegion.healthMonitor.state.get('us-central1');
      console.log('Replica state after heartbeat:', {
        lastReplicatedCommitTs: replicaState.lastReplicatedCommitTs,
        lagMs: replicaState.lagMs,
        primaryCommitTs,
        caughtUp: replicaState.lastReplicatedCommitTs >= primaryCommitTs,
      });

      // Debug: check what getHealthyReplicas returns
      const healthyReplicas = getHealthyReplicas(multiRegion.healthMonitor);
      console.log('Healthy replicas:', healthyReplicas.map(r => ({ regionId: r.regionId, lagMs: r.state.lagMs, lastReplicatedCommitTs: r.state.lastReplicatedCommitTs })));

      // Simulate read with token - replica is caught up
      const routingDecision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {
          userId: 'user123',
          sessionToken: token,
        },
      });

      expect(routingDecision.tokenValidated).toBe(true);
      expect(routingDecision.reason).toBe('ryw_token_valid');
      expect(routingDecision.replicaId).toBe('us-central1');
    });

    it('forces primary read when replica lags behind write', async () => {
      const primaryCommitTs = Date.now();
      const { token } = await multiRegion.issueToken('user123', primaryCommitTs, 'write_123');

      // Make ALL replicas lag behind the write
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        processHeartbeat(multiRegion.healthMonitor, {
          replicaId: regionId,
          regionId: regionId,
          lastReplicatedCommitTs: primaryCommitTs - 5000, // 5 seconds behind
          lagMs: 5000,
          healthy: true,
          errorRate5m: 0,
        });
      }

      const routingDecision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {
          userId: 'user123',
          sessionToken: token,
        },
      });

      expect(routingDecision.tokenValidated).toBe(true);
      expect(routingDecision.reason).toBe('ryw_token_forced_primary');
      expect(routingDecision.replicaId).toBe('asia-south1');
      expect(routingDecision.consistencyLevel).toBe('strong');
    });

    it('allows stale read when no token provided', async () => {
      // Make ALL replicas lag
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        processHeartbeat(multiRegion.healthMonitor, {
          replicaId: regionId,
          regionId: regionId,
          lastReplicatedCommitTs: Date.now() - 5000,
          lagMs: 5000,
          healthy: true,
          errorRate5m: 0,
        });
      }

      const routingDecision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: { userId: 'user123' }, // No token
      });

      expect(routingDecision.tokenValidated).toBe(false);
      expect(routingDecision.staleRead).toBe(true);
    });
  });

  describe('Failover and Recovery', () => {
    it('fails over to primary when all replicas unhealthy', async () => {
      // Make ALL replicas unhealthy
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        multiRegion.manualFailover(regionId, 'test');
      }

      const routingDecision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });

      expect(routingDecision.replicaId).toBe('asia-south1');
      expect(routingDecision.reason).toBe('failover_to_primary');
      expect(routingDecision.failover).toBe(true);
    });

    it('recovers replica gradually', async () => {
      // Fail over one replica
      multiRegion.manualFailover('us-central1', 'test');

      // Start recovery
      multiRegion.manualRecovery('us-central1');

      // Simulate time passing and replica catching up
      const state = multiRegion.healthMonitor.state.get('us-central1');
      state.lagMs = 50;
      state.recoveringSince = Date.now() - 1000000; // Far past all ramp steps

      advanceAllRecoveries(multiRegion.failoverController);

      // Should be fully recovered
      const newState = multiRegion.healthMonitor.state.get('us-central1');
      expect(newState.health).toBe('healthy');
      expect(newState.weight).toBe(100);
    });
  });

  describe('Sensitive Data Protection', () => {
    it('always routes sensitive collections to primary', async () => {
      const collections = [
        'users',
        'users/user123/applications',
        'applications',
        'grievanceTickets',
        'privacyExports',
        'auditLogs',
        'roles',
      ];

      for (const collection of collections) {
        const decision = await multiRegion.routeRead({
          collectionPath: collection,
          clientContext: { explicitRegion: 'us-central1' },
        });
        expect(decision.replicaId).toBe('asia-south1');
        expect(decision.consistencyLevel).toBe('strong');
      }
    });

    it('never replicates sensitive data', async () => {
      const { shouldReplicateCollection } = await import('../types.js');

      expect(shouldReplicateCollection('users')).toBe(false);
      expect(shouldReplicateCollection('applications')).toBe(false);
      expect(shouldReplicateCollection('services')).toBe(true);
      expect(shouldReplicateCollection('notices')).toBe(true);
    });
  });

  describe('Response Headers', () => {
    it('adds stale-read headers when serving from lagging replica', () => {
      const mockRes = {
        headers: {},
        setHeader(name, value) { this.headers[name] = value; },
      };

      const decision = {
        regionId: 'us-central1',
        consistencyLevel: 'bounded_stale',
        replicaLagMs: 150,
        primaryRegion: 'asia-south1',
        staleRead: true,
        failover: false,
        reason: 'nearest_healthy',
        tokenValidated: false,
      };

      multiRegion.decorateResponse(mockRes, decision, { requestId: 'req_123' });

      expect(mockRes.headers['x-served-by-region']).toBe('us-central1');
      expect(mockRes.headers['x-consistency-level']).toBe('bounded_stale');
      expect(mockRes.headers['x-replica-lag-ms']).toBe('150');
      expect(mockRes.headers['x-primary-region']).toBe('asia-south1');
      expect(mockRes.headers['x-stale-read']).toBe('true');
      expect(mockRes.headers['x-failover']).toBeUndefined();
    });

    it('adds failover header when failing over', () => {
      const mockRes = { headers: {}, setHeader(name, value) { this.headers[name] = value; } };

      const decision = {
        regionId: 'asia-south1',
        consistencyLevel: 'strong',
        replicaLagMs: 0,
        primaryRegion: 'asia-south1',
        staleRead: false,
        failover: true,
        reason: 'failover_to_primary',
        tokenValidated: false,
      };

      multiRegion.decorateResponse(mockRes, decision);

      expect(mockRes.headers['x-failover']).toBe('true');
      expect(mockRes.headers['x-stale-read']).toBe('false');
    });
  });

  describe('Feature Flags', () => {
    it('disables multi-region reads via flag', async () => {
      multiRegion.disableMultiRegionReads('test');

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.reason).toBe('primary_only');
    });

    it('controls rollout percentage', async () => {
      multiRegion.setRolloutPercent(0);

      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: { userId: 'user123' },
      });

      expect(decision.replicaId).toBe('asia-south1');
    });
  });

  describe('Metrics and Observability', () => {
    it('exports comprehensive metrics', () => {
      const metrics = multiRegion.exportMetrics();

      expect(metrics.health).toBeDefined();
      expect(metrics.tokens).toBeDefined();
      expect(metrics.controller).toBeDefined();
    });

    it('provides failover status', () => {
      const status = multiRegion.getFailoverStatus();

      expect(status.enabled).toBe(true);
      expect(status.primaryRegion).toBe('asia-south1');
      expect(status.replicas).toBeDefined();
      expect(status.summary).toBeDefined();
    });
  });

  describe('Shutdown', () => {
    it('cleans up resources on shutdown', () => {
      expect(() => multiRegion.shutdown()).not.toThrow();
    });
  });
});