import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/agent-sandbox.js';

const makeReq = (init) => ({
  method: init?.method || 'GET',
  headers: init?.headers || {},
  body: init?.body,
  query: init?.query
});

const makeRes = () => {
  const statusCalls = [];
  const jsonCalls = [];
  const setHeaderCalls = [];
  return {
    statusCalls,
    setHeader: (...args) => setHeaderCalls.push(args),
    status: (code) => {
      statusCalls.push(code);
      return {
        json: (data) => {
          jsonCalls.push(data);
          return { status: code };
        }
      };
    },
    get headersSent() {
      return statusCalls.length > 0;
    }
  };
};

describe('api/agent-sandbox handler', () => {
  describe('GET /catalogue', () => {
    it('returns catalogue with policies, tools, documents, threats, endpoints', async () => {
      const req = makeReq({ query: { action: 'catalogue' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(Array.isArray(result.body.policies)).toBe(true);
      expect(Array.isArray(result.body.tools)).toBe(true);
      expect(Array.isArray(result.body.documents)).toBe(true);
      expect(Array.isArray(result.body.threats)).toBe(true);
      expect(Array.isArray(result.body.approvedEndpoints)).toBe(true);
      expect(result.body.policies.length).toBeGreaterThan(0);
    });

    it('returns 400 when action is missing', async () => {
      const req = makeReq({});
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'missing_action');
    });
  });

  describe('GET /run', () => {
    it('returns a saved run by id', async () => {
      const req = makeReq({ query: { action: 'run', runId: 'run-1' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'run_not_found');
    });

    it('returns 400 when runId is missing', async () => {
      const req = makeReq({ query: { action: 'run' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'missing_runId');
    });
  });

  describe('POST /run', () => {
    it('runs a strict-default sandbox tool for guest', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'run', toolId: 'tool-pdf-text-extractor', policyId: 'policy-strict-default', inputData: 'clean input' }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(result.body.run).toHaveProperty('toolId', 'tool-pdf-text-extractor');
      expect(result.body.run).toHaveProperty('status', 'completed');
      expect(result.body.run.untrusted).toBe(true);
      expect(result.body.run.noCitizenData).toBe(true);
      expect(result.body.scan).toHaveProperty('blocked');
    });

    it('is deterministic across repeated runs', async () => {
      const body = { action: 'run', toolId: 'tool-civic-form-parser', policyId: 'policy-strict-default' };
      const a = await handler(makeReq({ method: 'POST', body }), makeRes());
      const b = await handler(makeReq({ method: 'POST', body }), makeRes());
      expect(a.body.run.output.result).toBe(b.body.run.output.result);
    });

    it('requires human approval for permissive policy', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'run', toolId: 'tool-govt-endpoint-fetcher', policyId: 'policy-permissive-admin', humanApproved: false }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error');
      expect(result.body.error).toBe('AS_PERMISSION_DENIED');
    });

    it('blocks network call under strict policy', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'run', toolId: 'tool-pdf-text-extractor', policyId: 'policy-strict-default', inputData: 'fetch("http://evil")' }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'AS_THREAT_DETECTED');
      expect(result.body.blocked).toBe(true);
    });

    it('rejects sensitive fields', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'run', toolId: 'tool-pdf-text-extractor', policyId: 'policy-strict-default', inputData: 'aadhaar 1234 5678 9012' }
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

  describe('POST /save-run', () => {
    it('returns 401 for guest', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'save-run', runId: 'run-1', toolId: 'tool-pdf-text-extractor' }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });

    it('returns 401 for guest even when runId is missing', async () => {
      const req = makeReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: { action: 'save-run' }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });
  });

  describe('POST /load-run', () => {
    it('returns 404 for unknown run', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'load-run', runId: 'unknown-run' }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'run_not_found');
    });
  });

  describe('POST /sandbox-report', () => {
    it('returns a report for a valid run', async () => {
      const run = {
        runId: 'run-x',
        toolId: 'tool-pdf-text-extractor',
        policyId: 'policy-strict-default',
        status: 'completed',
        toolName: 'Civic PDF Text Extractor',
        policyName: 'Strict Default',
        output: { result: 'ok', illustrative: true, noCitizenData: true },
        resourcesUsed: { cpuMs: 1000, memoryMB: 30, timeMs: 2000 },
        networkUsed: false,
        humanApproved: false,
        provenance: 'test',
        policyVersion: '1.0.0',
        schemaVersion: 'civic-agent-sandbox-v1',
        dataVersion: '2026-11-21',
        reviewedAt: '2026-11-21',
        isStale: false,
        disclaimer: 'illustrative',
        untrusted: true,
        requiresHumanReview: true
      };
      const req = makeReq({ method: 'POST', body: { action: 'sandbox-report', run } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(typeof result.body.report).toBe('string');
      expect(result.body.report).toContain('illustrative');
    });

    it('returns 400 for invalid run', async () => {
      const req = makeReq({ method: 'POST', body: { action: 'sandbox-report', run: {} } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'invalid_run');
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
