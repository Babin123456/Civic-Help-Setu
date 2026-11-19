// Volunteer Task Contract (schema version 1)
// --------------------------------------------
// Defines the schema for volunteer task / volunteer_post records.
// Published by coordinators; citizens can apply to these tasks.
// Full field reference: docs/VOLUNTEER_TASK_DATA_CONTRACT.md
// This is a code-level contract for components and future integrations.
// NOT a deployed network API: nothing here is served over HTTP.

import { ID_PATTERN, isObject, isText, isNonEmptyText, isTextList, isRealDate } from './serviceContract.js';

export const VOLUNTEER_TASK_SCHEMA_VERSION = 1;
export const SUPPORTED_VOLUNTEER_TASK_SCHEMA_VERSIONS = [1];
export const TASK_PUBLICATION_STATES = ['draft', 'published', 'archived', 'completed'];
export const TASK_PRIORITY_LEVELS = ['low', 'medium', 'high', 'urgent'];

/**
 * Validate a volunteer task record.
 * Returns a list of { field, reason } errors; an empty list means the record satisfies the contract.
 */
export function validateVolunteerTaskRecord(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  // Required field: id
  if (!isText(record.id) || !ID_PATTERN.test(record.id)) {
    fail('id', 'is required and must be a lowercase slug such as "clean-drive-ward-4"');
  }

  // Required field: title
  if (!isNonEmptyText(record.title)) {
    fail('title', 'is required and must be a non-empty string');
  }

  // Required field: description
  if (!isText(record.description) || !isNonEmptyText(record.description)) {
    fail('description', 'is required and must be a non-empty string');
  }

  // Required field: coordinatorId - the ID of the coordinator posting this task
  if (!isText(record.coordinatorId) || !ID_PATTERN.test(record.coordinatorId)) {
    fail('coordinatorId', 'is required and must be a lowercase slug such as "coord-john-doe"');
  }

  // Required field: requiredSkills - array of skill IDs or skill objects
  if (!Array.isArray(record.requiredSkills)) {
    fail('requiredSkills', 'must be an array');
  } else {
    record.requiredSkills.forEach((skill, i) => {
      if (typeof skill === 'object' && skill !== null) {
        if (!isText(skill.id) || !ID_PATTERN.test(skill.id)) {
          fail(`requiredSkills[${i}].id`, 'must be a lowercase slug if present as an object');
        }
        if (!isText(skill.name) || !isNonEmptyText(skill.name)) {
          fail(`requiredSkills[${i}].name`, 'must be a non-empty string if present as an object');
        }
      } else if (typeof skill === 'string') {
        if (!ID_PATTERN.test(skill)) {
          fail(`requiredSkills[${i}](string)`, 'must be a lowercase slug if present as a string');
        }
      } else {
        fail(`requiredSkills[${i}]`, 'must be a string or an object with id and name');
      }
    });
  }

  // Required field: serviceAreaId - the area where this task operates
  if (!isText(record.serviceAreaId) || !ID_PATTERN.test(record.serviceAreaId)) {
    fail('serviceAreaId', 'is required and must be a lowercase slug');
  }

  // Optional: stateJurisdiction - which state(s) this task applies to
  if (record.stateJurisdiction !== undefined) {
    if (!isTextList(record.stateJurisdiction)) {
      fail('stateJurisdiction', 'must be an array of non-empty strings when present');
    }
  }

  // Optional: city / locality
  if (record.city !== undefined) {
    if (!isText(record.city) || !isNonEmptyText(record.city)) {
      fail('city', 'must be a non-empty string when present');
    }
  }

  // Optional: streetAddress / exact location
  if (record.streetAddress !== undefined) {
    if (!isText(record.streetAddress)) {
      fail('streetAddress', 'must be a string when present');
    }
  }

  // Optional: priority level
  if (record.priority !== undefined) {
    const validLevels = TASK_PRIORITY_LEVELS;
    if (!validLevels.includes(record.priority)) {
      fail('priority', `must be one of: ${validLevels.join(', ')} when present`);
    }
  }

  // Optional: participantCapacity - maximum number of volunteers
  if (record.participantCapacity !== undefined) {
    if (!Number.isInteger(record.participantCapacity) || record.participantCapacity < 1) {
      fail('participantCapacity', 'must be a positive integer when present');
    }
  }

  // Optional: currentParticipants - current count (should not exceed capacity)
  if (record.currentParticipants !== undefined) {
    if (!Number.isInteger(record.currentParticipants) || record.currentParticipants < 0) {
      fail('currentParticipants', 'must be a non-negative integer when present');
    }
    // Validation: currentParticipants should not exceed capacity (informational, not enforced at contract level)
    // This is checked at the service layer
  }

  // Optional: taskStartDate
  if (record.taskStartDate !== undefined) {
    if (!isRealDate(record.taskStartDate)) {
      fail('taskStartDate', 'must be a real date in YYYY-MM-DD format when present');
    }
  }

  // Optional: taskEndDate
  if (record.taskEndDate !== undefined) {
    if (!isRealDate(record.taskEndDate)) {
      fail('taskEndDate', 'must be a real date in YYYY-MM-DD format when present');
    }
    // Validation: taskEndDate should be after taskStartDate (checked at service layer)
  }

  // Optional: publicationState
  if (record.publicationState !== undefined) {
    if (!TASK_PUBLICATION_STATES.includes(record.publicationState)) {
      fail('publicationState', `must be one of: ${TASK_PUBLICATION_STATES.join(', ')} when present`);
    }
  }

  // Optional: accessibilityNeeds - e.g. "wheelchair-accessible", "sign-language-interpreter"
  if (record.accessibilityNeeds !== undefined) {
    if (!isTextList(record.accessibilityNeeds)) {
      fail('accessibilityNeeds', 'must be an array of non-empty strings when present');
    }
  }

  // Optional: compensation - e.g. "free", "stipend-amount", "meals-provided"
  if (record.compensation !== undefined) {
    if (!isText(record.compensation)) {
      fail('compensation', 'must be a non-empty string when present');
    }
  }

  // Optional: tags - free-form search tags
  if (record.tags !== undefined) {
    if (!isTextList(record.tags)) {
      fail('tags', 'must be an array of non-empty strings when present');
    }
  }

  // Optional: contactPublic - whether contact details are publicly visible
  if (record.contactPublic !== undefined) {
    if (typeof record.contactPublic !== 'boolean') {
      fail('contactPublic', 'must be a boolean when present');
    }
  }

  // Optional: verifiedOnly - whether only verified volunteers can apply
  if (record.verifiedOnly !== undefined) {
    if (typeof record.verifiedOnly !== 'boolean') {
      fail('verifiedOnly', 'must be a boolean when present');
    }
  }

  // Metadata
  if (record.schemaVersion !== undefined) {
    if (record.schemaVersion !== VOLUNTEER_TASK_SCHEMA_VERSION) {
      fail('schemaVersion', `must be ${VOLUNTEER_TASK_SCHEMA_VERSION} when present; got ${record.schemaVersion}`);
    }
  }

  if (record.createdBy !== undefined && !isText(record.createdBy)) {
    fail('createdBy', 'must be a non-empty string when present');
  }

  if (record.createdAt !== undefined) {
    if (!isRealDate(record.createdAt)) {
      fail('createdAt', 'must be a real date in YYYY-MM-DD format when present');
    }
  }
  if (record.updatedAt !== undefined) {
    if (!isRealDate(record.updatedAt)) {
      fail('updatedAt', 'must be a real date in YYYY-MM-DD format when present');
    }
  }

  return errors;
}

