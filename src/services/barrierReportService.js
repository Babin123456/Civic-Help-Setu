import { can } from './accessControl';
/**
 * Citizen-Reported Service Barrier Insights Service (#148)
 *
 * Facilitates structured, privacy-conscious reporting of public service obstacles.
 *
 * Strict Compliance:
 * - Automatically redacts personal identification numbers (Aadhaar, PAN, phones).
 * - Enforces moderation queue before reports appear in public or aggregated metrics.
 * - Aggregate metrics strictly suppress identifying free text descriptions.
 * - Enforces role-based permissions for moderation actions.
 * - Discloses that reports are community observations, not official government escalations.
 */

export const BARRIER_REPORTS_STORAGE_KEY = 'civicbridge_barrier_reports';
export const BARRIER_AUDIT_LOGS_KEY = 'civicbridge_barrier_audit_logs';

export const BARRIER_CATEGORIES = {
  INACCESSIBLE_FACILITY: 'inaccessible_facility',
  BROKEN_DIGITAL_PORTAL: 'broken_digital_portal',
  UNLISTED_DOCUMENT_DEMAND: 'unlisted_document_demand',
  LANGUAGE_UNAVAILABLE: 'language_unavailable',
  CONFLICTING_PROCEDURES: 'conflicting_procedures',
  EXTREME_WAIT_TIME: 'extreme_wait_time',
  UNOFFICIAL_PAYMENT_DEMAND: 'unofficial_payment_demand',
  OTHER_SYSTEMIC_BARRIER: 'other_systemic_barrier',
};

export const BARRIER_CATEGORY_LABELS = {
  [BARRIER_CATEGORIES.INACCESSIBLE_FACILITY]: 'Physical Inaccessibility (No ramp/lift/toilet)',
  [BARRIER_CATEGORIES.BROKEN_DIGITAL_PORTAL]: 'Digital Portal Outage / Broken Web Form',
  [BARRIER_CATEGORIES.UNLISTED_DOCUMENT_DEMAND]: 'Unlisted / Arbitrary Document Demanded',
  [BARRIER_CATEGORIES.LANGUAGE_UNAVAILABLE]: 'Language Support Missing / Forms Untranslated',
  [BARRIER_CATEGORIES.CONFLICTING_PROCEDURES]: 'Contradictory Instructions Between Counters',
  [BARRIER_CATEGORIES.EXTREME_WAIT_TIME]: 'Excessive Wait Time / Arbitrary Daily Cap',
  [BARRIER_CATEGORIES.UNOFFICIAL_PAYMENT_DEMAND]: 'Unofficial Payment / Bribery Solicitation',
  [BARRIER_CATEGORIES.OTHER_SYSTEMIC_BARRIER]: 'Other Systemic Administrative Obstacle',
};

export const BARRIER_STATUS = {
  PENDING_MODERATION: 'pending_moderation',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const BARRIER_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const NON_ESCALATION_DISCLAIMER =
  'Notice: Citizen Barrier Reports are community-collected observations for civic transparency and service guide maintenance. Submitting a barrier does NOT constitute an official government complaint, CPGRAMS grievance, or legal RTI petition.';

/**
 * PII and sensitive document pattern redaction.
 * Replaces Aadhaar numbers (12 digits), PAN cards (5 letters + 4 digits + 1 letter),
 * phone numbers (10 digits), and emails with safe placeholders.
 */
export const redactSensitiveData = (text = '') => {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // 1. Aadhaar (12 digits with optional spaces or hyphens)
  sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_AADHAAR]');

  // 2. PAN Card (5 letters, 4 numbers, 1 letter)
  sanitized = sanitized.replace(/\b[A-Za-z]{5}\d{4}[A-Za-z]{1}\b/g, '[REDACTED_PAN]');

  // 3. Indian Phone Numbers (+91 or 0 prefix optional, 10 digits)
  sanitized = sanitized.replace(/\b(?:\+91[\s-]?)?[6789]\d{9}\b/g, '[REDACTED_PHONE]');

  // 4. Email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');

  return sanitized;
};

const getStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/**
 * Read all barrier reports safely from storage
 */
export const getAllBarrierReports = (storage = getStorage()) => {
  if (!storage) return [];
  try {
    const raw = storage.getItem(BARRIER_REPORTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Save updated barrier reports array
 */
const saveAllBarrierReports = (reports, storage = getStorage()) => {
  if (!storage) return false;
  try {
    storage.setItem(BARRIER_REPORTS_STORAGE_KEY, JSON.stringify(reports));
    return true;
  } catch {
    return false;
  }
};

/**
 * Submits a new citizen barrier report.
 * PII is automatically redacted and status is strictly initialized to PENDING_MODERATION.
 */
export const submitBarrierReport = (
  {
    serviceId,
    serviceName,
    department = 'General Administration',
    barrierCategory,
    description = '',
    severity = BARRIER_SEVERITY.MEDIUM,
    officeLocation = '',
  },
  storage = getStorage()
) => {
  if (!serviceId || typeof serviceId !== 'string' || !serviceId.trim()) {
    throw new Error('A valid service ID is required to submit a barrier report.');
  }

  const validCategories = Object.values(BARRIER_CATEGORIES);
  if (!barrierCategory || !validCategories.includes(barrierCategory)) {
    throw new Error('Please select a valid structured barrier category.');
  }

  const reports = getAllBarrierReports(storage);

  // Redact any accidental sensitive data in free-text fields
  const safeDescription = redactSensitiveData(description.trim());
  const safeLocation = redactSensitiveData(officeLocation.trim());

  const trackingCode = `BAR-${Math.floor(100000 + Math.random() * 900000)}`;

  const newReport = {
    id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    trackingCode,
    serviceId: serviceId.trim(),
    serviceName: serviceName || serviceId.trim(),
    department: department || 'General Administration',
    barrierCategory,
    description: safeDescription,
    severity: Object.values(BARRIER_SEVERITY).includes(severity) ? severity : BARRIER_SEVERITY.MEDIUM,
    officeLocation: safeLocation,
    status: BARRIER_STATUS.PENDING_MODERATION,
    createdAt: new Date().toISOString(),
    moderatedAt: null,
    moderatedBy: null,
    moderationNotes: null,
  };

  reports.unshift(newReport);
  saveAllBarrierReports(reports, storage);

  return {
    success: true,
    trackingCode: newReport.trackingCode,
    status: newReport.status,
    statusDescription: 'Report received and queued for community moderation.',
    disclaimer: NON_ESCALATION_DISCLAIMER,
    report: newReport,
  };
};

/**
 * Checks the moderation status of a report without implying official government escalation.
 */
export const getBarrierReportStatus = (trackingCode, storage = getStorage()) => {
  if (!trackingCode) return null;
  const reports = getAllBarrierReports(storage);
  const found = reports.find((r) => r.trackingCode === trackingCode || r.id === trackingCode);

  if (!found) return null;

  let publicStatus = 'Received';
  let publicExplanation = 'Your report has been received and is waiting for community review.';

  if (found.status === BARRIER_STATUS.APPROVED) {
    publicStatus = 'Reviewed & Anonymously Aggregated';
    publicExplanation = 'Your report has been verified by maintainers and incorporated into public systemic barrier insights.';
  } else if (found.status === BARRIER_STATUS.REJECTED) {
    publicStatus = 'Reviewed & Archived';
    publicExplanation = 'Your submission was reviewed and marked as duplicate, test, or non-actionable.';
  }

  return {
    trackingCode: found.trackingCode,
    serviceName: found.serviceName,
    barrierCategoryLabel: BARRIER_CATEGORY_LABELS[found.barrierCategory] || found.barrierCategory,
    status: publicStatus,
    explanation: publicExplanation,
    createdAt: found.createdAt,
    disclaimer: NON_ESCALATION_DISCLAIMER,
  };
};

/**
 * Permission-checked moderation action (approve or reject a barrier report).
 * Only admins or moderators can execute this function.
 */
export const moderateBarrierReport = (
  { reportId, action, reviewerNotes = '', reviewerName = 'Moderator' },
  storage = getStorage()
) => {
  // `userRole` is whatever the caller says it is, so it is not used to decide anything: the
  // signed-in user's real role is checked instead (see accessControl.js).
  if (!can('barriers.moderate')) {
    const error = new Error('Unauthorized: Only administrators or community moderators can moderate barrier reports.');
    error.code = 'UNAUTHORIZED_ACCESS';
    throw error;
  }

  if (action !== 'approve' && action !== 'reject') {
    throw new Error('Invalid moderation action. Must be "approve" or "reject".');
  }

  const reports = getAllBarrierReports(storage);
  const index = reports.findIndex((r) => r.id === reportId);
  if (index === -1) {
    throw new Error(`Barrier report with ID ${reportId} not found.`);
  }

  const newStatus = action === 'approve' ? BARRIER_STATUS.APPROVED : BARRIER_STATUS.REJECTED;

  reports[index] = {
    ...reports[index],
    status: newStatus,
    moderatedAt: new Date().toISOString(),
    moderatedBy: reviewerName,
    moderationNotes: reviewerNotes.trim(),
  };

  saveAllBarrierReports(reports, storage);

  return {
    success: true,
    reportId,
    newStatus,
    updatedReport: reports[index],
  };
};

/**
 * Returns privacy-preserving, aggregated barrier insights.
 * CRITICAL ACCEPTANCE CRITERIA:
 * "Dashboard metrics use aggregation and suppress identifying free text."
 * Strictly ignores pending/rejected reports and never includes `description` or `officeLocation` text.
 */
export const getAggregatedBarrierInsights = (storage = getStorage()) => {
  const reports = getAllBarrierReports(storage);

  // ONLY approved reports are aggregated
  const approvedReports = reports.filter((r) => r.status === BARRIER_STATUS.APPROVED);

  const totalReportsCount = reports.length;
  const pendingCount = reports.filter((r) => r.status === BARRIER_STATUS.PENDING_MODERATION).length;
  const approvedCount = approvedReports.length;
  const rejectedCount = reports.filter((r) => r.status === BARRIER_STATUS.REJECTED).length;

  // 1. Group by category
  const categoryCounts = {};
  Object.values(BARRIER_CATEGORIES).forEach((cat) => {
    categoryCounts[cat] = 0;
  });

  // 2. Group by department / service
  const departmentCounts = {};

  // 3. Group by severity
  const severityCounts = {
    [BARRIER_SEVERITY.LOW]: 0,
    [BARRIER_SEVERITY.MEDIUM]: 0,
    [BARRIER_SEVERITY.HIGH]: 0,
    [BARRIER_SEVERITY.CRITICAL]: 0,
  };

  approvedReports.forEach((rep) => {
    if (categoryCounts[rep.barrierCategory] != null) {
      categoryCounts[rep.barrierCategory] += 1;
    } else {
      categoryCounts[rep.barrierCategory] = 1;
    }

    const dept = rep.department || 'General Administration';
    departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;

    if (severityCounts[rep.severity] != null) {
      severityCounts[rep.severity] += 1;
    }
  });

  // Calculate percentages
  const categoryBreakdown = Object.entries(categoryCounts).map(([catKey, count]) => ({
    categoryKey: catKey,
    label: BARRIER_CATEGORY_LABELS[catKey] || catKey,
    count,
    percentage: approvedCount > 0 ? Math.round((count / approvedCount) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  const departmentBreakdown = Object.entries(departmentCounts).map(([dept, count]) => ({
    department: dept,
    count,
    percentage: approvedCount > 0 ? Math.round((count / approvedCount) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  return {
    totalReportsCount,
    pendingCount,
    approvedCount,
    rejectedCount,
    categoryBreakdown,
    departmentBreakdown,
    severityCounts,
    dataPrivacyNotice:
      'All insights presented here are mathematically aggregated. Individual user free-text statements, contact details, and locations are strictly suppressed.',
  };
};
