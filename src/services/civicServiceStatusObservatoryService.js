/**
 * National Civic Service Outage and Broken Portal Status Observatory
 *
 * Implements a transparent availability observatory combining safe synthetic checks
 * with opt-in user-reported failures. Key design principles:
 *
 * 1. Allowlisted endpoints only — no open-ended probing.
 * 2. Low-frequency, non-invasive synthetic checks (GET only, no cookies, no form submission).
 * 3. Anonymous community reports with coarse granularity (no IP, no form data).
 * 4. Clear distinction between synthetic checks and official announcements.
 * 5. Automatic stale notice expiration.
 * 6. Offline checklist mode to preserve work during outages.
 * 7. Rate limiting respecting portal access restrictions.
 */

import { INCIDENT_TIER, INCIDENT_STATUS, OUTAGE_SERVICE_DISCLAIMER, isValidOfficialUrl } from './civicServiceOutageDirectoryService.js';

/**
 * Coarse device class categories for reporting (no device-specific identifiers).
 */
export const DEVICE_CLASS = {
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
  TABLET: 'tablet',
  UNKNOWN: 'unknown',
};

/**
 * Error category for classifying portal access failures.
 */
export const ERROR_CATEGORY = {
  CONNECTIVITY: 'connectivity',
  PORTAL_OUTAGE: 'portalOutage',
  MAINTENANCE: 'maintenance',
  FORM_SUBMISSION: 'formSubmission',
  AUTHENTICATION: 'authentication',
  UNKNOWN: 'unknown',
};

/**
 * Synthetic check result record.
 */
export const STATUS = {
  REACHABLE: 'reachable',
  UNAVAILABLE: 'unavailable',
  UNVERIFIED: 'unverified',
  RATE_LIMITED: 'rateLimited',
  BLOCKED: 'blocked',
};

/**
 * Permitted HTTP methods for synthetic health checks (GET only, never POST/PUT/DELETE).
 * This is the allowlisted registry of permitted health-check methods.
 */
export const PERMITTED_CHECK_METHODS = ['GET'];

/**
 * Default timeout for synthetic checks in milliseconds (8 seconds, same as linkHealthService).
 */
export const DEFAULT_CHECK_TIMEOUT_MS = 8000;

/**
 * Maximum age (in hours) for a synthetic check to be considered fresh.
 * After this, the observation is marked as STALE_EXPIRED.
 */
export const DEFAULT_CHECK_TTL_HOURS = 24;

/**
 * Maximum number of community reports to retain per service (rate limiting / sampling).
 */
export const MAX_COMMUNITY_REPORTS_PER_SERVICE = 50;

/**
 * Run a single safe synthetic health check against an allowed endpoint.
 * Never authenticates, never submits data, uses only GET method with no credentials.
 *
 * @param {string} url - The official endpoint URL (must be allowlisted/official domain)
 * @param {{timeoutMs?: number}} [options] - Optional configuration
 * @returns {Object} Check result with status, details, and metadata
 */
