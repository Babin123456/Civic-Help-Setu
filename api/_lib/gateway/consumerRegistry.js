/* global process */
/**
 * api/_lib/gateway/consumerRegistry.js
 *
 * Consumer Registry and Quota Management.
 * Manages API consumers (clients), their tiers, quotas, and authentication.
 * Integrates with the existing Abuse Control Plane for enforcement.
 */

import { createHmac } from 'node:crypto';
import { createWindowCounter } from '../abuseControlPlane.js';

export const CONSUMER_TIERS = Object.freeze({
  ANONYMOUS: 'anonymous',
  FREE: 'free',
  PARTNER: 'partner',
  PREMIUM: 'premium',
  INTERNAL: 'internal',
});

export const TIER_DEFAULTS = Object.freeze({
  [CONSUMER_TIERS.ANONYMOUS]: { rpm: 10, rph: 100, rpd: 500, burst: 5 },
  [CONSUMER_TIERS.FREE]: { rpm: 60, rph: 1000, rpd: 10000, burst: 20 },
  [CONSUMER_TIERS.PARTNER]: { rpm: 600, rph: 10000, rpd: 100000, burst: 100 },
  [CONSUMER_TIERS.PREMIUM]: { rpm: 6000, rph: 100000, rpd: 1000000, burst: 500 },
  [CONSUMER_TIERS.INTERNAL]: { rpm: 60000, rph: 1000000, rpd: 10000000, burst: 5000 },
});

export const AUTH_METHODS = Object.freeze({
  API_KEY: 'api_key',
  BEARER_TOKEN: 'bearer_token',
  JWT: 'jwt',
  MTLS: 'mtls',
  NONE: 'none',
});

/**
 * Consumer record structure
 */
export function createConsumerRecord({
  id,
  name,
  tier = CONSUMER_TIERS.FREE,
  authMethod = AUTH_METHODS.API_KEY,
  credentials = {},
  metadata = {},
  quotas = {},
  status = 'active',
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString(),
} = {}) {
  return {
    id,
    name,
    tier,
    authMethod,
    credentials,
    metadata,
    quotas: { ...TIER_DEFAULTS[tier], ...quotas },
    status,
    createdAt,
    updatedAt,
    // Runtime state
    _quotas: null, // Lazy-initialized quota counters
  };
}

/**
 * In-memory consumer registry with optional durable storage
 */
export class ConsumerRegistry {
  constructor(options = {}) {
    this.store = options.store || new Map(); // consumerId -> consumerRecord
    this.credentialIndex = new Map(); // credentialHash -> consumerId
    this.secret = options.secret || process.env.GATEWAY_CONSUMER_SECRET || 'gateway-consumer-secret-change-me';
    this.now = options.now || Date.now;
    this.abuseControlPlane = options.abuseControlPlane || null;
    this.defaultTier = options.defaultTier || CONSUMER_TIERS.ANONYMOUS;

    // Per-consumer quota counters (in-memory, per-instance)
    this.consumerQuotas = new Map(); // consumerId -> { rpm, rph, rpd } WindowCounters
  }

  /**
   * Hash a credential for indexing (never store raw credentials)
   */
  hashCredential(credential) {
    return createHmac('sha256', this.secret).update(credential).digest('hex');
  }

  /**
   * Register a new consumer
   */
  async registerConsumer(consumerData) {
    const id = consumerData.id || `consumer_${createHmac('sha256', this.secret).update(`${consumerData.name}:${this.now()}`).digest('hex').slice(0, 16)}`;
    const record = createConsumerRecord({ ...consumerData, id });

    // Index credentials
    if (record.authMethod === AUTH_METHODS.API_KEY && record.credentials.apiKey) {
      const hash = this.hashCredential(record.credentials.apiKey);
      this.credentialIndex.set(hash, id);
    }

    this.store.set(id, record);
    return this.sanitizeConsumer(record);
  }

  /**
   * Get consumer by ID
   */
  async getConsumer(consumerId) {
    const record = this.store.get(consumerId);
    return record ? this.sanitizeConsumer(record) : null;
  }

  /**
   * Get consumer by credential (API key, etc.)
   */
  async getConsumerByCredential(credential) {
    const hash = this.hashCredential(credential);
    const consumerId = this.credentialIndex.get(hash);
    if (!consumerId) return null;
    return this.getConsumer(consumerId);
  }

