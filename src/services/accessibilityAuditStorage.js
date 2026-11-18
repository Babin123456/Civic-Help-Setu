/**
 * Offline Accessibility Audit Vault & Minimization Service (#948)
 *
 * Implements client-side, privacy-preserving persistence under civicbridge_accessibility_audit_vault.
 *
 * Strict Privacy & Security Guarantees:
 * - Persists only structured measurements, compliance benchmarks, and remediation plans.
 * - Free text personal details, complainant names, phone numbers, and coordinates are excluded.
 * - Computes deterministic SHA-256 seal for tamper detection.
 * - Supports immutable reassessment history across inspection cycles.
 */

import { MEASURED_BENCHMARKS } from './accessibilityAuditService.js';

export const ACCESSIBILITY_VAULT_KEY = 'civicbridge_accessibility_audit_vault';

const LEGACY_KEYS = ['ramp', 'rails', 'door', 'tactile', 'washroom', 'lift'];

/**
 * Minimizes legacy checklist answers.
 */
export function minimizeAudit(answers = {}) {
  const source = answers && typeof answers === 'object' && answers.answers ? answers.answers : answers || {};
  return Object.fromEntries(
    LEGACY_KEYS.map(key => [
      key,
      ['yes', 'no', 'unknown', 'na'].includes(source[key]) ? source[key] : 'unknown',
    ])
  );
}

/**
 * Sanitizes structured measurements against allowed benchmark keys.
 */
export function sanitizeMeasurements(measurements = {}) {
  if (!measurements || typeof measurements !== 'object') return {};

  const allowedKeys = new Set(MEASURED_BENCHMARKS.map(b => b.key));
  const sanitized = {};

  for (const [key, val] of Object.entries(measurements)) {
    if (!allowedKeys.has(key)) continue;

    if (val === 'unknown' || val === 'na' || val === 'NA') {
      sanitized[key] = val.toLowerCase();
    } else if (val !== null && val !== undefined && val !== '') {
      const num = Number(val);
      if (Number.isFinite(num) && num >= 0) {
        sanitized[key] = Math.round(num * 10) / 10;
      } else {
        sanitized[key] = 'unknown';
      }
    } else {
      sanitized[key] = 'unknown';
    }
  }

  return sanitized;
}

/**
 * Sanitizes remediation plan entries.
 */
export function sanitizeRemediationPlan(plan = []) {
  if (!Array.isArray(plan)) return [];

  return plan.map(item => ({
    id: String(item.id || item.key || '').slice(0, 100),
    key: String(item.key || '').slice(0, 100),
    facility: String(item.facility || '').slice(0, 100),
    label: String(item.label || '').slice(0, 200),
    measuredValue: item.measuredValue !== undefined && item.measuredValue !== null ? Number(item.measuredValue) : null,
    unit: String(item.unit || '').slice(0, 20),
    benchmarkDisplay: String(item.benchmarkDisplay || '').slice(0, 100),
    gap: item.gap !== undefined && item.gap !== null ? Number(item.gap) : null,
    critical: Boolean(item.critical),
    priority: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(item.priority) ? item.priority : 'HIGH',
    recommendedAction: String(item.recommendedAction || '').slice(0, 300),
    targetDays: Number.isSafeInteger(item.targetDays) ? item.targetDays : 30,
    targetDate: String(item.targetDate || '').slice(0, 20),
    responsibleParty: String(item.responsibleParty || '').slice(0, 100),
    status: ['IDENTIFIED', 'PLANNED', 'IN_PROGRESS', 'REMEDIATED', 'VERIFIED'].includes(item.status)
      ? item.status
      : 'IDENTIFIED',
    notes: String(item.notes || '').slice(0, 500),
  }));
}

/**
 * Sanitizes reassessment history records.
 */
export function sanitizeReassessments(reassessments = []) {
  if (!Array.isArray(reassessments)) return [];

  return reassessments.map(r => ({
    reassessmentId: String(r.reassessmentId || '').slice(0, 100),
    reassessedAt: String(r.reassessedAt || new Date().toISOString()).slice(0, 50),
    assessorNotes: String(r.assessorNotes || '').slice(0, 500),
    measurements: sanitizeMeasurements(r.measurements || {}),
    evaluation: {
      score: r.evaluation?.score !== undefined ? r.evaluation.score : null,
      compliantCount: Number(r.evaluation?.compliantCount || 0),
      nonCompliantCount: Number(r.evaluation?.nonCompliantCount || 0),
      criticalHazardsCount: Number(r.evaluation?.criticalHazardsCount || 0),
    },
    resolvedBarriers: Array.isArray(r.resolvedBarriers) ? r.resolvedBarriers.map(s => String(s).slice(0, 200)) : [],
    unresolvedBarriers: Array.isArray(r.unresolvedBarriers) ? r.unresolvedBarriers.map(s => String(s).slice(0, 200)) : [],
  }));
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Computes deterministic SHA-256 seal for an audit record.
 */
export async function auditDigest(record) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requires a secure browser context.');
  const payload = Object.fromEntries(Object.entries(record).filter(([k]) => k !== 'seal'));
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(payload)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies whether an audit record's seal matches its contents.
 */
export async function verifyAudit(record) {
  return Boolean(record?.seal && record.seal === (await auditDigest(record)));
}

/**
 * Lists all stored accessibility audits from localStorage.
 */
export function listAudits() {
  const raw = localStorage.getItem(ACCESSIBILITY_VAULT_KEY);
  if (!raw) return [];
  try {
    const records = JSON.parse(raw);
    if (!Array.isArray(records)) throw new Error('Invalid vault data.');
    return records;
  } catch {
    return [];
  }
}

/**
 * Saves or updates an audit record in localStorage with cryptographic seal.
 */
export async function saveAudit(input) {
  const isFull =
    input &&
    typeof input === 'object' &&
    ('measurements' in input || 'remediationPlan' in input || 'reassessments' in input || 'facilityName' in input);

  if (!isFull) {
    // Pure legacy call
    const legacyRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      answers: minimizeAudit(input),
    };
    legacyRecord.seal = await auditDigest(legacyRecord);
    localStorage.setItem(ACCESSIBILITY_VAULT_KEY, JSON.stringify([legacyRecord, ...listAudits()]));
    return legacyRecord;
  }

  const facilityName = input.facilityName ? String(input.facilityName).slice(0, 100) : '';
  const district = input.district ? String(input.district).slice(0, 100) : '';

  const record = {
    id: input.id || crypto.randomUUID(),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    facilityName,
    district,
    answers: minimizeAudit(input.answers || input),
    measurements: sanitizeMeasurements(input.measurements || {}),
    remediationPlan: sanitizeRemediationPlan(input.remediationPlan || []),
    reassessments: sanitizeReassessments(input.reassessments || []),
  };

  record.seal = await auditDigest(record);

  const current = listAudits();
  const existingIdx = current.findIndex(r => r.id === record.id);
  let updated;
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = record;
  } else {
    updated = [record, ...current];
  }

  localStorage.setItem(ACCESSIBILITY_VAULT_KEY, JSON.stringify(updated));
  return record;
}

/**
 * Deletes an audit by ID.
 */
export function deleteAudit(id) {
  localStorage.setItem(ACCESSIBILITY_VAULT_KEY, JSON.stringify(listAudits().filter(r => r.id !== id)));
}
