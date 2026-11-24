/**
 * api/_lib/mesh/resilience.js
 *
 * Per-dependency failure isolation (circuit breakers + bulkheads), bounded
 * retries with exponential backoff & jitter, deadline/AbortController timeouts,
 * and authenticated internal service client (#1276).
 *
 * Reuses BREAKER_STATES from src/services/incidentResponse/civicAgentIncidentResponseService.js
 * and trace/identity helpers from ./traceContext.js and ./serviceIdentity.js.
 */

import { randomUUID } from 'node:crypto';
import { BREAKER_STATES } from '../../../src/services/incidentResponse/civicAgentIncidentResponseService.js';
import { createChildSpanContext, injectTraceHeaders } from './traceContext.js';
import { signServiceAssertion, verifyServerProof } from './serviceIdentity.js';

export { BREAKER_STATES };

export const DEFAULT_RESILIENCE_CONFIG = Object.freeze({
  timeoutMs: 3000,
  maxRetries: 2,
  baseBackoffMs: 50,
  maxBackoffMs: 1000,
  jitterFactor: 0.5,
  retryBudgetRatio: 0.25,
  retryBudgetMinAllowance: 3,
  failureThreshold: 5,
  errorRateThresholdPercent: 50,
  minWindowRequests: 6,
  windowDurationMs: 60_000,
  resetTimeoutMs: 15_000,
  maxHalfOpenAttempts: 2,
  maxConcurrent: 32,
});

const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

