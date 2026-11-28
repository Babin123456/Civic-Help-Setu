import crypto from 'node:crypto';

export const RETENTION_CLASS = Object.freeze({
  TRANSIENT_30_DAYS: 'TRANSIENT_30_DAYS',
  COMPLIANCE_1_YEAR: 'COMPLIANCE_1_YEAR',
  STATUTORY_7_YEARS: 'STATUTORY_7_YEARS',
  LEGAL_HOLD_PERMANENT: 'LEGAL_HOLD_PERMANENT'
});

export const AUDIT_PURPOSE = Object.freeze({
  CITIZEN_CONSENT: 'CITIZEN_CONSENT',
  ADMIN_ACCESS: 'ADMIN_ACCESS',
  SECURITY_EVENT: 'SECURITY_EVENT',
  DATA_LIFECYCLE: 'DATA_LIFECYCLE'
});

export class CentralizedAuditEventService {
  constructor() {
    this.auditStore = new Map();
  }

  createAuditEvent(eventData = {}) {
    const {
      actorId,
      actorRole = 'CITIZEN',
      purpose,
      action,
      resourceType,
      resourceId,
      retentionClass = RETENTION_CLASS.COMPLIANCE_1_YEAR,
      metadata = {}
    } = eventData;

    if (!purpose || !AUDIT_PURPOSE[purpose]) {
      throw new Error(`Invalid audit purpose: ${purpose}`);
    }

    if (!action || !resourceType) {
      throw new Error('Action and resourceType are mandatory for audit schema compliance.');
    }

    const eventId = `AUD-EVT-${crypto.randomBytes(8).toString('hex')}`;
    const timestamp = new Date().toISOString();

    // Redact raw sensitive payload values
    const sanitizedMetadata = this._redactSensitiveAttributes(metadata);

    // Cryptographic signature for tamper evidence
    const signaturePayload = `${eventId}:${actorId}:${action}:${resourceId}:${timestamp}`;
    const tamperSignature = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    const auditRecord = {
      eventId,
      actorContext: {
        actorId: actorId ? `HASH-${crypto.createHash('sha256').update(actorId).digest('hex').substring(0, 12)}` : 'ANONYMOUS',
        actorRole
      },
      purpose,
      action,
      resourceType,
      resourceId: resourceId || 'GLOBAL',
      retentionClass,
      metadata: sanitizedMetadata,
      timestamp,
      tamperSignature
    };

    this.auditStore.set(eventId, auditRecord);
    return auditRecord;
  }

  _redactSensitiveAttributes(obj) {
    const redacted = {};
    for (const [key, value] of Object.entries(obj)) {
      if (/password|secret|aadhaar|pan|otp|token|mobile/i.test(key)) {
        redacted[key] = '[REDACTED_AUDIT]';
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  purgeExpiredEvents(currentTimestamp = Date.now()) {
    let purgedCount = 0;
    const dayMs = 24 * 60 * 60 * 1000;

    for (const [id, record] of this.auditStore.entries()) {
      if (record.retentionClass === RETENTION_CLASS.LEGAL_HOLD_PERMANENT) {
        continue; // Never purge legal holds
      }

      const ageMs = currentTimestamp - new Date(record.timestamp).getTime();
      let isExpired = false;

      if (record.retentionClass === RETENTION_CLASS.TRANSIENT_30_DAYS && ageMs > 30 * dayMs) {
        isExpired = true;
      } else if (record.retentionClass === RETENTION_CLASS.COMPLIANCE_1_YEAR && ageMs > 365 * dayMs) {
        isExpired = true;
      } else if (record.retentionClass === RETENTION_CLASS.STATUTORY_7_YEARS && ageMs > 7 * 365 * dayMs) {
        isExpired = true;
      }

      if (isExpired) {
        this.auditStore.delete(id);
        purgedCount++;
      }
    }

    return { purgedCount, remainingCount: this.auditStore.size };
  }
}
