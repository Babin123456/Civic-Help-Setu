/**
 * src/services/civicChaosResilienceService.test.js
 * Unit and resilience integration tests for Civic Operations Chaos Engineering (#1192).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CIVIC_CHAOS_SCHEMA_VERSION,
  DEPENDENCY_TYPES,
  FAULT_TYPES,
  DEFAULT_RECOVERY_OBJECTIVES,
  SYNTHETIC_CHAOS_FIXTURES,
  validateChaosDrillConfig,
  validateCitizenDraftPayload,
} from '../data/civicChaosResilienceContract';
import chaosEngine, { CIRCUIT_STATE } from './civicChaosInjectionEngine';
import {
  saveCitizenDraftWithResilience,
  getCivicGuidanceWithResilience,
  getWardBoundaryWithResilience,
  sendNotificationWithResilience,
  uploadEvidenceWithResilience,
  executeResilienceEvaluationSuite,
  getLocalDraftJournal,
  getDeadLetterEmailSpool,
  getStorageUploadQueue,
  resetResilienceState,
} from './civicChaosResilienceService';

describe('Civic Operations Chaos Engineering and Resilience Test Suite (#1192)', () => {
  beforeEach(() => {
    resetResilienceState();
  });

  describe('Contract & Trust Boundary Validation', () => {
    it('enforces schema version and allowed non-production environments', () => {
      expect(CIVIC_CHAOS_SCHEMA_VERSION).toBe('civic-chaos-resilience-v1');

      // Reject production
      const prodResult = validateChaosDrillConfig({
        name: 'Dangerous Prod Test',
        environment: 'production',
        operatorId: 'tester-1',
        injections: [{ dependency: DEPENDENCY_TYPES.FIREBASE, faultType: FAULT_TYPES.TIMEOUT, durationMs: 1000 }],
      });
      expect(prodResult.valid).toBe(false);
      expect(prodResult.errors.some((e) => e.includes('strictly prohibited in production'))).toBe(true);

      // Accept staging/test
      const testResult = validateChaosDrillConfig({
        name: 'Valid Staging Test',
        environment: 'staging',
        operatorId: 'tester-1',
        injections: [{ dependency: DEPENDENCY_TYPES.FIREBASE, faultType: FAULT_TYPES.TIMEOUT, durationMs: 1000 }],
      });
      expect(testResult.valid).toBe(true);
      expect(testResult.errors.length).toBe(0);
    });

    it('rejects raw PII in citizen draft payloads at validation boundary', () => {
      const validDraft = { ...SYNTHETIC_CHAOS_FIXTURES.sampleCitizenDraft };
      expect(validateCitizenDraftPayload(validDraft).valid).toBe(true);

      const invalidDraftWithAadhaar = {
        ...validDraft,
        formData: {
          ...validDraft.formData,
          rawAadhaar: '9876 5432 1098',
        },
      };
      const checkRes = validateCitizenDraftPayload(invalidDraftWithAadhaar);
      expect(checkRes.valid).toBe(false);
      expect(checkRes.errors.some((e) => e.includes('Raw 12-digit national identifier pattern detected'))).toBe(true);
    });
  });

  describe('Emergency Kill Switches & Circuit Breakers', () => {
    it('disengages all active injections immediately when Global Kill Switch is engaged', async () => {
      chaosEngine.startDrill({
        name: 'Timeout Drill',
        environment: 'test',
        operatorId: 'tester-1',
        injections: [
          {
            dependency: DEPENDENCY_TYPES.FIREBASE,
            faultType: FAULT_TYPES.CONNECTION_REFUSED,
            durationMs: 10000,
          },
        ],
      });

      expect(chaosEngine.getStatus().activeInjections[DEPENDENCY_TYPES.FIREBASE]).toBeDefined();

      // Engage global kill switch
      chaosEngine.engageGlobalKillSwitch('Emergency drill termination');
      expect(chaosEngine.getStatus().globalKillSwitchEngaged).toBe(true);
      expect(Object.keys(chaosEngine.getStatus().activeInjections).length).toBe(0);

      // Attempting to start another drill fails while kill switch is active
      expect(() =>
        chaosEngine.startDrill({
          name: 'Blocked Drill',
          environment: 'test',
          operatorId: 'tester-1',
          injections: [{ dependency: DEPENDENCY_TYPES.MAPS, faultType: FAULT_TYPES.TIMEOUT, durationMs: 1000 }],
        })
      ).toThrow('Cannot start drill while Global Kill Switch is engaged');

      // Calls bypass faults cleanly
      const intercept = await chaosEngine.interceptCall(DEPENDENCY_TYPES.FIREBASE);
      expect(intercept.shouldFail).toBe(false);
      expect(intercept.bypassReason).toContain('Kill switch engaged');
    });

    it('trips circuit breaker from CLOSED to OPEN after consecutive failures and enters HALF_OPEN', async () => {
      const breaker = chaosEngine.circuitBreakers.get(DEPENDENCY_TYPES.MODEL_PROVIDERS);
      expect(breaker.state).toBe(CIRCUIT_STATE.CLOSED);

      // Inject fault
      chaosEngine.activeInjections.set(DEPENDENCY_TYPES.MODEL_PROVIDERS, {
        faultType: FAULT_TYPES.RATE_LIMIT,
        durationMs: 10000,
        failureRate: 1.0,
      });

      // 3 consecutive failures
      await chaosEngine.interceptCall(DEPENDENCY_TYPES.MODEL_PROVIDERS);
      await chaosEngine.interceptCall(DEPENDENCY_TYPES.MODEL_PROVIDERS);
      await chaosEngine.interceptCall(DEPENDENCY_TYPES.MODEL_PROVIDERS);

      expect(breaker.state).toBe(CIRCUIT_STATE.OPEN);

      // Immediate fast-fail while OPEN
      const fastFail = await chaosEngine.interceptCall(DEPENDENCY_TYPES.MODEL_PROVIDERS);
      expect(fastFail.shouldFail).toBe(true);
      expect(fastFail.faultType).toBe('CIRCUIT_BREAKER_OPEN');

      // Advance time for recovery probe
      breaker.lastFailureTime = Date.now() - 6000;
      const canaryProbe = await chaosEngine.interceptCall(DEPENDENCY_TYPES.MODEL_PROVIDERS);
      expect(breaker.state).toBe(CIRCUIT_STATE.HALF_OPEN);

      // Record successful canary requests
      chaosEngine.recordSuccess(DEPENDENCY_TYPES.MODEL_PROVIDERS);
      chaosEngine.recordSuccess(DEPENDENCY_TYPES.MODEL_PROVIDERS);
      expect(breaker.state).toBe(CIRCUIT_STATE.CLOSED);
    });
  });

  describe('Citizen Draft Preservation (RPO = 0s)', () => {
    it('preserves citizen drafts in local offline journal during Firebase connection failure', async () => {
      // Injected Firebase failure
      chaosEngine.activeInjections.set(DEPENDENCY_TYPES.FIREBASE, {
        faultType: FAULT_TYPES.CONNECTION_REFUSED,
        durationMs: 5000,
        failureRate: 1.0,
      });

      const draft = SYNTHETIC_CHAOS_FIXTURES.sampleCitizenDraft;
      const result = await saveCitizenDraftWithResilience(draft);

      expect(result.success).toBe(true);
      expect(result.offlineActive).toBe(true);
      expect(result.persistedTo).toBe('local_offline_journal');
      expect(result.rpoSecondsLost).toBe(0);

      const localJournal = getLocalDraftJournal();
      expect(localJournal.length).toBe(1);
      expect(localJournal[0].draftId).toBe(draft.draftId);
      expect(localJournal[0].offlineChecksum).toBe(draft.checksum);
    });
  });

  describe('Model Provider Non-AI Fallback & Provenance', () => {
    it('switches to deterministic rule engine when AI models time out or rate limit', async () => {
      chaosEngine.activeInjections.set(DEPENDENCY_TYPES.MODEL_PROVIDERS, {
        faultType: FAULT_TYPES.RATE_LIMIT,
        durationMs: 5000,
        failureRate: 1.0,
      });

      const guidance = await getCivicGuidanceWithResilience({
        serviceCategory: 'ration_card',
        jurisdiction: 'Zone 3',
      });

      expect(guidance.success).toBe(true);
      expect(guidance.source).toBe('deterministic_rule_engine');
      expect(guidance.isAiSuggestion).toBe(false);
      expect(guidance.provenance.provenanceTag).toBe('UNTRUSTED_AI_FALLBACK_ACTIVE');
      expect(guidance.guidance.requiredDocuments.length).toBeGreaterThan(0);
    });
  });

  describe('Maps & GIS Boundary Degradation', () => {
    it('falls back to administrative gazetteer when tile service is unreachable or returns stale cache', async () => {
      chaosEngine.activeInjections.set(DEPENDENCY_TYPES.MAPS, {
        faultType: FAULT_TYPES.STALE_CACHE,
        durationMs: 5000,
        staleAgeMinutes: 1440,
        failureRate: 1.0,
      });

      const mapResult = await getWardBoundaryWithResilience('Ward 42');
      expect(mapResult.success).toBe(true);
      expect(mapResult.source).toBe('cached_administrative_gazetteer');
      expect(mapResult.degraded).toBe(true);
      expect(mapResult.gazetteerData.wardNumber).toBe('Ward 42');
    });
  });

  describe('Email Dead-Letter Spool & In-App Receipt', () => {
    it('spools emails to dead-letter queue and displays in-app verification token during SMTP outage', async () => {
      chaosEngine.activeInjections.set(DEPENDENCY_TYPES.EMAIL, {
        faultType: FAULT_TYPES.TIMEOUT,
        durationMs: 5000,
        failureRate: 1.0,
      });

      const res = await sendNotificationWithResilience({
        syntheticUserId: 'CIT-SYN-9021',
        subject: 'Submission confirmation',
      });

      expect(res.success).toBe(true);
      expect(res.deadLetterSpooled).toBe(true);
      expect(res.inAppVerificationToken.startsWith('SETU-INAPP-')).toBe(true);
      expect(getDeadLetterEmailSpool().length).toBe(1);
    });
  });

  describe('Evidence Vault Storage Quarantine', () => {
    it('caches uploads in sandboxed client chunk store when object storage fails', async () => {
      chaosEngine.activeInjections.set(DEPENDENCY_TYPES.STORAGE, {
        faultType: FAULT_TYPES.TIMEOUT,
        durationMs: 5000,
        failureRate: 1.0,
      });

      const res = await uploadEvidenceWithResilience({
        name: 'test_doc.pdf',
        size: 524288,
        type: 'application/pdf',
      });

      expect(res.success).toBe(true);
      expect(res.quarantinedLocally).toBe(true);
      expect(getStorageUploadQueue().length).toBe(1);
    });
  });

  describe('Automated Resilience Evaluation Suite', () => {
    it('executes full evaluation drill and verifies 100% draft retention rate', async () => {
      const report = await executeResilienceEvaluationSuite(
        SYNTHETIC_CHAOS_FIXTURES.presetScenarios[0].id
      );

      expect(report.schemaVersion).toBe(CIVIC_CHAOS_SCHEMA_VERSION);
      expect(report.overallStatus).toBe('PASS');
      expect(report.draftLossRate).toBe(0.0);
      expect(report.results.length).toBe(5);
      expect(report.results.every((r) => r.passed)).toBe(true);
    });
  });
});
