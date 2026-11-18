/**
 * Small-Business Licence Renewal and Closure Service (#721)
 *
 * Provides lifecycle management, multi-establishment tracking,
 * dual-track licensing (Municipal vs Sector-specific), conditional amendment evidence,
 * 3-phase closure workflow with surrender acknowledgement tracking,
 * zero-PII data sanitization, and staleness detection.
 */

import {
  MUNICIPAL_JURISDICTIONS,
  LICENCE_CATALOG,
  AMENDMENT_REQUIREMENTS,
  SUSPENSION_REQUIREMENTS,
  CLOSURE_AND_SURRENDER_WORKFLOW,
  DATA_STALENESS_HORIZON_DAYS,
  STATUTORY_LEGAL_DISCLAIMER
} from '../data/smallBusinessLicenceData.js';

const STORAGE_KEY_ESTABLISHMENTS = 'civicbridge_small_business_establishments_v1';
const STORAGE_KEY_CHECKLIST_PROGRESS = 'civicbridge_business_checklist_progress_v1';

// In-memory fallback store when localStorage is unavailable or in node/test environments
let memoryEstablishmentStore = [];
let memoryChecklistProgressStore = {};
let memoryCorrectionProposals = [];

/**
 * Reset memory stores (primarily for Vitest isolation)
 */
export const _resetInternalStores = () => {
  memoryEstablishmentStore = [];
  memoryChecklistProgressStore = {};
  memoryCorrectionProposals = [];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY_ESTABLISHMENTS);
      window.localStorage.removeItem(STORAGE_KEY_CHECKLIST_PROGRESS);
    }
  } catch {
    // Ignore storage clearing issues
  }
};

/**
 * PII scrubbing patterns
 */
export const PII_PATTERNS = {
  aadhaar: /\b[2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/g,
  pan: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
  gstin: /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g,
  phone: /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
};

/**
 * Sanitizes arbitrary text by stripping PII and harmful tags
 */
export const sanitizeAndRedactText = (text, maxLength = 1000) => {
  if (typeof text !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  let cleaned = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '').trim();
  cleaned = cleaned.replace(/<\/?[A-Za-z][^<>]*(?:>|$)/g, '');

  cleaned = cleaned.replace(PII_PATTERNS.gstin, '[REDACTED_GSTIN]');
  cleaned = cleaned.replace(PII_PATTERNS.pan, '[REDACTED_PAN]');
  cleaned = cleaned.replace(PII_PATTERNS.aadhaar, '[REDACTED_AADHAAR]');
  cleaned = cleaned.replace(PII_PATTERNS.phone, '[REDACTED_PHONE]');
  cleaned = cleaned.replace(PII_PATTERNS.email, '[REDACTED_EMAIL]');

  return cleaned.slice(0, maxLength);
};

/**
 * Safe localStorage reader with memory fallback
 */
const readStorage = (key, fallback) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    }
  } catch {
    // Fall back to memory
  }
  if (key === STORAGE_KEY_ESTABLISHMENTS) return memoryEstablishmentStore;
  if (key === STORAGE_KEY_CHECKLIST_PROGRESS) return memoryChecklistProgressStore;
  return fallback;
};

/**
 * Safe localStorage writer with memory fallback
 */
const writeStorage = (key, value) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Fall back to memory
  }
  if (key === STORAGE_KEY_ESTABLISHMENTS) memoryEstablishmentStore = value;
  if (key === STORAGE_KEY_CHECKLIST_PROGRESS) memoryChecklistProgressStore = value;
};

/**
 * Determines whether a statutory record exceeds the verification horizon
 */
