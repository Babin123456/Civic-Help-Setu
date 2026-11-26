/* global process */
/**
 * api/_lib/mesh/middleware.js
 *
 * Configurable, backward-compatible Internal Service Mesh Readiness middleware
 * for Vercel serverless handlers and api/[...path].js (#1276).
 *
 * Rollout modes:
 *  - `disabled`   (default): Propagates W3C traceparent / correlation IDs without gating routes.
 *  - `permissive`: Evaluates service identity & records auth telemetry, but allows legacy callers.
 *  - `enforced`:   Requires valid mutual service auth + scope authorization on protected routes.
 */

import {
  extractOrCreateTraceContext,
  createTelemetryCollector,
} from './traceContext.js';
import {
  createServiceKeyring,
  verifyServiceRequest,
  signServerProof,
  MESH_TRANSPORT_MODES,
  DEFAULT_CLOCK_SKEW_SECONDS,
} from './serviceIdentity.js';
import { createDependencyPolicy, MeshResilienceError } from './resilience.js';
import { createLoadShedder } from '../loadShedder.js';

export const MESH_AUTH_MODES = Object.freeze({
  DISABLED: 'disabled',
  PERMISSIVE: 'permissive',
  ENFORCED: 'enforced',
});

const DEFAULT_INTERNAL_ROUTES = Object.freeze([
  'internal/',
  'mesh-readiness',
]);

