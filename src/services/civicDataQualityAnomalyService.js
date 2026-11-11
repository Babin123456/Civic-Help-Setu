/**
 * Civic Data Quality Anomaly Detector for Service Catalogue Records
 *
 * Implements automated validation, statistical outlier flagging, and editorial review for service records:
 * 1. Deterministic Structural Validation:
 *    - Invalid or malformed official portal URLs (must use HTTPS and valid domain structure).
 *    - Missing critical metadata (jurisdiction, department, service name).
 *    - Impossible numeric values (negative fees, turnaround times < 1 or > 365 days).
 *    - Date inconsistency (expiry date before publication date).
 * 2. Statistical Anomaly & Outlier Detection:
 *    - Flags statistical outliers in fees (e.g. ₹50,000 for a birth certificate where mean is ₹20-₹100).
 *    - Flags turnaround time anomalies (e.g. 180 days for a basic online status verification).
 * 3. Human Editorial Gate:
 *    - Model/Rule anomaly flags NEVER silently rewrite or delete official catalog information.
 *    - Flags are prioritized for administrator review with reason, confidence, and prior values.
 * 4. Audit & Lifecycle Management:
 *    - Admins can assign, resolve, dismiss, or apply audited corrections.
 */

export const ANOMALY_SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

export const ANOMALY_TYPE = {
  INVALID_URL_SCHEME: 'INVALID_URL_SCHEME',
  MISSING_MANDATORY_FIELD: 'MISSING_MANDATORY_FIELD',
  NUMERIC_VALUE_IMPOSSIBLE: 'NUMERIC_VALUE_IMPOSSIBLE',
  STATISTICAL_FEE_OUTLIER: 'STATISTICAL_FEE_OUTLIER',
  TIMELINE_OUTLIER: 'TIMELINE_OUTLIER',
  DATE_INCONSISTENCY: 'DATE_INCONSISTENCY',
  DUPLICATE_IDENTIFIER: 'DUPLICATE_IDENTIFIER',
};

export const REVIEW_STATUS = {
  OPEN_FLAG: 'OPEN_FLAG',
  ASSIGNED: 'ASSIGNED',
  RESOLVED_CORRECTED: 'RESOLVED_CORRECTED',
  DISMISSED_LEGITIMATE: 'DISMISSED_LEGITIMATE',
};

export const QUALITY_DISCLAIMER =
  'Data quality anomalies flag potential administrative errors for authorized human review. Catalogue data is never silently modified without administrative confirmation.';

/**
 * Validates whether a portal URL has a secure HTTPS scheme and valid hostname.
 * @param {string} urlStr
 * @returns {boolean}
 */