export const isDataStale = (record, maxDays = DATA_STALENESS_HORIZON_DAYS) => {
  if (!record || !record.verificationTimestamp) return true;
  const verifiedDate = new Date(record.verificationTimestamp);
  if (Number.isNaN(verifiedDate.getTime())) return true;
  const ageDays = (Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > maxDays;
};

/**
 * Resolves municipal jurisdiction and returns explicit fallback for unlisted areas
 */
export const resolveJurisdiction = (jurisdictionKey) => {
  const match = MUNICIPAL_JURISDICTIONS.find((j) => j.key === jurisdictionKey);
  if (!match || match.key === 'UNLISTED_JURISDICTION' || !match.verified) {
    return {
      key: jurisdictionKey || 'UNLISTED_JURISDICTION',
      isSupported: false,
      status: 'UNAVAILABLE_OR_UNVERIFIED',
      authorityName: match?.authorityName || 'Jurisdictional Urban Local Body',
      statutoryAct: 'State Municipal Act (Uncatalogued locally)',
      portalUrl: null,
      disclaimer: STATUTORY_LEGAL_DISCLAIMER,
      recommendedAction:
        'Official rules for this jurisdiction have not been verified against a dated municipal gazette. Do not rely on assumed deadlines. Approach the local Municipal Ward Licensing Inspector or District Urban Development Cell directly.'
    };
  }

  return {
    ...match,
    isSupported: true,
    status: 'VERIFIED',
    disclaimer: STATUTORY_LEGAL_DISCLAIMER,
    isStale: isDataStale(match)
  };
};

/**
 * Retrieves all registered licences filtered by track ('MUNICIPAL', 'SECTOR_SPECIFIC', 'ALL')
 * and optional business category filter.
 */
export const getLicencesByTrack = (track = 'ALL', categoryId = null) => {
  return LICENCE_CATALOG.filter((licence) => {
    const matchesTrack = track === 'ALL' || licence.track === track;
    const matchesCategory = !categoryId || licence.categoryScope.includes(categoryId);
    return matchesTrack && matchesCategory;
  }).map((licence) => ({
    ...licence,
    isStale: isDataStale(licence)
  }));
};

/**
 * Retrieves amendment requirements with conditional evidence
 */
export const getAmendmentRequirements = (type = 'ADDRESS_CHANGE') => {
  const req = AMENDMENT_REQUIREMENTS[type];
  if (!req) return null;
  return {
    type,
    ...req,
    disclaimer: STATUTORY_LEGAL_DISCLAIMER
  };
};

/**
 * Retrieves temporary suspension checkpoints and guidelines
 */
export const getSuspensionRequirements = () => {
  return {
    ...SUSPENSION_REQUIREMENTS,
    disclaimer: STATUTORY_LEGAL_DISCLAIMER
  };
};

/**
 * Retrieves 3-phase closure, final dues, and surrender acknowledgement workflow
 */
export const getClosureWorkflow = () => {
  return {
    workflowPhases: CLOSURE_AND_SURRENDER_WORKFLOW,
    mandatoryRetainerNote:
      'Retain physical and digital Surrender Acknowledgement Receipts for a minimum of 7 years to legally defend against retroactive municipal or commercial tax demand notices.',
    disclaimer: STATUTORY_LEGAL_DISCLAIMER
  };
};

/**
 * Calculates remaining days until expiry and urgency status
 */
export const calculateExpiryStatus = (expiryDateStr, reminderOffsetDays = 30) => {
  if (!expiryDateStr) {
    return {
      daysRemaining: null,
      status: 'UNSPECIFIED',
      isRenewalDue: false,
      badgeLabel: 'No Expiry Set'
    };
  }

  const expiry = new Date(expiryDateStr);
  if (Number.isNaN(expiry.getTime())) {
    return {
      daysRemaining: null,
      status: 'INVALID_DATE',
      isRenewalDue: false,
      badgeLabel: 'Invalid Date'
    };
  }

  // Calculate day difference using UTC midnight boundaries
  const now = new Date();
  const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const utcExpiry = Date.UTC(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const diffDays = Math.ceil((utcExpiry - utcNow) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      daysRemaining: diffDays,
      status: 'EXPIRED',
      isRenewalDue: true,
      badgeLabel: `Expired ${Math.abs(diffDays)}d ago`
    };
  }

  if (diffDays <= 7) {
    return {
      daysRemaining: diffDays,
      status: 'CRITICAL',
      isRenewalDue: true,
      badgeLabel: `Critical: ${diffDays}d left`
    };
  }

  if (diffDays <= reminderOffsetDays) {
    return {
      daysRemaining: diffDays,
      status: 'DUE_SOON',
      isRenewalDue: true,
      badgeLabel: `Renewal Due: ${diffDays}d left`
    };
  }

  return {
    daysRemaining: diffDays,
    status: 'ACTIVE',
    isRenewalDue: false,
    badgeLabel: `Active (${diffDays}d left)`
  };
};

/**
 * Generates an RFC 5545 compliant iCalendar string (.ics) for calendar reminder import
 */
export const generateICalendarEvent = ({ title, description, expiryDateStr }) => {
  if (!expiryDateStr) return null;
  const dateObj = new Date(expiryDateStr);
  if (Number.isNaN(dateObj.getTime())) return null;

  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const dtStamp = `${y}${m}${d}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Civic-Help-Setu//Business Licence Reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:licence-reminder-${Date.now()}@civic-help-setu.gov.in`,
    `DTSTAMP:${dtStamp}T090000Z`,
    `DTSTART;VALUE=DATE:${dtStamp}`,
    `SUMMARY:${sanitizeAndRedactText(title, 100)} Expiry Deadline`,
    `DESCRIPTION:${sanitizeAndRedactText(description, 250)} - Process renewal in advance to avoid penal surcharges.`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
};

/**
 * Multi-Establishment Profile Management (CRUD)
 */
export const getEstablishmentProfiles = () => {
  const profiles = readStorage(STORAGE_KEY_ESTABLISHMENTS, []);
  return Array.isArray(profiles) ? profiles : [];
};

export const getEstablishmentProfileById = (id) => {
  const profiles = getEstablishmentProfiles();
  return profiles.find((p) => p.id === id) || null;
};

export const createEstablishmentProfile = (data) => {
  if (!data || !data.establishmentName) {
    throw new Error('Establishment name is mandatory.');
  }

  const profiles = getEstablishmentProfiles();
  const newProfile = {
    id: `est_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    establishmentName: sanitizeAndRedactText(data.establishmentName, 80),
    category: data.category || 'RETAIL',
    jurisdictionKey: data.jurisdictionKey || 'DELHI_MCD',
    municipalWard: sanitizeAndRedactText(data.municipalWard || '', 50),
    selectedLicenceKeys: Array.isArray(data.selectedLicenceKeys) ? data.selectedLicenceKeys : ['municipal_trade_licence'],
    licenceExpiries: typeof data.licenceExpiries === 'object' && data.licenceExpiries ? data.licenceExpiries : {},
    reminderOffsetDays: Number(data.reminderOffsetDays) || 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  profiles.push(newProfile);
  writeStorage(STORAGE_KEY_ESTABLISHMENTS, profiles);
  return newProfile;
};

export const updateEstablishmentProfile = (id, updates) => {
  const profiles = getEstablishmentProfiles();
  const index = profiles.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error(`Establishment with ID ${id} not found.`);
  }

  const existing = profiles[index];
  const updated = {
    ...existing,
    ...updates,
    establishmentName: updates.establishmentName
      ? sanitizeAndRedactText(updates.establishmentName, 80)
      : existing.establishmentName,
    municipalWard: updates.municipalWard
      ? sanitizeAndRedactText(updates.municipalWard, 50)
      : existing.municipalWard,
    updatedAt: new Date().toISOString()
  };

  profiles[index] = updated;
  writeStorage(STORAGE_KEY_ESTABLISHMENTS, profiles);
  return updated;
};

export const deleteEstablishmentProfile = (id) => {
  const profiles = getEstablishmentProfiles();
  const filtered = profiles.filter((p) => p.id !== id);
  writeStorage(STORAGE_KEY_ESTABLISHMENTS, filtered);

  // Also clean up checklist progress for this establishment
  const progress = readStorage(STORAGE_KEY_CHECKLIST_PROGRESS, {});
  if (progress[id]) {
    delete progress[id];
    writeStorage(STORAGE_KEY_CHECKLIST_PROGRESS, progress);
  }
  return true;
};

/**
 * Checklist Progress Management (Completed Item Tracking)
 */
export const getEstablishmentProgress = (establishmentId) => {
  if (!establishmentId) return {};
  const allProgress = readStorage(STORAGE_KEY_CHECKLIST_PROGRESS, {});
  return allProgress[establishmentId] || {};
};

export const toggleChecklistItem = (establishmentId, itemId) => {
  if (!establishmentId || !itemId) return false;
  const allProgress = readStorage(STORAGE_KEY_CHECKLIST_PROGRESS, {});
  const estProgress = allProgress[establishmentId] || {};

  estProgress[itemId] = !estProgress[itemId];
  allProgress[establishmentId] = estProgress;
  writeStorage(STORAGE_KEY_CHECKLIST_PROGRESS, allProgress);
  return estProgress[itemId];
};

export const resetEstablishmentProgress = (establishmentId) => {
  if (!establishmentId) return;
  const allProgress = readStorage(STORAGE_KEY_CHECKLIST_PROGRESS, {});
  if (allProgress[establishmentId]) {
    delete allProgress[establishmentId];
    writeStorage(STORAGE_KEY_CHECKLIST_PROGRESS, allProgress);
  }
};

/**
 * Sanitizes an establishment profile and checklist progress for public sharing / export
 * Strips PII and sensitive identifiers.
 */
export const sanitizeLicenceDataForExport = (establishment, progressMap = {}) => {
  if (!establishment) return null;

  return {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    establishmentSummary: {
      category: establishment.category,
      jurisdictionKey: establishment.jurisdictionKey,
      municipalWard: establishment.municipalWard ? '[REDACTED_WARD]' : 'Not specified',
      totalLicencesTracked: establishment.selectedLicenceKeys?.length || 0,
      activeLicences: establishment.selectedLicenceKeys || []
    },
    completedTasksCount: Object.values(progressMap).filter(Boolean).length,
    completedTasks: Object.keys(progressMap).filter((k) => progressMap[k]),
    disclaimer: STATUTORY_LEGAL_DISCLAIMER
  };
};

/**
 * In-memory / client-side Community Correction Proposals
 */
export const submitCorrectionProposal = (proposal) => {
  if (!proposal || !proposal.jurisdictionKey || !proposal.officialSourceUrl) {
    throw new Error('Jurisdiction and verifiable official source URL are mandatory.');
  }

  let parsed;
  try {
    parsed = new URL(proposal.officialSourceUrl);
  } catch {
    throw new Error('Invalid official source URL format.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Official source URL must be HTTP or HTTPS.');
  }

  const record = {
    id: `proposal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    jurisdictionKey: proposal.jurisdictionKey,
    licenceKey: proposal.licenceKey || 'ALL',
    stage: proposal.stage || 'RENEWAL',
    officialSourceUrl: proposal.officialSourceUrl.trim(),
    notes: sanitizeAndRedactText(proposal.notes || '', 500),
    status: 'PENDING_REVIEW',
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    adminNotes: null
  };

  memoryCorrectionProposals.push(record);
  return record;
};

export const getCorrectionProposals = () => {
  return [...memoryCorrectionProposals];
};

export const reviewCorrectionProposal = (id, { status, adminNotes }) => {
  const proposal = memoryCorrectionProposals.find((p) => p.id === id);
  if (!proposal) {
    throw new Error(`Proposal with ID ${id} not found.`);
  }

  if (!['APPROVED', 'REJECTED', 'PENDING_REVIEW'].includes(status)) {
    throw new Error('Invalid status. Must be APPROVED, REJECTED, or PENDING_REVIEW.');
  }

  proposal.status = status;
  proposal.adminNotes = sanitizeAndRedactText(adminNotes || '', 300);
  proposal.reviewedAt = new Date().toISOString();
  return proposal;
};
