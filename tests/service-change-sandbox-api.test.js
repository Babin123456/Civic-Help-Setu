import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/service-change-sandbox.js';

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

describe('api/service-change-sandbox handler', () => {
  describe('GET /catalogue', () => {
    it('returns catalogue with snapshots, service versions, journey patterns, shadow runs, comparisons, write block', async () => {
      const req = makeReq({ query: { action: 'catalogue' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(Array.isArray(result.body.stagingSnapshots)).toBe(true);
      expect(Array.isArray(result.body.serviceVersions)).toBe(true);
      expect(Array.isArray(result.body.journeyPatterns)).toBe(true);
      expect(Array.isArray(result.body.shadowTrafficRuns)).toBe(true);
      expect(Array.isArray(result.body.comparisonResults)).toBe(true);
      expect(result.body.productionWriteBlock).toHaveProperty('blocked');
      expect(result.body.stagingSnapshots.length).toBeGreaterThan(0);
    });

    it('returns 400 when action is missing', async () => {
      const req = makeReq({});
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'missing_action');
    });
  });

  describe('GET /snapshot', () => {
    it('returns a snapshot by id', async () => {
      const req = makeReq({ query: { action: 'snapshot', snapshotId: 'snapshot-income-certificate-v2-rollout' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(result.body.snapshot.id).toBe('snapshot-income-certificate-v2-rollout');
    });

    it('returns 404 for unknown snapshotId', async () => {
      const req = makeReq({ query: { action: 'snapshot', snapshotId: 'unknown-snapshot' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'snapshot_not_found');
    });

    it('returns 400 when snapshotId is missing', async () => {
      const req = makeReq({ query: { action: 'snapshot' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'missing_snapshotId');
    });
  });

  describe('POST /run', () => {
    it('runs shadow traffic for guest', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'run', snapshotId: 'snapshot-income-certificate-v2-rollout', journeyPatternIds: ['journey-income-certificate-complete'], replayCount: 1000, seed: 20261122 }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(result.body.run).toHaveProperty('snapshot');
      expect(result.body.run).toHaveProperty('baseline');
      expect(result.body.run).toHaveProperty('proposed');
      expect(result.body.run).toHaveProperty('comparison');
      expect(result.body.run.untrusted).toBe(true);
      expect(result.body.run.requiresHumanReview).toBe(true);
    });

    it('is deterministic across repeated runs', async () => {
      const body = { action: 'run', snapshotId: 'snapshot-income-certificate-v2-rollout', journeyPatternIds: ['journey-income-certificate-complete'], replayCount: 1000, seed: 7 };
      const a = await handler(makeReq({ method: 'POST', body }), makeRes());
      const b = await handler(makeReq({ method: 'POST', body }), makeRes());
      expect(a.body.run.comparison.completionDelta).toBe(b.body.run.comparison.completionDelta);
    });

    it('rejects sensitive fields', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'run', snapshotId: 'snapshot-income-certificate-v2-rollout', title: 'aadhaar 1234 5678 9012' }
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

  describe('POST /publish-snapshot', () => {
    it('returns 401 for guest', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'publish-snapshot', snapshotId: 'snapshot-caste-certificate-v1-baseline', humanApproved: true }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });

    it('returns 401 for guest when snapshotId is missing', async () => {
      const req = makeReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: { action: 'publish-snapshot', humanApproved: true }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });
  });

  describe('POST /rollback-snapshot', () => {
    it('returns 401 for guest', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'rollback-snapshot', snapshotId: 'snapshot-income-certificate-v2-rollout', humanApproved: true }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });
  });

  describe('POST /create-snapshot', () => {
    it('returns 401 for guest', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'create-snapshot', snapshotId: 'snapshot-test', serviceId: 'service-income-certificate', fromVersionId: 'svc-income-certificate-v1', toVersionId: 'svc-income-certificate-v2', title: 'Test' }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });
  });

  describe('POST /save-run', () => {
    it('returns 401 for guest', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'save-run', runId: 'run-1', snapshotId: 'snapshot-income-certificate-v2-rollout' }
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });

    it('returns 401 for guest when runId is missing', async () => {
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

  describe('POST /shadow-report', () => {
    it('returns a report for a valid run', async () => {
      const run = {
        snapshot: { id: 'snapshot-x', title: 'Test', fromVersionId: 'svc-a', toVersionId: 'svc-b' },
        baseline: { completionRate: 0.88, validationFailureRate: 0.06, accessibilityIssues: 0, documentDropOffRate: 0.12, averageCompletionTimeSeconds: 240 },
        proposed: { completionRate: 0.85, validationFailureRate: 0.07, accessibilityIssues: 0, documentDropOffRate: 0.14, averageCompletionTimeSeconds: 260 },
        comparison: { completionDelta: -0.03, validationFailureDelta: 0.01, accessibilityIssuesDelta: 0, completionTimeDeltaSeconds: 20, documentDropOffDelta: 0.02, recommendation: 'proceed-with-caution', reasoning: 'test' },
        reproducibility: { seed: 123, schemaVersion: 'civic-service-change-sandbox-v1', dataVersion: '2026-11-22' },
        disclaimer: 'illustrative'
      };
      const req = makeReq({ method: 'POST', body: { action: 'shadow-report', run } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(typeof result.body.report).toBe('string');
      expect(result.body.report).toContain('illustrative');
    });

    it('returns 400 for invalid run', async () => {
      const req = makeReq({ method: 'POST', body: { action: 'shadow-report', run: {} } });
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
