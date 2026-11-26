import { describe, it, expect, beforeEach } from 'vitest';
import { ConsumerRegistry, createConsumerRecord, CONSUMER_TIERS, AUTH_METHODS, TIER_DEFAULTS } from './consumerRegistry.js';

describe('ConsumerRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ConsumerRegistry({ secret: 'test-secret' });
  });

  describe('createConsumerRecord', () => {
    it('creates a consumer with defaults', () => {
      const record = createConsumerRecord({ id: 'test-1', name: 'Test Consumer' });
      expect(record.id).toBe('test-1');
      expect(record.name).toBe('Test Consumer');
      expect(record.tier).toBe(CONSUMER_TIERS.FREE);
      expect(record.authMethod).toBe(AUTH_METHODS.API_KEY);
      expect(record.status).toBe('active');
      expect(record.quotas).toEqual(TIER_DEFAULTS[CONSUMER_TIERS.FREE]);
    });

    it('allows custom tier and quotas', () => {
      const record = createConsumerRecord({
        id: 'test-2',
        name: 'Partner',
        tier: CONSUMER_TIERS.PARTNER,
        quotas: { rpm: 1000 },
      });
      expect(record.tier).toBe(CONSUMER_TIERS.PARTNER);
      expect(record.quotas.rpm).toBe(1000);
      expect(record.quotas.rph).toBe(TIER_DEFAULTS[CONSUMER_TIERS.PARTNER].rph); // Unchanged
    });
  });

  describe('registerConsumer', () => {
    it('registers a new consumer', async () => {
      const consumer = await registry.registerConsumer({
        name: 'Test Consumer',
        tier: CONSUMER_TIERS.FREE,
        credentials: { apiKey: 'test-key-123' },
      });

      expect(consumer.id).toBeDefined();
      expect(consumer.name).toBe('Test Consumer');
      expect(consumer.tier).toBe(CONSUMER_TIERS.FREE);
      expect(consumer.hasApiKey).toBe(true);
    });

    it('indexes API key credential', async () => {
      await registry.registerConsumer({
        id: 'consumer-1',
        name: 'Test',
        credentials: { apiKey: 'secret-key' },
      });

      const found = await registry.getConsumerByCredential('secret-key');
      expect(found).toBeDefined();
      expect(found.id).toBe('consumer-1');
    });

    it('generates ID when not provided', async () => {
      const consumer = await registry.registerConsumer({ name: 'No ID' });
      expect(consumer.id).toMatch(/^consumer_[a-f0-9]{16}$/);
    });
  });

  describe('getConsumer', () => {
    it('returns consumer by ID', async () => {
      await registry.registerConsumer({ id: 'consumer-1', name: 'Test' });
      const found = await registry.getConsumer('consumer-1');
      expect(found).toBeDefined();
      expect(found.id).toBe('consumer-1');
    });

    it('returns null for unknown ID', async () => {
      const found = await registry.getConsumer('unknown');
      expect(found).toBeNull();
    });

    it('sanitizes credentials in response', async () => {
      await registry.registerConsumer({
        id: 'consumer-1',
        name: 'Test',
        credentials: { apiKey: 'secret' },
      });
      const found = await registry.getConsumer('consumer-1');
      expect(found.credentials).toEqual(['apiKey']);
      expect(found.hasApiKey).toBe(true);
      expect(found.credentials.apiKey).toBeUndefined();
    });
  });

  describe('getConsumerByCredential', () => {
    it('finds consumer by API key', async () => {
      await registry.registerConsumer({
        id: 'consumer-1',
        credentials: { apiKey: 'secret-key' },
      });

      const found = await registry.getConsumerByCredential('secret-key');
      expect(found.id).toBe('consumer-1');
    });

    it('returns null for unknown credential', async () => {
      const found = await registry.getConsumerByCredential('unknown-key');
      expect(found).toBeNull();
    });
  });

  describe('updateConsumer', () => {
    it('updates consumer fields', async () => {
      await registry.registerConsumer({ id: 'consumer-1', name: 'Original', tier: CONSUMER_TIERS.FREE });

      const updated = await registry.updateConsumer('consumer-1', {
        name: 'Updated',
        tier: CONSUMER_TIERS.PARTNER,
      });

      expect(updated.name).toBe('Updated');
      expect(updated.tier).toBe(CONSUMER_TIERS.PARTNER);
      expect(updated.quotas.rpm).toBe(TIER_DEFAULTS[CONSUMER_TIERS.PARTNER].rpm);
    });

    it('updates credential index when API key changes', async () => {
      await registry.registerConsumer({
        id: 'consumer-1',
        credentials: { apiKey: 'old-key' },
      });

      await registry.updateConsumer('consumer-1', {
        credentials: { apiKey: 'new-key' },
      });

      const foundOld = await registry.getConsumerByCredential('old-key');
      const foundNew = await registry.getConsumerByCredential('new-key');

      expect(foundOld).toBeNull();
      expect(foundNew).toBeDefined();
      expect(foundNew.id).toBe('consumer-1');
    });

    it('preserves createdAt', async () => {
      await registry.registerConsumer({ id: 'consumer-1', name: 'Test' });
      const original = await registry.getConsumer('consumer-1');
      const originalCreatedAt = original.createdAt;

      await new Promise(r => setTimeout(r, 10));
      await registry.updateConsumer('consumer-1', { name: 'Updated' });

      const updated = await registry.getConsumer('consumer-1');
      expect(updated.createdAt).toBe(originalCreatedAt);
      expect(updated.updatedAt).not.toBe(originalCreatedAt);
    });
  });

  describe('setConsumerStatus', () => {
    it('activates and deactivates consumers', async () => {
      await registry.registerConsumer({ id: 'consumer-1', name: 'Test' });

      await registry.setConsumerStatus('consumer-1', 'inactive');
      let found = await registry.getConsumer('consumer-1');
      expect(found.status).toBe('inactive');

      await registry.setConsumerStatus('consumer-1', 'active');
      found = await registry.getConsumer('consumer-1');
      expect(found.status).toBe('active');
    });
  });

  describe('deleteConsumer', () => {
    it('removes consumer and cleans up credential index', async () => {
      await registry.registerConsumer({
        id: 'consumer-1',
        credentials: { apiKey: 'secret-key' },
      });

      await registry.deleteConsumer('consumer-1');

      const found = await registry.getConsumer('consumer-1');
      expect(found).toBeNull();

      const byCredential = await registry.getConsumerByCredential('secret-key');
      expect(byCredential).toBeNull();
    });

    it('returns false for unknown consumer', async () => {
      const result = await registry.deleteConsumer('unknown');
      expect(result).toBe(false);
    });
  });

  describe('listConsumers', () => {
    it('lists all consumers with filters', async () => {
      await registry.registerConsumer({ id: 'c1', name: 'Free 1', tier: CONSUMER_TIERS.FREE, status: 'active' });
      await registry.registerConsumer({ id: 'c2', name: 'Free 2', tier: CONSUMER_TIERS.FREE, status: 'inactive' });
      await registry.registerConsumer({ id: 'c3', name: 'Partner', tier: CONSUMER_TIERS.PARTNER, status: 'active' });

      const all = await registry.listConsumers({});
      expect(all.consumers).toHaveLength(3);

      const freeOnly = await registry.listConsumers({ tier: CONSUMER_TIERS.FREE });
      expect(freeOnly.consumers).toHaveLength(2);

      const activeOnly = await registry.listConsumers({ status: 'active' });
      expect(activeOnly.consumers).toHaveLength(2);
    });

    it('supports pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await registry.registerConsumer({ id: `c${i}`, name: `Consumer ${i}` });
      }

      const page1 = await registry.listConsumers({ limit: 2 });
      expect(page1.consumers).toHaveLength(2);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await registry.listConsumers({ limit: 2, cursor: page1.nextCursor });
      expect(page2.consumers).toHaveLength(2);
    });
  });

  describe('checkQuota', () => {
    it('allows requests within quota', async () => {
      await registry.registerConsumer({
        id: 'consumer-1',
        name: 'Test',
        tier: CONSUMER_TIERS.FREE,
      });

      const result = await registry.checkQuota('consumer-1', {
        route: '/api/test',
        method: 'GET',
        identifier: '203.0.113.1',
      });

      expect(result.allowed).toBe(true);
      expect(result.consumerId).toBe('consumer-1');
      expect(result.tier).toBe(CONSUMER_TIERS.FREE);
      expect(result.remaining).toBeDefined();
    });

    it('blocks when burst limit exceeded', async () => {
      await registry.registerConsumer({
        id: 'consumer-1',
        name: 'Test',
        tier: CONSUMER_TIERS.FREE,
        quotas: { burst: 1 }, // Very low burst
      });

      await registry.checkQuota('consumer-1', { route: '/api/test', method: 'GET', identifier: '203.0.113.1' });
      const result = await registry.checkQuota('consumer-1', { route: '/api/test', method: 'GET', identifier: '203.0.113.1' });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('burst_limit_exceeded');
    });

    it('blocks when RPM limit exceeded', async () => {
      await registry.registerConsumer({
        id: 'consumer-1',
        name: 'Test',
        tier: CONSUMER_TIERS.FREE,
        quotas: { rpm: 1 },
      });

      await registry.checkQuota('consumer-1', { route: '/api/test', method: 'GET', identifier: '203.0.113.1' });
      const result = await registry.checkQuota('consumer-1', { route: '/api/test', method: 'GET', identifier: '203.0.113.1' });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit_exceeded');
      expect(result.window).toBe('1m');
    });

    it('blocks inactive consumers', async () => {
      await registry.registerConsumer({ id: 'consumer-1', name: 'Test', status: 'inactive' });

      const result = await registry.checkQuota('consumer-1', { route: '/api/test', method: 'GET' });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('consumer_inactive');
    });

    it('uses anonymous tier for unknown consumers', async () => {
      const result = await registry.checkQuota('unknown-consumer', { route: '/api/test', method: 'GET' });

      expect(result.allowed).toBe(true);
      expect(result.consumerId).toBe('anonymous');
      expect(result.tier).toBe(CONSUMER_TIERS.ANONYMOUS);
    });
  });

  describe('getQuotaStats', () => {
    it('returns quota usage stats', async () => {
      await registry.registerConsumer({ id: 'consumer-1', name: 'Test', tier: CONSUMER_TIERS.FREE });
      await registry.checkQuota('consumer-1', { route: '/api/test', method: 'GET' });

      const stats = registry.getQuotaStats('consumer-1');
      expect(stats.consumerId).toBe('consumer-1');
      expect(stats.tier).toBe(CONSUMER_TIERS.FREE);
      expect(stats.currentUsage).toBeDefined();
    });

    it('returns null for unknown consumer', () => {
      expect(registry.getQuotaStats('unknown')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('returns registry statistics', async () => {
      await registry.registerConsumer({ id: 'c1', tier: CONSUMER_TIERS.FREE, status: 'active' });
      await registry.registerConsumer({ id: 'c2', tier: CONSUMER_TIERS.PARTNER, status: 'active' });
      await registry.registerConsumer({ id: 'c3', tier: CONSUMER_TIERS.FREE, status: 'inactive' });

      const stats = registry.getStats();
      expect(stats.totalConsumers).toBe(3);
      expect(stats.byTier[CONSUMER_TIERS.FREE]).toBe(2);
      expect(stats.byTier[CONSUMER_TIERS.PARTNER]).toBe(1);
      expect(stats.byStatus.active).toBe(2);
      expect(stats.byStatus.inactive).toBe(1);
    });
  });
});