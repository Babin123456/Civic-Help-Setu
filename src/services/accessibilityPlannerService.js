/**
 * Public-Service Accessibility Needs Planner Service (#144)
 *
 * Implements verified office accessibility evaluations, strict unverified status labelling,
 * stale audit detection (> 180 days), personalized office visit checklists,
 * and official contact verification links.
 */

import {
  ACCESSIBILITY_FEATURE_CATALOG,
  OFFICE_ACCESSIBILITY_RECORDS,
} from '../data/officeAccessibilityData.js';
import { CIVIC_OFFICES } from '../data/locationOffices.js';

export const ACCESSIBILITY_STORAGE_KEY = 'civic_accessibility_visit_plans';
export const STALE_AUDIT_DAYS_THRESHOLD = 180;

/**
 * Returns the catalog of standard accessibility features.
 * @returns {Array}
 */
export function getAccessibilityCatalog() {
  return ACCESSIBILITY_FEATURE_CATALOG;
}

/**
 * Calculates whether an audit date is considered stale (> 180 days old).
 * @param {string} auditDateStr
 * @param {Date|string} [referenceDate=new Date()]
 * @returns {boolean}
 */
export function isAuditDateStale(auditDateStr, referenceDate = new Date()) {
  if (!auditDateStr) return true;
  const auditTime = new Date(auditDateStr).getTime();
  if (isNaN(auditTime)) return true;

  const refTime = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();
  const diffDays = Math.floor((refTime - auditTime) / (1000 * 60 * 60 * 24));
  return diffDays > STALE_AUDIT_DAYS_THRESHOLD;
}

/**
 * Retrieves the evaluated accessibility profile for an office.
 *
 * Acceptance Criteria Compliance:
 * - "Users can select an office and view known accessibility details with source dates."
 * - "Unknown accessibility information is labelled 'Not verified' rather than assumed."
 * - "The feature does not claim an accommodation is available without evidence."
 * - "Expired or older records receive a review warning."
 *
 * @param {string} officeId
 * @returns {Object} Comprehensive office accessibility profile
 */
export function getOfficeAccessibilityProfile(officeId) {
  if (!officeId || typeof officeId !== 'string') {
    return {
      officeId: null,
      office: null,
      hasAuditRecord: false,
      isStale: false,
      lastAuditedDate: null,
      officialSource: null,
      features: ACCESSIBILITY_FEATURE_CATALOG.map((f) => ({
        ...f,
        status: 'not_verified',
        statusLabel: 'Not Verified',
        notes: 'No official audit record found for this office.',
      })),
    };
  }

  const office = CIVIC_OFFICES.find((o) => o.id === officeId) || null;
  const record = OFFICE_ACCESSIBILITY_RECORDS.find((r) => r.officeId === officeId) || null;

  if (!record) {
    // Office exists but has no verified accessibility inspection record on file
    return {
      officeId,
      office,
      hasAuditRecord: false,
      isStale: false,
      lastAuditedDate: null,
      auditedBy: null,
      officialSource: office?.contact?.portalUrl
        ? { name: `${office.name} Portal`, url: office.contact.portalUrl, verified: true }
        : null,
      auditWarning: 'This office has no on-site disability or accessibility audit on record. All accessibility facilities are unverified. Please call ahead to confirm accommodation.',
      features: ACCESSIBILITY_FEATURE_CATALOG.map((f) => ({
        ...f,
        status: 'not_verified',
        statusLabel: 'Not Verified',
        notes: 'Status not verified by official audit.',
      })),
    };
  }

  const isStale = isAuditDateStale(record.lastAuditedDate);
  const auditWarning = isStale
    ? `Caution: The accessibility audit for this facility was recorded on ${record.lastAuditedDate} (over ${STALE_AUDIT_DAYS_THRESHOLD} days ago). Facility infrastructure may have changed.`
    : null;

  // Map each standard catalog feature against verified record
  const features = ACCESSIBILITY_FEATURE_CATALOG.map((f) => {
    const verifiedFeature = record.features ? record.features[f.id] : null;

    if (verifiedFeature) {
      const isAvailable = verifiedFeature.status === 'verified_available';
      return {
        ...f,
        status: verifiedFeature.status, // 'verified_available' | 'verified_unavailable'
        statusLabel: isAvailable ? 'Verified Available' : 'Verified Not Available',
        notes: verifiedFeature.notes || (isAvailable ? 'Confirmed in audit' : 'Confirmed absent in audit'),
      };
    }

    // Explicitly "Not verified" rather than assumed
    return {
      ...f,
      status: 'not_verified',
      statusLabel: 'Not Verified',
      notes: 'Not covered in latest facility audit report.',
    };
  });

  return {
    officeId,
    office,
    hasAuditRecord: true,
    isStale,
    lastAuditedDate: record.lastAuditedDate,
    auditedBy: record.auditedBy || 'Government Accessibility Directorate',
    officialSource: record.officialSource || null,
    auditWarning,
    features,
  };
}

