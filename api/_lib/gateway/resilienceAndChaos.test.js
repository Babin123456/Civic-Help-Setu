/**
 * api/_lib/gateway/resilienceAndChaos.test.js
 *
 * Resilience, Concurrency, and Failure-Injection Test Suite (#1236).
 * Tests concurrency, retry semantics, degraded dependencies, and NAT protection
 * using synthetic data only.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createApiDispatcher } from '../../[...path].js';
import { createGatewayMiddleware } from './gatewayMiddleware.js';
import { ConsumerRegistry, CONSUMER_TIERS } from './consumerRegistry.js';
import { ContractRegistry } from '../versioning/contractRegistry.js';
import { DeprecationManager } from './deprecationManager.js';
import { v2Spec } from '../versioning/specs/v2Spec.js';

function createMockReq(overrides = {}) {
  const headers = {};
  for (const [k, v] of Object.entries(overrides.headers || {})) {
    headers[k.toLowerCase()] = v;
  }
  return {
    method: 'GET',
    url: '/api/services',
    path: '/api/services',
    headers,
    query: {},
    body: undefined,
    ...overrides,
  };
}

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    headers,
    body: null,
    writableEnded: false,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.writableEnded = true;
      return this;
    },
    send(body) {
      this.body = body;
      this.writableEnded = true;
      return this;
    },
    end() {
      this.writableEnded = true;
      return this;
    },
  };
  return res;
}

describe('Gateway Resilience, Concurrency & Failure Injection (#1236)', () => {
  let contractRegistry;
  let consumerRegistry;
  let deprecationManager;
  let gatewayMiddleware;
  let currentTime;

  beforeEach(() => {
    currentTime = new Date('2026-11-25T12:00:00Z').getTime();

    contractRegistry = new ContractRegistry({ now: () => currentTime });
    contractRegistry.registerLoader('v2', async () => ({ spec: v2Spec }));

    consumerRegistry = new ConsumerRegistry({
      secret: 'chaos-test-secret',
      now: () => currentTime,
    });

    deprecationManager = new DeprecationManager({
      now: () => currentTime,
    });

    gatewayMiddleware = createGatewayMiddleware({
      contractRegistry,
      consumerRegistry,
      deprecationManager,
      features: { versioning: true, quotas: true, validation: true, deprecation: true },
      baseUrl: 'https://api.civic-help-setu.org',
    });
  });

  describe('1. Concurrency & Parallel Bursts', () => {
    it('handles concurrent requests from multiple clients without counter corruption', async () => {
      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        extraHandlers: {
          services: async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      // Register two distinct consumers
      await consumerRegistry.registerConsumer({
        id: 'client-alpha',
        name: 'Client Alpha',
        tier: CONSUMER_TIERS.PARTNER,
        credentials: { apiKey: 'key-alpha' },
        quotas: { rpm: 50, burst: 50 },
      });

      await consumerRegistry.registerConsumer({
        id: 'client-beta',
        name: 'Client Beta',
        tier: CONSUMER_TIERS.PARTNER,
        credentials: { apiKey: 'key-beta' },
        quotas: { rpm: 50, burst: 50 },
      });

      // Fire 20 parallel requests for Alpha and 20 for Beta simultaneously
      const alphaRequests = Array.from({ length: 20 }, () => {
        const req = createMockReq({ headers: { 'x-api-key': 'key-alpha' } });
        const res = createMockRes();
        return dispatcher(req, res).then(() => res.statusCode);
      });

      const betaRequests = Array.from({ length: 20 }, () => {
        const req = createMockReq({ headers: { 'x-api-key': 'key-beta' } });
        const res = createMockRes();
        return dispatcher(req, res).then(() => res.statusCode);
      });

      const [alphaResults, betaResults] = await Promise.all([
        Promise.all(alphaRequests),
        Promise.all(betaRequests),
      ]);

      expect(alphaResults.every(code => code === 200)).toBe(true);
      expect(betaResults.every(code => code === 200)).toBe(true);

      // Verify state counters reflect exactly 20 requests per client
      // Note: checkQuota() evaluates by taking the next token (21st request)
      const quotaAlpha = await consumerRegistry.checkQuota('client-alpha');
      expect(quotaAlpha.remaining.rpm).toBe(50 - 21);

      const quotaBeta = await consumerRegistry.checkQuota('client-beta');
      expect(quotaBeta.remaining.rpm).toBe(50 - 21);
    });

    it('enforces burst window limits when requests arrive too rapidly', async () => {
      await consumerRegistry.registerConsumer({
        id: 'burst-client',
        name: 'Burst Client',
        tier: CONSUMER_TIERS.FREE,
        credentials: { apiKey: 'burst-key' },
        quotas: { rpm: 100, burst: 3 }, // Allowed only 3 within 10s burst window
      });

      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        extraHandlers: {
          services: async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      const results = [];
      for (let i = 0; i < 5; i++) {
        const req = createMockReq({ headers: { 'x-api-key': 'burst-key' } });
        const res = createMockRes();
        await dispatcher(req, res);
        results.push(res.statusCode);
      }

      // First 3 pass burst limit, 4th and 5th should receive 429
      expect(results.slice(0, 3)).toEqual([200, 200, 200]);
      expect(results[3]).toBe(429);
      expect(results[4]).toBe(429);
    });
  });

  describe('2. Retry Semantics & Window Expiration', () => {
    it('allows successful retry after advancing past Retry-After window', async () => {
      await consumerRegistry.registerConsumer({
        id: 'retry-client',
        name: 'Retry Client',
        tier: CONSUMER_TIERS.FREE,
        credentials: { apiKey: 'retry-key' },
        quotas: { rpm: 1, burst: 1 },
      });

      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        extraHandlers: {
          services: async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      // Request 1: 200 OK
      const req1 = createMockReq({ headers: { 'x-api-key': 'retry-key' } });
      const res1 = createMockRes();
      await dispatcher(req1, res1);
      expect(res1.statusCode).toBe(200);

      // Request 2: 429 Throttled
      const req2 = createMockReq({ headers: { 'x-api-key': 'retry-key' } });
      const res2 = createMockRes();
      await dispatcher(req2, res2);
      expect(res2.statusCode).toBe(429);
      const retryAfter = parseInt(res2.headers['retry-after'] || '60', 10);
      expect(retryAfter).toBeGreaterThan(0);

      // Simulate advancing time past both burst (10s) and RPM (60s) windows
      currentTime += 65 * 1000;

      // Request 3 (Retry): 200 OK
      const req3 = createMockReq({ headers: { 'x-api-key': 'retry-key' } });
      const res3 = createMockRes();
      await dispatcher(req3, res3);
      expect(res3.statusCode).toBe(200);
    });
  });

  describe('3. Degraded Dependencies & Fallback Contracts', () => {
    it('falls back safely to minimal contract when contract loader crashes', async () => {
      const failingRegistry = new ContractRegistry({ now: () => currentTime });
      failingRegistry.registerLoader('v2', async () => {
        throw new Error('Storage service connection timeout (Synthetic Fault)');
      });

      const resilientMiddleware = createGatewayMiddleware({
        contractRegistry: failingRegistry,
        consumerRegistry,
        deprecationManager,
        features: { versioning: true, quotas: false, validation: true, deprecation: false },
      });

      const dispatcher = createApiDispatcher({
        gatewayMiddleware: resilientMiddleware,
        extraHandlers: {
          services: async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      const req = createMockReq({ url: '/api/services' });
      const res = createMockRes();

      await dispatcher(req, res);

      // Did not crash with 500 unhandled error
      expect(res.statusCode).not.toBe(500);
      expect(res.headers['api-version']).toBe('v2');
    });

    it('recovers gracefully from malformed or missing headers without crashing', async () => {
      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        extraHandlers: {
          services: async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      const req = createMockReq({
        headers: {
          'accept-version': ';;;;invalid;;;;',
          'x-api-key': '',
          'authorization': 'Bearer malformed.jwt.token',
        },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      // Successfully defaults and responds
      expect(res.statusCode).toBe(200);
      expect(res.headers['api-version']).toBe('v2');
    });
  });

  describe('4. NAT Abuse Protection (Shared IP Isolation)', () => {
    it('isolates authenticated users even when sharing the exact same IP address', async () => {
      const sharedIp = '203.0.113.195';

      await consumerRegistry.registerConsumer({
        id: 'nat-user-1',
        name: 'NAT User 1',
        tier: CONSUMER_TIERS.FREE,
        credentials: { apiKey: 'key-nat-1' },
        quotas: { rpm: 1, burst: 1 },
      });

      await consumerRegistry.registerConsumer({
        id: 'nat-user-2',
        name: 'NAT User 2',
        tier: CONSUMER_TIERS.FREE,
        credentials: { apiKey: 'key-nat-2' },
        quotas: { rpm: 10, burst: 10 },
      });

      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        extraHandlers: {
          services: async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      // User 1 on shared IP makes 2 requests -> gets throttled
      const req1 = createMockReq({
        headers: { 'x-forwarded-for': sharedIp, 'x-api-key': 'key-nat-1' },
      });
      const res1 = createMockRes();
      await dispatcher(req1, res1);
      expect(res1.statusCode).toBe(200);

      const req2 = createMockReq({
        headers: { 'x-forwarded-for': sharedIp, 'x-api-key': 'key-nat-1' },
      });
      const res2 = createMockRes();
      await dispatcher(req2, res2);
      expect(res2.statusCode).toBe(429);

      // User 2 on the SAME shared IP must NOT be throttled
      const req3 = createMockReq({
        headers: { 'x-forwarded-for': sharedIp, 'x-api-key': 'key-nat-2' },
      });
      const res3 = createMockRes();
      await dispatcher(req3, res3);
      expect(res3.statusCode).toBe(200);
    });
  });
});
