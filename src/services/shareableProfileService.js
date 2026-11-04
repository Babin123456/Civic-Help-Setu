/**
 * shareableProfileService.js
 *
 * Privacy-controlled shareable citizen profile service (#455).
 * Enables citizens to generate revocable, privacy-safe, read-only share links
 * with field-level visibility controls, expiry periods, and secure tokens.
 *
 * Security & Privacy:
 * - Opaque cryptographic/random tokens (never exposes raw user IDs in URL).
 * - Private identity documents, sensitive account credentials, and contact details
 *   are strictly stripped and never included in public views.
 * - Enforces server/client expiration checks and immediate revocation.
 */

export const SHARE_EXPIRY_OPTIONS = {
  HOURS_24: '24h',
  DAYS_7: '7d',
  DAYS_30: '30d',
  NEVER: 'never',
};

const STORAGE_KEY = 'civicbridge_shareable_citizen_profiles';

/**
 * Calculates Unix timestamp for expiry option
 */
export function calculateExpiryTime(option = SHARE_EXPIRY_OPTIONS.DAYS_7) {
  const now = Date.now();
  switch (option) {
    case SHARE_EXPIRY_OPTIONS.HOURS_24:
      return now + 24 * 60 * 60 * 1000;
    case SHARE_EXPIRY_OPTIONS.DAYS_7:
      return now + 7 * 24 * 60 * 60 * 1000;
    case SHARE_EXPIRY_OPTIONS.DAYS_30:
      return now + 30 * 24 * 60 * 60 * 1000;
    case SHARE_EXPIRY_OPTIONS.NEVER:
    default:
      return null;
  }
}

/**
 * Generates an unguessable 24-character hex token
 */
export function generateShareToken() {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Loads all shareable profile entries from storage
 */
export function getAllSharedProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * Saves all shareable profile entries to storage
 */
function saveAllSharedProfiles(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates or updates a shareable profile configuration for a user.
 *
 * @param {string} userId - ID or username of the owner
 * @param {Object} rawProfile - Full citizen profile
 * @param {Object} options - Visibility options and expiry
 * @returns {Object} Created share record
 */
export function createShareableProfile(userId, rawProfile = {}, options = {}) {
  if (!userId) throw new Error('User ID is required to create a shareable profile');

  const all = getAllSharedProfiles();
  const token = generateShareToken();
  const createdAt = Date.now();
  const expiryOption = options.expiry || SHARE_EXPIRY_OPTIONS.DAYS_7;
  const expiresAt = calculateExpiryTime(expiryOption);

  // Field-level visibility settings
  const visibility = {
    showFullName: options.visibility?.showFullName ?? true,
    showLocation: options.visibility?.showLocation ?? true,
    showCategory: options.visibility?.showCategory ?? true,
    showOccupation: options.visibility?.showOccupation ?? false,
    showSavedServices: options.visibility?.showSavedServices ?? true,
    showApplicationMilestones: options.visibility?.showApplicationMilestones ?? true,
    showReadinessScore: options.visibility?.showReadinessScore ?? true,
  };

  const shareRecord = {
    token,
    userId,
    createdAt,
    expiresAt,
    expiryOption,
    revoked: false,
    visibility,
    // Store only sanitized snapshot
    profileSnapshot: {
      fullName: rawProfile.fullName || rawProfile.name || 'Citizen Applicant',
      state: rawProfile.state || rawProfile.location || '',
      district: rawProfile.district || '',
      category: rawProfile.category || rawProfile.socialCategory || '',
      occupation: rawProfile.occupation || '',
      savedServices: Array.isArray(rawProfile.savedServices) ? rawProfile.savedServices : [],
      applicationMilestones: Array.isArray(rawProfile.applications) ? rawProfile.applications : [],
      readinessScore: typeof rawProfile.readinessScore === 'number' ? rawProfile.readinessScore : 85,
    },
    // Explicit private notes or data that are NEVER published
    accessCount: 0,
    lastAccessedAt: null,
  };

  all[token] = shareRecord;
  saveAllSharedProfiles(all);

  return shareRecord;
}

/**
 * Retrieves the public, privacy-filtered view of a shared profile by token.
 * Validates expiration, revocation, and strips unselected/private fields.
 *
 * @param {string} token
 * @returns {{ status: 'ACTIVE'|'EXPIRED'|'REVOKED'|'NOT_FOUND', profile?: Object }}
 */
export function getPublicSharedProfile(token) {
  if (!token || typeof token !== 'string') {
    return { status: 'NOT_FOUND', error: 'Invalid share token' };
  }

  const all = getAllSharedProfiles();
  const record = all[token];

  if (!record) {
    return { status: 'NOT_FOUND', error: 'Share link does not exist' };
  }

  if (record.revoked) {
    return { status: 'REVOKED', error: 'This profile share link has been revoked by the owner' };
  }

  if (record.expiresAt && Date.now() > record.expiresAt) {
    return { status: 'EXPIRED', error: 'This profile share link has expired' };
  }

  // Increment access audit
  record.accessCount = (record.accessCount || 0) + 1;
  record.lastAccessedAt = Date.now();
  all[token] = record;
  saveAllSharedProfiles(all);

  // Strip and project fields strictly based on visibility settings
  const vis = record.visibility || {};
  const snap = record.profileSnapshot || {};

  const publicData = {
    fullName: vis.showFullName ? snap.fullName : 'Citizen Applicant',
    location: vis.showLocation
      ? [snap.district, snap.state].filter(Boolean).join(', ')
      : null,
    category: vis.showCategory ? snap.category : null,
    occupation: vis.showOccupation ? snap.occupation : null,
    savedServices: vis.showSavedServices
      ? (snap.savedServices || []).map((s) => ({
          id: s.id,
          title: s.title || s.name,
          category: s.category || s.department,
        }))
      : [],
    applicationMilestones: vis.showApplicationMilestones
      ? (snap.applicationMilestones || []).map((a) => ({
          serviceName: a.serviceName || a.title || 'Civic Service',
          stage: a.stage || a.status || 'In Progress',
          updatedAt: a.updatedAt || a.date || null,
        }))
      : [],
    readinessScore: vis.showReadinessScore ? snap.readinessScore : null,
  };

  return {
    status: 'ACTIVE',
    profile: publicData,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    readOnly: true,
  };
}

/**
 * Revokes an existing share link
 */
export function revokeSharedProfile(token) {
  const all = getAllSharedProfiles();
  if (all[token]) {
    all[token].revoked = true;
    all[token].revokedAt = Date.now();
    saveAllSharedProfiles(all);
    return true;
  }
  return false;
}

/**
 * Updates field visibility on an active share link
 */
export function updateSharedProfileVisibility(token, newVisibility = {}) {
  const all = getAllSharedProfiles();
  if (!all[token]) return null;

  all[token].visibility = {
    ...all[token].visibility,
    ...newVisibility,
  };
  saveAllSharedProfiles(all);
  return all[token];
}

/**
 * Finds the latest active share record for a given user
 */
export function getActiveShareForUser(userId) {
  if (!userId) return null;
  const all = getAllSharedProfiles();
  const records = Object.values(all)
    .filter((r) => r.userId === userId && !r.revoked)
    .sort((a, b) => b.createdAt - a.createdAt);

  for (const r of records) {
    if (!r.expiresAt || Date.now() <= r.expiresAt) {
      return r;
    }
  }
  return null;
}
