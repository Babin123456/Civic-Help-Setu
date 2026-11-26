import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CivicAgentIncidentResponseService,
  IncidentRecoveryChecklist,
  BREAKER_STATES,
  INCIDENT_SEVERITY,
  scrubIncidentTelemetry
} from './civicAgentIncidentResponseService.js';

describe('CivicAgentIncidentResponseService', () => {
  let service;

  beforeEach(() => {
    service = new CivicAgentIncidentResponseService({
      consecutiveFailureThreshold: 3,
      resetTimeoutMs: 100, // fast reset for testing
      maxHalfOpenAttempts: 2,
      costSpikeTokensPerMinute: 1000,
      loopRecursionLimit: 3
    });
  });

  describe('PII Redaction in Telemetry and Audits', () => {
    it('scrubs Aadhaar, PAN, phone numbers, and secrets from incident logs', () => {
      const rawPayload = {
        aadhaar: '1234 5678 9012',
        pan: 'ABCDE1234F',
        phone: '9876543210',
        email: 'citizen@example.com',
        apiKey: 'super_secret_key_123',
        query: 'Help with my ration card application'
      };

      const scrubbed = scrubIncidentTelemetry(rawPayload);
      expect(scrubbed.aadhaar).toBe('[REDACTED_AADHAAR]');
      expect(scrubbed.pan).toBe('[REDACTED_PAN]');
      expect(scrubbed.phone).toBe('[REDACTED_PHONE]');
      expect(scrubbed.email).toBe('[REDACTED_EMAIL]');
      expect(scrubbed.apiKey).toBe('[REDACTED_SECRET]');
      expect(scrubbed.query).toBe('Help with my ration card application');
    });

    it('handles string telemetry inputs safely', () => {
      const rawText = 'User 9876543210 entered Aadhaar 1111 2222 3333 with secret password:"admin"';
      const scrubbed = scrubIncidentTelemetry(rawText);
      expect(scrubbed).toContain('[REDACTED_PHONE]');
      expect(scrubbed).toContain('[REDACTED_AADHAAR]');
      expect(scrubbed).toContain('"password":"[REDACTED_SECRET]"');
    });
  });

  describe('Global Kill-Switch Controls', () => {
    it('engages global kill-switch and immediately blocks all agent execution', () => {
      expect(service.checkExecutionPermission('civic-assistant').permitted).toBe(true);

      const killResult = service.engageGlobalKillSwitch({
        actorId: 'LEAD_MAINTAINER',
        reason: 'Compromised upstream model provider',
        severity: INCIDENT_SEVERITY.P1_CRITICAL
      });

      expect(killResult.active).toBe(true);
      expect(service.globalKillSwitchActive).toBe(true);

      // Now all agent execution must be blocked
      const check = service.checkExecutionPermission('civic-assistant');
      expect(check.permitted).toBe(false);
      expect(check.code).toBe('GLOBAL_KILL_SWITCH_ACTIVE');
      expect(check.fallbackAvailable).toBe(true);
    });

    it('blocks global kill-switch disengagement without a verified recovery checklist', () => {
      service.engageGlobalKillSwitch({ actorId: 'OPERATOR', reason: 'Test lock' });

      // Attempt without checklist must fail
      expect(() => {
        service.disengageGlobalKillSwitch({ actorId: 'OPERATOR', incidentId: 'inc-123' });
      }).toThrow(/Cannot disengage global kill-switch/);

      // Create and complete recovery checklist
      const checklist = service.createRecoveryChecklist({
        incidentId: 'inc-123',
        agentId: 'all',
        incidentType: 'GLOBAL_EMERGENCY'
      });

      checklist.markStep('ROOT_CAUSE_IDENTIFIED', true);
      checklist.markStep('UPSTREAM_RESTORED', true);
      checklist.markStep('QUARANTINE_INSPECTED', true);
      checklist.markStep('CANARY_HEALTH_CHECK', true);
      checklist.signOff('ADMIN_OFFICER');

      // Now disengage succeeds
      const result = service.disengageGlobalKillSwitch({ actorId: 'ADMIN_OFFICER', incidentId: 'inc-123' });
      expect(result.active).toBe(false);
      expect(service.globalKillSwitchActive).toBe(false);
    });
  });

  describe('Per-Agent Circuit Breakers', () => {
    it('trips from CLOSED to OPEN after consecutive failure threshold is breached', () => {
      const agentId = 'civic-assistant';

      service.recordCallResult(agentId, { success: false, error: new Error('Timeout 1') });
      service.recordCallResult(agentId, { success: false, error: new Error('Timeout 2') });
      expect(service.getBreaker(agentId).state).toBe(BREAKER_STATES.CLOSED);

      // 3rd failure hits threshold
      service.recordCallResult(agentId, { success: false, error: new Error('Timeout 3') });
      expect(service.getBreaker(agentId).state).toBe(BREAKER_STATES.OPEN);

      const check = service.checkExecutionPermission(agentId);
      expect(check.permitted).toBe(false);
      expect(check.code).toBe('CIRCUIT_BREAKER_OPEN');
    });

    it('transitions from OPEN to HALF_OPEN after resetTimeout, then heals on successful canary trials', async () => {
      const agentId = 'grounded-assistant';

      // Trip breaker
      service.tripBreaker(agentId, { reason: 'Test trip' });
      expect(service.getBreaker(agentId).state).toBe(BREAKER_STATES.OPEN);

      // Wait for resetTimeoutMs (configured to 100ms in beforeEach)
      await new Promise(r => setTimeout(r, 120));

      // Querying breaker automatically shifts to HALF_OPEN
      const breaker = service.getBreaker(agentId);
      expect(breaker.state).toBe(BREAKER_STATES.HALF_OPEN);

      // Canary attempt 1
      const check1 = service.checkExecutionPermission(agentId);
      expect(check1.permitted).toBe(true);
      service.recordCallResult(agentId, { success: true });

      // Canary attempt 2
      const check2 = service.checkExecutionPermission(agentId);
      expect(check2.permitted).toBe(true);
      service.recordCallResult(agentId, { success: true });

      // Reached maxHalfOpenAttempts (2) -> Circuit should close and recover
      expect(service.getBreaker(agentId).state).toBe(BREAKER_STATES.CLOSED);
    });

    it('trips immediately back to OPEN if canary trial fails in HALF_OPEN', async () => {
      const agentId = 'service-simplifier';
      service.tripBreaker(agentId, { reason: 'Test trip' });

      await new Promise(r => setTimeout(r, 120));
      expect(service.getBreaker(agentId).state).toBe(BREAKER_STATES.HALF_OPEN);

      // Canary trial fails
      service.recordCallResult(agentId, { success: false, error: new Error('Canary failed') });
      expect(service.getBreaker(agentId).state).toBe(BREAKER_STATES.OPEN);
    });
  });

  describe('Runaway Loop & Token Spike Prevention', () => {
    it('detects and trips circuit breaker on runaway query recursion', () => {
      const agentId = 'civic-assistant';
      const repeatedQuery = 'How do I download my birth certificate?';

      // Call 1
      let res = service.checkExecutionPermission(agentId, { queryPayload: repeatedQuery });
      expect(res.permitted).toBe(true);

      // Call 2
      res = service.checkExecutionPermission(agentId, { queryPayload: repeatedQuery });
      expect(res.permitted).toBe(true);

      // Call 3 breaches loopRecursionLimit (3)
      res = service.checkExecutionPermission(agentId, { queryPayload: repeatedQuery });
      expect(res.permitted).toBe(false);
      expect(res.code).toBe('RUNAWAY_LOOP_DETECTED');

      // Breaker is now tripped OPEN
      expect(service.getBreaker(agentId).state).toBe(BREAKER_STATES.OPEN);

      // Job is quarantined
      expect(service.quarantinedQueue.length).toBeGreaterThan(0);
      expect(service.quarantinedQueue[0].agentId).toBe(agentId);
    });

    it('trips circuit breaker when token expenditure spike exceeds velocity limit', () => {
      const agentId = 'grounded-assistant';

      service.recordCallResult(agentId, { success: true, tokensUsed: 400 });
      expect(service.getBreaker(agentId).state).toBe(BREAKER_STATES.CLOSED);

      // Second call sends token sum to 1200 > 1000 limit
      service.recordCallResult(agentId, { success: true, tokensUsed: 800 });
      expect(service.getBreaker(agentId).state).toBe(BREAKER_STATES.OPEN);
      expect(service.getBreaker(agentId).tripReason).toContain('Token consumption velocity limit breached');
    });
  });

  describe('Granular Tool Revocation', () => {
    it('revokes and restores specific tools independently of agents', () => {
      const toolName = 'saveApplicationDraft';
      expect(service.isToolRevoked(toolName)).toBe(false);

      service.revokeTool({ toolName, actorId: 'SECURITY_BOT', reason: 'Draft storage corruption' });
      expect(service.isToolRevoked(toolName)).toBe(true);

      const check = service.checkExecutionPermission('civic-assistant', { toolName });
      expect(check.permitted).toBe(false);
      expect(check.code).toBe('TOOL_REVOKED');

      // Other tools remain functional
      const checkOther = service.checkExecutionPermission('civic-assistant', { toolName: 'searchCivicFaq' });
      expect(checkOther.permitted).toBe(true);

      // Restore tool
      service.restoreTool({ toolName, actorId: 'OPERATOR' });
      expect(service.isToolRevoked(toolName)).toBe(false);
      expect(service.checkExecutionPermission('civic-assistant', { toolName }).permitted).toBe(true);
    });
  });

  describe('Quarantined Job Lifecycle', () => {
    it('quarantines suspicious jobs, preserves PII-free metadata, and allows eviction', () => {
      const job = service.quarantineJob({
        agentId: 'civic-assistant',
        payload: { userQuery: 'Aadhaar 1234 5678 9012 update', phone: '9876543210' },
        reason: 'Suspicious payload structure'
      });

      expect(job.status).toBe('QUARANTINED');
      expect(job.payload.aadhaar).toBeUndefined(); // raw string was redacted
      expect(JSON.stringify(job.payload)).toContain('[REDACTED_AADHAAR]');

      expect(service.quarantinedQueue.length).toBe(1);

      // Evict job
      const evicted = service.evictQuarantinedJob(job.quarantineId, { actorId: 'OPERATOR' });
      expect(evicted.quarantineId).toBe(job.quarantineId);
      expect(service.quarantinedQueue.length).toBe(0);
    });
  });

  describe('Non-AI Fallback Routes', () => {
    it('returns verified manual offline instructions when AI is unavailable', () => {
      const fallback = service.getFallbackGuidance('ration-card');
      expect(fallback.fallbackUsed).toBe(true);
      expect(fallback.portalUrl).toBe('https://nfsa.gov.in');
      expect(fallback.helpline).toBe('1967');
      expect(fallback.steps.length).toBeGreaterThan(0);
    });
  });
});
