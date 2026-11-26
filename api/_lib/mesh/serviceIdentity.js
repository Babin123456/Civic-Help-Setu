/* global Buffer */
/**
 * api/_lib/mesh/serviceIdentity.js
 *
 * Service identity, mutual authentication (mTLS XFCC header + meshless ECDSA-P256
 * mutual assertions), overlapping key/certificate rotation, revocation, and bounded
 * replay protection (#1276).
 *
 * Service authentication is strictly independent of end-user Clerk/Firebase sessions.
 */

import {
  createHash,
  createSign,
  createVerify,
  generateKeyPairSync,
  randomUUID,
  timingSafeEqual,
  X509Certificate,
} from 'node:crypto';

export const KEY_STATUS = Object.freeze({
  ACTIVE: 'active',
  STAGING: 'staging',
  GRACE: 'grace',
  REVOKED: 'revoked',
});

export const MESH_TRANSPORT_MODES = Object.freeze({
  AUTO: 'auto',
  APP_MUTUAL: 'app_mutual',
  MTLS_HEADER: 'mtls_header',
});

export const DEFAULT_CLOCK_SKEW_SECONDS = 30;
export const DEFAULT_ASSERTION_TTL_SECONDS = 60;
const MAX_REPLAY_ENTRIES = 10000;

function toBase64Url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64url');
}

function fromBase64Url(str) {
  return Buffer.from(str, 'base64url');
}

function readHeader(headers = {}, name) {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === lower) {
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return undefined;
}

function safeTimingEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Generates an ECDSA P-256 keypair in PEM format for a service identity.
 */
export function generateServiceKeyPair({
  serviceId,
  kid,
  spiffeId,
  ttlMs = 24 * 60 * 60 * 1000,
  now = Date.now,
} = {}) {
  if (!serviceId || typeof serviceId !== 'string') {
    throw new TypeError('generateServiceKeyPair requires serviceId');
  }
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const issuedAt = now();
  const keyId = kid || `${serviceId}-${issuedAt.toString(36)}-${randomUUID().slice(0, 8)}`;
  const fingerprint = createHash('sha256').update(publicKey).digest('hex');

  return {
    kid: keyId,
    serviceId,
    spiffeId: spiffeId || `spiffe://civic-help-setu.internal/ns/api/sa/${serviceId}`,
    algorithm: 'ES256',
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    fingerprint,
    notBefore: Math.floor(issuedAt / 1000) - 5,
    notAfter: Math.floor((issuedAt + ttlMs) / 1000),
    status: KEY_STATUS.ACTIVE,
  };
}

/**
 * Computes a deterministic SHA-256 digest of request method, path, and body.
 */
export function computeRequestDigest({ method = 'GET', path = '/', body = '' } = {}) {
  const serializedBody =
    body === undefined || body === null
      ? ''
      : typeof body === 'string'
        ? body
        : JSON.stringify(body);
  return createHash('sha256')
    .update(`${String(method).toUpperCase()}\n${String(path)}\n${serializedBody}`)
    .digest('base64url');
}

/**
 * Overlapping keyring supporting active/staging/grace/revoked certificates & keys.
 */
