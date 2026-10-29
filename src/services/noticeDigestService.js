import { requirePermission } from './accessControl';
/**
 * Public Notice & Gazette Change Digest Service
 * 
 * Manages curated official notices, gazette notifications, and statutory circulars
 * connected to public services in the catalog.
 * 
 * Features:
 * - Distinguishes official gazette publication date from platform review date
 * - Robust duplicate notice detection (URL canonicalization and title fingerprinting)
 * - Review status lifecycle (draft, pending_review, approved, archived)
 * - Immutable audit trail of maintainer updates
 * - Clear legal disclaimer that digests are informational and not legal advice
 */

import { sanitizeTextFields } from '../utils/safeContent';
const STORAGE_KEY = 'civicbridge_public_notices_digest_v1';

export const LEGAL_DISCLAIMER =
  'Civic Help Setu Digest is an informational community summary. This digest does not constitute official legal advice, binding statutory interpretation, or departmental endorsement. Always refer to the original gazette notification or consult authorized public officials for formal administrative proceedings.';

export const NOTICE_CATEGORIES = [
  { id: 'rule_amendment', label: 'Rule / Procedural Amendment' },
  { id: 'deadline_extension', label: 'Deadline & Grace Period' },
  { id: 'fee_revision', label: 'Fee / Tariff Revision' },
  { id: 'document_requirement', label: 'Document & Eligibility Update' },
  { id: 'gazette_order', label: 'Official Gazette Notification' },
  { id: 'office_jurisdiction', label: 'Office & Jurisdiction Change' },
  { id: 'other', label: 'General Administrative Notice' },
];

export const NOTICE_STATUSES = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  ARCHIVED: 'archived',
};

const DEFAULT_NOTICES = [
  {
    id: 'notice_gaz_2026_01',
    title: 'Gazette Extra Ordinary No. 412: Revision in Income Certificate Validity Period',
    sourceUrl: 'https://egazette.gov.in/WriteReadData/2026/241289.pdf',
    gazettePublicationDate: '2026-02-15T00:00:00.000Z',
    reviewedAtDate: '2026-02-18T10:30:00.000Z',
    reviewedBy: 'CivicHelpSetu Legal Review Cell',
    affectedServiceIds: ['income-certificate', 'caste-certificate', 'ration-card'],
    category: 'rule_amendment',
    summary:
      'State Revenue Department extends statutory validity of digital income certificates from 1 year to 3 financial years, eliminating annual renewal for welfare schemes.',
    status: NOTICE_STATUSES.APPROVED,
    legalDisclaimer: LEGAL_DISCLAIMER,
    history: [
      {
        timestamp: '2026-02-18T10:30:00.000Z',
        action: 'CREATED_AND_APPROVED',
        actor: 'CivicHelpSetu Legal Review Cell',
        details: 'Initial ingestion from official eGazette release.',
      },
    ],
  },
  {
    id: 'notice_gaz_2026_02',
    title: 'Ministry of Road Transport: Grace Period for Driving Licence Medical Renewal',
    sourceUrl: 'https://parivahan.gov.in/parivahan/notices/dl-medical-2026.html',
    gazettePublicationDate: '2026-01-20T00:00:00.000Z',
    reviewedAtDate: '2026-01-22T14:15:00.000Z',
    reviewedBy: 'Admin Moderator',
    affectedServiceIds: ['driving-licence', 'learners-licence'],
    category: 'deadline_extension',
    summary:
      'Notice permitting submission of self-declaration Form 1A within 30 days post-expiry for transport category licence renewals.',
    status: NOTICE_STATUSES.APPROVED,
    legalDisclaimer: LEGAL_DISCLAIMER,
    history: [
      {
        timestamp: '2026-01-22T14:15:00.000Z',
        action: 'CREATED_AND_APPROVED',
        actor: 'Admin Moderator',
        details: 'Verified against Parivahan official notification.',
      },
    ],
  },
];

/**
 * Safe local storage resolver for browser and test environments
 */
const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

/**
 * Normalizes a URL for duplicate detection
 */
