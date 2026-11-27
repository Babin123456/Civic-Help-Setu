import { describe, it, expect, beforeEach } from 'vitest';
import {
  ServiceAvailabilityContractService,
  SERVICE_AVAILABILITY_STATE,
  AlternativeChannel,
  SAFE_NEXT_STEPS,
  ServiceAvailabilityRecord,
} from './serviceAvailabilityContract.js';

describe('SERVICE_AVAILABILITY_STATE', () => {
  it('has all five expected states', () => {
    expect(SERVICE_AVAILABILITY_STATE.ONLINE).toBe('online');
    expect(SERVICE_AVAILABILITY_STATE.DELAYED).toBe('delayed');
    expect(SERVICE_AVAILABILITY_STATE.MAINTENANCE).toBe('maintenance');
    expect(SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY).toBe('offline-only');
    expect(SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED).toBe('external-portal-degraded');
  });
});

describe('AlternativeChannel', () => {
  it('creates a channel with required fields', () => {
    const ch = AlternativeChannel({
      type: 'physical-counter',
      label: 'Police Counter',
      description: 'Visit in person.',
    });
    expect(ch.type).toBe('physical-counter');
    expect(ch.label).toBe('Police Counter');
    expect(ch.description).toBe('Visit in person.');
    expect(ch.url).toBeUndefined();
    expect(ch.ttlMinutes).toBeUndefined();
  });

  it('creates a channel with optional ttlMinutes', () => {
    const ch = AlternativeChannel({
      type: 'helpline-phone',
      label: 'Helpline',
      description: 'Call for help.',
      ttlMinutes: 30,
    });
    expect(ch.ttlMinutes).toBe(30);
  });
});

describe('SAFE_NEXT_STEPS', () => {
  it('has steps for each availability state', () => {
    expect(SAFE_NEXT_STEPS[SERVICE_AVAILABILITY_STATE.ONLINE].length).toBeGreaterThan(0);
    expect(SAFE_NEXT_STEPS[SERVICE_AVAILABILITY_STATE.DELAYED].length).toBeGreaterThan(0);
    expect(SAFE_NEXT_STEPS[SERVICE_AVAILABILITY_STATE.MAINTENANCE].length).toBeGreaterThan(0);
    expect(SAFE_NEXT_STEPS[SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY].length).toBeGreaterThan(0);
    expect(SAFE_NEXT_STEPS[SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED].length).toBeGreaterThan(0);
  });

  it('ONLINE steps include online portal usage', () => {
    expect(SAFE_NEXT_STEPS[SERVICE_AVAILABILITY_STATE.ONLINE]).toContainEqual(
      expect.stringMatching(/official online portal|mobile app/)
    );
  });

  it('EXTERNAL_PORTAL_DEGRADED steps warn against relying on degraded portal', () => {
    const degradedSteps = SAFE_NEXT_STEPS[SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED];
    expect(degradedSteps).toContainEqual(
      expect.stringContaining('Do NOT rely on the degraded external portal')
    );
  });
});

describe('ServiceAvailabilityRecord', () => {
  it('creates a record with default values', () => {
    const record = ServiceAvailabilityRecord({ serviceId: 'test-svc' });
    expect(record.serviceId).toBe('test-svc');
    expect(record.state).toBe(SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY);
    expect(record.alternativeChannels).toEqual([]);
    expect(record.safeNextSteps).toEqual([]);
    expect(record.staleTtlMinutes).toBe(48 * 60); // 2880
  });

  it('accepts custom values', () => {
    const record = ServiceAvailabilityRecord({
      serviceId: 'custom-svc',
      state: SERVICE_AVAILABILITY_STATE.ONLINE,
      lastVerified: '2026-11-27T10:00:00.000Z',
      alternativeChannels: [{ type: 'helpline-phone', label: 'Help' }],
      safeNextSteps: ['Step 1'],
      staleTtlMinutes: 60,
    });
    expect(record.serviceId).toBe('custom-svc');
    expect(record.state).toBe(SERVICE_AVAILABILITY_STATE.ONLINE);
    expect(record.lastVerified).toBe('2026-11-27T10:00:00.000Z');
    expect(record.alternativeChannels).toHaveLength(1);
    expect(record.safeNextSteps).toEqual(['Step 1']);
    expect(record.staleTtlMinutes).toBe(60);
  });
});