export function createServiceKeyring({
  initialKeys = [],
  now = Date.now,
  maxReplayEntries = MAX_REPLAY_ENTRIES,
} = {}) {
  const keys = new Map(); // kid -> entry
  const seenJtis = new Map(); // jti -> expiresAtSeconds

  function registerKey(entry) {
    if (!entry || !entry.kid || !entry.serviceId || (!entry.publicKeyPem && !entry.certificatePem)) {
      throw new TypeError('Keyring entry requires kid, serviceId, and publicKeyPem or certificatePem');
    }
    const status = entry.status || KEY_STATUS.ACTIVE;
    if (!Object.values(KEY_STATUS).includes(status)) {
      throw new TypeError(`Unsupported key status: ${status}`);
    }

    let publicKeyPem = entry.publicKeyPem || null;
    let fingerprint = entry.fingerprint || null;
    let notBefore = entry.notBefore;
    let notAfter = entry.notAfter;
    let certSpiffeId = null;

    if (entry.certificatePem) {
      const cert = new X509Certificate(entry.certificatePem);
      if (!publicKeyPem) {
        publicKeyPem = cert.publicKey.export({ type: 'spki', format: 'pem' });
      }
      if (!fingerprint && cert.fingerprint256) {
        fingerprint = cert.fingerprint256.replace(/:/g, '').toLowerCase();
      }
      if (notBefore === undefined) {
        const parsedFrom = Date.parse(cert.validFrom);
        if (Number.isFinite(parsedFrom)) notBefore = Math.floor(parsedFrom / 1000);
      }
      if (notAfter === undefined) {
        const parsedTo = Date.parse(cert.validTo);
        if (Number.isFinite(parsedTo)) notAfter = Math.floor(parsedTo / 1000);
      }
      if (typeof cert.subjectAltName === 'string') {
        const uriMatch = /URI:(spiffe:\/\/[^\s,]+)/i.exec(cert.subjectAltName);
        if (uriMatch) certSpiffeId = uriMatch[1];
      }
    }

    const record = {
      kid: entry.kid,
      serviceId: entry.serviceId,
      spiffeId:
        entry.spiffeId ||
        certSpiffeId ||
        `spiffe://civic-help-setu.internal/ns/api/sa/${entry.serviceId}`,
      algorithm: entry.algorithm || 'ES256',
      publicKeyPem,
      hasCertificate: Boolean(entry.certificatePem),
      fingerprint:
        fingerprint || createHash('sha256').update(publicKeyPem).digest('hex'),
      status,
      notBefore: notBefore ?? 0,
      notAfter: notAfter ?? Number.MAX_SAFE_INTEGER,
      allowedAudiences: Array.isArray(entry.allowedAudiences) ? [...entry.allowedAudiences] : ['*'],
      allowedScopes: Array.isArray(entry.allowedScopes) ? [...entry.allowedScopes] : ['*'],
      registeredAt: new Date(now()).toISOString(),
      revokedAt: entry.revokedAt || null,
    };
    keys.set(record.kid, record);
    return { ...record };
  }

  /**
   * Promotes a new key to `active` for `serviceId` and demotes prior `active` keys
   * to `grace` so overlapping in-flight requests continue verifying during rollover.
   */
  function rotateKey(nextEntry, { demoteActiveTo = KEY_STATUS.GRACE } = {}) {
    if (!nextEntry || !nextEntry.serviceId) {
      throw new TypeError('rotateKey requires a key entry with serviceId');
    }
    for (const existing of keys.values()) {
      if (existing.serviceId === nextEntry.serviceId && existing.status === KEY_STATUS.ACTIVE) {
        existing.status = demoteActiveTo;
      }
    }
    return registerKey({ ...nextEntry, status: KEY_STATUS.ACTIVE });
  }

  function revokeKey(kid, reason = 'manual_revocation') {
    const entry = keys.get(kid);
    if (!entry) return false;
    entry.status = KEY_STATUS.REVOKED;
    entry.revokedAt = new Date(now()).toISOString();
    entry.revocationReason = reason;
    return true;
  }

  function getKey(kid) {
    return keys.get(kid) || null;
  }

  function listKeys({ serviceId, includePublicKey = false } = {}) {
    const out = [];
    for (const entry of keys.values()) {
      if (serviceId && entry.serviceId !== serviceId) continue;
      const copy = {
        kid: entry.kid,
        serviceId: entry.serviceId,
        spiffeId: entry.spiffeId,
        algorithm: entry.algorithm,
        fingerprint: entry.fingerprint,
        status: entry.status,
        notBefore: entry.notBefore,
        notAfter: entry.notAfter,
        allowedAudiences: [...entry.allowedAudiences],
        allowedScopes: [...entry.allowedScopes],
        registeredAt: entry.registeredAt,
        revokedAt: entry.revokedAt,
      };
      if (includePublicKey) copy.publicKeyPem = entry.publicKeyPem;
      out.push(copy);
    }
    return out;
  }

  function pruneExpired() {
    const nowSec = Math.floor(now() / 1000);
    let prunedKeys = 0;
    for (const [kid, entry] of keys.entries()) {
      if (entry.notAfter < nowSec && entry.status === KEY_STATUS.GRACE) {
        keys.delete(kid);
        prunedKeys += 1;
      }
    }
    let prunedJtis = 0;
    for (const [jti, exp] of seenJtis.entries()) {
      if (exp < nowSec) {
        seenJtis.delete(jti);
        prunedJtis += 1;
      }
    }
    return { prunedKeys, prunedJtis };
  }

  function recordReplayNonce(jti, expSeconds) {
    const nowSec = Math.floor(now() / 1000);
    if (seenJtis.has(jti)) {
      const existingExp = seenJtis.get(jti);
      if (existingExp >= nowSec) {
        return false; // Replay detected within validity window.
      }
      seenJtis.delete(jti);
    }
    if (seenJtis.size >= maxReplayEntries) {
      pruneExpired();
      while (seenJtis.size >= maxReplayEntries) {
        seenJtis.delete(seenJtis.keys().next().value);
      }
    }
    seenJtis.set(jti, expSeconds);
    return true;
  }

  for (const key of initialKeys) {
    registerKey(key);
  }

  return {
    registerKey,
    rotateKey,
    revokeKey,
    getKey,
    listKeys,
    pruneExpired,
    recordReplayNonce,
    summary() {
      const counts = { active: 0, staging: 0, grace: 0, revoked: 0 };
      for (const entry of keys.values()) {
        counts[entry.status] = (counts[entry.status] || 0) + 1;
      }
      return { totalKeys: keys.size, replayCacheSize: seenJtis.size, counts };
    },
  };
}