export const normalizeSourceUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const trimmed = rawUrl.trim();
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    let host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let pathname = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    return `${host}${pathname}${parsed.search}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
};

/**
 * Normalizes title for fingerprint comparison
 */
export const normalizeTitle = (title) => {
  if (!title || typeof title !== 'string') return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Retrieves all notices from storage
 */
export const getNotices = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return [...DEFAULT_NOTICES];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      storage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_NOTICES));
      return [...DEFAULT_NOTICES];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sanitizeTextFields(parsed) : [...DEFAULT_NOTICES];
  } catch {
    return [...DEFAULT_NOTICES];
  }
};

/**
 * Saves notice list to storage
 */
export const saveNotices = (notices, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(notices));
    return true;
  } catch {
    return false;
  }
};

/**
 * Detects whether a notice candidate duplicates an existing entry
 */
export const detectDuplicateNotice = (candidate, customStorage) => {
  if (!candidate) return { isDuplicate: false, duplicateOf: null, reason: null };

  const notices = getNotices(customStorage);
  const candidateUrlNorm = normalizeSourceUrl(candidate.sourceUrl);
  const candidateTitleNorm = normalizeTitle(candidate.title);

  for (const existing of notices) {
    // Skip self when updating an existing notice
    if (candidate.id && existing.id === candidate.id) continue;

    // Check exact normalized URL
    if (candidateUrlNorm && normalizeSourceUrl(existing.sourceUrl) === candidateUrlNorm) {
      return {
        isDuplicate: true,
        duplicateOf: existing,
        reason: `Source URL matches existing notice: "${existing.title}"`,
      };
    }

    // Check high title similarity
    const existingTitleNorm = normalizeTitle(existing.title);
    if (candidateTitleNorm && existingTitleNorm && candidateTitleNorm === existingTitleNorm) {
      return {
        isDuplicate: true,
        duplicateOf: existing,
        reason: `Title identical to existing notice: "${existing.title}"`,
      };
    }
  }

  return { isDuplicate: false, duplicateOf: null, reason: null };
};

/**
 * Validates notice input fields
 */
export const validateNoticeInput = (data) => {
  const errors = [];

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 5) {
    errors.push('Notice title must be at least 5 characters long.');
  }

  if (!data.sourceUrl || typeof data.sourceUrl !== 'string' || !data.sourceUrl.trim().startsWith('http')) {
    errors.push('A valid official source URL starting with http:// or https:// is required.');
  }

  if (!data.gazettePublicationDate) {
    errors.push('Official publication date is mandatory.');
  } else {
    const pubDate = new Date(data.gazettePublicationDate);
    if (isNaN(pubDate.getTime())) {
      errors.push('Invalid official publication date format.');
    }
  }

  if (data.reviewedAtDate) {
    const revDate = new Date(data.reviewedAtDate);
    if (isNaN(revDate.getTime())) {
      errors.push('Invalid reviewed-at date format.');
    }
  }

  if (!Array.isArray(data.affectedServiceIds) || data.affectedServiceIds.length === 0) {
    errors.push('At least one affected service must be linked.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Adds a new reviewed notice
 */
export const addNotice = (noticeInput, actor = 'Admin', customStorage) => {
  requirePermission('notices.manage');
  const validation = validateNoticeInput(noticeInput);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const dupCheck = detectDuplicateNotice(noticeInput, customStorage);
  if (dupCheck.isDuplicate) {
    throw new Error(`Duplicate notice detected: ${dupCheck.reason}`);
  }

  const nowIso = new Date().toISOString();
  const notices = getNotices(customStorage);

  const newNotice = {
    id: `notice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: noticeInput.title.trim(),
    sourceUrl: noticeInput.sourceUrl.trim(),
    gazettePublicationDate: new Date(noticeInput.gazettePublicationDate).toISOString(),
    reviewedAtDate: noticeInput.reviewedAtDate ? new Date(noticeInput.reviewedAtDate).toISOString() : nowIso,
    reviewedBy: actor || 'Admin',
    affectedServiceIds: [...noticeInput.affectedServiceIds],
    category: noticeInput.category || 'gazette_order',
    summary: (noticeInput.summary || '').trim(),
    status: noticeInput.status || NOTICE_STATUSES.PENDING_REVIEW,
    legalDisclaimer: LEGAL_DISCLAIMER,
    history: [
      {
        timestamp: nowIso,
        action: 'CREATED',
        actor: actor || 'Admin',
        details: `Notice logged with status "${noticeInput.status || NOTICE_STATUSES.PENDING_REVIEW}".`,
      },
    ],
  };

  notices.unshift(newNotice);
  saveNotices(notices, customStorage);
  return newNotice;
};