  /**
   * Update consumer
   */
  async updateConsumer(consumerId, updates) {
    const record = this.store.get(consumerId);
    if (!record) return null;

    // Handle credential changes
    if (updates.credentials && record.authMethod === AUTH_METHODS.API_KEY) {
      // Remove old credential index
      if (record.credentials.apiKey) {
        const oldHash = this.hashCredential(record.credentials.apiKey);
        this.credentialIndex.delete(oldHash);
      }
      // Add new credential index
      if (updates.credentials.apiKey) {
        const newHash = this.hashCredential(updates.credentials.apiKey);
        this.credentialIndex.set(newHash, consumerId);
      }
    }

    // Determine new tier (from updates or existing)
    const newTier = updates.tier || record.tier;
    // Base quotas on new tier defaults, then apply any explicit quota overrides
    const baseQuotas = { ...TIER_DEFAULTS[newTier] };
    const explicitQuotas = updates.quotas || {};
    const mergedQuotas = { ...baseQuotas, ...explicitQuotas };

    const updated = {
      ...record,
      ...updates,
      id: record.id, // Prevent ID change
      createdAt: record.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString(),
      tier: newTier,
      quotas: mergedQuotas,
    };

    this.store.set(consumerId, updated);
    return this.sanitizeConsumer(updated);
  }

  /**
   * Deactivate/reactivate consumer
   */
  async setConsumerStatus(consumerId, status) {
    const record = this.store.get(consumerId);
    if (!record) return null;
    record.status = status;
    record.updatedAt = new Date().toISOString();
    this.store.set(consumerId, record);
    return this.sanitizeConsumer(record);
  }

  /**
   * Delete consumer (and clean up credentials)
   */
  async deleteConsumer(consumerId) {
    const record = this.store.get(consumerId);
    if (!record) return false;

    if (record.authMethod === AUTH_METHODS.API_KEY && record.credentials.apiKey) {
      const hash = this.hashCredential(record.credentials.apiKey);
      this.credentialIndex.delete(hash);
    }

    // Clean up quota counters
    this.consumerQuotas.delete(consumerId);

    return this.store.delete(consumerId);
  }

  /**
   * List consumers with filtering
   */
  async listConsumers({ tier, status, limit = 100, cursor } = {}) {
    let consumers = [...this.store.values()];

    if (tier) consumers = consumers.filter(c => c.tier === tier);
    if (status) consumers = consumers.filter(c => c.status === status);

    consumers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const start = cursor ? consumers.findIndex(c => c.id === cursor) + 1 : 0;
    const page = consumers.slice(start, start + limit);

    return {
      consumers: page.map(c => this.sanitizeConsumer(c)),
      nextCursor: page.length === limit && start + limit < consumers.length ? page[page.length - 1].id : null,
    };
  }

  /**
   * Get or create quota counters for a consumer
   */
  getQuotaCounters(consumerId) {
    if (!this.consumerQuotas.has(consumerId)) {
      const consumer = this.store.get(consumerId);
      const quotas = consumer?.quotas || TIER_DEFAULTS[this.defaultTier];

      this.consumerQuotas.set(consumerId, {
        rpm: createWindowCounter({ limit: quotas.rpm, windowMs: 60 * 1000, now: this.now }),
        rph: createWindowCounter({ limit: quotas.rph, windowMs: 60 * 60 * 1000, now: this.now }),
        rpd: createWindowCounter({ limit: quotas.rpd, windowMs: 24 * 60 * 60 * 1000, now: this.now }),
        burst: createWindowCounter({ limit: quotas.burst, windowMs: 10 * 1000, now: this.now }),
      });
    }
    return this.consumerQuotas.get(consumerId);
  }