/**
 * Signs a short-lived service-to-service assertion (compact JWS-style ES256 token).
 */
export function signServiceAssertion({
  signingKey,
  audience,
  scopes = ['internal:read'],
  method = 'GET',
  path = '/',
  body = '',
  ttlSeconds = DEFAULT_ASSERTION_TTL_SECONDS,
  now = Date.now,
  jti = randomUUID(),
  includeRequestDigest = true,
}) {
  if (!signingKey || !signingKey.privateKeyPem || !signingKey.kid || !signingKey.serviceId) {
    throw new TypeError('signServiceAssertion requires signingKey with kid, serviceId, privateKeyPem');
  }
  if (!audience || typeof audience !== 'string') {
    throw new TypeError('signServiceAssertion requires audience');
  }

  const iat = Math.floor(now() / 1000);
  const exp = iat + Math.max(5, Math.floor(ttlSeconds));
  const header = { alg: 'ES256', typ: 'CHS-SVC+JWT', kid: signingKey.kid };
  const payload = {
    iss: signingKey.spiffeId || signingKey.serviceId,
    sub: signingKey.serviceId,
    aud: audience,
    jti,
    iat,
    nbf: iat,
    exp,
    scopes: Array.isArray(scopes) ? scopes : [scopes],
    method: String(method).toUpperCase(),
    path: String(path),
  };
  if (includeRequestDigest) {
    payload.reqHash = computeRequestDigest({ method, path, body });
  }

  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key: signingKey.privateKeyPem, dsaEncoding: 'ieee-p1363' });

  return `${signingInput}.${toBase64Url(signature)}`;
}

/**
 * Signs a mutual server response proof so callers can verify the target service identity.
 */