/**
 * Updates an existing notice
 */
export const updateNotice = (id, updates, actor = 'Admin', customStorage) => {
  requirePermission('notices.manage');
  const notices = getNotices(customStorage);
  const index = notices.findIndex((n) => n.id === id);
  if (index === -1) {
    throw new Error(`Notice with ID "${id}" not found.`);
  }

  const candidate = { ...notices[index], ...updates };
  const validation = validateNoticeInput(candidate);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const dupCheck = detectDuplicateNotice(candidate, customStorage);
  if (dupCheck.isDuplicate) {
    throw new Error(`Update results in a duplicate: ${dupCheck.reason}`);
  }

  const nowIso = new Date().toISOString();
  const updatedNotice = {
    ...notices[index],
    ...updates,
    history: [
      ...(notices[index].history || []),
      {
        timestamp: nowIso,
        action: 'UPDATED',
        actor: actor || 'Admin',
        details: `Updated fields: ${Object.keys(updates).join(', ')}`,
      },
    ],
  };

  notices[index] = updatedNotice;
  saveNotices(notices, customStorage);
  return updatedNotice;
};

/**
 * Changes notice review status
 */
export const changeNoticeStatus = (id, newStatus, actor = 'Admin', note = '', customStorage) => {
  requirePermission('notices.manage');
  if (!Object.values(NOTICE_STATUSES).includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  const notices = getNotices(customStorage);
  const index = notices.findIndex((n) => n.id === id);
  if (index === -1) {
    throw new Error(`Notice with ID "${id}" not found.`);
  }

  const nowIso = new Date().toISOString();
  notices[index].status = newStatus;
  notices[index].history = [
    ...(notices[index].history || []),
    {
      timestamp: nowIso,
      action: `STATUS_${newStatus.toUpperCase()}`,
      actor: actor || 'Admin',
      details: note || `Status transitioned to "${newStatus}".`,
    },
  ];

  saveNotices(notices, customStorage);
  return notices[index];
};

/**
 * Retrieves notices affecting a specific service
 */
export const getNoticesForService = (serviceId, customStorage, onlyApproved = true) => {
  if (!serviceId) return [];
  const notices = getNotices(customStorage);

  return notices
    .filter((n) => {
      const linksService = Array.isArray(n.affectedServiceIds) && n.affectedServiceIds.includes(serviceId);
      if (!linksService) return false;
      if (onlyApproved) {
        return n.status === NOTICE_STATUSES.APPROVED;
      }
      return true;
    })
    .sort((a, b) => new Date(b.gazettePublicationDate) - new Date(a.gazettePublicationDate));
};

/**
 * Filters all notices by search query, status, category, or service
 */
export const queryNotices = (customStorage, filterOptions = {}) => {
  const { status, category, serviceId, searchQuery } = filterOptions;
  let list = getNotices(customStorage);

  if (status && status !== 'all') {
    list = list.filter((n) => n.status === status);
  }

  if (category && category !== 'all') {
    list = list.filter((n) => n.category === category);
  }

  if (serviceId && serviceId !== 'all') {
    list = list.filter((n) => Array.isArray(n.affectedServiceIds) && n.affectedServiceIds.includes(serviceId));
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.summary && n.summary.toLowerCase().includes(q)) ||
        (n.sourceUrl && n.sourceUrl.toLowerCase().includes(q))
    );
  }

  return list;
};

/**
 * Returns digest aggregate statistics
 */
export const getNoticeDigestStats = (customStorage) => {
  const notices = getNotices(customStorage);
  return {
    total: notices.length,
    approved: notices.filter((n) => n.status === NOTICE_STATUSES.APPROVED).length,
    pending: notices.filter((n) => n.status === NOTICE_STATUSES.PENDING_REVIEW).length,
    drafts: notices.filter((n) => n.status === NOTICE_STATUSES.DRAFT).length,
    archived: notices.filter((n) => n.status === NOTICE_STATUSES.ARCHIVED).length,
  };
};

/**
 * Resets notices back to default state
 */
export const resetNoticesToDefault = (customStorage) => {
  requirePermission('notices.manage');
  const storage = getStorage(customStorage);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_NOTICES));
    return true;
  } catch {
    return false;
  }
};