function parsePositiveInt(val, fallback) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function parseJsonSafe(raw, fallback) {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Resolves mesh readiness configuration from environment variables with safe defaults.
 */
export function resolveMeshConfig(env = process.env || {}) {
  const rawMode = String(env.MESH_AUTH_MODE || MESH_AUTH_MODES.DISABLED).trim().toLowerCase();
  const mode = Object.values(MESH_AUTH_MODES).includes(rawMode)
    ? rawMode
    : MESH_AUTH_MODES.DISABLED;

  const rawTransport = String(env.MESH_TRANSPORT_MODE || MESH_TRANSPORT_MODES.AUTO)
    .trim()
    .toLowerCase();
  const transportMode = Object.values(MESH_TRANSPORT_MODES).includes(rawTransport)
    ? rawTransport
    : MESH_TRANSPORT_MODES.AUTO;

  const keyringEntries = parseJsonSafe(env.MESH_KEYRING_JSON, []);
  const signingKey = parseJsonSafe(env.MESH_SIGNING_KEY_JSON, null);
  const internalRoutes = env.MESH_INTERNAL_ROUTES
    ? String(env.MESH_INTERNAL_ROUTES)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [...DEFAULT_INTERNAL_ROUTES];

  return {
    mode,
    transportMode,
    serviceId: String(env.MESH_SERVICE_ID || 'civic-api-gateway'),
    keyringEntries: Array.isArray(keyringEntries) ? keyringEntries : [],
    signingKey,
    trustedProxySecret: env.MESH_TRUSTED_PROXY_SECRET || null,
    telemetrySecret: env.MESH_TELEMETRY_SECRET || env.ABUSE_CONTROL_SECRET || 'mesh-telemetry-hmac-dev',
    clockSkewSeconds: parsePositiveInt(env.MESH_CLOCK_SKEW_SECONDS, DEFAULT_CLOCK_SKEW_SECONDS),
    defaultTimeoutMs: parsePositiveInt(env.MESH_DEFAULT_TIMEOUT_MS, 5000),
    bulkheadMaxConcurrent: parsePositiveInt(env.MESH_BULKHEAD_MAX_CONCURRENT, 64),
    internalRoutes,
    enforceReplayProtection: env.MESH_REPLAY_PROTECTION !== 'false',
    verifyRequestDigest: env.MESH_VERIFY_REQUEST_DIGEST === 'true',
  };
}

function isProtectedInternalRoute(route, internalRoutes) {
  if (!route) return false;
  return internalRoutes.some((prefix) =>
    prefix.endsWith('/') ? route.startsWith(prefix) : route === prefix || route.startsWith(`${prefix}/`)
  );
}

function setHeaderSafe(res, name, value) {
  if (res && typeof res.setHeader === 'function' && !res.writableEnded) {
    res.setHeader(name, value);
  }
}

/**
 * Creates a reusable Mesh Readiness Layer instance for the API dispatcher or standalone routes.
 */
export function createMeshReadinessLayer(options = {}) {
  const config = { ...resolveMeshConfig(), ...options };
  const now = config.now || Date.now;

  const keyring =
    config.keyring ||
    createServiceKeyring({
      initialKeys: config.keyringEntries,
      now,
    });

  const telemetry =
    config.telemetry ||
    createTelemetryCollector({
      secret: config.telemetrySecret,
      maxEvents: config.maxTelemetryEvents || 1000,
      now,
      onSpan: config.onSpan,
    });

  const routePolicies = new Map();
  const routeScopes = config.routeScopes || {};
  const loadShedder = config.loadShedder || createLoadShedder({ now });

  function getRoutePolicy(route) {
    if (!routePolicies.has(route)) {
      routePolicies.set(
        route,
        createDependencyPolicy(`route:${route}`, {
          timeoutMs: config.defaultTimeoutMs,
          maxConcurrent: config.bulkheadMaxConcurrent,
          maxRetries: 0, // Server ingress isolates via bulkhead/timeout, never retries inbound requests
          failureThreshold: config.routeBreakerThreshold ?? Number.MAX_SAFE_INTEGER,
          errorRateThresholdPercent: 101,
          now,
        })
      );
    }
    return routePolicies.get(route);
  }

  function resolveRequiredScopes(route, method, explicitScopes) {
    if (Array.isArray(explicitScopes) && explicitScopes.length > 0) return explicitScopes;
    const rule = routeScopes[route];
    if (!rule) return [];
    if (Array.isArray(rule)) return rule;
    const upperMethod = String(method || 'GET').toUpperCase();
    return Array.isArray(rule[upperMethod]) ? rule[upperMethod] : [];
  }

  /**
   * Authenticates and traces an incoming request, attaching `req.meshContext`.
   * Returns `{ allowed, status, errorBody, headers, context }`.
   */
  function evaluateRequest(req = {}, route = '', { requiredScopes = [], requireAuth = null } = {}) {
    const trace = extractOrCreateTraceContext(req.headers || {}, { now });
    const protectedRoute =
      typeof requireAuth === 'boolean'
        ? requireAuth
        : isProtectedInternalRoute(route, config.internalRoutes);
    const effectiveScopes = resolveRequiredScopes(route, req.method, requiredScopes);

    const responseHeaders = {
      traceparent: trace.traceparent,
      'x-correlation-id': trace.correlationId,
    };

    const hasServiceCredential = Boolean(
      req.headers?.['x-service-assertion'] ||
        req.headers?.['X-Service-Assertion'] ||
        req.headers?.['x-forwarded-client-cert'] ||
        req.headers?.['X-Forwarded-Client-Cert']
    );

    let authResult = { authenticated: false, code: 'MESH_AUTH_SKIPPED', transport: 'none' };
    let authOutcome = 'skipped';

    let normalizedPath = `/api/${route}`;
    if (req.url) {
      try {
        const parsedUrl = new URL(req.url, 'http://internal.mesh');
        normalizedPath = `${parsedUrl.pathname}${parsedUrl.search}`;
      } catch {
        normalizedPath = req.url;
      }
    }

    if (config.mode !== MESH_AUTH_MODES.DISABLED && (protectedRoute || hasServiceCredential)) {
      authResult = verifyServiceRequest({
        headers: req.headers || {},
        method: req.method || 'GET',
        path: normalizedPath,
        body: req.body ?? '',
        expectedAudience: config.serviceId,
        requiredScopes: effectiveScopes,
        keyring,
        transportMode: config.transportMode,
        trustedProxySecret: config.trustedProxySecret,
        isTrustedProxy: config.isTrustedProxy,
        clockSkewSeconds: config.clockSkewSeconds,
        now,
        enforceReplayProtection: config.enforceReplayProtection,
        verifyRequestDigest: config.verifyRequestDigest,
      });

      if (authResult.authenticated) {
        authOutcome = 'allowed';
      } else if (config.mode === MESH_AUTH_MODES.PERMISSIVE || !protectedRoute) {
        authOutcome = 'permissive_bypass';
      } else {
        authOutcome = 'denied';
      }
    }

    responseHeaders['x-mesh-auth-status'] = authOutcome;

    if (authResult.authenticated && config.signingKey) {
      responseHeaders['x-service-server-proof'] = signServerProof({
        signingKey: config.signingKey,
        callerService: authResult.principal.serviceId,
        traceId: trace.traceId,
        spanId: trace.spanId,
        requestJti: authResult.principal.jti || null,
        now,
      });
    }

    const context = {
      serviceId: config.serviceId,
      mode: config.mode,
      trace,
      authOutcome,
      authTransport: authResult.transport,
      servicePrincipal: authResult.authenticated ? authResult.principal : null,
      authErrorCode: authResult.authenticated ? null : authResult.code,
      // Explicitly separate from end-user session; end-user auth remains with Clerk/Firebase.
      endUserIsolated: true,
    };

    if (authOutcome === 'denied') {
      const status =
        authResult.code === 'MESH_AUDIENCE_DENIED' || authResult.code === 'MESH_INSUFFICIENT_SCOPE'
          ? 403
          : 401;
      return {
        allowed: false,
        status,
        headers: responseHeaders,
        errorBody: {
          error: 'service_auth_failed',
          code: authResult.code,
          correlationId: trace.correlationId,
        },
        context,
      };
    }

    return {
      allowed: true,
      status: 200,
      headers: responseHeaders,
      errorBody: null,
      context,
    };
  }

  /**
   * Executes a route handler with trace injection, service-auth gating, bulkhead isolation,
   * and zero-PII span recording. Compatible with both `(req, res)` and `{ status, headers, body }`.
   */
  async function executeRoute(req, res, route, handlerFn, options = {}) {
    const startAt = now();
    const evaluation = evaluateRequest(req, route, options);

    for (const [k, v] of Object.entries(evaluation.headers)) {
      setHeaderSafe(res, k, v);
    }

    if (req && typeof req === 'object') {
      req.meshContext = evaluation.context;
    }

    if (!evaluation.allowed) {
      telemetry.recordSpan({
        traceId: evaluation.context.trace.traceId,
        spanId: evaluation.context.trace.spanId,
        parentSpanId: evaluation.context.trace.parentSpanId,
        correlationId: evaluation.context.trace.correlationId,
        callerService: 'unauthenticated',
        targetService: config.serviceId,
        route,
        method: req?.method || 'GET',
        authMode: config.mode,
        authOutcome: 'denied',
        durationMs: now() - startAt,
        status: evaluation.status,
        errorCode: evaluation.errorBody.code,
      });

      if (res && typeof res.status === 'function' && !res.writableEnded) {
        return res.status(evaluation.status).json(evaluation.errorBody);
      }
      return { status: evaluation.status, headers: evaluation.headers, body: evaluation.errorBody };
    }

    const policy = getRoutePolicy(route);
    let finalStatus = 200;
    let errorCode = null;

    try {
      const outcome = await loadShedder.execute(req, res, route, () =>
        policy.execute(
          async () => handlerFn(req, res),
          {
            idempotent: false,
            deadlineMs: evaluation.context.trace.deadlineMs,
            timeoutMs: options.timeoutMs ?? config.defaultTimeoutMs,
          }
        )
      );

      const result = outcome.result;
      if (result && typeof result.status === 'number') {
        finalStatus = result.status;
      } else if (res && typeof res.statusCode === 'number') {
        finalStatus = res.statusCode;
      }
      return result;
    } catch (err) {
      if (err instanceof MeshResilienceError) {
        finalStatus = err.status || 503;
        errorCode = err.code;
        if (res && typeof res.status === 'function' && !res.writableEnded) {
          return res.status(finalStatus).json({
            error: 'service_unavailable',
            code: errorCode,
            correlationId: evaluation.context.trace.correlationId,
          });
        }
        return {
          status: finalStatus,
          headers: evaluation.headers,
          body: {
            error: 'service_unavailable',
            code: errorCode,
            correlationId: evaluation.context.trace.correlationId,
          },
        };
      }
      finalStatus = 500;
      errorCode = 'INTERNAL_ERROR';
      throw err;
    } finally {
      telemetry.recordSpan({
        traceId: evaluation.context.trace.traceId,
        spanId: evaluation.context.trace.spanId,
        parentSpanId: evaluation.context.trace.parentSpanId,
        correlationId: evaluation.context.trace.correlationId,
        callerService: evaluation.context.servicePrincipal?.serviceId || 'legacy_or_enduser',
        targetService: config.serviceId,
        route,
        method: req?.method || 'GET',
        authMode: config.mode,
        authOutcome: evaluation.context.authOutcome,
        breakerState: policy.getState(),
        durationMs: now() - startAt,
        status: finalStatus,
        errorCode,
      });
    }
  }

  function getReadinessSnapshot() {
    return {
      schemaVersion: 'mesh-readiness-v1',
      serviceId: config.serviceId,
      mode: config.mode,
      transportMode: config.transportMode,
      keyring: keyring.summary(),
      telemetry: telemetry.getCounters(),
      routeIsolations: [...routePolicies.values()].map((p) => p.snapshot()),
      timestamp: new Date(now()).toISOString(),
    };
  }

  return {
    config,
    keyring,
    telemetry,
    evaluateRequest,
    executeRoute,
    getReadinessSnapshot,
  };
}