export class MeshResilienceError extends Error {
  constructor(message, code, { status = 503, retryable = false, dependency = null } = {}) {
    super(message);
    this.name = 'MeshResilienceError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.dependency = dependency;
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Computes exponential backoff with jitter clamped to [0, maxBackoffMs].
 */
export function computeBackoffMs(
  attemptIndex,
  {
    baseBackoffMs = DEFAULT_RESILIENCE_CONFIG.baseBackoffMs,
    maxBackoffMs = DEFAULT_RESILIENCE_CONFIG.maxBackoffMs,
    jitterFactor = DEFAULT_RESILIENCE_CONFIG.jitterFactor,
    random = Math.random,
  } = {}
) {
  const exp = Math.min(maxBackoffMs, baseBackoffMs * Math.pow(2, Math.max(0, attemptIndex)));
  const jitterRange = exp * Math.max(0, Math.min(1, jitterFactor));
  const jitter = (random() * 2 - 1) * jitterRange;
  return Math.max(0, Math.round(Math.min(maxBackoffMs, exp + jitter)));
}

/**
 * Per-dependency isolation policy combining:
 *  - Circuit breaker (CLOSED / OPEN / HALF_OPEN)
 *  - Concurrency bulkhead (maxConcurrent)
 *  - Bounded retry budget & exponential backoff
 *  - Deadline-aware AbortController timeout
 */
export function createDependencyPolicy(dependencyId, options = {}) {
  if (!dependencyId || typeof dependencyId !== 'string') {
    throw new TypeError('createDependencyPolicy requires dependencyId');
  }

  const config = { ...DEFAULT_RESILIENCE_CONFIG, ...options };
  const now = config.now || Date.now;
  const random = config.random || Math.random;
  const sleep = config.sleep || defaultSleep;

  let state = BREAKER_STATES.CLOSED;
  let consecutiveFailures = 0;
  let lastStateChangeAt = now();
  let openedAt = null;
  let halfOpenInFlight = 0;
  let halfOpenSuccesses = 0;
  let activeCalls = 0;
  let peakActiveCalls = 0;
  const recentOutcomes = []; // { at, ok, retried }

  function pruneWindow(at) {
    const cutoff = at - config.windowDurationMs;
    while (recentOutcomes.length > 0 && recentOutcomes[0].at < cutoff) {
      recentOutcomes.shift();
    }
  }

  function transition(nextState, at) {
    state = nextState;
    lastStateChangeAt = at;
    if (nextState === BREAKER_STATES.OPEN) {
      openedAt = at;
      halfOpenInFlight = 0;
      halfOpenSuccesses = 0;
    } else if (nextState === BREAKER_STATES.HALF_OPEN) {
      halfOpenInFlight = 0;
      halfOpenSuccesses = 0;
    } else {
      openedAt = null;
      consecutiveFailures = 0;
      halfOpenInFlight = 0;
      halfOpenSuccesses = 0;
    }
  }

  function canAcquireBreakerSlot(at) {
    if (state === BREAKER_STATES.CLOSED) return { allowed: true, isCanary: false };

    if (state === BREAKER_STATES.OPEN) {
      if (openedAt !== null && at - openedAt >= config.resetTimeoutMs) {
        transition(BREAKER_STATES.HALF_OPEN, at);
      } else {
        return { allowed: false, code: 'MESH_BREAKER_OPEN' };
      }
    }

    // HALF_OPEN
    if (halfOpenInFlight >= config.maxHalfOpenAttempts) {
      return { allowed: false, code: 'MESH_BREAKER_HALF_OPEN_SATURATED' };
    }
    halfOpenInFlight += 1;
    return { allowed: true, isCanary: true };
  }

  function recordOutcome({ ok, isCanary = false, retried = false }, at = now()) {
    pruneWindow(at);
    recentOutcomes.push({ at, ok, retried });

    if (isCanary) {
      halfOpenInFlight = Math.max(0, halfOpenInFlight - 1);
      if (state !== BREAKER_STATES.HALF_OPEN) {
        return;
      }
      if (ok) {
        halfOpenSuccesses += 1;
        if (halfOpenSuccesses >= config.maxHalfOpenAttempts) {
          transition(BREAKER_STATES.CLOSED, at);
        }
      } else {
        transition(BREAKER_STATES.OPEN, at);
      }
      return;
    }

    if (ok) {
      consecutiveFailures = 0;
      return;
    }

    consecutiveFailures += 1;
    if (consecutiveFailures >= config.failureThreshold) {
      transition(BREAKER_STATES.OPEN, at);
      return;
    }

    if (recentOutcomes.length >= config.minWindowRequests) {
      const failures = recentOutcomes.filter((o) => !o.ok).length;
      const errorRate = (failures / recentOutcomes.length) * 100;
      if (errorRate >= config.errorRateThresholdPercent) {
        transition(BREAKER_STATES.OPEN, at);
      }
    }
  }

  function canRetry(at = now()) {
    pruneWindow(at);
    const total = recentOutcomes.length;
    const retriesInWindow = recentOutcomes.filter((o) => o.retried).length;
    const budgetCap = Math.max(
      config.retryBudgetMinAllowance,
      Math.floor(total * config.retryBudgetRatio)
    );
    return retriesInWindow < budgetCap;
  }

  function isRetryableError(err) {
    if (!err) return false;
    if (err.code === 'MESH_TIMEOUT' || err.name === 'AbortError') return true;
    if (err.retryable === true) return true;
    if (err.status && RETRYABLE_HTTP_STATUSES.has(err.status)) return true;
    return false;
  }

  /**
   * Executes `fn({ attempt, signal, timeoutMs })` under bulkhead, breaker, timeout, and retry guards.
   */
  async function execute(fn, { idempotent = false, deadlineMs = null, timeoutMs } = {}) {
    const startAt = now();
    const slot = canAcquireBreakerSlot(startAt);
    if (!slot.allowed) {
      throw new MeshResilienceError(
        `Dependency "${dependencyId}" circuit breaker is ${state}`,
        slot.code,
        { status: 503, retryable: false, dependency: dependencyId }
      );
    }

    if (activeCalls >= config.maxConcurrent) {
      if (slot.isCanary) halfOpenInFlight = Math.max(0, halfOpenInFlight - 1);
      throw new MeshResilienceError(
        `Dependency "${dependencyId}" bulkhead saturated (${activeCalls}/${config.maxConcurrent})`,
        'MESH_BULKHEAD_REJECTED',
        { status: 503, retryable: true, dependency: dependencyId }
      );
    }

    activeCalls += 1;
    if (activeCalls > peakActiveCalls) peakActiveCalls = activeCalls;

    const maxAttempts = idempotent && !slot.isCanary ? 1 + config.maxRetries : 1;
    let attempt = 0;
    let lastError = null;

    try {
      while (attempt < maxAttempts) {
        attempt += 1;
        const attemptAt = now();
        const remainingDeadline =
          Number.isFinite(deadlineMs) && deadlineMs > 0 ? deadlineMs - attemptAt : Infinity;
        if (remainingDeadline <= 0) {
          throw new MeshResilienceError(
            `Request deadline exceeded before calling "${dependencyId}"`,
            'MESH_DEADLINE_EXCEEDED',
            { status: 504, retryable: false, dependency: dependencyId }
          );
        }

        const effectiveTimeoutMs = Math.max(
          1,
          Math.min(timeoutMs || config.timeoutMs, remainingDeadline)
        );
        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, effectiveTimeoutMs);

        try {
          const result = await fn({
            attempt,
            signal: controller.signal,
            timeoutMs: effectiveTimeoutMs,
          });
          clearTimeout(timer);

          // Treat HTTP-like 5xx responses returned as objects as dependency failures
          if (result && typeof result.status === 'number' && result.status >= 500) {
            const httpErr = new MeshResilienceError(
              `Dependency "${dependencyId}" returned HTTP ${result.status}`,
              'MESH_UPSTREAM_5XX',
              {
                status: result.status,
                retryable: RETRYABLE_HTTP_STATUSES.has(result.status),
                dependency: dependencyId,
              }
            );
            httpErr.response = result;
            throw httpErr;
          }

          recordOutcome({ ok: true, isCanary: slot.isCanary, retried: attempt > 1 }, now());
          return { result, attempts: attempt, breakerState: state };
        } catch (err) {
          clearTimeout(timer);
          const normalizedErr = timedOut
            ? new MeshResilienceError(
                `Dependency "${dependencyId}" timed out after ${effectiveTimeoutMs}ms`,
                'MESH_TIMEOUT',
                { status: 504, retryable: true, dependency: dependencyId }
              )
            : err;

          lastError = normalizedErr;
          const shouldRetry =
            attempt < maxAttempts &&
            isRetryableError(normalizedErr) &&
            canRetry(now());

          if (!shouldRetry) {
            // 4xx client errors shouldn't trip upstream circuit breakers
            const countsAsDependencyFailure =
              !(normalizedErr.status && normalizedErr.status >= 400 && normalizedErr.status < 500);
            recordOutcome(
              {
                ok: !countsAsDependencyFailure,
                isCanary: slot.isCanary,
                retried: attempt > 1,
              },
              now()
            );
            if (normalizedErr.response) {
              return {
                result: normalizedErr.response,
                attempts: attempt,
                breakerState: state,
                degraded: true,
              };
            }
            if (normalizedErr && typeof normalizedErr === 'object') {
              normalizedErr.attempts = attempt;
            }
            throw normalizedErr;
          }

          const delay = computeBackoffMs(attempt - 1, {
            baseBackoffMs: config.baseBackoffMs,
            maxBackoffMs: config.maxBackoffMs,
            jitterFactor: config.jitterFactor,
            random,
          });
          if (delay > 0) await sleep(delay);
        }
      }

      if (lastError && typeof lastError === 'object') {
        lastError.attempts = attempt;
      }
      throw lastError;
    } finally {
      activeCalls = Math.max(0, activeCalls - 1);
    }
  }

  function snapshot() {
    pruneWindow(now());
    const failures = recentOutcomes.filter((o) => !o.ok).length;
    return {
      dependencyId,
      state,
      consecutiveFailures,
      activeCalls,
      peakActiveCalls,
      maxConcurrent: config.maxConcurrent,
      windowCount: recentOutcomes.length,
      windowFailureCount: failures,
      lastStateChangeAt,
      openedAt,
    };
  }

  function reset() {
    transition(BREAKER_STATES.CLOSED, now());
    recentOutcomes.length = 0;
    activeCalls = 0;
    peakActiveCalls = 0;
  }

  return {
    dependencyId,
    execute,
    snapshot,
    reset,
    getState: () => state,
  };
}

/**
 * Authenticated, trace-propagating, resilient internal service client.
 */
export function createMeshServiceClient({
  callerServiceId,
  signingKey = null,
  keyring = null,
  fetchImpl = globalThis.fetch,
  telemetry = null,
  defaultPolicyOptions = {},
  requireServerProof = false,
  clockSkewSeconds = 30,
  now = Date.now,
} = {}) {
  if (!callerServiceId || typeof callerServiceId !== 'string') {
    throw new TypeError('createMeshServiceClient requires callerServiceId');
  }
  const policies = new Map();

  function getPolicy(targetServiceId, overrideOptions) {
    if (!policies.has(targetServiceId)) {
      policies.set(
        targetServiceId,
        createDependencyPolicy(targetServiceId, {
          ...defaultPolicyOptions,
          ...overrideOptions,
          now,
        })
      );
    }
    return policies.get(targetServiceId);
  }

  async function call({
    targetServiceId,
    url,
    method = 'GET',
    headers = {},
    body = undefined,
    scopes = ['internal:read'],
    parentTraceContext = null,
    idempotencyKey = null,
    timeoutMs = undefined,
    deadlineMs = undefined,
    policyOptions = undefined,
    fallback = null,
  }) {
    if (typeof fetchImpl !== 'function') {
      throw new MeshResilienceError('No fetch implementation configured', 'MESH_NO_FETCH', {
        status: 500,
      });
    }
    const policy = getPolicy(targetServiceId, policyOptions);
    const spanCtx = createChildSpanContext(parentTraceContext, { now });
    const upperMethod = String(method).toUpperCase();
    const isIdempotent =
      IDEMPOTENT_METHODS.has(upperMethod) ||
      Boolean(idempotencyKey || headers['x-idempotency-key']);

    const effectiveDeadline =
      deadlineMs ??
      spanCtx.deadlineMs ??
      (timeoutMs ? now() + timeoutMs : null);

    let parsedPath = url;
    try {
      const u = new URL(url, 'http://internal.mesh');
      parsedPath = `${u.pathname}${u.search}`;
    } catch {
      parsedPath = String(url);
    }

    const startAt = now();

    try {
      const outcome = await policy.execute(
        async ({ signal }) => {
          const jti = randomUUID();
          const outboundHeaders = injectTraceHeaders(headers, spanCtx, {
            deadlineMs: effectiveDeadline,
          });
          if (idempotencyKey) {
            outboundHeaders['x-idempotency-key'] = idempotencyKey;
          }
          if (signingKey) {
            outboundHeaders['x-service-assertion'] = signServiceAssertion({
              signingKey,
              audience: targetServiceId,
              scopes,
              method: upperMethod,
              path: parsedPath,
              body: body ?? '',
              jti,
              now,
            });
          }

          const res = await fetchImpl(url, {
            method: upperMethod,
            headers: outboundHeaders,
            body: body === undefined || typeof body === 'string' ? body : JSON.stringify(body),
            signal,
          });

          if (requireServerProof && keyring && res.status < 500) {
            const proof =
              typeof res.headers?.get === 'function'
                ? res.headers.get('x-service-server-proof')
                : res.headers?.['x-service-server-proof'];
            const verified = verifyServerProof(proof, {
              keyring,
              expectedResponder: targetServiceId,
              expectedCaller: callerServiceId,
              expectedTraceId: spanCtx.traceId,
              expectedRequestJti: jti,
              clockSkewSeconds,
              now,
            });
            if (!verified.valid) {
              throw new MeshResilienceError(
                `Target "${targetServiceId}" failed mutual server proof verification (${verified.code})`,
                verified.code,
                { status: 502, retryable: false, dependency: targetServiceId }
              );
            }
          }

          return res;
        },
        {
          idempotent: isIdempotent,
          deadlineMs: effectiveDeadline,
          timeoutMs,
        }
      );

      telemetry?.recordSpan({
        traceId: spanCtx.traceId,
        spanId: spanCtx.spanId,
        parentSpanId: spanCtx.parentSpanId,
        correlationId: spanCtx.correlationId,
        callerService: callerServiceId,
        targetService: targetServiceId,
        route: parsedPath,
        method: upperMethod,
        authMode: signingKey ? 'app_mutual' : 'none',
        authOutcome: 'outbound_signed',
        breakerState: outcome.breakerState,
        attempts: outcome.attempts,
        durationMs: now() - startAt,
        status: outcome.result?.status ?? 200,
        errorCode: outcome.degraded ? 'MESH_UPSTREAM_5XX' : null,
      });

      return {
        response: outcome.result,
        attempts: outcome.attempts,
        breakerState: outcome.breakerState,
        traceContext: spanCtx,
        degraded: Boolean(outcome.degraded),
      };
    } catch (err) {
      telemetry?.recordSpan({
        traceId: spanCtx.traceId,
        spanId: spanCtx.spanId,
        parentSpanId: spanCtx.parentSpanId,
        correlationId: spanCtx.correlationId,
        callerService: callerServiceId,
        targetService: targetServiceId,
        route: parsedPath,
        method: upperMethod,
        authMode: signingKey ? 'app_mutual' : 'none',
        authOutcome: 'outbound_failed',
        breakerState: policy.getState(),
        attempts: Number.isFinite(err?.attempts) ? err.attempts : 1,
        durationMs: now() - startAt,
        status: err.status || 503,
        errorCode: err.code || 'MESH_CALL_FAILED',
      });

      if (typeof fallback === 'function') {
        return {
          response: await fallback(err, spanCtx),
          attempts: 1,
          breakerState: policy.getState(),
          traceContext: spanCtx,
          degraded: true,
          errorCode: err.code,
        };
      }
      throw err;
    }
  }

  return {
    call,
    getPolicySnapshot: (targetServiceId) => policies.get(targetServiceId)?.snapshot() || null,
    listPolicySnapshots: () => [...policies.values()].map((p) => p.snapshot()),
    resetPolicy: (targetServiceId) => policies.get(targetServiceId)?.reset(),
  };
}
