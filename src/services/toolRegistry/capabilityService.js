/**
 * Short-Lived Scoped Capability Engine, Replay Protection & Revocation (#1146)
 *
 * Uses a browser- and Node-compatible SHA-256 / HMAC-SHA256 implementation so
 * capability signing and verification have zero Node-only polyfill dependencies.
 * Production signing secrets must live strictly on the server (TOOL_CAPABILITY_SECRET).
 */

import {
  ERROR_CODES,
  ROLE_SCOPE_CEILING,
  TOOL_REGISTRY_CONTRACT_VERSION,
} from './toolContracts.js';

export const CAPABILITY_TOKEN_PREFIX = 'ctok_v1';
export const DEFAULT_CAPABILITY_TTL_SECONDS = 120;
export const MAX_CAPABILITY_TTL_SECONDS = 300;
export const MIN_SECRET_LENGTH = 16;

// Standard FIPS 180-4 SHA-256 constants
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL_HASH = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const textEncoder = new TextEncoder();

function rotr(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Bytes(bytes) {
  const len = bytes.length;
  const bitLen = len * 8;
  const paddedLen = Math.ceil((len + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const h = new Uint32Array(INITIAL_HASH);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) {
    outView.setUint32(i * 4, h[i], false);
  }
  return out;
}

function hmacSha256Bytes(keyStr, messageStr) {
  let keyBytes = textEncoder.encode(String(keyStr));
  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(keyBytes);
  }
  const paddedKey = new Uint8Array(64);
  paddedKey.set(keyBytes);

  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i += 1) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const msgBytes = textEncoder.encode(String(messageStr));
  const inner = new Uint8Array(64 + msgBytes.length);
  inner.set(iKeyPad);
  inner.set(msgBytes, 64);
  const innerHash = sha256Bytes(inner);

  const outer = new Uint8Array(64 + innerHash.length);
  outer.set(oKeyPad);
  outer.set(innerHash, 64);
  return sha256Bytes(outer);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = typeof btoa === 'function'
    ? btoa(binary)
    : globalThis.Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(str) {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const full = normalized + pad;
  if (typeof atob === 'function') {
    const binary = atob(full);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(globalThis.Buffer.from(full, 'base64'));
}

export function sha256Hex(input) {
  const bytes = sha256Bytes(textEncoder.encode(String(input)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function canonicalizeForDigest(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeForDigest(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalizeForDigest(value[k])}`).join(',')}}`;
}

export function computeArgsDigest(args) {
  return sha256Hex(canonicalizeForDigest(args ?? {}));
}

function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

export function generateNonceId(prefix = 'jti') {
  const randomBytes = new Uint8Array(12);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < randomBytes.length; i += 1) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return `${prefix}_${bytesToBase64Url(randomBytes)}`;
}

/**
 * Resolves the permitted scope intersection for an actor's server-verified role.
 * Rejects privilege escalation if any requested scope exceeds the role ceiling.
 */
export function resolveAuthorizedScopes(actorRole, requestedScopes = [], toolScopes = []) {
  const roleCeiling = ROLE_SCOPE_CEILING[actorRole] || ROLE_SCOPE_CEILING.citizen;
  const candidateScopes = requestedScopes.length > 0 ? requestedScopes : toolScopes;

  for (const scope of candidateScopes) {
    if (!roleCeiling.includes(scope)) {
      return {
        ok: false,
        code: ERROR_CODES.SCOPE_DENIED,
        reason: `Role "${actorRole}" is not authorized for scope "${scope}"`,
      };
    }
  }

  for (const required of toolScopes) {
    if (!candidateScopes.includes(required)) {
      return {
        ok: false,
        code: ERROR_CODES.SCOPE_DENIED,
        reason: `Requested capability omits required tool scope "${required}"`,
      };
    }
  }

  return { ok: true, scopes: [...new Set(candidateScopes)] };
}

/**
 * Creates a capability token authority backed by an HMAC-SHA256 signing key.
 */
export function createCapabilityAuthority({
  secret,
  now = Date.now,
  defaultTtlSeconds = DEFAULT_CAPABILITY_TTL_SECONDS,
  maxTtlSeconds = MAX_CAPABILITY_TTL_SECONDS,
} = {}) {
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`Capability signing secret must be at least ${MIN_SECRET_LENGTH} characters.`);
  }

  return {
    issue({
      actorUserId,
      actorRole = 'citizen',
      sessionId = 'default-session',
      toolName,
      scopes,
      riskTier,
      ttlSeconds = defaultTtlSeconds,
      singleUse = true,
      citizenConfirmed = false,
      humanApproved = false,
      provenanceRef = null,
      argDigest = null,
    }) {
      if (!actorUserId || typeof actorUserId !== 'string') {
        throw new Error('actorUserId is required to mint a capability token.');
      }
      if (!toolName || typeof toolName !== 'string') {
        throw new Error('toolName is required to mint a capability token.');
      }
      if (!Array.isArray(scopes) || scopes.length === 0) {
        throw new Error('At least one scope is required to mint a capability token.');
      }

      const boundedTtl = Math.max(5, Math.min(Number(ttlSeconds) || defaultTtlSeconds, maxTtlSeconds));
      const iat = Math.floor(now() / 1000);
      const exp = iat + boundedTtl;
      const jti = generateNonceId('cap');

      const claims = {
        v: 1,
        contractVersion: TOOL_REGISTRY_CONTRACT_VERSION,
        jti,
        sub: actorUserId,
        role: actorRole === 'admin' ? 'admin' : 'citizen',
        sessionId: String(sessionId || 'default-session'),
        toolName,
        scopes: [...new Set(scopes)],
        riskTier,
        singleUse: Boolean(singleUse),
        citizenConfirmed: Boolean(citizenConfirmed),
        humanApproved: Boolean(humanApproved),
        provenanceRef: provenanceRef ? String(provenanceRef).slice(0, 128) : null,
        argDigest: argDigest ? String(argDigest) : null,
        iat,
        exp,
      };

      const payloadPart = bytesToBase64Url(textEncoder.encode(JSON.stringify(claims)));
      const signingInput = `${CAPABILITY_TOKEN_PREFIX}.${payloadPart}`;
      const sigPart = bytesToBase64Url(hmacSha256Bytes(secret, signingInput));

      return {
        token: `${signingInput}.${sigPart}`,
        claims,
      };
    },

    verify(token) {
      if (typeof token !== 'string' || !token.startsWith(`${CAPABILITY_TOKEN_PREFIX}.`)) {
        return {
          ok: false,
          code: ERROR_CODES.CAPABILITY_INVALID,
          reason: 'Malformed capability token format.',
        };
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        return {
          ok: false,
          code: ERROR_CODES.CAPABILITY_INVALID,
          reason: 'Malformed capability token segments.',
        };
      }

      const [prefix, payloadPart, providedSig] = parts;
      const signingInput = `${prefix}.${payloadPart}`;
      const expectedSig = bytesToBase64Url(hmacSha256Bytes(secret, signingInput));

      if (!constantTimeEquals(providedSig, expectedSig)) {
        return {
          ok: false,
          code: ERROR_CODES.CAPABILITY_INVALID,
          reason: 'Capability signature verification failed.',
        };
      }

      let claims;
      try {
        const json = new TextDecoder().decode(base64UrlToBytes(payloadPart));
        claims = JSON.parse(json);
      } catch {
        return {
          ok: false,
          code: ERROR_CODES.CAPABILITY_INVALID,
          reason: 'Capability payload is unreadable.',
        };
      }

      if (!claims || claims.v !== 1 || typeof claims.jti !== 'string' || typeof claims.sub !== 'string') {
        return {
          ok: false,
          code: ERROR_CODES.CAPABILITY_INVALID,
          reason: 'Capability payload is missing required claims.',
        };
      }

      const nowSec = Math.floor(now() / 1000);
      if (typeof claims.exp !== 'number' || nowSec >= claims.exp) {
        return {
          ok: false,
          code: ERROR_CODES.CAPABILITY_EXPIRED,
          reason: 'Capability token has expired.',
          claims,
        };
      }

      return { ok: true, claims };
    },
  };
}

/**
 * Atomic single-use nonce store preventing capability replay and concurrent double-execution.
 */
export function createReplayNonceStore({ now = Date.now, maxEntries = 5000 } = {}) {
  const consumed = new Map(); // jti -> expSec

  function prune() {
    const nowSec = Math.floor(now() / 1000);
    for (const [jti, exp] of consumed.entries()) {
      if (nowSec >= exp) {
        consumed.delete(jti);
      }
    }
    while (consumed.size > maxEntries) {
      const oldest = consumed.keys().next().value;
      consumed.delete(oldest);
    }
  }

  return {
    consume(jti, expSec) {
      prune();
      if (consumed.has(jti)) {
        return {
          ok: false,
          code: ERROR_CODES.CAPABILITY_REPLAYED,
          reason: 'Capability token has already been consumed (replay blocked).',
        };
      }
      consumed.set(jti, Number(expSec) || Math.floor(now() / 1000) + MAX_CAPABILITY_TTL_SECONDS);
      return { ok: true };
    },
    has(jti) {
      prune();
      return consumed.has(jti);
    },
    size() {
      prune();
      return consumed.size;
    },
  };
}

/**
 * Central revocation registry supporting capability (`jti`), user (`sub`), and tool-level kills.
 */
export function createRevocationRegistry({ now = Date.now } = {}) {
  const revokedCapabilities = new Map(); // jti -> record
  const revokedUsers = new Map(); // userId -> record
  const revokedTools = new Map(); // toolName -> record

  return {
    revokeCapability(jti, { actorId = 'admin', reason = 'Admin capability revocation' } = {}) {
      if (!jti) throw new Error('jti is required');
      const record = { jti, actorId, reason, revokedAt: new Date(now()).toISOString() };
      revokedCapabilities.set(jti, record);
      return record;
    },
    revokeUser(userId, { actorId = 'admin', reason = 'Admin user capability revocation' } = {}) {
      if (!userId) throw new Error('userId is required');
      const record = { userId, actorId, reason, revokedAt: new Date(now()).toISOString() };
      revokedUsers.set(userId, record);
      return record;
    },
    restoreUser(userId) {
      return revokedUsers.delete(userId);
    },
    revokeTool(toolName, { actorId = 'admin', reason = 'Admin tool revocation' } = {}) {
      if (!toolName) throw new Error('toolName is required');
      const record = { toolName, actorId, reason, revokedAt: new Date(now()).toISOString() };
      revokedTools.set(toolName, record);
      return record;
    },
    restoreTool(toolName) {
      return revokedTools.delete(toolName);
    },
    check({ jti, userId, toolName }) {
      if (toolName && revokedTools.has(toolName)) {
        return {
          revoked: true,
          code: ERROR_CODES.TOOL_REVOKED,
          reason: `Tool "${toolName}" is currently revoked by admin policy.`,
        };
      }
      if (userId && revokedUsers.has(userId)) {
        return {
          revoked: true,
          code: ERROR_CODES.USER_REVOKED,
          reason: 'All agent capabilities for this user have been revoked.',
        };
      }
      if (jti && revokedCapabilities.has(jti)) {
        return {
          revoked: true,
          code: ERROR_CODES.CAPABILITY_REVOKED,
          reason: 'This capability token has been revoked by an administrator.',
        };
      }
      return { revoked: false };
    },
    getSnapshot() {
      return {
        revokedTools: Array.from(revokedTools.values()),
        revokedUsers: Array.from(revokedUsers.values()),
        revokedCapabilities: Array.from(revokedCapabilities.values()),
      };
    },
  };
}
