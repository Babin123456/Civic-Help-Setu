/**
 * src/data/civicCaseCollaborationData.js
 *
 * Versioned, privacy-safe synthetic dataset for the Civic Case Collaboration
 * Space with Granular, Revocable Sharing (#1183).
 *
 * Citizens can share selected case documents/items with a trusted helper
 * without exposing their entire account. Supports item-level sharing, expiry,
 * revocation, view/download scopes, recipient authentication, watermarked
 * exports, audit access, link-guessing prevention and cached-access blocking
 * after revocation.
 *
 * All records are synthetic fixtures with zero production PII. No credentials,
 * raw documents, Aadhaar/PAN numbers, phone numbers or sensitive prompts are
 * stored here.
 *
 * Schema version: civic-case-collaboration-v1
 */

export const CIVIC_CASE_COLLABORATION_SCHEMA_VERSION = 'civic-case-collaboration-v1';
export const CIVIC_CASE_COLLABORATION_REVIEW_DATE = '2026-11-23';
export const CIVIC_CASE_COLLABORATION_STALE_AFTER_DAYS = 180;
export const CIVIC_CASE_COLLABORATION_DISCLAIMER =
  'Shared case items are illustrative and untrusted. Recipients must authenticate '
  + 'and access is time-bound and revocable. Watermarked exports are for '
  + 'review only and never confer official status.';

export const MAX_SHARE_TITLE = 200;
export const MAX_SHARE_DESCRIPTION = 1000;
export const MAX_RECIPIENT_EMAIL_LEN = 254;
export const MAX_ITEMS_PER_SHARE = 50;
export const MAX_ACCESS_LOG_ENTRIES = 25;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
export const MIN_PASSCODE_LENGTH = 4;
export const MAX_DOWNLOAD_SCOPE = ['view', 'download'];
export const WATERMARK_TEXT = 'Civic Help Setu — Shared Case Item — Illustrative Only';

/**
 * Share expiry options (Unix-ms offsets from creation).
 */
export const SHARE_EXPIRY_OPTIONS = {
  HOURS_24: '24h',
  DAYS_3: '3d',
  DAYS_7: '7d',
  DAYS_30: '30d',
  NEVER: 'never',
};

/**
 * Share statuses.
 */
export const SHARE_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
  LOCKED: 'LOCKED',
  VIEW_LIMIT_REACHED: 'VIEW_LIMIT_REACHED',
  NOT_FOUND: 'NOT_FOUND',
});

/**
 * Access outcomes recorded in the audit trail.
 */
export const ACCESS_OUTCOME = Object.freeze({
  GRANTED: 'GRANTED',
  DENIED_AUTH: 'DENIED_AUTH',
  DENIED_REVOKED: 'DENIED_REVOKED',
  DENIED_EXPIRED: 'DENIED_EXPIRED',
  DENIED_VIEW_LIMIT: 'DENIED_VIEW_LIMIT',
  DENIED_SCOPE: 'DENIED_SCOPE',
  TAMPERED: 'TAMPERED',
  LOCKED: 'LOCKED',
  DOWNLOAD: 'DOWNLOAD',
  REVOKED_BY_OWNER: 'REVOKED_BY_OWNER',
});

/**
 * Synthetic case items (shareable documents/artifacts). Zero PII.
 */
