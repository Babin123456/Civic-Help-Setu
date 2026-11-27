import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWebhookSubscriptionRegistry,
  createWebhookDeliveryManager,
  generateHmacSignature,
  verifyHmacSignature,
  validateWebhookTimestamp,
  safeWebhookUrl,
  WebhookEnvelope,
  createWebhookVerificationMiddleware,
  EVENT_VERSION,
  DEFAULT,
} from '../api/_lib/webhookSubscription.js';
import {
  createEventOutbox,
  createEventOutboxPublisher,
  OUTBOX_STATUS,
  createMemoryStorageAdapter,
} from '../api/_lib/eventOutbox.js';

describe('Webhook Reliability Platform', () => {
  let mockNow;
  let currentTime;

  beforeEach(() => {
    currentTime = 1700000000000;
    mockNow = () => currentTime;
  });

  describe('HMAC Signature Generation & Verification', () => {
    it('generates a valid HMAC-SHA256 signature', () => {
      const payload = { eventId: 'evt_123', data: 'test' };
      const secret = 'my-hmac-secret';
      const signature = generateHmacSignature(payload, secret);

      expect(typeof signature).toBe('string');
      expect(signature.length > 0).toBe(true);
    });

    it('verifies a correct HMAC signature', () => {
      const payload = { eventId: 'evt_123', data: 'test' };
      const secret = 'my-hmac-secret';
      const signature = generateHmacSignature(payload, secret);

      const isValid = verifyHmacSignature(signature, payload, secret);
      expect(isValid).toBe(true);
    });

    it('rejects an incorrect HMAC signature', () => {
      const payload = { eventId: 'evt_123', data: 'test' };
      const secret = 'my-hmac-secret';
      const wrongSig = generateHmacSignature(payload, 'wrong-secret');

      const isValid = verifyHmacSignature(wrongSig, payload, secret);
      expect(isValid).toBe(false);
    });

    it('rejects empty signature', () => {
      const isValid = verifyHmacSignature('', { eventId: 'evt_123' }, 'secret');
      expect(isValid).toBe(false);
    });

    it('rejects missing secret', () => {
      const isValid = verifyHmacSignature('sig', { eventId: 'evt_123' }, '');
      expect(isValid).toBe(false);
    });
  });

  describe('Timestamp Validation', () => {
    it('accepts current timestamp as valid', () => {
      const result = validateWebhookTimestamp(currentTime, currentTime);
      expect(result.valid).toBe(true);
      expect(result.ageMs).toBe(0);
    });

    it('rejects timestamp beyond max skew', () => {
      const oldTime = currentTime - 10 * 60 * 1000; // 10 minutes ago
      const result = validateWebhookTimestamp(oldTime, currentTime);
      expect(result.valid).toBe(false);
      expect(result.ageMs).toBe(10 * 60 * 1000);
    });

    it('accepts future timestamp within skew', () => {
      const futureTime = currentTime + 2 * 60 * 1000; // 2 minutes in future
      const result = validateWebhookTimestamp(futureTime, currentTime);
      expect(result.valid).toBe(true);
      expect(result.ageMs).toBe(2 * 60 * 1000);
    });
  });

  describe('Webhook URL Sanitization', () => {
    it('accepts valid https URLs', () => {
      expect(safeWebhookUrl('https://api.example.com/webhooks')).toBeTruthy();
    });

    it('accepts valid http URLs', () => {
      expect(safeWebhookUrl('http://localhost:3000/webhooks')).toBeTruthy();
    });

    it('rejects javascript: URLs', () => {
      expect(safeWebhookUrl('javascript:alert(1)')).toBeNull();
    });

    it('rejects data: URLs', () => {
      expect(safeWebhookUrl('data:text/html,bad')).toBeNull();
    });

    it('rejects URLs with embedded credentials', () => {
      expect(safeWebhookUrl('https://user:pass@example.com/webhooks')).toBeNull();
    });

    it('rejects empty URLs', () => {
      expect(safeWebhookUrl('')).toBeNull();
    });

    it('rejects null URLs', () => {
      expect(safeWebhookUrl(null)).toBeNull();
    });
  });

  describe('Webhook Envelope', () => {
    it('builds an envelope with signature when secret provided', () => {
      const event = { eventId: 'evt_123', applicationId: 'APP-1' };
      const meta = { deliveryKey: 'evt_123:1', isReplay: false };
      const envelope = WebhookEnvelope.build(event, meta, 'my-secret');

      expect(envelope.signature).toBeDefined();
      expect(envelope.rawPayload).toBe(JSON.stringify(event));
    });

    it('builds an envelope without signature when no secret', () => {
      const event = { eventId: 'evt_123' };
      const meta = { deliveryKey: 'evt_123:1', isReplay: false };
      const envelope = WebhookEnvelope.build(event, meta, null);

      expect(envelope.signature).toBeNull();
      expect(envelope.rawPayload).toBe(JSON.stringify(event));
    });
  });

  describe('Webhook Subscription Registry', () => {
    let registry;

    beforeEach(() => {
      registry = createWebhookSubscriptionRegistry({
        storage: createMemoryStorageAdapter(),
      });
    });

    it('creates a webhook subscription', async () => {
      const sub = await registry.createSubscription({
        tenantId: 'tenant-123',
        endpointUrl: 'https://example.com/webhooks',
        events: ['submission', 'acknowledgement'],
        hmacSecret: 'my-secret-key',
      });

      expect(sub.tenantId).toBe('tenant-123');
      expect(sub.endpointUrl).toBe('https://example.com/webhooks');
      expect(sub.events).toEqual(['submission', 'acknowledgement']);
      expect(sub.hmacSecret).toBe('my-secret-key');
      expect(sub.status).toBe('active');
      expect(sub.subscriptionId).toBeDefined();
    });

    it('validates required fields on creation', async () => {
      await expect(
        registry.createSubscription({
          endpointUrl: 'https://example.com/webhooks',
          events: ['submission'],
          hmacSecret: 'secret',
        })
      ).rejects.toThrow('tenantId is required');

      await expect(
        registry.createSubscription({
          tenantId: 'tenant-123',
          endpointUrl: 'https://example.com/webhooks',
          events: ['submission'],
        })
      ).rejects.toThrow('hmacSecret is required');
    });

    it('lists subscriptions for a tenant', async () => {
      await registry.createSubscription({
        tenantId: 'tenant-123',
        endpointUrl: 'https://example.com/webhooks-1',
        events: ['submission'],
        hmacSecret: 'secret-1',
      });

      await registry.createSubscription({
        tenantId: 'tenant-123',
        endpointUrl: 'https://example.com/webhooks-2',
        events: ['acknowledgement'],
        hmacSecret: 'secret-2',
      });

      const subs = registry.listSubscriptions('tenant-123');
      expect(subs).toHaveLength(2);
    });

    it('revokes a subscription', async () => {
      const created = await registry.createSubscription({
        tenantId: 'tenant-123',
        endpointUrl: 'https://example.com/webhooks',
        events: ['submission'],
        hmacSecret: 'secret',
      });

      registry.revokeSubscription(created.subscriptionId);
      const afterRev = registry.getSubscription(created.subscriptionId);
      expect(afterRev.status).toBe('revoked');
    });

    it('updates a subscription endpoint', async () => {
      const created = await registry.createSubscription({
        tenantId: 'tenant-123',
        endpointUrl: 'https://example.com/webhooks',
        events: ['submission'],
        hmacSecret: 'secret',
      });

      registry.updateSubscription(created.subscriptionId, {
        endpointUrl: 'https://example.com/new-webhooks',
      });

      const updated = registry.getSubscription(created.subscriptionId);
      expect(updated.endpointUrl).toBe('https://example.com/new-webhooks');
    });
  });

  describe('Webhook Delivery Manager', () => {
    let outbox;
    let registry;
    let deliveryManager;

    beforeEach(() => {
      outbox = createEventOutbox({ storage: createMemoryStorageAdapter() });
      registry = createWebhookSubscriptionRegistry({
        storage: createMemoryStorageAdapter(),
      });
      deliveryManager = createWebhookDeliveryManager({
        outbox,
        registry,
        now: mockNow,
      });

      registry.createSubscription({
        tenantId: 'tenant-123',
        endpointUrl: 'https://example.com/webhooks',
        events: ['submission'],
        hmacSecret: 'my-secret-key',
      });
    });

    it('gets metrics for delivery', async () => {
      const metrics = deliveryManager.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.total).toBe(0);
    });

    it('replays events with admin authorization', async () => {
      const result = await deliveryManager.replay({
        actorRole: 'admin',
      });
      expect(result.ok).toBe(true);
    });

    it('replays events denies non-admin', async () => {
      const result = await deliveryManager.replay({
        actorRole: 'citizen',
      });
      expect(result.ok).toBe(false);
      expect(result.status).toBe(403);
    });
  });
});