export function signServerProof({
  signingKey,
  callerService,
  traceId,
  spanId,
  requestJti = null,
  ttlSeconds = 30,
  now = Date.now,
}) {
  if (!signingKey || !signingKey.privateKeyPem || !signingKey.kid || !signingKey.serviceId) {
    throw new TypeError('signServerProof requires signingKey with kid, serviceId, privateKeyPem');
  }
  const iat = Math.floor(now() / 1000);
  const header = { alg: 'ES256', typ: 'CHS-SRV-PROOF', kid: signingKey.kid };
  const payload = {
    sub: signingKey.serviceId,
    spiffeId: signingKey.spiffeId || null,
    caller: callerService || 'unknown',
    traceId: traceId || null,
    spanId: spanId || null,
    reqJti: requestJti,
    iat,
    exp: iat + ttlSeconds,
  };
  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key: signingKey.privateKeyPem, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${toBase64Url(signature)}`;
}

/**
 * Verifies a server proof header returned by an upstream service.
 */
export function verifyServerProof(
  proofToken,
  {
    keyring,
    expectedResponder,
    expectedCaller,
    expectedTraceId,
    expectedRequestJti,
    clockSkewSeconds = DEFAULT_CLOCK_SKEW_SECONDS,
    now = Date.now,
  }
) {
  if (!proofToken || typeof proofToken !== 'string') {
    return { valid: false, code: 'MESH_SERVER_PROOF_MISSING' };
  }
  const parts = proofToken.split('.');
  if (parts.length !== 3) {
    return { valid: false, code: 'MESH_SERVER_PROOF_MALFORMED' };
  }
  let header;
  let payload;
  try {
    header = JSON.parse(fromBase64Url(parts[0]).toString('utf8'));
    payload = JSON.parse(fromBase64Url(parts[1]).toString('utf8'));
  } catch {
    return { valid: false, code: 'MESH_SERVER_PROOF_MALFORMED' };
  }

  const keyEntry = keyring?.getKey(header.kid);
  if (!keyEntry) {
    return { valid: false, code: 'MESH_SERVER_KEY_UNKNOWN' };
  }
  if (keyEntry.status === KEY_STATUS.REVOKED) {
    return { valid: false, code: 'MESH_SERVER_KEY_REVOKED' };
  }

  const nowSec = Math.floor(now() / 1000);
  if (keyEntry.notAfter < nowSec - clockSkewSeconds) {
    return { valid: false, code: 'MESH_SERVER_KEY_EXPIRED' };
  }
  if (typeof payload.exp !== 'number' || payload.exp + clockSkewSeconds < nowSec) {
    return { valid: false, code: 'MESH_SERVER_PROOF_EXPIRED' };
  }
  if (expectedResponder && payload.sub !== expectedResponder) {
    return { valid: false, code: 'MESH_SERVER_IDENTITY_MISMATCH' };
  }
  if (expectedCaller && payload.caller !== expectedCaller) {
    return { valid: false, code: 'MESH_SERVER_CALLER_MISMATCH' };
  }
  if (expectedTraceId && payload.traceId !== expectedTraceId) {
    return { valid: false, code: 'MESH_SERVER_TRACE_MISMATCH' };
  }
  if (expectedRequestJti && payload.reqJti !== expectedRequestJti) {
    return { valid: false, code: 'MESH_SERVER_JTI_MISMATCH' };
  }

  const verifier = createVerify('SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const verified = verifier.verify(
    { key: keyEntry.publicKeyPem, dsaEncoding: 'ieee-p1363' },
    fromBase64Url(parts[2])
  );
  if (!verified) {
    return { valid: false, code: 'MESH_SERVER_PROOF_INVALID_SIGNATURE' };
  }

  return {
    valid: true,
    responderService: payload.sub,
    kid: header.kid,
    spiffeId: payload.spiffeId,
  };
}

/**
 * Parses an Envoy/Istio-style `x-forwarded-client-cert` (XFCC) header safely.
 * Example: `By=spiffe://cluster.local/ns/api/sa/target;Hash=abc;URI=spiffe://cluster.local/ns/api/sa/caller`
 */
export function parseXfccHeader(headerValue) {
  if (typeof headerValue !== 'string' || !headerValue.trim()) return null;
  const firstHop = headerValue.split(',')[0].trim();
  const fields = {};
  for (const segment of firstHop.split(';')) {
    const eqIdx = segment.indexOf('=');
    if (eqIdx === -1) continue;
    const key = segment.slice(0, eqIdx).trim().toLowerCase();
    const rawVal = segment.slice(eqIdx + 1).trim().replace(/^"|"$/g, '');
    if (rawVal) fields[key] = rawVal;
  }
  const spiffeId = fields.uri || fields.san || null;
  if (!spiffeId) return null;
  const saMatch = /\/sa\/([A-Za-z0-9._-]+)$/.exec(spiffeId);
  return {
    spiffeId,
    serviceId: saMatch ? saMatch[1] : spiffeId,
    certHash: fields.hash || null,
    by: fields.by || null,
    subject: fields.subject || null,
  };
}

/**
 * Verifies an incoming service-to-service request using either:
 *  - `app_mutual`: ES256 signed `x-service-assertion`
 *  - `mtls_header`: Proxy-attested `x-forwarded-client-cert` gated by trusted proxy secret
 */
export function verifyServiceRequest({
  headers = {},
  method = 'GET',
  path = '/',
  body = '',
  expectedAudience,
  requiredScopes = [],
  keyring,
  transportMode = MESH_TRANSPORT_MODES.AUTO,
  trustedProxySecret = null,
  isTrustedProxy = null,
  clockSkewSeconds = DEFAULT_CLOCK_SKEW_SECONDS,
  now = Date.now,
  enforceReplayProtection = true,
  verifyRequestDigest = false,
} = {}) {
  const assertion = readHeader(headers, 'x-service-assertion');
  const xfcc = readHeader(headers, 'x-forwarded-client-cert');

  const canUseMtlsHeader =
    transportMode === MESH_TRANSPORT_MODES.MTLS_HEADER ||
    (transportMode === MESH_TRANSPORT_MODES.AUTO && !assertion && Boolean(xfcc));

  if (canUseMtlsHeader) {
    if (!xfcc) {
      return { authenticated: false, code: 'MESH_MTLS_HEADER_MISSING', transport: 'mtls_header' };
    }
    const proxyAttestation = readHeader(headers, 'x-mesh-proxy-attestation');
    const proxyTrusted =
      typeof isTrustedProxy === 'function'
        ? Boolean(isTrustedProxy(headers))
        : Boolean(trustedProxySecret && safeTimingEqual(proxyAttestation || '', trustedProxySecret));

    if (!proxyTrusted) {
      return { authenticated: false, code: 'MESH_UNTRUSTED_PROXY', transport: 'mtls_header' };
    }

    const peer = parseXfccHeader(xfcc);
    if (!peer) {
      return { authenticated: false, code: 'MESH_MTLS_HEADER_MALFORMED', transport: 'mtls_header' };
    }

    // Check against keyring if entries exist for this peer service to ensure key/cert isn't revoked
    if (keyring) {
      const peerKeys = keyring.listKeys({ serviceId: peer.serviceId });
      const activeKeys = peerKeys.filter(
        (k) => k.status === KEY_STATUS.ACTIVE || k.status === KEY_STATUS.GRACE
      );
      if (peerKeys.length > 0 && activeKeys.length === 0) {
        return { authenticated: false, code: 'MESH_PEER_CERT_REVOKED', transport: 'mtls_header' };
      }
      if (peer.certHash && activeKeys.length > 0) {
        const hashMatches = activeKeys.some(
          (k) => k.fingerprint.toLowerCase() === peer.certHash.toLowerCase()
        );
        if (!hashMatches) {
          return {
            authenticated: false,
            code: 'MESH_PEER_CERT_HASH_MISMATCH',
            transport: 'mtls_header',
          };
        }
      }
    }

    return {
      authenticated: true,
      transport: 'mtls_header',
      principal: {
        serviceId: peer.serviceId,
        spiffeId: peer.spiffeId,
        scopes: ['internal:*'],
        authMethod: 'mtls_xfcc',
      },
    };
  }

  // Application-layer mutual authentication via signed service assertion
  if (!assertion || typeof assertion !== 'string') {
    return { authenticated: false, code: 'MESH_SERVICE_ASSERTION_MISSING', transport: 'app_mutual' };
  }

  const parts = assertion.trim().split('.');
  if (parts.length !== 3) {
    return {
      authenticated: false,
      code: 'MESH_SERVICE_ASSERTION_MALFORMED',
      transport: 'app_mutual',
    };
  }

  let header;
  let payload;
  try {
    header = JSON.parse(fromBase64Url(parts[0]).toString('utf8'));
    payload = JSON.parse(fromBase64Url(parts[1]).toString('utf8'));
  } catch {
    return {
      authenticated: false,
      code: 'MESH_SERVICE_ASSERTION_MALFORMED',
      transport: 'app_mutual',
    };
  }

  if (!header || header.alg !== 'ES256' || typeof header.kid !== 'string') {
    return { authenticated: false, code: 'MESH_UNSUPPORTED_ALGORITHM', transport: 'app_mutual' };
  }

  const keyEntry = keyring?.getKey(header.kid);
  if (!keyEntry) {
    return { authenticated: false, code: 'MESH_UNKNOWN_SIGNING_KEY', transport: 'app_mutual' };
  }
  if (keyEntry.status === KEY_STATUS.REVOKED) {
    return { authenticated: false, code: 'MESH_SIGNING_KEY_REVOKED', transport: 'app_mutual' };
  }
  if (keyEntry.status === KEY_STATUS.STAGING) {
    return { authenticated: false, code: 'MESH_SIGNING_KEY_NOT_ACTIVE', transport: 'app_mutual' };
  }

  const nowSec = Math.floor(now() / 1000);
  if (keyEntry.notBefore - clockSkewSeconds > nowSec) {
    return { authenticated: false, code: 'MESH_KEY_NOT_YET_VALID', transport: 'app_mutual' };
  }
  if (keyEntry.notAfter + clockSkewSeconds < nowSec) {
    return { authenticated: false, code: 'MESH_KEY_EXPIRED', transport: 'app_mutual' };
  }

  // Cryptographic signature verification first
  const verifier = createVerify('SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const signatureOk = verifier.verify(
    { key: keyEntry.publicKeyPem, dsaEncoding: 'ieee-p1363' },
    fromBase64Url(parts[2])
  );
  if (!signatureOk) {
    return { authenticated: false, code: 'MESH_INVALID_SIGNATURE', transport: 'app_mutual' };
  }

  if (!payload || typeof payload.sub !== 'string' || payload.sub !== keyEntry.serviceId) {
    return { authenticated: false, code: 'MESH_SUBJECT_MISMATCH', transport: 'app_mutual' };
  }

  if (typeof payload.exp !== 'number' || payload.exp + clockSkewSeconds < nowSec) {
    return { authenticated: false, code: 'MESH_ASSERTION_EXPIRED', transport: 'app_mutual' };
  }
  if (typeof payload.nbf === 'number' && payload.nbf - clockSkewSeconds > nowSec) {
    return { authenticated: false, code: 'MESH_ASSERTION_NOT_YET_VALID', transport: 'app_mutual' };
  }

  if (expectedAudience) {
    const allowedByKey =
      keyEntry.allowedAudiences.includes('*') || keyEntry.allowedAudiences.includes(expectedAudience);
    if (payload.aud !== expectedAudience || !allowedByKey) {
      return { authenticated: false, code: 'MESH_AUDIENCE_DENIED', transport: 'app_mutual' };
    }
  }

  const tokenScopes = Array.isArray(payload.scopes) ? payload.scopes : [];
  for (const required of requiredScopes) {
    const keyPermits =
      keyEntry.allowedScopes.includes('*') || keyEntry.allowedScopes.includes(required);
    const tokenPermits =
      tokenScopes.includes('*') ||
      tokenScopes.includes('internal:*') ||
      tokenScopes.includes(required);
    if (!keyPermits || !tokenPermits) {
      return { authenticated: false, code: 'MESH_INSUFFICIENT_SCOPE', transport: 'app_mutual' };
    }
  }

  if (verifyRequestDigest) {
    const expectedDigest = computeRequestDigest({ method, path, body });
    if (!payload.reqHash || !safeTimingEqual(payload.reqHash, expectedDigest)) {
      return { authenticated: false, code: 'MESH_REQUEST_DIGEST_MISMATCH', transport: 'app_mutual' };
    }
  }

  if (enforceReplayProtection) {
    if (typeof payload.jti !== 'string' || payload.jti.length < 8) {
      return { authenticated: false, code: 'MESH_MISSING_JTI', transport: 'app_mutual' };
    }
    const fresh = keyring.recordReplayNonce(payload.jti, payload.exp + clockSkewSeconds);
    if (!fresh) {
      return { authenticated: false, code: 'MESH_REPLAY_DETECTED', transport: 'app_mutual' };
    }
  }

  return {
    authenticated: true,
    transport: 'app_mutual',
    principal: {
      serviceId: payload.sub,
      spiffeId: payload.iss || keyEntry.spiffeId,
      kid: header.kid,
      jti: payload.jti || null,
      audience: payload.aud || null,
      scopes: tokenScopes,
      authMethod: 'ecdsa_p256_assertion',
    },
  };
}
