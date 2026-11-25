import { describe, it, expect } from 'vitest';
import {
  createServiceKeyring,
  generateServiceKeyPair,
  signServiceAssertion,
  verifyServiceRequest,
  createMeshServiceClient,
  createTelemetryCollector,
  BREAKER_STATES,
} from '../api/_lib/mesh/index.js';

describe('Service Mesh Concurrency, Load & Failure-Injection (Synthetic)', () => {
  it('handles concurrent key rotation and prevents parallel jti replay races', async () => {
    const k1 = generateServiceKeyPair({ serviceId: 'svc-concurrent', kid: 'conc-k1' });
    const k2 = generateServiceKeyPair({ serviceId: 'svc-concurrent', kid: 'conc-k2' });
    const keyring = createServiceKeyring({ initialKeys: [k1] });

    // Generate 20 unique tokens with k1 before rotation
    const preRotationTokens = Array.from({ length: 20 }, () =>
      signServiceAssertion({ signingKey: k1, audience: 'svc-gateway' })
    );

    // Concurrently rotate to k2 while verifying pre-rotation tokens and signing new k2 tokens
    const [preResults, postResults] = await Promise.all([
      Promise.all(
        preRotationTokens.map(async (tok, idx) => {
          if (idx === 5) keyring.rotateKey(k2);
          return verifyServiceRequest({
            headers: { 'x-service-assertion': tok },
            expectedAudience: 'svc-gateway',
            keyring,
          });
        })
      ),
      Promise.all(
        Array.from({ length: 20 }, async () => {
          const tok = signServiceAssertion({ signingKey: k2, audience: 'svc-gateway' });
          return verifyServiceRequest({
            headers: { 'x-service-assertion': tok },
            expectedAudience: 'svc-gateway',
            keyring,
          });
        })
      ),
    ]);

    expect(preResults.every((r) => r.authenticated)).toBe(true);
    expect(postResults.every((r) => r.authenticated)).toBe(true);

    // Concurrent replay of a single assertion: exactly 1 succeeds, 19 fail
    const replayedToken = signServiceAssertion({ signingKey: k2, audience: 'svc-gateway' });
    const replayResults = await Promise.all(
      Array.from({ length: 20 }, async () =>
        verifyServiceRequest({
          headers: { 'x-service-assertion': replayedToken },
          expectedAudience: 'svc-gateway',
          keyring,
        })
      )
    );
    const successes = replayResults.filter((r) => r.authenticated);
    const replayDenials = replayResults.filter((r) => r.code === 'MESH_REPLAY_DETECTED');
    expect(successes).toHaveLength(1);
    expect(replayDenials).toHaveLength(19);
  });

  it('isolates degraded dependencies under load, caps retry amplification, and recovers cleanly', async () => {
    let clock = 1_000_000;
    const now = () => clock;
    const telemetry = createTelemetryCollector({ maxEvents: 500, now });
    const callerKey = generateServiceKeyPair({ serviceId: 'svc-gateway', kid: 'gw-load-1', now });

    let degradeUpstreamA = true;
    let upstreamACalls = 0;
    let upstreamBCalls = 0;

    const client = createMeshServiceClient({
      callerServiceId: 'svc-gateway',
      signingKey: callerKey,
      telemetry,
      now,
      defaultPolicyOptions: {
        timeoutMs: 30,
        maxRetries: 2,
        baseBackoffMs: 1,
        maxBackoffMs: 5,
        retryBudgetRatio: 0.25,
        retryBudgetMinAllowance: 2,
        failureThreshold: 5,
        resetTimeoutMs: 5000,
        maxHalfOpenAttempts: 2,
        maxConcurrent: 5,
        sleep: async () => {},
      },
      fetchImpl: async (url, init) => {
        if (url.includes('upstream-a')) {
          upstreamACalls += 1;
          if (degradeUpstreamA) {
            if (upstreamACalls % 2 === 0) {
              // Simulate slow hang aborted by timeout
              return new Promise((_, reject) => {
                init.signal.addEventListener('abort', () => reject(new Error('aborted')));
              });
            }
            return { status: 503, body: { error: 'upstream_a_overloaded' } };
          }
          return { status: 200, body: { ok: true, service: 'upstream-a' } };
        }

        // Healthy upstream-b
        upstreamBCalls += 1;
        return { status: 200, body: { ok: true, service: 'upstream-b' } };
      },
    });

    // Phase 1: Synthetic burst (6 waves of 5 concurrent requests per dependency)
    // against degraded upstream-a (with bulkhead maxConcurrent: 5) and healthy upstream-b.
    const resultsA = [];
    const resultsB = [];
    for (let wave = 0; wave < 6; wave += 1) {
      const waveA = [];
      const waveB = [];
      for (let j = 0; j < 5; j += 1) {
        const i = wave * 5 + j;
        waveA.push(
          client.call({
            targetServiceId: 'upstream-a',
            url: `http://upstream-a.internal/check/${i}`,
            method: 'GET',
            fallback: (err) => ({ status: 200, body: { degraded: true, reason: err.code } }),
          })
        );
        waveB.push(
          client.call({
            targetServiceId: 'upstream-b',
            url: `http://upstream-b.internal/check/${i}`,
            method: 'GET',
          })
        );
      }
      const [wa, wb] = await Promise.all([Promise.all(waveA), Promise.all(waveB)]);
      resultsA.push(...wa);
      resultsB.push(...wb);
    }

    // Healthy dependency B is completely isolated and achieves 100% success
    expect(resultsB).toHaveLength(30);
    expect(resultsB.every((r) => r.response.status === 200 && !r.degraded)).toBe(true);
    expect(upstreamBCalls).toBe(30);

    // Degraded dependency A tripped OPEN, served fallbacks, and avoided unbounded retry amplification
    expect(client.getPolicySnapshot('upstream-a').state).toBe(BREAKER_STATES.OPEN);
    expect(resultsA.some((r) => r.degraded && r.errorCode === 'MESH_BREAKER_OPEN')).toBe(true);
    // Without circuit breaking + retry budget, 30 calls * 3 attempts = 90 upstream hits; isolation caps it sharply
    expect(upstreamACalls).toBeLessThan(25);

    // Phase 2: Fault heals and resetTimeoutMs elapses -> HALF_OPEN canary probes recover to CLOSED
    degradeUpstreamA = false;
    clock += 5001;

    const canary1 = await client.call({
      targetServiceId: 'upstream-a',
      url: 'http://upstream-a.internal/health',
      method: 'GET',
    });
    expect(canary1.response.status).toBe(200);
    expect(client.getPolicySnapshot('upstream-a').state).toBe(BREAKER_STATES.HALF_OPEN);

    const canary2 = await client.call({
      targetServiceId: 'upstream-a',
      url: 'http://upstream-a.internal/health',
      method: 'GET',
    });
    expect(canary2.response.status).toBe(200);
    expect(client.getPolicySnapshot('upstream-a').state).toBe(BREAKER_STATES.CLOSED);

    expect(telemetry.getCounters().totalSpans).toBeGreaterThanOrEqual(62);
  });
});
