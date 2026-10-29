/**
 * Report Service: Manages citizen reports for outdated or inaccurate civic information.
 * Follows strict field validation, privacy-preserving optional fields, and auditable storage.
 */
import { logDiagnostic } from '../utils/diagnostics';

export const OUTDATED_REPORTS_STORAGE_KEY = 'civicbridge_error_reports';

export const ISSUE_CATEGORIES = {
  FEES_CHANGED: 'fees_changed',
  DOCUMENTS_CHANGED: 'documents_changed',
  ELIGIBILITY_CHANGED: 'eligibility_changed',
  BROKEN_LINK: 'broken_link',
  PROCEDURAL_CHANGE: 'procedural_change',
  OTHER: 'other',
};

export const ISSUE_CATEGORY_LABELS = {
  [ISSUE_CATEGORIES.FEES_CHANGED]: 'Fee Structure Changed',
  [ISSUE_CATEGORIES.DOCUMENTS_CHANGED]: 'Document Requirements Changed',
  [ISSUE_CATEGORIES.ELIGIBILITY_CHANGED]: 'Eligibility Criteria Changed',
  [ISSUE_CATEGORIES.BROKEN_LINK]: 'Broken / Inactive Official Link',
  [ISSUE_CATEGORIES.PROCEDURAL_CHANGE]: 'Procedure / Steps Outdated',
  [ISSUE_CATEGORIES.OTHER]: 'Other Information Discrepancy',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates whether a string is a safe, well-formed HTTP/HTTPS URL
 */
export const isValidWebUrl = (urlString) => {
  if (!urlString || typeof urlString !== 'string') return false;
  const trimmed = urlString.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validates report payload before submission
 * @param {Object} input
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export const validateReportInput = (input = {}) => {
  const errors = {};

  // 1. Service Identification
  if (!input.serviceId || typeof input.serviceId !== 'string' || !input.serviceId.trim()) {
    errors.serviceId = 'A valid service must be identified.';
  }

  if (!input.serviceName || typeof input.serviceName !== 'string' || !input.serviceName.trim()) {
    errors.serviceName = 'Service name is required.';
  }

  // 2. Issue Category
  const validCategories = Object.values(ISSUE_CATEGORIES);
  if (!input.issueCategory || !validCategories.includes(input.issueCategory)) {
    errors.issueCategory = 'Please select a valid discrepancy category.';
  }

  // 3. Description Validation (min 10 chars, max 1500 chars)
  const desc = (input.description || '').trim();
  if (!desc) {
    errors.description = 'Please describe the outdated or incorrect information.';
  } else if (desc.length < 10) {
    errors.description = 'Description must be at least 10 characters so moderators can locate the issue.';
  } else if (desc.length > 1500) {
    errors.description = 'Description cannot exceed 1500 characters.';
  }

  // 4. Optional Official Source URL Validation
  if (input.officialSourceUrl && input.officialSourceUrl.trim()) {
    const url = input.officialSourceUrl.trim();
    if (!isValidWebUrl(url)) {
      errors.officialSourceUrl = 'Official source URL must be a valid web address starting with http:// or https://';
    }
  }

  // 5. Optional Reporter Email Validation (Privacy compliant: strictly optional)
  if (input.reporterEmail && input.reporterEmail.trim()) {
    const email = input.reporterEmail.trim();
    if (!EMAIL_REGEX.test(email)) {
      errors.reporterEmail = 'Please provide a valid email address or leave the field blank.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Retrieves all stored outdated reports
 */
export const getAllOutdatedReports = () => {
  try {
    const raw = localStorage.getItem(OUTDATED_REPORTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logDiagnostic('Failed to read outdated reports from localStorage:', err);
    return [];
  }
};

/**
 * Submits a new verified outdated information report
 * @param {Object} reportData
 * @returns {{ ok: boolean, report?: Object, errors?: Record<string, string>, message: string }}
 */
export const submitOutdatedReport = (reportData) => {
  const validation = validateReportInput(reportData);
  if (!validation.isValid) {
    return {
      ok: false,
      errors: validation.errors,
      message: 'Please resolve the validation errors before submitting.',
    };
  }

  const existingReports = getAllOutdatedReports();

  // Create immutable timestamped report
  const now = new Date();
  const reportId = `rep_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`;

  const newReport = {
    id: reportId,
    serviceId: reportData.serviceId.trim(),
    serviceName: reportData.serviceName.trim(),
    issueCategory: reportData.issueCategory,
    issueType: ISSUE_CATEGORY_LABELS[reportData.issueCategory] || 'Incorrect Information',
    description: reportData.description.trim(),
    officialSourceUrl: reportData.officialSourceUrl ? reportData.officialSourceUrl.trim() : null,
    reporterEmail: reportData.reporterEmail ? reportData.reporterEmail.trim() : 'anonymous.citizen@civicbridge.setu',
    status: 'pending', // 'pending' | 'verified' | 'resolved' | 'dismissed'
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    resolutionNotes: null,
  };

  try {
    const updated = [newReport, ...existingReports];
    localStorage.setItem(OUTDATED_REPORTS_STORAGE_KEY, JSON.stringify(updated));
    return {
      ok: true,
      report: newReport,
      referenceId: reportId,
      message: 'Thank you! Your report has been submitted to the civic review queue.',
    };
  } catch (err) {
    logDiagnostic('Failed to persist outdated report:', err);
    return {
      ok: false,
      message: 'Unable to save report due to local storage limitation. Please try again.',
    };
  }
};

/**
 * Fetches all reports submitted for a specific service ID
 */
export const getReportsByServiceId = (serviceId) => {
  if (!serviceId) return [];
  const all = getAllOutdatedReports();
  return all.filter((r) => r.serviceId === serviceId);
};

/**
 * Updates report moderation status
 */
export const updateReportModerationStatus = (reportId, newStatus, resolutionNotes = '') => {
  const validStatuses = ['pending', 'verified', 'resolved', 'dismissed'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid report status: ${newStatus}`);
  }

  const all = getAllOutdatedReports();
  const targetIndex = all.findIndex((r) => r.id === reportId);
  if (targetIndex === -1) {
    return { ok: false, message: 'Report not found' };
  }

  all[targetIndex] = {
    ...all[targetIndex],
    status: newStatus,
    resolutionNotes: resolutionNotes ? resolutionNotes.trim() : all[targetIndex].resolutionNotes,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(OUTDATED_REPORTS_STORAGE_KEY, JSON.stringify(all));
    return { ok: true, report: all[targetIndex] };
  } catch (err) {
    logDiagnostic('Failed to update report status:', err);
    return { ok: false, message: 'Storage error' };
  }
};
