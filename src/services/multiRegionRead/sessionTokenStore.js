/* global process */
/**
 * Session Token Store — Issues and validates Read-Your-Writes (RYW) tokens
 *
 * Tokens are JWS (HS256) signed with a server secret.
 * In production, the secret comes from environment variable.
 * In tests, a deterministic secret is used.
 */

import {
  RYW_TOKEN_CLAIMS,
  RYW_VALIDATION_RESULT,
  createRywTokenPayload,
  DEFAULT_CONFIG,
} from './types.js';

// ============================================================================
// Crypto Helpers (Web Crypto API)
// ============================================================================

/** Get or derive the signing key */
const getSigningKey = async (secret) => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
};

/** Sign a JWS payload (compact serialization) */
export const signJws = async (payload, secret) => {
  const key = await getSigningKey(secret);
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${signingInput}.${signatureB64}`;
};

/** Verify and decode a JWS token */
const verifyJws = async (token, secret) => {
  const key = await getSigningKey(secret);
  const encoder = new TextEncoder();
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  // Verify signature
  const signature = new Uint8Array(
    atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map((c) => c.charCodeAt(0))
  );
  const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(signingInput));
  if (!valid) throw new Error('Invalid signature');

  // Decode payload
  const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(payloadJson);
};

// ============================================================================
// Token Store Implementation
// ============================================================================

/** Create a session token store */
export const createSessionTokenStore = ({
  secret = process.env.RYW_TOKEN_SECRET || 'test-secret-do-not-use-in-production',
  config = DEFAULT_CONFIG,
  storage = new Map(), // In-memory default; production uses Redis/Firestore
} = {}) => {
  // Cleanup interval handle
  let cleanupInterval = null;

  const store = {
    secret,
    config,
    storage, // Map<tokenId, { payload, createdAt, userId }>
    revokedTokens: new Set(), // Token IDs (nonce) that are revoked
    issuedTokens: new Map(), // userId -> Set of token IDs (for cleanup)
  };

  // Start periodic cleanup of expired tokens
  const startCleanup = () => {
    if (cleanupInterval) return;
    cleanupInterval = setInterval(() => {
      cleanupExpiredTokens(store);
    }, 60000); // Every minute
  };

  const stopCleanup = () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  };

  return { ...store, startCleanup, stopCleanup, getTokenInfo: (token) => getTokenInfo(store, token), issueToken: (userId, primaryCommitTs, writeOpId, options) => issueToken(store, userId, primaryCommitTs, writeOpId, options), cleanupExpiredTokens: () => cleanupExpiredTokens(store) };
};

/** Issue a new RYW token after a successful write */
export const issueToken = async (store, userId, primaryCommitTs, writeOpId, { now = Date.now() } = {}) => {
  const payload = createRywTokenPayload({
    userId,
    primaryCommitTs,
    writeOpId,
    issuedAt: now,
    ttlMs: store.config.RYW_TOKEN_TTL_MS,
  });

  const token = await signJws(payload, store.secret);
  const tokenId = payload[RYW_TOKEN_CLAIMS.NONCE];

  // Store for validation and revocation tracking
  store.storage.set(tokenId, { payload, createdAt: now, userId });

  // Track per-user for cleanup
  if (!store.issuedTokens.has(userId)) {
    store.issuedTokens.set(userId, new Set());
  }
  store.issuedTokens.get(userId).add(tokenId);

  return { token, tokenId, primaryCommitTs, writeOpId, expiresAt: payload[RYW_TOKEN_CLAIMS.EXPIRY] };
};

/** Validate a RYW token against a target replica's replication progress */
export const validateToken = async (store, token, targetReplica, { now = Date.now() } = {}) => {
  // targetReplica: { regionId, lastReplicatedCommitTs, lagMs }

  try {
    const payload = await verifyJws(token, store.secret);
    const tokenId = payload[RYW_TOKEN_CLAIMS.NONCE];

    // Check revocation
    if (store.revokedTokens.has(tokenId)) {
      return { result: RYW_VALIDATION_RESULT.INVALID, reason: 'Token revoked' };
    }

    // Check expiry
    const exp = payload[RYW_TOKEN_CLAIMS.EXPIRY];
    if (now > exp) {
      return { result: RYW_VALIDATION_RESULT.EXPIRED, reason: 'Token expired' };
    }

    // Check if token was issued in the future (clock skew protection)
    const iat = payload[RYW_TOKEN_CLAIMS.ISSUED_AT];
    if (iat > now) {
      return { result: RYW_VALIDATION_RESULT.INVALID, reason: 'Token issued in future' };
    }

    // Check max age (defense against replay)
    if (now - iat > store.config.RYW_TOKEN_MAX_AGE_MS) {
      return { result: RYW_VALIDATION_RESULT.INVALID, reason: 'Token too old' };
    }

    const primaryCommitTs = payload[RYW_TOKEN_CLAIMS.PRIMARY_COMMIT_TS];
    const replicaCommitTs = targetReplica.lastReplicatedCommitTs || 0;

    // Check if replica has caught up to the write
    if (replicaCommitTs >= primaryCommitTs) {
      return {
        result: RYW_VALIDATION_RESULT.ALLOWED,
        primaryCommitTs,
        replicaCommitTs,
        lagMs: targetReplica.lagMs || 0,
        userId: payload[RYW_TOKEN_CLAIMS.SUB],
        writeOpId: payload[RYW_TOKEN_CLAIMS.WRITE_OP_ID],
      };
    }

    // Replica hasn't caught up — must route to primary
    return {
      result: RYW_VALIDATION_RESULT.ROUTED_TO_PRIMARY,
      primaryCommitTs,
      replicaCommitTs,
      lagMs: targetReplica.lagMs || 0,
      reason: `Replica lag ${primaryCommitTs - replicaCommitTs}ms behind required write`,
      userId: payload[RYW_TOKEN_CLAIMS.SUB],
      writeOpId: payload[RYW_TOKEN_CLAIMS.WRITE_OP_ID],
    };
  } catch (error) {
    return { result: RYW_VALIDATION_RESULT.INVALID, reason: error.message };
  }
};

/** Validate token and check user match */
export const validateTokenForUser = async (store, token, targetReplica, expectedUserId, options = {}) => {
  const result = await validateToken(store, token, targetReplica, options);
  if (result.result === RYW_VALIDATION_RESULT.ALLOWED || result.result === RYW_VALIDATION_RESULT.ROUTED_TO_PRIMARY) {
    if (result.userId !== expectedUserId) {
      return { ...result, result: RYW_VALIDATION_RESULT.USER_MISMATCH, reason: 'Token user mismatch' };
    }
  }
  return result;
};

/** Revoke a specific token (by nonce) */
export const revokeToken = (store, tokenId) => {
  store.revokedTokens.add(tokenId);
  store.storage.delete(tokenId);
  // Clean up per-user tracking
  for (const tokens of store.issuedTokens.values()) {
    tokens.delete(tokenId);
  }
  return { success: true };
};

/** Revoke all tokens for a user (e.g., on password change, logout) */
export const revokeAllUserTokens = (store, userId) => {
  const tokens = store.issuedTokens.get(userId);
  if (tokens) {
    for (const tokenId of tokens) {
      store.revokedTokens.add(tokenId);
      store.storage.delete(tokenId);
    }
    store.issuedTokens.delete(userId);
  }
  return { success: true, revokedCount: tokens?.size || 0 };
};

/** Clean up expired tokens from storage */
export const cleanupExpiredTokens = (store, { now = Date.now() } = {}) => {
  let cleaned = 0;
  for (const [tokenId, entry] of store.storage) {
    const exp = entry.payload[RYW_TOKEN_CLAIMS.EXPIRY];
    if (now > exp) {
      store.storage.delete(tokenId);
      store.revokedTokens.delete(tokenId);
      cleaned++;
    }
  }
  // Clean up per-user tracking
  for (const [userId, tokens] of store.issuedTokens) {
    for (const tokenId of tokens) {
      if (!store.storage.has(tokenId)) {
        tokens.delete(tokenId);
      }
    }
    if (tokens.size === 0) {
      store.issuedTokens.delete(userId);
    }
  }
  return { cleaned };
};

/** Get token info without validation (for debugging) */
export const getTokenInfo = async (store, token) => {
  try {
    const payload = await verifyJws(token, store.secret);
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/** Export metrics */
export const exportMetrics = (store) => {
  let totalTokens = 0;
  let expiredTokens = 0;
  const now = Date.now();
  for (const entry of store.storage.values()) {
    totalTokens++;
    if (now > entry.payload[RYW_TOKEN_CLAIMS.EXPIRY]) expiredTokens++;
  }
  return {
    totalTokens,
    expiredTokens,
    activeTokens: totalTokens - expiredTokens,
    revokedTokens: store.revokedTokens.size,
    usersWithTokens: store.issuedTokens.size,
  };
};

/** Reset store (for testing) */
export const resetStore = (store) => {
  store.storage.clear();
  store.revokedTokens.clear();
  store.issuedTokens.clear();
};