export const CASE_ITEMS = [
  {
    id: 'item-income-cert-application',
    caseId: 'case-income-certificate-2026',
    title: 'Income Certificate Application Form',
    description: 'Synthetic application form for an Income Certificate submission.',
    mime: 'application/pdf',
    sizeBytes: 45000,
    category: 'application-form',
    isSynthetic: true,
    notes: 'No citizen data; synthetic fixture for collaboration testing.',
  },
  {
    id: 'item-income-proof-payslip',
    caseId: 'case-income-certificate-2026',
    title: 'Income Proof (Payslip)',
    description: 'Synthetic payslip used as supporting income evidence.',
    mime: 'image/png',
    sizeBytes: 180000,
    category: 'supporting-evidence',
    isSynthetic: true,
    notes: 'No citizen data; synthetic fixture for collaboration testing.',
  },
  {
    id: 'item-address-proof-utility',
    caseId: 'case-income-certificate-2026',
    title: 'Address Proof (Utility Bill)',
    description: 'Synthetic utility bill used as address evidence.',
    mime: 'application/pdf',
    sizeBytes: 62000,
    category: 'supporting-evidence',
    isSynthetic: true,
    notes: 'No citizen data; synthetic fixture for collaboration testing.',
  },
  {
    id: 'item-caste-cert-application',
    caseId: 'case-caste-certificate-2026',
    title: 'Caste Certificate Application Form',
    description: 'Synthetic application form for a Caste Certificate submission.',
    mime: 'application/pdf',
    sizeBytes: 41000,
    category: 'application-form',
    isSynthetic: true,
    notes: 'No citizen data; synthetic fixture for collaboration testing.',
  },
  {
    id: 'item-caste-attestation',
    caseId: 'case-caste-certificate-2026',
    title: 'Caste Attestation Letter',
    description: 'Synthetic caste attestation letter from a recognized authority.',
    mime: 'application/pdf',
    sizeBytes: 38000,
    category: 'supporting-evidence',
    isSynthetic: true,
    notes: 'No citizen data; synthetic fixture for collaboration testing.',
  },
  {
    id: 'item-ration-card-form',
    caseId: 'case-ration-card-2026',
    title: 'Ration Card Application Form',
    description: 'Synthetic ration card application form.',
    mime: 'application/pdf',
    sizeBytes: 52000,
    category: 'application-form',
    isSynthetic: true,
    notes: 'No citizen data; synthetic fixture for collaboration testing.',
  },
];

/**
 * Synthetic cases (collaboration contexts). Zero PII.
 */
export const CASES = [
  {
    id: 'case-income-certificate-2026',
    title: 'Income Certificate Application',
    serviceId: 'service-income-certificate',
    stage: 'In Review',
    ownerId: 'citizen-demo-001',
    isSynthetic: true,
  },
  {
    id: 'case-caste-certificate-2026',
    title: 'Caste Certificate Application',
    serviceId: 'service-caste-certificate',
    stage: 'Documents Verified',
    ownerId: 'citizen-demo-002',
    isSynthetic: true,
  },
  {
    id: 'case-ration-card-2026',
    title: 'Ration Card Application',
    serviceId: 'service-ration-card',
    stage: 'Submitted',
    ownerId: 'citizen-demo-003',
    isSynthetic: true,
  },
];

/**
 * Synthetic recipients (trusted helpers). Zero PII.
 */
export const RECIPIENTS = [
  {
    id: 'recipient-helper-001',
    email: 'helper.demo@example.in',
    name: 'Trusted Helper (Demo)',
    role: 'family-member',
    isSynthetic: true,
  },
  {
    id: 'recipient-helper-002',
    email: 'advocate.demo@example.in',
    name: 'Legal Advocate (Demo)',
    role: 'legal-representative',
    isSynthetic: true,
  },
];

/**
 * Versioned sharing scopes.
 */
export const SHARE_SCOPES = Object.freeze({
  VIEW_ONLY: 'view-only',
  VIEW_AND_DOWNLOAD: 'view-download',
});

/**
 * Predefined reusable share templates (synthetic). Each references items,
 * recipients, scopes and expiry.
 */
export const SHARE_TEMPLATES = [
  {
    id: 'template-income-cert-review',
    title: 'Income Certificate — Helper Review',
    description: 'Share application form and supporting evidence with a trusted helper for review before submission.',
    caseId: 'case-income-certificate-2026',
    itemIds: [
      'item-income-cert-application',
      'item-income-proof-payslip',
      'item-address-proof-utility',
    ],
    recipientId: 'recipient-helper-001',
    scope: SHARE_SCOPES.VIEW_AND_DOWNLOAD,
    expiryOption: SHARE_EXPIRY_OPTIONS.DAYS_7,
    maxViews: null,
    isSynthetic: true,
  },
  {
    id: 'template-caste-cert-advocate',
    title: 'Caste Certificate — Advocate Review',
    description: 'Share application and attestation with a legal advocate for review.',
    caseId: 'case-caste-certificate-2026',
    itemIds: ['item-caste-cert-application', 'item-caste-attestation'],
    recipientId: 'recipient-helper-002',
    scope: SHARE_SCOPES.VIEW_ONLY,
    expiryOption: SHARE_EXPIRY_OPTIONS.DAYS_30,
    maxViews: 10,
    isSynthetic: true,
  },
  {
    id: 'template-ration-card-burn',
    title: 'Ration Card — Burn-after-Read',
    description: 'Single-use share of ration card form that expires after one download.',
    caseId: 'case-ration-card-2026',
    itemIds: ['item-ration-card-form'],
    recipientId: 'recipient-helper-001',
    scope: SHARE_SCOPES.VIEW_AND_DOWNLOAD,
    expiryOption: SHARE_EXPIRY_OPTIONS.HOURS_24,
    maxViews: 1,
    isSynthetic: true,
  },
];

