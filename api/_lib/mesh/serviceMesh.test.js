/* global Buffer */
import { describe, it, expect } from 'vitest';
import { createSign, generateKeyPairSync, X509Certificate } from 'node:crypto';
import {
  parseTraceparent,
  formatTraceparent,
  extractOrCreateTraceContext,
  createChildSpanContext,
  injectTraceHeaders,
  scrubTelemetryPayload,
  createTelemetryCollector,
  KEY_STATUS,
  MESH_TRANSPORT_MODES,
  generateServiceKeyPair,
  createServiceKeyring,
  signServiceAssertion,
  signServerProof,
  verifyServerProof,
  parseXfccHeader,
  verifyServiceRequest,
  BREAKER_STATES,
  computeBackoffMs,
  createDependencyPolicy,
} from './index.js';

describe('traceContext', () => {
  it('parses valid W3C traceparent and rejects malformed or all-zero headers', () => {
    const valid = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    expect(parseTraceparent(valid)).toEqual({
      version: '00',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      traceFlags: '01',
    });

    expect(parseTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBeNull();
    expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01')).toBeNull();
    expect(parseTraceparent('ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBeNull();
    expect(parseTraceparent('invalid')).toBeNull();
  });

  it('chains child spans while preserving traceId and correlationId', () => {
    const parentTrace = '4bf92f3577b34da6a3ce929d0e0e4736';
    const parentSpan = '00f067aa0ba902b7';
    const incoming = extractOrCreateTraceContext({
      traceparent: `00-${parentTrace}-${parentSpan}-01`,
      'x-correlation-id': 'corr-synth-1234',
      'x-request-deadline-ms': '9999999999999',
    });

    expect(incoming.traceId).toBe(parentTrace);
    expect(incoming.parentSpanId).toBe(parentSpan);
    expect(incoming.spanId).not.toBe(parentSpan);
    expect(incoming.correlationId).toBe('corr-synth-1234');
    expect(incoming.inherited).toBe(true);

    const child = createChildSpanContext(incoming);
    expect(child.traceId).toBe(parentTrace);
    expect(child.parentSpanId).toBe(incoming.spanId);
    expect(child.spanId).not.toBe(incoming.spanId);

    const injected = injectTraceHeaders({}, child);
    expect(injected.traceparent).toBe(formatTraceparent(child));
    expect(injected['x-correlation-id']).toBe('corr-synth-1234');
    expect(injected['x-request-deadline-ms']).toBe('9999999999999');
  });

  it('scrubs citizen PII, PEM keys, and secrets and bounds telemetry buffer', () => {
    const scrubbed = scrubTelemetryPayload({
      note: 'Synthetic Aadhaar 2345 6789 0123 PAN ABCDE1234F phone 9876543210 email test@example.org',
      authorization: 'Bearer secret-token-value',
      privateKeyPem: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
      nested: { otp: '123456', safeField: 'service-a' },
    });

    expect(scrubbed.note).toContain('[REDACTED_AADHAAR]');
    expect(scrubbed.note).toContain('[REDACTED_PAN]');
    expect(scrubbed.note).toContain('[REDACTED_PHONE]');
    expect(scrubbed.note).toContain('[REDACTED_EMAIL]');
    expect(scrubbed.authorization).toBe('[REDACTED]');
    expect(scrubbed.privateKeyPem).toBe('[REDACTED]');
    expect(scrubbed.nested.otp).toBe('[REDACTED]');
    expect(scrubbed.nested.safeField).toBe('service-a');

    const collector = createTelemetryCollector({ maxEvents: 3, secret: 'synth-secret' });
    for (let i = 0; i < 5; i += 1) {
      collector.recordSpan({
        traceId: `trace-${i}`,
        spanId: `span-${i}`,
        route: `/api/internal/op?secret=bad`,
        endUserId: 'user_synth_99',
        authOutcome: 'allowed',
      });
    }
    const spans = collector.getSpans(10);
    expect(spans).toHaveLength(3);
    expect(spans[0].traceId).toBe('trace-2');
    expect(spans[0].route).toBe('/api/internal/op');
    expect(spans[0].endUserHash).toMatch(/^[0-9a-f]{64}$/);
    expect(collector.getCounters().totalSpans).toBe(5);
  });
});

describe('serviceIdentity & certificate/key rotation', () => {
  it('signs and verifies ECDSA-P256 service assertions with audience, scope, and replay protection', () => {
    let clock = 1_700_000_000_000;
    const now = () => clock;

    const callerKey = generateServiceKeyPair({ serviceId: 'svc-caller', kid: 'caller-k1', now });
    const keyring = createServiceKeyring({
      initialKeys: [
        {
          ...callerKey,
          allowedAudiences: ['svc-target'],
          allowedScopes: ['internal:read', 'internal:write'],
        },
      ],
      now,
    });

    const token = signServiceAssertion({
      signingKey: callerKey,
      audience: 'svc-target',
      scopes: ['internal:read'],
      method: 'POST',
      path: '/api/mesh-readiness',
      body: { ping: true },
      ttlSeconds: 30,
      now,
    });

    const ok = verifyServiceRequest({
      headers: { 'x-service-assertion': token },
      method: 'POST',
      path: '/api/mesh-readiness',
      body: { ping: true },
      expectedAudience: 'svc-target',
      requiredScopes: ['internal:read'],
      keyring,
      verifyRequestDigest: true,
      now,
    });

    expect(ok.authenticated).toBe(true);
    expect(ok.principal.serviceId).toBe('svc-caller');
    expect(ok.principal.kid).toBe('caller-k1');

    // Replay of the exact same token (same jti) must be rejected
    const replay = verifyServiceRequest({
      headers: { 'x-service-assertion': token },
      expectedAudience: 'svc-target',
      keyring,
      now,
    });
    expect(replay.authenticated).toBe(false);
    expect(replay.code).toBe('MESH_REPLAY_DETECTED');

    // Tampered body fails request digest check
    const freshToken = signServiceAssertion({
      signingKey: callerKey,
      audience: 'svc-target',
      scopes: ['internal:read'],
      method: 'POST',
      path: '/api/mesh-readiness',
      body: { ping: true },
      now,
    });
    const tampered = verifyServiceRequest({
      headers: { 'x-service-assertion': freshToken },
      method: 'POST',
      path: '/api/mesh-readiness',
      body: { ping: false },
      expectedAudience: 'svc-target',
      keyring,
      verifyRequestDigest: true,
      now,
    });
    expect(tampered.authenticated).toBe(false);
    expect(tampered.code).toBe('MESH_REQUEST_DIGEST_MISMATCH');

    // Audience and scope checks
    const wrongAud = verifyServiceRequest({
      headers: {
        'x-service-assertion': signServiceAssertion({
          signingKey: callerKey,
          audience: 'svc-other',
          now,
        }),
      },
      expectedAudience: 'svc-target',
      keyring,
      now,
    });
    expect(wrongAud.code).toBe('MESH_AUDIENCE_DENIED');

    const insufficientScope = verifyServiceRequest({
      headers: {
        'x-service-assertion': signServiceAssertion({
          signingKey: callerKey,
          audience: 'svc-target',
          scopes: ['internal:read'],
          now,
        }),
      },
      expectedAudience: 'svc-target',
      requiredScopes: ['internal:admin'],
      keyring,
      now,
    });
    expect(insufficientScope.code).toBe('MESH_INSUFFICIENT_SCOPE');

    // Expiry beyond clock skew fails
    const expiringToken = signServiceAssertion({
      signingKey: callerKey,
      audience: 'svc-target',
      ttlSeconds: 10,
      now,
    });
    clock += 100_000; // +100s (> 10s + 30s skew)
    const expired = verifyServiceRequest({
      headers: { 'x-service-assertion': expiringToken },
      expectedAudience: 'svc-target',
      keyring,
      now,
    });
    expect(expired.code).toBe('MESH_ASSERTION_EXPIRED');
  });

  it('supports overlapping key rotation (active -> grace) and immediate revocation', () => {
    let clock = 1_700_000_000_000;
    const now = () => clock;

    const k1 = generateServiceKeyPair({ serviceId: 'svc-worker', kid: 'worker-k1', ttlMs: 60_000, now });
    const k2 = generateServiceKeyPair({ serviceId: 'svc-worker', kid: 'worker-k2', ttlMs: 120_000, now });

    const keyring = createServiceKeyring({ initialKeys: [k1], now });
    const inFlightOldToken = signServiceAssertion({ signingKey: k1, audience: 'svc-api', now });

    // Rotate to k2 -> k1 moves to grace
    keyring.rotateKey(k2);
    expect(keyring.getKey('worker-k1').status).toBe(KEY_STATUS.GRACE);
    expect(keyring.getKey('worker-k2').status).toBe(KEY_STATUS.ACTIVE);

    // Both grace key (in-flight) and active key succeed during overlap window
    expect(
      verifyServiceRequest({
        headers: { 'x-service-assertion': inFlightOldToken },
        expectedAudience: 'svc-api',
        keyring,
        now,
      }).authenticated
    ).toBe(true);

    const newToken = signServiceAssertion({ signingKey: k2, audience: 'svc-api', now });
    expect(
      verifyServiceRequest({
        headers: { 'x-service-assertion': newToken },
        expectedAudience: 'svc-api',
        keyring,
        now,
      }).authenticated
    ).toBe(true);

    // Revoking k1 immediately rejects any token signed by k1
    keyring.revokeKey('worker-k1', 'compromised');
    const postRevoke = verifyServiceRequest({
      headers: {
        'x-service-assertion': signServiceAssertion({ signingKey: k1, audience: 'svc-api', now }),
      },
      expectedAudience: 'svc-api',
      keyring,
      now,
    });
    expect(postRevoke.authenticated).toBe(false);
    expect(postRevoke.code).toBe('MESH_SIGNING_KEY_REVOKED');
  });

  it('verifies mTLS XFCC headers only with trusted proxy attestation and supports mutual server proof', () => {
    const serverKey = generateServiceKeyPair({ serviceId: 'svc-target', kid: 'target-k1' });
    const peerKey = generateServiceKeyPair({ serviceId: 'svc-caller', kid: 'caller-k1' });
    const keyring = createServiceKeyring({ initialKeys: [serverKey, peerKey] });

    const xfcc = `By=spiffe://civic-help-setu.internal/ns/api/sa/svc-target;Hash=${peerKey.fingerprint};URI=spiffe://civic-help-setu.internal/ns/api/sa/svc-caller`;
    expect(parseXfccHeader(xfcc)?.serviceId).toBe('svc-caller');

    // Spoofed XFCC without proxy attestation is rejected
    const spoofed = verifyServiceRequest({
      headers: { 'x-forwarded-client-cert': xfcc },
      transportMode: MESH_TRANSPORT_MODES.MTLS_HEADER,
      trustedProxySecret: 'proxy-secret-xyz',
      keyring,
    });
    expect(spoofed.authenticated).toBe(false);
    expect(spoofed.code).toBe('MESH_UNTRUSTED_PROXY');

    // Valid XFCC with proxy attestation succeeds
    const validMtls = verifyServiceRequest({
      headers: {
        'x-forwarded-client-cert': xfcc,
        'x-mesh-proxy-attestation': 'proxy-secret-xyz',
      },
      transportMode: MESH_TRANSPORT_MODES.MTLS_HEADER,
      trustedProxySecret: 'proxy-secret-xyz',
      keyring,
    });
    expect(validMtls.authenticated).toBe(true);
    expect(validMtls.principal.serviceId).toBe('svc-caller');
    expect(validMtls.principal.authMethod).toBe('mtls_xfcc');

    // Mutual server proof sign + verify
    const proof = signServerProof({
      signingKey: serverKey,
      callerService: 'svc-caller',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      requestJti: 'jti-12345678',
    });
    const verifiedProof = verifyServerProof(proof, {
      keyring,
      expectedResponder: 'svc-target',
      expectedCaller: 'svc-caller',
      expectedTraceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      expectedRequestJti: 'jti-12345678',
    });
    expect(verifiedProof.valid).toBe(true);
    expect(verifiedProof.responderService).toBe('svc-target');
  });

  it('parses X.509 PEM certificates, extracts SPIFFE SAN + fingerprint, and rotates certificates', () => {
    const derLen = (len) => {
      if (len < 0x80) return Buffer.from([len]);
      const bytes = [];
      let n = len;
      while (n > 0) {
        bytes.unshift(n & 0xff);
        n >>= 8;
      }
      return Buffer.from([0x80 | bytes.length, ...bytes]);
    };
    const derTag = (tag, body) => Buffer.concat([Buffer.from([tag]), derLen(body.length), body]);
    const derSeq = (...items) => derTag(0x30, Buffer.concat(items));
    const derInt = (num) => {
      const buf = Buffer.from(num.toString(16).padStart(2, '0'), 'hex');
      return derTag(0x02, buf[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), buf]) : buf);
    };
    const derOid = (bytes) => derTag(0x06, Buffer.from(bytes));
    const derUtc = (date) => {
      const iso = date.toISOString().replace(/[-:T]/g, '').slice(2, 14) + 'Z';
      return derTag(0x17, Buffer.from(iso, 'ascii'));
    };

    const buildSelfSignedCert = (spiffeUri, serial) => {
      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
      const ecdsaSha256Alg = derSeq(derOid([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]));
      const cnAttr = derTag(
        0x31,
        derSeq(derOid([0x55, 0x04, 0x03]), derTag(0x0c, Buffer.from('svc-cert-peer', 'utf8')))
      );
      const name = derSeq(cnAttr);
      const validity = derSeq(derUtc(new Date(Date.now() - 60_000)), derUtc(new Date(Date.now() + 3600_000)));
      const sanValue = derSeq(derTag(0x86, Buffer.from(spiffeUri, 'ascii')));
      const sanExt = derSeq(derOid([0x55, 0x1d, 0x11]), derTag(0x04, sanValue));
      const exts = derTag(0xa3, derSeq(sanExt));

      const tbs = derSeq(
        derTag(0xa0, derInt(2)), // v3
        derInt(serial),
        ecdsaSha256Alg,
        name,
        validity,
        name,
        spkiDer,
        exts
      );
      const signer = createSign('SHA256');
      signer.update(tbs);
      signer.end();
      const sig = signer.sign(privateKey);
      const certDer = derSeq(tbs, ecdsaSha256Alg, derTag(0x03, Buffer.concat([Buffer.from([0x00]), sig])));
      const b64 = certDer.toString('base64').match(/.{1,64}/g).join('\n');
      const certificatePem = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----`;
      return {
        certificatePem,
        privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      };
    };

    const spiffe = 'spiffe://civic-help-setu.internal/ns/api/sa/svc-cert-peer';
    const c1 = buildSelfSignedCert(spiffe, 101);
    const c2 = buildSelfSignedCert(spiffe, 102);
    const x509_1 = new X509Certificate(c1.certificatePem);
    const expectedFp1 = x509_1.fingerprint256.replace(/:/g, '').toLowerCase();

    const keyring = createServiceKeyring({
      initialKeys: [{ kid: 'cert-1', serviceId: 'svc-cert-peer', certificatePem: c1.certificatePem }],
    });
    const entry1 = keyring.getKey('cert-1');
    expect(entry1.hasCertificate).toBe(true);
    expect(entry1.spiffeId).toBe(spiffe);
    expect(entry1.fingerprint).toBe(expectedFp1);

    // XFCC using cert-1 fingerprint succeeds, then rotates to cert-2
    const xfcc1 = `By=spiffe://civic-help-setu.internal/ns/api/sa/gateway;Hash=${expectedFp1};URI=${spiffe}`;
    expect(
      verifyServiceRequest({
        headers: { 'x-forwarded-client-cert': xfcc1, 'x-mesh-proxy-attestation': 'mesh-proxy-sec' },
        transportMode: MESH_TRANSPORT_MODES.MTLS_HEADER,
        trustedProxySecret: 'mesh-proxy-sec',
        keyring,
      }).authenticated
    ).toBe(true);

    keyring.rotateKey({ kid: 'cert-2', serviceId: 'svc-cert-peer', certificatePem: c2.certificatePem });
    expect(keyring.getKey('cert-1').status).toBe(KEY_STATUS.GRACE);
    expect(keyring.getKey('cert-2').status).toBe(KEY_STATUS.ACTIVE);

    // Also verifies assertion signed by c2 private key
    const c2Token = signServiceAssertion({
      signingKey: { kid: 'cert-2', serviceId: 'svc-cert-peer', privateKeyPem: c2.privateKeyPem },
      audience: 'gateway',
    });
    expect(
      verifyServiceRequest({
        headers: { 'x-service-assertion': c2Token },
        expectedAudience: 'gateway',
        keyring,
      }).authenticated
    ).toBe(true);
  });
});

describe('resilience policy', () => {
  it('computes bounded jittered exponential backoff', () => {
    const low = computeBackoffMs(2, { baseBackoffMs: 50, maxBackoffMs: 500, jitterFactor: 0.5, random: () => 0 });
    const high = computeBackoffMs(2, { baseBackoffMs: 50, maxBackoffMs: 500, jitterFactor: 0.5, random: () => 1 });
    expect(low).toBe(100); // 200 - 100
    expect(high).toBe(300); // 200 + 100
  });

  it('transitions circuit breaker CLOSED -> OPEN -> HALF_OPEN -> CLOSED and isolates 4xx errors', async () => {
    let clock = 1000;
    const policy = createDependencyPolicy('svc-downstream', {
      failureThreshold: 3,
      resetTimeoutMs: 5000,
      maxHalfOpenAttempts: 2,
      maxRetries: 0,
      now: () => clock,
      sleep: async () => {},
    });

    // 4xx client errors do NOT trip the circuit breaker
    for (let i = 0; i < 4; i += 1) {
      await expect(
        policy.execute(async () => {
          const err = new Error('Bad Request');
          err.status = 400;
          throw err;
        })
      ).rejects.toThrow('Bad Request');
    }
    expect(policy.getState()).toBe(BREAKER_STATES.CLOSED);

    // 3 consecutive 503 failures trip the breaker OPEN
    for (let i = 0; i < 3; i += 1) {
      const res = await policy.execute(async () => ({ status: 503, body: { error: 'down' } }));
      expect(res.result.status).toBe(503);
    }
    expect(policy.getState()).toBe(BREAKER_STATES.OPEN);

    // Immediate call while OPEN fails fast with MESH_BREAKER_OPEN
    await expect(policy.execute(async () => ({ status: 200 }))).rejects.toMatchObject({
      code: 'MESH_BREAKER_OPEN',
    });

    // Advance past resetTimeoutMs -> HALF_OPEN canary probe fails -> re-opens
    clock += 5001;
    await expect(
      policy.execute(async () => {
        const err = new Error('Still down');
        err.status = 503;
        throw err;
      })
    ).rejects.toThrow('Still down');
    expect(policy.getState()).toBe(BREAKER_STATES.OPEN);

    // Advance again -> 2 canary successes restore CLOSED
    clock += 5001;
    await policy.execute(async () => ({ status: 200 }));
    expect(policy.getState()).toBe(BREAKER_STATES.HALF_OPEN);
    await policy.execute(async () => ({ status: 200 }));
    expect(policy.getState()).toBe(BREAKER_STATES.CLOSED);
  });

  it('aborts slow calls on timeout and enforces bulkhead concurrency limit', async () => {
    const policy = createDependencyPolicy('svc-slow', {
      timeoutMs: 25,
      maxRetries: 1,
      baseBackoffMs: 1,
      maxConcurrent: 2,
      sleep: async () => {},
    });

    let callCount = 0;
    await expect(
      policy.execute(
        ({ signal }) =>
          new Promise((resolve, reject) => {
            callCount += 1;
            signal.addEventListener('abort', () => reject(new Error('aborted')));
          }),
        { idempotent: true }
      )
    ).rejects.toMatchObject({ code: 'MESH_TIMEOUT' });
    expect(callCount).toBe(2); // Initial attempt + 1 retry

    // Bulkhead: 2 in-flight calls hold slots, 3rd rejects immediately
    let releaseFirst;
    let releaseSecond;
    const p1 = policy.execute(() => new Promise((r) => { releaseFirst = () => r({ status: 200 }); }), { timeoutMs: 2000 });
    const p2 = policy.execute(() => new Promise((r) => { releaseSecond = () => r({ status: 200 }); }), { timeoutMs: 2000 });

    await expect(policy.execute(async () => ({ status: 200 }))).rejects.toMatchObject({
      code: 'MESH_BULKHEAD_REJECTED',
    });

    releaseFirst();
    releaseSecond();
    await Promise.all([p1, p2]);
  });
});
