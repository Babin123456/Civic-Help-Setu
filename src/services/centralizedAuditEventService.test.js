import { describe, it, expect, beforeEach } from 'vitest';
import {
  CentralizedAuditEventService,
  AUDIT_PURPOSE,
  RETENTION_CLASS
} from './centralizedAuditEventService.js';

describe('CentralizedAuditEventService (#1251)', () => {
  let service;

  beforeEach(() => {
    service = new CentralizedAuditEventService();
  });

  it('generates immutable, tamper-evident audit events and pseudonymizes actors', () => {
    const event = service.createAuditEvent({
      actorId: 'citizen_phone_9876543210',
      actorRole: 'CITIZEN',
      purpose: AUDIT_PURPOSE.CITIZEN_CONSENT,
      action: 'CONSENT_GRANTED_DIGILOCKER',
      resourceType: 'CONSENT_RECORD',
      resourceId: 'CR-1002',
      metadata: {
        consentScope: 'EDUCATION_RECORDS',
        userPasswordHash: 'secret_hash_not_allowed'
      }
    });

    expect(event.eventId).toMatch(/^AUD-EVT-[0-9a-f]{16}$/);
    expect(event.actorContext.actorId).toMatch(/^HASH-[0-9a-f]{12}$/);
    expect(event.tamperSignature).toBeDefined();
    expect(event.metadata.userPasswordHash).toBe('[REDACTED_AUDIT]');
  });

  it('enforces retention expiry while safeguarding legal holds', () => {
    const transientEvent = service.createAuditEvent({
      actorId: 'test_user',
      purpose: AUDIT_PURPOSE.SECURITY_EVENT,
      action: 'LOGIN_ATTEMPT',
      resourceType: 'SESSION',
      retentionClass: RETENTION_CLASS.TRANSIENT_30_DAYS
    });

    const legalHoldEvent = service.createAuditEvent({
      actorId: 'test_user',
      purpose: AUDIT_PURPOSE.ADMIN_ACCESS,
      action: 'EVIDENCE_SEIZED',
      resourceType: 'CASE_FILE',
      retentionClass: RETENTION_CLASS.LEGAL_HOLD_PERMANENT
    });

    // Simulate 35 days in future
    const futureTime = Date.now() + (35 * 24 * 60 * 60 * 1000);
    const result = service.purgeExpiredEvents(futureTime);

    expect(result.purgedCount).toBe(1);
    expect(result.remainingCount).toBe(1);
  });
});
