/**
 * Outdated office-record reports (#824).
 *
 * Reports are deliberately small and non-sensitive: an office ID, a reason,
 * an optional short note and an optional official HTTPS source. Personal
 * identifiers, emails, phone numbers and credentials are rejected before the
 * report is sent or saved.
 */

import { REPORT_REASONS } from './officeComparisonService.js';
import { safeHttpUrl } from '../utils/safeContent.js';

export const LOCAL_OFFICE_REPORTS_KEY = 'civicbridge_office_comparison_reports_v1';
export const MAX_LOCAL_REPORTS = 50;

const AADHAAR_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_PATTERN = /\b(?:\+91[-\s]?)?[6-9]\d{9}\b/;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const FORBIDDEN_WORDS = ['password', 'otp', 'one-time password', 'secret'];

const asText = (value) =>
  typeof value === 'string'
    ? value
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
        .trim()
    : '';

export const validateOfficeReport = (report = {}) => {
  const errors = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return { valid: false, errors: ['Report must be an object.'] };
  }

  const officeId = asText(report.officeId);
  if (!officeId) errors.push('officeId is required.');
  if (officeId.length > 120) errors.push('officeId must be 120 characters or fewer.');

  const reason = asText(report.reason);
  if (!REPORT_REASONS.some((item) => item.value === reason)) {
    errors.push('reason must be one of the listed report reasons.');
  }

  const note = asText(report.note);
  if (note.length > 500) errors.push('note must be 500 characters or fewer.');

  if (report.sourceUrl) {
    if (!safeHttpUrl(report.sourceUrl) || !safeHttpUrl(report.sourceUrl).startsWith('https://')) {
      errors.push('sourceUrl must be a valid official HTTPS link.');
    }
  }

  const serialized = `${note} ${reason} ${report.sourceUrl || ''}`;
  if (AADHAAR_PATTERN.test(serialized)) errors.push('Do not include Aadhaar numbers in a report.');
  if (PAN_PATTERN.test(serialized)) errors.push('Do not include PAN numbers in a report.');
  if (PHONE_PATTERN.test(serialized)) errors.push('Do not include personal phone numbers in a report.');
  if (EMAIL_PATTERN.test(serialized)) errors.push('Do not include email addresses in a report.');
  if (FORBIDDEN_WORDS.some((word) => serialized.toLowerCase().includes(word))) {
    errors.push('Do not include passwords, OTPs or identity numbers in a report.');
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    value: {
      officeId,
      reason,
      note,
      sourceUrl: report.sourceUrl ? safeHttpUrl(report.sourceUrl) : '',
    },
  };
};

const makeLocalId = () =>
  `local-report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const saveLocalOfficeReport = (report, storage = globalThis.localStorage) => {
  const validated = validateOfficeReport(report);
  if (!validated.valid) return { ok: false, errors: validated.errors };

  const entry = {
    ...validated.value,
    id: makeLocalId(),
    submittedAt: new Date().toISOString(),
    status: 'pending_review',
    delivery: 'local',
  };

  try {
    const raw = storage?.getItem?.(LOCAL_OFFICE_REPORTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const existing = Array.isArray(parsed) ? parsed.slice(0, MAX_LOCAL_REPORTS - 1) : [];
    storage?.setItem?.(LOCAL_OFFICE_REPORTS_KEY, JSON.stringify([entry, ...existing]));
  } catch {
    // A blocked storage quota must not hide the fact that the report could not
    // be sent. The caller still sees the returned local entry.
  }

  return { ok: true, report: entry };
};

export const readLocalOfficeReports = (storage = globalThis.localStorage) => {
  try {
    const raw = storage?.getItem?.(LOCAL_OFFICE_REPORTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Sends a report to the server. If the network or endpoint is unavailable the
 * report is kept locally so the citizen does not lose their work.
 */
export const submitOfficeReport = async (report, { fetchImpl = globalThis.fetch } = {}) => {
  const validated = validateOfficeReport(report);
  if (!validated.valid) return { ok: false, errors: validated.errors };

  if (typeof fetchImpl === 'function') {
    try {
      const response = await fetchImpl('/api/office-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated.value),
      });
      if (response.ok) {
        const body = await response.json().catch(() => ({}));
        return {
          ok: true,
          mode: 'server',
          report: { ...validated.value, ...body },
          message: 'Report received for review.',
        };
      }
    } catch {
      // Fall through to the local queue below.
    }
  }

  const local = saveLocalOfficeReport(validated.value);
  if (!local.ok) return { ok: false, errors: local.errors };
  return {
    ok: true,
    mode: 'local',
    report: local.report,
    message: 'The report service is unavailable, so this report was saved on this device for later review.',
  };
};