export const runSyntheticCheck = async (url, { timeoutMs = DEFAULT_CHECK_TIMEOUT_MS } = {}) => {
  // Validate URL is an official/allowlisted domain
  if (!url || typeof url !== 'string') {
    return {
      status: STATUS.BLOCKED,
      url: url || 'undefined',
      error: 'Invalid URL provided',
      method: 'GET',
      checkedAt: new Date().toISOString(),
      synthetic: true,
    };
  }

  // Verify URL belongs to an official/sanctioned domain
  if (!isValidOfficialUrl(url)) {
    return {
      status: STATUS.BLOCKED,
      url,
      error: 'URL not in allowlisted official domain',
      method: 'GET',
      checkedAt: new Date().toISOString(),
      synthetic: true,
    };
  }

  // Perform a single GET request with no credentials, no cookies, no form data
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer;

  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      if (controller) controller.abort();
      resolve({ type: 'timeout', status: 0 });
    }, timeoutMs);
  });

  try {
    const fetchFn = typeof fetch === 'function' ? fetch : null;
    if (!fetchFn) {
      return {
        status: STATUS.UNVERIFIED,
        url,
        error: 'No fetch API available',
        method: 'GET',
        checkedAt: new Date().toISOString(),
        synthetic: true,
      };
    }

    const response = await Promise.race([
      fetchFn(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller ? controller.signal : undefined,
      }),
      timeoutPromise,
    ]);

    if (typeof response === 'object' && response.type === 'done') {
      // Timeout occurred
      return {
        status: STATUS.UNVERIFIED,
        url,
        error: 'Request timed out',
        method: 'GET',
        checkedAt: new Date().toISOString(),
        synthetic: true,
      };
    }

    if (!response || typeof response.status !== 'number') {
      return {
        status: STATUS.UNVERIFIED,
        url,
        error: 'No readable response',
        method: 'GET',
        checkedAt: new Date().toISOString(),
        synthetic: true,
      };
    }

    const httpStatus = response.status;

    // 401/403/407/429 = portal access control/restriction, not evidence of being "down"
    if ([401, 403, 407, 429].includes(httpStatus)) {
      return {
        status: STATUS.RATE_LIMITED,
        url,
        httpStatus,
        error: 'Access restricted or rate-limited',
        method: 'GET',
        checkedAt: new Date().toISOString(),
        synthetic: true,
      };
    }

    // 5xx or 4xx (except the restricted codes above) = portal showing errors
    if (httpStatus >= 400) {
      return {
        status: STATUS.UNAVAILABLE,
        url,
        httpStatus,
        error: `Portal returned HTTP ${httpStatus}`,
        method: 'GET',
        checkedAt: new Date().toISOString(),
        synthetic: true,
      };
    }

    // 3xx redirects - unverified until admin reviews
    if (httpStatus >= 300) {
      return {
        status: STATUS.UNVERIFIED,
        url,
        httpStatus,
        error: 'Redirect received, needs review',
        method: 'GET',
        checkedAt: new Date().toISOString(),
        synthetic: true,
      };
    }

    // 2xx success = portal is reachable
    return {
      status: STATUS.REACHABLE,
      url,
      httpStatus,
      error: null,
      method: 'GET',
      checkedAt: new Date().toISOString(),
      synthetic: true,
    };
  } catch (err) {
    // CORS refusals, DNS errors, network offline - all look the same externally
    return {
      status: STATUS.UNVERIFIED,
      url,
      error: err.message || 'Check blocked or network error',
      method: 'GET',
      checkedAt: new Date().toISOString(),
      synthetic: true,
    };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Submit an anonymous community report of a portal access failure.
 * No IP address is stored. Only coarse device class is recorded.
 *
 * @param {Object} reportData - Report contents
 * @param {string} reportData.serviceKey - The service key (e.g., 'VAHAN_PORTAL')
 * @param {string} reportData.description - Description of the failure
 * @param {string} [reportData.errorCategory] - One of ERROR_CATEGORY values
 * @param {string} [reportData.deviceClass] - One of DEVICE_CLASS values
 * @param {string} [reportData.jurisdiction] - Optional jurisdiction
 * @returns {Object} The created community report incident
 */
export const submitAnonymousReport = (reportData) => {
  if (!reportData.serviceKey) {
    throw new Error('Valid serviceKey is required for community report');
  }

  if (!reportData.description) {
    throw new Error('Description of the failure is required');
  }

  const id = `obs_comm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const incident = {
    id,
    tier: INCIDENT_TIER.COMMUNITY_REPORTED,
    status: INCIDENT_STATUS.ACTIVE,
    serviceKey: reportData.serviceKey.trim(),
    serviceName: reportData.serviceName || reportData.serviceKey,
    jurisdiction: reportData.jurisdiction || 'CENTRAL',
    title: `Community Access Issue: ${reportData.serviceKey}`,
    description: reportData.description.trim(),
    affectedFunctions: reportData.affectedFunctions || ['Portal Access'],
    reportedAt: new Date().toISOString(),
    errorCategory: reportData.errorCategory || ERROR_CATEGORY.UNKNOWN,
    deviceClass: reportData.deviceClass || DEVICE_CLASS.UNKNOWN,
    isModerated: false,
    // No IP address stored - privacy by design
    disclaimer: OUTAGE_SERVICE_DISCLAIMER,
  };

  return incident;
};

/**
 * Publish an official verified announcement about a service outage or maintenance.
 * Only authorized roles (ADMIN or OFFICIAL_EDITOR) may publish.
 *
 * @param {Object} data - Official incident data
 * @param {string} data.serviceKey - The service key
 * @param {string} data.title - Title of the incident
 * @param {string} data.description - Description of the outage/maintenance
 * @param {string} data.officialSource - Official source/bulletin
 * @param {string} [data.officialBulletinUrl] - URL to the official bulletin
 * @param {string} [data.serviceName] - Human-readable service name
 * @param {Object[]} [data.alternativeChannels] - Alternative access channels
 * @param {string} [data.publisherRole] - Role for authorization check
 * @returns {Object} The published official incident
 */
export const publishOfficialAnnouncement = (data, publisherRole = 'ADMIN') => {
  if (publisherRole !== 'ADMIN' && publisherRole !== 'OFFICIAL_EDITOR') {
    throw new Error('Authorization Error: Only authorized administrators or official editors may publish verified notices');
  }

  if (!data.serviceKey || !data.title || !data.officialSource) {
    throw new Error('Valid serviceKey, title, and officialSource are required');
  }

  const id = data.id || `obs_off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const verifiedAlternatives = (data.alternativeChannels || []).filter((alt) => {
    if (alt.url && !isValidOfficialUrl(alt.url)) {
      // Silently skip invalid URLs rather than throwing - allows partial publishes
      return false;
    }
    return true;
  });

  const incident = {
    id,
    tier: INCIDENT_TIER.VERIFIED_OFFICIAL,
    status: INCIDENT_STATUS.ACTIVE,
    serviceKey: data.serviceKey.trim(),
    serviceName: data.serviceName || data.serviceKey,
    jurisdiction: data.jurisdiction || 'CENTRAL',
    title: data.title.trim(),
    description: data.description ? data.description.trim() : '',
    affectedFunctions: data.affectedFunctions || ['Full Service'],
    officialSource: data.officialSource.trim(),
    officialBulletinUrl: data.officialBulletinUrl || null,
    startTime: data.startTime ? new Date(data.startTime).toISOString() : new Date().toISOString(),
    expectedResolutionTime: data.expectedResolutionTime
      ? new Date(data.expectedResolutionTime).toISOString()
      : null,
    lastUpdatedAt: new Date().toISOString(),
    alternativeChannels: verifiedAlternatives,
    disclaimer: OUTAGE_SERVICE_DISCLAIMER,
  };

  return incident;
};

/**
 * Submit a community report into the observatory store.
 * @param {Object} reportData - Report data (same format as submitAnonymousReport)
 * @param {OutageDirectoryStore} store - The outage directory store instance
 * @returns {Object} The created incident
 */
export const registerCommunityReport = (reportData, store) => {
  const incident = submitAnonymousReport(reportData);
  store.submitCommunityReport(incident, 'bucket_general');
  return incident;
};

/**
 * Check and expire stale observations past their TTL window.
 * @param {OutageDirectoryStore} store - The outage directory store instance
 * @param {number} [maxTtlHours=24] - Maximum age in hours for an observation to remain active
 * @returns {Array} List of expired incident IDs
 */
export const expireStaleObservations = (store, maxTtlHours = DEFAULT_CHECK_TTL_HOURS) => {
  return store.checkAndExpireStaleIncidents(maxTtlHours);
};

/**
 * Get all active observations for a given service key, combining official and community reports.
 * @param {string} serviceKey - The service key to query
 * @param {OutageDirectoryStore} store - The outage directory store instance
 * @returns {Array} List of active incidents for this service
 */
export const getServiceObservations = (serviceKey, store) => {
  return store.getServiceIncidents(serviceKey).filter(
    (inc) => inc.status !== INCIDENT_STATUS.ARCHIVED && inc.status !== INCIDENT_STATUS.STALE_EXPIRED
  );
};

/**
 * Get summary statistics for a service's observatory data.
 * Computes: sample size, last synthetic check, uncertainty flag,
 * and distinguishes official announcements from community reports.
 *
 * @param {string} serviceKey - The service key to summarize
 * @param {OutageDirectoryStore} store - The outage directory store instance
 * @returns {Object} Summary with sampleSize, lastCheck, hasOfficialAnnouncement, uncertainty, etc.
 */
export const getServiceObservationSummary = (serviceKey, store) => {
  const activeIncidents = getServiceObservations(serviceKey, store);

  if (activeIncidents.length === 0) {
    return {
      serviceKey,
      sampleSize: 0,
      lastSyntheticCheck: null,
      hasOfficialAnnouncement: false,
      hasCommunityReports: false,
      uncertainty: 'noData',
      errorCategories: {},
      deviceClasses: {},
    };
  }

  // Count by tier
  const officialCount = activeIncidents.filter(
    (inc) => inc.tier === INCIDENT_TIER.VERIFIED_OFFICIAL
  ).length;
  const communityCount = activeIncidents.filter(
    (inc) => inc.tier === INCIDENT_TIER.COMMUNITY_REPORTED
  ).length;

  // Find the most recent synthetic check
  let lastSyntheticCheck = null;
  let lastCheckTime = 0;

  for (const inc of activeIncidents) {
    // Official incidents have startTime; community reports have reportedAt
    const checkTime = inc.startTime ? new Date(inc.startTime).getTime() : new Date(inc.reportedAt).getTime();
    if (checkTime > lastCheckTime) {
      lastCheckTime = checkTime;
      lastSyntheticCheck = inc;
    }
  }

  // Aggregate error categories from community reports
  const errorCategories = {};
  const deviceClasses = {};

  for (const inc of activeIncidents) {
    if (inc.errorCategory) {
      errorCategories[inc.errorCategory] = (errorCategories[inc.errorCategory] || 0) + 1;
    }
    if (inc.deviceClass) {
      deviceClasses[inc.deviceClass] = (deviceClasses[inc.deviceClass] || 0) + 1;
    }
  }

  // Determine uncertainty based on sample size and mix of official vs community
  let uncertainty;
  if (officialCount > 0 && communityCount === 0) {
    uncertainty = 'low'; // Only official announcements
  } else if (officialCount > 0 && communityCount > 0) {
    uncertainty = 'mixed'; // Both official and community
  } else if (communityCount > 0 && (communityCount < 5)) {
    uncertainty = 'lowSample'; // Few community reports
  } else if (communityCount > 0) {
    uncertainty = 'moderate'; // Enough community reports
  } else {
    uncertainty = 'high'; // No clear data
  }

  return {
    serviceKey,
    sampleSize: activeIncidents.length,
    lastSyntheticCheck: lastSyntheticCheck
      ? {
          status: lastSyntheticCheck.tier === INCIDENT_TIER.VERIFIED_OFFICIAL
            ? (lastSyntheticCheck.startTime ? 'official' : 'synthetic')
            : lastSyntheticCheck.status,
          title: lastSyntheticCheck.title,
          timeAgo: lastSyntheticCheck.startTime
            ? `${Math.floor((Date.now() - new Date(lastSyntheticCheck.startTime).getTime()) / (1000 * 60 * 60))}h ago`
            : `${Math.floor((Date.now() - new Date(lastSyntheticCheck.reportedAt).getTime()) / (1000 * 60 * 60))}h ago`,
        }
      : null,
    hasOfficialAnnouncement: officialCount > 0,
    hasCommunityReports: communityCount > 0,
    uncertainty,
    errorCategories,
    deviceClasses,
    officialCount,
    communityCount,
  };
};

/**
 * Offline checklist data structure for preserving work during portal outages.
 * This provides alternative access paths that do not require the portal.
 */
export const OFFLINE_CHECKLIST_TEMPLATES = {
  [DEVICE_CLASS.DESKTOP]: {
    title: 'Offline Checklist — Desktop',
    steps: [
      'Save your progress locally (export data if possible).',
      'Try the secondary/common service centre portal mirror.',
      'Contact the department helpline listed on the official portal.',
      'Visit a Common Service Centre (CSC) or e-Sevai centre in person.',
      'Check for official bulletins on the government notice board.',
    ],
  },
  [DEVICE_CLASS.MOBILE]: {
    title: 'Offline Checklist — Mobile',
    steps: [
      'Use the "Save PDF" or "Export" feature to preserve your work locally.',
      'Switch to cellular data if on Wi-Fi, or vice versa (network-specific issues).',
      'Call the official helpline number for the service.',
      'Visit a Common Service Centre (CSC) or nearest government office.',
      'Check government social media channels for outage announcements.',
    ],
  },
  [DEVICE_CLASS.TABLET]: {
    title: 'Offline Checklist — Tablet',
    steps: [
      'Export or print your application/filled form for offline records.',
      'Try accessing via the reduced-functionality mobile site if available.',
      'Use the nearest Common Service Centre (CSC) counter.',
      'Contact the department via official telephone desk.',
      'Monitor official government portals for maintenance updates.',
    ],
  },
  [DEVICE_CLASS.UNKNOWN]: {
    title: 'Offline Checklist — Unknown Device',
    steps: [
      'Preserve your work by taking a screenshot or exporting data.',
      'Try accessing from a different device (desktop or mobile).',
      'Contact the service helpline using numbers from official sources.',
      'Visit a Common Service Centre (CSC) or government office in person.',
      'Check for official outage announcements on government notice boards.',
    ],
  },
};

/**
 * Get the offline checklist for a given device class.
 *
 * @param {string} deviceClass - One of DEVICE_CLASS values
 * @returns {Object} The offline checklist template
 */
export const getOfflineChecklist = (deviceClass = DEVICE_CLASS.UNKNOWN) => {
  return OFFLINE_CHECKLIST_TEMPLATES[deviceClass] || OFFLINE_CHECKLIST_TEMPLATES[DEVICE_CLASS.UNKNOWN];
};

/**
 * Rate limiting helper for synthetic checks.
 * Ensures we don't flood a portal with checks.
 * Gracefully handles environments without localStorage (e.g., SSR, test).
 *
 * @param {string} serviceKey - The service key being checked
 * @param {number} minIntervalMs - Minimum milliseconds between checks for this service (default: 300000 = 5 min)
 * @returns {boolean} Whether the check should proceed
 */
export const rateLimitCheck = (serviceKey, minIntervalMs = 300000) => {
  // If localStorage is not available (SSR, test environment), always allow checks
  let storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      storage = window.localStorage;
    }
  } catch {
    // localStorage not available
  }

  if (!storage) {
    // No storage available — allow check, just won't track rate limits
    return true;
  }

  const lastCheckKey = `last_check_${serviceKey}`;
  const lastCheckTime = storage.getItem(lastCheckKey);

  if (lastCheckTime) {
    const elapsed = Date.now() - parseInt(lastCheckTime, 10);
    if (elapsed < minIntervalMs) {
      return false; // Rate limited — wait before next check
    }
  }

  // Record the check time
  try {
    storage.setItem(lastCheckKey, Date.now().toString());
  } catch {
    // Storage full or blocked — still allow the check, just won't track
  }

  return true;
};

