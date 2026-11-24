import { describe, it, expect } from 'vitest';
import {
  runSandboxTool,
  validateSandboxRequest,
  scanForThreats,
  validateSandboxOutput,
  enforceResourceLimits,
  saveSandboxRun,
  loadSandboxRun,
  listSandboxRuns,
  buildSandboxReport,
  SANDBOX_ERRORS,
  __testables
} from './civicAgentSandboxService.js';
import { listPolicies, listTools, listDocuments, listThreats, getPolicy, getTool } from '../data/civicAgentSandboxData.js';

const { redactPii, computeDigest } = __testables;

// ---- localStorage mock (vitest runs in node env) ----
const localStorageStore = {};
const mockLocalStorage = {
  getItem: (key) => localStorageStore[key] ?? null,
  setItem: (key, value) => { localStorageStore[key] = value; },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); }
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

describe('civicAgentSandboxService', () => {
  describe('listings', () => {
    it('lists policies, tools, documents, threats', () => {
      expect(listPolicies().length).toBeGreaterThan(0);
      expect(listTools().length).toBeGreaterThan(0);
      expect(listDocuments().length).toBeGreaterThan(0);
      expect(listThreats().length).toBeGreaterThan(0);
      expect(getPolicy('policy-strict-default')).not.toBeNull();
      expect(getTool('tool-pdf-text-extractor')).not.toBeNull();
    });
  });

  describe('validation', () => {
    it('rejects non-object input', () => {
      const result = validateSandboxRequest('not-object');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(SANDBOX_ERRORS.INVALID_TYPE);
    });

    it('rejects sensitive keys', () => {
      const result = validateSandboxRequest({ aadhaar_number: '1234' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === SANDBOX_ERRORS.SENSITIVE_FIELD)).toBe(true);
    });

    it('rejects sensitive text values', () => {
      const result = validateSandboxRequest({ inputData: 'my aadhaar is 1234 5678 9012' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === SANDBOX_ERRORS.SENSITIVE_VALUE)).toBe(true);
    });

    it('rejects unknown tool and policy ids', () => {
      const r1 = validateSandboxRequest({ toolId: 'tool-does-not-exist' });
      expect(r1.valid).toBe(false);
      expect(r1.errors.some((e) => e.code === SANDBOX_ERRORS.TOOL_NOT_FOUND)).toBe(true);
      const r2 = validateSandboxRequest({ policyId: 'policy-does-not-exist' });
      expect(r2.valid).toBe(false);
      expect(r2.errors.some((e) => e.code === SANDBOX_ERRORS.POLICY_NOT_FOUND)).toBe(true);
    });

    it('accepts a valid minimal request', () => {
      const result = validateSandboxRequest({ toolId: 'tool-pdf-text-extractor' });
      expect(result.valid).toBe(true);
    });
  });

  describe('threat scanning', () => {
    it('detects embedded script in input', () => {
      const result = scanForThreats({ inputData: '<script>alert(1)</script>' });
      expect(result.blocked).toBe(true);
      expect(result.threats.some((t) => t.threatId === 'threat-embedded-script')).toBe(true);
    });

    it('detects eval call', () => {
      const result = scanForThreats({ inputData: 'eval("bad")' });
      expect(result.blocked).toBe(true);
    });

    it('detects PII and redacts', () => {
      const result = scanForThreats({ inputData: 'aadhaar 1234 5678 9012' });
      expect(result.redacted).toBe(true);
      expect(result.threats.some((t) => t.threatId === 'threat-pii-leak')).toBe(true);
    });

    it('blocks network call when network disabled', () => {
      const policy = getPolicy('policy-strict-default');
      const result = scanForThreats({ inputData: 'fetch("http://evil")', policy });
      expect(result.blocked).toBe(true);
    });

    it('safe input returns no threats', () => {
      const result = scanForThreats({ inputData: 'clean civic text' });
      expect(result.safe).toBe(true);
      expect(result.blocked).toBe(false);
    });
  });

  describe('output validation', () => {
    it('accepts valid output with required fields', () => {
      const policy = getPolicy('policy-strict-default');
      const result = validateSandboxOutput({ result: 'ok' }, policy);
      expect(result.valid).toBe(true);
    });

    it('rejects missing required field', () => {
      const policy = getPolicy('policy-strict-default');
      const result = validateSandboxOutput({}, policy);
      expect(result.valid).toBe(false);
    });

    it('rejects non-object output', () => {
      const policy = getPolicy('policy-strict-default');
      const result = validateSandboxOutput('not-object', policy);
      expect(result.valid).toBe(false);
    });
  });

  describe('resource limits', () => {
    it('allows within limits', () => {
      const policy = getPolicy('policy-strict-default');
      const result = enforceResourceLimits({ policy, cpuEstimateMs: 1000, memoryEstimateMB: 30, timeEstimateMs: 2000 });
      expect(result.ok).toBe(true);
    });

    it('rejects exceeding limits', () => {
      const policy = getPolicy('policy-strict-default');
      const result = enforceResourceLimits({ policy, cpuEstimateMs: 90000, memoryEstimateMB: 30, timeEstimateMs: 2000 });
      expect(result.ok).toBe(false);
      expect(result.limited.some((l) => l.resource === 'cpu')).toBe(true);
    });
  });

  describe('redaction', () => {
    it('redacts Aadhaar and PAN', () => {
      const out = redactPii('aadhaar 1234 5678 9012 pan ABCDE1234F');
      expect(out).toContain('[REDACTED_AADHAAR]');
      expect(out).toContain('[REDACTED_PAN]');
      expect(out).not.toContain('1234 5678 9012');
      expect(out).not.toContain('ABCDE1234F');
    });
  });

  describe('runSandboxTool', () => {
    it('runs a strict-default tool successfully', () => {
      const result = runSandboxTool({
        toolId: 'tool-pdf-text-extractor',
        policyId: 'policy-strict-default',
        documentId: 'doc-synthetic-income-cert',
        inputData: 'clean input'
      });
      expect(result.ok).toBe(true);
      expect(result.run.status).toBe('completed');
      expect(result.run.untrusted).toBe(true);
      expect(result.run.requiresHumanReview).toBe(true);
      expect(result.run.noCitizenData).toBe(true);
      expect(result.run.illustrative).toBe(true);
    });

    it('requires human approval for permissive policy', () => {
      const result = runSandboxTool({
        toolId: 'tool-govt-endpoint-fetcher',
        policyId: 'policy-permissive-admin',
        humanApproved: false
      });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(SANDBOX_ERRORS.PERMISSION_DENIED);
    });

    it('succeeds with human approval for permissive policy', () => {
      const result = runSandboxTool({
        toolId: 'tool-govt-endpoint-fetcher',
        policyId: 'policy-permissive-admin',
        humanApproved: true,
        networkAllowed: true
      });
      expect(result.ok).toBe(true);
      expect(result.run.networkUsed).toBe(true);
    });

    it('blocks network call under strict policy', () => {
      const result = runSandboxTool({
        toolId: 'tool-pdf-text-extractor',
        policyId: 'policy-strict-default',
        inputData: 'fetch("http://evil")'
      });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(SANDBOX_ERRORS.THREAT_DETECTED);
      expect(result.blocked).toBe(true);
    });

    it('is deterministic across runs', () => {
      const a = runSandboxTool({ toolId: 'tool-civic-form-parser', policyId: 'policy-strict-default' });
      const b = runSandboxTool({ toolId: 'tool-civic-form-parser', policyId: 'policy-strict-default' });
      expect(a.run.output.result).toBe(b.run.output.result);
    });

    it('returns validation failure for unknown tool', () => {
      const result = runSandboxTool({ toolId: 'tool-does-not-exist' });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(SANDBOX_ERRORS.TOOL_NOT_FOUND);
    });
  });

  describe('storage', () => {
    it('save/load/list round-trips', () => {
      const saved = saveSandboxRun({ runId: 'run-1', toolId: 'tool-pdf-text-extractor', policyId: 'policy-strict-default', status: 'completed', summary: 'test run' });
      expect(saved.ok).toBe(true);
      const loaded = loadSandboxRun('run-1');
      expect(loaded).not.toBeNull();
      expect(loaded.summary).toBe('test run');
      const all = listSandboxRuns();
      expect(all.some((r) => r.runId === 'run-1')).toBe(true);
    });

    it('rejects invalid save', () => {
      const saved = saveSandboxRun({ runId: 'run-2', toolId: 'tool-does-not-exist' });
      expect(saved.ok).toBe(false);
    });
  });

  describe('buildSandboxReport', () => {
    it('returns a report string', () => {
      const result = runSandboxTool({ toolId: 'tool-pdf-text-extractor', policyId: 'policy-strict-default' });
      const report = buildSandboxReport(result);
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      expect(report).toContain('illustrative');
    });

    it('returns message for invalid result', () => {
      const report = buildSandboxReport({ ok: false });
      expect(typeof report).toBe('string');
    });
  });

  describe('computeDigest', () => {
    it('is deterministic', () => {
      expect(computeDigest({ x: 1 })).toBe(computeDigest({ x: 1 }));
      expect(computeDigest({ x: 1 })).not.toBe(computeDigest({ x: 2 }));
    });
  });
});
