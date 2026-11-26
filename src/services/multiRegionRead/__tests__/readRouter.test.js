/**
 * Tests for Read Router
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createReadRouter,
  routeRead,
  routeBatchRead,
  buildClientContext,
  updateRuntimeConfig,
  getRuntimeConfig,
  validateRouterConfig,
} from '../readRouter.js';
import { createReplicaHealthMonitor, processHeartbeat } from '../replicaHealthMonitor.js';
import { createSessionTokenStore, issueToken } from '../sessionTokenStore.js';
import { DEFAULT_CONFIG, CONSISTENCY_LEVEL, ROUTING_REASON } from '../types.js';

describe('Read Router', () => {
  let router;
  let healthMonitor;
  let tokenStore;

  beforeEach(() => {
    healthMonitor = createReplicaHealthMonitor({ config: DEFAULT_CONFIG });
    tokenStore = createSessionTokenStore({
      secret: 'test-secret',
      config: DEFAULT_CONFIG,
    });
    router = createReadRouter({
      healthMonitor,
      tokenStore,
      config: DEFAULT_CONFIG,
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
      processHeartbeat(healthMonitor, {
        replicaId: regionId,
        regionId: regionId,
        lastReplicatedCommitTs: now,
        lagMs,
        healthy: true,
        errorRate5m: 0,
      });
    }
  });

  describe('Basic Routing', () => {
    it('routes public collection to nearest healthy replica', async () => {
      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: {},
      });

      expect(decision.replicaId).toBe('us-central1'); // Lower lag
      expect(decision.consistencyLevel).toBe(CONSISTENCY_LEVEL.BOUNDED_STALE);
      expect(decision.reason).toBe(ROUTING_REASON.NEAREST_HEALTHY);
      expect(decision.staleRead).toBe(true); // lagMs > 0
    });

    it('routes sensitive collection to primary only', async () => {
      const decision = await routeRead(router, {
        collectionPath: 'users',
        clientContext: {},
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.consistencyLevel).toBe(CONSISTENCY_LEVEL.STRONG);
      expect(decision.reason).toBe(ROUTING_REASON.PRIMARY_ONLY);
      expect(decision.staleRead).toBe(false);
    });

    it('routes admin collection to primary only', async () => {
      const decision = await routeRead(router, {
        collectionPath: 'roles',
        clientContext: {},
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.reason).toBe(ROUTING_REASON.PRIMARY_ONLY);
    });
  });

  describe('Consistency Override', () => {
    it('respects requiredConsistency=STRONG', async () => {
      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: {},
        requiredConsistency: CONSISTENCY_LEVEL.STRONG,
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.consistencyLevel).toBe(CONSISTENCY_LEVEL.STRONG);
      expect(decision.reason).toBe(ROUTING_REASON.PRIMARY_ONLY);
    });

    it('respects client consistency hint', async () => {
      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: { consistencyHint: CONSISTENCY_LEVEL.STRONG },
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.consistencyLevel).toBe(CONSISTENCY_LEVEL.STRONG);
    });
  });

  describe('Explicit Region Preference', () => {
    it('honors explicit region for public data', async () => {
      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: { explicitRegion: 'europe-west1' },
      });

      expect(decision.replicaId).toBe('europe-west1');
      expect(decision.reason).toBe(ROUTING_REASON.EXPLICIT_REGION);
    });

    it('ignores explicit region for sensitive data', async () => {
      const decision = await routeRead(router, {
        collectionPath: 'users',
        clientContext: { explicitRegion: 'europe-west1' },
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.reason).toBe(ROUTING_REASON.PRIMARY_ONLY);
    });

    it('falls back when explicit region unhealthy', async () => {
      // Make europe-west1 unhealthy
      processHeartbeat(healthMonitor, {
        replicaId: 'europe-west1',
        regionId: 'europe-west1',
        lastReplicatedCommitTs: Date.now(),
        lagMs: 15000,
        healthy: false,
        errorRate5m: 0,
      });

      // Debug: check health states
      const { getHealthyReplicas } = await import('../replicaHealthMonitor.js');
      const healthyReplicas = getHealthyReplicas(healthMonitor);
      console.log('Healthy replicas after making europe-west1 unhealthy:', healthyReplicas.map(r => ({ regionId: r.regionId, health: r.state.health, lagMs: r.state.lagMs })));

      // Debug: check what routeRead sees
      const { routeRead: debugRouteRead } = await import('../readRouter.js');
      const debugRouter = createReadRouter({ healthMonitor, tokenStore, config: DEFAULT_CONFIG });
      const debugDecision = await debugRouteRead(debugRouter, {
        collectionPath: 'services',
        clientContext: { explicitRegion: 'europe-west1' },
      });
      console.log('Debug decision:', debugDecision);

      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: { explicitRegion: 'europe-west1' },
      });

      expect(decision.replicaId).toBe('us-central1');
      expect(decision.reason).toBe(ROUTING_REASON.NEAREST_HEALTHY);
    });
  });

  describe('Geo Region Preference', () => {
    it('uses geo region when no explicit region', async () => {
      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: { geoRegion: 'europe-west1' },
      });

      expect(decision.replicaId).toBe('europe-west1');
      expect(decision.reason).toBe(ROUTING_REASON.EXPLICIT_REGION);
    });
  });

  describe('Read-Your-Writes Token', () => {
    it('validates token and allows replica read when caught up', async () => {
      const tokenResult = await issueToken(tokenStore, 'user123', Date.now() - 1000, 'op123');

      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: {
          userId: 'user123',
          sessionToken: tokenResult.token,
        },
      });

      expect(decision.replicaId).toBe('us-central1');
      expect(decision.tokenValidated).toBe(true);
      expect(decision.reason).toBe(ROUTING_REASON.RYW_TOKEN_VALID);
    });

    it('routes to primary when token valid but replica lagging', async () => {
      // Set replica lag behind token's primaryCommitTs
      const primaryCommitTs = Date.now();
      const tokenResult = await issueToken(tokenStore, 'user123', primaryCommitTs, 'op123');

      // Make ALL replicas lag behind
      for (const regionId of healthMonitor.state.keys()) {
        processHeartbeat(healthMonitor, {
          replicaId: regionId,
          regionId: regionId,
          lastReplicatedCommitTs: primaryCommitTs - 5000, // 5 seconds behind
          lagMs: 5000,
          healthy: true,
          errorRate5m: 0,
        });
      }

      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: {
          userId: 'user123',
          sessionToken: tokenResult.token,
        },
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.tokenValidated).toBe(true);
      expect(decision.reason).toBe(ROUTING_REASON.RYW_TOKEN_FORCED_PRIMARY);
      expect(decision.consistencyLevel).toBe(CONSISTENCY_LEVEL.STRONG);
    });

    it('ignores invalid token and routes normally', async () => {
      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: {
          userId: 'user123',
          sessionToken: 'invalid.token.here',
        },
      });

      expect(decision.replicaId).toBe('us-central1');
      expect(decision.tokenValidated).toBe(false);
      expect(decision.reason).toBe(ROUTING_REASON.NEAREST_HEALTHY);
    });

    it('rejects token for wrong user', async () => {
      const tokenResult = await issueToken(tokenStore, 'user123', Date.now(), 'op123');

      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: {
          userId: 'user456', // Different user
          sessionToken: tokenResult.token,
        },
      });

      expect(decision.tokenValidated).toBe(false);
      expect(decision.reason).toBe(ROUTING_REASON.NEAREST_HEALTHY);
    });
  });

  describe('Failover', () => {
    it('fails over to primary when no healthy replicas', async () => {
      // Make ALL replicas unhealthy
      for (const regionId of healthMonitor.state.keys()) {
        processHeartbeat(healthMonitor, {
          replicaId: regionId,
          regionId: regionId,
          lastReplicatedCommitTs: Date.now(),
          lagMs: 15000,
          healthy: false,
          errorRate5m: 0,
        });
      }

      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: {},
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.reason).toBe(ROUTING_REASON.FAILOVER_TO_PRIMARY);
      expect(decision.failover).toBe(true);
    });
  });

  describe('Feature Flags', () => {
    it('routes to primary when disabled', async () => {
      updateRuntimeConfig(router, { enabled: false });

      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: {},
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.reason).toBe(ROUTING_REASON.PRIMARY_ONLY);
    });

    it('respects rollout percentage', async () => {
      updateRuntimeConfig(router, { rolloutPercent: 0 });

      const decision = await routeRead(router, {
        collectionPath: 'services',
        clientContext: {},
      });

      expect(decision.replicaId).toBe('asia-south1');
      expect(decision.reason).toBe(ROUTING_REASON.PRIMARY_ONLY);
    });

    it('includes request in rollout deterministically', async () => {
      updateRuntimeConfig(router, { rolloutPercent: 50 });

      // Same request should get consistent decision
      const decision1 = await routeRead(router, {
        collectionPath: 'services',
        clientContext: { userId: 'user123' },
      });
      const decision2 = await routeRead(router, {
        collectionPath: 'services',
        clientContext: { userId: 'user123' },
      });

      expect(decision1.replicaId).toBe(decision2.replicaId);
    });
  });

  describe('Batch Routing', () => {
    it('returns most restrictive decision', async () => {
      const decisions = await routeBatchRead(router, [
        { collectionPath: 'services', clientContext: {} },
        { collectionPath: 'users', clientContext: {} },
      ]);

      // users requires STRONG, services allows BOUNDED_STALE
      expect(decisions.replicaId).toBe('asia-south1');
      expect(decisions.consistencyLevel).toBe(CONSISTENCY_LEVEL.STRONG);
    });

    it('propagates failover flag', async () => {
      // Make ALL replicas unhealthy
      for (const regionId of healthMonitor.state.keys()) {
        processHeartbeat(healthMonitor, {
          replicaId: regionId,
          regionId: regionId,
          lastReplicatedCommitTs: Date.now(),
          lagMs: 15000,
          healthy: false,
          errorRate5m: 0,
        });
      }

      const decisions = await routeBatchRead(router, [
        { collectionPath: 'services', clientContext: {} },
        { collectionPath: 'notices', clientContext: {} },
      ]);

      expect(decisions.failover).toBe(true);
    });
  });

  describe('Client Context Builder', () => {
    it('builds context from headers', () => {
      const headers = {
        'x-client-region': 'us-central1',
        'x-consistency-hint': 'strong',
        'x-read-your-writes-token': 'token123',
        'x-vercel-ip-country': 'US',
      };
      const user = { id: 'user123', role: 'citizen' };

      const ctx = buildClientContext(headers, user);

      expect(ctx.userId).toBe('user123');
      expect(ctx.explicitRegion).toBe('us-central1');
      expect(ctx.consistencyHint).toBe('strong');
      expect(ctx.sessionToken).toBe('token123');
      expect(ctx.geoRegion).toBe('us-central1');
      expect(ctx.isAdmin).toBe(false);
    });

    it('detects admin role', () => {
      const user = { id: 'admin1', role: 'admin' };
      const ctx = buildClientContext({}, user);
      expect(ctx.isAdmin).toBe(true);
    });
  });

  describe('Config Management', () => {
    it('updates runtime config', () => {
      updateRuntimeConfig(router, { rolloutPercent: 25 });
      const config = getRuntimeConfig(router);
      expect(config.rolloutPercent).toBe(25);
    });

    it('validates router config', () => {
      const result = validateRouterConfig(router);
      expect(result.valid).toBe(true);
    });

    it('warns when token store missing', () => {
      const routerNoToken = createReadRouter({ healthMonitor, config: DEFAULT_CONFIG });
      const result = validateRouterConfig(routerNoToken);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('Token store'))).toBe(true);
    });
  });
});