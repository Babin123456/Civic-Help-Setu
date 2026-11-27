/**
 * Tests for multi-region read types and constants
 */

import { describe, it, expect } from 'vitest';
import {
  RESIDENCY_CLASS,
  CONSISTENCY_LEVEL,
  REPLICA_HEALTH,
  ROUTING_REASON,
  ROUTING_CONSIDERATION,
  ROUTING_META,
  RYW_TOKEN_CLAIMS,
  RYW_VALIDATION_RESULT,
  HTTP_HEADERS,
  DEFAULT_CONFIG,
  createRegionConfig,
  createReplicaState,
  createRywTokenPayload,
  createClientContext,
  createRoutingDecision,
  createResponseMeta,
  createHeartbeatDoc,
  createHealthCheckResult,
  shouldReplicateCollection,
  requiresIndiaResidency,
} from '../types.js';

describe('Multi-Region Read Types', () => {
  describe('Constants', () => {
    it('defines residency classes', () => {
      expect(RESIDENCY_CLASS.INDIA).toBe('india');
      expect(RESIDENCY_CLASS.GLOBAL).toBe('global');
    });

    it('defines consistency levels', () => {
      expect(CONSISTENCY_LEVEL.STRONG).toBe('strong');
      expect(CONSISTENCY_LEVEL.BOUNDED_STALE).toBe('bounded_stale');
      expect(CONSISTENCY_LEVEL.EVENTUAL).toBe('eventual');
    });

    it('defines replica health states', () => {
      expect(REPLICA_HEALTH.HEALTHY).toBe('healthy');
      expect(REPLICA_HEALTH.DEGRADED).toBe('degraded');
      expect(REPLICA_HEALTH.UNHEALTHY).toBe('unhealthy');
      expect(REPLICA_HEALTH.DRAINING).toBe('draining');
      expect(REPLICA_HEALTH.RECOVERING).toBe('recovering');
    });

    it('defines routing reasons', () => {
      expect(ROUTING_REASON.PRIMARY_ONLY).toBe('primary_only');
      expect(ROUTING_REASON.RYW_TOKEN_VALID).toBe('ryw_token_valid');
      expect(ROUTING_REASON.NEAREST_HEALTHY).toBe('nearest_healthy');
      expect(ROUTING_REASON.FAILOVER_TO_PRIMARY).toBe('failover_to_primary');
    });

    it('defines RYW token claims', () => {
      expect(RYW_TOKEN_CLAIMS.SUB).toBe('sub');
      expect(RYW_TOKEN_CLAIMS.PRIMARY_COMMIT_TS).toBe('pct');
      expect(RYW_TOKEN_CLAIMS.WRITE_OP_ID).toBe('woi');
    });

    it('defines RYW validation results', () => {
      expect(RYW_VALIDATION_RESULT.ALLOWED).toBe('allowed');
      expect(RYW_VALIDATION_RESULT.ROUTED_TO_PRIMARY).toBe('routed_to_primary');
      expect(RYW_VALIDATION_RESULT.EXPIRED).toBe('expired');
      expect(RYW_VALIDATION_RESULT.INVALID).toBe('invalid');
      expect(RYW_VALIDATION_RESULT.USER_MISMATCH).toBe('user_mismatch');
    });

    it('defines HTTP headers', () => {
      expect(HTTP_HEADERS.SERVED_BY_REGION).toBe('x-served-by-region');
      expect(HTTP_HEADERS.STALE_READ).toBe('x-stale-read');
      expect(HTTP_HEADERS.RYW_TOKEN).toBe('x-read-your-writes-token');
    });
  });

  describe('Factory Functions', () => {
    it('creates region config with defaults', () => {
      const config = createRegionConfig({ id: 'test-region' });
      expect(config.id).toBe('test-region');
      expect(config.residency).toBe(RESIDENCY_CLASS.GLOBAL);
      expect(config.readOnly).toBe(true);
      expect(config.weight).toBe(100);
    });

    it('creates region config with capacityPercent', () => {
      const config = createRegionConfig({ id: 'test-region', capacityPercent: 80 });
      expect(config.capacityPercent).toBe(80);

      const configDefault = createRegionConfig({ id: 'test-region-default' });
      expect(configDefault.capacityPercent).toBe(100);
    });

    it('creates replica state with defaults', () => {
      const state = createReplicaState({ regionId: 'test' });
      expect(state.regionId).toBe('test');
      expect(state.health).toBe(REPLICA_HEALTH.HEALTHY);
      expect(state.lagMs).toBe(0);
      expect(state.weight).toBe(100);
      expect(state.latencyMs).toBe(0);
      expect(state.capacityPercent).toBe(100);
    });

    it('creates replica state with custom values', () => {
      const state = createReplicaState({
        regionId: 'test',
        health: REPLICA_HEALTH.DEGRADED,
        latencyMs: 250,
        capacityPercent: 60,
      });
      expect(state.regionId).toBe('test');
      expect(state.health).toBe(REPLICA_HEALTH.DEGRADED);
      expect(state.lagMs).toBe(0);
      expect(state.weight).toBe(100);
      expect(state.latencyMs).toBe(250);
      expect(state.capacityPercent).toBe(60);
    });

    it('creates RYW token payload', () => {
      const payload = createRywTokenPayload({
        userId: 'user123',
        primaryCommitTs: 1000000,
        writeOpId: 'op123',
      });
      expect(payload.sub).toBe('user123');
      expect(payload.pct).toBe(1000000);
      expect(payload.woi).toBe('op123');
      expect(payload.exp).toBeGreaterThan(payload.iat);
      expect(payload.nonce).toBeDefined();
    });

    it('creates client context', () => {
      const ctx = createClientContext({
        userId: 'user123',
        explicitRegion: 'us-central1',
        sessionToken: 'token123',
      });
      expect(ctx.userId).toBe('user123');
      expect(ctx.explicitRegion).toBe('us-central1');
      expect(ctx.sessionToken).toBe('token123');
    });

    it('creates routing decision', () => {
      const decision = createRoutingDecision({
        replicaId: 'us-central1',
        regionId: 'us-central1',
        consistencyLevel: CONSISTENCY_LEVEL.BOUNDED_STALE,
        reason: ROUTING_REASON.NEAREST_HEALTHY,
        replicaLagMs: 100,
        staleRead: true, // Explicitly set since factory doesn't auto-compute
      });
      expect(decision.replicaId).toBe('us-central1');
      expect(decision.consistencyLevel).toBe(CONSISTENCY_LEVEL.BOUNDED_STALE);
      expect(decision.replicaLagMs).toBe(100);
      expect(decision.staleRead).toBe(true);
    });

    it('creates response meta', () => {
      const meta = createResponseMeta({
        servedByRegion: 'us-central1',
        consistencyLevel: CONSISTENCY_LEVEL.BOUNDED_STALE,
        replicaLagMs: 50,
        primaryRegion: 'asia-south1',
        staleRead: true, // Explicitly set since factory doesn't auto-compute
      });
      expect(meta.servedByRegion).toBe('us-central1');
      expect(meta.staleRead).toBe(true);
    });

    it('creates heartbeat doc', () => {
      const hb = createHeartbeatDoc({
        replicaId: 'us-central1',
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 50,
      });
      expect(hb.replicaId).toBe('us-central1');
      expect(hb.healthy).toBe(true);
      expect(hb.updatedAt).toBeDefined();
    });

    it('creates health check result', () => {
      const health = createHealthCheckResult({
        replicaId: 'us-central1',
        regionId: 'us-central1',
        healthy: true,
        lagMs: 50,
        errorRate5m: 0.01,
      });
      expect(health.healthy).toBe(true);
      expect(health.lagMs).toBe(50);
      expect(health.checkedAt).toBeDefined();
    });
  });

  describe('Collection Classification', () => {
    it('classifies public reference collections as replicatable', () => {
      expect(shouldReplicateCollection('services')).toBe(true);
      expect(shouldReplicateCollection('notices')).toBe(true);
      expect(shouldReplicateCollection('service_versions')).toBe(true);
      expect(shouldReplicateCollection('micro_tasks')).toBe(true);
      expect(shouldReplicateCollection('publicToiletSubmissions')).toBe(true);
    });

    it('classifies anonymized submissions as replicatable', () => {
      expect(shouldReplicateCollection('errorReports')).toBe(true);
      expect(shouldReplicateCollection('barrierReports')).toBe(true);
      expect(shouldReplicateCollection('bottleneckFeedback')).toBe(true);
    });

    it('classifies sensitive citizen collections as NOT replicatable', () => {
      expect(shouldReplicateCollection('users')).toBe(false);
      expect(shouldReplicateCollection('users/user123/vaultDocs')).toBe(false);
      expect(shouldReplicateCollection('applications')).toBe(false);
      expect(shouldReplicateCollection('grievanceTickets')).toBe(false);
      expect(shouldReplicateCollection('privacyExports')).toBe(false);
      expect(shouldReplicateCollection('auditLogs')).toBe(false);
    });

    it('classifies admin-only collections as NOT replicatable', () => {
      expect(shouldReplicateCollection('roles')).toBe(false);
      expect(shouldReplicateCollection('reviewOverrides')).toBe(false);
      expect(shouldReplicateCollection('sourceConflicts')).toBe(false);
    });

    it('defaults to deny for unknown collections', () => {
      expect(shouldReplicateCollection('unknown_collection')).toBe(false);
    });

    it('detects India residency requirement', () => {
      expect(requiresIndiaResidency('users')).toBe(true);
      expect(requiresIndiaResidency('users/user123/applications')).toBe(true);
      expect(requiresIndiaResidency('applications')).toBe(true);
      expect(requiresIndiaResidency('roles')).toBe(true);
      expect(requiresIndiaResidency('services')).toBe(false);
      expect(requiresIndiaResidency('notices')).toBe(false);
    });
  });

  describe('Default Config', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_CONFIG.HEARTBEAT_INTERVAL_MS).toBe(10000);
      expect(DEFAULT_CONFIG.HEARTBEAT_TTL_MS).toBe(60000);
      expect(DEFAULT_CONFIG.DEGRADED_LAG_MS).toBe(2000);
      expect(DEFAULT_CONFIG.UNHEALTHY_LAG_MS).toBe(10000);
      expect(DEFAULT_CONFIG.MAX_ERROR_RATE_5M).toBe(0.05);
      expect(DEFAULT_CONFIG.RYW_TOKEN_TTL_MS).toBe(3600000);
      expect(DEFAULT_CONFIG.PRIMARY_REGION_ID).toBe('asia-south1');
    });
  });

  describe('New Constants', () => {
    it('defines routing consideration constants', () => {
      expect(ROUTING_CONSIDERATION.HEALTH).toBe('health');
      expect(ROUTING_CONSIDERATION.LATENCY).toBe('latency');
      expect(ROUTING_CONSIDERATION.CAPACITY).toBe('capacity');
      expect(ROUTING_CONSIDERATION.RESIDENCY).toBe('residency');
      expect(ROUTING_CONSIDERATION.STICKY_SESSION).toBe('sticky_session');
    });

    it('defines routing meta constants', () => {
      expect(ROUTING_META.LATENCY_MS).toBe('latency_ms');
      expect(ROUTING_META.CAPACITY_PERCENT).toBe('capacity_percent');
      expect(ROUTING_META.STICKY_SESSION).toBe('sticky_session');
      expect(ROUTING_META.RESIDENCY_COMPLIANT).toBe('residency_compliant');
      expect(ROUTING_META.RESIDENCY_ENFORCED).toBe('residency_enforced');
    });
  });
});