  /**
   * Check and consume quota for a consumer
   * Returns { allowed, remaining, retryAfterSeconds, limit, window }
   */
  async checkQuota(consumerId, { route, method, identifier, userId } = {}) {
    const consumer = this.store.get(consumerId);
    if (!consumer) {
      // Unknown consumer - use anonymous tier with minimal quota
      return this.checkAnonymousQuota({ route, method, identifier, userId });
    }

    if (consumer.status !== 'active') {
      return {
        allowed: false,
        reason: 'consumer_inactive',
        retryAfterSeconds: 0,
        consumerId,
        tier: consumer.tier,
      };
    }

    // Check per-consumer quotas (multi-window)
    const counters = this.getQuotaCounters(consumerId);

    // Check burst limit first (shortest window)
    const burstResult = counters.burst.take(`burst:${consumerId}`);
    if (!burstResult.allowed) {
      return {
        allowed: false,
        reason: 'burst_limit_exceeded',
        retryAfterSeconds: burstResult.retryAfterSeconds,
        consumerId,
        tier: consumer.tier,
        limit: counters.burst.limit,
        window: '10s',
      };
    }

    // Check RPM
    const rpmResult = counters.rpm.take(`rpm:${consumerId}`);
    if (!rpmResult.allowed) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        retryAfterSeconds: rpmResult.retryAfterSeconds,
        consumerId,
        tier: consumer.tier,
        limit: counters.rpm.limit,
        window: '1m',
      };
    }

    // Check RPH
    const rphResult = counters.rph.take(`rph:${consumerId}`);
    if (!rphResult.allowed) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        retryAfterSeconds: rphResult.retryAfterSeconds,
        consumerId,
        tier: consumer.tier,
        limit: counters.rph.limit,
        window: '1h',
      };
    }

    // Check RPD
    const rpdResult = counters.rpd.take(`rpd:${consumerId}`);
    if (!rpdResult.allowed) {
      return {
        allowed: false,
        reason: 'daily_limit_exceeded',
        retryAfterSeconds: rpdResult.retryAfterSeconds,
        consumerId,
        tier: consumer.tier,
        limit: counters.rpd.limit,
        window: '24h',
      };
    }

    // Also check abuse control plane if configured (for IP-based limits, etc.)
    if (this.abuseControlPlane) {
      const abuseResult = await this.abuseControlPlane.check({ route, method, identifier, userId });
      if (!abuseResult.allowed) {
        return {
          allowed: false,
          reason: abuseResult.reason,
          retryAfterSeconds: abuseResult.retryAfterSeconds,
          consumerId,
          tier: consumer.tier,
          abuseControl: true,
        };
      }
    }

    return {
      allowed: true,
      reason: 'ok',
      retryAfterSeconds: 0,
      consumerId,
      tier: consumer.tier,
      remaining: {
        burst: burstResult.remaining,
        rpm: rpmResult.remaining,
        rph: rphResult.remaining,
        rpd: rpdResult.remaining,
      },
    };
  }

  /**
   * Check quota for anonymous/unidentified requests
   */
  async checkAnonymousQuota({ route, method, identifier, userId } = {}) {
    // Use abuse control plane for anonymous quotas (IP-based)
    if (this.abuseControlPlane) {
      return this.abuseControlPlane.check({ route, method, identifier, userId });
    }

    // Fallback: minimal in-memory anonymous quota
    const anonCounters = this.getAnonCounters();
    const result = anonCounters.take(`anon:${identifier || 'unknown'}`);
    return {
      allowed: result.allowed,
      reason: result.allowed ? 'ok' : 'rate_limit_exceeded',
      retryAfterSeconds: result.retryAfterSeconds,
      consumerId: 'anonymous',
      tier: CONSUMER_TIERS.ANONYMOUS,
      remaining: result.remaining,
    };
  }

  getAnonCounters() {
    if (!this._anonCounters) {
      const quotas = TIER_DEFAULTS[CONSUMER_TIERS.ANONYMOUS];
      this._anonCounters = createWindowCounter({ limit: quotas.rpm, windowMs: 60 * 1000, now: this.now });
    }
    return this._anonCounters;
  }

  /**
   * Get quota usage stats for a consumer
   */
  getQuotaStats(consumerId) {
    const consumer = this.store.get(consumerId);
    if (!consumer) return null;

    const counters = this.getQuotaCounters(consumerId);
    return {
      consumerId,
      tier: consumer.tier,
      quotas: consumer.quotas,
      currentUsage: {
        burst: counters.burst.limit - counters.burst.size(),
        rpm: counters.rpm.limit - counters.rpm.size(),
        rph: counters.rph.limit - counters.rph.size(),
        rpd: counters.rpd.limit - counters.rpd.size(),
      },
    };
  }

  /**
   * Remove sensitive data from consumer record
   */
  sanitizeConsumer(record) {
    const safe = { ...record };
    delete safe.credentials;
    delete safe._quotas;
    return {
      ...safe,
      credentials: record.credentials ? Object.keys(record.credentials) : [], // Only show which credential types exist
      hasApiKey: !!record.credentials?.apiKey,
    };
  }

  /**
   * Get registry stats for monitoring
   */
  getStats() {
    const byTier = {};
    const byStatus = {};

    for (const consumer of this.store.values()) {
      byTier[consumer.tier] = (byTier[consumer.tier] || 0) + 1;
      byStatus[consumer.status] = (byStatus[consumer.status] || 0) + 1;
    }

    return {
      totalConsumers: this.store.size,
      byTier,
      byStatus,
      activeQuotaCounters: this.consumerQuotas.size,
      credentialIndexSize: this.credentialIndex.size,
    };
  }
}

/**
 * Create a consumer registry with pre-configured consumers
 */
export function createConsumerRegistryWithDefaults(consumers = [], options = {}) {
  const registry = new ConsumerRegistry(options);

  for (const consumer of consumers) {
    registry.registerConsumer(consumer);
  }

  return registry;
}

/**
 * Default registry instance
 */
let defaultRegistry = null;

export function getDefaultConsumerRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = new ConsumerRegistry();
  }
  return defaultRegistry;
}

export function setDefaultConsumerRegistry(registry) {
  defaultRegistry = registry;
}