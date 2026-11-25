/**
 * @file Tenant Runtime: Feature Flags, SLO Metrics, Retry/Backoff, and Backward Compatibility
 *
 * Centralizes safe rollout configuration, actionable SLO metrics, transient-error
 * retries, and legacy unpartitioned record compatibility without hard-coded secrets
 * or vendor lock-in.
 */
/* global process */

const TRANSIENT_ERROR_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'aborted',
  'resource-exhausted',
  'internal',
  'ETIMEDOUT',
  'ECONNRESET',
]);

const NON_RETRYABLE_CODES = new Set([
  'permission-denied',
  'TENANT_ACCESS_DENIED',
  'TENANT_ID_INVALID',
  'TENANT_CONTEXT_REQUIRED',
  'TENANT_ID_IMMUTABLE',
  'CROSS_TENANT_LEAK',
]);

function readEnv(key) {
  if (typeof process !== 'undefined' && process.env && key in process.env) {
    return process.env[key];
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && key in import.meta.env) {
    return import.meta.env[key];
  }
  return undefined;
}

function parseBool(val, defaultValue) {
  if (val === undefined || val === null || val === '') return defaultValue;
  const normalized = String(val).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return defaultValue;
}

function parsePositiveInt(val, defaultValue, max = 10000) {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return defaultValue;
  return Math.min(max, Math.floor(num));
}

/**
 * Returns the current tenant isolation feature flags and runtime limits.
 * Defaults to fail-closed (enabled=true, strictMode=true).
 */
export function getTenantFeatureFlags(overrides = {}) {
  return {
    isolationEnabled:
      overrides.isolationEnabled ??
      parseBool(readEnv('TENANT_ISOLATION_ENABLED'), true),
    strictMode:
      overrides.strictMode ??
      parseBool(readEnv('TENANT_STRICT_MODE'), true),
    auditLogging:
      overrides.auditLogging ??
      parseBool(readEnv('TENANT_AUDIT_LOGGING'), true),
    maxPageSize:
      overrides.maxPageSize ??
      parsePositiveInt(readEnv('TENANT_MAX_PAGE_SIZE'), 100, 500),
    retryMaxAttempts:
      overrides.retryMaxAttempts ??
      parsePositiveInt(readEnv('TENANT_RETRY_MAX_ATTEMPTS'), 3, 10),
    retryBaseDelayMs:
      overrides.retryBaseDelayMs ??
      parsePositiveInt(readEnv('TENANT_RETRY_BASE_MS'), 25, 5000),
  };
}

export const TENANT_SLO_TARGETS = Object.freeze({
  queryP99Ms: 500,
  mutationP99Ms: 1000,
  authCheckP99Ms: 10,
  maxErrorRate: 0.001, // 0.1%
});

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor(sortedValues.length * p))
  );
  return sortedValues[idx];
}

class TenantMetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this._counters = {
      authAllowedTotal: 0,
      authDeniedTotal: 0,
      crossTenantDeniedTotal: 0,
      queryTotal: 0,
      queryErrorsTotal: 0,
      retryAttemptsTotal: 0,
      legacyFallbackReadsTotal: 0,
    };
    this._queryLatenciesMs = [];
    this._authLatenciesMs = [];
  }

  recordAuthOutcome({ allowed, code, durationMs = 0 }) {
    if (allowed) {
      this._counters.authAllowedTotal += 1;
    } else {
      this._counters.authDeniedTotal += 1;
      if (code === 'TENANT_ACCESS_DENIED' || code === 'CROSS_TENANT_LEAK') {
        this._counters.crossTenantDeniedTotal += 1;
      }
    }
    if (this._authLatenciesMs.length < 10000) {
      this._authLatenciesMs.push(durationMs);
    }
  }

  recordQuery({ durationMs = 0, error = false } = {}) {
    this._counters.queryTotal += 1;
    if (error) this._counters.queryErrorsTotal += 1;
    if (this._queryLatenciesMs.length < 10000) {
      this._queryLatenciesMs.push(durationMs);
    }
  }

  recordRetry() {
    this._counters.retryAttemptsTotal += 1;
  }

  recordLegacyFallbackRead() {
    this._counters.legacyFallbackReadsTotal += 1;
  }

  getSnapshot() {
    const sortedQueries = [...this._queryLatenciesMs].sort((a, b) => a - b);
    const sortedAuth = [...this._authLatenciesMs].sort((a, b) => a - b);
    const queryErrorRate =
      this._counters.queryTotal > 0
        ? this._counters.queryErrorsTotal / this._counters.queryTotal
        : 0;

    return {
      counters: { ...this._counters },
      latencies: {
        queryP99Ms: percentile(sortedQueries, 0.99),
        authP99Ms: percentile(sortedAuth, 0.99),
      },
      rates: {
        queryErrorRate,
      },
    };
  }

  evaluateSlos(targets = TENANT_SLO_TARGETS) {
    const snap = this.getSnapshot();
    const violations = [];

    if (snap.latencies.queryP99Ms > targets.queryP99Ms) {
      violations.push({
        slo: 'queryP99Ms',
        actual: snap.latencies.queryP99Ms,
        target: targets.queryP99Ms,
      });
    }
    if (snap.latencies.authP99Ms > targets.authCheckP99Ms) {
      violations.push({
        slo: 'authCheckP99Ms',
        actual: snap.latencies.authP99Ms,
        target: targets.authCheckP99Ms,
      });
    }
    if (snap.rates.queryErrorRate > targets.maxErrorRate) {
      violations.push({
        slo: 'queryErrorRate',
        actual: snap.rates.queryErrorRate,
        target: targets.maxErrorRate,
      });
    }

    return {
      healthy: violations.length === 0,
      violations,
      snapshot: snap,
    };
  }
}

export const tenantMetrics = new TenantMetricsCollector();

/**
 * Determines whether an error is transient and safe to retry.
 * @param {any} err
 * @returns {boolean}
 */
export function isTransientTenantError(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const message = String(err.message || '');

  if (NON_RETRYABLE_CODES.has(code)) return false;
  for (const nonRetryable of NON_RETRYABLE_CODES) {
    if (message.includes(nonRetryable)) return false;
  }

  if (TRANSIENT_ERROR_CODES.has(code)) return true;
  if (/deadline exceeded|unavailable|timeout|econnreset/i.test(message)) return true;
  return false;
}

/**
 * Executes an async operation with exponential backoff on transient failures.
 * Never retries deterministic authorization or validation errors.
 * @param {Function} operation
 * @param {object} [options]
 * @returns {Promise<any>}
 */
export async function withTenantRetry(operation, options = {}) {
  const flags = getTenantFeatureFlags();
  const maxAttempts = options.maxAttempts ?? flags.retryMaxAttempts;
  const baseDelayMs = options.baseDelayMs ?? flags.retryBaseDelayMs;
  const shouldRetry = options.shouldRetry ?? isTransientTenantError;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !shouldRetry(err)) {
        throw err;
      }
      tenantMetrics.recordRetry();
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Checks whether a document is a legacy unpartitioned record (no tenantId).
 * @param {object} doc
 * @returns {boolean}
 */
export function isLegacyUnpartitionedDoc(doc) {
  return Boolean(doc && typeof doc === 'object' && !doc.tenantId);
}

/**
 * Evaluates backward-compatible read access for unpartitioned legacy records.
 * In strictMode (default), legacy records without tenantId fail closed.
 * When strictMode is explicitly false during migration, allows read and records metric.
 * @param {object} doc
 * @param {object} [flags]
 * @returns {boolean}
 */
export function allowLegacyUnpartitionedRead(doc, flags = getTenantFeatureFlags()) {
  if (!isLegacyUnpartitionedDoc(doc)) return false;
  if (flags.strictMode) return false;
  tenantMetrics.recordLegacyFallbackRead();
  return true;
}
