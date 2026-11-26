/* global process */
/**
 * api/_lib/gateway/gatewayMiddleware.js
 *
 * Unified API Gateway Middleware.
 * Combines version negotiation, consumer identification, quota enforcement,
 * request validation, deprecation headers, and observability.
 * Integrates with existing mesh readiness layer and error contract.
 */

import { negotiateVersion, buildVersionHeaders, getSupportedVersions } from '../versioning/negotiator.js';
import { SUPPORTED_VERSIONS, DEFAULT_VERSION } from '../versioning/versionConfig.js';
import { getDefaultRegistry as getContractRegistry } from '../versioning/contractRegistry.js';
import { validateRequest } from '../validation/requestValidator.js';
import { getDefaultConsumerRegistry, CONSUMER_TIERS, AUTH_METHODS } from './consumerRegistry.js';
import { DeprecationManager, buildDeprecationHeaders, shouldRejectVersion, getSunsetRejection, getDeprecationWarning } from './deprecationManager.js';
import { createWindowCounter } from '../abuseControlPlane.js';
import { clientKey } from '../abuseGuard.js';

export const INTERNAL_SERVICES = Object.freeze([
  'tenant-administration',
  'agent-incident-response',
  'civic-data-clean-room',
  'service-change-sandbox',
  'civic-chaos-engineering',
  'multi-region-status',
  'multi-region-health',
  'multi-region-metrics',
  'policy-simulation',
  'agent-sandbox',
]);