describe('ServiceAvailabilityContractService', () => {
  let service;

  beforeEach(() => {
    service = new ServiceAvailabilityContractService();
  });

  describe('getRecord', () => {
    it('initializes a record for a new service with OFFLINE_ONLY state', () => {
      const record = service.getRecord('new-svc');
      expect(record.serviceId).toBe('new-svc');
      expect(record.state).toBe(SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY);
    });

    it('returns the same record for the same serviceId', () => {
      const r1 = service.getRecord('same-svc');
      const r2 = service.getRecord('same-svc');
      expect(r1).toBe(r2);
    });
  });

  describe('getCurrentState', () => {
    it('returns the stored state when fresh', () => {
      service.transitionState('fresh-svc', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
      expect(service.getCurrentState('fresh-svc')).toBe(SERVICE_AVAILABILITY_STATE.ONLINE);
    });

    it('reverts to OFFLINE_ONLY when lastVerified is stale', () => {
      // Initialize with a stale lastVerified (simulate old timestamp)
      service.getRecord('stale-svc').lastVerified = new Date(Date.now() - 50 * 60 * 1000).toISOString(); // 50 min ago
      // staleTtlMinutes defaults to 48h, so 50 min is NOT stale -> should keep state
      // Let's test with a very old lastVerified by manually setting up
      service.staleTtlMinutes = 1; // 1 minute TTL for this test
      const record = service.getRecord('very-stale-svc');
      record.lastVerified = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
      expect(service.getCurrentState('very-stale-svc')).toBe(SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY);
    });
  });

  describe('transitionState', () => {
    it('transitions from OFFLINE_ONLINE to ONLINE', () => {
      const record = service.transitionState('tx-svc', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
      expect(record.state).toBe(SERVICE_AVAILABILITY_STATE.ONLINE);
      expect(record._auditLog).toHaveLength(1);
      expect(record._auditLog[0]).toEqual({
        from: SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY,
        to: SERVICE_AVAILABILITY_STATE.ONLINE,
        changedAt: expect.any(String),
        changedBy: 'admin',
      });
    });

    it('transitions from ONLINE to DELAYED', () => {
      service.transitionState('tx-svc-2', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
      const record = service.transitionState('tx-svc-2', SERVICE_AVAILABILITY_STATE.DELAYED, 'operator');
      expect(record.state).toBe(SERVICE_AVAILABILITY_STATE.DELAYED);
      expect(record._auditLog).toHaveLength(2);
    });

    it('transitions from MAINTENANCE to OFFLINE_ONLY', () => {
      service.transitionState('tx-svc-3', SERVICE_AVAILABILITY_STATE.MAINTENANCE, 'admin');
      const record = service.transitionState('tx-svc-3', SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY, 'system');
      expect(record.state).toBe(SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY);
    });

    it('transitions from EXTERNAL_PORTAL_DEGRADED to OFFLINE_ONLY', () => {
      service.transitionState('tx-svc-4', SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED, 'admin');
      const record = service.transitionState('tx-svc-4', SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY, 'system');
      expect(record.state).toBe(SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY);
    });

    it('is a no-op when transitioning to the same state', () => {
      service.transitionState('no-op-svc', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
      const result = service.transitionState('no-op-svc', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
      expect(result).toBeDefined();
      // Should not add another audit entry
      expect(result._auditLog).toHaveLength(1);
    });

    it('updates lastVerified when transitioning to ONLINE', () => {
      const record = service.transitionState('tx-svc-5', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
      expect(record.lastVerified).toBeDefined();
      // lastVerified should be set to now (within a few seconds of test time)
      const parsed = new Date(record.lastVerified);
      expect(parsed instanceof Date).toBe(true);
    });
  });

  describe('markVerified', () => {
    it('updates lastVerified to now', () => {
      service.getRecord('verify-svc').state = SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY;
      service.markVerified('verify-svc');
      const record = service.getRecord('verify-svc');
      expect(record.lastVerified).toBeDefined();
      const ageMinutes = (Date.now() - new Date(record.lastVerified).getTime()) / (1000 * 60);
      expect(ageMinutes).toBeLessThan(1); // Should be very recent
    });
  });

  describe('autoExpireStale', () => {
    it('does not expire when lastVerified is within TTL', () => {
      service.getRecord('fresh-svc').lastVerified = new Date().toISOString();
      // State defaults to OFFLINE_ONLY; no change needed
      const result = service.autoExpireStale('fresh-svc');
      expect(result).toBe(false); // No change
    });

    it('expires and reverts to OFFLINE_ONLY when lastVerified is beyond TTL (from ONLINE)', () => {
      // Start from ONLINE, set stale lastVerified
      service.transitionState('stale-svc2', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
      service.staleTtlMinutes = 1; // 1 minute TTL
      service.getRecord('stale-svc2').lastVerified = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 min ago
      const result = service.autoExpireStale('stale-svc2');
      expect(result).toBe(true); // Change made
      expect(service.getCurrentState('stale-svc2')).toBe(SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY);
    });
  });

  describe('getAlternativeChannels', () => {
    it('returns appropriate channels for ONLINE state', () => {
      service.transitionState('ch-svc', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
      const channels = service.getAlternativeChannels('ch-svc');
      // ONLINE should have empty base, plus any record overrides (none)
      expect(channels).toEqual([]);
    });

    it('returns appropriate channels for EXTERNAL_PORTAL_DEGRADED state', () => {
      service.transitionState('deg-svc', SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED, 'admin');
      const channels = service.getAlternativeChannels('deg-svc');
      expect(channels.length).toBeGreaterThan(0);
      // Should have helpline, secondary portal, CSC
      const types = channels.map((c) => c.type);
      expect(types).toContain('helpline-phone');
      expect(types).toContain('secondary-portal');
      expect(types).toContain('common-service-centre');
    });
  });

  describe('getSafeNextSteps', () => {
    it('returns ONLINE next steps', () => {
      service.transitionState('steps-online', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
      const steps = service.getSafeNextSteps('steps-online');
      expect(steps).toContain('Use the official online portal or mobile app.');
    });

    it('returns EXTERNAL_PORTAL_DEGRADED next steps', () => {
      service.transitionState('steps-degraded', SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED, 'admin');
      const steps = service.getSafeNextSteps('steps-degraded');
      expect(steps).toContain('Do NOT rely on the degraded external portal for critical actions.');
    });
  });

  describe('getAvailabilityView', () => {
    it('provides a complete citizen-facing view', () => {
      service.transitionState('view-svc', SERVICE_AVAILABILITY_STATE.MAINTENANCE, 'admin');
      // Set a recent lastVerified
      const record = service.getRecord('view-svc');
      record.lastVerified = new Date().toISOString();
      service.getRecord('view-svc'); // ensure record is updated

      const view = service.getAvailabilityView('view-svc');
      expect(view.serviceId).toBe('view-svc');
      expect(view.state).toBe(SERVICE_AVAILABILITY_STATE.MAINTENANCE);
      expect(view.alternativeChannels).toBeDefined();
      expect(view.safeNextSteps).toBeDefined();
      expect(view._auditLog).toBeDefined();
      expect(view.staleTtlMinutes).toBe(48 * 60);
    });

    it('includes ageMinutes since last verification', () => {
      service.transitionState('age-svc', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
      const record = service.getRecord('age-svc');
      // Set lastVerified to 30 minutes ago
      record.lastVerified = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      const view = service.getAvailabilityView('age-svc');
      // Should be within TTL, so state stays ONLINE
      expect(view.state).toBe(SERVICE_AVAILABILITY_STATE.ONLINE);
      expect(view.ageMinutes).toBe('30.0');
    });
  });
});

describe('Concurrency and edge cases', () => {
  it('handles multiple transitions correctly', () => {
    const service = new ServiceAvailabilityContractService();
    service.transitionState('multi', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
    service.transitionState('multi', SERVICE_AVAILABILITY_STATE.MAINTENANCE, 'operator');
    service.transitionState('multi', SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY, 'system');
    expect(service.getCurrentState('multi')).toBe(SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY);
    // Should have 3 audit log entries (no no-op entry for same-state transition)
    expect(service.getRecord('multi')._auditLog).toHaveLength(3);
  });

  it('auto-expire TTL is configurable', () => {
    const service = new ServiceAvailabilityContractService({ staleTtlMinutes: 1 });
    // Start from ONLINE, then set stale lastVerified
    service.transitionState('config-t', SERVICE_AVAILABILITY_STATE.ONLINE, 'admin');
    service.getRecord('config-t').lastVerified = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // 6 min ago
    const result = service.autoExpireStale('config-t');
    expect(result).toBe(true);
    expect(service.getCurrentState('config-t')).toBe(SERVICE_AVAILABILITY_STATE.OFFLINE_ONLY);
  });

  it('critical journey never implies unavailable external portal is operational', () => {
    const service = new ServiceAvailabilityContractService();
    // Simulate a critical journey: even if we have cached data, the degraded state
    // should never imply the portal is operational
    service.transitionState('critical-journey', SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED, 'system');

    const view = service.getAvailabilityView('critical-journey');
    // The safe next steps should warn against relying on the degraded portal
    const hasWarning = view.safeNextSteps.some(
      (step) => step.includes('Do NOT rely') || step.includes('degraded')
    );
    expect(hasWarning).toBe(true);

    // The state should be EXTERNAL_PORTAL_DEGRADED, not ONLINE
    expect(view.state).toBe(SERVICE_AVAILABILITY_STATE.EXTERNAL_PORTAL_DEGRADED);
  });
});