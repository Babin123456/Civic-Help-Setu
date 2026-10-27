/**
 * Citizen Data Portability Export Service
 * 
 * Generates structured, human-readable, portable export packages (JSON & CSV)
 * of a citizen's personal Civic Help Setu workflow data:
 * - Saved Services & Collections
 * - Application Checklist Tasks & Preparation Steps
 * - Tracking Deadlines & Reminders
 * - Application Draft Notes
 * 
 * Strict Security Boundaries:
 * - Requires verified authenticated user; strictly prevents cross-user access
 * - Explicitly excludes credentials, tokens, session cookies, passwords, and raw vault file binaries
 * - Standardized schema with semantic versioning (exportVersion: "1.0.0")
 */

export const EXPORT_SCHEMA_VERSION = '1.0.0';

export const EXCLUDED_SENSITIVE_FIELDS_EXPLANATION =
  'For security and privacy protection, credentials, session tokens, passwords, MFA secrets, and raw encrypted document binaries stored in your local vault are excluded from this export. This export contains only portable process metadata, checklists, reminders, and text notes.';

export const SUPPORTED_EXPORT_CATEGORIES = [
  { id: 'saved_services', label: 'Saved Services & Bookmarks' },
  { id: 'checklists', label: 'Checklist Tasks & Steps' },
  { id: 'reminders', label: 'Application Reminders & Deadlines' },
  { id: 'notes', label: 'Personal Service Notes & Form Drafts' },
];

/**
 * Safe local storage resolver
 */
const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

/**
 * Validates user authentication
 */
export const assertAuthenticated = (currentUser) => {
  if (!currentUser || typeof currentUser !== 'object') {
    throw new Error('Authentication required: You must be logged in to export personal data.');
  }

  const userId = currentUser.id || currentUser.userId;
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('Invalid authentication session: User identifier is missing.');
  }

  return userId.trim();
};

/**
 * Escapes values for CSV output adhering to RFC 4180
 */
export const escapeCsvValue = (val) => {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Converts array of flat objects to CSV string
 */
export const convertToCsv = (rows, headers) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return headers.map((h) => escapeCsvValue(h.label)).join(',') + '\n';
  }

  const headerRow = headers.map((h) => escapeCsvValue(h.label)).join(',');
  const dataRows = rows.map((row) =>
    headers.map((h) => escapeCsvValue(row[h.key])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
};

/**
 * Sanitizes object by stripping any sensitive keys
 */
export const sanitizeRecord = (record) => {
  if (!record || typeof record !== 'object') return record;

  const forbiddenKeys = [
    'password',
    'token',
    'authToken',
    'sessionToken',
    'secret',
    'apiKey',
    'privateKey',
    'fileBlob',
    'base64',
    'binary',
    'encryptedPayload',
  ];

  const clean = {};
  for (const [key, value] of Object.entries(record)) {
    const isSensitive = forbiddenKeys.some((f) => key.toLowerCase().includes(f.toLowerCase()));
    if (!isSensitive) {
      clean[key] = value;
    }
  }
  return clean;
};

/**
 * Collects raw personal records for the active user
 */
export const collectUserRecords = (userId, customStorage) => {
  const storage = getStorage(customStorage);
  const result = {
    savedServices: [],
    checklists: [],
    reminders: [],
    notes: [],
  };

  if (!storage) return result;

  // 1. Saved Services
  try {
    const rawSaved = storage.getItem('civicbridge_saved');
    if (rawSaved) {
      const parsed = JSON.parse(rawSaved);
      if (Array.isArray(parsed)) {
        result.savedServices = parsed
          .filter((item) => !item.userId || item.userId === userId)
          .map((item) => sanitizeRecord(item));
      }
    }
  } catch {
    result.savedServices = [];
  }

  // 2. Checklists
  try {
    const rawChecklist = storage.getItem('civicbridge_checklist');
    if (rawChecklist) {
      const parsed = JSON.parse(rawChecklist);
      if (Array.isArray(parsed)) {
        result.checklists = parsed
          .filter((item) => !item.userId || item.userId === userId)
          .map((item) => sanitizeRecord(item));
      }
    }
  } catch {
    result.checklists = [];
  }

  // 3. Reminders & Tracked Applications
  try {
    const rawTracking = storage.getItem('civicbridge_track_applications');
    if (rawTracking) {
      const parsed = JSON.parse(rawTracking);
      if (Array.isArray(parsed)) {
        result.reminders = parsed
          .filter((item) => !item.userId || item.userId === userId)
          .map((item) => sanitizeRecord(item));
      }
    }
  } catch {
    result.reminders = [];
  }

  // 4. Notes & Form Drafts
  try {
    const rawDrafts = storage.getItem('civicbridge_form_drafts');
    if (rawDrafts) {
      const parsed = JSON.parse(rawDrafts);
      if (Array.isArray(parsed)) {
        result.notes = parsed
          .filter((item) => !item.userId || item.userId === userId)
          .map((item) => sanitizeRecord(item));
      } else if (typeof parsed === 'object') {
        result.notes = Object.entries(parsed)
          .map(([key, val]) => ({ draftKey: key, ...sanitizeRecord(val) }))
          .filter((item) => !item.userId || item.userId === userId);
      }
    }
  } catch {
    result.notes = [];
  }

  return result;
};

/**
 * Generates an export preview showing categories, counts, and security notice
 */
export const generateExportPreview = (currentUser, customStorage) => {
  const userId = assertAuthenticated(currentUser);
  const records = collectUserRecords(userId, customStorage);

  const counts = {
    saved_services: records.savedServices.length,
    checklists: records.checklists.length,
    reminders: records.reminders.length,
    notes: records.notes.length,
  };

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    userId,
    userEmail: currentUser.email || currentUser.primaryEmailAddress || 'Not registered',
    schemaVersion: EXPORT_SCHEMA_VERSION,
    totalRecords,
    counts,
    categories: SUPPORTED_EXPORT_CATEGORIES.map((cat) => ({
      ...cat,
      count: counts[cat.id] || 0,
    })),
    securityNotice: EXCLUDED_SENSITIVE_FIELDS_EXPLANATION,
    isEmpty: totalRecords === 0,
  };
};