/**
 * Error classification helper — given a synthetic check result,
 * classify the error category that a community reporter would use.
 *
 * @param {Object} checkResult - Result from runSyntheticCheck
 * @returns {string} One of ERROR_CATEGORY values
 */
export const classifyErrorCategory = (checkResult) => {
  if (checkResult.status === STATUS.RATE_LIMITED) {
    return ERROR_CATEGORY.CONNECTIVITY;
  }
  if (checkResult.status === STATUS.UNAVAILABLE) {
    return ERROR_CATEGORY.PORTAL_OUTAGE;
  }
  if (checkResult.status === STATUS.UNVERIFIED) {
    // CORS refusals, DNS errors, and network errors all look the same externally
    // but we can distinguish some patterns from the error string
    const errorMsg = checkResult.error || '';
    const lowerError = errorMsg.toLowerCase();
    // Check for 'timeout' or 'timed out' (case-insensitive)
    if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
      return ERROR_CATEGORY.CONNECTIVITY;
    }
    // Check for 'blocked-or-network' or 'blocked' or 'CORS' patterns
    if (lowerError.includes('blocked-or-network') || lowerError.includes('cors')) {
      return ERROR_CATEGORY.CONNECTIVITY;
    }
    if (lowerError.includes('network')) {
      return ERROR_CATEGORY.CONNECTIVITY;
    }
    // Default unverified = unknown category (could be anything)
    return ERROR_CATEGORY.UNKNOWN;
  }
  if (checkResult.status === STATUS.BLOCKED) {
    return ERROR_CATEGORY.UNKNOWN;
  }
  // REACHABLE with no error = no issue
  return ERROR_CATEGORY.UNKNOWN;
};

export default {
  STATUS,
  DEVICE_CLASS,
  ERROR_CATEGORY,
  PERMITTED_CHECK_METHODS,
  DEFAULT_CHECK_TIMEOUT_MS,
  DEFAULT_CHECK_TTL_HOURS,
  MAX_COMMUNITY_REPORTS_PER_SERVICE,
  runSyntheticCheck,
  submitAnonymousReport,
  publishOfficialAnnouncement,
  registerCommunityReport,
  expireStaleObservations,
  getServiceObservations,
  getServiceObservationSummary,
  OFFLINE_CHECKLIST_TEMPLATES,
  getOfflineChecklist,
  rateLimitCheck,
  classifyErrorCategory,
};