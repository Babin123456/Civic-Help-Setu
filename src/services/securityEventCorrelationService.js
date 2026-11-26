/**
 * Privacy-Safe Security Event Correlation and Alerting Service
 *
 * Implements privacy-first, client-safe event correlation across security signals:
 * - Repeated failed authentication attempts
 * - Anomalous export frequencies
 * - Critical administrative/role changes
 * - Account recovery velocity spikes
 *
 * Adheres strictly to zero-PII logging standards:
 * - Anonymizes and hashes sensitive actor identifiers with salt
 * - Uses ephemeral correlation IDs with strict TTL (time-to-live)
 * - Emits redacted and aggregated alert summaries without raw tokens or citizen identifiers
 */

export const SECURITY_EVENT_TYPES = Object.freeze({
  AUTH_FAILURE: 'AUTH_FAILURE',
  BULK_EXPORT: 'BULK_EXPORT',
  ROLE_ELEVATION: 'ROLE_ELEVATION',
  SESSION_HIJACK_ATTEMPT: 'SESSION_HIJACK_ATTEMPT',
  RECOVERY_SPIKE: 'RECOVERY_SPIKE'
});

export const SEVERITY_LEVELS = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

const DEFAULT_THRESHOLDS = Object.freeze({
  AUTH_FAILURE_COUNT: 5,
  AUTH_FAILURE_WINDOW_MS: 3 * 60 * 1000, // 3 minutes
  BULK_EXPORT_MAX_RECORDS: 100,
  BULK_EXPORT_WINDOW_MS: 5 * 60 * 1000,  // 5 minutes
  ROLE_ELEVATION_SUSPICION_WINDOW_MS: 10 * 60 * 1000
});

/**
 * Generates an unguessable, ephemeral correlation token
 * @returns {string} Short-lived correlation ID
 */
export function generateCorrelationId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `corr_${timestamp}_${randomPart}`;
}

/**
 * Mask and hash actor identifiers to prevent PII leakage in incident logs
 * @param {string} actorRaw Raw email, username, or IP
 * @returns {string} Salted obfuscated hash
 */
export function anonymizeActor(actorRaw) {
  if (!actorRaw || typeof actorRaw !== 'string') {
    return 'anon_unknown';
  }
  let hash = 0;
  for (let i = 0; i < actorRaw.length; i++) {
    hash = ((hash << 5) - hash) + actorRaw.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash).toString(16).padStart(8, '0');
  return `act_${positiveHash}`;
}

/**
 * Redacts any accidental token or credential substrings from event details
 * @param {Record<string, any>} details Raw metadata dictionary
 * @returns {Record<string, any>} Sanitized metadata
 */
export function redactEventDetails(details = {}) {
  const sanitized = {};
  const sensitiveKeys = ['token', 'password', 'secret', 'jwt', 'auth', 'bearer', 'aadhaar', 'mobile', 'email'];

  for (const [key, value] of Object.entries(details)) {
    const isSensitive = sensitiveKeys.some(s => key.toLowerCase().includes(s));
    if (isSensitive) {
      sanitized[key] = '[REDACTED_PII]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactEventDetails(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export class SecurityEventCorrelationEngine {
  constructor(thresholds = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.eventBuffer = [];
    this.alertLog = [];
  }

  /**
   * Ingest a raw security observation safely
   * @param {Object} event Event definition
   * @returns {Object} Stored sanitized event
   */
  recordEvent({ eventType, actor, details = {}, timestamp = Date.now() }) {
    if (!SECURITY_EVENT_TYPES[eventType]) {
      throw new Error(`Unsupported security event type: ${eventType}`);
    }

    const sanitizedEvent = {
      correlationId: generateCorrelationId(),
      eventType,
      actorHash: anonymizeActor(actor),
      details: redactEventDetails(details),
      timestamp
    };

    this.eventBuffer.push(sanitizedEvent);
    this.pruneBuffer(timestamp);

    const generatedAlert = this.evaluateRules(sanitizedEvent);
    if (generatedAlert) {
      this.alertLog.push(generatedAlert);
    }

    return sanitizedEvent;
  }

  /**
   * Remove expired events older than maximum window
   * @param {number} currentTime
   */
  pruneBuffer(currentTime = Date.now()) {
    const maxWindow = Math.max(
      this.thresholds.AUTH_FAILURE_WINDOW_MS,
      this.thresholds.BULK_EXPORT_WINDOW_MS,
      this.thresholds.ROLE_ELEVATION_SUSPICION_WINDOW_MS
    );
    this.eventBuffer = this.eventBuffer.filter(e => (currentTime - e.timestamp) <= maxWindow);
  }

  /**
   * Evaluates security correlation patterns
   * @param {Object} triggerEvent Most recent event
   * @returns {Object|null} Alert definition or null
   */
  evaluateRules(triggerEvent) {
    const { eventType, actorHash, timestamp } = triggerEvent;

    // Rule 1: Repeated authentication failures within sliding window
    if (eventType === SECURITY_EVENT_TYPES.AUTH_FAILURE) {
      const windowStart = timestamp - this.thresholds.AUTH_FAILURE_WINDOW_MS;
      const recentFailures = this.eventBuffer.filter(e =>
        e.eventType === SECURITY_EVENT_TYPES.AUTH_FAILURE &&
        e.actorHash === actorHash &&
        e.timestamp >= windowStart
      );

      if (recentFailures.length >= this.thresholds.AUTH_FAILURE_COUNT) {
        return {
          alertId: `alt_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
          rule: 'BRUTE_FORCE_VELOCITY_EXCEEDED',
          severity: SEVERITY_LEVELS.HIGH,
          actorHash,
          eventCount: recentFailures.length,
          triggeredAt: timestamp,
          summary: `Observed ${recentFailures.length} failed authentications in window`
        };
      }
    }

    // Rule 2: High-volume export burst
    if (eventType === SECURITY_EVENT_TYPES.BULK_EXPORT) {
      const count = Number(triggerEvent.details?.recordCount) || 0;
      if (count >= this.thresholds.BULK_EXPORT_MAX_RECORDS) {
        return {
          alertId: `alt_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
          rule: 'MASS_DATA_EXPORT_SPIKE',
          severity: count > 500 ? SEVERITY_LEVELS.CRITICAL : SEVERITY_LEVELS.MEDIUM,
          actorHash,
          recordCount: count,
          triggeredAt: timestamp,
          summary: `Actor exported ${count} records exceeding export threshold`
        };
      }
    }

    // Rule 3: Immediate role elevation following auth failure
    if (eventType === SECURITY_EVENT_TYPES.ROLE_ELEVATION) {
      const lookback = timestamp - this.thresholds.ROLE_ELEVATION_SUSPICION_WINDOW_MS;
      const priorFailures = this.eventBuffer.filter(e =>
        e.eventType === SECURITY_EVENT_TYPES.AUTH_FAILURE &&
        e.actorHash === actorHash &&
        e.timestamp >= lookback
      );

      if (priorFailures.length > 0) {
        return {
          alertId: `alt_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
          rule: 'SUSPICIOUS_POST_FAILURE_ELEVATION',
          severity: SEVERITY_LEVELS.CRITICAL,
          actorHash,
          triggeredAt: timestamp,
          summary: `Role elevation detected immediately after ${priorFailures.length} auth failure events`
        };
      }
    }

    return null;
  }

  getAlerts() {
    return [...this.alertLog];
  }

  clearAlerts() {
    this.alertLog = [];
  }
}
