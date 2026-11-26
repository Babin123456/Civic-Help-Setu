import { describe, it, expect, beforeEach } from 'vitest';
import {
  SecurityEventCorrelationEngine,
  SECURITY_EVENT_TYPES,
  SEVERITY_LEVELS,
  generateCorrelationId,
  anonymizeActor,
  redactEventDetails
} from './securityEventCorrelationService.js';

describe('securityEventCorrelationService', () => {
  describe('Helper Functions', () => {
    it('generates unguessable correlation IDs with corr_ prefix', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      expect(id1).toMatch(/^corr_[a-z0-9]+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('anonymizes actor identifiers consistently without exposing raw values', () => {
      const actorA = 'citizen.user@example.com';
      const actorB = 'admin@karnataka.gov.in';

      const hashA1 = anonymizeActor(actorA);
      const hashA2 = anonymizeActor(actorA);
      const hashB = anonymizeActor(actorB);

      expect(hashA1).toBe(hashA2);
      expect(hashA1).toMatch(/^act_[a-f0-9]{8}$/);
      expect(hashA1).not.toBe(hashB);
      expect(anonymizeActor(null)).toBe('anon_unknown');
    });

    it('redacts sensitive fields like passwords, tokens, and PII from event metadata', () => {
      const rawMetadata = {
        action: 'SIGN_IN',
        authToken: 'jwt.token.secret123',
        passwordField: 'SuperSecret123',
        aadhaarNumber: '1234-5678-9012',
        metadata: {
          sessionSecret: 'xyz987',
          clientBrowser: 'Chrome 120'
        }
      };

      const sanitized = redactEventDetails(rawMetadata);
      expect(sanitized.action).toBe('SIGN_IN');
      expect(sanitized.authToken).toBe('[REDACTED_PII]');
      expect(sanitized.passwordField).toBe('[REDACTED_PII]');
      expect(sanitized.aadhaarNumber).toBe('[REDACTED_PII]');
      expect(sanitized.metadata.sessionSecret).toBe('[REDACTED_PII]');
      expect(sanitized.metadata.clientBrowser).toBe('Chrome 120');
    });
  });

  describe('SecurityEventCorrelationEngine', () => {
    let engine;

    beforeEach(() => {
      engine = new SecurityEventCorrelationEngine({
        AUTH_FAILURE_COUNT: 3,
        AUTH_FAILURE_WINDOW_MS: 60 * 1000,
        BULK_EXPORT_MAX_RECORDS: 50,
        ROLE_ELEVATION_SUSPICION_WINDOW_MS: 60 * 1000
      });
    });

    it('throws when recording unsupported event types', () => {
      expect(() => {
        engine.recordEvent({ eventType: 'INVALID_TYPE', actor: 'test' });
      }).toThrow(/Unsupported security event type/);
    });

    it('records valid events with sanitized details and anonymized actors', () => {
      const recorded = engine.recordEvent({
        eventType: SECURITY_EVENT_TYPES.AUTH_FAILURE,
        actor: 'user@test.org',
        details: { token: 'xyz', reason: 'bad_password' }
      });

      expect(recorded.eventType).toBe(SECURITY_EVENT_TYPES.AUTH_FAILURE);
      expect(recorded.actorHash).toMatch(/^act_/);
      expect(recorded.details.token).toBe('[REDACTED_PII]');
      expect(recorded.details.reason).toBe('bad_password');
    });

    it('triggers high severity alert when auth failure velocity exceeds threshold', () => {
      const now = Date.now();
      const actor = 'adversary@attack.net';

      engine.recordEvent({ eventType: SECURITY_EVENT_TYPES.AUTH_FAILURE, actor, timestamp: now - 20000 });
      engine.recordEvent({ eventType: SECURITY_EVENT_TYPES.AUTH_FAILURE, actor, timestamp: now - 10000 });
      expect(engine.getAlerts().length).toBe(0);

      engine.recordEvent({ eventType: SECURITY_EVENT_TYPES.AUTH_FAILURE, actor, timestamp: now });
      const alerts = engine.getAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].rule).toBe('BRUTE_FORCE_VELOCITY_EXCEEDED');
      expect(alerts[0].severity).toBe(SEVERITY_LEVELS.HIGH);
      expect(alerts[0].eventCount).toBe(3);
    });

    it('triggers mass export alert when record threshold is breached', () => {
      engine.recordEvent({
        eventType: SECURITY_EVENT_TYPES.BULK_EXPORT,
        actor: 'officer@gov.in',
        details: { recordCount: 150 }
      });

      const alerts = engine.getAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].rule).toBe('MASS_DATA_EXPORT_SPIKE');
      expect(alerts[0].severity).toBe(SEVERITY_LEVELS.MEDIUM);
    });

    it('triggers critical alert when role elevation happens right after auth failure', () => {
      const actor = 'compromised.account@gov.in';
      const now = Date.now();

      engine.recordEvent({
        eventType: SECURITY_EVENT_TYPES.AUTH_FAILURE,
        actor,
        timestamp: now - 10000
      });

      engine.recordEvent({
        eventType: SECURITY_EVENT_TYPES.ROLE_ELEVATION,
        actor,
        details: { targetRole: 'SUPER_ADMIN' },
        timestamp: now
      });

      const alerts = engine.getAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].rule).toBe('SUSPICIOUS_POST_FAILURE_ELEVATION');
      expect(alerts[0].severity).toBe(SEVERITY_LEVELS.CRITICAL);
    });

    it('prunes expired events outside the sliding window', () => {
      const now = Date.now();
      engine.recordEvent({
        eventType: SECURITY_EVENT_TYPES.AUTH_FAILURE,
        actor: 'old@test.org',
        timestamp: now - 500000
      });

      engine.pruneBuffer(now);
      expect(engine.eventBuffer.length).toBe(0);
    });
  });
});