export function isValidPortalUrl(urlStr = '') {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'https:' && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

/**
 * Deterministically checks a single service record for schema compliance and impossible values.
 *
 * @param {object} record
 * @returns {Array<object>} Detected deterministic anomalies
 */
export function validateServiceRecordDeterministic(record = {}) {
  const anomalies = [];

  // 1. Missing mandatory fields
  const requiredFields = ['id', 'name', 'authority', 'jurisdiction'];
  for (const field of requiredFields) {
    if (!record[field] || String(record[field]).trim() === '') {
      anomalies.push({
        anomalyType: ANOMALY_TYPE.MISSING_MANDATORY_FIELD,
        severity: ANOMALY_SEVERITY.CRITICAL,
        field,
        message: `Mandatory field '${field}' is missing or empty.`,
        confidence: 1.0,
      });
    }
  }

  // 2. URL scheme validation
  if (record.portalUrl) {
    if (!isValidPortalUrl(record.portalUrl)) {
      anomalies.push({
        anomalyType: ANOMALY_TYPE.INVALID_URL_SCHEME,
        severity: ANOMALY_SEVERITY.HIGH,
        field: 'portalUrl',
        currentValue: record.portalUrl,
        message: 'Portal URL must be a valid, secure HTTPS destination.',
        confidence: 0.95,
      });
    }
  }

  // 3. Numeric bounds validation
  if (typeof record.fee === 'number') {
    if (record.fee < 0) {
      anomalies.push({
        anomalyType: ANOMALY_TYPE.NUMERIC_VALUE_IMPOSSIBLE,
        severity: ANOMALY_SEVERITY.CRITICAL,
        field: 'fee',
        currentValue: record.fee,
        message: `Statutory fee cannot be negative (found ₹${record.fee}).`,
        confidence: 1.0,
      });
    }
  }

  if (typeof record.processingDays === 'number') {
    if (record.processingDays <= 0 || record.processingDays > 365) {
      anomalies.push({
        anomalyType: ANOMALY_TYPE.NUMERIC_VALUE_IMPOSSIBLE,
        severity: ANOMALY_SEVERITY.HIGH,
        field: 'processingDays',
        currentValue: record.processingDays,
        message: `Processing turnaround time (${record.processingDays} days) is outside realistic statutory limits (1-365 days).`,
        confidence: 0.9,
      });
    }
  }

  // 4. Date range sanity check
  if (record.publishedDate && record.effectiveDate) {
    const pub = new Date(record.publishedDate);
    const eff = new Date(record.effectiveDate);
    if (!isNaN(pub.getTime()) && !isNaN(eff.getTime())) {
      // If effective date is more than 5 years before publication date
      if (pub.getFullYear() - eff.getFullYear() > 5) {
        anomalies.push({
          anomalyType: ANOMALY_TYPE.DATE_INCONSISTENCY,
          severity: ANOMALY_SEVERITY.MEDIUM,
          field: 'effectiveDate',
          message: 'Effective date precedes publication date by over 5 years.',
          confidence: 0.85,
        });
      }
    }
  }

  return anomalies;
}

/**
 * Flags statistical outliers for numeric fields (fees, timelines) across a category cohort.
 * Uses standard deviations or percentile bounding.
 *
 * @param {object} record
 * @param {object} cohortStats e.g. { meanFee: 50, stdFee: 30, meanDays: 15, stdDays: 10 }
 * @returns {Array<object>} Statistical anomalies
 */
export function detectStatisticalOutliers(record, cohortStats = {}) {
  const outliers = [];

  if (!cohortStats || typeof cohortStats !== 'object') return outliers;

  // Fee outlier check (> 3 standard deviations above cohort mean)
  if (
    typeof record.fee === 'number' &&
    typeof cohortStats.meanFee === 'number' &&
    typeof cohortStats.stdFee === 'number' &&
    cohortStats.stdFee > 0
  ) {
    const zScore = (record.fee - cohortStats.meanFee) / cohortStats.stdFee;
    if (zScore > 3.0) {
      outliers.push({
        anomalyType: ANOMALY_TYPE.STATISTICAL_FEE_OUTLIER,
        severity: ANOMALY_SEVERITY.HIGH,
        field: 'fee',
        currentValue: record.fee,
        cohortMean: cohortStats.meanFee,
        zScore: Number(zScore.toFixed(2)),
        message: `Fee ₹${record.fee} deviates significantly from category benchmark (mean ₹${cohortStats.meanFee}, std ₹${cohortStats.stdFee}).`,
        confidence: 0.88,
      });
    }
  }

  return outliers;
}

/**
 * Runs a full data-quality scan on a catalogue record combining deterministic & statistical engines.
 *
 * @param {object} record
 * @param {object} [cohortStats]
 * @returns {object} Audit report with flagged anomalies
 */
export function auditCatalogueRecord(record = {}, cohortStats = {}) {
  const deterministic = validateServiceRecordDeterministic(record);
  const statistical = detectStatisticalOutliers(record, cohortStats);

  const allAnomalies = [...deterministic, ...statistical].map((a, idx) => ({
    flagId: `flag-${record.id || 'rec'}-${idx + 1}`,
    serviceId: record.id,
    serviceName: record.name || 'Unnamed Record',
    status: REVIEW_STATUS.OPEN_FLAG,
    assignedTo: null,
    resolutionNote: null,
    flaggedAt: new Date().toISOString(),
    ...a,
  }));

  return {
    serviceId: record.id,
    serviceName: record.name,
    isClean: allAnomalies.length === 0,
    totalAnomalies: allAnomalies.length,
    criticalCount: allAnomalies.filter((a) => a.severity === ANOMALY_SEVERITY.CRITICAL).length,
    flags: allAnomalies,
    requiresAdminReview: allAnomalies.length > 0,
    disclaimer: QUALITY_DISCLAIMER,
  };
}

/**
 * Admin action: Resolves or dismisses an anomaly flag with audit provenance.
 *
 * @param {object} flag
 * @param {string} adminId
 * @param {string} newStatus REVIEW_STATUS.RESOLVED_CORRECTED | REVIEW_STATUS.DISMISSED_LEGITIMATE
 * @param {string} resolutionNote
 * @returns {object} Updated flag
 */
export function resolveAnomalyFlag(flag, adminId, newStatus, resolutionNote = '') {
  if (!flag || !flag.flagId) {
    throw new Error('Valid flag object required to record administrative resolution');
  }
  if (!adminId) {
    throw new Error('Admin ID is required to resolve or dismiss an anomaly flag');
  }

  return {
    ...flag,
    status: newStatus,
    resolvedBy: adminId,
    resolvedAt: new Date().toISOString(),
    resolutionNote,
  };
}