export function isInternalServicePath(path) {
  if (!path) return false;
  const cleaned = path.replace(/^\/?(api\/)?(v\d+\/)?/, '').split(/[/?#]/)[0];
  return INTERNAL_SERVICES.includes(cleaned);
}

// Runtime metrics tracking
const gatewayMetrics = {
  totalRequests: 0,
  requestsByVersion: { v1: 0, v2: 0 },
  quotaExceededCount: 0,
  validationErrorCount: 0,
  sunsetRejectionCount: 0,
  internalBlockedCount: 0,
};

// Feature flags
const FEATURES = {
  versioning: process.env.GATEWAY_FEATURE_VERSIONING !== 'false',
  quotas: process.env.GATEWAY_FEATURE_QUOTAS !== 'false',
  validation: process.env.GATEWAY_FEATURE_VALIDATION !== 'false',
  deprecation: process.env.GATEWAY_FEATURE_DEPRECATION !== 'false',
};

const GATEWAY_ENABLED = process.env.GATEWAY_ENABLED !== 'false';

/**
 * Extract consumer credentials from request
 */
function extractConsumerCredentials(req) {
  const headers = req.headers || {};

  // API Key (header or query)
  const apiKey = headers['x-api-key'] || headers['X-API-Key'] || req.query?.api_key;

  // Bearer token
  const authHeader = headers['authorization'] || headers['Authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // Client certificate (for mTLS)
  const clientCert = headers['x-forwarded-client-cert'] || headers['X-Forwarded-Client-Cert'];

  return { apiKey, bearerToken, clientCert };
}

/**
 * Identify consumer from request credentials
 */
async function identifyConsumer(req, consumerRegistry) {
  const { apiKey, bearerToken, clientCert } = extractConsumerCredentials(req);

  // Try API Key first
  if (apiKey && consumerRegistry) {
    const consumer = await consumerRegistry.getConsumerByCredential(apiKey);
    if (consumer && consumer.authMethod === AUTH_METHODS.API_KEY) {
      return { consumer, authMethod: AUTH_METHODS.API_KEY, credential: apiKey };
    }
  }

  // Try Bearer token (would need JWT verification in production)
  if (bearerToken && consumerRegistry) {
    // For now, treat as opaque token - in production verify JWT and extract consumer ID
    const consumer = await consumerRegistry.getConsumerByCredential(bearerToken);
    if (consumer) {
      return { consumer, authMethod: AUTH_METHODS.BEARER_TOKEN, credential: bearerToken };
    }
  }

  // Try mTLS certificate
  if (clientCert && consumerRegistry) {
    const consumer = await consumerRegistry.getConsumerByCredential(clientCert);
    if (consumer && consumer.authMethod === AUTH_METHODS.MTLS) {
      return { consumer, authMethod: AUTH_METHODS.MTLS, credential: clientCert };
    }
  }

  // No valid credentials - anonymous
  return { consumer: null, authMethod: AUTH_METHODS.NONE, credential: null };
}

/**
 * Build quota headers for response
 */
function buildQuotaHeaders(quotaResult) {
  const headers = {};

  if (quotaResult.consumerId && quotaResult.consumerId !== 'anonymous') {
    headers['X-RateLimit-Consumer'] = quotaResult.consumerId;
    headers['X-RateLimit-Tier'] = quotaResult.tier;
  }

  if (quotaResult.remaining) {
    headers['X-RateLimit-Remaining-Burst'] = String(quotaResult.remaining.burst || 0);
    headers['X-RateLimit-Remaining-Minute'] = String(quotaResult.remaining.rpm || 0);
    headers['X-RateLimit-Remaining-Hour'] = String(quotaResult.remaining.rph || 0);
    headers['X-RateLimit-Remaining-Day'] = String(quotaResult.remaining.rpd || 0);
  }

  if (quotaResult.limit) {
    headers['X-RateLimit-Limit'] = String(quotaResult.limit);
  }

  if (quotaResult.retryAfterSeconds && quotaResult.retryAfterSeconds > 0) {
    headers['Retry-After'] = String(quotaResult.retryAfterSeconds);
  }

  return headers;
}

/**
 * Create the gateway middleware
 */
export function createGatewayMiddleware(options = {}) {
  const {
    contractRegistry = getContractRegistry(),
    consumerRegistry = getDefaultConsumerRegistry(),
    abuseControlPlane = options.abuseControlPlane || null,
    deprecationManager = new DeprecationManager(),
    features = { ...FEATURES },
    baseUrl = '',
    skipPaths = ['/health', '/ready', '/metrics', '/mesh-readiness'],
    strictValidation = process.env.GATEWAY_VALIDATION_STRICT === 'true',
    onError = (err) => console.error('Gateway middleware error:', err),
  } = options;

  // Per-route quota counters for anonymous fallback
  const anonRouteCounters = new Map();

  return async function gatewayMiddleware(req, res, next) {
    const startTime = Date.now();

    try {
      // Skip gateway for excluded paths
      const requestPath = req.path || req.url?.split('?')[0] || '';
      if (skipPaths.some(p => requestPath.startsWith(p))) {
        return next();
      }

      if (!GATEWAY_ENABLED) {
        return next();
      }

      // Ensure contract registry is initialized
      await contractRegistry.getContract(DEFAULT_VERSION);

      // ============ VERSION NEGOTIATION ============
      let negotiatedVersion = { version: DEFAULT_VERSION, source: 'default' };
      if (features.versioning) {
        negotiatedVersion = negotiateVersion({
          headers: req.headers,
          url: req.url,
          query: req.query,
          basePath: '/api',
          allowDefault: true,
        }) || { version: DEFAULT_VERSION, source: 'default' };

        // Attach version to request for downstream use
        req.apiVersion = negotiatedVersion.version;
        req.apiVersionSource = negotiatedVersion.source;
      }

      gatewayMetrics.totalRequests++;
      if (negotiatedVersion.version && gatewayMetrics.requestsByVersion[negotiatedVersion.version] !== undefined) {
        gatewayMetrics.requestsByVersion[negotiatedVersion.version]++;
      }

      // ============ CONSUMER IDENTIFICATION ============
      let consumerInfo = { consumer: null, authMethod: AUTH_METHODS.NONE, credential: null };
      if (features.quotas && consumerRegistry) {
        consumerInfo = await identifyConsumer(req, consumerRegistry);
        req.consumer = consumerInfo.consumer;
        req.consumerAuthMethod = consumerInfo.authMethod;
      }

      // ============ INTERNAL SERVICE ACCESS CONTROL ============
      if (isInternalServicePath(requestPath)) {
        const isInternalConsumer = consumerInfo.consumer && consumerInfo.consumer.tier === CONSUMER_TIERS.INTERNAL;
        const hasInternalCert = Boolean(req.headers?.['x-forwarded-client-cert']);
        const hasServiceAssertion = Boolean(req.headers?.['x-service-assertion']);

        if (!isInternalConsumer && !hasInternalCert && !hasServiceAssertion) {
          gatewayMetrics.internalBlockedCount++;
          return sendResponse(res, 403, {
            error: 'forbidden',
            code: 'FORBIDDEN',
            message: 'Direct access to internal services is restricted. Use the internal service mesh.',
            retryable: false,
          }, {
            ...buildVersionHeaders(negotiatedVersion, { baseUrl, includeSupportedVersions: true }),
            'Content-Type': 'application/json',
          });
        }
      }

      // ============ DEPRECATION CHECK ============
      if (features.deprecation && negotiatedVersion.version) {
        const now = deprecationManager?.now || Date.now;
        if (shouldRejectVersion(negotiatedVersion.version, now())) {
          gatewayMetrics.sunsetRejectionCount++;
          const rejection = getSunsetRejection(negotiatedVersion.version, { baseUrl, at: now() });
          return sendResponse(res, rejection.status, rejection.body, rejection.headers);
        }
      }

      // ============ QUOTA CHECK ============
      let quotaResult = { allowed: true, reason: 'ok', retryAfterSeconds: 0 };
      if (features.quotas) {
        const identifier = clientKey(req.headers);
        const userId = consumerInfo.consumer?.id || (req.principal?.id || null);

        if (consumerInfo.consumer) {
          quotaResult = await consumerRegistry.checkQuota(consumerInfo.consumer.id, {
            route: requestPath,
            method: req.method,
            identifier,
            userId,
          });
        } else if (abuseControlPlane) {
          quotaResult = await abuseControlPlane.check({
            route: requestPath,
            method: req.method,
            identifier,
            userId,
          });
        } else {
          // Fallback: simple per-route anonymous counter
          const routeKey = `${req.method}:${requestPath}`;
          if (!anonRouteCounters.has(routeKey)) {
            anonRouteCounters.set(routeKey, createWindowCounter({ limit: 60, windowMs: 60000 }));
          }
          quotaResult = anonRouteCounters.get(routeKey).take(`anon:${identifier || 'unknown'}`);
          quotaResult.consumerId = 'anonymous';
          quotaResult.tier = CONSUMER_TIERS.ANONYMOUS;
        }

        // Attach quota info to request
        req.quota = quotaResult;

        // Handle quota exceeded
        if (!quotaResult.allowed) {
          gatewayMetrics.quotaExceededCount++;
          const headers = {
            ...buildVersionHeaders(negotiatedVersion, { baseUrl, includeSupportedVersions: true }),
            ...buildDeprecationHeaders(negotiatedVersion.version, { baseUrl }),
            ...buildQuotaHeaders(quotaResult),
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          };

          return sendResponse(res, 429, {
            error: 'rate_limited',
            code: 'RATE_LIMITED',
            message: 'Too many requests. Wait before trying again.',
            retryable: true,
            recoveryAction: 'wait',
            retryAfterSeconds: quotaResult.retryAfterSeconds,
            tier: quotaResult.tier,
            limit: quotaResult.limit,
            window: quotaResult.window,
          }, headers);
        }
      }

      // ============ REQUEST VALIDATION ============
      const isGatewayMetaPath = ['/openapi', '/gateway-health', '/gateway-metrics'].some(p => requestPath.includes(p));
      if (features.validation && negotiatedVersion.version && !isGatewayMetaPath) {
        // Skip validation for safe methods if configured
        const skipBody = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);

        // Strip version prefix from path for OpenAPI spec matching
        // OpenAPI specs use paths like '/services', not '/api/v1/services'
        let validationPath = requestPath;
        const versionPrefix = `/api/${negotiatedVersion.version}`;
        if (validationPath.startsWith(versionPrefix)) {
          validationPath = validationPath.slice(versionPrefix.length) || '/';
        } else if (validationPath.startsWith(`/${negotiatedVersion.version}`)) {
          validationPath = validationPath.slice(`/${negotiatedVersion.version}`.length) || '/';
        } else if (validationPath.startsWith('/api/')) {
          // Strip /api prefix for versionless paths
          validationPath = validationPath.slice(4) || '/';
        }
        if (!validationPath.startsWith('/')) {
          validationPath = '/' + validationPath;
        }

        const validation = await validateRequest({
          method: req.method,
          path: validationPath,
          pathParams: req.pathParams || req.params,
          query: req.query,
          headers: req.headers,
          body: req.body,
        }, negotiatedVersion.version, {
          strict: strictValidation,
          skipBody,
          registry: contractRegistry,
        });

        req.validation = validation;

        if (!validation.valid) {
          gatewayMetrics.validationErrorCount++;
          const headers = {
            ...buildVersionHeaders(negotiatedVersion, { baseUrl, includeSupportedVersions: true }),
            ...buildDeprecationHeaders(negotiatedVersion.version, { baseUrl }),
            ...buildQuotaHeaders(quotaResult),
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          };

          return sendResponse(res, 422, {
            error: 'validation_failed',
            code: 'VALIDATION_FAILED',
            message: 'Some submitted fields need correction.',
            retryable: false,
            recoveryAction: 'edit_request',
            details: validation.errors.map(e => ({
              field: e.path,
              message: e.message,
              code: e.code,
            })),
          }, headers);
        }
      }

      // ============ RESPONSE HOOK FOR HEADERS ============
      // Wrap res.json to inject headers
      const originalJson = res.json.bind(res);
      const now = deprecationManager?.now || Date.now;
      res.json = function(body) {
        // Build all response headers
        const versionHeaders = features.versioning ? buildVersionHeaders(negotiatedVersion, { baseUrl, includeSupportedVersions: true }) : {};
        const deprecationHeaders = features.deprecation ? buildDeprecationHeaders(negotiatedVersion.version, { baseUrl, at: now() }) : {};
        const quotaHeaders = features.quotas ? buildQuotaHeaders(quotaResult) : {};

        // Add deprecation warning to body if deprecated
        if (features.deprecation) {
          const detail = deprecationManager.getDetail(negotiatedVersion.version, now());
          if (detail.deprecated && !detail.sunset && body && typeof body === 'object') {
            const warning = getDeprecationWarning(negotiatedVersion.version, { baseUrl, at: now() });
            body = { ...body, _deprecationWarning: warning.body };
          }
        }

        // Set all headers
        for (const [name, value] of Object.entries({ ...versionHeaders, ...deprecationHeaders, ...quotaHeaders })) {
          res.setHeader(name, value);
        }

        // Add timing header
        res.setHeader('X-Gateway-Latency-Ms', String(Date.now() - startTime));

        return originalJson(body);
      };

      // Also wrap res.status to ensure headers are set on error responses
      const originalStatus = res.status.bind(res);
      res.status = function(code) {
        originalStatus(code);
        return res;
      };

      next();
    } catch (err) {
      onError(err, req, res);
      // Don't block request on gateway errors - fail open
      next();
    }
  };
}

/**
 * Send response with headers
 */
function sendResponse(res, status, body, headers = {}) {
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }
  return res.status(status).json(body);
}

/**
 * Create gateway middleware with all default registries
 */
export function createDefaultGatewayMiddleware(options = {}) {
  return createGatewayMiddleware({
    contractRegistry: getContractRegistry(),
    consumerRegistry: getDefaultConsumerRegistry(),
    abuseControlPlane: options.abuseControlPlane || null,
    ...options,
  });
}

/**
 * Health check endpoint data
 */
export function getGatewayHealth() {
  return {
    status: 'healthy',
    gatewayEnabled: GATEWAY_ENABLED,
    features: FEATURES,
    supportedVersions: getSupportedVersions(),
    defaultVersion: DEFAULT_VERSION,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Gateway metrics for monitoring
 */
export function getGatewayMetrics() {
  return {
    metrics: { ...gatewayMetrics },
    features: FEATURES,
    supportedVersions: SUPPORTED_VERSIONS,
    defaultVersion: DEFAULT_VERSION,
  };
}