/**
 * shareableDirectoryService.js
 *
 * Shareable filtered service directory view service (#475).
 * Enables citizens and facilitators to package focused search filters,
 * selected categories, department constraints, and sorting rules into
 * durable, read-only shareable directory links.
 *
 * Privacy & Safety Guarantees:
 * - Public/unlisted directory views contain catalogue information only.
 * - Private applicant records, saved folders, or personal profile data
 *   are NEVER bundled into or exposed by shared views.
 * - Accessible without requiring authentication.
 * - Supports optional time expiration (24h, 7d, 30d, never) and instant revocation.
 */

const STORAGE_KEY = 'civicbridge_shareable_directory_views';

export const DIRECTORY_EXPIRY_OPTIONS = {
  HOURS_24: '24h',
  DAYS_7: '7d',
  DAYS_30: '30d',
  NEVER: 'never',
};

/**
 * Calculates Unix timestamp from expiry option
 */
export function calculateDirectoryExpiry(option = DIRECTORY_EXPIRY_OPTIONS.DAYS_7) {
  const now = Date.now();
  switch (option) {
    case DIRECTORY_EXPIRY_OPTIONS.HOURS_24:
      return now + 24 * 60 * 60 * 1000;
    case DIRECTORY_EXPIRY_OPTIONS.DAYS_7:
      return now + 7 * 24 * 60 * 60 * 1000;
    case DIRECTORY_EXPIRY_OPTIONS.DAYS_30:
      return now + 30 * 24 * 60 * 60 * 1000;
    case DIRECTORY_EXPIRY_OPTIONS.NEVER:
    default:
      return null;
  }
}

/**
 * Generates an opaque, unguessable token
 */
export function generateDirectoryToken() {
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
 * Retrieves all stored shared directory views
 */
export function getAllSharedDirectoryViews() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * Saves all directory views
 */
function saveAllSharedDirectoryViews(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a shareable view for current filter state
 *
 * @param {Object} filterState - Active search parameters
 * @param {Object} [options={}] - View title, expiry, and notes
 * @returns {Object} Created directory view record
 */
export function createShareableDirectoryView(filterState = {}, options = {}) {
  const all = getAllSharedDirectoryViews();
  const token = generateDirectoryToken();
  const createdAt = Date.now();
  const expiry = options.expiry || DIRECTORY_EXPIRY_OPTIONS.DAYS_7;
  const expiresAt = calculateDirectoryExpiry(expiry);

  // Clean and sanitize filters (ensuring no private data is mixed in)
  const sanitizedFilters = {
    search: String(filterState.search || filterState.query || '').trim(),
    category: String(filterState.category || 'all').trim(),
    department: String(filterState.department || 'all').trim(),
    location: String(filterState.location || filterState.state || 'all').trim(),
    sortBy: String(filterState.sortBy || 'relevance').trim(),
    selectedTags: Array.isArray(filterState.tags) ? filterState.tags : [],
  };

  const record = {
    token,
    title: options.title || 'Curated Civic Services Directory',
    description: options.description || 'A focused directory view curated for community assistance.',
    createdAt,
    expiresAt,
    expiryOption: expiry,
    revoked: false,
    filters: sanitizedFilters,
    accessCount: 0,
    lastAccessedAt: null,
  };

  all[token] = record;
  saveAllSharedDirectoryViews(all);

  return record;
}

/**
 * Resolves a shared directory view by token
 *
 * @param {string} token
 * @returns {Object} Resolution result
 */
export function resolveSharedDirectoryView(token) {
  if (!token || typeof token !== 'string') {
    return { status: 'INVALID', error: 'Invalid share token' };
  }

  const all = getAllSharedDirectoryViews();
  const record = all[token];

  if (!record) {
    return { status: 'NOT_FOUND', error: 'Curated directory view does not exist or was removed.' };
  }

  if (record.revoked) {
    return { status: 'REVOKED', error: 'This shared directory list has been revoked by its creator.' };
  }

  if (record.expiresAt && Date.now() > record.expiresAt) {
    return { status: 'EXPIRED', error: 'This shared directory link has expired.' };
  }

  // Increment access metrics
  record.accessCount = (record.accessCount || 0) + 1;
  record.lastAccessedAt = Date.now();
  all[token] = record;
  saveAllSharedDirectoryViews(all);

  return {
    status: 'ACTIVE',
    view: {
      title: record.title,
      description: record.description,
      filters: record.filters,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    },
    readOnly: true,
  };
}

/**
 * Revokes a shared directory view immediately
 */
export function revokeSharedDirectoryView(token) {
  const all = getAllSharedDirectoryViews();
  if (all[token]) {
    all[token].revoked = true;
    all[token].revokedAt = Date.now();
    saveAllSharedDirectoryViews(all);
    return true;
  }
  return false;
}

/**
 * Filters a service array against sanitized directory filters
 */
export function applyDirectoryFilters(services = [], filters = {}) {
  if (!Array.isArray(services)) return [];

  return services.filter((srv) => {
    // Search query filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchTitle = (srv.title || srv.name || '').toLowerCase().includes(q);
      const matchDesc = (srv.description || '').toLowerCase().includes(q);
      const matchDept = (srv.department || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchDept) return false;
    }

    // Category filter
    if (filters.category && filters.category !== 'all') {
      const cat = (srv.category || '').toLowerCase();
      if (cat !== filters.category.toLowerCase()) return false;
    }

    // Department filter
    if (filters.department && filters.department !== 'all') {
      const dept = (srv.department || '').toLowerCase();
      if (dept !== filters.department.toLowerCase()) return false;
    }

    // Location / state filter
    if (filters.location && filters.location !== 'all') {
      const srvLoc = (srv.state || srv.jurisdiction || '').toLowerCase();
      if (srvLoc !== 'all' && srvLoc !== 'national' && !srvLoc.includes(filters.location.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}
