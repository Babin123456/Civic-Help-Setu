/**
 * Load Tests for Multi-Region Read Layer
 *
 * Tests routing performance and behavior under load.
 * Uses synthetic data only.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMultiRegionReadLayer } from '../src/services/multiRegionRead/index.js';
import { DEFAULT_CONFIG } from '../src/services/multiRegionRead/types.js';
import { processHeartbeat } from '../src/services/multiRegionRead/replicaHealthMonitor.js';

describe('Multi-Region Read Layer - Load Tests', () => {
  let multiRegion;

  beforeEach(async () => {
    multiRegion = createMultiRegionReadLayer({
      config: { ...DEFAULT_CONFIG, ENABLED: true, ROLLOUT_PERCENT: 100 },
      tokenSecret: 'load-test-secret',
    });

    // Set up healthy replicas with low lag for ALL replicas
    const now = Date.now();
    const lagMap = {
      'us-central1': 10,
      'europe-west1': 20,
      'asia-southeast1': 30,
      'australia-southeast1': 40,
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

  describe('Routing Performance', () => {
    it('routes 10,000 requests in reasonable time', async () => {
      const start = Date.now();
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        await multiRegion.routeRead({
          collectionPath: 'services',
          clientContext: { userId: `user${i % 1000}` },
        });
      }

      const elapsed = Date.now() - start;
      const perRequest = elapsed / iterations;

      console.log(`Routed ${iterations} requests in ${elapsed}ms (${perRequest.toFixed(3)}ms/req)`);

      // Should be well under 1ms per request
      expect(perRequest).toBeLessThan(1);
    });

    it('handles concurrent routing requests', async () => {
      const concurrent = 100;
      const promises = [];

      for (let i = 0; i < concurrent; i++) {
        promises.push(
          multiRegion.routeRead({
            collectionPath: 'services',
            clientContext: { userId: `user${i}` },
          })
        );
      }

      const decisions = await Promise.all(promises);

      // All should succeed
      expect(decisions.length).toBe(concurrent);
      for (const d of decisions) {
        expect(d.replicaId).toBeDefined();
        expect(d.consistencyLevel).toBeDefined();
      }
    });
  });

  describe('Token Operations Under Load', () => {
    it('issues and validates tokens at high rate', async () => {
      const iterations = 5000;
      const tokens = [];

      // Issue tokens
      const issueStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        const { token } = await multiRegion.issueToken(`user${i}`, Date.now(), `write_${i}`);
        tokens.push(token);
      }
      const issueElapsed = Date.now() - issueStart;

      // Validate tokens
      const validateStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await multiRegion.routeRead({
          collectionPath: 'services',
          clientContext: { userId: `user${i}`, sessionToken: tokens[i] },
        });
      }
      const validateElapsed = Date.now() - validateStart;

      console.log(`Issued ${iterations} tokens in ${issueElapsed}ms`);
      console.log(`Validated ${iterations} tokens in ${validateElapsed}ms`);

      expect(issueElapsed / iterations).toBeLessThan(2); // < 2ms per issue
      expect(validateElapsed / iterations).toBeLessThan(1); // < 1ms per validate
    });
  });

  describe('Failover Under Load', () => {
    it('handles failover during active traffic', async () => {
      const iterations = 1000;
      let failoverCount = 0;
      let replicaCount = 0;
      let primaryCount = 0;

      // Start with healthy replicas
      for (let i = 0; i < 100; i++) {
        const decision = await multiRegion.routeRead({
          collectionPath: 'services',
          clientContext: { userId: `user${i}` },
        });
        if (decision.replicaId !== 'asia-south1') replicaCount++;
      }

      // Trigger failover mid-load on ALL replicas
      for (const regionId of multiRegion.healthMonitor.state.keys()) {
        multiRegion.manualFailover(regionId, 'load_test');
      }

      // Continue routing during failover
      for (let i = 100; i < iterations; i++) {
        const decision = await multiRegion.routeRead({
          collectionPath: 'services',
          clientContext: { userId: `user${i}` },
        });
        if (decision.failover) failoverCount++;
        if (decision.replicaId === 'asia-south1') primaryCount++;
      }

      expect(replicaCount).toBeGreaterThan(0);
      expect(failoverCount).toBeGreaterThan(0);
      expect(primaryCount).toBe(iterations - 100); // All remaining to primary
    });
  });

  describe('Memory Stability', () => {
    it('does not leak memory with token cleanup', async () => {
      // Create many tokens with short TTL
      const shortTTLConfig = { ...DEFAULT_CONFIG, RYW_TOKEN_TTL_MS: 100 }; // 100ms
      const testLayer = createMultiRegionReadLayer({
        config: shortTTLConfig,
        tokenSecret: 'memory-test-secret',
      });

      // Issue tokens
      for (let i = 0; i < 1000; i++) {
        await testLayer.issueToken(`user${i}`, Date.now(), `write_${i}`);
      }

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Trigger cleanup
      testLayer.tokenStore.cleanupExpiredTokens();

      // Storage should be empty
      expect(testLayer.tokenStore.storage.size).toBe(0);

      testLayer.shutdown();
    });
  });

  describe('SLO Verification', () => {
    it('meets p99 latency target for routing', async () => {
      const latencies = [];

      for (let i = 0; i < 1000; i++) {
        const start = Date.now();
        await multiRegion.routeRead({
          collectionPath: 'services',
          clientContext: {},
        });
        latencies.push(Date.now() - start);
      }

      latencies.sort((a, b) => a - b);
      const p99 = latencies[Math.floor(latencies.length * 0.99)];

      console.log(`Routing p99 latency: ${p99}ms`);
      expect(p99).toBeLessThan(5); // p99 < 5ms
    });

    it('detects unhealthy replica within threshold', async () => {
      // Replica becomes unhealthy
      processHeartbeat(multiRegion.healthMonitor, {
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: Date.now() - 15000,
        lagMs: 15000,
        healthy: false,
        errorRate5m: 0,
      });

      // Next routing decision should failover
      const start = Date.now();
      const decision = await multiRegion.routeRead({
        collectionPath: 'services',
        clientContext: {},
      });
      const failoverTime = Date.now() - start;

      expect(decision.replicaId).toBe('europe-west1');
      expect(failoverTime).toBeLessThan(10); // Failover decision < 10ms
    });
  });
});