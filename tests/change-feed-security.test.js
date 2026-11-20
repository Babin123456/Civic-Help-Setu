import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { changeFeedService } from '../src/services/changeFeedService.js';
import { sanitizeText } from '../src/data/changeEventContract.js';
import { setCurrentActor } from '../src/services/accessControl.js';

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: vi.fn((k) => (data.has(k) ? data.get(k) : null)),
    setItem: vi.fn((k, v) => data.set(k, String(v))),
    removeItem: vi.fn((k) => data.delete(k)),
  };
};

describe('Change Feed Security & Threat Modeling (#762)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage());
    changeFeedService.resetChangeFeedStorage();
    setCurrentActor({ id: 'admin-sec', role: 'admin' });
  });

  afterEach(() => {
    setCurrentActor(null);
  });

  describe('Injection Attack Prevention', () => {
    it('sanitizes XSS payloads and HTML tags from change title and reasons', () => {
      const malicious = '<script>alert("xss")</script><b>Fee increase</b>';
      const sanitized = sanitizeText(malicious);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).not.toContain('<b>');
      expect(sanitized).toBe('Fee increase');
    });

    it('strips null bytes and control characters from text', () => {
      const malicious = 'Circular\u0000No.\u001f402';
      const sanitized = sanitizeText(malicious);
      expect(sanitized).toBe('CircularNo.402');
    });

    it('persists sanitized text in change event storage', () => {
      const res = changeFeedService.createChangeEvent({
        serviceId: 'water-tax',
        changeType: 'POLICY_CHANGE',
        changeReason: 'policy',
        changeTitle: '<img src=x onerror=alert(1)>Water tariff revision',
        effectiveDate: '2026-12-01',
        officialGazetteCitation: '<script>hack()</script>Order 101',
      });

      const pending = changeFeedService.listPendingChangeEvents();
      const event = pending.events.find(e => e.id === res.eventId);
      expect(event.changeTitle).toBe('Water tariff revision');
      expect(event.officialGazetteCitation).toBe('Order 101');
    });
  });

  describe('Data Leakage & Public Enumeration', () => {
    it('restricts unapproved pending change events from citizen public feed queries', () => {
      // Create pending change
      changeFeedService.createChangeEvent({
        serviceId: 'restricted-service',
        changeType: 'POLICY_CHANGE',
        changeReason: 'policy',
        changeTitle: 'Confidential draft change',
        effectiveDate: '2026-12-01',
      });

      // Query as citizen
      setCurrentActor({ id: 'citizen-anon', role: 'citizen' });
      const publicFeed = changeFeedService.listChangeEvents('restricted-service');
      expect(publicFeed.events).toHaveLength(0);

      // Verify pending change events query is forbidden for citizen
      expect(() => {
        changeFeedService.listPendingChangeEvents();
      }).toThrow(/Permission denied/);
    });

    it('does not leak internal sensitive notes to public change feeds', () => {
      setCurrentActor({ id: 'admin-sec', role: 'admin' });
      const res = changeFeedService.createChangeEvent({
        serviceId: 'trade-licence',
        changeType: 'POLICY_CHANGE',
        changeReason: 'policy',
        changeTitle: 'Public Trade Fee Update',
        effectiveDate: '2026-12-01',
      });
      changeFeedService.approveChange(res.eventId, 'admin-sec', 'Internal reviewer secret notes: verification passed');

      setCurrentActor({ id: 'citizen-reader', role: 'citizen' });
      const feed = changeFeedService.listChangeEvents('trade-licence');
      expect(feed.events).toHaveLength(1);
      expect(feed.events[0].internalReviewNotes).toBeUndefined();
    });
  });

  describe('Replay & Duplicate Attack Prevention', () => {
    it('deduplicates notification dispatch using compound idempotency keys', () => {
      setCurrentActor({ id: 'admin-sec', role: 'admin' });
      const event = changeFeedService.createChangeEvent({
        serviceId: 'ration-card',
        changeType: 'DOCUMENT_SIMPLIFICATION',
        changeReason: 'regulatory',
        changeTitle: 'Simplified verification procedure',
        effectiveDate: '2026-11-25',
      });

      changeFeedService.subscribeUser({
        userId: 'citizen-target',
        serviceId: 'ration-card',
      });

      // First dispatch
      const first = changeFeedService.dispatchImpactNotifications(event.eventId);
      expect(first.dispatchedCount).toBe(1);

      // Replay attempt
      const second = changeFeedService.dispatchImpactNotifications(event.eventId);
      expect(second.dispatchedCount).toBe(1);

      // Verify storage only has 1 record, with attempts incremented to 2
      const attempts = changeFeedService.listDeliveryAttempts(event.eventId);
      expect(attempts.attempts).toHaveLength(1);
      expect(attempts.attempts[0].attempts).toBe(2);
    });
  });

  describe('Database Migration & Fresh Initialization', () => {
    it('initializes fresh schema correctly on empty database', () => {
      const state = changeFeedService.getChangeFeedStats();
      expect(state.success).toBe(true);
      expect(state.stats.schemaVersion).toBe(1);
      expect(state.stats.totalChangeEvents).toBe(0);
      expect(state.stats.totalServiceVersions).toBe(0);
    });

    it('survives corrupted local data by reinitializing safely without crashing', () => {
      localStorage.setItem('civicbridge_change_events', '{ corrupted json format');
      const stats = changeFeedService.getChangeFeedStats();
      expect(stats.success).toBe(true);
      expect(stats.stats.totalChangeEvents).toBe(0);
    });
  });
});
