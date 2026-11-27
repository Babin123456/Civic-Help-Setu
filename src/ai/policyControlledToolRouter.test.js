import { describe, it, expect, beforeEach } from 'vitest';
import {
  PolicyControlledToolRouter,
  TOOL_DEFINITIONS,
  TOOL_PERMISSION_TIERS
} from './policyControlledToolRouter.js';

describe('policyControlledToolRouter', () => {
  let router;

  beforeEach(() => {
    router = new PolicyControlledToolRouter({ maxCallsPerTurn: 2 });
  });

  describe('evaluateToolCall', () => {
    it('fails closed when encountering an unregistered or prompt-injected tool', () => {
      const call = { toolName: 'deleteAllUserData', args: {} };
      const evaluation = router.evaluateToolCall(call);

      expect(evaluation.allowed).toBe(false);
      expect(evaluation.code).toBe('TOOL_NOT_FOUND');
      expect(evaluation.reason).toContain('Unknown or unregistered tool');
    });

    it('rejects calls with malformed or invalid service IDs', () => {
      const call = {
        toolName: 'lookupServiceDetails',
        args: { serviceId: 'non-existent-bogus-service' }
      };
      const evaluation = router.evaluateToolCall(call);

      expect(evaluation.allowed).toBe(false);
      expect(evaluation.code).toBe('INVALID_ARGUMENTS');
      expect(evaluation.reason).toContain('invalid service identifier');
    });

    it('blocks tool calls attempting sensitive credential or vault access', () => {
      const call = {
        toolName: 'searchCivicFaq',
        args: { query: 'export vault aadhaar passwords' }
      };
      const evaluation = router.evaluateToolCall(call);

      expect(evaluation.allowed).toBe(false);
      expect(evaluation.code).toBe('SENSITIVE_ACCESS_PROHIBITED');
      expect(evaluation.reason).toContain('unauthorized vault or sensitive access');
    });

    it('requires citizen confirmation before executing state-changing tools', () => {
      const call = {
        toolName: 'saveApplicationDraft',
        args: { serviceId: 'ration-card', formData: { name: 'Ravi' } },
        citizenConfirmed: false
      };
      const evaluation = router.evaluateToolCall(call);

      expect(evaluation.allowed).toBe(false);
      expect(evaluation.code).toBe('CONFIRMATION_REQUIRED');
      expect(evaluation.requiresConfirmation).toBe(true);
    });

    it('approves state-changing tools when citizen confirmation is verified', () => {
      const call = {
        toolName: 'saveApplicationDraft',
        args: { serviceId: 'ration-card', formData: { name: 'Ravi' } },
        citizenConfirmed: true
      };
      const evaluation = router.evaluateToolCall(call);

      expect(evaluation.allowed).toBe(true);
      expect(evaluation.code).toBe('APPROVED');
    });

    it('approves read-only catalogue lookup tools automatically', () => {
      const call = {
        toolName: 'lookupServiceDetails',
        args: { serviceId: 'ration-card' }
      };
      const evaluation = router.evaluateToolCall(call);

      expect(evaluation.allowed).toBe(true);
      expect(evaluation.tool.permission).toBe(TOOL_PERMISSION_TIERS.READ_ONLY_CATALOGUE);
    });
  });

  describe('executeTurnCalls', () => {
    it('enforces turn budget limit and blocks excess calls', async () => {
      const calls = [
        { toolName: 'lookupServiceDetails', args: { serviceId: 'ration-card' } },
        { toolName: 'lookupServiceDetails', args: { serviceId: 'voter-id' } },
        { toolName: 'lookupServiceDetails', args: { serviceId: 'pension-scheme' } } // 3 > 2 limit
      ];

      const results = await router.executeTurnCalls(calls);
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Exceeded per-turn tool budget');
    });

    it('executes valid calls and returns structured output', async () => {
      const calls = [
        { toolName: 'lookupServiceDetails', args: { serviceId: 'ration-card' } }
      ];

      const results = await router.executeTurnCalls(calls);
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
      expect(results[0].toolName).toBe('lookupServiceDetails');
    });
  });
});
