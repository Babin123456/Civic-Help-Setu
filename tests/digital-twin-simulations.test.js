import { describe, it, expect } from 'vitest';
import handler, {
  validateSimulationApiRequest,
} from '../api/_lib/handlers/digital-twin-simulations.js';
import {
  WORKFLOW_INCOME_CERT_V1,
  WORKFLOW_INCOME_CERT_V2_PROPOSED,
} from '../src/data/digitalTwinSeed.js';

function createMockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('api/digital-twin-simulations serverless endpoint (#1157)', () => {
  describe('validateSimulationApiRequest input validation', () => {
    it('validates a compliant simulation request', () => {
      const valid = {
        action: 'SIMULATE',
        workflowId: 'wf-income-cert-v1',
      };
      const errors = validateSimulationApiRequest(valid);
      expect(errors).toEqual([]);
    });

    it('strictly rejects forbidden citizen credentials and PII', () => {
      const piiPayload = {
        action: 'SIMULATE',
        workflowId: 'wf-income-cert-v1',
        aadhaarNumber: '1234-5678-9012',
        secret: 'admin-password',
      };
      const errors = validateSimulationApiRequest(piiPayload);
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors.some((e) => e.includes('aadhaarNumber'))).toBe(true);
      expect(errors.some((e) => e.includes('secret'))).toBe(true);
    });

    it('rejects unknown actions', () => {
      const badAction = { action: 'HACK_DATABASE', workflowId: 'wf-income-cert-v1' };
      const errors = validateSimulationApiRequest(badAction);
      expect(errors.some((e) => e.includes('Invalid action'))).toBe(true);
    });
  });

  describe('handler HTTP responses', () => {
    it('handles GET requests with service health and available fixtures', async () => {
      const req = { method: 'GET' };
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.service).toBe('civic-workflow-digital-twin');
      expect(res.body.status).toBe('HEALTHY');
      expect(Array.isArray(res.body.availableWorkflows)).toBe(true);
      expect(Array.isArray(res.body.availablePersonas)).toBe(true);
    });

    it('rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
      const req = { method: 'DELETE' };
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(405);
      expect(res.body.error).toBe('Method Not Allowed');
    });

    it('rejects POST with forbidden citizen PII with 400 Bad Request', async () => {
      const req = {
        method: 'POST',
        body: {
          action: 'SIMULATE',
          workflowId: 'wf-income-cert-v1',
          panNumber: 'ABCDE1234F',
        },
      };
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Invalid Simulation Request');
    });

    it('runs cohort simulation via POST returning 200 and sanitized report', async () => {
      const req = {
        method: 'POST',
        body: {
          action: 'SIMULATE',
          workflowId: 'wf-income-cert-v1',
        },
      };
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.type).toBe('COHORT');
      expect(res.body.report.totalPersonas).toBeGreaterThanOrEqual(4);
      expect(res.body.report.successRate).toBeGreaterThan(0);
    });

    it('runs single persona simulation via POST', async () => {
      const req = {
        method: 'POST',
        body: {
          action: 'SIMULATE',
          workflowId: 'wf-income-cert-v1',
          personaId: 'synth-persona-standard',
        },
      };
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.type).toBe('SINGLE_PERSONA');
      expect(res.body.result.outcome).toBe('SUCCESS');
      expect(res.body.result.trace.length).toBeGreaterThanOrEqual(4);
    });

    it('compares two workflow versions via POST', async () => {
      const req = {
        method: 'POST',
        body: {
          action: 'COMPARE',
          baseWorkflow: WORKFLOW_INCOME_CERT_V1,
          proposedWorkflow: WORKFLOW_INCOME_CERT_V2_PROPOSED,
        },
      };
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe('COMPARE');
      expect(res.body.comparison).toBeDefined();
      expect(res.body.comparison.isBreaking).toBe(false);
    });

    it('handles concurrent simulation requests safely without race conditions', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => {
        const req = {
          method: 'POST',
          body: {
            action: 'SIMULATE',
            workflowId: 'wf-income-cert-v1',
            personaId: i % 2 === 0 ? 'synth-persona-standard' : 'synth-persona-migrant-tenant',
          },
        };
        const res = createMockResponse();
        return handler(req, res).then(() => res);
      });

      const responses = await Promise.all(promises);
      for (const res of responses) {
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
      }
    });
  });
});
