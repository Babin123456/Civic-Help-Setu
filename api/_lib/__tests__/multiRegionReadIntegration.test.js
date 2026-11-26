/**
 * Tests for API Multi-Region Read Integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getMultiRegionInstance,
  executeMultiRegionRead,
  executeMultiRegionWrite,
  isPrimaryOnlyCollection,
  getCollectionConsistency,
  multiRegionMiddleware,
  sendMultiRegionResponse,
  getMultiRegionHealth,
  getMultiRegionMetrics,
  resetMultiRegionInstance,
  setMultiRegionInstance,
} from '../multiRegionReadIntegration.js';
import { processHeartbeat } from '../../../src/services/multiRegionRead/replicaHealthMonitor.js';

// Mock Firebase Admin
vi.mock('../firebaseAdmin.js', () => ({
  getFirestoreAdmin: vi.fn().mockResolvedValue({
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ test: 'data' }) }),
    runTransaction: vi.fn().mockImplementation(async (fn) => fn({
      get: vi.fn().mockResolvedValue({ exists: false }),
      create: vi.fn(),
      update: vi.fn(),
    })),
  }),
}));

describe('API Multi-Region Read Integration', () => {
  let mockReq;
  let mockRes;

  beforeEach(async () => {
    resetMultiRegionInstance();

    mockReq = {
      headers: {},
      auth: null,
      id: 'req_123',
    };

    mockRes = {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      setHeader(name, value) { this.headers[name] = value; },
    };

    // Create a minimal multi-region instance for testing
    const { createMultiRegionReadLayer } = await import('../../../src/services/multiRegionRead/index.js');
    const { DEFAULT_CONFIG } = await import('../../../src/services/multiRegionRead/types.js');

    const testInstance = createMultiRegionReadLayer({
      config: { ...DEFAULT_CONFIG, ENABLED: true, ROLLOUT_PERCENT: 100 },
      tokenSecret: 'test-secret',
    });

    // Set up healthy replicas
    const now = Date.now();
    processHeartbeat(testInstance.healthMonitor, {
      replicaId: 'us-central1',
      regionId: 'us-central1',
      lastReplicatedCommitTs: now,
      lagMs: 50,
      healthy: true,
      errorRate5m: 0,
    });

    setMultiRegionInstance(testInstance);
  });

  afterEach(() => {
    resetMultiRegionInstance();
  });

  describe('getMultiRegionInstance', () => {
    it('returns singleton instance', async () => {
      const instance1 = await getMultiRegionInstance();
      const instance2 = await getMultiRegionInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Collection Classification', () => {
    it('identifies primary-only collections', () => {
      expect(isPrimaryOnlyCollection('users')).toBe(true);
      expect(isPrimaryOnlyCollection('applications')).toBe(true);
      expect(isPrimaryOnlyCollection('grievanceTickets')).toBe(true);
      expect(isPrimaryOnlyCollection('services')).toBe(false);
      expect(isPrimaryOnlyCollection('notices')).toBe(false);
    });

    it('returns correct consistency level', () => {
      expect(getCollectionConsistency('users')).toBe('strong');
      expect(getCollectionConsistency('services')).toBe('bounded_stale');
    });
  });

  describe('executeMultiRegionRead', () => {
    it('routes read and executes function', async () => {
      let capturedContext = null;

      // Set US IP header to route to us-central1
      mockReq.headers['x-vercel-ip-country'] = 'US';

      const result = await executeMultiRegionRead(mockReq, mockRes, 'services', (ctx) => {
        capturedContext = ctx;
        return { data: 'test' };
      });

      expect(result.result.data).toBe('test');
      expect(capturedContext).toBeDefined();
      expect(capturedContext.regionId).toBe('us-central1');
      expect(capturedContext.routingDecision).toBeDefined();

      // Check response headers
      expect(mockRes.headers['x-served-by-region']).toBe('us-central1');
      expect(mockRes.headers['x-stale-read']).toBe('true'); // lagMs > 0
    });

    it('uses primary for sensitive collections', async () => {
      let capturedContext = null;

      await executeMultiRegionRead(mockReq, mockRes, 'users', (ctx) => {
        capturedContext = ctx;
        return { data: 'test' };
      });

      expect(capturedContext.regionId).toBe('asia-south1');
      expect(capturedContext.routingDecision.consistencyLevel).toBe('strong');
      expect(mockRes.headers['x-stale-read']).toBe('false');
    });

    it('respects requiredConsistency option', async () => {
      let capturedContext = null;

      await executeMultiRegionRead(mockReq, mockRes, 'services', (ctx) => {
        capturedContext = ctx;
        return { data: 'test' };
      }, { requiredConsistency: 'strong' });

      expect(capturedContext.regionId).toBe('asia-south1');
      expect(capturedContext.routingDecision.consistencyLevel).toBe('strong');
    });
  });

  describe('executeMultiRegionWrite', () => {
    it('executes write on primary and issues token', async () => {
      mockReq.auth = { userId: 'user123' };

      const result = await executeMultiRegionWrite(mockReq, mockRes, async (ctx) => {
        expect(ctx.regionId).toBe('asia-south1');
        expect(ctx.isPrimary).toBe(true);
        return { success: true, id: 'new_doc' };
      });

      expect(result.result.success).toBe(true);
      expect(result.writeOpId).toBeDefined();
      expect(mockRes.headers['x-read-your-writes-token']).toBeDefined();
    });

    it('does not issue token for unauthenticated requests', async () => {
      mockReq.auth = null;

      const result = await executeMultiRegionWrite(mockReq, mockRes, async () => ({ success: true }));

      expect(result.result.success).toBe(true);
      expect(mockRes.headers['x-read-your-writes-token']).toBeUndefined();
    });
  });

  describe('sendMultiRegionResponse', () => {
    it('sends response with headers', async () => {
      const decision = {
        regionId: 'us-central1',
        consistencyLevel: 'bounded_stale',
        replicaLagMs: 50,
        primaryRegion: 'asia-south1',
        staleRead: true,
        failover: false,
        reason: 'nearest_healthy',
        tokenValidated: false,
      };

      const result = await sendMultiRegionResponse(mockRes, 200, { data: 'test' }, decision, 'req_123');

      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({ data: 'test' });
      expect(result.headers['x-served-by-region']).toBe('us-central1');
    });
  });

  describe('Health and Metrics', () => {
    it('returns health status', async () => {
      const health = await getMultiRegionHealth();
      expect(health.enabled).toBe(true);
      expect(health.primaryRegion).toBe('asia-south1');
      expect(health.replicas).toBeDefined();
    });

    it('returns metrics', async () => {
      const metrics = await getMultiRegionMetrics();
      expect(metrics.health).toBeDefined();
      expect(metrics.tokens).toBeDefined();
      expect(metrics.controller).toBeDefined();
    });
  });

  describe('Middleware', () => {
    it('attaches multi-region helpers to request', async () => {
      // Create fresh mock objects for this test
      const testReq = {
        headers: {},
        auth: null,
        id: 'req_123',
      };
      const testRes = {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; },
        setHeader(name, value) { this.headers[name] = value; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      // Call middleware directly with req, res, next
      await multiRegionMiddleware(testReq, testRes, next);

      expect(testReq.multiRegion).toBeDefined();
      expect(testReq.multiRegionClientContext).toBeDefined();
      expect(testReq.multiRegionRead).toBeDefined();
      expect(nextCalled).toBe(true);
    });

    it('builds client context from headers', async () => {
      const testReq = {
        headers: {
          'x-client-region': 'europe-west1',
          'x-consistency-hint': 'strong',
          'x-read-your-writes-token': 'token123',
          'x-vercel-ip-country': 'DE',
        },
        auth: { userId: 'user123', role: 'citizen' },
        id: 'req_123',
      };
      const testRes = {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; },
        setHeader(name, value) { this.headers[name] = value; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      // Call middleware directly with req, res, next
      await multiRegionMiddleware(testReq, testRes, next);

      expect(testReq.multiRegionClientContext.explicitRegion).toBe('europe-west1');
      expect(testReq.multiRegionClientContext.consistencyHint).toBe('strong');
      expect(testReq.multiRegionClientContext.sessionToken).toBe('token123');
      expect(testReq.multiRegionClientContext.geoRegion).toBe('europe-west1');
      expect(testReq.multiRegionClientContext.userId).toBe('user123');
      expect(testReq.multiRegionClientContext.isAdmin).toBe(false);
      expect(nextCalled).toBe(true);
    });
  });
});