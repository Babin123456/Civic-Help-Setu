/**
 * @file highCardinalityTelemetryGuardService.js
 * @description Protects observability backends from metric series explosion and telemetry cost collapse.
 * Strictly redacts citizen PII (Aadhaar, emails, phone numbers, UUIDs) from metric tag dimensions,
 * enforces cardinality budgets per metric name with an 'other' overflow bucket, and implements tail-based trace sampling.
 */

export class TelemetryGuardError extends Error {
  constructor(message, code = 'TELEMETRY_GUARD_ERROR') {
    super(message);
    this.name = 'TelemetryGuardError';
    this.code = code;
  }
}

export class HighCardinalityTelemetryGuardService {
  constructor(options = {}) {
    this.maxCardinalityBudget = options.maxCardinalityBudget || 100;
    this.sampleRate = options.sampleRate || 0.1; // 10% default trace sample rate
    this.errorSampleRate = options.errorSampleRate || 1.0; // 100% sample rate for errors (tail sampling)
    this.seriesRegistries = new Map(); // metricName -> Set of unique label combinations
    this.exemplars = new Map(); // metricName -> array of exemplars
  }

  /**
   * Sanitizes label values by redacting UUIDs, numbers, emails, and personal identifiers.
   */
  sanitizeLabelValue(labelKey, labelValue) {
    if (labelValue === undefined || labelValue === null) return 'unknown';
    const str = String(labelValue).trim();

    // 1. Never allow PII in metric labels
    if (['user_id', 'citizen_id', 'aadhaar', 'email', 'phone', 'ip_address'].includes(labelKey.toLowerCase())) {
      return '[REDACTED_PII]';
    }

    // 2. Normalize UUIDs or long hex hashes to a generic placeholder to prevent series explosion
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
      return ':id:';
    }
    if (/^[0-9a-f]{32,64}$/i.test(str)) {
      return ':hash:';
    }

    // 3. Normalize raw numeric IDs (e.g. /users/49102 -> :id:)
    if (/^\d+$/.test(str) && str.length > 3) {
      return ':id:';
    }

    // 4. Normalize paths with embedded IDs
    const normalizedPath = str
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');

    return normalizedPath;
  }

  /**
   * Records a metric observation while enforcing cardinality bounds.
   */
  recordMetric(metricName, value, labels = {}, exemplar = null) {
    if (!metricName) {
      throw new TelemetryGuardError('Metric name is required', 'INVALID_ARGUMENT');
    }

    const sanitizedLabels = {};
    Object.keys(labels).forEach(key => {
      sanitizedLabels[key] = this.sanitizeLabelValue(key, labels[key]);
    });

    const labelKeyString = Object.entries(sanitizedLabels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    if (!this.seriesRegistries.has(metricName)) {
      this.seriesRegistries.set(metricName, new Set());
    }

    const registry = this.seriesRegistries.get(metricName);

    let effectiveLabelKey = labelKeyString;
    let isOverflown = false;

    // Check cardinality budget
    if (!registry.has(labelKeyString)) {
      if (registry.size >= this.maxCardinalityBudget) {
        effectiveLabelKey = '_overflow_="true"';
        isOverflown = true;
      } else {
        registry.add(labelKeyString);
      }
    }

    // Capture trace exemplar if attached
    if (exemplar && exemplar.traceId) {
      if (!this.exemplars.has(metricName)) {
        this.exemplars.set(metricName, []);
      }
      const list = this.exemplars.get(metricName);
      list.push({
        traceId: exemplar.traceId,
        spanId: exemplar.spanId,
        value,
        timestamp: new Date().toISOString()
      });
      if (list.length > 50) list.shift();
    }

    return {
      metricName,
      value,
      effectiveLabels: effectiveLabelKey,
      isOverflown,
      currentSeriesCount: registry.size
    };
  }

  /**
   * Tail-based trace sampling: Always preserves traces with errors or high latency (>1000ms),
   * while probabilistically sampling standard successful spans.
   */
  shouldSampleTrace(traceContext = {}) {
    const isError = Boolean(traceContext.isError || traceContext.httpStatus >= 500);
    const isSlow = Boolean(traceContext.durationMs && traceContext.durationMs > 1000);

    if (isError || isSlow) {
      return { sampled: true, reason: isError ? 'TAIL_ERROR' : 'TAIL_SLOW_REQUEST' };
    }

    const roll = Math.random();
    const sampled = roll < this.sampleRate;
    return { sampled, reason: sampled ? 'PROBABILISTIC_SAMPLE' : 'DROPPED_BY_BUDGET' };
  }

  getCardinalityStatus(metricName) {
    const count = this.seriesRegistries.get(metricName)?.size || 0;
    return {
      metricName,
      allocatedSeries: count,
      budget: this.maxCardinalityBudget,
      utilizationRatio: Number((count / this.maxCardinalityBudget).toFixed(2))
    };
  }
}

export const defaultTelemetryGuardService = new HighCardinalityTelemetryGuardService();