/**
 * Fill optional fields with their safe fallbacks. Returns a new object.
 */
export function applyVolunteerTaskDefaults(record) {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? VOLUNTEER_TASK_SCHEMA_VERSION,
    publicationState: record.publicationState ?? 'draft',
    priority: record.priority ?? 'medium',
    currentParticipants: record.currentParticipants ?? 0,
    contactPublic: record.contactPublic ?? false,
    verifiedOnly: record.verifiedOnly ?? false,
  };
}

/**
 * Validate a whole volunteer task envelope: { schemaVersion, volunteerTask }.
 * Returns { valid, errors }.
 */
export function validateVolunteerTaskEnvelope(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (!SUPPORTED_VOLUNTEER_TASK_SCHEMA_VERSIONS.includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: ${SUPPORTED_VOLUNTEER_TASK_SCHEMA_VERSIONS.join(', ')}`,
    });
    return { valid: false, errors };
  }
  if (!envelope.volunteerTask) {
    errors.push({ serviceId: null, field: 'volunteerTask', reason: 'must be present' });
    return { valid: false, errors };
  }
  const serviceErrors = validateVolunteerTaskRecord(envelope.volunteerTask);
  serviceErrors.forEach((e) => { e.serviceId = envelope.volunteerTask.id || 'unknown'; });
  return { valid: errors.length === 0, errors };
}

/** One-line human readable form of an error, e.g. for logs. */
export const formatVolunteerTaskError = (e) => `${e.serviceId ? `${e.serviceId}: ` : ''}${e.field} ${e.reason}`;