import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_VAULT_SECURITY_CONFIG,
  RISK_LEVEL,
  VAULT_HIGH_RISK_ACTION,
  evaluateVaultAccessRisk,
  vaultSecurityStore,
  verifyAndConsumeStepUpToken,
} from './vaultRiskBasedAccessService.js';

describe('vaultRiskBasedAccessService', () => {
  const sessionId = 'session_citizen_001';

  beforeEach(() => {
    vaultSecurityStore.reset();
    vaultSecurityStore.registerSession({
      id: sessionId,
      userId: 'citizen_123',
      deviceLabel: 'Firefox on Linux',
      createdAt: Date.now() - 60000,
      lastActiveAt: Date.now() - 5000,
      isCurrent: true,
    });
  });

  it('permits standard vault operations when session is fresh and within rate limits', () => {
    const evalResult = evaluateVaultAccessRisk({
      sessionId,
      action: 'VIEW_DOCUMENT_METADATA',
      authAgeSeconds: 120,
    });

    expect(evalResult.allowed).toBe(true);
    expect(evalResult.riskLevel).toBe(RISK_LEVEL.LOW);
    expect(evalResult.requiresStepUp).toBe(false);
  });

  it('requires step-up re-authentication for high-risk bulk export with stale authentication', () => {
    const evalResult = evaluateVaultAccessRisk({
      sessionId,
      action: VAULT_HIGH_RISK_ACTION.BULK_EXPORT,
      authAgeSeconds: 1200, // 20 minutes (exceeds default 15 min freshness)
    });

    expect(evalResult.allowed).toBe(false);
    expect(evalResult.requiresStepUp).toBe(true);
    expect(evalResult.challengeType).toBe('FRESH_CREDENTIALS');
  });

  it('enforces multi-factor authentication for critical permanent document deletion', () => {
    const evalResult = evaluateVaultAccessRisk({
      sessionId,
      action: VAULT_HIGH_RISK_ACTION.PERMANENT_DELETE,
      authAgeSeconds: 60,
      mfaVerified: false,
    });

    expect(evalResult.allowed).toBe(false);
    expect(evalResult.requiresStepUp).toBe(true);
    expect(evalResult.challengeType).toBe('MFA_CODE');
  });

  it('detects anomalous burst access and triggers rate-limiting step-up protection', () => {
    // Simulate 8 rapid requests within burst window
    for (let i = 0; i < 8; i++) {
      vaultSecurityStore.recordAccess(sessionId, 'FETCH_FILE');
    }

    const burstEval = evaluateVaultAccessRisk({
      sessionId,
      action: 'FETCH_FILE',
      authAgeSeconds: 60,
    });

    expect(burstEval.allowed).toBe(false);
    expect(burstEval.riskLevel).toBe(RISK_LEVEL.HIGH);
    expect(burstEval.requiresStepUp).toBe(true);
    expect(burstEval.reason).toContain('Unusual rapid access rate');
  });

  it('rejects requests from stale inactive sessions', () => {
    // Artificially age the session lastActiveAt beyond threshold
    const s = vaultSecurityStore.getSession(sessionId);
    s.lastActiveAt = Date.now() - 2500 * 1000; // > 1800s
    vaultSecurityStore.sessions.set(sessionId, s);

    const evalResult = evaluateVaultAccessRisk({
      sessionId,
      action: 'VIEW_DOCUMENT',
      authAgeSeconds: 60,
    });

    expect(evalResult.allowed).toBe(false);
    expect(evalResult.riskLevel).toBe(RISK_LEVEL.HIGH);
    expect(evalResult.reason).toContain('expired due to inactivity');
  });

  it('allows citizens to review active sessions and revoke compromised ones', () => {
    const active = vaultSecurityStore.getActiveSessions('citizen_123');
    expect(active.length).toBe(1);
    expect(active[0].sessionId).toBe(sessionId);

    // Revoke session
    const revoked = vaultSecurityStore.revokeSession(sessionId);
    expect(revoked).toBe(true);

    // Subsequent access must be blocked
    const postRevokeEval = evaluateVaultAccessRisk({
      sessionId,
      action: 'VIEW_DOCUMENT',
    });
    expect(postRevokeEval.allowed).toBe(false);
    expect(postRevokeEval.riskLevel).toBe(RISK_LEVEL.CRITICAL);
  });

  it('protects against token replay during step-up challenge verification', () => {
    const token = `stepup_${Date.now()}_abc123`;

    // First use: valid
    const firstAttempt = verifyAndConsumeStepUpToken(sessionId, token);
    expect(firstAttempt).toBe(true);

    // Replay attack with same token: rejected
    const replayAttempt = verifyAndConsumeStepUpToken(sessionId, token);
    expect(replayAttempt).toBe(false);
  });

  it('strictly excludes document contents and filenames from security audit logs', () => {
    evaluateVaultAccessRisk({
      sessionId,
      action: VAULT_HIGH_RISK_ACTION.PERMANENT_DELETE,
      authAgeSeconds: 3000,
    });

    const logs = vaultSecurityStore.securityAuditLogs;
    expect(logs.length).toBeGreaterThan(0);

    for (const log of logs) {
      expect(log).toHaveProperty('eventType');
      expect(log).toHaveProperty('timestamp');
      expect(log).toHaveProperty('riskLevel');

      // Ensure no filename or payload content leaked
      const stringified = JSON.stringify(log);
      expect(stringified).not.toContain('.pdf');
      expect(stringified).not.toContain('.jpg');
      expect(stringified).not.toContain('fileContent');
    }
  });
});
