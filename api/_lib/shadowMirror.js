/**
 * api/_lib/shadowMirror.js
 *
 * Deterministic Request Replay & Shadow-Traffic Mirroring Harness (#1463).
 *
 * Mirrors sampled, read-only (or explicitly allowlisted idempotent) requests to
 * a canary handler asynchronously without adding latency or failure risk to the
 * primary citizen response. Diffs are scrubbed via `scrubPii` (api/_lib/piiScrubber.js).
 */

import { scrubPii } from './piiScrubber.js';

const DEFAULT_SAFE_METHODS = Object.freeze(['GET', 'HEAD']);

function deterministicSample(seed, sampleRatePercent) {
  if (sampleRatePercent <= 0) return false;
  if (sampleRatePercent >= 100) return true;
  let hash = 0x811c9dc5;
  const input = String(seed || '');
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % 100) < sampleRatePercent;
}

function stripIgnoredFields(value, ignoreFields) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripIgnoredFields(v, ignoreFields));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (ignoreFields.has(k)) continue;
    out[k] = stripIgnoredFields(v, ignoreFields);
  }
  return out;
}

export function diffResponses(primary, shadow, { ignoreFields = [] } = {}) {
  const ignoreSet = new Set(ignoreFields);
  const statusMatch = primary.status === shadow.status;
  const normPrimary = stripIgnoredFields(scrubPii(primary.body ?? null), ignoreSet);
  const normShadow = stripIgnoredFields(scrubPii(shadow.body ?? null), ignoreSet);
  const bodyMatch = JSON.stringify(normPrimary) === JSON.stringify(normShadow);

  return {
    matched: statusMatch && bodyMatch,
    statusMatch,
    bodyMatch,
    primaryStatus: primary.status,
    shadowStatus: shadow.status,
    ...(bodyMatch ? {} : { primarySample: normPrimary, shadowSample: normShadow }),
  };
}

function createShadowResponseCapture() {
  const state = { status: 200, headers: {}, body: undefined };
  const res = {
    statusCode: 200,
    setHeader(name, value) {
      state.headers[String(name).toLowerCase()] = value;
      return res;
    },
    status(code) {
      state.status = code;
      res.statusCode = code;
      return res;
    },
    json(payload) {
      state.body = payload;
      return res;
    },
    send(payload) {
      state.body = payload;
      return res;
    },
  };
  return { res, state };
}

async function runWithTimeout(fn, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Shadow timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Creates a shadow-traffic mirroring wrapper for primary vs canary handlers.
 */
export function createShadowMirror({
  sampleRatePercent = 10,
  timeoutMs = 1500,
  maxShadowInflight = 25,
  allowedMethods = DEFAULT_SAFE_METHODS,
  ignoreFields = ['timestamp', 'generatedAt', 'correlationId'],
  now = Date.now,
  onReport = () => {},
} = {}) {
  const methodSet = new Set(allowedMethods.map((m) => String(m).toUpperCase()));
  let shadowInflight = 0;
  const pendingPromises = new Set();

  function wrap(route, primaryHandler, shadowHandler) {
    return async function mirroredHandler(req, res) {
      const method = String(req?.method || 'GET').toUpperCase();
      const primaryStart = now();
      let capturedPrimary = { status: 200, body: undefined };

      const proxyRes = new Proxy(res, {
        get(target, prop) {
          if (prop === 'status') {
            return (code) => {
              capturedPrimary.status = code;
              target.status(code);
              return proxyRes;
            };
          }
          if (prop === 'json' || prop === 'send') {
            return (payload) => {
              capturedPrimary.body = payload;
              return target[prop](payload);
            };
          }
          const value = Reflect.get(target, prop);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });

      const primaryResult = await primaryHandler(req, proxyRes);
      if (primaryResult && typeof primaryResult.status === 'number' && 'body' in primaryResult) {
        capturedPrimary = { status: primaryResult.status, body: primaryResult.body };
      }
      const primaryDurationMs = Math.max(0, now() - primaryStart);

      const seed = req?.headers?.['x-correlation-id'] || `${route}:${req?.url || ''}`;
      const shouldMirror =
        typeof shadowHandler === 'function' &&
        methodSet.has(method) &&
        shadowInflight < maxShadowInflight &&
        deterministicSample(seed, sampleRatePercent);

      if (shouldMirror) {
        shadowInflight += 1;
        const shadowStart = now();
        const task = (async () => {
          try {
            const clonedReq = {
              method,
              url: req?.url,
              query: req?.query ? { ...req.query } : undefined,
              headers: req?.headers ? { ...req.headers } : {},
              body: req?.body ? structuredClone(req.body) : undefined,
            };
            const { res: shadowRes, state } = createShadowResponseCapture();
            const shadowOut = await runWithTimeout(() => shadowHandler(clonedReq, shadowRes), timeoutMs);
            if (shadowOut && typeof shadowOut.status === 'number' && 'body' in shadowOut) {
              state.status = shadowOut.status;
              state.body = shadowOut.body;
            }
            const shadowDurationMs = Math.max(0, now() - shadowStart);
            const diff = diffResponses(capturedPrimary, state, { ignoreFields });
            onReport({
              event: 'shadow_comparison',
              route,
              method,
              primaryDurationMs,
              shadowDurationMs,
              latencyDeltaMs: shadowDurationMs - primaryDurationMs,
              ...diff,
            });
          } catch (err) {
            onReport({
              event: 'shadow_error',
              route,
              method,
              error: err.message,
            });
          } finally {
            shadowInflight = Math.max(0, shadowInflight - 1);
          }
        })();

        pendingPromises.add(task);
        task.finally(() => pendingPromises.delete(task));
      }

      return primaryResult;
    };
  }

  return {
    wrap,
    flush: () => Promise.allSettled([...pendingPromises]),
    getInflightCount: () => shadowInflight,
  };
}
