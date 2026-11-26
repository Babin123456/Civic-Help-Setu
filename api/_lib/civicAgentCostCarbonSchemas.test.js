/**
 * api/_lib/civicAgentCostCarbonSchemas.test.js
 *
 * Unit tests for versioned request/response validation contracts of the
 * Civic Agent Cost and Carbon Budget Governor API (#1185).
 */

import { describe, it, expect } from 'vitest';
import {
  validateStartRun,
  validateRecordCall,
  validateStopRun,
  validatePolicyConfig,
  validateListQuery,
  schemaVersion,
} from './civicAgentCostCarbonSchemas.js';

describe('civicAgentCostCarbonSchemas', () => {
  it('reports the schema version', () => {
    expect(schemaVersion()).toBe(1);
  });

  describe('validateStartRun', () => {
    it('accepts a valid start-run request', () => {
      const v = validateStartRun({ workflowId: 'wf-1', modelId: 'gpt-4o-mini', prompt: 'hello', isHighImpact: false, humanApproved: false });
      expect(v.valid).toBe(true);
      expect(v.value.workflowId).toBe('wf-1');
    });

    it('rejects invalid workflowId', () => {
      const v = validateStartRun({ workflowId: 'Invalid Id!' });
      expect(v.valid).toBe(false);
      expect(v.errors.length).toBeGreaterThan(0);
    });

    it('rejects non-string prompt', () => {
      const v = validateStartRun({ workflowId: 'wf-1', prompt: 123 });
      expect(v.valid).toBe(false);
    });

    it('rejects overlong prompt', () => {
      const v = validateStartRun({ workflowId: 'wf-1', prompt: 'A'.repeat(70000) });
      expect(v.valid).toBe(false);
    });

    it('rejects unknown/high-impact without boolean', () => {
      const v = validateStartRun({ workflowId: 'wf-1', isHighImpact: 'yes' });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateRecordCall', () => {
    it('accepts a valid record-call request', () => {
      const v = validateRecordCall({ runId: 'run-1', modelId: 'gpt-4o-mini', prompt: 'p', output: 'o', inputTokens: 10, outputTokens: 20, latencyMs: 100 });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid runId', () => {
      const v = validateRecordCall({ runId: 'bad id', modelId: 'gpt-4o-mini' });
      expect(v.valid).toBe(false);
    });

    it('rejects negative tokens', () => {
      const v = validateRecordCall({ runId: 'run-1', modelId: 'gpt-4o-mini', inputTokens: -1 });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateStopRun', () => {
    it('accepts a valid stop-run request', () => {
      const v = validateStopRun({ runId: 'run-1', reason: 'user stop' });
      expect(v.valid).toBe(true);
    });

    it('rejects overlong reason', () => {
      const v = validateStopRun({ runId: 'run-1', reason: 'A'.repeat(600) });
      expect(v.valid).toBe(false);
    });
  });

  describe('validatePolicyConfig', () => {
    it('accepts a valid policy config', () => {
      const v = validatePolicyConfig({ id: 'policy-test', name: 'Test', maxTotalCostUSD: 10, maxTotalTokens: 100000 });
      expect(v.valid).toBe(true);
      expect(v.value.id).toBe('policy-test');
    });

    it('rejects invalid policy id', () => {
      const v = validatePolicyConfig({ id: 'Bad Id' });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateListQuery', () => {
    it('accepts a valid list query', () => {
      const v = validateListQuery({ workflowId: 'wf-1', limit: 10 });
      expect(v.valid).toBe(true);
    });

    it('rejects limit out of range', () => {
      const v = validateListQuery({ limit: 0 });
      expect(v.valid).toBe(false);
    });
  });
});