/**
 * Builds the complete export bundle in JSON and CSV formats
 */
export const buildCitizenDataExport = (currentUser, options = {}, customStorage) => {
  const userId = assertAuthenticated(currentUser);
  const records = collectUserRecords(userId, customStorage);
  const nowIso = new Date().toISOString();

  const preview = generateExportPreview(currentUser, customStorage);

  const exportPayload = {
    exportVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: nowIso,
    user: {
      id: userId,
      email: currentUser.email || currentUser.primaryEmailAddress || null,
      username: currentUser.username || currentUser.fullName || null,
    },
    meta: {
      platform: 'Civic Help Setu',
      securityScope: 'Personal user workflow data only. Credentials, encryption secrets, and raw vault file contents are excluded.',
      totalRecords: preview.totalRecords,
      counts: preview.counts,
    },
    data: records,
  };

  // Build CSV strings for each category
  const csvExports = {
    savedServices: convertToCsv(records.savedServices, [
      { key: 'id', label: 'Service ID' },
      { key: 'name', label: 'Service Name' },
      { key: 'category', label: 'Category' },
      { key: 'savedAt', label: 'Saved At' },
    ]),
    checklists: convertToCsv(records.checklists, [
      { key: 'id', label: 'Task ID' },
      { key: 'serviceId', label: 'Service ID' },
      { key: 'text', label: 'Task Description' },
      { key: 'completed', label: 'Completed' },
      { key: 'dueDate', label: 'Due Date' },
    ]),
    reminders: convertToCsv(records.reminders, [
      { key: 'id', label: 'Application ID' },
      { key: 'serviceName', label: 'Service Name' },
      { key: 'status', label: 'Status' },
      { key: 'submissionDate', label: 'Submission Date' },
      { key: 'expectedResolutionDate', label: 'Target Date' },
    ]),
    notes: convertToCsv(records.notes, [
      { key: 'draftKey', label: 'Form Identifier' },
      { key: 'serviceId', label: 'Service ID' },
      { key: 'updatedAt', label: 'Last Updated' },
      { key: 'notes', label: 'Notes Content' },
    ]),
  };

  return {
    payload: exportPayload,
    data: records,
    jsonString: JSON.stringify(exportPayload, null, 2),
    csvExports,
    preview,
  };
};

/**
 * Triggers a browser download of a generated file blob
 */
export const triggerDownload = (content, filename, mimeType = 'application/json') => {
  if (typeof window === 'undefined' || !window.document) return false;

  try {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
};