/**
 * Synthetic audit access log entries (synthetic, zero PII).
 */
export const AUDIT_LOG_ENTRIES = [
  {
    id: 'audit-001',
    shareId: 'share-income-cert-review-001',
    actorId: 'citizen-demo-001',
    actorRole: 'owner',
    outcome: ACCESS_OUTCOME.GRANTED,
    scope: SHARE_SCOPES.VIEW_AND_DOWNLOAD,
    itemId: 'item-income-cert-application',
    accessedAt: '2026-11-20T09:00:00Z',
    ipHash: 'sha256:aaaa1111',
    userAgentHash: 'sha256:bbbb2222',
    isSynthetic: true,
  },
  {
    id: 'audit-002',
    shareId: 'share-income-cert-review-001',
    actorId: 'recipient-helper-001',
    actorRole: 'recipient',
    outcome: ACCESS_OUTCOME.DOWNLOAD,
    scope: SHARE_SCOPES.VIEW_AND_DOWNLOAD,
    itemId: 'item-income-proof-payslip',
    accessedAt: '2026-11-20T10:15:00Z',
    ipHash: 'sha256:cccc3333',
    userAgentHash: 'sha256:dddd4444',
    isSynthetic: true,
  },
  {
    id: 'audit-003',
    shareId: 'share-caste-cert-advocate-001',
    actorId: 'recipient-helper-002',
    actorRole: 'recipient',
    outcome: ACCESS_OUTCOME.DENIED_SCOPE,
    scope: SHARE_SCOPES.VIEW_ONLY,
    itemId: 'item-caste-attestation',
    accessedAt: '2026-11-21T11:00:00Z',
    ipHash: 'sha256:eeee5555',
    userAgentHash: 'sha256:ffff6666',
    isSynthetic: true,
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getCaseItem(id) {
  return CASE_ITEMS.find((i) => i.id === id) || null;
}

export function getCase(id) {
  return CASES.find((c) => c.id === id) || null;
}

export function getRecipient(id) {
  return RECIPIENTS.find((r) => r.id === id) || null;
}

export function getShareTemplate(id) {
  return SHARE_TEMPLATES.find((t) => t.id === id) || null;
}

export function getAuditEntry(id) {
  return AUDIT_LOG_ENTRIES.find((a) => a.id === id) || null;
}

export function listCaseItems() {
  return CASE_ITEMS;
}

export function listCases() {
  return CASES;
}

export function listRecipients() {
  return RECIPIENTS;
}

export function listShareTemplates() {
  return SHARE_TEMPLATES;
}

export function listAuditLogEntries() {
  return AUDIT_LOG_ENTRIES;
}

export function listExpiryOptions() {
  return SHARE_EXPIRY_OPTIONS;
}

export function listScopes() {
  return Object.values(SHARE_SCOPES);
}

export const CASE_COLLABORATION_TESTABLES = {
  getCaseItem,
  getCase,
  getRecipient,
  getShareTemplate,
  getAuditEntry,
  listCaseItems,
  listCases,
  listRecipients,
  listShareTemplates,
  listAuditLogEntries,
  listExpiryOptions,
  listScopes,
  CASE_ITEMS,
  CASES,
  RECIPIENTS,
  SHARE_TEMPLATES,
  SHARE_SCOPES,
  SHARE_STATUS,
  ACCESS_OUTCOME,
};
