import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMessageEnvelope,
  createErrorEnvelope,
  validateMessageEnvelope,
} from './messageContract.js';
import {
  downcastV2ToV1,
  migrateEnvelope,
  validateAndAdaptMessage,
} from './schemaEvolution.js';
import { SYNTHETIC_REPLAY_FIXTURES } from './replayFixtures.js';
import { getContractMetricsSnapshot, recordContractEvent, resetContractMetrics } from './observability.js';

describe('Agent Message Contracts & Schema Evolution', () => {
  beforeEach(() => {
    resetContractMetrics();
  });

  it('validates a canonical v2.0 request envelope', () => {
    const msg = createMessageEnvelope({
      sender: 'orchestrator',
      recipient: 'guardrail',
      permissionScope: 'sanitize_query',
      payload: { query: 'Birth certificate documents' },
    });
    const res = validateMessageEnvelope(msg);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('rejects unknown critical fields fail-closed', () => {
    const msg = createMessageEnvelope({
      criticalFields: ['schemaVersion', 'mysteryCriticalFlag'],
    });
    const res = validateMessageEnvelope(msg);
    expect(res.valid).toBe(false);
    expect(res.errors[0].code).toBe('UNKNOWN_CRITICAL_FIELD');
    expect(res.errorEnvelope.payload.code).toBe('UNKNOWN_CRITICAL_FIELD');
  });

  it('rejects expired deadlines unless allowExpired is set', () => {
    const msg = createMessageEnvelope({
      deadlineAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(validateMessageEnvelope(msg).errors[0].code).toBe('DEADLINE_EXCEEDED');
    expect(validateMessageEnvelope(msg, { allowExpired: true }).valid).toBe(true);
  });

  it('rejects forbidden autonomous actions and unauthorized role scopes', () => {
    const autonomous = createMessageEnvelope({ permissionScope: 'benefit_denial' });
    expect(validateMessageEnvelope(autonomous).errors[0].code).toBe('FORBIDDEN_AUTONOMOUS_ACTION');

    const wrongRole = createMessageEnvelope({
      sender: 'guardrail',
      recipient: 'orchestrator',
      permissionScope: 'propose_guidance',
    });
    expect(validateMessageEnvelope(wrongRole).errors[0].code).toBe('PERMISSION_DENIED');
  });

  it('rejects forbidden PII or credential keys anywhere in the envelope', () => {
    const msg = createMessageEnvelope({
      payload: { nested: { apiKey: 'sk-synthetic-123' } },
    });
    const res = validateMessageEnvelope(msg);
    expect(res.valid).toBe(false);
    expect(res.errors[0].code).toBe('FORBIDDEN_PII_FIELD');
  });

  it('requires provenance on proposal messages', () => {
    const msg = createMessageEnvelope({
      messageType: 'proposal',
      sender: 'synthesizer',
      recipient: 'orchestrator',
      provenance: { sources: [], unverified: false },
    });
    const res = validateMessageEnvelope(msg);
    expect(res.valid).toBe(false);
    expect(res.errors[0].code).toBe('MISSING_PROVENANCE');
  });

  it('supports v2.0 -> v1.0 downcast when no v2-only critical fields are critical, and blocks otherwise', () => {
    const safeV2 = createMessageEnvelope({
      criticalFields: ['schemaVersion', 'correlationId'],
    });
    const downOk = downcastV2ToV1(safeV2);
    expect(downOk.ok).toBe(true);
    expect(downOk.message.schemaVersion).toBe('1.0');

    const strictV2 = createMessageEnvelope({
      criticalFields: ['schemaVersion', 'requiresHumanApproval'],
    });
    const downFail = downcastV2ToV1(strictV2);
    expect(downFail.ok).toBe(false);
    expect(downFail.errorEnvelope.payload.code).toBe('INCOMPATIBLE_CRITICAL_FIELD');
  });

  it('rejects unsupported schema versions during migration', () => {
    const res = migrateEnvelope({ schemaVersion: '9.9' });
    expect(res.ok).toBe(false);
    expect(res.errorEnvelope.payload.code).toBe('UNSUPPORTED_SCHEMA_VERSION');
  });

  it('replays all synthetic workflow fixtures deterministically', () => {
    for (const fixture of SYNTHETIC_REPLAY_FIXTURES) {
      const result = validateAndAdaptMessage(fixture.message, { allowExpired: true });
      expect(result.ok, `Fixture ${fixture.id} failed`).toBe(fixture.expectValid);
      if (fixture.expectValid) {
        expect(result.migratedFrom).toBe(fixture.expectedMigratedFrom);
      } else {
        expect(result.errorEnvelope.payload.code).toBe(fixture.expectedErrorCode);
      }
    }
  });

  it('builds safe error envelopes and tracks bounded observability metrics', () => {
    const err = createErrorEnvelope({ code: 'TEST_ERR', message: 'Safe message', retryable: true });
    expect(err.messageType).toBe('error');
    expect(err.payload.retryable).toBe(true);

    recordContractEvent('contract_validated', { code: 'VALID_ENVELOPE' });
    recordContractEvent('contract_rejected', { code: 'DEADLINE_EXCEEDED', status: 'error' });
    const snap = getContractMetricsSnapshot();
    expect(snap.counters.validated).toBe(1);
    expect(snap.counters.rejected).toBe(1);
    expect(snap.counters.deadlineExceeded).toBe(1);
  });
});
