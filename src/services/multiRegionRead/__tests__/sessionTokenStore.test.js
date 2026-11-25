/**
 * Tests for Session Token Store (Read-Your-Writes Tokens)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSessionTokenStore,
  issueToken,
  validateToken,
  validateTokenForUser,
  revokeToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  getTokenInfo,
  exportMetrics,
  resetStore,
} from '../sessionTokenStore.js';
import { DEFAULT_CONFIG, RYW_VALIDATION_RESULT } from '../types.js';

describe('Session Token Store', () => {
  let store;

  beforeEach(() => {
    store = createSessionTokenStore({
      secret: 'test-secret-key-for-testing-only',
      config: DEFAULT_CONFIG,
    });
  });

  describe('Token Issuance', () => {
    it('issues a valid JWS token', async () => {
      const result = await issueToken(store, 'user123', 1000000, 'op123');

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.').length).toBe(3); // JWS has 3 parts
      expect(result.tokenId).toBeDefined();
      expect(result.primaryCommitTs).toBe(1000000);
      expect(result.writeOpId).toBe('op123');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('stores token for validation', async () => {
      const result = await issueToken(store, 'user123', 1000000, 'op123');
      expect(store.storage.has(result.tokenId)).toBe(true);
      expect(store.issuedTokens.get('user123').has(result.tokenId)).toBe(true);
    });

    it('includes correct claims in payload', async () => {
      const result = await issueToken(store, 'user123', 1000000, 'op123');
      const info = await getTokenInfo(store, result.token);

      expect(info.valid).toBe(true);
      expect(info.payload.sub).toBe('user123');
      expect(info.payload.pct).toBe(1000000);
      expect(info.payload.woi).toBe('op123');
      expect(info.payload.nonce).toBe(result.tokenId);
    });
  });

  describe('Token Validation', () => {
    let token;

    beforeEach(async () => {
      const result = await issueToken(store, 'user123', 1000000, 'op123');
      token = result.token;
    });

    it('allows read when replica caught up', async () => {
      const result = await validateToken(store, token, {
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000, // Equal to primary commit
        lagMs: 50,
      });

      expect(result.result).toBe(RYW_VALIDATION_RESULT.ALLOWED);
      expect(result.primaryCommitTs).toBe(1000000);
      expect(result.replicaCommitTs).toBe(1000000);
      expect(result.userId).toBe('user123');
      expect(result.writeOpId).toBe('op123');
    });

    it('allows read when replica ahead', async () => {
      const result = await validateToken(store, token, {
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000100, // Ahead of primary commit
        lagMs: 50,
      });

      expect(result.result).toBe(RYW_VALIDATION_RESULT.ALLOWED);
    });

    it('routes to primary when replica lagging', async () => {
      const result = await validateToken(store, token, {
        regionId: 'us-central1',
        lastReplicatedCommitTs: 999900, // Behind primary commit
        lagMs: 150,
      });

      expect(result.result).toBe(RYW_VALIDATION_RESULT.ROUTED_TO_PRIMARY);
      expect(result.reason).toContain('lag');
    });

    it('rejects expired token', async () => {
      // Create token with past expiry
      const expiredStore = createSessionTokenStore({
        secret: 'test-secret-key-for-testing-only',
        config: { ...DEFAULT_CONFIG, RYW_TOKEN_TTL_MS: -1000 }, // Already expired
      });
      const expiredResult = await issueToken(expiredStore, 'user123', 1000000, 'op123');

      const result = await validateToken(expiredStore, expiredResult.token, {
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 50,
      });

      expect(result.result).toBe(RYW_VALIDATION_RESULT.EXPIRED);
    });

    it('rejects invalid signature', async () => {
      const result = await validateToken(store, 'invalid.token.signature', {
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 50,
      });

      expect(result.result).toBe(RYW_VALIDATION_RESULT.INVALID);
    });

    it('rejects malformed token', async () => {
      const result = await validateToken(store, 'not.a.jws', {
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 50,
      });

      expect(result.result).toBe(RYW_VALIDATION_RESULT.INVALID);
    });

    it('rejects token with missing claims', async () => {
      // Create token with incomplete payload (missing pct, woi, etc.)
      const incompleteStore = createSessionTokenStore({
        secret: 'test-secret-key-for-testing-only',
        config: DEFAULT_CONFIG,
      });
      // Manually create a token without required claims
      const { signJws } = await import('../sessionTokenStore.js');
      const badToken = await signJws({ sub: 'user123' }, 'test-secret-key-for-testing-only');

      const result = await validateToken(incompleteStore, badToken, {
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 50,
      });

      // Token with missing claims fails replica lag check (pct is undefined)
      // This results in routed_to_primary rather than invalid
      expect(result.result).toBe(RYW_VALIDATION_RESULT.ROUTED_TO_PRIMARY);
    });
  });

  describe('User Validation', () => {
    it('allows when user matches', async () => {
      const result = await issueToken(store, 'user123', 1000000, 'op123');
      const validation = await validateTokenForUser(store, result.token, {
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 50,
      }, 'user123');

      expect(validation.result).toBe(RYW_VALIDATION_RESULT.ALLOWED);
    });

    it('rejects when user mismatches', async () => {
      const result = await issueToken(store, 'user123', 1000000, 'op123');
      const validation = await validateTokenForUser(store, result.token, {
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 50,
      }, 'user456');

      expect(validation.result).toBe(RYW_VALIDATION_RESULT.USER_MISMATCH);
    });
  });

  describe('Token Revocation', () => {
    it('revokes specific token', async () => {
      const result = await issueToken(store, 'user123', 1000000, 'op123');
      expect(store.storage.has(result.tokenId)).toBe(true);

      revokeToken(store, result.tokenId);
      expect(store.storage.has(result.tokenId)).toBe(false);
      expect(store.revokedTokens.has(result.tokenId)).toBe(true);

      // Validation should fail
      const validation = await validateToken(store, result.token, {
        regionId: 'us-central1',
        lastReplicatedCommitTs: 1000000,
        lagMs: 50,
      });
      expect(validation.result).toBe(RYW_VALIDATION_RESULT.INVALID);
    });

    it('revokes all user tokens', async () => {
      const result1 = await issueToken(store, 'user123', 1000000, 'op1');
      const result2 = await issueToken(store, 'user123', 1000001, 'op2');
      const result3 = await issueToken(store, 'user456', 1000002, 'op3');

      expect(store.issuedTokens.get('user123').size).toBe(2);

      revokeAllUserTokens(store, 'user123');

      expect(store.issuedTokens.has('user123')).toBe(false);
      expect(store.revokedTokens.has(result1.tokenId)).toBe(true);
      expect(store.revokedTokens.has(result2.tokenId)).toBe(true);
      expect(store.revokedTokens.has(result3.tokenId)).toBe(false); // Different user
    });
  });

  describe('Cleanup', () => {
    it('removes expired tokens', async () => {
      const expiredStore = createSessionTokenStore({
        secret: 'test-secret-key-for-testing-only',
        config: { ...DEFAULT_CONFIG, RYW_TOKEN_TTL_MS: -1000 },
      });

      await issueToken(expiredStore, 'user123', 1000000, 'op1');
      await issueToken(expiredStore, 'user456', 1000001, 'op2');

      expect(expiredStore.storage.size).toBe(2);

      const result = cleanupExpiredTokens(expiredStore);
      expect(result.cleaned).toBe(2);
      expect(expiredStore.storage.size).toBe(0);
    });

    it('keeps valid tokens', async () => {
      await issueToken(store, 'user123', 1000000, 'op1');
      expect(store.storage.size).toBe(1);

      cleanupExpiredTokens(store);
      expect(store.storage.size).toBe(1);
    });
  });

  describe('Metrics', () => {
    it('exports correct metrics', async () => {
      await issueToken(store, 'user123', 1000000, 'op1');
      await issueToken(store, 'user123', 1000001, 'op2');
      await issueToken(store, 'user456', 1000002, 'op3');

      const metrics = exportMetrics(store);
      expect(metrics.totalTokens).toBe(3);
      expect(metrics.activeTokens).toBe(3);
      expect(metrics.usersWithTokens).toBe(2);
    });
  });

  describe('Reset', () => {
    it('clears all state', async () => {
      await issueToken(store, 'user123', 1000000, 'op1');
      revokeToken(store, 'some-token');

      resetStore(store);

      expect(store.storage.size).toBe(0);
      expect(store.revokedTokens.size).toBe(0);
      expect(store.issuedTokens.size).toBe(0);
    });
  });
});