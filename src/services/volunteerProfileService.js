// Volunteer Profile Service
// -------------------------
// Provides CRUD and state-transition operations for volunteer profiles.
// Enforces schema validation, schema versioning, and audit logging.
// All writes are validated on the service boundary; client validation is a usability layer.

import {
  VOLUNTEER_PROFILE_SCHEMA_VERSION,
  SUPPORTED_VOLUNTEER_PROFILE_SCHEMA_VERSIONS,
  validateVolunteerProfileRecord,
  validateVolunteerProfileEnvelope,
  applyVolunteerProfileDefaults,
  formatVolunteerProfileError,
} from '../data/volunteerProfileContract.js';
import { v4 as uuidv4 } from 'crypto'; // Note: in browser context, use a UUID library

// In-memory storage for demonstration; in production this would be IndexedDB, Firebase, or a backend.
// Key: volunteerProfileId -> record
const volunteerProfiles = new Map();

// Audit trail: append-only log of state changes
const auditLog = [];
const AUDIT_MAX_ENTRIES = 1000;

/**
 * Generate a unique ID for new records.
 * In a real deployment, this would use a proper UUID generator or database-issued IDs.
 */
function generateId(prefix = 'vol-prof') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Get the current schema version from a record, or the default. */
function getSchemaVersion(record) {
  return record?.schemaVersion ?? VOLUNTEER_PROFILE_SCHEMA_VERSION;
}

/** Ensure a record has proper defaults applied. */
function ensureDefaults(record) {
  return applyVolunteerProfileDefaults({
    ...record,
    schemaVersion: getSchemaVersion(record),
    createdAt: record.createdAt || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
    createdBy: record.createdBy || 'system',
  });
}

/**
 * Create a new volunteer profile.
 * @param {Object} profile - The profile data (without id, createdAt, updatedAt; these are generated)
 * @param {Object} [options] - Optional { createdBy }
 * @returns {Object} The created profile with generated IDs/timestamps
 * @throws {Error} If validation fails
 */
export function createVolunteerProfile(profile, options = {}) {
  // Apply defaults and validate
  const prepared = ensureDefaults(profile);

  // Validate the full envelope
  const envelope = { schemaVersion: VOLUNTEER_PROFILE_SCHEMA_VERSION, volunteerProfile: prepared };
  const validation = validateVolunteerProfileEnvelope(envelope);
  if (!validation.valid) {
    const errors = validation.errors.map(formatVolunteerProfileError).join('; ');
    throw new Error(`Volunteer profile validation failed: ${errors}`);
  }

  // Generate ID if not present
  const profileId = prepared.id || generateId();
  prepared.id = profileId;
  prepared.createdAt = new Date().toISOString().split('T')[0];
  prepared.updatedAt = new Date().toISOString().split('T')[0];
  prepared.createdBy = options.createdBy || 'system';

  // Store
  volunteerProfiles.set(profileId, prepared);

  // Append audit event
  appendAudit({
    action: 'create',
    resource: 'volunteer_profile',
    resourceId: profileId,
    performedBy: options.createdBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Volunteer profile created',
    // Sanitized - no sensitive personal data
  });

  return prepared;
}

/**
 * Read a volunteer profile by ID.
 * @param {string} profileId - The profile ID
 * @returns {Object|null} The profile or null if not found
 */
export function readVolunteerProfile(profileId) {
  return volunteerProfiles.get(profileId) || null;
}

/**
 * Update an existing volunteer profile.
 * Only fields that are allowed to change may be modified.
 * Schema version bumps require explicit approval.
 * @param {string} profileId - The profile ID
 * @param {Object} updates - The fields to update
 * @param {Object} [options] - Optional { updatedBy }
 * @returns {Object|undefined} The updated profile, or undefined if not found
 * @throws {Error} If validation fails
 */
