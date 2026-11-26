import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/policy-simulation.js';

// ---- mock fetch-like req/res ----
const makeReq = (init) => ({
  method: init?.method || 'GET',
  headers: init?.headers || {},
  body: init?.body,
  query: init?.query,
});

const makeRes = () => {
  const statusCalls = [];
  const jsonCalls = [];
  const setHeaderCalls = [];
  return {
    statusCalls,
    setHeader: (...args) => {
      setHeaderCalls.push(args);
    },
    status: (code) => {
      statusCalls.push(code);
      return {
        json: (data) => {
          jsonCalls.push(data);
          return { status: code };
        },
      };
    },
    get headersSent() {
      return statusCalls.length > 0;
    },
  };
};

describe('api/policy-simulation handler', () => {
  describe('GET /catalogue', () => {
    it('returns catalogue with scenarios, personas, services, offices, levers', async () => {
      const req = makeReq({ query: { action: 'catalogue' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(Array.isArray(result.body.scenarios)).toBe(true);
      expect(Array.isArray(result.body.personas)).toBe(true);
      expect(Array.isArray(result.body.services)).toBe(true);
      expect(Array.isArray(result.body.offices)).toBe(true);
      expect(Array.isArray(result.body.levers)).toBe(true);
      expect(result.body.scenarios.length).toBeGreaterThan(0);
    });

    it('returns 400 when action is missing', async () => {
      const req = makeReq({});
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'missing_action');
    });
  });

  describe('GET /scenario', () => {
    it('returns a scenario by id', async () => {
      const req = makeReq({ query: { action: 'scenario', scenarioId: 'scenario-baseline' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(result.body.scenario.id).toBe('scenario-baseline');
    });

    it('returns 404 for unknown scenarioId', async () => {
      const req = makeReq({ query: { action: 'scenario', scenarioId: 'unknown-scenario' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'scenario_not_found');
    });

    it('returns 400 when scenarioId is missing', async () => {
      const req = makeReq({ query: { action: 'scenario' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'missing_scenarioId');
    });
  });

  describe('POST /simulate', () => {
    it('simulates baseline successfully for guest', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'simulate', scenarioId: 'scenario-baseline' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(result.body.simulation).toHaveProperty('totals');
      expect(result.body.simulation).toHaveProperty('byService');
      expect(result.body.simulation).toHaveProperty('uncertainty');
      expect(result.body.simulation.illustrative).toBe(true);
      expect(result.body.simulation.noIndividualPrediction).toBe(true);
    });

    it('is deterministic across repeated runs', async () => {
      const body = { action: 'simulate', scenarioId: 'scenario-digital-ration-card', seed: 42 };
      const a = await handler(makeReq({ method: 'POST', body }), makeRes());
      const b = await handler(makeReq({ method: 'POST', body }), makeRes());
      expect(a.body.simulation.totals).toEqual(b.body.simulation.totals);
      expect(a.body.simulation.reproducibilityDigest).toBe(b.body.simulation.reproducibilityDigest);
    });

    it('applies a lever and produces sensitivity entries', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'simulate', scenarioId: 'scenario-mobile-csc-ward-3' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(Array.isArray(result.body.simulation.sensitivity)).toBe(true);
    });

    it('returns validation errors for bad scenarioId', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'simulate', scenarioId: 'unknown-scenario' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error');
    });

    it('rejects sensitive fields in request body', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'simulate', scenarioId: 'scenario-baseline', aadhaar_number: '1234' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error');
    });

    it('rejects missing action', async () => {
      const req = makeReq({ method: 'POST', body: {} });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'missing_action');
    });
  });

  describe('POST /save-scenario', () => {
    it('returns 401 for guest', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'save-scenario', scenarioId: 'scenario-baseline' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });

    it('returns 401 for guest even when scenarioId is missing', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'save-scenario' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });
  });

  describe('POST /load-scenario', () => {
    it('returns 404 for unknown saved scenario', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'load-scenario', scenarioId: 'unknown-scenario' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'scenario_not_found');
    });
  });

  describe('POST /impact-summary', () => {
    it('returns a summary for a valid simulation', async () => {
      const sim = {
        ok: true,
        result: {
          scenario: { title: 'Baseline' },
          dataVersion: 'civic-policy-simulation-v1',
          reproducibilityDigest: 'psim-abcdef01',
          totals: {
            estimatedDailyDemand: 100,
            estimatedDailyInPersonVisits: 70,
            estimatedDailyOnlineDemand: 30,
            estimatedDailyTravelMinutes: 3000,
            averageDocumentBurden: 0.5,
          },
          byService: [],
          byOffice: [],
          byPersona: [],
          sensitivity: [],
          uncertainty: { level: 'medium', message: 'Mixed confidence.', isStale: false, lowConfidenceStatCount: 0 },
          aggregateValidation: { passed: 2, total: 3, passRate: 66.7, note: 'directional' },
          disclaimer: 'Illustrative.',
        },
      };
      const req = makeReq({
        method: 'POST',
        body: { action: 'impact-summary', simulation: sim },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(typeof result.body.summary).toBe('string');
      expect(result.body.summary).toContain('illustrative');
    });

    it('returns 400 for invalid simulation', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'impact-summary', simulation: { ok: false } },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'invalid_simulation');
    });
  });

  describe('method not allowed', () => {
    it('returns 405 for DELETE', async () => {
      const req = makeReq({ method: 'DELETE' });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'method_not_allowed');
    });

    it('returns 405 for PUT', async () => {
      const req = makeReq({ method: 'PUT' });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'method_not_allowed');
    });
  });
});