/**
 * Builds a personal pre-visit preparation checklist based on citizen's specific accommodation needs.
 *
 * @param {string} officeId
 * @param {Array<string>} selectedFeatureIds - Array of feature IDs citizen requires
 * @returns {Object} Personalized checklist
 */
export function buildPersonalVisitChecklist(officeId, selectedFeatureIds = []) {
  const profile = getOfficeAccessibilityProfile(officeId);
  const selectedSet = new Set(selectedFeatureIds);

  const neededFeatures = profile.features.filter((f) => selectedSet.has(f.id));

  const questionsToConfirm = neededFeatures.map((f) => {
    let urgency = 'medium';
    if (f.status === 'not_verified') {
      urgency = 'high'; // Unverified items must be confirmed before visiting
    } else if (f.status === 'verified_unavailable') {
      urgency = 'critical'; // Accommodation is known to be missing!
    }

    return {
      featureId: f.id,
      title: f.title,
      status: f.status,
      statusLabel: f.statusLabel,
      question: f.confirmationQuestion,
      notes: f.notes,
      urgency,
      confirmed: false,
    };
  });

  const officePhone = profile.office?.contact?.helpline || profile.office?.contact?.phone || '1800 11 0031';
  const officeUrl = profile.office?.contact?.portalUrl || 'https://services.india.gov.in';

  return {
    officeId,
    officeName: profile.office?.name || 'Public Facilitation Office',
    lastAuditedDate: profile.lastAuditedDate,
    isStale: profile.isStale,
    officialContacts: {
      phone: officePhone,
      portalUrl: officeUrl,
      officerInCharge: profile.office?.officerInCharge || 'Helpdesk Officer',
    },
    questionsToConfirm,
  };
}

/**
 * Saves a citizen's visit checklist plan to localStorage safely.
 * @param {string} officeId
 * @param {Object} planData
 * @param {Storage} [storage=localStorage]
 * @returns {boolean}
 */
export function savePersonalVisitPlan(officeId, planData = {}, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!officeId || !storage) return false;
  try {
    const raw = storage.getItem(ACCESSIBILITY_STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[officeId] = {
      ...planData,
      updatedAt: new Date().toISOString(),
    };
    storage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads a citizen's saved visit checklist plan.
 * @param {string} officeId
 * @param {Storage} [storage=localStorage]
 * @returns {Object|null}
 */
export function loadPersonalVisitPlan(officeId, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!officeId || !storage) return null;
  try {
    const raw = storage.getItem(ACCESSIBILITY_STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all[officeId] || null;
  } catch {
    return null;
  }
}

/**
 * Exports a user-requested, plain-language visit preparation summary.
 * @param {Object} plan
 * @returns {string} Formatted markdown text
 */
export function exportVisitPlanSummary(plan) {
  if (!plan) return '';

  const lines = [
    `# ACCESSIBILITY & OFFICE VISIT CHECKLIST: ${plan.officeName}`,
    `Generated on: ${new Date().toLocaleDateString()}`,
    `Official Contact: ${plan.officialContacts?.phone} | Portal: ${plan.officialContacts?.portalUrl}`,
    '',
    plan.isStale ? '> NOTICE: Office audit is older than 180 days. Pre-visit confirmation is strongly recommended.' : '',
    '',
    '## Questions to Confirm Before Travelling to the Office',
  ];

  const questions = Array.isArray(plan.questionsToConfirm) ? plan.questionsToConfirm : [];
  if (questions.length === 0) {
    lines.push('- No specific accommodation questions selected.');
  } else {
    for (const q of questions) {
      lines.push(`- [${q.confirmed ? 'x' : ' '}] **${q.title}** [Status: ${q.statusLabel}]`);
      lines.push(`  - Confirmation question: "${q.question}"`);
      lines.push(`  - Known audit notes: ${q.notes}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('Prepared privately with Civic Help Setu. Accommodations are verified based on official audits.');

  return lines.filter(Boolean).join('\n');
}
