/**
 * tests/civic-chaos-engineering-api.test.js
 * Server-side API handler integration tests for Civic Operations Chaos Engineering (#1192).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import handler, { resetServerChaosState } from '../api/_lib/handlers/civic-chaos-engineering.js';
import {
  CIVIC_CHAOS_SCHEMA_VERSION,
  DEPENDENCY_TYPES,
  FAULT_TYPES,
} from '../src/data/civicChaosResilienceContract.js';

function createMockReqRes({ method = 'GET', query = {}, body = {}, headers = {} } = {}) {
  const req = {
    method,
    query,
    body,
    headers: { 'x-forwarded-for': '127.0.0.1', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };

  return { req, res };
}

describe('api/_lib/handlers/civic-chaos-engineering', () => {
  beforeEach(() => {
    resetServerChaosState();
  });

  describe('GET operations', () => {
    it('returns default status and schema version', async () => {
      const { req, res } = createMockReqRes({ method: 'GET' });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.schemaVersion).toBe(CIVIC_CHAOS_SCHEMA_VERSION);
      expect(res.body.globalKillSwitch).toBe(false);
      expect(Array.isArray(res.body.activeDrills)).toBe(true);
    });

    it('returns operational resilience runbooks', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        query: { action: 'runbooks' },
      });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.runbooks)).toBe(true);
      expect(res.body.runbooks.length).toBeGreaterThan(0);
      expect(res.body.runbooks[0].id).toBe('RB-CHAOS-001');
    });

    it('returns recovery objectives and scenario presets', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        query: { action: 'scenarios' },
      });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.presets)).toBe(true);
      expect(Array.isArray(res.body.dependencies)).toBe(true);
    });
  });

  describe('POST operations & Safety boundaries', () => {
    it('prohibits chaos drill creation in production environment (Safety Rule)', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        query: { action: 'start-drill' },
        body: {
          name: 'Prod Attack Drill',
          environment: 'production',
          operatorId: 'admin-1',
          injections: [
            {
              dependency: DEPENDENCY_TYPES.FIREBASE,
              faultType: FAULT_TYPES.CONNECTION_REFUSED,
              durationMs: 5000,
            },
          ],
        },
      });

      await handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.errors.some((e) => e.includes('strictly prohibited in production'))).toBe(true);
    });

    it('starts valid non-production drill and tracks it in active drills list', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        query: { action: 'start-drill' },
        body: {
          name: 'Staging Auth Latency Test',
          environment: 'staging',
          operatorId: 'sec-tester',
          injections: [
            {
              dependency: DEPENDENCY_TYPES.MODEL_PROVIDERS,
              faultType: FAULT_TYPES.RATE_LIMIT,
              durationMs: 5000,
              failureRate: 1.0,
            },
          ],
        },
      });

      await handler(req, res);
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.drill.name).toBe('Staging Auth Latency Test');
    });

    it('manages Global Emergency Kill Switch and terminates active drills', async () => {
      // 1. Engage kill switch
      const { req, res } = createMockReqRes({
        method: 'POST',
        query: { action: 'kill-switch' },
        body: { engage: true, reason: 'Drill threshold breach', operatorId: 'sec-admin' },
      });

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.globalKillSwitch).toBe(true);
      expect(res.body.message).toContain('EMERGENCY KILL SWITCH ENGAGED');

      // 2. Reject starting any drill while kill switch is engaged
      const { req: req2, res: res2 } = createMockReqRes({
        method: 'POST',
        query: { action: 'start-drill' },
        body: {
          name: 'Attempted Drill',
          environment: 'test',
          operatorId: 'tester',
          injections: [{ dependency: DEPENDENCY_TYPES.MAPS, faultType: FAULT_TYPES.TIMEOUT, durationMs: 2000 }],
        },
      });

      await handler(req2, res2);
      expect(res2.statusCode).toBe(403);
      expect(res2.body.error).toBe('Kill Switch Engaged');
    });

    it('evaluates automated resilience report with 100% draft retention rate', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        query: { action: 'evaluate-report' },
        body: { scenarioId: 'scenario-cascading-infrastructure-blackout' },
      });

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.schemaVersion).toBe(CIVIC_CHAOS_SCHEMA_VERSION);
      expect(res.body.status).toBe('COMPLIANT');
      expect(res.body.draftRetentionRate).toBe('100%');
    });
  });
});