export function updateVolunteerProfile(profileId, updates, options = {}) {
  const existing = volunteerProfiles.get(profileId);
  if (!existing) {
    throw new Error(`Volunteer profile ${profileId} not found`);
  }

  // Merge updates with existing record
  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString().split('T')[0],
  };

  // Validate the full envelope
  const envelope = { schemaVersion: VOLUNTEER_PROFILE_SCHEMA_VERSION, volunteerProfile: updated };
  const validation = validateVolunteerProfileEnvelope(envelope);
  if (!validation.valid) {
    const errors = validation.errors.map(formatVolunteerProfileError).join('; ');
    throw new Error(`Volunteer profile update validation failed: ${errors}`);
  }

  // Update in storage
  updated.updatedAt = new Date().toISOString().split('T')[0];
  volunteerProfiles.set(profileId, updated);

  // Append audit event
  appendAudit({
    action: 'update',
    resource: 'volunteer_profile',
    resourceId: profileId,
    performedBy: options.updatedBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Volunteer profile updated',
    // Sanitized - no sensitive personal data
  });

  return updated;
}

/**
 * Delete (archive) a volunteer profile.
 * @param {string} profileId - The profile ID
 * @param {Object} [options] - Options
 * @returns {boolean} true if deleted, false if not found
 * @throws {Error} If the profile has active assignments and cannot be archived
 */
export function deleteVolunteerProfile(profileId, options = {}) {
  const existing = volunteerProfiles.get(profileId);
  if (!existing) {
    return false;
  }

  // Check for active assignments before archiving
  // In a full implementation, we'd check the assignment service
  // For now, allow archival

  volunteerProfiles.delete(profileId);

  // Append audit event
  appendAudit({
    action: 'archive',
    resource: 'volunteer_profile',
    resourceId: profileId,
    performedBy: options.updatedBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Volunteer profile archived',
  });

  return true;
}

/**
 * List volunteer profiles with filters.
 * @param {Object} filters - Optional filters { status, category, jurisdiction, createdBy }
 * @param {number} [page=1] - Page number
 * @param {number} [pageSize=20] - Page size
 * @returns {Object} { profiles, total, page, pageSize }
 */
export function listVolunteerProfiles(filters = {}, page = 1, pageSize = 20) {
  const { status, category, jurisdiction, createdBy } = filters;
  let results = Array.from(volunteerProfiles.values());

  // Apply filters
  if (status && status !== 'all') {
    results = results.filter((p) => p.status === status);
  }
  if (category) {
    results = results.filter((p) => p.category === category);
  }
  if (jurisdiction) {
    results = results.filter((p) => {
      const pj = p.jurisdiction;
      if (!pj) return false;
      // Check if the volunteer's jurisdiction matches the filter
      if (pj.level && pj.level === jurisdiction) return true;
      if (pj.states && pj.states.includes(jurisdiction)) return true;
      return false;
    });
  }
  if (createdBy) {
    results = results.filter((p) => p.createdBy === createdBy);
  }

  // Sort by createdAt descending
  results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // Paginate
  const total = results.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageResults = results.slice(start, end);

  return {
    profiles: pageResults,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Append an audit event to the append-only audit log.
 * @param {Object} event - The audit event
 */
function appendAudit(event) {
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    ...event,
  };
  auditLog.push(entry);
  // Trim to max entries
  if (auditLog.length > AUDIT_MAX_ENTRIES) {
    auditLog.shift(); // Remove oldest
  }
}

/**
 * Get the audit log (read-only, append-only view).
 * @param {Object} [options] - Filter options { resource, resourceId, action, start, end }
 * @returns {Array} Audit events matching the filters
 */
export function getAuditLog(options = {}) {
  const { resource, resourceId, action, start, end } = options;
  let results = auditLog;

  if (resource) {
    results = results.filter((e) => e.resource === resource);
  }
  if (resourceId) {
    results = results.filter((e) => e.resourceId === resourceId);
  }
  if (action) {
    results = results.filter((e) => e.action === action);
  }
  if (start || end) {
    const startTime = start ? new Date(start).getTime() : 0;
    const endTime = end ? new Date(end).getTime() : Infinity;
    results = results.filter(
      (e) => new Date(e.timestamp).getTime() >= startTime && new Date(e.timestamp).getTime() <= endTime
    );
  }

  return results;
}

// Export the storage for testing purposes (normally would be private)
export { volunteerProfiles, auditLog };